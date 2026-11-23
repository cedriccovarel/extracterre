// v2.36.9 — fiabilité face à Salesforce (valeurs FICTIVES) : fiable = juste, écart mineur, autre version, notion différente,
// saisie Salesforce aberrante ; non fiable = non trouvée, écart majeur, valeur aberrante.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {sfReliability} from './js/qualite.js';
import {oddValue} from './js/sanity.js';
assert.equal(APP_VERSION,'3.4.2');
const R=(f,sv,ev,res,present=false)=>sfReliability(f,sv,ev,res,{goodValuePresent:present,oddValue});
assert.deepEqual(R('bbio',30,30,'juste'),{fiable:true,cat:'juste'});
assert.deepEqual(R('bbio',30,'',"manquant"),{fiable:false,cat:'manquant'});
assert.equal(R('bbio',30,'incomparable','incomparable'),null);
assert.deepEqual(R('bbio',30,32,'faux'),{fiable:true,cat:'mineur'});          // 6,7 %
assert.deepEqual(R('cep','61,1','63.6','faux'),{fiable:true,cat:'mineur'});   // virgule
assert.deepEqual(R('wall_insulation_thickness',140,30,'faux'),{fiable:false,cat:'majeur'});
assert.deepEqual(R('dh_zt',480,620,'faux',true),{fiable:true,cat:'version'}); // valeur Salesforce lue dans un autre document
assert.deepEqual(R('roof_structure','Toiture terrasse au dernier niveau','Béton armé','faux'),{fiable:true,cat:'notion'});
assert.deepEqual(R('roof_structure','Béton armé','Ossature bois','faux'),{fiable:false,cat:'majeur'});
assert.deepEqual(R('dh_zt',1,412,'faux'),{fiable:true,cat:'sfDouteux'});     // DH Salesforce = 1 : saisie aberrante
assert.deepEqual(R('dh_zt',412,0.29,'faux'),{fiable:false,cat:'aberrant'});  // DH lu = 0,29 : aberrant
assert.deepEqual(R('ecs','Réseau de chaleur urbain','Ballon électrique','faux'),{fiable:false,cat:'majeur'});
console.log('test_v2_36_9 OK');
