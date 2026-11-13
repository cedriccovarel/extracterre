// v2.35.0 — fiabilité : rapprochement des bâtiments Salesforce ↔ documents, fiches Salesforce sans faux bâtiments,
// occultations précises, recoupement mesuré au banc (données fictives).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sfPerimeterMap} from './js/sf-perimeter.js';
import {parseFreePaste,freePasteValues} from './js/collage-libre.js';
import {recoupement} from './js/qualite.js';
import {ENGINE_OPTIONS} from './js/engine.js';
const m=(S,D)=>sfPerimeterMap(S,D).map;
// 1. Même bâtiment, nom plus ou moins détaillé
assert.deepEqual(m(['BASSON I - 40 LGTS','BASSON II - 40 LGTS'],['Bâtiment BASSON I','Bâtiment BASSON II']),{'Bâtiment BASSON I':'Bâtiment BASSON I - 40 LGTS','Bâtiment BASSON II':'Bâtiment BASSON II - 40 LGTS'});
assert.equal(m(['BEG-1/2','BEG-3 A 7'],['BEG-3-7'])['BEG-3-7'],'Bâtiment BEG-3 A 7');
assert.equal(m(['LOGEMENT 5 - 1 LOT (T3)','LOGEMENT 6 (T3) ET 7 (T4) - 2 LOTS'],['LOGEMENT 5'])['LOGEMENT 5'],'Bâtiment LOGEMENT 5 - 1 LOT (T3)');
assert.equal(m(['EHPAD'],['EHPAD SAINTE-MONIQUE RENOVE'])['EHPAD SAINTE-MONIQUE RENOVE'],'Bâtiment EHPAD');
// un seul bâtiment Salesforce : noms courts rattachés ; une liste jamais
assert.deepEqual(m(['24 LOGEMENTS'],['N 1','1']),{'N 1':'Bâtiment 24 LOGEMENTS','1':'Bâtiment 24 LOGEMENTS'});
assert.equal(m(['LOGEMENT 6 ET 7'],['LOGEMENTS 6 ET 7','LOGEMENT 5'])['LOGEMENTS 6 ET 7'],null);
assert.deepEqual(m(['BAT A','BAT B'],['Bâtiment A et B','Bâtiment Logements']),{'Bâtiment A et B':null,'Bâtiment Logements':null});
// 2. Fiche Salesforce : « DH conforme », « RSEE- RSET du 14/11/2025 » ne sont pas des bâtiments
const v=freePasteValues(parseFreePaste('BAT A :\nBbio = 50\nDH conforme :\nDH = 400\nRSEE- RSET du 14/11/2025 :\nCep = 60\nBAT B :\nBbio = 61'));
assert.deepEqual(v.map(x=>x.building).filter(Boolean),['Bâtiment A','Bâtiment B']);
assert.equal(v.find(x=>x.building==='Bâtiment A').values.dh,400,'les lignes restent dans le bloc courant');
// 3. Occultations : type précis du CCTP préféré à la catégorie RSET
assert.match(fs.readFileSync('js/engine.js','utf8'),/f\.key==='window_shading'&&/);
// 4. Recoupement disponible pour le banc, non activé dans l'appli tant qu'il ne prouve pas un gain ; version par date
//    de fichier désactivée (banc : gain nul), en attente de la date d'évaluation
assert.equal(typeof recoupement,'function'); assert.ok(!/recoupement\(/.test(fs.readFileSync('js/app.js','utf8')));
assert.equal(typeof ENGINE_OPTIONS.versionByFileDate,'boolean'); // v2.36.0 : activée (règle métier)
const cal=JSON.parse(fs.readFileSync('data/fiabilite-calibration.json','utf8')); assert.ok(cal.cands&&cal.pairs);
assert.equal(fs.readFileSync('VERSION','utf8').trim(),'2.36.0');
console.log('test_v2_35_0 ok');
