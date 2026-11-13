// ExtracTerre v2.20.2 — « Planchers hauts » : matériau / structure du plancher haut, plus le statut de la toiture. Données FICTIVES.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION,DOC_TYPES,DEFAULT_SOURCE_RULES} from './js/config.js';
import {roofStructureFrom,cleanRoofStructure,isRoofStatusOnly} from './js/plancher-haut.js';
import {sanitizeOccurrence} from './js/sanity.js';
import {technicalDataFields} from './js/donnees-techniques.js';
import {analyzeDocuments} from './js/engine.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.36.1','version');
// Matériau écrit dans le libellé ; sinon rien, jamais de valeur par défaut (« Combles perdus » seul → rien).
eq(['Plancher haut poutrelles hourdis','Prédalles + dalle de compression','Dalle béton 20 cm','Plancher bois sur solives','Charpente bois fermettes','Bac acier collaborant','Combles perdus','Combles perdus sur plancher béton','Terrasse accessible sur CLT'].map(roofStructureFrom),
  ['Poutrelles-hourdis','Prédalle','Dalle béton','Plancher bois','Charpente bois','Bac acier collaborant',null,'Dalle béton','Plancher bois'],'matériaux');
eq(['Toiture terrasse non accessible','Toiture terrasse végétalisée','Toiture en pente','Terrasse inaccessible','Rampants'].map(cleanRoofStructure),[null,null,null,null,null],'statuts écartés');
eq(cleanRoofStructure('Toiture terrasse inaccessible sur dalle béton'),'Dalle béton','statut + matériau → matériau');
eq(cleanRoofStructure('Poutrelles-hourdis'),'Poutrelles-hourdis','matériau gardé'); eq(cleanRoofStructure('Combles'),null,'« Combles » sans matériau écarté');
// Filtre des lectures : libellé « Toiture : terrasse non accessible » écarté, saisie manuelle gardée telle quelle.
const base={field:'roof_structure',building:'Bâtiment A',docType:'CCTP',confidence:0.9,excerpt:'Toiture : terrasse non accessible'};
eq(sanitizeOccurrence({...base,value:'Toiture terrasse non accessible',method:'tags:label-value'}),null,'lecture de statut écartée');
eq(sanitizeOccurrence({...base,value:'Toiture terrasse non accessible',method:'xml:dc-toiture'}),null,'même depuis le XML');
eq(sanitizeOccurrence({...base,value:'Toiture terrasse non accessible',method:'manual:free-paste'}).value,'Toiture terrasse non accessible','saisie manuelle intacte');
// Données techniques RSET : « Type principal de toiture » ne donne plus le statut.
const dtOut=technicalDataFields({roofType:{value:'Toiture terrasse non accessible',line:{}}});
eq((Array.isArray(dtOut)?dtOut:[]).some(o=>o.field==='roof_structure'),false,'Données techniques : pas de statut');
// Opération analysée avant : la valeur conservée « Toiture terrasse non accessible » disparaît au recalcul, le matériau reste.
const occ=(v,m)=>({field:'roof_structure',value:v,building:'Bâtiment A',docId:'d1',fileName:'cctp-fictif.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:v,confidence:0.95,method:m,unit:''});
const doc={id:'d1',name:'cctp-fictif.pdf',type:DOC_TYPES.CCTP,status:'ready',buildings:{names:['Bâtiment A']},rsetAddressRead:true,dhZonesRead:true,
  cachedOccurrences:[occ('Toiture terrasse non accessible','xml:dc-toiture'),occ('Poutrelles-hourdis','envelope:structure-context')]};
const r=analyzeDocuments([doc],DEFAULT_SOURCE_RULES,'Opération fictive');
const vals=r.finals.filter(f=>f.field==='roof_structure').map(f=>f.value);
eq(vals.includes('Toiture terrasse non accessible'),false,'statut retiré des lectures conservées');
eq(vals.includes('Poutrelles-hourdis'),true,'matériau retenu');
// Jamais de valeur par défaut : U48win sans ligne « REFROIDISSEMENT » ne donne plus 0 ni « Aucun » ;
// postes et énergies du Cep absents ne deviennent plus 0 (Pléiades RT existant, U48win, tableau des postes).
const src=f=>readFileSync(f,'utf8');
eq(/'cep_cooling',P\.REFROIDISSEMENT\?\.v\|\|0|\(P\.REFROIDISSEMENT\?\.v\|\|0\)>0\?'Climatisation/.test(src('js/u48win-rtex.js')),false,'U48win : pas de refroidissement inventé');
eq(/px_r2\(poste\.\w+\|\|0\)|px_r2\(parE\[e\]\|\|0\)/.test(src('js/pleiades-rtex.js')),false,'Pléiades : pas de poste à 0 inventé');
eq(/r2\(by\[e\]\|\|0\)/.test(src('js/u48win-rtex.js')),false,'U48win : pas d’énergie à 0 inventée');
eq(/d\.energy\.\w+\|\|0/.test(src('js/parsers.js')),false,'tableau des postes : pas d’énergie à 0 inventée');
console.log(`test_v2_20_2 : ${n}/${n} OK`);
