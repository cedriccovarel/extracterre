// ExtracTerre v2.3.8 — notice ACV E+C- (annexe RSEnv Pléiades) : document FICTIF reproduisant la structure.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument} from './js/parsers.js';
import {isEcAcvNotice} from './js/acv-ec.js';
import {mkPage,mkDoc} from './test_fixtures_v2_3_3.mjs';

assert.equal(APP_VERSION,'2.3.11');
const rows=(arr,y0=800)=>arr.map((t,i)=>[t,y0-i*10]);
const pages=[
  mkPage(1,rows(['SOMMAIRE','3. Donnees generales Ecole ........ 12','4. Niveaux ENERGIE-CARBONE ........ 12'])),
  mkPage(2,rows(['Donnees techniques','Type de structure principale Ossature bois','SDP 500 m²','SRT 500 m²'])),
  mkPage(3,rows(['Le projet respect ces seuils avec au global :','- EgesPCE = 700 kg eq. CO2 / m² Sref','- Eges = 1000 kg eq. CO2 / m² Sref'])),
  mkPage(4,rows(['1. Experimentation des batiments a energie positive et reduction carbone','Recapitulatif Energie Environnement / Partie Environnement','Departement 38 - Isere (H1 c)'])),
  mkPage(5,rows(['3. Donnees generales Ecole','Donnees techniques','Type de structure principale Poteaux/poutres','Materiau principal Bois massif',
    'Materiaux de remplissage de','paille','facade','Type de plancher Dalle pleine','Type de ventilation principale VMC double flux modulee (tertiaire)',
    'Energie principale pour le','Electricite','chauffage',"Energie principale pour l'ECS Electricite",'Generateur principal pour le','PAC eau de nappe / eau','chauffage',
    "Generateur principal pour l'ECS Chauffe-eau electrique",'4. Niveaux ENERGIE-CARBONE','ENERGIE kWhEP/(m2SRT.an)','BEPOS niv 3,4 60.0','Niveau BEPOS Niveau 2'])),
  mkPage(6,rows(['CARBONE kgeq.CO2/m2SDP','Eges 1001.23456','Eges max1 2000.0','Eges PCE 701.98765','Eges PCE,max1 1000.0','Niveau E ges Niveau 1'])),
  mkPage(7,rows(['Kit panneaux','10 Wc photovoltaiques avec systeme de PEP 12345 INIES','A.2. Contributeur Consommations d\'energie','Ecole - SRT : 520.00 m2']))
];
const doc=mkDoc('ec','Notice ACV fictive.pdf',pages);
assert.ok(isEcAcvNotice(doc),'notice E+C- reconnue');
const cls=classifyDocument(doc.name,doc.read.text,{kind:'pdf'});
doc.classification={...cls,automaticType:cls.type}; doc.type=cls.type; doc.familyMode='auto';
assert.ok([DOC_TYPES.RSENV,DOC_TYPES.CARBON].includes(doc.type),`type carbone attendu (${doc.type})`);
doc.buildings=detectBuildings(doc);
const out=parseDocument(doc); const v=f=>out.find(o=>o.field===f)?.value;
assert.equal(v('ic_components'),701.99,'Eges PCE de l’annexe (précis) et non la valeur arrondie de la notice');
assert.equal(v('energy_level'),'E2');
assert.equal(v('performance'),'E2C1');
assert.equal(v('shab'),520);
assert.ok(out.find(o=>o.field==='shab').confidence<0.9,'surface divergente avec la notice → à vérifier');
assert.equal(v('structure'),'Bois massif (poteaux/poutres)','tableau RSEnv, pas le résumé de la notice');
assert.equal(v('wall_insulation'),'Paille');
assert.equal(v('ventilation'),'VMC double flux');
assert.equal(v('heating_vector_after'),'Électricité');
assert.equal(v('heating_mode_after'),'PAC eau/eau (eau de nappe)');
assert.equal(v('ecs_vector_after'),'Électricité');
assert.equal(v('ecs'),'Ballon électrique');
assert.equal(v('enr_type'),'Photovoltaïque');
assert.equal(v('department'),'38');
assert.ok(!out.some(o=>/^ic_lot_/.test(o.field)),'aucune valeur de lot inventée (graphiques)');
assert.equal(out.filter(o=>o.field==='ic_components').length,1);

// Analyse manuelle (moteur libre) : le parseur dédié reste prioritaire, le moteur générique complète.
const manual={...doc,id:'ec-m',familyMode:'manual',families:['annex']};
const mOut=parseDocument(manual);
assert.equal(mOut.find(o=>o.field==='ic_components')?.value,701.99);
assert.equal(mOut.filter(o=>o.field==='structure').every(o=>o.method.startsWith('acv-ec:')),true);
console.log('v2.3.8 notice ACV E+C- : OK (document fictif)');
