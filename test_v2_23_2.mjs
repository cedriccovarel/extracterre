// ExtracTerre v2.23.2 — Brasseur d'air : un titre de rubrique (RSET), une ligne de sommaire, une PSE ou une suppression ne sont pas
// une présence ; « Nombre total de brasseurs d'air de la zone : N » (RSET) est lu. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES,DEFAULT_SOURCE_RULES} from './js/config.js';
import {analyzeDocuments,catchUpDocument} from './js/engine.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.33.2','version');
const prep=(d,type)=>{ const c=classifyDocument(d.name,d.read.text,{kind:d.read.kind}); d.classification={...c,automaticType:c.type}; d.type=type; d.buildings=detectBuildings(d); d.status='ready'; return d; };
const row=(txt,type=DOC_TYPES.RSET_RE2020,name='RSET FICTIF.pdf')=>{ const r=analyzeDocuments([prep(textDoc('d1',name,type,txt),type)],structuredClone(DEFAULT_SOURCE_RULES),'Op').rows[0]||{}; return [r.fan_presence,r.fan_count,r.fan_type]; };
const none=[undefined,undefined,undefined];
// RSET : rubrique vide suivie de l'éclairage (cas réel majoritaire).
eq(row('Données sur la ventilation\nBrasseurs d\'air\nhaut de page\nDonnées sur l\'éclairage\nBâtiment : Bâtiment A'),none,'RSET : titre de rubrique seul');
eq(row('5. BRASSEUR D\'AIR\nDonnées sur l\'éclairage'),none,'RSET : titre numéroté');
eq(row('Brasseurs d\'air\nNombre total de brasseurs d\'air de la zone :4'),['Oui',4,'Brasseur d’air plafonnier'],'RSET : nombre de la zone lu');
eq(row('Brasseurs d\'air\nNombre total de brasseurs d\'air de la zone : 0'),['Non',0,undefined],'RSET : zéro brasseur → Non');
eq(row('Zone 1\nBrasseurs d\'air\nNombre total de brasseurs d\'air de la zone : 0\nZone 2\nBrasseurs d\'air\nNombre total de brasseurs d\'air de la zone : 6').slice(0,2),['Oui',6],'RSET : une zone à 0, une à 6 → 6');
// Sommaires, PSE, suppression.
eq(row('SOMMAIRE\n5.5. BRASSEUR D\'AIR.............................................. 29',DOC_TYPES.CCTP,'CCTP FICTIF.pdf'),none,'sommaire avec points de conduite');
eq(row('11.9.17 Brasseurs d\'air 321',DOC_TYPES.CCTP,'CCTP FICTIF.pdf'),none,'sommaire avec numéro de page');
eq(row('PSE BRASSEURS D\'AIR\nFourniture et pose de brasseurs d\'air en PSE',DOC_TYPES.CCTP,'CCTP FICTIF.pdf'),none,'PSE');
eq(row('8 8 BRASSEUR D\'AIR + TELECOMMANDE (SUPPRESSION)',DOC_TYPES.CCTP,'CCTP FICTIF.pdf'),none,'suppression');
// Toujours lus.
eq(row('Fourniture et pose de 24 brasseurs d’air plafonniers dans les séjours et chambres.',DOC_TYPES.CCTP,'CCTP FICTIF.pdf'),['Oui',24,'Brasseur d’air plafonnier'],'CCTP : pose décrite');
eq(row('Suivant plans, un brasseur d\'air dans chaque séjour et chambre des logements non\nclimatisés (23 logements, soit 70 brasseurs d\'air) :',DOC_TYPES.CCTP,'CCTP FICTIF.pdf')[0],'Oui','CCTP : brasseurs prévus');
// Rattrapage des documents déjà analysés : seules les lectures « brasseur » sont refaites, une fois.
{ const d=prep(textDoc('old','RSET ancien FICTIF.pdf',DOC_TYPES.RSET_RE2020,'Brasseurs d\'air\nhaut de page\nDonnées sur l\'éclairage'),DOC_TYPES.RSET_RE2020);
  const other={field:'shab',value:1234,method:'rset:shab',building:'Bâtiment unique',confidence:0.95,page:1};
  d.cachedOccurrences=[other,{field:'fan_type',value:'Brasseur d’air plafonnier',method:'comfort:fan-type',building:'Bâtiment unique',confidence:0.94,page:1}];
  catchUpDocument(d);
  eq([d.fanRead>=1,d.needsCheckpoint,d.cachedOccurrences.some(o=>/^fan_/.test(o.field)),d.cachedOccurrences.includes(other)],[true,true,false,true],'rattrapage : faux brasseur retiré, autres lectures gardées');
  const r=analyzeDocuments([d],structuredClone(DEFAULT_SOURCE_RULES),'Op').rows[0]; eq(r.fan_presence,undefined,'rattrapage : plus de « Oui »'); }
{ const d=prep(textDoc('old2','RSET ancien 2 FICTIF.pdf',DOC_TYPES.RSET_RE2020,'Nombre total de brasseurs d\'air de la zone : 3'),DOC_TYPES.RSET_RE2020);
  d.cachedOccurrences=[{field:'fan_type',value:'Brasseur d’air plafonnier',method:'comfort:fan-type',building:'Bâtiment unique',confidence:0.94,page:1}];
  catchUpDocument(d); eq(d.cachedOccurrences.find(o=>o.field==='fan_count')?.value,3,'rattrapage : nombre de la zone ajouté'); }
{ const d=prep(textDoc('old3','Notice FICTIVE.pdf',DOC_TYPES.CCTP,'Brasseurs d\'air'),DOC_TYPES.CCTP); const before=[{field:'shab',value:10,method:'x',building:'Bâtiment unique',confidence:0.95,page:1}]; d.cachedOccurrences=before;
  catchUpDocument(d); eq([d.fanRead>=1,d.cachedOccurrences===before,!!d.needsCheckpoint],[true,true,false],'sans lecture « brasseur » : marqué sans relecture'); }
console.log(`v2.31.0 — ${n} vérifications OK (données fictives)`);
