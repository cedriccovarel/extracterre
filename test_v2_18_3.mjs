// ExtracTerre v2.18.2 — l'exposant d'unité écrit en chiffre (« m2 », « CO2 ») devant une valeur n'est plus collé au nombre :
// « kgCO2/m2 903 » donnait 2 903 (ou 2). Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseFrNumber,stripUnitExponents} from './js/utils.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.34.0','version');
eq(parseFrNumber('m2 903'),903,'m2 903');
eq(parseFrNumber('/m2 903,5'),903.5,'/m2 903,5');
eq(parseFrNumber('kgCO2/m2 903'),903,'kgCO2/m2 903');
eq(parseFrNumber('kg eq CO2/m² 956,91'),956.91,'kg eq CO2/m² 956,91');
eq(parseFrNumber('kgCO2e/m2 1 250,4'),1250.4,'milliers après l\'unité');
eq(parseFrNumber('m3 1 092,1'),1092.1,'m3');
eq(parseFrNumber('CO2 : 85'),85,'CO2 : 85');
// Inchangés : valeur avant l'unité, milliers, m23, nombre seul.
eq(parseFrNumber('903 kgCO2/m2'),903,'valeur avant unité');
eq(parseFrNumber('1 379,6'),1379.6,'milliers');
eq(parseFrNumber('120 m2'),120,'surface');
eq(stripUnitExponents('m23'),'m23','m23 non touché');
eq(parseFrNumber('57,3 kWh/m2'),57.3,'kWh/m2 après');
console.log(`test_v2_18_3 : ${n}/${n} OK`);
