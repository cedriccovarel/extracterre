// ExtracTerre v2.23.3 — Brasseur d'air : CCTP d'opération appliqué aux bâtiments, installation décrite dans un document Contrat /
// Descriptif acceptée, « 0 brasseur » du RSET prioritaire, rattrapage relancé. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES,DEFAULT_SOURCE_RULES} from './js/config.js';
import {analyzeDocuments,catchUpDocument,applyComparisonBases} from './js/engine.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.31.4','version');
const prep=(id,name,type,txt)=>{ const d=textDoc(id,name,type,txt); const c=classifyDocument(d.name,d.read.text,{kind:d.read.kind}); d.classification={...c,automaticType:c.type}; d.type=type; d.buildings=detectBuildings(d); d.status='ready'; return d; };
const run=docs=>{ const r=analyzeDocuments(docs,structuredClone(DEFAULT_SOURCE_RULES),'Op'); applyComparisonBases(r); return r; };
// Deux bâtiments (RSET), brasseurs décrits pour toute l'opération dans le CCTP.
const rsetA=prep('a','RSET Bâtiment A FICTIF.pdf',DOC_TYPES.RSET_RE2020,'Bâtiment : Bâtiment A\nShab : 1200 m²');
const rsetB=prep('b','RSET Bâtiment B FICTIF.pdf',DOC_TYPES.RSET_RE2020,'Bâtiment : Bâtiment B\nShab : 900 m²');
const cctp=prep('c','CCTP lot électricité FICTIF.pdf',DOC_TYPES.CCTP,'- Fourniture, pose et raccordement des brasseurs d\'air.');
const r1=run([rsetA,rsetB,cctp]);
eq(r1.rows.length>=2,true,'deux bâtiments');
eq(r1.rows.map(x=>x.fan_presence),r1.rows.map(()=> 'Oui'),'CCTP d\'opération : Oui pour chaque bâtiment');
eq(r1.rows.map(x=>x.fan_count),r1.rows.map(()=>undefined),'nombre non recopié sur chaque bâtiment');
// Document classé Contrat (CCTP mal classé) : installation décrite acceptée, simple mention non.
eq(run([prep('k','Pièces DCE FICTIF.pdf',DOC_TYPES.CONTRACT,'Fourniture et mise en œuvre de brasseurs d\'air électriques dans les séjours.')]).rows[0]?.fan_presence,'Oui','Contrat : installation décrite');
eq(run([prep('k2','Pièces DCE 2 FICTIF.pdf',DOC_TYPES.CONTRACT,'Le confort d\'été peut être amélioré par des brasseurs d\'air.')]).rows[0]?.fan_presence,undefined,'Contrat : simple mention');
eq(run([prep('k3','Descriptif FICTIF.pdf',DOC_TYPES.PROJECT_DESCRIPTION,'Afin d\'améliorer le confort, des brasseurs d\'air seront mis en place dans les séjours.')]).rows[0]?.fan_presence,'Oui','Descriptif : installation décrite');
// RSET « 0 » prioritaire sur un type lu pour toute l'opération.
const r0=run([prep('z','RSET FICTIF.pdf',DOC_TYPES.RSET_RE2020,'Nombre total de brasseurs d\'air de la zone : 0'),prep('c2','CCTP FICTIF.pdf',DOC_TYPES.CCTP,'Fourniture et pose de brasseurs d\'air.')]);
eq(r0.rows[0].fan_presence,'Non','RSET 0 prioritaire');
// Rattrapage : un document déjà rattrapé en 2.23.2 (fanRead = true) est relu une fois de plus.
{ const d=prep('o','Pièces DCE 3 FICTIF.pdf',DOC_TYPES.CONTRACT,'Fourniture et mise en œuvre de brasseurs d\'air électriques.');
  d.cachedOccurrences=[{field:'fan_type',value:'Brasseur d’air plafonnier',method:'comfort:fan-type',building:'Bâtiment unique',confidence:0.94,page:1}]; d.fanRead=true;
  catchUpDocument(d); eq([d.fanRead,d.cachedOccurrences.some(o=>o.secondarySourceOk)],[2,true],'rattrapage 2.31.0');
  catchUpDocument(d); eq(d.fanRead,2,'une seule fois'); }
// Détection des bâtiments : une suite de phrase ou un en-tête de tableau n'est pas un bâtiment ; les vrais titres restent.
const names=t=>detectBuildings(textDoc('n','CCTP FICTIF.pdf',DOC_TYPES.CCTP,t)).names;
eq(names('Les ouvrages du\nbatiment realises sur chantiers.\nLot 3\nbatiment a charge du VRD'),['Bâtiment unique'],'suites de phrase');
eq(names('Batiment A Batiment B Batiment C\nBatiment Type de VMC Type de caisson Quantite'),['Bâtiment unique'],'en-têtes de tableau');
eq(names('1. Bâtiment A\n2. Bâtiment B'),['Bâtiment A','Bâtiment B'],'titres numérotés');
eq(names('Bâtiment 1 Est\nx\nBâtiment 2 Ouest'),['Bâtiment 1 EST','Bâtiment 2 OUEST'],'orientation');
eq(names('BATIMENT A - LA JOUGARELLE'),['Bâtiment A - LA JOUGARELLE'],'nom de résidence');
eq(names('Batiment A2 et B\nBatiment C'),['Bâtiment A2 ET B','Bâtiment C'],'groupe de bâtiments');
eq(names('pour le\nbatiment A\npuis le\nbatiment B'),['Bâtiment A','Bâtiment B'],'identifiant court en minuscules');
// Rattrapage : faux noms retirés de la liste enregistrée, autres noms gardés, lectures rattachées repassées sans bâtiment.
{ const d={id:'g',name:'CCTP ancien FICTIF.pdf',type:DOC_TYPES.CCTP,status:'ready',fanRead:2,get read(){ throw new Error('texte relu'); },
    buildings:{names:['Bâtiment A','Bâtiment MAISONS G01 - G04','Bâtiment REALISES SUR CHANTIERS.','Bâtiment ET DES TRAVAUX PUBLICS','Bâtiment A - LA JOUGARELLE'],hits:[]}};
  const mine={field:'shab',value:999,method:'targeted-ocr:max:user-validated:x',userValidated:true,building:'Bâtiment REALISES SUR CHANTIERS.',page:1,confidence:1};
  d.cachedOccurrences=[{field:'fan_type',value:'Brasseur d’air plafonnier',method:'comfort:fan-type',building:'Bâtiment REALISES SUR CHANTIERS.',confidence:0.94,page:1},mine];
  catchUpDocument(d);
  eq([d.bldRead,d.buildings.names,d.cachedOccurrences[0].building,d.cachedOccurrences[1].building],[1,['Bâtiment A','Bâtiment MAISONS G01 - G04','Bâtiment A - LA JOUGARELLE'],'Bâtiment unique','Bâtiment REALISES SUR CHANTIERS.'],'rattrapage bâtiments sans relecture'); }
{ const d={id:'s',name:'RSET FICTIF.pdf',type:DOC_TYPES.RSET_RE2020,status:'ready',fanRead:2,buildings:{names:['Bâtiment DE LOGEMENTS COLLECTIFS EN BANDE.'],hits:[]},cachedOccurrences:[{field:'cep',value:50,method:'x',building:'Bâtiment DE LOGEMENTS COLLECTIFS EN BANDE.',confidence:0.95,page:1}]};
  catchUpDocument(d); eq([d.buildings.names.length,d.cachedOccurrences[0].building],[1,'Bâtiment DE LOGEMENTS COLLECTIFS EN BANDE.'],'seul bâtiment du document : gardé'); }
{ const d={id:'m',name:'CCTP FICTIF.pdf',type:DOC_TYPES.CCTP,status:'ready',fanRead:2,buildings:{names:['Bâtiment A','Bâtiment COMPTE DE LA PERMEABILITE'],hits:[]},cachedOccurrences:[]};
  catchUpDocument(d,{'Bâtiment A':'Bâtiment COMPTE DE LA PERMEABILITE'}); eq(d.buildings.names,['Bâtiment A','Bâtiment COMPTE DE LA PERMEABILITE'],'nom d\'un regroupement manuel : gardé'); }
console.log(`v2.31.0 — ${n} vérifications OK (données fictives)`);
