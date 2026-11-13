// ExtracTerre v2.20.3 — encart « Projet actuel » : les 5 derniers projets ouverts, cliquables, gardés dans la sauvegarde locale.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
import {serializeProjectFull} from './js/persistence.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.36.0','version');
const html=readFileSync('index.html','utf8'), app=readFileSync('js/app.js','utf8');
eq(/id="recentProjectsBox"[^>]*hidden/.test(html)&&/<ol id="recentProjects">/.test(html),true,'liste dans l’encart');
eq(/function activateProject\(id\)\{ const p=state\.projects\.find\(x=>x\.id===id\); if\(!p\)return; p\.lastOpenedAt=Date\.now\(\);/.test(app),true,'date d’ouverture notée à chaque ouverture');
const fn=app.slice(app.indexOf('function renderRecentProjects()'),app.indexOf('function updateUxMirrors()'));
eq(/p\.id!==state\.activeProjectId/.test(fn)&&/\.slice\(0,5\)/.test(fn)&&/b\.lastOpenedAt-a\.lastOpenedAt/.test(fn),true,'5 plus récents, hors projet affiché');
eq(/recent\.onclick=e=>\{ const b=e\.target\.closest\('\[data-recent-project\]'\); if\(b\) activateProject/.test(app),true,'clic = ouvrir');
eq(serializeProjectFull({id:'p1',lastOpenedAt:1730000000000,docs:[]}).lastOpenedAt,1730000000000,'sauvegardé');
eq(serializeProjectFull({id:'p2',docs:[]}).lastOpenedAt,0,'jamais ouvert : 0 (absent de la liste)');
console.log(`test_v2_20_3 : ${n}/${n} OK`);
