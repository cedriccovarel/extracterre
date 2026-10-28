// ExtracTerre v2.10.1 — adresse de l'opération lue dans le bloc « Opération » des RSET PDF (cadre CSTB). Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,DEFAULT_SOURCE_RULES,DOC_TYPES} from './js/config.js';
import {parseDocument,parseRsetOperationAddress} from './js/parsers.js';
import {analyzeDocuments} from './js/engine.js';
import {detectBuildings} from './js/buildings.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.10.5','version');
const addr=d=>parseDocument(d).filter(o=>['address','postcode','city'].includes(o.field)).map(o=>o.value);

// RE2020 : intervenants d'abord (ignorés), puis bloc Opération.
const re2020=['Chapitre 1 : Donnees generales de l\'operation','Maitre d\'ouvrage','Nom ou raison sociale SCCV FICTIVE','Adresse 3 place du Marche 69002 Lyon','Bureau d\'Etudes Energie','Adresse Nom de l\'adresse 00000 city',
  'Operation','Numero Permis de Construire (PC) PC000','Nom Residence Fictive','Description Residence Fictive','Adresse 12 rue des Lilas 69003 Lyon','Departement 69 - Rhone','Zone climatique H1-c'].join('\n');
eq(addr(textDoc('r1','RSET.pdf',DOC_TYPES.RSET_RE2020,re2020)),['12 rue des Lilas','69003','Lyon'],'RE2020');

// RT2012 : cellule sur trois lignes ; l'adresse du maître d'ouvrage (même mise en page) est ignorée.
const rt=['Maitre d\'ouvrage','Nom ou raison sociale Bailleur Fictif','8 allee des Tests','Adresse','45000 - ORLEANS','Operation','Stade d\'avancement Stade Permis de construire','Nom Collectif fictif',
  '61 rue des Essais','Adresse','45650 - SAINT-JEAN-LE-BLANC','Departement 45 - Loiret'].join('\n');
eq(addr(textDoc('r2','RSET RT2012.pdf',DOC_TYPES.RT2012,rt)),['61 rue des Essais','45650','SAINT-JEAN-LE-BLANC'],'RT2012');

// Sans bloc Opération ni Département : rien (pas d'adresse d'intervenant prise pour celle du projet).
eq(parseRsetOperationAddress(textDoc('r3','RSET.pdf',DOC_TYPES.RSET_RE2020,'Maitre d\'ouvrage\nAdresse 3 place du Marche 69002 Lyon\nContact -')),[],'intervenant seul');

// Synthèse : recopiée sur chaque bâtiment.
const d={...textDoc('r4','RSET.pdf',DOC_TYPES.RSET_RE2020,'Batiment A\n'+re2020+'\nBatiment B'),status:'ready',classification:{type:DOC_TYPES.RSET_RE2020,automaticType:DOC_TYPES.RSET_RE2020}}; d.buildings=detectBuildings(d);
const rows=analyzeDocuments([d],structuredClone(DEFAULT_SOURCE_RULES),'Op test').rows;
eq(rows.every(r=>r.postcode==='69003'&&r.city==='Lyon'),true,'retenue pour chaque bâtiment');
// Projet sauvegardé avant v2.10.1 : cache sans adresse, texte restauré → adresse rattrapée à l'analyse.
const old={...d,id:'r5',cachedOccurrences:[{field:'shab',value:100,building:'Batiment A',docId:'r5',docType:DOC_TYPES.RSET_RE2020,confidence:.99,method:'x',excerpt:'SHAB 100'}]};
eq(analyzeDocuments([old],structuredClone(DEFAULT_SOURCE_RULES),'Op test').rows.every(r=>r.postcode==='69003'),true,'rattrapage du cache');
console.log(`v2.10.1 — ${n} vérifications OK (données fictives)`);
