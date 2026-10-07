// ExtracTerre v2.3.10 — documents FICTIFS : calculette BBCA Rénovation (feuille « Résultats BBCA réno », colonne
// « Impact carbone du lot rénové ») et données projet des calculettes BBCA (source secondaire ciblée).
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments,routeAndDeduplicate} from './js/engine.js';
import {isBbcaRenovationCalculette,isBbcaCalculette,workTypeFromLabel} from './js/calculette-bbca.js';
import {normalizeText} from './js/utils.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.11','version');
const prep=(d,kind)=>{ const c=classifyDocument(d.name,d.read.text,{kind}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.familyMode='auto'; d.buildings=detectBuildings(d); return d; };
const val=(out,f)=>out.find(o=>o.field===f)?.value;

// --- 1. Classeur BBCA Rénovation (cellules positionnées comme dans la calculette) ------------------------------------------------
const R=[
  ['','Label BBCA Rénovation :','BBCA Performant'],['','Informations relatives au projet: Construction raisonnée','↓ A renseigner ↓'],
  ['','Nom du projet',' Résidence Fictive'],['','Typologie de rénovation','Rénovation lourde'],['','Typologie du bâtiment ','Logements collectifs'],['','Surface de plancher (m² SDP)','2,100'],
  ['','Périmètre de la rénovation','↓ A renseigner (lots rénovés)↓','↓ Impact carbone du lot rénové↓','Impact du lot comptabilisé ?','','','Bureaux','Logements'],
  ['','Lot 1. VRD','Oui','2','Oui','','Lot 01','0','0'],['','Lot 2. Fondations et infrastructure','Oui','10','Oui','','Lot 02','0','0'],['','Lot 3. Superstructure - Maçonnerie','Oui','40','Oui','','Lot 03','244','279'],
  ['','Lot 4. Couverture','Oui','20','Oui'],['','Lot 5. Cloisonnement','Oui','70','Oui'],['','Lot 6. Façades et menuiseries extérieures','Oui','90','Oui'],['','Lot 7. Revêtements','Oui','50','Oui'],
  ['','Lot 8. CVC','Oui','50','Oui'],['','Lot 9. Installations sanitaires','Oui','30','Oui'],['','Lot 10. Réseau d\'énergie (courant fort)','Oui','40','Oui'],['','Lot 11. Réseau de communication','Oui','5','Oui'],['','Lot 12. Appareils élevateurs','Non','3','Non'],
  ['','','','','','','Eges PCE max','783','622'],
  ['','Indicateurs BBCA réno','↓ A renseigner↓'],['','Eges PCE (kg CO2 eq/m²SDP)','407'],['','Eges PCENA (kg CO2 eq/m²SDP)','50'],['','Eges énergie (kg CO2 eq/m²SDP)','900'],['','Eges chantier (kg CO2 eq/m²SDP)','8'],['','Eges eau (kg CO2 eq/m²SDP)','30'],
  ['','Calcul des seuils BBCA réno'],['','Eges PCE max  (kg CO2 eq/m²SDP)','480'],['','Calcul des points BBCA réno'],['','TOTAL','41']];
const lines=R.map((cells,index)=>({index,text:normalizeText(cells.join(' | ')),cells}));
const pages=[{page:1,sheet:'Résultats BBCA réno',text:lines.map(l=>l.text).join('\n'),lines}];
const xl=prep({id:'r',name:'Calculette BBCA Rénovation.xlsx',read:{kind:'spreadsheet',pages,pageCount:1,text:`[Résultats BBCA réno]\n${pages[0].text}`}},'spreadsheet');
ok(isBbcaRenovationCalculette(xl)&&!isBbcaCalculette(xl),'calculette rénovation reconnue (et non la calculette neuve)');
eq(xl.type,'Étude carbone / ACV'); eq(xl.buildings.names,['Bâtiment unique']);
const o=parseDocument(xl);
eq(val(o,'ic_lot_1'),2); eq(val(o,'ic_lot_3'),40,'colonne « Impact carbone du lot rénové », pas les ratios'); eq(val(o,'ic_lot_12'),3); ok(!o.some(x=>x.field==='ic_lot_13'),'pas de lot 13');
ok(/non comptabilis/.test(o.find(x=>x.field==='ic_lot_12').provenanceNote),'lot non comptabilisé signalé');
ok(/Σ lots 407 ≈ Eges PCE 407/.test(o.find(x=>x.field==='ic_lot_1').provenanceNote),'Σ lots comptabilisés = Eges PCE');
eq(val(o,'eges_pce'),407); eq(val(o,'eges_site'),8); eq(val(o,'eges_energy'),900,'v2.3.11 : Eges rangés dans les colonnes Eges');
ok(!o.some(x=>/^ic_.*_max/.test(x.field)),'seuils BBCA réno ≠ seuils RE2020 (colonnes IC Max vides)'); eq(val(o,'eges_pce_max'),480,'v2.3.11 : seuil rangé dans Eges PCE Max (pas le tableau « Eges PCE max » des ratios)');
eq(val(o,'operation_name'),'Résidence Fictive'); eq(val(o,'renovation'),'Rénovation lourde'); eq(val(o,'work_type'),'Logement collectif'); eq(val(o,'shab'),2100,'SDP « 2,100 »');
ok(/BBCA Performant \(41 points\)/.test(o.find(x=>x.field==='mention_bbca').provenanceNote),'niveau du label');
const r=analyzeDocuments([xl],DEFAULT_SOURCE_RULES,'Test');
const kept=f=>(r.detailed||[]).find(x=>x.field===f&&x.status==='retenu')?.value;
for(const [f,v] of [['operation_name','Résidence Fictive'],['work_type','Logement collectif'],['renovation','Rénovation lourde'],['shab',2100],['ic_lot_6',90],['eges_pce',407]]) eq(kept(f),v,`${f} retenu`);

// --- 2. secondarySourceOk : ciblé, jamais au-delà d'une interdiction -----------------------------------------------------------
const base={field:'operation_name',value:'X',building:'Bâtiment unique',docId:'d',docType:'Étude carbone / ACV',page:1,excerpt:'x',confidence:0.95};
eq(routeAndDeduplicate([base],DEFAULT_SOURCE_RULES)[0].sourceTier,'unrouted','sans marqueur : étude carbone non autorisée pour le nom d’opération');
eq(routeAndDeduplicate([{...base,secondarySourceOk:true}],DEFAULT_SOURCE_RULES)[0].sourceTier,'secondary','marqueur du parseur dédié → source secondaire');
const forb={...DEFAULT_SOURCE_RULES,operation_name:{main:[],secondary:[],forbidden:['Étude carbone / ACV']}};
eq(routeAndDeduplicate([{...base,secondarySourceOk:true}],forb)[0].sourceTier,'forbidden','une interdiction reste prioritaire');

// --- 3. Calculette neuve : type de bâtiment ------------------------------------------------------------------------------------
eq(workTypeFromLabel('Residentiel collectif'),'Logement collectif'); eq(workTypeFromLabel('Bureaux'),'Bureaux');
console.log(`v2.3.10 — ${n} vérifications OK (documents fictifs)`);
