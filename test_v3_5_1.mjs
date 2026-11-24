// v3.5.1 — « Degrés-Heures Groupe 2 473,6 °C.h » : DH 473,6 (pas 2 473,6), à la lecture et au recalcul. Données FICTIVES.
import assert from 'node:assert/strict';
const {DOC_TYPES:T,DEFAULT_SOURCE_RULES}=await import('./js/config.js');
const {analyzeDocuments,fixDhGroupValue}=await import('./js/engine.js');
const {parseDocument}=await import('./js/parsers.js');
const lines=['Projet Max','Degres-Heures Groupe 2 473,6 °C.h 1250 °C.h','Degres-Heures Groupe 4 595,6 °C.h 1250 °C.h'];
const text=lines.join('\n');
const doc={id:'r',name:'RSET fictif.pdf',type:T.RSET_RE2020,status:'ready',buildings:{names:['Bâtiment unique']},read:{kind:'pdf',text,pages:[{page:1,text,lines:lines.map((t,index)=>({index,text:t}))}]}};
const dh=parseDocument(doc).filter(o=>/^dh(_z?n?t)?$/.test(o.field)).map(o=>o.value);
assert.ok(dh.includes(473.6)&&dh.includes(595.6),'lecture : '+dh.join(', '));
assert.ok(!dh.includes(2473.6)&&!dh.includes(4595.6),'pas de 2 473,6 : '+dh.join(', '));
// Rattrapage d'une lecture enregistrée (recalcul)
const old={field:'dh',value:2473.6,excerpt:'Degres-Heures Groupe 2 473,6 °C.h 1250 °C.h',confidence:.98};
assert.equal(fixDhGroupValue(old).value,473.6);
assert.equal(fixDhGroupValue({...old,value:473.6}).value,473.6,'déjà juste : inchangé');
assert.equal(fixDhGroupValue({...old,field:'dh_max',value:1250}).value,1250,'seuil : inchangé');
assert.equal(fixDhGroupValue({field:'dh',value:1473.6,excerpt:'DH 1 473,6'}).value,1473.6,'sans « Groupe » : inchangé');
const cached={...doc,cachedOccurrences:[{...old,field:'dh_znt',building:'Bâtiment unique',docId:'r',fileName:doc.name,docType:T.RSET_RE2020,page:1,method:'t'}]};
const f=analyzeDocuments([cached],structuredClone(DEFAULT_SOURCE_RULES),'t').finals.find(o=>o.field==='dh_znt');
assert.equal(f?.value,473.6,'recalcul : '+f?.value);
console.log('test_v3_5_1 : OK');
