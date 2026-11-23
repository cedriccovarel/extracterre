// v3.4.2 — notes acoustiques, références normatives et priorité maçonnerie / béton pour les parois verticales. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {routeAndDeduplicate} from './js/engine.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';
assert.equal(APP_VERSION,'3.4.5');
const rows=(arr,y0=800)=>arr.map((t,i)=>[t,y0-i*10]);
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:'pdf'}); d.classification={...c,automaticType:c.type}; d.type=c.type; d.familyMode='auto'; d.buildings=detectBuildings(d); return d; };
// Note acoustique : aucune structure.
const ac=prep(mkDoc('ac','Note acoustique PRO fictive.pdf',[mkPage(1,rows(['Elements de facade','Paroi en beton arme de 16 cm d epaisseur - Rw+Ctr >= 40 dB','Essai sur mur lourd : paroi verticale en beton arme de 16 cm']))]));
assert.ok(!parseDocument(ac).some(o=>/structure/.test(o.field)),'note acoustique sans structure');
// Références normatives d'un CCTP charpente : aucune structure.
const ch=prep(mkDoc('ch','CCTP Lot 03 Charpente fictif.pdf',[mkPage(1,rows(['CCTP LOT 03 CHARPENTE','Cahier du CSTB 3450 : exigences aux facades legeres a ossature bois','ETAG 007 : kits de construction a ossature bois, Avis techniques, isolation des murs']))]));
assert.ok(!parseDocument(ch).some(o=>o.field==='wall_structure'),'références normatives ignorées');
// Maçonnerie et béton lus pour les murs du même bâtiment : la maçonnerie passe devant.
const o=(v,c)=>({field:'wall_structure',value:v,building:'Bâtiment A',docId:'d'+v,fileName:'f.pdf',docType:'Étude thermique',page:1,excerpt:v,confidence:c,method:'test'});
const out=routeAndDeduplicate([o('Brique',.91),o('Voile béton',.91)],DEFAULT_SOURCE_RULES);
const m=out.find(x=>x.value==='Maçonnerie'), b=out.find(x=>x.value==='Béton armé');
assert.ok(m&&b&&m.confidence>b.confidence,'maçonnerie prioritaire');
console.log('v3.4.2 — notes acoustiques, références normatives, maçonnerie avant béton : OK (données fictives)');
