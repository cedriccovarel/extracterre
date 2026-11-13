// ExtracTerre v2.22.0 — file d'analyse ; boutons pause / arrêt reliés ; pause entre deux pages d'un PDF. Contrôles de source
// (le comportement a été vérifié dans Chrome sur des PDF fictifs : voir CHANGELOG).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const ok=(c,m)=>{ assert.ok(c,m); n++; };
assert.equal(APP_VERSION,'2.36.1'); n++;
const app=readFileSync('js/app.js','utf8'), html=readFileSync('index.html','utf8'), rd=readFileSync('js/readers.js','utf8');
ok(/\[data-analysis-pause\]'\)\.forEach\(b=>b\.onclick=toggleAnalysisPause\)/.test(app),'pause reliée');
ok(/\[data-analysis-stop\]'\)\.forEach\(b=>b\.onclick=stopAnalysis\)/.test(app),'arrêt relié');
for(const id of ['analysisPauseBtn','analysisStopBtn','analysisCardPauseBtn','analysisCardStopBtn']){ const m=html.match(new RegExp(`<button id="${id}"[^>]*>`)); ok(m&&/data-analysis-(pause|stop)/.test(m[0]),id); }
ok(/id="analysisQueueBtn"/.test(html),'bouton file d’analyse');
ok(/if\(opts\.pauseGate\) await opts\.pauseGate\(\);/.test(rd),'pause entre deux pages');
ok(/pauseGate:gate/.test(app),'gate transmis à la lecture');
ok(/if\(pendingDocs\[i\]\.removed\)/.test(app),'document retiré sauté');
ok(/c\.abort\('analysis-remove'\)/.test(app),'document en cours retiré interrompu');

// File : en cours = lecture ; en attente = fichier présent, pas lu, pas mis de côté, pas à redéposer.
const src=app.slice(app.indexOf('const QUEUE_SKIP='),app.indexOf('const queueSelection='));
const state={docs:[{id:'a',file:{},status:'reading'},{id:'b',file:{},status:'pending'},{id:'c',file:{},status:'ready'},{id:'d',file:{},status:'timeout'},{id:'e',status:'missing'},{id:'f',file:{},status:'error'},{id:'g',status:'pending'}]};
const q=new Function('state',`${src}; return analysisQueueDocs();`)(state);
assert.deepEqual(q.active.map(d=>d.id),['a']); n++;
assert.deepEqual(q.waiting.map(d=>d.id),['b','f']); n++;
console.log(`v2.31.0 — ${n} vérifications OK`);
