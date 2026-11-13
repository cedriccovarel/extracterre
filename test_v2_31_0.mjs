// ExtracTerre v2.31.0 — Suivi visuel de l'analyse en cours (import massif). Données fictives.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
import {ssProgressModel,ssDuration} from './js/suivi-sources.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'2.35.0','version');
const now=Date.parse('2026-11-12T12:00:00Z');
const st={etat:'en cours',etape:'extraction',debut:'2026-11-12T10:50:00Z',debutExtraction:'2026-11-12T11:00:00Z',majA:'2026-11-12T11:59:50Z',contrats:['A','B','C','D','E'],
  operations:{fait:2,total:5,courante:'C · C - 06 - VILLEFICTIVE'},fichiers:{fait:5,total:10,courant:'x.pdf'},parOp:{A:{r:'ok',f:3,x:3},B:{r:'inchangé'}}};
const m=ssProgressModel(st,now);
eq(m.pct,50,'barre : opérations finies + part de l’opération en cours (documents)');
eq([ssDuration(m.elapsed),ssDuration(m.eta)],['1 h 10','1 h'],'temps écoulé et temps restant estimé');
eq(m.tiles.map(t=>t.state),['ok','inchangé','encours','attente','attente'],'une case par contrat');
eq(m.current,'C - 06 - VILLEFICTIVE','numéro de contrat non répété');
eq(m.step,'extraction','étape en cours');
eq(ssProgressModel({...st,majA:'2026-11-12T11:40:00Z'},now).stale,true,'service muet depuis plus de 10 min signalé');
const fin=ssProgressModel({...st,etat:'terminé',etape:'terminé',operations:{fait:5,total:5},finA:'2026-11-12T12:30:00Z'},now);
eq([fin.pct,fin.step,ssDuration(fin.elapsed)],[100,'fin','1 h 40'],'terminé : 100 %, durée totale');
eq([ssProgressModel(null).step,ssProgressModel({etat:'en cours',etape:'démarrage'}).step],['attente','lecture'],'étapes avant l’extraction');
eq([ssDuration(30000),ssDuration(45*60000),ssDuration(120*60000)],['moins d’1 min','45 min','2 h'],'durées lisibles');
const cli=fs.readFileSync('tools/import/extracterre-import.mjs','utf8'), app=fs.readFileSync('js/app.js','utf8'), html=fs.readFileSync('index.html','utf8');
eq(/debutExtraction/.test(cli)&&/STATUS\.parOp\[contract\]=/.test(cli),true,'script : résultat par opération et début de l’extraction');
eq(/id="ssTracker"/.test(html)&&/function ssTrackerTick/.test(app)&&/class="ss-tiles"/.test(app),true,'appli : indicateur permanent et cases par contrat');
console.log(`v2.31.0 — ${n} vérifications OK (données fictives)`);
// v2.31.1 — reprise des analyses coupées au redémarrage du service
{ const w=fs.readFileSync('tools/import/watch.mjs','utf8');
  if(!/function resumeOrphans\(\)/.test(w)||!/etat:'en attente',etape:'attente',reprise:true/.test(w)||!/resumeOrphans\(\);\ntick\(\)/.test(w)) { console.error('ÉCHEC reprise des analyses coupées'); process.exit(1); }
  if(ssProgressModel({etat:'en attente',reprise:true}).step!=='attente'){ console.error('ÉCHEC étape reprise'); process.exit(1); }
  console.log('v2.31.1 — reprise OK'); }
// v2.31.2 — avancement pendant la lecture de Box
{ const m=ssProgressModel({etat:'en cours',etape:'lecture',debut:'2026-11-12T11:00:00Z',debutLecture:'2026-11-12T11:00:00Z',lecture:{fait:50,total:200,courant:'X'}},Date.parse('2026-11-12T11:02:00Z'));
  if(m.step!=='lecture'||m.pct!==25||ssDuration(m.eta)!=='6 min'||m.tiles.length||!/dossier/.test(m.unit)){ console.error('ÉCHEC lecture Box',m); process.exit(1); }
  const cli=fs.readFileSync('tools/import/extracterre-import.mjs','utf8'); if(!/debutLecture/.test(cli)||!/status\(\{lecture:\{fait:scanned/.test(cli)){ console.error('ÉCHEC script lecture'); process.exit(1); }
  console.log('v2.31.2 — lecture Box OK'); }
// v2.31.3 — Mac gardé éveillé pendant une analyse
{ const w=fs.readFileSync('tools/import/watch.mjs','utf8'); if(!/caffeinate',\['-i','-s','-w',String\(child\.pid\)\]/.test(w)){ console.error('ÉCHEC caffeinate'); process.exit(1); } console.log('v2.31.3 — veille OK'); }
// v2.31.4 — une erreur de rendu PDF n'arrête plus l'analyse ; relance automatique après un arrêt inattendu
{ const rt=fs.readFileSync('tools/import/lib/runtime.mjs','utf8'), cli=fs.readFileSync('tools/import/extracterre-import.mjs','utf8'), w=fs.readFileSync('tools/import/watch.mjs','utf8');
  if(!/\['DOMMatrix','Path2D','ImageData'\]/.test(rt)||!/process\.on\('unhandledRejection'/.test(cli)||!/relance automatique \$\{n\}\/3/.test(w)||!/STATUS\.tentatives=prev\.tentatives/.test(cli)){ console.error('ÉCHEC robustesse'); process.exit(1); }
  console.log('v2.31.4 — robustesse OK'); }
