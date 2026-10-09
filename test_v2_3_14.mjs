// ExtracTerre v2.3.14 — document FICTIF reproduisant un récapitulatif carbone RE2020 de bureau d'études
// (« Étude d'impact réglementaire sur le changement climatique ») et la rubrique « IC construction & seuils ».
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {normalizeText} from './js/utils.js';

let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(c,m)=>{ assert.ok(c,m); n++; };
eq(APP_VERSION,'2.3.16','version');
// Rubrique de l'onglet Carbone : IC énergie avec IC construction et les seuils.
const app=fs.readFileSync('./js/app.js','utf8');
ok(/title:'IC construction & seuils',keys:\['ic_construction','ic_construction_max','ic_construction_max_2028','ic_energy','ic_energy_max','ic_energy_max_2028'\]/.test(app),'IC énergie présent dans « IC construction & seuils »');
const P=ls=>ls.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12}));
// Lots fictifs : 20,00 30,00 80,00 6,00 40,00 70,00 60,00 100,00 25,00 45,00 2,00 20,00 30,00 (Σ 528) + chantier 12,00 = 540
const pages=[
  ["Etude d'impact reglementaire sur le","changement climatique",'Bilan carbone','RE2020','Etude realisee pour le batiment B'],
  ['Hypotheses du projet','Caracteristiques du chantier Contributeur Eau','Surface','Surface de Nombre d\'usages Type','Reference theoriques assainissement','640,0 m² 400,0 m² 10 Mois / 20 Occupants 90,0 m² Collectif'],
  ['Conformite RE 2020','Ic.energie 70,10 kgeqCO2/m²Sref Ic.energiemax= 520,00 kgeqCO2/m²Sref Gain = + 86,52%','Ic.construction 540,00 kgeqCO2/m²Sref Ic.constructionmax= 720,00 kgeqCO2/m²Sref Gain = + 25,00%','Ic.construction2028= 600,00 kgeqCO2/m²Sref Gain = + 10,00%',
   '20,00 30,00 80,00 6,0040,00 70,00 60,00 100,00 25,00 45,002,0020,0030,0012,00','0 100 200 300 400 500 600 700 800','Lot 1 Lot 2 Lot 3 Lot 4 Lot 5 Lot 6 Lot 7 Lot 8 Lot 9 Lot 10 Lot 11 Lot 12 Lot 13 Ic Chantier'],
  ['Resultats complementaires','Carbone biogenique stocke','45,00 kgeqCO2','(StockC)','Ic.eau 40,00 kgeqCO2/m²Sref Ic.batiment 650,10 kgeqCO2/m²Sref','Ic.chantier 12,00 kgeqCO2/m²Sref Ic.Parcelle 100,00 kgeqCO2/m²Sref'],
  ['Lot N°6 - Facade et menuiseries ext','Fenetre aluminium triple vitrage avec volet roulant 50 ans 120 kgeq.CO2/Uf','Ossature bois pour murs a ossature bois 50 ans 10 kgeq.CO2/Uf']
].map((ls,k)=>{ const lines=P(ls); return {page:k+1,text:lines.map(l=>l.text).join('\n'),lines}; });
const d={id:'r',name:'Recap Carbone fictif.pdf',familyMode:'auto',read:{kind:'pdf',pages,pageCount:pages.length,text:pages.map(p=>p.text).join('\n\f\n')}};
const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.type=c.type; d.classification={...c,automaticType:c.type}; d.buildings=detectBuildings(d);
eq(d.type,DOC_TYPES.CARBON,'classé étude carbone'); eq(d.buildings.names,['Bâtiment B']);
const o=parseDocument(d); const v=f=>o.find(x=>x.field===f&&x.building==='Bâtiment B')?.value;
eq(v('ic_energy'),70.1); eq(v('ic_energy_max'),520); eq(v('ic_construction'),540); eq(v('ic_construction_max'),720); eq(v('ic_construction_max_2028'),600);
eq(v('ic_site'),12); eq(v('stock_c_per_m2'),45); eq(v('shab'),640);
eq(v('ic_lot_4'),6,'« 6,0040,00 » séparé'); eq(v('ic_lot_5'),40); eq(v('ic_lot_11'),2,'« 45,002,00… » séparé'); eq(v('ic_lot_13'),30); eq(v('ic_components'),528,'Σ lots = Ic construction − Ic chantier');
ok(o.find(x=>x.field==='ic_lot_1').confidence>=0.95,'lots contrôlés');
ok(!o.some(x=>/^(?:structure|window_)/.test(x.field)),'préconisations FDES ignorées (pas d’ossature bois / vitrage / volet)');
console.log(`v2.3.14 — ${n} vérifications OK (document fictif)`);
