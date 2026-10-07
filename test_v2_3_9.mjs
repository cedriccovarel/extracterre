// ExtracTerre v2.3.9 — documents FICTIFS reproduisant la calculette BBCA (V4.x) exportée en PDF et le classeur Excel
// d'origine (onglets « 1. Info et Seuils BBCA », « 2. Emissions carbone », « Score BBCA »).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {isBbcaCalculette,bbcaBuildingName} from './js/calculette-bbca.js';
import {normalizeText} from './js/utils.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.10','version');
const rows=(arr,y0=800)=>arr.map((t,i)=>[t,y0-i*10]);
const prep=(d,kind='pdf')=>{ const c=classifyDocument(d.name,d.read.text,{kind}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.familyMode='auto'; d.buildings=detectBuildings(d); return d; };
const val=(out,f,b)=>out.find(o=>o.field===f&&(!b||o.building===b))?.value;

const INFO=(projet,sref,lgt)=>['Info et Seuils BBCA','Client Promoteur Fictif','Projet '+projet,'Localisation Ville Fictive','Phase Conception','Type de batiment Residentiel collectif',`Sref projet ${sref} m²`,`Nombre de logement ${lgt}`,'Surface de stationnement 400 m²','Ic Construction BBCA max moyen 580','Mistationnement 30,1','Ic Construction BBCA max = 590','Ic Energie BBCA max moyen 320','Ic Energie BBCA max = 330','mBBCA Eau 50','Ic Batiment BBCA max = 970'];
const LOTS=(l2a,l3)=>['Emissions carbone','1. Construction Raisonnee','Ic Construction','kg eq CO2/m² Sref','1.VRD (Voirie et Reseaux Divers) 10','2.1. Fondations '+l2a,'2.2. Murs et structures enterres 0','2.3 Parcs de stationnement en superstructure 20','3. Superstructure - Maconnerie '+l3,'4. Couverture - Etancheite - Charpente - Zinguerie 11','5. Cloisonnement - Doublage - Plafonds suspendus - Menuiseries interieures 25','6. Facades et menuiseries exterieures 50','7. Revetements des sols, murs et plafonds - Chape - Peintures 40','8. CVC (Chauffage – Ventilation – Refroidissement - Eau chaude sanitaire) 45','9. Plomberie-sanitaire 30','10. Reseaux d\'energie (courant fort) 35','11. Reseaux de communication (courant faible) 3','12. Appareils elevateurs 15','13. Equipements de production locale d\'electricite 0'];
// Σ lots (bâtiment A) = 10 + (12,5+0+20) + 120 + 11 + 25 + 50 + 40 + 45 + 30 + 35 + 3 + 15 + 0 = 416,5
const TOTALS=['Ic Titre V BBCA-Ouvrages particuliers = 0','Ic Composants = 416,5','Ic Chantier = 10,5','Ic Construction = 427','Ic DED = 150,2','Methode simplifiee : kg eq CO2/m² Sref','Surface artificialisee 1 500 m²','Ic Sols = 15,0','2. Exploitation Maitrisee','kg eq CO2/m² Sref','Chauffage 30,1','Refroidissement 1','ECS 32,4','Auxiliaires de distribution 1,2','Auxiliaires de ventilation 1,8','Eclairage 5,5','Deplacements des occupants a l\'interieur du batiment 6,0','Ic Energie = 78','Ic Eau = 48,1','TOTAL','Ic Projet BBCA = 553,1'];
const SCORE=['Resultats BBCA V4.1','Score BBCA V4.1','Projet 427 78 553 800','Seuil BBCA Standard 590 330 970','Points Emissions 20 points','Points Innovation Climat 0 points','Score BBCA = 20 points'];

// --- 1. Calculette exportée en PDF --------------------------------------------------------------------------------------------
const pdf=prep(mkDoc('p','BBCA__Bat_A.pdf',[mkPage(1,rows(['Calculette BBCA V4.1','Cellule a remplir','Dans l\'onglet "2. Emissions carbone", renseigner les resultats de l\'ACV.'])),mkPage(2,rows(INFO('Residence Fictive_Bat A','2 500',40))),mkPage(3,rows([...LOTS('12,5',120),...TOTALS])),mkPage(4,rows(SCORE))]));
ok(isBbcaCalculette(pdf),'calculette BBCA reconnue'); eq(pdf.type,'Étude carbone / ACV','classée étude carbone');
eq(pdf.buildings.names,['Bâtiment A'],'bâtiment tiré de « Projet …_Bat A »');
const po=parseDocument(pdf); const A='Bâtiment A';
eq(val(po,'ic_components',A),416.5); eq(val(po,'ic_site',A),10.5); eq(val(po,'ic_construction',A),427); eq(val(po,'ic_energy',A),78);
eq(val(po,'ic_lot_1',A),10); eq(val(po,'ic_lot_2',A),32.5,'sous-lots 2.1 + 2.2 + 2.3 additionnés'); eq(val(po,'ic_lot_3',A),120); eq(val(po,'ic_lot_12',A),15); eq(val(po,'ic_lot_13',A),0);
ok(po.find(o=>o.field==='ic_lot_6').confidence>=0.95,'Σ lots = Ic composants → confiance élevée');
eq(val(po,'ic_energy_heating',A),30.1); eq(val(po,'ic_energy_ecs',A),32.4); eq(val(po,'ic_energy_aux_vent',A),1.8); eq(val(po,'ic_energy_mobility',A),6);
eq(val(po,'shab',A),2500,'Sref « 2 500 m² »'); eq(val(po,'housing_count',A),40);
ok(!po.some(o=>/_max/.test(o.field)),'seuils BBCA ≠ seuils RE2020 : colonnes Max non remplies');
const men=po.find(o=>o.field==='mention_bbca'); eq(men?.value,'Oui'); ok(/BBCA Performance/.test(men.provenanceNote),'niveau visé d’après le score');
eq(val(po,'operation_name'),'Residence Fictive','suffixe bâtiment retiré du nom d’opération');

// --- 2. Classeur Excel (valeurs formatées par SheetJS : « 2,500 » = 2500, « 12.5 ») -------------------------------------------
const sheet=(page,name,arr)=>{ const lines=arr.map((t,index)=>{ const m=t.match(/^(.*?)\s+(-?[\d.,]+(?:\s*(?:m²|points))?)$/); const cells=m?[m[1],'',m[2]]:[t,'','']; return {index,text:normalizeText(cells.join(' | ')),cells}; }); return {page,sheet:name,text:lines.map(l=>l.text).join('\n'),lines}; };
const toXl=a=>a.map(t=>t.replace(/(\d) (\d{3})\b/g,'$1,$2').replace(/(\d),(\d{1,2})\b/g,'$1.$2'));
const pages=[sheet(1,'Aide',['Calculette BBCA V4.1']),sheet(2,'1. Info et Seuils BBCA',toXl(INFO('Residence Fictive_Bat B','2 500',36))),sheet(3,'2. Emissions carbone',toXl([...LOTS('12,5',120),...TOTALS])),sheet(4,'Score BBCA',toXl(SCORE))];
const xl={id:'x',name:'Calculette_BBCA_Bat_B.xlsx',read:{kind:'spreadsheet',pages,pageCount:pages.length,text:pages.map(p=>`[${p.sheet}]\n${p.text}`).join('\n\f\n')}};
prep(xl,'spreadsheet'); eq(xl.type,'Étude carbone / ACV','classeur classé étude carbone (et non saisie manuelle)'); eq(xl.buildings.names,['Bâtiment B']);
const xo=parseDocument(xl); const B='Bâtiment B';
eq(val(xo,'shab',B),2500,'« 2,500 m² » (séparateur de milliers Excel)'); eq(val(xo,'housing_count',B),36);
eq(val(xo,'ic_lot_2',B),32.5); eq(val(xo,'ic_components',B),416.5); eq(val(xo,'ic_construction',B),427); eq(val(xo,'ic_energy_heating',B),30.1); eq(val(xo,'ic_energy',B),78);

// --- 3. Nom de bâtiment depuis le fichier, consolidation ----------------------------------------------------------------------
eq(bbcaBuildingName({name:'Calculette_BBCA_Bat_C.xlsx',read:{pages:[]}}),'Batiment C');
ok(DEFAULT_SOURCE_RULES.mention_bbca.secondary.includes('Étude carbone / ACV'),'calculette BBCA : source secondaire de la mention BBCA');
const r=analyzeDocuments([pdf,xl],DEFAULT_SOURCE_RULES,'Test');
const kept=(f,b)=>(r.detailed||[]).find(o=>o.field===f&&o.building===b&&o.status==='retenu')?.value;
eq(kept('ic_lot_3',A),120); eq(kept('ic_lot_3',B),120); eq(kept('ic_construction',B),427); eq(kept('shab',A),2500); eq(kept('mention_bbca',A),'Oui');
ok(fs.readFileSync('./build_bundle.py','utf8').includes("'calculette-bbca.js'"),'module inclus dans le bundle');
console.log(`v2.3.9 — ${n} vérifications OK (documents fictifs)`);
