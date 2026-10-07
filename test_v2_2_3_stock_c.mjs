import assert from 'node:assert/strict';
import {parseDocument} from './js/parsers.js';
import {DOC_TYPES,FIELD_DEFS,APP_VERSION} from './js/config.js';
import {detectBuildings} from './js/buildings.js';

function mk(text){
  const chunks=text.split('\f');
  const pages=chunks.map((t,pi)=>({page:pi+1,text:t,lines:t.split('\n').map((text,index)=>({text,index}))}));
  const doc={id:'acv-stock-c',name:'LOT 1 - Résultats ACV.pdf',type:DOC_TYPES.CARBON,specializedFamily:'acv',read:{kind:'pdf',text:chunks.join('\n'),pages},buildings:{names:[],hits:[]}};
  doc.buildings=detectBuildings(doc); return doc;
}
assert.equal(APP_VERSION,'2.3.10');
assert.equal(FIELD_DEFS.length,173);
const text=[
'1. Bâtiment A\nStockage carbone Stock,C 39068.7 kgC\nTotal hors parcelle Ic,bâtiment 715.9 Stockage carbone Stock,C (par m²) 50.4 kgC/m²',
'2. Bâtiment B - 1\nStockage carbone Stock,C 24239.9 kgC\nTotal hors parcelle Ic,bâtiment 717.9 Stockage carbone Stock,C (par m²) 80.5 kgC/m²',
'3. Bâtiment B - 2\nStockage carbone Stock,C 13906.7 kgC\nTotal hors parcelle Ic,bâtiment 706.0 Stockage carbone Stock,C (par m²) 77.0 kgC/m²',
'4. Bâtiment C\nStockage carbone Stock,C 43913.6 kgC\nTotal hors parcelle Ic,bâtiment 721.0 Stockage carbone Stock,C (par m²) 55.1 kgC/m²'
].join('\f');
const parsed=mk(text);
const out=parseDocument(parsed).filter(o=>o.field==='stock_c_per_m2');
assert.deepEqual(parsed.buildings.names,['Bâtiment A','Bâtiment B - 1','Bâtiment B - 2','Bâtiment C']);
assert.equal(out.length,4,'une valeur Stock C/m² par bâtiment');
assert.deepEqual(out.map(o=>o.building),['Bâtiment A','Bâtiment B - 1','Bâtiment B - 2','Bâtiment C']);
assert.deepEqual(out.map(o=>o.value),[50.4,80.5,77.0,55.1]);
assert(out.every(o=>o.unit==='kgC/m²'));
assert(out.every(o=>o.method==='acv:stock-c-per-m2-seed-v1'));
assert(!out.some(o=>o.value>1000),'le Stock,C total en kgC ne doit jamais être pris');
console.log('v2.2.4 Stock C/m²: OK');
