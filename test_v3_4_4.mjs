// v3.4.4 — import : lectures OCR en parallèle configurables (parallelismeOcr), service en priorité basse.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const R=await import('./js/readers.js');
assert.equal(R.setOcrConcurrencyLimit(6),6,'6 lectures OCR possibles');
assert.equal(R.setOcrConcurrencyLimit(20),8,'plafond 8');
const {MAX_OCR_WORKERS}=await import('./js/config.js');
assert.equal(R.setOcrConcurrencyLimit(0),MAX_OCR_WORKERS,'défaut de l’appli inchangé');
assert.equal(R.setOcrConcurrencyLimit(1),1);
const cfg=JSON.parse(fs.readFileSync('tools/import/import.config.json','utf8'));
assert.equal(cfg.parallelismeOcr,6); assert.equal(cfg.parallelisme,6);
assert.match(fs.readFileSync('tools/import/extracterre-import.mjs','utf8'),/enableOcr\?\.\(cfg\.parallelismeOcr\?\?2\)/);
assert.match(fs.readFileSync('tools/import/lib/runtime.mjs','utf8'),/setOcrConcurrencyLimit\?\.\(Number\(parallel\)\|\|2\)/);
assert.match(fs.readFileSync('tools/import/installer-service.mjs','utf8'),/<key>Nice<\/key><integer>10<\/integer>/);
console.log('test_v3_4_4 : OK');
