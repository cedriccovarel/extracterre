// v2.33.2 — bâtiments fantômes (lignes de tableau, unités, adresses) : retirés ou ramenés à leur identifiant.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {repairBuildingName as r,tableRowBuildingId as t,BLD_READ} from './js/buildings.js';
const cases={'Bâtiment 3117.92':'','Bâtiment 0.66 0.80':'','Bâtiment I4 ≤ 0,60 M3/H.M².':'','Bâtiment B BP 30055 67061 VILLE':'','Bâtiment A 14 RUE FICTIVE':'',
  'Bâtiment 1 COLLECTIF 16 0.60 OUI':'Bâtiment 1','Bâtiment 3 6556.8 5464':'Bâtiment 3','Bâtiment A (1811,3 M²)':'Bâtiment A','Bâtiment A 1516':'Bâtiment A','Bâtiment 1 3300 2750':'Bâtiment 1',
  'Bâtiment SANS SOUS-SOL 0.50 X 0.50 -0.34':'','Bâtiment 1 -6.5 -36.9 -23.4':'Bâtiment 1',
  // gardés tels quels
  'Bâtiment LUISA LOTS 5 6':'Bâtiment LUISA LOTS 5 6','Bâtiment INDIVIDUELS T4 2 12 A 15':'Bâtiment INDIVIDUELS T4 2 12 A 15','Bâtiment A - HIBISCUS 00040':'Bâtiment A - HIBISCUS 00040',
  'Bâtiment A':'Bâtiment A','Bâtiment SUR RUE':'Bâtiment SUR RUE','Bâtiment B1.2':'Bâtiment B1.2','Bâtiment unique':'Bâtiment unique'};
for(const [k,v] of Object.entries(cases)) assert.equal(r(k),v,k);
assert.equal(t('1 3300 2750',{rowInts:true}),'1'); assert.equal(t('Luisa lots 5 6'),'Luisa lots 5 6');
assert.equal(BLD_READ,2);
const eng=fs.readFileSync('js/engine.js','utf8');
assert.match(eng,/if\(!d\.bldRead\)\{ d\.bldRead=1;/); // l'ancien filtre ne repasse pas sur les lectures déjà nettoyées
assert.match(eng,/if\(\(Number\(d\.bldRead\)\|\|0\)<BLD_READ\)\{ d\.bldRead=BLD_READ;/);
assert.equal(fs.readFileSync('VERSION','utf8').trim(),'2.33.2');
console.log('test_v2_33_2 ok');
