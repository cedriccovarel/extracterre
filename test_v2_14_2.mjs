// ExtracTerre v2.14.2 — favori Salesforce : en-têtes « Bâtiment n° 1 : A1-A2 », Ubât et Tic « valeur / référence ». Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {salesforceEvaluationToPaste,parseFreePaste,freePasteValues} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.14.2','version');
const fiche='OPE-999001\nRésidence Fictive\n99100 VILLE FICTIVE\nPerformance thermique\nRapport du 01/01/2025 :\n\nBâtiment n° 1 : A1-A2\nSurface habitable : 1000,00 m² / Surface SHON : 1200,00 m²\nUbât = 0,500 / 0,800\nCep = 90,5 / 150,0\nTic = 25 / 30,5\n\nBâtiment n° 2 : B - C\nSurface habitable : 2000,00 m²\nCep = 95 / 140\n\nBâtiment 3 : R+4\nCep = 80 / 120\nParois verticales\n• Façades ITE :\nlaine de roche 160mm R≥4,40';
const v=freePasteValues(parseFreePaste(salesforceEvaluationToPaste(fiche).text));
const b=name=>v.find(x=>x.building===name)?.values;
eq(b('Bâtiment A1 - A2'),{shab:1000,tic:25,tic_ref:30.5,cep:90.5,cep_max:150,ubat_after:0.5,ubat_ref:0.8},'bâtiment n° 1 nommé par ses cages');
eq(b('Bâtiment B - C'),{shab:2000,cep:95,cep_max:140},'bâtiment n° 2');
eq(v.some(x=>/R\+4/.test(x.building)),false,'« R+4 » n’est pas un nom de bâtiment');
console.log(`v2.14.2 — ${n} vérifications OK (données fictives)`);
