import fs from 'node:fs';
import assert from 'node:assert/strict';
const app=fs.readFileSync(new URL('./js/app.js',import.meta.url),'utf8');
const bundle=fs.readFileSync(new URL('./js/app.bundle.js',import.meta.url),'utf8');
for(const src of [app,bundle]){
  assert.match(src,/general:\{label:'Généralités',families:new Set\(\['Administration','Programme','Certification & exigences'\]\)\}/);
  assert.match(src,/section:'general'/);
  assert.match(src,/MANUAL_ANALYSIS_SECTIONS\.general/);
}
console.log('OK v2.2.10 general manual analysis tab');
