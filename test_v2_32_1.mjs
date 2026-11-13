// ExtracTerre v2.32.1 — tuiles existantes conservées au choix ; option « Relire tous les documents ». Données fictives.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'2.36.0','version');
const app=fs.readFileSync('js/app.js','utf8'), ss=fs.readFileSync('js/suivi-sources.js','utf8'), w=fs.readFileSync('tools/import/watch.mjs','utf8');
eq(/\['keep','Garder les tuiles existantes et ajouter la liste','primary'\]/.test(app)&&/\['replace','Ne garder que la nouvelle liste'/.test(app)&&/\['cancel','Annuler le lancement'/.test(app),true,'3 choix : garder, remplacer, annuler');
eq(/ssSetWorkList\(keepOthers\?\[\.\.\.new Set\(\[\.\.\.ssWorkList\(\),\.\.\.r\.contracts\]\)\]:r\.contracts\)/.test(app),true,'garder : la liste de travail s’ajoute à l’ancienne');
eq(/data-ss-reread/.test(app)&&/reread:!!\$\('#sourcesDialog \[data-ss-reread\]'\)\?\.checked/.test(app),true,'case « Relire tous les documents »');
eq(/\.\.\.\(reread\?\{reextraire:true\}:\{\}\)/.test(ss)&&/if\(r\.reextraire===true\) args\.push\('--reextraire'\)/.test(w),true,'demande → service → script --reextraire');
console.log(`v2.32.1 — ${n} vérifications OK`);
