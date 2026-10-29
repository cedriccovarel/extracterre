// ExtracTerre v2.10.0 — parois verticales ITI / ITE (type d'isolant, épaisseur, R). Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,FIELD_DEFS,FIELD_MAP,matchFieldByHeader,DEFAULT_SOURCE_RULES,DOC_TYPES} from './js/config.js';
import {wallInsulationSide,withWallSides,analyzeDocuments} from './js/engine.js';
import {detectBuildings} from './js/buildings.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION,'2.11.4','version');

// 6 colonnes ajoutées en fin, en-têtes reconnus, mêmes sources que les parois verticales.
const keys=['wall_iti_insulation','wall_iti_thickness','wall_iti_r','wall_ite_insulation','wall_ite_thickness','wall_ite_r'];
eq(FIELD_DEFS.slice(-10,-4).map(f=>f.key),keys,'ajoutées en fin');
eq(keys.map(k=>matchFieldByHeader(FIELD_MAP[k].label)?.key),keys,'en-têtes');
eq(DEFAULT_SOURCE_RULES.wall_ite_r,DEFAULT_SOURCE_RULES.wall_insulation_r,'sources');

// Côté de l'isolation : mention explicite d'abord, indice ensuite, rien si ambigu.
eq(['Façade : ITE laine de roche 160 mm','Isolation thermique par l’extérieur PSE 140 mm','Mur ITI','Isolation par l\'intérieur 100 mm',
  'Doublage collé PSE 100 mm','Bardage bois sur laine de bois 120 mm','Doublage ITE ROCKMUR 160 mm','Façade extérieure : laine de roche 160 mm',
  'ITE 140 mm + ITI 100 mm','Bardage + doublage'].map(wallInsulationSide),
  ['ite','ite','iti','iti','iti','ite','ite',null,null,null],'classement');
const o={field:'wall_insulation_r',value:4.5,excerpt:'Mur : ITE R = 4,50',building:'Bâtiment A'};
eq(withWallSides([o,{...o,field:'roof_insulation_r'}]).map(x=>x.field),['wall_insulation_r','roof_insulation_r','wall_ite_r'],'recopie ITE, colonne générale conservée');

// Bout en bout : un CCTP qui décrit ITE et doublage intérieur sur deux lignes distinctes.
const doc=textDoc('c1','CCTP.pdf',DOC_TYPES.CCTP,'Bâtiment A\nFaçade ITE : laine de roche 160 mm R = 4,50\nMur ITI : laine de verre 100 mm R = 3,15');
const d={...doc,status:'ready',classification:{type:DOC_TYPES.CCTP,automaticType:DOC_TYPES.CCTP}}; d.buildings=detectBuildings(d);
const row=analyzeDocuments([d],structuredClone(DEFAULT_SOURCE_RULES),'Op test').rows[0];
eq([row.wall_ite_insulation,row.wall_ite_thickness,row.wall_ite_r],['Laine de roche',160,4.5],'ITE');
eq([row.wall_iti_insulation,row.wall_iti_thickness,row.wall_iti_r],['Laine de verre',100,3.15],'ITI');
ok(row.wall_insulation!==undefined,'colonne générale toujours remplie');
console.log(`v2.10.0 — ${n} vérifications OK (données fictives)`);
