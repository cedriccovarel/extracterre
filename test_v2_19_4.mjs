// ExtracTerre v2.19.3 — observatoire des recherches : export .json dédié, page qui charge ce fichier (plus de flux automatique).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.33.2','version');
const app=readFileSync('js/app.js','utf8'), html=readFileSync('index.html','utf8'), obs=readFileSync('observatoire.html','utf8');
eq(/id="observatoryExportBtn"/.test(html)&&/id="observatoryBtn"/.test(html),true,'deux boutons');
eq(/function openSearchObservatory\(\)\{ window\.open\('observatoire\.html','extracterre-observatoire'\); \}/.test(app),true,'ouvrir = page seule, aucun calcul');
eq(/async function exportObservatoryJson\(\)/.test(app)&&/await new Promise\(res=>setTimeout\(res,0\)\)/.test(app)&&/ExtracTerre_observatoire_/.test(app),true,'export par lots, fichier dédié');
eq(/kind:'observatoire'/.test(app)&&/format:'extracterre-session'/.test(app),true,'format lu par la page');
eq(/function searchSignature\(p,g\)/.test(app)&&/c&&c\.sig===sig/.test(app),true,'résultat repris si rien n’a changé');
eq(!/merge\(JSON\.parse\(f\)\); localStorage\.removeItem\(FEED\)/.test(obs)&&/Charger l’export de l’observatoire/.test(obs),true,'page : chargement du fichier');
// La page lit le fichier exporté : même fusion qu'avant (format session, opérations, grilles).
const merge=obs.match(/function merge\(snap\)\{[\s\S]*?\n\}/)[0];
const data={grids:{},operations:{}}; const opKey=o=>String(o?.identity?.contract||o?.identity?.code||o?.identity?.name||o?.title||'').trim();
const run=new Function('data','opKey','snap',`${merge}; return merge(snap);`);
eq(run(data,opKey,{format:'extracterre-session',kind:'observatoire',grids:[{id:'g',criteria:[]}],operations:[{identity:{contract:'12345678'},searches:{g:{criteria:{},themes:{}}}}]}),1,'fichier exporté accepté');
console.log(`test_v2_19_4 : ${n}/${n} OK`);
