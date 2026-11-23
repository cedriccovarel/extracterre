// v2.36.3 — Logement traversant / non traversant déduit d'un DH ZT / ZNT lu .
// (Détail carbone du RSET calculé une fois par page : vérifié sur un vrai dossier, 30 min → 7 s.)
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {applyComparisonBases} from './js/engine.js';
import {cstbBuildingNames} from './js/rset-cstb.js';
assert.equal(APP_VERSION,'3.4.2');
const fin=(building,field,value,method)=>({building,field,value,method,docId:'d1',fileName:'RSET fictif.pdf'});
const res={rows:[{building:'Bâtiment A',dh_zt:420.5,dh_znt:610},{building:'Bâtiment B',dh:700},{building:'Bâtiment C',dh_zt:380,cross_ventilated:'Non'}],
  finals:[fin('Bâtiment A','dh_zt',420.5,'cstb:dh-worst-group'),fin('Bâtiment A','dh_znt',610,'cstb:dh-worst-group'),fin('Bâtiment B','dh',700,'generic:regulatory-label'),fin('Bâtiment C','dh_zt',380,'cstb:dh-worst-group'),fin('Bâtiment C','cross_ventilated','Non','saisie')]};
applyComparisonBases(res);
const [a,b,c]=res.rows;
assert.equal(a.cross_ventilated,'Oui'); assert.equal(a.non_cross_ventilated,'Oui');
assert.equal(b.dh_znt,700); assert.equal(b.non_cross_ventilated,undefined); // DH sans zone reporté en ZNT : n'atteste pas des logements non traversants
assert.equal(b.cross_ventilated,undefined);
assert.equal(c.cross_ventilated,'Non'); // une valeur déjà présente est gardée
// Fiche RSEE CSTB : l'indice ₂ de CO₂ glissé en fin de ligne ne crée pas de « Bâtiment 12 » ; un vrai bâtiment 12 reste lu.
{ const doc=t=>({read:{pages:[{page:1,text:t,lines:t.split('\n').map((text,index)=>({text,index,items:[]}))}]}});
  assert.deepEqual(cstbBuildingNames(doc("Indicateurs principaux, à l'échelle du bâtiment 1\nIndicateur dynamique CO , à l'échelle du bâtiment 12")),['Batiment 1']);
  assert.deepEqual(cstbBuildingNames(doc("Indicateurs principaux, à l'échelle du bâtiment 12\nIndicateur dynamique CO , à l'échelle du bâtiment 122")),['Batiment 12']);
  assert.deepEqual(cstbBuildingNames(doc("Indicateur dynamique CO2, à l'échelle du bâtiment 2")),['Batiment 2']); }
// Salesforce prime, mais la valeur du document le plus récent reste visible au survol quand elles diffèrent.
{ const fs=await import('node:fs'); const app=fs.readFileSync(new URL('./js/app.js',import.meta.url),'utf8');
  assert.match(app,/SF_SRC\.test\(manual\.fileName\)&&sfDocDiffers\(field,value,docFinal\.value\)\) Object\.assign\(manual,\{documentValue:docFinal\.value/);
  assert.match(app,/title="\$\{escapeHtml\(\[sfDiffTip\(o\),/);
  const {sameValue}=await import('./js/qualite.js'); assert.equal(sameValue('dh_zt',572,572.04),true);
  assert.match(app,/Math\.abs\(x-y\)>0\.051/); } // 916,8 ≠ 916,6 au survol (le banc, lui, tolère 0,1 %)
// Géolocalisation : une adresse hors du département du dossier Box est refusée (la commune du dossier prend le relais).
{ const {geoDepOf}=await import('./js/geocode.js'); assert.equal(geoDepOf('13103'),'13'); assert.equal(geoDepOf('2B033'),'20'); assert.equal(geoDepOf('20'),'20'); assert.equal(geoDepOf('97411'),'974'); assert.equal(geoDepOf(''),'');
  const fs=await import('node:fs'); assert.match(fs.readFileSync(new URL('./js/app.js',import.meta.url),'utf8'),/gd!==geoDepOf\(fd\)/); }
console.log('test_v2_36_3 ok');
