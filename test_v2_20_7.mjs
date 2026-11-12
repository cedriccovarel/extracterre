// ExtracTerre v2.20.7 — bâtiments ajoutés depuis Salesforce en rouge ; compteur des opérations ; liste « documents seuls ».
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
import {serializeProjectFull} from './js/persistence.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.24.4','version');
const app=readFileSync('js/app.js','utf8'), css=readFileSync('styles.css','utf8');
// Fonctions de l'accueil évaluées sur des projets fictifs (même code que l'application).
const src=app.slice(app.indexOf('const SF_SRC='),app.indexOf('function sfStatsHtml()'));
const state={projects:[]}; const projectIsEmpty=p=>!(p.docs||[]).length&&!p.result&&!Object.keys(p.manualValues||{}).length;
const {sfImports,sfAddedBuildings,sfStats}=new Function('state','projectIsEmpty',`${src}; return {sfImports,sfAddedBuildings,sfStats};`)(state,projectIsEmpty);
const now=Date.now(), yesterday=now-36*3600e3, SF='Collage libre — Salesforce';
const occ=(b,docId)=>({building:b,docId,method:docId.startsWith('free-paste-')?'manual:free-paste':'rset'});
const pSF={id:'a',docs:[{}],manualValues:{x:1},salesforceImports:[{at:now,values:12}],manualSources:{'Bâtiment 10|bbio':{fileName:SF},'Bâtiment 1|bbio':{fileName:SF}},
  result:{rows:[{building:'Bâtiment 1'},{building:'Bâtiment 10'}],detailed:[occ('Bâtiment 1','d1'),occ('Bâtiment 10','free-paste-a')]}};
const pOld={id:'b',docs:[{}],manualValues:{x:1},manualSources:{'Bâtiment A|cep':{fileName:SF}},result:{rows:[{building:'Bâtiment A'}],detailed:[occ('Bâtiment A','d2')]}};
const pYest={id:'c',docs:[],manualValues:{x:1},salesforceImports:[{at:yesterday,values:3}]};
const pDocs={id:'d',docs:[{},{}],result:{rows:[{building:'Bâtiment Z'}],detailed:[occ('Bâtiment Z','d3')]}};
const pEmpty={id:'e',docs:[]};
state.projects.push(pSF,pOld,pYest,pDocs,pEmpty);
eq([...sfAddedBuildings(pSF)],['Bâtiment 10'],'rouge : bâtiment connu seulement par Salesforce');
eq(sfAddedBuildings(pOld).size,0,'bâtiment déjà connu par les documents : pas rouge');
eq(sfImports(pOld).length,1,'ancien import Salesforce reconnu par sa source (sans date)');
const s=sfStats(); eq([s.total,s.today,s.filled,s.docsOnly.map(p=>p.id)],[4,1,3,['d']],'compteur : total, aujourd’hui, remplies, documents seuls');
// Import Salesforce daté à l'intégration ; gardé dans la sauvegarde locale.
eq(/if\(\/salesforce\/i\.test\(freePaste\.sourceLabel\|\|''\)&&\(n\|\|nAll\)\) p\.salesforceImports=/.test(app),true,'import daté');
eq(serializeProjectFull({id:'p',docs:[],salesforceImports:[{at:123,values:4}]}).salesforceImports,[{at:123,values:4}],'sauvegardé');
eq(/\$\{sfStatsHtml\(\)\}(?:\$\{missing[^\n]*?)?<div class="op-tiles">/.test(app)&&/data-sf-open/.test(app),true,'compteur et liste cliquable à l’accueil');
eq(/tr\.sf-added>td\.building-cell/.test(css)&&/sf-added/.test(app),true,'ligne en rouge');
console.log(`test_v2_20_7 : ${n}/${n} OK`);
