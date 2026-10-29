// ExtracTerre v2.10.5 — fiche Évaluation Salesforce : en-têtes de bâtiment sans séparateur (« Logement 1 à 6 »)
// et plusieurs paires sur une ligne (« Bbio=33 Bbiomax=81,3 »). Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseFreePaste,freePasteValues,looksLikeSalesforceEvaluation} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.11.4','version');
const page=`Performance thermique
Logement 1 à 6
Bbio=30 Bbiomax=80
Cep=50,5 Cepmax=90
Cep,nr=60 Cep,nrmax=61,2
DH=400,1
Icénergie= Icénergie2025=

Logement 7 & 8
Bbio=40 Bbiomax=85
DH=420`;
eq(looksLikeSalesforceEvaluation(page),true,'fiche reconnue sans OPE ni enveloppe');
const r=parseFreePaste(page), v=freePasteValues(r);
eq(v.map(x=>x.building),['Logement 1 à 6','Logement 7 & 8'],'deux bâtiments');
eq(v[0].values,{housing_count:6,dh:400.1,bbio:30,bbio_max:80,cep:50.5,cep_max:90,cepnr:60,cepnr_max:61.2},'bloc 1 : paires sur une ligne, IC vides ignorés');
eq(v[1].values,{housing_count:2,dh:420,bbio:40,bbio_max:85},'bloc 2 : « 7 & 8 » = 2 logements');
eq(r.unmatched.length,0,'rien d’ignoré');
console.log(`v2.11.4 : ${n}/${n} OK`);
