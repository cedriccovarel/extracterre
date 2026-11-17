// ExtracTerre v2.41.1 — fiche Évaluation Salesforce : « Batiment : » sans nom ne crée plus « Bâtiment IMENT ».
import assert from 'node:assert/strict';
import {parseFreePaste,salesforceEvaluationToPaste} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
const names=t=>parseFreePaste(t).buildings.map(b=>b.name).filter(Boolean);
const sf=body=>parseFreePaste(salesforceEvaluationToPaste(`OPE-001234\nPerformance thermique\n${body}\nParois verticales\nBéton 20 cm`).text).buildings;
const one=sf('Batiment :\nNombre de logements = 71\nBBio = 68,4\nCep = 62,6');
eq(one.some(b=>/IMENT/i.test(b.name)),false,'pas de « Bâtiment IMENT »');
eq(one.find(b=>b.items.some(i=>i.field==='bbio')).name,'','valeurs sur le bâtiment unique');
eq(sf('Bâtiment :\nBbio = 70').some(b=>/IMENT/i.test(b.name)),false,'« Bâtiment : » accentué');
eq(names('Bâtiment A :\nCep = 60\nBât. B\nCep = 61\nBAT AB\nCep = 62\nBatiment 3 :\nCep = 63'),['Bâtiment A','Bâtiment 3'],'en-têtes nommés : même lecture qu’en v2.41.0');
eq(sf('Bât A / 21 logts - SHAB = 1283,6\nBbio = 80\nBât D / Bbio = 72,1').map(b=>b.name).filter(Boolean),['Bâtiment A','Bâtiment D'],'blocs « Bât X / » inchangés');
console.log(`test_v2_41_1 : ${n}/${n} OK`);
