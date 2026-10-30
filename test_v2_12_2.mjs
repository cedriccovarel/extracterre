// ExtracTerre v2.12.2 — brasseurs d'air lus dans un CCTP (colonne « Brasseur d’air » Oui / Non) ; une attente ou une option n'en est pas un. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES,DEFAULT_SOURCE_RULES} from './js/config.js';
import {analyzeDocuments} from './js/engine.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.14.2','version');
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:d.read.kind}); d.classification={...c,automaticType:c.type}; d.type=DOC_TYPES.CCTP; d.buildings=detectBuildings(d); d.status='ready'; return d; };
const row=txt=>analyzeDocuments([prep(textDoc('c1','CCTP lot 12 Électricité FICTIF.pdf',DOC_TYPES.CCTP,txt))],structuredClone(DEFAULT_SOURCE_RULES),'Op').rows[0]||{};
const r=row('LOT 12 ÉLECTRICITÉ\nArticle 4.2 Brasseurs d’air\nFourniture et pose de 24 brasseurs d’air plafonniers dans les séjours et chambres.');
eq([r.fan_type,r.fan_count,r.fan_presence],['Brasseur d’air plafonnier',24,'Oui'],'CCTP : brasseurs posés');
const r2=row('LOT 12 ÉLECTRICITÉ\nArticle 4.2 Attentes électriques\nAttente en plafond pour brasseur d’air éventuel dans les séjours.');
eq([r2.fan_type,r2.fan_presence],[undefined,undefined],'CCTP : attente seule, rien de déduit');
console.log(`v2.14.2 — ${n} vérifications OK (données fictives)`);
