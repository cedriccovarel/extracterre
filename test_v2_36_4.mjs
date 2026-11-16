// v2.36.3 — DH (données FICTIVES) : groupe nommé « traversant » marqué Non au tableau CSTB → DH ZT ; « Groupe 1 483,4 °C.h » (Pléiades)
// lu 483,4 et non 1 483,4 ; rapprochement Salesforce souple (« MAISON I-01 » ↔ « MAISON 1-01 », « COLECTIF A », « C - BATIMENT ACCESSION »).
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {parseCstbRseeFiche} from './js/rset-cstb.js';
import {parsePleiadesThermalOutput} from './js/pleiades-sortie.js';
import {sfPerimeterMap} from './js/sf-perimeter.js';
assert.equal(APP_VERSION,'2.36.9');
const doc=(pages)=>{ const ps=pages.map((t,i)=>({page:i+1,text:t,lines:t.split('\n').map((text,index)=>({text,index,items:[]}))})); return {id:'d1',name:'RSET fictif.pdf',read:{pages:ps,text:pages.join('\n')}}; };
const occ=(d,page,line,field,value,method,confidence,unit,extra={})=>({field,value,method,confidence,unit,...extra});
// 1. Tableau DH CSTB
{ const head="Recapitulatif Standardise Energie Environnement\nPartie Etude thermique\nBatiment : Batiment A\nZone / Groupes Trav. SRef Indicateur";
  const out=parseCstbRseeFiche(doc([head+"\nZone(s) non traversante(s)\nBatiment A non\ntraversant /Non Non 681,5 181,1 154 78 29 Conforme\ntraversant\nBatiment A\ntraversant / Non 604,6 176,7 146 78 26 Conforme\nTraversant 1\nL'indicateur degres-heures (DH) permet"]),occ);
  const v=f=>out.filter(o=>o.field===f).map(o=>o.value);
  assert.deepEqual(v('dh_zt'),[176.7],'groupe nommé « traversant » marqué Non → ZT'); assert.deepEqual(v('dh_znt'),[181.1]);
  // « non » dans la suite du nom : reste ZNT ; sans mention « traversant » : le drapeau Trav. décide.
  const o2=parseCstbRseeFiche(doc([head+"\nZone(s) traversante(s)\nZone d'usage - Traversant / Non 925,4 857,4 284 216 171 Conforme\nGroupe d'usage n°1_Groupe CE1 non\nMIG 1 a 6 / Non 561,9 945,6 279 218 181 Conforme\nGroupe RT\nL'indicateur degres-heures (DH)"]),occ);
  // titre de section « Zone traversante » au-dessus d'un groupe « Z1 /G1 » marqué Non : pas un nom de groupe → ZNT.
  const o3=parseCstbRseeFiche(doc([head+"\nZone traversante\nZ1 /G1 Non 460,8 557,5 223 168 128 Conforme\nL'indicateur degres-heures (DH)"]),occ);
  assert.deepEqual([o3.filter(o=>o.field==='dh_zt').length,o3.find(o=>o.field==='dh_znt')?.value],[0,557.5]);
  assert.deepEqual(o2.filter(o=>o.field==='dh_zt').length,0); assert.deepEqual(o2.filter(o=>o.field==='dh_znt').map(o=>o.value),[945.6]); }
// 2. Sortie Pléiades : numéro de groupe collé au DH
{ const t=n=>`Pleiades, version 6.26\n1 Resultats RE2020 Energie\n.1 Batiment Est\nExigence de resultat : Degres-Heures\n${n}\nExigences de moyens`;
  const dh=s=>parsePleiadesThermalOutput(doc([t(s)]),occ).find(o=>o.field==='dh')?.value;
  assert.equal(dh('Groupe 1 483,4 °C.h 1250 °C.h'),483.4);
  assert.equal(dh('Non traversant A + CLIM 2 204,1 °C.h 1250 °C.h'),2204.1,'vraie valeur > DH max (groupe climatisé) gardée');
  assert.equal(dh('Logements traversants 1 012,5 °C.h 1250 °C.h'),1012.5); }
// 3. Périmètre Salesforce : écritures voisines, un seul candidat
{ const m=(s,d)=>sfPerimeterMap(s,d).map;
  assert.equal(m(['MAISON 1-01','MAISON 1-02'],['MAISON I-01'])['MAISON I-01'],'Bâtiment MAISON 1-01');
  assert.equal(m(['MAISON 01&02','MAISON 03&04'],['MAISONS 01 & 02'])['MAISONS 01 & 02'],'Bâtiment MAISON 01&02');
  assert.equal(m(['COLLECTIF A','COLLECTIF B'],['COLECTIF A'])['COLECTIF A'],'Bâtiment COLLECTIF A');
  const a=m(['C - BATIMENT ACCESSION'],['ACCESSION','SOCIAL','MAISONS SOCIALES']); assert.equal(a.ACCESSION,'Bâtiment C - BATIMENT ACCESSION'); assert.equal(a.SOCIAL,null);
  assert.equal(m(['A','B'],['B1'])['B1'],null,'B1 n’est pas B'); }
// 4. Rattrapage : lectures DH conservées d'un tableau CSTB refaites une fois ; une valeur validée reste.
{ const {catchUpDocument}=await import('./js/engine.js'); const {DOC_TYPES}=await import('./js/config.js');
  const head="Recapitulatif Standardise Energie Environnement\nPartie Etude thermique\nBatiment : Batiment A\nZone / Groupes Trav. SRef Indicateur";
  const d={...doc([head+"\nZone(s) non traversante(s)\nBatiment A\ntraversant / Non 604,6 176,7 146 78 26 Conforme\nTraversant 1\nL'indicateur degres-heures (DH)"]),type:DOC_TYPES.RSEE_RE2020,status:'ready',rsetAddressRead:true,dhZonesRead:true,fanRead:2,bldRead:3,
    cachedOccurrences:[{field:'dh_znt',value:176.7,method:'cstb:dh-worst-group',building:'Bâtiment A'},{field:'bbio',value:50,method:'cstb:bbio'}]};
  catchUpDocument(d,{}); assert.equal(d.dhRead,2); assert.ok(d.cachedOccurrences.some(o=>o.field==='dh_zt'&&o.value===176.7)); assert.ok(!d.cachedOccurrences.some(o=>o.field==='dh_znt'));
  assert.ok(d.cachedOccurrences.some(o=>o.field==='bbio'),'autres lectures gardées'); assert.ok(d.needsCheckpoint);
  const v={...d,dhRead:0,cachedOccurrences:[{field:'dh_znt',value:176.7,method:'cstb:dh-worst-group',userValidated:true}]}; catchUpDocument(v,{}); assert.equal(v.cachedOccurrences.filter(o=>o.field==='dh_znt'&&o.userValidated).length,1); }
// 5. DH sans type de zone d'une maison individuelle → DH ZT ; d'un collectif → DH ZNT.
{ const {applyComparisonBases}=await import('./js/engine.js'); const f=(building,field,value)=>({building,field,value,method:'pleiades-sortie:dh-worst-group',docId:'d1',fileName:'Sortie fictive.pdf'});
  const r={rows:[{building:'Bâtiment MAISONS',dh:483.4},{building:'Bâtiment COLLECTIF',dh:600}],finals:[f('Bâtiment MAISONS','dh',483.4),f('Bâtiment COLLECTIF','dh',600)]};
  applyComparisonBases(r); assert.deepEqual([r.rows[0].dh_zt,r.rows[0].dh_znt],[483.4,undefined]); assert.deepEqual([r.rows[1].dh_zt,r.rows[1].dh_znt],[undefined,600]); }
// 6. Import : plan lu comme plan accepté quel que soit le sous-dossier ; lecture complète seule retenue ; contradiction réelle toujours à vérifier.
{ const fs=await import('node:fs'); const {classifyImportFile}=await import('./js/import-rules.js'); const {classifyDocument}=await import('./js/classifier.js');
  const cfg=JSON.parse(fs.readFileSync(new URL('./tools/import/import.config.json',import.meta.url),'utf8'));
  const pl=classifyImportFile({family:'thermique',name:'PC 3.pdf',appType:'Plan architectural'},classifyDocument,cfg); assert.equal(pl.status,'à traiter'); assert.equal(pl.type,'Plan architectural');
  const al=classifyImportFile({family:'carbone',name:'doc.pdf',text:'xx',appType:'Tableau de surfaces'},classifyDocument,cfg); assert.equal(al.status,'à traiter'); assert.match(al.note,/lu comme Tableau de surfaces/);
  const ct=classifyImportFile({family:'thermique',name:'Note.pdf',text:'CAHIER DES CLAUSES TECHNIQUES PARTICULIERES\nLot 02',appType:'Permis / pièce administrative'},classifyDocument,cfg); assert.equal(ct.status,'à vérifier');
  // FDES configurée (BETie) : reconnue à la structure XML.
  const {probeXml}=await import('./tools/import/lib/extract.mjs'); const os=await import('node:os'); const pth=await import('node:path');
  const f=pth.join(fs.mkdtempSync(pth.join(os.tmpdir(),'xt-')),'fiche.xml'); fs.writeFileSync(f,'<?xml version="1.0"?><EPDC><EPDCId>X</EPDCId><Name>Béton fictif</Name><ConfiguratorName>Betie</ConfiguratorName></EPDC>');
  const x=await probeXml(f); assert.equal(x.other,'epdc'); assert.equal(x.configurator,'Betie'); }
// 7. Climatisation active : Oui seulement pour un vrai système de froid ; sinon case vide (jamais de valeur inventée).
{ const {applyComparisonBases}=await import('./js/engine.js'); const f=(b,v)=>({building:b,field:'cooling',value:v,method:'systems:cooling-context',docId:'d1',fileName:'CCTP fictif.pdf'});
  const vals=['Ventouse ou conduit','Poêle','Split / multisplit','Aucun','PAC réversible','Chauffage électrique direct'];
  const r={rows:vals.map((v,i)=>({building:'Bâtiment '+i,cooling:v})),finals:vals.map((v,i)=>f('Bâtiment '+i,v))}; applyComparisonBases(r);
  assert.deepEqual(r.rows.map(x=>x.cooling_active),[undefined,undefined,'Oui','Non','Oui',undefined]); }
// 8. DH lu avant la v2.36.1 (« Liaison ME/DH garage 0,290 ») : relu une fois, la fausse valeur disparaît.
{ const {catchUpDocument}=await import('./js/engine.js'); const {DOC_TYPES}=await import('./js/config.js');
  const d={...doc(["Ponts thermiques\nLiaison ME/DH garage 0,290 0,95"]),type:DOC_TYPES.RSET_RE2020,status:'ready',rsetAddressRead:true,dhZonesRead:true,fanRead:2,bldRead:3,dhRead:1,
    cachedOccurrences:[{field:'dh',value:0.29,method:'rset:dh-explicit',building:'Bâtiment unique'}]};
  catchUpDocument(d,{}); assert.ok(!d.cachedOccurrences.some(o=>o.field==='dh'&&o.value===0.29)); }
console.log('test_v2_36_4 OK');
