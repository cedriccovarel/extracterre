// ExtracTerre v2.13.1 — fiche Évaluation Salesforce : blocs « Commentaires pré-analyse » (rénovation). Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {salesforceEvaluationToPaste,parseFreePaste,freePasteValues} from './js/collage-libre.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.14.1','version');
const page=`Évaluation
EVA-009991
Commentaires pré-analyse
Zone H2 - BR1

BAT Z
Cep initial = 140.5
Cep projet = 70.2
Cep référence = 95.1
Tic = 26.1 < Tic réf = 29.9
Ubat = 0.81< Ubat base = 1.3
Q4 = 1.2
Sw = 0.4 (ouvert) / Sw = 0.01 (fermé)

BAT Y
Cep initial = 150
Cep projet = 80
Évaluation avec pré-analyse
Performance thermique
BAT Y / 10 logts - SHAB = 600
Cep = 79
Performance thermique - Notes
Planchers hauts
OPE-009991
Les Fictifs
13000 FICTIVILLE
Statut du contrat 00009991 : En cours`;
const v=Object.fromEntries(freePasteValues(parseFreePaste(salesforceEvaluationToPaste(page).text)).map(x=>[x.building,x.values]));
eq(v['Bâtiment Z'],{tic:26.1,tic_ref:29.9,cep:70.2,cep_max:95.1,ubat_after:0.81,cep_before:140.5,cep_after_final:70.2,ubat_ref:1.3,q4pa_surf:1.2},'pré-analyse : bloc BAT Z');
eq([v['Bâtiment Y'].cep,v['Bâtiment Y'].cep_before,v['Bâtiment Y'].housing_count,v['Bâtiment Y'].shab],[79,150,10,600],'Performance thermique prioritaire, pré-analyse en complément, un seul bâtiment Y');
console.log(`v2.14.1 — ${n} vérifications OK (données fictives)`);
