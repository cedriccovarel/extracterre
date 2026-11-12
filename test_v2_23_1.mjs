// v2.23.1 — export de la session : témoin d'avancement (carte, étapes, bouton désactivé).
import {readFileSync} from 'node:fs'; import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
const app=readFileSync(new URL('./js/app.js',import.meta.url),'utf8'), css=readFileSync(new URL('./styles.css',import.meta.url),'utf8'), bundle=readFileSync(new URL('./js/app.bundle.js',import.meta.url),'utf8');
let n=0; const ok=(c,m)=>{ assert.ok(c,m); n++; };
assert.equal(APP_VERSION,'2.31.4'); n++;
ok(/function exportProgress\(title\)/.test(app)&&/role','status'/.test(app),'carte d\'avancement accessible');
for(const step of ['Recalcul des opérations','Préparation des recherches','Écriture des opérations','Création du fichier…','Session exportée']) ok(app.includes(step),`étape « ${step} »`);
ok(/sessionExportRunning/.test(app)&&/btn\.disabled=true/.test(app),'bouton désactivé pendant l\'export');
ok(/sessionSnapshot\(\{details=true,onRebuild=null,onStep=null\}=\{\}\)/.test(app),'snapshot avec progression');
ok(/ensureAllRebuilt\(onStep=null\)/.test(app),'recalcul avec progression');
ok(/\.export-progress\{position:fixed/.test(css)&&/prefers-reduced-motion:reduce\)\{\.export-progress/.test(css),'style + mouvement réduit');
ok(bundle.includes('function exportProgress(title)'),'bundle reconstruit');
console.log(`v2.31.0 — ${n} vérifications OK`);
