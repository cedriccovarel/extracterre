// v2.32.2 — les fichiers nommés FDES ne sont jamais importés (import massif et « Charger depuis Box »).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isFdesName,fileIgnoreReason} from './js/import-rules.js';
const cfg={readableExtensions:['pdf','xml','xlsx']};
for(const n of ['FDES.pdf','fdes_isolant.pdf','FDES-Laine de verre.pdf','Fiche FDES ITE.pdf','01_FDES2.pdf']){ assert.ok(isFdesName(n),n); assert.match(fileIgnoreReason(n,cfg),/FDES/); }
for(const n of ['CCTP lot 02.pdf','FDESIGN.pdf','RSET.xml','Etude thermique.pdf']) assert.equal(isFdesName(n),false,n);
assert.match(fs.readFileSync('js/box-folder.js','utf8'),/isFdesName\(name\)\) continue/);
assert.equal(fs.readFileSync('VERSION','utf8').trim(),'2.33.0');
console.log('test_v2_32_2 ok');
