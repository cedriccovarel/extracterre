// ExtracTerre v2.21.0 — mémoire : texte des documents rangé à part et chargé pour l'opération ouverte seulement ;
// horodatage de chaque analyse, compté dans « traitées aujourd'hui ». Données FICTIVES.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
import {serializeProjectFull,docReadLoaded,unloadDocumentRead} from './js/persistence.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.33.1','version');
const app=readFileSync('js/app.js','utf8'), per=readFileSync('js/persistence.js','utf8'), eng=readFileSync('js/engine.js','utf8');

// Compteur : une analyse horodatée aujourd'hui compte comme un import Salesforce du jour ; hier ne compte pas.
const src=app.slice(app.indexOf('const SF_SRC='),app.indexOf('function sfStatsHtml()'));
const state={projects:[]}; const projectIsEmpty=p=>!(p.docs||[]).length&&!p.result&&!Object.keys(p.manualValues||{}).length;
const {sfStats}=new Function('state','projectIsEmpty',`${src}; return {sfStats};`)(state,projectIsEmpty);
const now=Date.now(), yesterday=now-36*3600e3;
state.projects.push(
  {id:'a',docs:[{}],analysisRuns:[{at:now,docs:3,newDocs:2}]},
  {id:'b',docs:[{}],analysisRuns:[{at:yesterday,docs:1,newDocs:1}]},
  {id:'c',docs:[{}],salesforceImports:[{at:now,values:4}],analysisRuns:[{at:now,docs:1,newDocs:0}]},
  {id:'d',docs:[{}]});
const s=sfStats(); eq([s.total,s.today,s.filled],[4,2,1],'aujourd’hui : analyse ou import du jour, une fois par opération');
eq(/traitée\(s\) aujourd’hui/.test(app)&&/analyse ou import Salesforce/.test(app),true,'libellé du compteur');
eq(/ap\.analysisRuns=\[\.\.\.\(ap\.analysisRuns\|\|\[\]\),\{at:Date\.now\(\)/.test(app),true,'horodatage posé à chaque analyse');
eq(serializeProjectFull({id:'p',docs:[],analysisRuns:[{at:5,docs:2,newDocs:1,extra:'x'}]}).analysisRuns,[{at:5,docs:2,newDocs:1}],'horodatage enregistré');
eq(serializeProjectFull({id:'p',docs:[]}).analysisRuns,[],'pas d’horodatage inventé');

// Texte des documents : magasin à part, migration une fois, chargement à la demande, jamais déchargé avant écriture.
eq(/const READ_STORE='documentReads'/.test(per)&&/const DB_VERSION=3/.test(per),true,'magasin documentReads');
eq(/async function migrateReadsOut\(db\)/.test(per)&&/c\.update\(\{\.\.\.r,read:null\}\)/.test(per),true,'migration document par document');
eq(/export async function loadDocumentReads\(docs\)/.test(per),true,'chargement à la demande');
eq(/if\(!s\|\|!s\.stored\|\|!s\.loaded\) return false/.test(per),true,'libéré seulement s’il est enregistré');
eq(/if\(slot&&slot\.gen===gen\) slot\.stored=read!==null/.test(per),true,'texte réaffecté pendant l’écriture : reste à écrire');
const doc={id:'x',read:{kind:'pdf',pages:[],text:''}};
eq([docReadLoaded(doc),unloadDocumentRead(doc),!!doc.read],[true,false,true],'document lu dans la session : jamais libéré avant sauvegarde');
eq(/tx\.objectStore\(READ_STORE\)\.delete\(docId\)/.test(per)&&/tx\.objectStore\(READ_STORE\)\.clear\(\)/.test(per),true,'suppression et vidage incluent le texte');

// Application : aucun calcul sur un texte non chargé.
eq(/function rebuildProjectFromCheckpoints\(project\)\{\n  if\(!projectReadsLoaded\(project\)&&!project\.readsLoadFailed\)/.test(app),true,'recalcul : texte rechargé d’abord');
eq(/if\(!p\|\|p\.id===state\.activeProjectId\|\|analysisControl\.running\) return 0/.test(app),true,'opération ouverte et analyse en cours : jamais libérées');
eq(/await ensureProjectReads\(p\); const b=new Blob\([\s\S]{0,80}parts\.push\(b\); releaseProjectReads\(p\)/.test(app),true,'export de session : une opération à la fois');
eq(/return \{\.\.\.consolidated,alerts,/.test(eng)&&/\(r\.detailed\|\|\[\]\)\.filter\(o=>o\?\.docId/.test(app),true,'résultat sans copie « occurrences »');
console.log(`test_v2_21_0 : ${n}/${n} OK`);
