// v2.37.1 — valeurs contestées (FICTIVES) : « probable » si le banc mesure la version retenue fiable ≥ 85 % pour cette donnée.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {reliabilityTable,contestedAccuracy} from './js/qualite.js';
assert.equal(APP_VERSION,'3.4.2');
const calib={methods:{'m':{juste:99,faux:1}},pairs:{},contested:{'*':{juste:92,faux:8},cep:{juste:93,faux:7},dh:{juste:47,faux:11},ic_construction_max:{juste:7,faux:3},tic_ref:{juste:11,faux:0}}};
assert.equal(contestedAccuracy(calib,'cep').rate,0.93);
assert.equal(contestedAccuracy(calib,'dh').rate<0.85,true);
assert.equal(contestedAccuracy(calib,'ic_construction_max'),null,'peu d’exemples et mauvais score : pas de moyenne générale');
assert.equal(contestedAccuracy(calib,'tic_ref').rate,0.92,'peu d’exemples mais bons : moyenne générale');
const occ=(field,value,file)=>({field,value,building:'Bât A',method:'m',confidence:0.99,fileName:file,docType:'RSET RE2020'});
const finals=[occ('cep',80,'RSET v2.pdf'),occ('dh',600,'RSET v2.pdf')];
const detailed=[...finals,occ('cep',85,'RSET v1.pdf'),occ('dh',700,'RSET v1.pdf')];
const t=reliabilityTable({rows:[{building:'Bât A',cep:80,dh:600}],finals,detailed},{calib})['Bât A'];
assert.equal(t.cep,'probable'); assert.equal(t.dh,'averifier');
console.log('test_v2_37_1 OK');
