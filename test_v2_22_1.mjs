// ExtracTerre v2.22.1 — session : une opération par ligne (« lines-v1 »), relue en flux ; ancien format toujours lu.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.23.2','version');
const app=readFileSync('js/app.js','utf8');
const src=app.slice(app.indexOf('async function readSessionFile('),app.indexOf('async function importSessionJson('));
const readSessionFile=new Function('setLocalSaveUi',`${src}; return readSessionFile;`)(()=>{});
const projects=[{id:'p1',docs:[{name:'a "b"\nc'}]},{id:'p2',x:'é'.repeat(70000)},{id:'p3'}];
const snap={format:'extracterre-session',exportedAt:'2026-11-09',operations:[{id:'p1'},{id:'p2'},{id:'p3'}]};
// Nouveau format : même construction que exportSessionJson ; morceaux de 7 octets pour couper les lignes n'importe où.
const head=JSON.stringify(snap,null,1);
const text=head.slice(0,head.lastIndexOf('}')).replace(/\s+$/,'')+',\n "workspaceFormat": "lines-v1",\n "workspace": {"projects": [\n'+projects.map((p,i)=>(i?',':'')+JSON.stringify(p)+'\n').join('')+']}\n}\n';
eq(JSON.parse(text).workspace.projects,projects,'JSON valide');
const o=await readSessionFile(new Blob(['\uFEFF'+text]));
eq(o.workspace.projects,projects,'opérations relues ligne par ligne'); eq(o.operations.length,3,'tête'); eq(o.workspaceFormat,'lines-v1','format');
// Ancien format (v2.20.7–v2.22.0) : tête indentée, « "projects": [{ », opérations indentées séparées par « ,{ ».
const oh=JSON.stringify(snap,null,1); const old=oh.slice(0,oh.lastIndexOf('}')).replace(/\s+$/,'')+',\n "workspace": {"projects": ['+projects.map((p,i)=>(i?',':'')+JSON.stringify(p,null,1)).join('')+']}\n}';
eq(JSON.parse(old).workspace.projects,projects,'ancien format valide');
eq((await readSessionFile(new Blob([old]))).workspace.projects,projects,'ancien format relu en flux');
// Export plus ancien, sans « workspace ».
eq((await readSessionFile(new Blob([JSON.stringify(snap,null,1)]))).operations.length,3,'session sans workspace');
eq((await readSessionFile(new Blob([JSON.stringify({...snap,workspace:{projects:[]}},null,1)]))).workspace.projects,[],'workspace vide');
assert.ok(/JSON\.stringify\(serializeProjectFull\(p\)\)\+'\\n'/.test(app),'export compact, une ligne par opération'); n++;
console.log(`v2.23.2 — ${n} vérifications OK`);
