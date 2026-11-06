// ExtracTerre v2.19.1 — démarrage fluide avec des centaines d'opérations. Vérifications statiques (le chargement réel a été
// mesuré dans le navigateur sur 280 opérations fictives : accueil utilisable en ~0,5–1 s au lieu de ~5 s).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.20.4','version');
const per=readFileSync('js/persistence.js','utf8'), app=readFileSync('js/app.js','utf8'), css=readFileSync('styles.css','utf8');
eq(/async function getDocumentRecords\(db,ids,onProgress\)/.test(per)&&/savedById\.get\(meta\.id\)/.test(per)&&!/await getDocumentRecord\(db,meta\.id\)/.test(per),true,'documents lus dans une seule transaction');
eq(/function lazyRead\(doc,raw\)/.test(per)&&/lazyRead\(doc,saved\.read\)/.test(per),true,'texte préparé à la première lecture');
eq(/tileCache:safeJsonClone\(project\.tileCache,null\)/.test(per)&&/function refreshTileCache\(p\)/.test(app),true,'résumé de tuile enregistré');
eq(/async function rebuildInBackground\(\)/.test(app)&&/p\.pendingRebuild=true/.test(app)&&/if\(first\) rebuildProjectFromCheckpoints\(first\)/.test(app),true,'projet ouvert d’abord, autres en arrière-plan');
eq(['function sessionSnapshot({details=true}={}){\n  ensureAllRebuilt();','function exportSessionJson(){\n  ensureAllRebuilt();','function openExportDialog(){\n  ensureAllRebuilt();'].every(s=>app.includes(s)),true,'exports complets');
eq(/if\(!p\.result\) rebuildProjectFromCheckpoints\(p\)/.test(app),true,'projet ouvert avant son recalcul : recalculé à l’ouverture');
eq(/\.startup-progress\{/.test(css)&&/prefers-reduced-motion:reduce\)\{\.startup-progress/.test(css),true,'écran de progression');
console.log(`test_v2_19_2 : ${n}/${n} OK`);
