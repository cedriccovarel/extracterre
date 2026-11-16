// v2.36.8 — import massif : un dossier que Box refuse de lister une première fois (fichiers à la demande) est relu, au lieu
// d'être compté comme vide. Dossier FICTIF dans un répertoire temporaire.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {APP_VERSION} from './js/config.js';
import {scanOperation} from './tools/import/lib/scan.mjs';
assert.equal(APP_VERSION,'2.36.8');
const cfg=JSON.parse(fs.readFileSync('./tools/import/import.config.json','utf8'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'et-scan-')); fs.mkdirSync(path.join(dir,'CCTP')); fs.writeFileSync(path.join(dir,'CCTP','CCTP Lot 1 fictif.pdf'),'x');
const real=fs.promises.readdir; let fails=1;
fs.promises.readdir=async(p,o)=>{ if(fails&&String(p).endsWith('CCTP')){ fails--; const e=new Error('Resource deadlock avoided'); e.code='EDEADLK'; throw e; } return real(p,o); };
try{
  const r=await scanOperation(dir,cfg);
  assert.equal(r.errors.length,0); assert.equal(r.files.length,1,'fichier lu après le 2e essai');
  // Dossier disparu : pas de nouvel essai, erreur immédiate.
  fs.rmSync(path.join(dir,'CCTP'),{recursive:true}); const t=Date.now(); const r2=await scanOperation(path.join(dir,'absent'),cfg);
  assert.equal(r2.errors[0].error,'ENOENT'); assert.ok(Date.now()-t<1000);
} finally { fs.promises.readdir=real; fs.rmSync(dir,{recursive:true,force:true}); }
console.log('test_v2_36_8 OK');
