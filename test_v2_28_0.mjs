// ExtracTerre v2.28.0 — file des analyses (arrêter, annuler, vider), avancement par document, OCR plus rapide pour l'import.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
import {ssRequestDone} from './js/suivi-sources.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'2.31.0','version');
eq(['terminé','erreur','interrompu','annulé','en cours'].map(e=>ssRequestDone({etat:e})).concat(ssRequestDone(null)),[true,true,true,true,false,false],'demandes terminées');
const w=fs.readFileSync('tools/import/watch.mjs','utf8'), cli=fs.readFileSync('tools/import/extracterre-import.mjs','utf8'), rd=fs.readFileSync('js/readers.js','utf8'), app=fs.readFileSync('js/app.js','utf8'), cfg=JSON.parse(fs.readFileSync('tools/import/import.config.json','utf8'));
eq(/current\.child\.kill\('SIGINT'\)/.test(w)&&/kill\('SIGKILL'\)/.test(w)&&/etat:'annulé'/.test(w),true,'service : arrêt propre, arrêt forcé, annulation en attente');
eq(/fs\.statSync\(SELF\)\.mtimeMs!==CODE_MTIME/.test(w),true,'service : redémarre seul quand son code change');
eq(/if\(r\.ocr===false\) args\.push\('--sans-ocr'\)/.test(w),true,'analyse sans OCR depuis l’appli');
eq(/status\(\{fichiers:\{fait:fileDone,total:fileTotal,courant:f\.name\}\}\)/.test(cli),true,'avancement par document');
eq(/opts\.ocrMaxPages/.test(rd)&&/opts\.ocrFullScale\|\|3\.0/.test(rd),true,'plafond et résolution OCR réglables (l’appli garde ses réglages)');
eq([cfg.ocrMaxPagesParDocument,cfg.ocrEchelle],[40,2],'réglages OCR de l’import');
eq(['data-ss-qstop','data-ss-qkill','data-ss-qdel','data-ss-qclear','data-ss-ocr'].every(k=>app.includes(k)),true,'boutons de la file');
console.log(`v2.31.0 — ${n} vérifications OK`);
