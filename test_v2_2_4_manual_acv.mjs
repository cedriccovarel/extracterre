import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';

assert.equal(APP_VERSION,'2.3.7');
const page=(n,text)=>({page:n,text,lines:text.split(/\n/).map((text,index)=>({text,index}))});
const pages=[
  page(1,`SYNTHESE D’ÉTUDE ACV RÉALISÉE AVEC CLIMAWIN 2020\n1. Bâtiment A\n1.2. Exigences ACV\nZone n°1 : Zone d'usage logements TRAVERSANTS 633.1 560.0 -0.100 0.075\nZone n°2 : Zone d'usage logements NON TRAVERSANTS 142.3 560.0 -0.100 0.075\nIc,énergie 73.4 533.7 -86 %\n1.3. Résultats ACV\nContributeur composant Ic,composant 579.7\nContributeur chantier Ic,chantier 14.5\nTotal hors parcelle Ic,bâtiment 715.9 Stockage carbone Stock,C (par m²) 50.4 kgC/m²`),
  page(2,`1.4. Synthèse des contributeurs\nSYNTHÈSE DU CONTRIBUTEUR COMPOSANTS\nLot 1 - VRD 27.1 19.0 3.6 2.6 1.8 0.0 Lot 8 - CVC et ECS 112.6 61.6 2.8 51.7 4.9 -8.3 Lot 13 - Photovoltaïque 29.4 18.2 0.4 14.5 0.5 -4.2 TOTAL composants 579.7 266.9\nTotal chantier 14.5 14.5`),
  page(3,`1.5. Détails des énergies\nSynthèse du contributeur énergie\nIc,énergie par m² (kg éq.CO /m²) 73.4\nZONE : Zone d'usage logements TRAVERSANTS - Contributeur énergie (kg éq.CO /m²)\nVecteur énergétique Consommation Cef (kWh/m².an) Donnée GES (kg éq.CO /kWh) Ic,énergie (kg éq.CO /m²)\nÉlec Ch. 6.7 0.079 20.9\nÉlec Fr. 8.5 0.064 21.5\nÉlec ECS 6.5 0.065 16.7\nÉlec Vent. 0.3 0.064 0.8\nÉlec Dépl. 0.4 0.064 1.0\nZONE : Zone d'usage logements NON TRAVERSANTS - Contributeur énergie (kg éq.CO /m²)\nVecteur énergétique Consommation Cef (kWh/m².an) Donnée GES (kg éq.CO /kWh) Ic,énergie (kg éq.CO /m²)\nÉlec Ch. 7.3 0.079 22.8\nÉlec Fr. 8.5 0.064 21.5\nÉlec ECS 19.7 0.065 50.7\nÉlec Vent. 1.2 0.064 3.0\nÉlec Dépl. 1.1 0.064 2.8`)
];
const text=pages.map(p=>p.text).join('\n');
const acv={id:'acv',name:'ACV Climawin.pdf',type:DOC_TYPES.CARBON,specializedFamily:'acv',read:{kind:'pdf',text,pages}};
acv.buildings=detectBuildings(acv);
const out=parseDocument(acv);
const get=(field)=>out.find(o=>o.field===field&&o.building==='Bâtiment A'&&o.method.startsWith('acv:climawin'));
assert.equal(get('stock_c_per_m2')?.value,50.4);
assert.equal(get('ic_components')?.value,579.7);
assert.equal(get('ic_site')?.value,14.5);
assert.equal(get('ic_energy')?.value,73.4);
assert.equal(get('ic_lot_1')?.value,27.1);
assert.equal(get('ic_lot_8')?.value,112.6);
assert.equal(get('ic_lot_13')?.value,29.4);
assert.equal(get('ic_energy_cooling')?.value,21.5);
assert.ok(Math.abs(get('ic_energy_heating')?.value-21.25)<0.01);
assert.ok(Math.abs(get('ic_energy_ecs')?.value-22.94)<0.01);
assert.ok(Math.abs(get('ic_energy_aux_vent')?.value-1.2)<0.01);
assert.ok(Math.abs(get('ic_energy_mobility')?.value-1.33)<0.01);

const manual={...acv,id:'manual',specializedFamily:'manual'};
manual.buildings=detectBuildings(manual);
const manualOut=parseDocument(manual);
assert.ok(manualOut.some(o=>o.field==='stock_c_per_m2'&&o.value===50.4));
assert.ok(manualOut.every(o=>o.specializedParser!==true),'Le mode manuel ne doit pas passer par la whitelist spécialisée');
console.log('v2.2.4 analyse manuelle + ACV ClimaWin: OK');
