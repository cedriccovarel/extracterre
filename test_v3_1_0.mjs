// ExtracTerre v3.4.1 — onglets de session : l'onglet d'une opération est gardé (sauvegarde locale, export), l'export de
// session ne prend que l'onglet ouvert (« Toutes » = toutes, comme avant), l'import range dans l'onglet du fichier.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION} from './js/config.js';
import {serializeProjectFull,hydrateProjectFull} from './js/persistence.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'3.4.1','version');
const full=serializeProjectFull({id:'p1',sessionTab:'tab-neuf',docs:[]});
eq(full.sessionTab,'tab-neuf','onglet sérialisé');
eq(serializeProjectFull({id:'p2',docs:[]}).sessionTab,'','sans onglet : seulement « Toutes »');
eq(hydrateProjectFull(full).sessionTab,'tab-neuf','onglet relu');
const src=fs.readFileSync('./js/app.js','utf8'), per=fs.readFileSync('./js/persistence.js','utf8');
const has=(s,re,m)=>{ assert.match(s,re,m); n++; };
has(src,/const all=state\.projects\.filter\(p=>!projectIsEmpty\(p\)&&inSessionTab\(p\)\)/,'export : opérations de l’onglet ouvert');
has(src,/const inSessionTab=p=>!state\.activeSessionTab\|\|/,'« Toutes » : aucun filtre');
has(src,/sessionTab:\{name:tabName\}/,'nom de l’onglet dans le fichier exporté');
has(src,/o\.sessionTab\?\.name\?ensureSessionTab\(o\.sessionTab\.name\):state\.activeSessionTab/,'import : onglet du fichier, sinon onglet ouvert');
has(src,/inSessionTab\(p\)\)\.map\(p=>\(\{p,id:projectIdentity/,'tuiles filtrées par onglet');
has(per,/sessionTabs:safeJsonClone\(sessionTabs,\[\]\)/,'liste des onglets sauvegardée');
console.log(`test_v3_1_0 : ${n} vérifications OK`);
