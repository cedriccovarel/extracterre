// ExtracTerre v2.6.0 — recherches personnalisées, tuiles d'opérations, export à la carte, pack du 26/10/2026.
// Documents FICTIFS reproduisant les formulations observées (CCTP, études thermiques).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,DOC_TYPES,matchFieldByHeader} from './js/config.js';
import {normalizeText} from './js/utils.js';
import {normalizeGrid,runSearchGrid,searchCellValue,termRegex,srchStats,SECURITY_GRID,keywordPrompt,gridPrompt,parseLlmObject} from './js/recherches.js';
import {parseStudyLabelPatterns} from './js/parsers.js';
import {sanitizeOccurrence} from './js/sanity.js';
import {applyComparisonBases} from './js/engine.js';
import {parseLlmJson,llmComplete} from './js/llm-assist.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION, '2.13.1','version');
const page=(no,ls)=>({page:no,lines:ls.map((t,index)=>({index,text:normalizeText(t),items:[]}))});
const D=(name,pages,type='CCTP')=>({id:name,name,type,status:'ready',read:{pages}});

// 1. Grille Sécurité sur des CCTP fictifs
const docs=[
  D('LOT 05 MENUISERIES EXT.pdf',[page(1,['Volets roulants aluminium','Systeme avec blocage anti-soulevement pour les volets roulants situes au rez-de-chaussee.','Vitrage STADIP 44.2 retardateur d\'effraction','1 cremone a larder a 3 points avec poignee'])]),
  D('LOT 12 MENUISERIE INT.pdf',[page(1,['22-01-30.00 BLOC-PORTE PALIER LOGEMENT','Fourniture de bloc-porte type HUET AXIOME BP1 ou equivalent, antieffraction','- Serrure : cremone 3 points Vachette A2P*, cylindre europeen'])]),
  D('LOT 08 SERRURERIE.pdf',[page(1,['Etabli par SAS CABINET ECONOMISTES','badge','25-65-10.00 CLOTURE ACIER LAQUE Hauteur 1.60 m','Portillon au droit du portail avec ventouse, ouverture par Vigik','Grille de cloture : barreaudage tube 30 mm','25-61-00.00 BARREAUDAGE EN TABLEAU de 0.50 x htr 0.90 m'])]),
  D('LOT 09 PORTES DE GARAGES.pdf',[page(1,['Parking en sous-sol','39-11-00.00 PORTE INDIVIDUELLE BASCULANTE MANUELLE','39-21-00.01 PORTE COLLECTIVE BASCULANTE MOTORISEE, commande par telecommande'])])];
const r=runSearchGrid(SECURITY_GRID,docs);
const f=id=>r.criteria[id];
ok(f('fen_volets').found&&f('fen_442').found,'volets anti-soulèvement et 44.2');
ok(f('fen_barreaux').found&&f('fen_barreaux').evidence.every(e=>/TABLEAU/.test(e.line)),'barreaux de fenêtre (en tableau), pas ceux de la clôture');
ok(f('porte_3pts').found&&f('porte_3pts').evidence.every(e=>!/poignee/.test(e.line)),'serrure 3 points de porte palière, pas la crémone de fenêtre');
ok(f('porte_a2p').found,'BP1 / A2P');
ok(!f('hall_sas').found,'« SAS CABINET » n’est pas un sas');
eq([f('abords_cloture').found,f('abords_cloture').contrary,f('abords_cloture').values],[false,true,[1.6]],'clôture 1,60 m : hors seuil, 30 mm ignoré');
ok(f('abords_portails').found,'portail + portillon Vigik');
eq([f('parking_libre').found,f('parking_libre').contrary],[false,true],'porte basculante individuelle = indice contraire');
ok(f('parking_portail').found&&r.themes['Parkings en sous-sol'].applicable,'parking présent, portail motorisé');
eq(r.themes['Portes d’entrée des logements'].ok,true,'thème portes suffisant');
eq(searchCellValue(r.grid.criteria.find(c=>c.id==='abords_cloture'),f('abords_cloture')),'Hors seuil (1.6 m)','cellule export hors seuil');
const r2=runSearchGrid(SECURITY_GRID,docs,{abords_cloture:'Oui'}); ok(r2.criteria.abords_cloture.found&&r2.criteria.abords_cloture.manual==='Oui','décision manuelle prioritaire');
// filtre de documents
eq(runSearchGrid({...SECURITY_GRID,docFilter:'garages'},docs).documents,['LOT 09 PORTES DE GARAGES.pdf'],'filtre sur le nom du document');

// 2. Grille modifiable : surfaces de logement (nombre + unité), entrée non fiable normalisée
const g=normalizeGrid({name:'Surfaces',criteria:[{label:'SHAB',kind:'number',unit:'m2',min:10,keywords:['surface habitable','shab'],evil:'<script>'},{label:'',keywords:['x']},{label:'Regex invalide',keywords:['re:(']}]});
eq([g.criteria.length,g.themes.length,'evil' in g.criteria[0]],[2,0,false],'grille normalisée (critère vide retiré, champs inconnus ignorés)');
eq(termRegex('re:('),null,'expression régulière invalide ignorée');
const rs=runSearchGrid(g,[D('Tableau de surfaces.pdf',[page(1,['Logement A01 T3 Surface habitable 65,20 m²','Logement A02 T2 SHAB 45,5 m2','Total surface habitable 110,70 m²','Annexe 3 m'])],'Tableau de surfaces')]);
eq(rs.criteria[g.criteria[0].id].values,[65.2,45.5,110.7],'surfaces lues avec unité');
// IA : prompts et lecture de la réponse
ok(/keywords/.test(keywordPrompt(g.criteria[0],g).system)&&/SHAB/.test(keywordPrompt(g.criteria[0],g).user),'prompt mots-clés');
ok(/criteria/.test(gridPrompt('surface').system),'prompt grille');
eq(parseLlmObject('Voici ```json {"keywords":["shab"]} ```').keywords,['shab'],'réponse IA JSON');
let call=null; const txt=await llmComplete({system:'s',user:'u'},{config:{mode:'local',provider:'ollama',model:'m'},fetchImpl:async(url,init)=>{ call=JSON.parse(init.body); return {ok:true,json:async()=>({message:{content:'{"keywords":[]}'}})}; }});
eq([txt,call.messages[1].content,call.format],['{"keywords":[]}','u','json'],'appel IA libre (Ollama)');
await assert.rejects(llmComplete({system:'s',user:'u'},{config:{mode:'off'}}),/désactivée/); n++;

// 3. Pack du 26/10/2026 : motifs d'études, garde-fous, déduction 1948, JSON coupé
const st=parseStudyLabelPatterns({id:'s',name:'Etude thermique.pdf',type:DOC_TYPES.THERMAL,buildings:{names:['Bâtiment unique']},read:{pages:[
  page(1,['Tic | 26.19 °C | 28.98 °C | Conforme']),page(2,['Etat initial du batiment','Consommation energetique (kwhEP /m².an) 177','Lettre etiquette D','Emissions de GES (kgeqCO2/m².an) 40','Lettre etiquette E']),
  page(3,['kWh (m²/SHON) (m²SHAB)','Etat existant 185.7 0.82 D F','Etat projet 86.1 0.567 C D']),page(4,['Projet Reference','Groupe 1 26.14 °C 28.57 °C','Groupe 2 27.02 °C 28.57 °C']),page(5,['Lettre etiquette C'])]}}).map(o=>`${o.page}:${o.field}=${o.value}`);
eq(st,['1:tic=26.19','1:tic_ref=28.98','2:dpe_energy_before=D','2:dpe_ges_before=E','3:dpe_energy_before=D','3:dpe_ges_before=F','3:dpe_energy_after=C','3:dpe_ges_after=D','4:tic=27.02','4:tic_ref=28.57'],'Tic, étiquettes et lignes d’état (étiquette sans contexte ignorée)');
const san=(field,value,extra={})=>sanitizeOccurrence({field,value,method:'generic:label',excerpt:String(value),docType:DOC_TYPES.THERMAL,...extra})?.value??null;
eq([san('dpe_energy_before','707'),san('dpe_ges_before','CO2 initial : 21,00 kgeqCO2/m²'),san('dpe_energy_after','classe D'),san('dpe_ges_after','B')],[null,null,'D','B'],'classes DPE : une lettre A à G');
eq([san('cooling','Réseau de chaleur'),san('cooling','Climatisation')],[null,'Climatisation'],'refroidissement ≠ réseau de chaleur');
eq([san('ubat_ref',83),san('ubat_ref',0.83)],[null,0.83],'Ubat Ref 83 rejeté');
eq(san('dpe_energy_before','707',{method:'manual:review-entry'}),'707','saisie manuelle jamais filtrée');
const res={rows:[{building:'B',construction_year:1965}],finals:[{building:'B',field:'construction_year',value:1965,fileName:'x.pdf',page:2}],detailed:[]};
applyComparisonBases(res); eq([res.rows[0].built_before_1948,res.rows[0].built_after_1948],['Non','Oui'],'période déduite de l’année lue');
const res2={rows:[{building:'B',construction_year:1930,built_before_1948:'Non'}],finals:[{building:'B',field:'construction_year',value:1930}],detailed:[]}; applyComparisonBases(res2); eq(res2.rows[0].built_before_1948,'Non','valeur existante conservée');
eq(parseLlmJson('{"proposals":[{"field":"shab","value":1,"page":1,"quote":"a"},{"field":"cep","val').map(p=>p.field),['shab'],'réponse IA coupée : propositions complètes gardées');

// 4. Interface : tuiles, macro-tuiles par maître d'ouvrage, import multi-opérations, export à la carte
const app=fs.readFileSync('./js/app.js','utf8'), html=fs.readFileSync('./index.html','utf8');
for(const re of [/function setHomeMode\(/,/id="homeView"|homeView/,/data-home-act/,/function renderTiles\(/,/data-tile-owner/,/function importOperationRows\(/,/function addSpreadsheetOrOperations\(/,/function openExportDialog\(/,/data-exp-owner/,/function renderSearches\(/]) ok(re.test(app),`interface : ${re}`);
ok(/data-result-view="searches"/.test(html)&&/data-sticky-result-view="searches"/.test(html),'onglet Recherches');
// v2.6.1 — en-têtes usuels d'un tableau d'opérations
eq(['Numéro de contrat','Contrat','N° opération','Société','Bailleur','Contrat: Statut'].map(h=>matchFieldByHeader(h)?.key),['contract_number','contract_number','internal_code','owner_company','owner_company','contract_status'],'en-têtes contrat / opération / société');
// v2.9.0 — critère « Statistiques » (tableau de surfaces FICTIF).
{ const tds={id:'t',name:'Tableau des surfaces.xlsx',status:'ready',read:{pages:[{page:1,text:'A101 | T2 | R+1 | 45,30 | 6,20\nA202 | T2 | R+2 | 47,80 | 5\nA102 | T3 | R+1 | 64,52\nTotal T2 : 2 logements 93,10 m²'}]}};
  const st=runSearchGrid({name:'S',criteria:[{id:'t2',label:'T2',kind:'stats',unit:'m²',min:28,max:70,keywords:['re:\\b[tf]\\s?2\\b'],exclude:['total']}]},[tds]).criteria.t2;
  assert.deepEqual([st.stats.n,st.stats.min,st.stats.mean,st.stats.max,st.stats.p50],[2,45.3,46.55,47.8,46.55],'stats T2 : A101 et R+1 ignorés, total exclu');
  assert.deepEqual([srchStats([1,2,3,4,5]).p10,srchStats([1,2,3,4,5]).p90],[1.4,4.6],'centiles interpolés (CENTILE.INCLURE)'); }
console.log(`v2.6.1 — ${n} vérifications OK (documents fictifs)`);
