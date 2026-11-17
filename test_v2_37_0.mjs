// v2.37.0 — niveaux de fiabilité (valeurs FICTIVES) : méthode non mesurée + confiance ≥ 85 % → probable ; méthode mesurée :
// le taux mesuré décide (une confiance de 99 % ne remonte pas une méthode mesurée à 68 %) ; Cep par poste cohérents → probable.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {reliabilityOf,reliabilityTable} from './js/qualite.js';
assert.equal(APP_VERSION,'2.44.1');
const calib={methods:{'mesuree-basse':{juste:68,faux:32},'mesuree-haute':{juste:99,faux:1}},pairs:{}};
assert.equal(reliabilityOf({method:'inconnue',confidence:0.99},{calib}),'probable');
assert.equal(reliabilityOf({method:'inconnue',confidence:0.86},{calib}),'probable');
assert.equal(reliabilityOf({method:'inconnue',confidence:0.80},{calib}),'averifier');
assert.equal(reliabilityOf({method:'mesuree-basse',confidence:0.99},{calib}),'averifier');
assert.equal(reliabilityOf({method:'mesuree-haute',confidence:0.5},{calib}),'sure');
// Cohérence Cep par énergie (lectures de faible confiance, non mesurées) : somme = Cep → probable, même fichier.
const f=(field,value,conf=0.6,file='RSET.pdf')=>({field,value,building:'Bât A',method:'test:cep',confidence:conf,fileName:file,docType:'RSET RE2020'});
const finals=[f('cep',80),f('cep_electricity',50),f('cep_gas',30.5),f('cep_lighting',4),f('cep_cooling',3,0.6,'Autre.pdf')];
const res={rows:[{building:'Bât A',cep:80,cep_electricity:50,cep_gas:30.5,cep_lighting:4,cep_cooling:3}],finals,detailed:finals};
const t=reliabilityTable(res,{calib})['Bât A'];
assert.equal(t.cep_electricity,'probable'); assert.equal(t.cep_gas,'probable'); assert.equal(t.cep_lighting,'probable');
assert.equal(t.cep_cooling,'averifier','poste lu dans un autre fichier : pas de cohérence');
const bad=reliabilityTable({...res,rows:[{...res.rows[0],cep_gas:10}]},{calib})['Bât A'];
assert.equal(bad.cep_electricity,'averifier','somme ≠ Cep : pas de cohérence');
console.log('test_v2_37_0 OK');
