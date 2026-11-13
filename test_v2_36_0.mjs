// v2.36.0 — dossiers de fichiers périmés (« OLD », « Ancien », « Archives »…) jamais lus ; version d'étude = fichier le
// plus récemment ajouté dans le dossier (données fictives).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {isObsoleteFolder,obsoleteFolderOf} from './js/import-rules.js';
import {ENGINE_OPTIONS} from './js/engine.js';
import {boxGroupOf} from './js/box-folder.js';
import {scanOperation} from './tools/import/lib/scan.mjs';
for(const n of ['OLD','Old','old','_OLD','Ancien','ANC','Anciennes versions','Ancien CCTP','RENO 6 LGTS old','Archives','Archivé','00 - Obsolète','Périmés','Caduc','Version précédente','Ne pas utiliser','z_old 2024'])
  assert.ok(isObsoleteFolder(n),n);
for(const n of ['2. Ancienne Mairie','Bâtiment ancien collège','Hors périmètre de certification','Version 4','Version 3.1','CCTP','Étude thermique','Gold','14 11 25','Etat existant'])
  assert.ok(!isObsoleteFolder(n),n);
assert.equal(obsoleteFolderOf('Évaluation/Étude thermique/OLD/2024'),'OLD');
assert.equal(obsoleteFolderOf('Évaluation/2. Ancienne Mairie/CCTP'),null);
assert.equal(boxGroupOf('Op/Évaluation/Étude Thermique/Anciennes versions/a.pdf').archived,true);
assert.equal(boxGroupOf('Op/Évaluation/CCTP/2. Ancienne Mairie/a.pdf').archived,false);
assert.equal(ENGINE_OPTIONS.versionByFileDate,true);
// Import massif : fichiers d'un dossier périmé listés comme ignorés, avec le motif
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'xt-old-'));
try{
  const cfg=JSON.parse(fs.readFileSync('tools/import/import.config.json','utf8'));
  fs.mkdirSync(path.join(tmp,'Evaluation','Etude thermique','OLD'),{recursive:true});
  fs.writeFileSync(path.join(tmp,'Evaluation','Etude thermique','RSET.pdf'),'x');
  fs.writeFileSync(path.join(tmp,'Evaluation','Etude thermique','OLD','RSET v1.pdf'),'x');
  const {files}=await scanOperation(tmp,cfg);
  const r=Object.fromEntries(files.map(f=>[f.name,f.ignoreReason]));
  assert.equal(r['RSET.pdf'],null);
  assert.match(r['RSET v1.pdf'],/périmés.*OLD/);
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
console.log('test_v2_36_0 ok');
