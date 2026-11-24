// v3.4.0 — Enveloppe : structure / planchers hauts / planchers bas / parois verticales dans la liste Prestaterre
// (Béton armé, Maçonnerie, Acier, Bois, Mixte). Données fictives.
import assert from 'assert';
import {structuralClass,STRUCTURE_CLASSES,APP_VERSION} from './js/config.js';
import {routeAndDeduplicate} from './js/engine.js';
import {sameValue} from './js/qualite.js';
assert.strictEqual(APP_VERSION,'3.5.0');
const cases={'Béton banché':'Béton armé','Béton armé':'Béton armé','Dalle béton':'Béton armé','Prédalle':'Béton armé','Poutrelles-hourdis':'Béton armé','Éléments préfabriqués':'Béton armé',
  'Brique terre cuite':'Maçonnerie','Bloc béton / parpaing':'Maçonnerie','Béton cellulaire':'Maçonnerie','Pierre de taille':'Maçonnerie','Meulière':'Maçonnerie',
  'Structure métallique':'Acier','Ossature bois':'Bois','CLT':'Bois','Plancher bois':'Bois','Pans de bois':'Bois',
  'Bac acier collaborant':'Mixte','Plancher mixte bois-béton':'Mixte','Façade légère':null,'Toiture terrasse':null};
for(const [v,c] of Object.entries(cases)) assert.strictEqual(structuralClass(v),c,v);
const occ=(field,value,extra={})=>({field,value,building:'Bâtiment A',docId:'d1',fileName:'CCTP fictif.pdf',docType:'CCTP',page:1,excerpt:value,confidence:.93,method:'test',...extra});
const out=routeAndDeduplicate([occ('wall_structure','Brique terre cuite'),occ('floor_structure','Poutrelles-hourdis'),occ('roof_structure','Toiture terrasse'),occ('structure','Ossature bois'),occ('wall_insulation','Laine de verre')],{});
const by=f=>out.find(o=>o.field===f);
assert.strictEqual(by('wall_structure').value,'Maçonnerie'); assert.match(by('wall_structure').provenanceNote,/Détail lu : Brique terre cuite/);
assert.strictEqual(by('floor_structure').value,'Béton armé'); assert.strictEqual(by('structure').value,'Bois');
assert.ok(!by('roof_structure'),'valeur hors liste non retenue'); assert.strictEqual(by('wall_insulation').value,'Laine de verre','isolant inchangé');
for(const o of out) if(['structure','roof_structure','floor_structure','wall_structure'].includes(o.field)) assert.ok(STRUCTURE_CLASSES.includes(o.value),o.value);
// Banc Salesforce : « Brique terre cuite » (Salesforce) = « Maçonnerie » (documents) ; « Béton armé » ≠ « Maçonnerie ».
assert.ok(sameValue('wall_structure','Maçonnerie','Brique terre cuite')); assert.ok(!sameValue('wall_structure','Béton armé','Brique terre cuite'));
assert.ok(sameValue('floor_structure','Béton armé','Poutrelles-hourdis'));
console.log('v3.4.0 — structure / planchers / parois verticales dans la liste Prestaterre : OK (données fictives)');
