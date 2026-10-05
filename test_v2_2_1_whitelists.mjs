import assert from 'node:assert/strict';
import {parseDocument} from './js/parsers.js';
import {DOC_TYPES,APP_VERSION} from './js/config.js';

function doc(family,type,text){
  const lines=text.split('\n').map((text,index)=>({text,index}));
  return {id:`test-${family}`,name:`${family}.pdf`,type,specializedFamily:family,read:{kind:'pdf',text,pages:[{page:1,text,lines}]},buildings:{names:['Bâtiment A'],hits:[]}};
}
function fields(d){ return new Set(parseDocument(d).map(o=>o.field)); }
assert.equal(APP_VERSION,'2.2.8');

let f=fields(doc('rsenv',DOC_TYPES.RSENV,'Bâtiment: A\nDH: 900\nBbio: 50\nCep: 70\nIC chantier: 20\nIC énergie: 100'));
assert(!f.has('dh'),'RSENV ne doit jamais produire DH');
assert(!f.has('bbio'),'RSENV ne doit jamais produire Bbio');
assert(!f.has('cep'),'RSENV ne doit jamais produire Cep');

f=fields(doc('rset',DOC_TYPES.RSET_RE2020,'Bâtiment: A\nDH: 900\nTic: 25\nIC chantier: 20\nBbio: 50'));
assert(!f.has('tic'),'RSET RE2020 ne doit jamais produire Tic');
assert(!f.has('ic_site'),'RSET RE2020 ne doit jamais produire IC chantier');

f=fields(doc('rt2012',DOC_TYPES.RT2012,'Bâtiment: A\nDH: 900\nCepnr: 55\nTic: 27\nBbio: 50'));
assert(!f.has('dh'),'RSET RT2012 ne doit jamais produire DH');
assert(!f.has('cepnr'),'RSET RT2012 ne doit jamais produire Cepnr');

f=fields(doc('cctp',DOC_TYPES.CCTP,'Bâtiment: A\nBbio: 50\nDH: 900\nVentilation: VMC hygro B'));
assert(!f.has('bbio'),'CCTP ne doit jamais produire Bbio');
assert(!f.has('dh'),'CCTP ne doit jamais produire DH');

f=fields(doc('dpgf',DOC_TYPES.DPGF,'Bbio: 50\nCep: 70\nIC chantier: 20'));
assert(!f.has('bbio')&&!f.has('cep')&&!f.has('ic_site'),'DPGF ne doit pas produire d’indicateurs réglementaires');

f=fields(doc('dpe',DOC_TYPES.DPE,'Bbio: 50\nDH: 900\nIC chantier: 20'));
assert(!f.has('bbio')&&!f.has('dh')&&!f.has('ic_site'),'DPE ne doit pas produire Bbio, DH ou IC');

f=fields(doc('acv',DOC_TYPES.CARBON,'Bbio: 50\nDH: 900\nIC chantier: 20'));
assert(!f.has('bbio')&&!f.has('dh'),'Analyse ACV ne doit pas produire Bbio ou DH');

console.log('OK v2.2.3 — listes blanches spécialisées');
