// v3.4.1 — structure des parois (opération réelle 00005428, lignes reproduites en données FICTIVES) : la brique des murs
// extérieurs est retenue ; voile béton d'un mur intérieur / refend / paroi sur local non chauffé, plancher à poutrelles-hourdis,
// pont thermique (« Dalle terre-plein / Mur Brique »), ossature de faux-plafond et références DTU ne donnent pas de structure.
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';
assert.equal(APP_VERSION,'3.4.5');
const rows=(arr,y0=800)=>arr.map((t,i)=>[t,y0-i*10]);
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.familyMode='auto'; d.buildings=detectBuildings(d); return d; };
const th=prep(mkDoc('th','Etude thermique RE2020 fictive.pdf',[
  mkPage(1,rows(['Etude thermique RE2020 - Residence Fictive','Synthese des parois']),),
  mkPage(2,rows(['Mur Exterieur Brique 200 ITI lambda = 0,032 120+13 R 3,80','Mur Interieur Voile beton 180 ITE lambda = 0,032 80 R 2,55','Parois sur locaux non chauffes Autre Voile Beton,IE PSE 9,3 2,55'])),
  mkPage(3,rows(['Mur exterieur ITI /','Plancher intermediaire Poutrelles hourdis','Planelles isolantes Rp 1,0'])),
  mkPage(4,rows(['Descriptif : Dalle terre plein isole sur dalle / Mur Brique Type A/B II','Psi calcule : 0,09 W/(m.K)'])),
  mkPage(5,rows(['Faux-plafonds suspendus en plaques de platre sur ossature metallique, DTU 25.232','- DTU 23.1 Parois et murs en beton banche']))]));
const out=parseDocument(th), S=f=>out.filter(o=>o.field===f).map(o=>o.value);
assert.ok(S('wall_structure').includes('Brique'),'mur extérieur brique lu');
assert.ok(!S('wall_structure').some(v=>/B[ée]ton|Poutrelles/.test(v)),`pas de voile intérieur ni de plancher en paroi verticale : ${S('wall_structure')}`);
assert.ok(!S('floor_structure').includes('Brique')&&!S('roof_structure').length,`pont thermique / faux-plafond ignorés : ${S('floor_structure')} ${S('roof_structure')}`);
assert.ok(!S('structure').some(v=>/banch|métallique/i.test(v)),`références DTU ignorées : ${S('structure')}`);
const r=analyzeDocuments([th],DEFAULT_SOURCE_RULES,'Fictif');
assert.equal(r.rows[0].wall_structure,'Maçonnerie');
console.log('v3.4.1 — structure des parois verticales / planchers (cas 00005428, données fictives) : OK');
