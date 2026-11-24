// ExtracTerre v2.19.3 → v2.40.0 — observatoire des recherches : passé dans TotalRecoll (onglet Recherches, lu dans les sessions).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'3.5.1','version');
const app=readFileSync('js/app.js','utf8'), html=readFileSync('index.html','utf8'), obs=readFileSync('observatoire.html','utf8');
eq(!/observatoryExportBtn|observatoryBtn/.test(html),true,'plus de boutons observatoire');
eq(!/function openSearchObservatory|function exportObservatoryJson/.test(app),true,'plus d’export dédié');
eq(/TotalRecoll/.test(obs)&&!/function merge\(snap\)/.test(obs),true,'ancienne page : renvoi vers TotalRecoll');
eq(/function searchSignature\(p,g\)/.test(app)&&/c&&c\.sig===sig/.test(app),true,'résultat de recherche repris si rien n’a changé (session)');
eq(/searches:details\?/.test(app),true,'les recherches restent dans l’export de session');
console.log(`test_v2_19_4 : ${n}/${n} OK`);
