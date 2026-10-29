// ExtracTerre v2.10.6 — fiche Évaluation Salesforce : en-têtes « Bât A / 21 logts - SHAB = 1283,6 », paires séparées par « ; »,
// gain entre parenthèses, valeur commune après les blocs. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseFreePaste,freePasteValues,looksLikeSalesforceEvaluation} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.13.1','version');
const page=`Performance thermique
Bât A / 12 logts - SHAB = 800,5
Bbio = 50 ; Bbio max = 70 (Gain 28,6 %)
Cep,nr = 60 ; Cep,nr max = 75 (Gain 20 %)
DH = 500,1

Bât B / 9 logts - SHAB = 1 020
Bbio = 55 ; Bbio max = 71
DH = 510

Q4 = 0,7`;
eq(looksLikeSalesforceEvaluation(page),true,'fiche reconnue');
const r=parseFreePaste(page), v=freePasteValues(r);
eq(v.map(x=>x.building),['','Bâtiment A','Bâtiment B'],'valeur commune puis deux bâtiments');
eq(v[0].values,{q4pa_surf:0.7},'Q4 après les blocs : commun à l’opération');
eq(v[1].values,{housing_count:12,shab:800.5,dh:500.1,bbio:50,bbio_max:70,bbio_gain:28.6,cepnr:60,cepnr_max:75,cepnr_gain:20},'bloc A : en-tête, « ; », gain entre parenthèses');
eq(v[2].values,{housing_count:9,shab:1020,dh:510,bbio:55,bbio_max:71},'bloc B : SHAB avec espace des milliers');
eq(r.unmatched.length,0,'rien d’ignoré');
console.log(`v2.13.1 : ${n}/${n} OK`);
