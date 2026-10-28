import fs from 'node:fs';
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
assert.equal(APP_VERSION, '2.10.1');
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
assert.match(html,/id="manualFieldSearch"/);
for(const f of ['./js/app.js','./js/app.bundle.js']){
  const src=fs.readFileSync(new URL(f,import.meta.url),'utf8');
  assert.match(src,/function manualAnalysisSectionOf\(/);
  assert.match(src,/manualAnalysisState\.query/);
}
console.log('OK v2.4.1 recherche de champs');
