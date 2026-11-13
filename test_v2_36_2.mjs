// v2.36.2 — tableau DH du RSET : chaque DH dans sa colonne (ZT / ZNT), nombres à milliers séparés par une espace.
import assert from 'node:assert/strict';
import {cs_dhRow} from './js/rset-cstb.js';
import {APP_VERSION} from './js/config.js';
assert.equal(APP_VERSION,'2.36.2');
assert.deepEqual(cs_dhRow('2 070 1 115,7 726 415 228'),[2070,1115.7,726,415,228]);
assert.deepEqual(cs_dhRow('3 261 666,8 452 274 125'),[3261,666.8,452,274,125]);
assert.deepEqual(cs_dhRow('1 421,3 630,4 229 183 140'),[1421.3,630.4,229,183,140]);
assert.deepEqual(cs_dhRow('186 1 128,5 700 442 212'),[186,1128.5,700,442,212]);
assert.deepEqual(cs_dhRow('100,1 613,5 217 173 134'),[100.1,613.5,217,173,134]);
assert.equal(cs_dhRow('6558 406,8 192 12 97'),null); // OCR douteux : le lecteur repasse au découpage simple
console.log('test_v2_36_2 ok');
