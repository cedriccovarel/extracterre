// v2.36.6 — climatisation (phrases FICTIVES) : le mot « climatisation » seul ne fait pas une clim installée ; faux systèmes de froid écartés.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {coolingContextKept} from './js/parsers.js';
assert.equal(APP_VERSION,'3.0.6');
const K=(v,t)=>coolingContextKept(v,t);
// Mentions sans clim installée
for(const t of ["LOT N°09 – CHAUFFAGE – CLIMATISATION","Respect des arrêtés chauffage ou de climatisation","Chauffage ou climatisation Pièce principale 40,0",
  "Les équipements de climatisation et ventilation devront être certifiés EUROVENT.","Climatisation local VDI Suivant la sélection","- Climatiseur",
  "Fourniture, pose et mise en service d'une installation de climatisation à détente directe dédiée"]) assert.equal(K('Climatisation active',t),false,t);
// Clim décrite installée
for(const t of ["Ce système assurera le chauffage et la climatisation du logement.","La climatisation se fera par un système à débit de réfrigérant variable",
  "équipements de Climatisation Réversible du projet","Climatisation Oui"]) assert.equal(K('Climatisation active',t),true,t);
// Faux systèmes de froid
assert.equal(K('Split / multisplit','Génération : "Calypso SPLIT T2 A traversant"'),false);
assert.equal(K('Split / multisplit','Génération : "ECS sur SPLIT"'),false);
assert.equal(K('Groupe froid','QUALIBAT 5231 "Installation de pompe à chaleur et groupe froid en habitat individuel'),false);
assert.equal(K('DRV/VRV','fourreaux pour climatisation futur (VRV) du logement'),false);
assert.equal(K('Rafraîchissement adiabatique','136 Rafraîchissement adiabatique en été Absent'),false);
assert.equal(K('Split / multisplit','pompes à chaleur air/air individuelles, de type mono-split'),true);
// Lectures déjà stockées : filtrées à l'analyse
{ const {analyzeDocuments}=await import('./js/engine.js'); const {DEFAULT_SOURCE_RULES,DOC_TYPES}=await import('./js/config.js');
  const o=(v,x)=>({field:'cooling',value:v,building:'Bâtiment A',docId:'c1',fileName:'CCTP fictif.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:x,confidence:.93,method:'systems:cooling-context'});
  const d={id:'c1',name:'CCTP fictif.pdf',type:DOC_TYPES.CCTP,status:'ready',buildings:{names:['Bâtiment A']},cachedOccurrences:[o('Climatisation active','LOT N°09 – CHAUFFAGE – CLIMATISATION'),o('Split / multisplit','Calypso SPLIT 200L')]};
  const res=analyzeDocuments([d],DEFAULT_SOURCE_RULES,''); assert.ok(!res.rows.some(r=>r.cooling),JSON.stringify(res.rows.map(r=>r.cooling))); }
console.log('test_v2_36_6 OK');
