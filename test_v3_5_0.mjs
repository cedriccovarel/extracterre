// v3.5.0 — DH : jamais lu dans un RSEE ni un XML ; une étude thermique RT2012 / RT existant / E+C- n'a pas de DH.
import assert from 'node:assert/strict';
const {DOC_TYPES,DEFAULT_SOURCE_RULES}=await import('./js/config.js');
const {analyzeDocuments,dhSourceAllowed}=await import('./js/engine.js');
const T=DOC_TYPES;
const doc=(id,type,name,text)=>({id,name,type,read:{kind:/\.xml$/.test(name)?'xml':'pdf',text,pages:[{page:1,text}]},buildings:{names:['Bâtiment unique']},
  cachedOccurrences:[{field:'dh_znt',value:420,building:'Bâtiment unique',docId:id,fileName:name,docType:type,page:1,excerpt:'DH 420',confidence:.95,method:'test'},
                     {field:'bbio',value:55,building:'Bâtiment unique',docId:id,fileName:name,docType:type,page:1,excerpt:'Bbio 55',confidence:.95,method:'test'}]});
const dhOf=docs=>analyzeDocuments(docs,structuredClone(DEFAULT_SOURCE_RULES),'Test DH').finals.filter(o=>o.field==='dh_znt'&&o.value!=null&&o.value!=='');
const bbioOf=docs=>analyzeDocuments(docs,structuredClone(DEFAULT_SOURCE_RULES),'Test DH').finals.filter(o=>o.field==='bbio'&&o.value!=null&&o.value!=='');
// Refusés
for(const [d,why] of [
  [doc('a',T.RSEE_RE2020,'RSEE.pdf','RE2020 RSEE DH 420'),'RSEE'],
  [doc('b',T.RSET_RE2020,'RSET.xml','<RSET>'),'XML'],
  [doc('c',T.RT2012,'RT2012.pdf','RT 2012'),'étude RT2012'],
  [doc('d',T.RT_EXISTING,'RTex.pdf','RT existant'),'RT existant'],
  [doc('e',T.THERMAL,'Etude.pdf','Étude thermique réglementaire RT 2012 Bbio Cep'),'étude thermique RT2012'],
  [doc('f',T.THERMAL,'Etude.pdf','Étude thermique Label E+C- niveau E2C1'),'étude thermique E+C-'],
]){ assert.equal(dhSourceAllowed(d),false,why); assert.equal(dhOf([d]).length,0,`pas de DH : ${why}`); }
// Acceptés
for(const [d,why] of [
  [doc('g',T.RSET_RE2020,'RSET.pdf','RSET RE2020'),'RSET PDF'],
  [doc('h',T.THERMAL,'Etude.pdf','Étude thermique RE2020 (seuils RT 2012 rappelés)'),'étude thermique RE2020'],
]){ assert.equal(dhSourceAllowed(d),true,why); assert.equal(dhOf([d]).length,1,`DH lu : ${why}`); }
// Règle de source
assert.ok(!DEFAULT_SOURCE_RULES.dh.main.includes(T.RSEE_RE2020)); assert.ok(DEFAULT_SOURCE_RULES.dh.forbidden.includes(T.RSEE_RE2020));
console.log('test_v3_5_0 : OK');
