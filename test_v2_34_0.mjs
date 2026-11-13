// v2.34.0 — fiabilité des données : comparaison à Salesforce (vérité des évaluateurs), note mesurée par valeur,
// corrections trouvées par le banc de vérité (données fictives).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sameValue,compareToReference,categoriesOf,reliabilityOf,reliabilityTable,RELIABILITY} from './js/qualite.js';
import {analyzeDocuments,applyComparisonBases} from './js/engine.js';
import {DEFAULT_SOURCE_RULES,DOC_TYPES} from './js/config.js';
import {parseDocument} from './js/parsers.js';

// 1. Comparaison : nombres à l'arrondi près, catégories pour les systèmes et isolants
assert.equal(sameValue('cep',61.3,61.3),true); assert.equal(sameValue('cep',61.34,61.3),true); assert.equal(sameValue('cep',61.7,61.3),false);
assert.equal(sameValue('shab',3118,3117.92),true);
assert.equal(compareToReference('heating_mode_after','PAC','Zépac 70 : 2*PAC HRC70 + secours : chaudière gaz'),'juste');
assert.equal(compareToReference('heating_mode_after','Chauffage électrique direct','Zépac 70 : 2*PAC HRC70 + secours chaudière'),'faux');
assert.equal(compareToReference('ecs','Ballon électrique','Production commune avec le chauffage'),'incomparable');
assert.equal(compareToReference('ecs','Réseau de chaleur','Sous-station + ballons'),'juste');
assert.equal(compareToReference('wall_insulation','Laine minérale','Laine de roche 140 mm'),'juste');
assert.deepEqual([...categoriesOf('heating_mode_after','Hybride (PAC + gaz)')].sort(),['gaz','pac']);

// 2. Note de fiabilité : Salesforce certifiée ; sinon mesurée par méthode ET champ ; non mesurée = à vérifier
const calib={pairs:{'cstb:cep-max|cep_max':{juste:39,faux:0},'cstb:cep|cep':{juste:24,faux:16},'x:y|bbio':{juste:22,faux:3}},methods:{}};
assert.equal(reliabilityOf({method:'manual:free-paste',fileName:'Salesforce — export'},{calib}),'certifiee');
assert.equal(reliabilityOf({method:'cstb:cep-max',field:'cep_max'},{calib}),'sure');
assert.equal(reliabilityOf({method:'cstb:cep',field:'cep'},{calib}),'averifier');
assert.equal(reliabilityOf({method:'x:y',field:'bbio'},{calib}),'probable');
assert.equal(reliabilityOf({method:'xml:re2020:rset-cep',field:'cep'},{calib}),'averifier'); // non mesurée
// valeur contestée par un autre document (deux versions d'étude) → à vérifier
const res={rows:[{building:'A',cep_max:80}],finals:[{field:'cep_max',building:'A',value:80,method:'cstb:cep-max',fileName:'v2.pdf',docType:'RSET RE2020'}],
  detailed:[{field:'cep_max',building:'A',value:84,method:'cstb:cep-max',fileName:'v1.pdf',docType:'RSET RE2020'}]};
assert.equal(reliabilityTable(res,{calib}).A.cep_max,'averifier');
res.detailed[0].value=80; assert.equal(reliabilityTable(res,{calib}).A.cep_max,'sure');
assert.ok(RELIABILITY.sure.label.includes('95 %'));

// 3. Rénovation (règle des évaluateurs) : Cep réf = référence du document, gain sur l'état initial
const fz=(field,value)=>({field,value,building:'B1',docId:'d',fileName:'t.pdf',docType:'RT Existant',page:1,excerpt:'',confidence:.95,method:'test',status:'retenu'});
const r1=applyComparisonBases({rows:[{building:'B1',cep_before:200,cep:80,cep_max:110}],finals:[fz('cep_before',200),fz('cep',80),fz('cep_max',110)],detailed:[]});
assert.deepEqual([r1.rows[0].cep_max,r1.rows[0].cep_gain],[110,60]);

// 4. Lectures corrigées : SHAB prise sur « Nombre de logements 32 », Bbio max pris sur « Besoins annuels en chaud »
const mk=(text,type)=>{ const pages=[{page:1,text,lines:text.split('\n').map((t,i)=>({index:i,text:t}))}]; return {id:'d1',name:'fictif.pdf',type,status:'ready',read:{kind:'pdf',text,pages},buildings:{names:['Bâtiment unique']}}; };
const s1=parseDocument(mk('SRT declaree -1 m²\nAt Bat 788.6 m²\nNombre de logements 32',DOC_TYPES.RSET_RE2020));
assert.ok(!s1.some(o=>o.field==='shab'&&o.value===32),'pas de SHAB = nombre de logements');
const s2=parseDocument(mk('Coefficient BBio 70,400\nBesoins annuels en chaud en kWh / (m² Sref) 28,800',DOC_TYPES.RSET_RE2020));
assert.ok(!s2.some(o=>o.field==='bbio_max'&&o.value===28.8),'pas de Bbio max = besoins en chaud');
const s3=parseDocument(mk('Bâtiment : Bâtiment A\nSRef / usage principal\n1 518,3 m² / Logement collectif',DOC_TYPES.RSET_RE2020));
assert.ok(s3.some(o=>o.field==='shab'&&Math.abs(o.value-1518.3)<.001),'Sref sur la ligne suivante toujours lue');

// 5. Garde-fous anti-plantage, appli et exports
const big=Array.from({length:200000},(_,i)=>i); const out=[]; const {default:_}={default:null};
const parsers=fs.readFileSync('js/parsers.js','utf8'); assert.match(parsers,/function pushAll\(out,\.\.\.arrs\)/);
assert.match(fs.readFileSync('js/u48win-rtex.js','utf8'),/if\(cur&&\(m=x\.t\.match\(\/\^Type\\s\+de\\s\+paroi/);
const app=fs.readFileSync('js/app.js','utf8'), exp=fs.readFileSync('js/exporter.js','utf8');
assert.match(app,/d\.boxKind==='cctp'&&d\.familyMode!=='manual'&&!isBoxCctpType/);
assert.match(app,/reliability:p\.result\?reliabilityTable\(p\.result\):\{\}/);
assert.match(exp,/'Fiabilité par bâtiment'/); assert.match(exp,/'Fiabilité','Source'/);
const cal=fs.readFileSync('data/fiabilite-calibration.json','utf8'); assert.ok(JSON.parse(cal).pairs); assert.ok(!/\b000\d{5}\b/.test(cal),'aucun numéro de contrat dans la calibration');
assert.ok(fs.existsSync('tools/qualite/banc-salesforce.mjs'));
assert.equal(fs.readFileSync('VERSION','utf8').trim(),'2.34.0');
console.log('test_v2_34_0 ok');
