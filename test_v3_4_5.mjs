// v3.4.5 — « ré-extraire tout » une seule fois par demande : à la reprise, les fichiers déjà ré-extraits depuis la création
// de la demande (et inchangés) sont repris tels quels.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const w=fs.readFileSync('tools/import/watch.mjs','utf8'), imp=fs.readFileSync('tools/import/extracterre-import.mjs','utf8');
assert.match(w,/args\.push\('--reextraire-depuis',String\(r\.creeA\)\)/,'le service transmet la date de création');
const m=imp.match(/const reextraitDeja=(.+?);\n/); assert.ok(m,'règle présente');
assert.match(imp,/const force=\(!!args\.reextraire&&!reextraitDeja\)\|\|/);
const rule=new Function('args','old','f',`return ${m[1]};`);
const args={reextraire:true,'reextraire-depuis':'2026-11-23T11:00:21.417Z'}, f={size:10,mtimeMs:5};
assert.equal(rule(args,{processedAt:'2026-11-23T12:00:00.000Z',size:10,mtimeMs:5},f),true,'déjà ré-extrait dans la demande');
assert.equal(rule(args,{processedAt:'2026-11-20T12:00:00.000Z',size:10,mtimeMs:5},f),false,'extrait avant la demande : relu');
assert.equal(rule(args,{processedAt:'2026-11-23T12:00:00.000Z',size:11,mtimeMs:5},f),false,'modifié dans Box : relu');
assert.equal(rule(args,null,f),false,'nouveau fichier : lu');
assert.equal(rule({reextraire:true},{processedAt:'2026-11-23T12:00:00.000Z',size:10,mtimeMs:5},f),false,'sans date (ligne de commande) : comportement d’avant');
console.log('test_v3_4_5 : OK');
