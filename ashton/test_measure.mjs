// node test_measure.mjs — géométrie, étalonnage, extraction des tracés, accroche. Données fictives.
import assert from 'node:assert/strict';
import {dist,pathLength,polygonArea,centroid,scaleFromCalibration,paperRatio,parseLength,ortho,extractGeometry,SnapIndex} from './measure.js';
let n=0; const ok=(c,m)=>{ assert.ok(c,m); n++; }, near=(a,b,m,e=1e-6)=>ok(Math.abs(a-b)<e,`${m} : ${a} ≠ ${b}`);

near(dist({x:0,y:0},{x:3,y:4}),5,'distance');
near(pathLength([{x:0,y:0},{x:3,y:4},{x:3,y:10}]),11,'polyligne');
const sq=[{x:0,y:0},{x:10,y:0},{x:10,y:20},{x:0,y:20}];
near(polygonArea(sq),200,'surface rectangle'); near(pathLength(sq,true),60,'périmètre');
near(polygonArea([{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:2,y:2},{x:0,y:4}]),12,'surface concave');
ok(JSON.stringify(centroid(sq))==='{"x":5,"y":10}','centre');

// Étalonnage : 283,46 pt mesurés = 10 m → 1 cm papier = 1 m, soit 1:100.
const k=scaleFromCalibration({x:0,y:0},{x:283.4645669,y:0},10); near(paperRatio(k),100,'échelle 1:100',1e-3);
near(polygonArea(sq)*k*k,200*k*k,'surface en m²'); ok(scaleFromCalibration({x:1,y:1},{x:1,y:1},5)===null,'étalon nul refusé');
near(parseLength('12,5'),12.5,'virgule'); near(parseLength('1250 cm'),12.5,'cm'); near(parseLength('12 500 mm'),12.5,'mm'); near(parseLength('3.2m'),3.2,'m');
ok(parseLength('abc')===null&&parseLength('0')===null&&parseLength('-2')===null,'longueurs invalides');
const o=ortho({x:0,y:0},{x:10,y:1}); near(o.y,0,'ortho horizontal'); near(o.x,Math.hypot(10,1),'ortho conserve la longueur');

// Extraction : un rectangle déplacé par une transformation, un trait dupliqué, un save/restore.
const OPS={save:10,restore:11,transform:12,constructPath:91,moveTo:13,lineTo:14,curveTo:15,curveTo2:16,curveTo3:17,closePath:18,rectangle:19,stroke:20,closeStroke:21,fill:22,eoFill:23,fillStroke:24,eoFillStroke:25,closeFillStroke:26,closeEOFillStroke:27,endPath:28,setStrokeRGBColor:58,setFillRGBColor:59,setStrokeGray:56,setFillGray:57,paintFormXObjectBegin:74,paintFormXObjectEnd:75};
const vt=[1,0,0,-1,0,100]; // page de 100 pt de haut, y retourné
const g=extractGeometry(
  [OPS.save,OPS.transform,OPS.constructPath,OPS.stroke,OPS.restore,OPS.constructPath,OPS.stroke,OPS.constructPath,OPS.stroke,
   OPS.constructPath,OPS.endPath,OPS.setFillRGBColor,OPS.constructPath,OPS.fill],
  [null,[1,0,0,1,50,0],[[OPS.rectangle],[0,0,10,10]],null,null,[[OPS.moveTo,OPS.lineTo],[0,0,20,0]],null,[[OPS.moveTo,OPS.lineTo],[20,0,0,0]],null,
   [[OPS.rectangle],[0,0,100,100]],null,[255,255,255],[[OPS.rectangle],[5,5,30,30]],null],OPS,vt); // découpe et blanc ignorés
ok(g.points.length/2===6,`6 sommets uniques (${g.points.length/2})`); ok(g.segments.length/4===5,`5 segments uniques (${g.segments.length/4})`);
ok([...g.points].join(',').startsWith('50,100,60,100,60,90,50,90'),'rectangle transformé, y vers le bas');

const idx=new SnapIndex(g);
const v=idx.query(59,91,3); ok(v&&v.kind==='vertex'&&v.x===60&&v.y===90,'accroche au sommet');
const e=idx.query(10,99,3); ok(e&&e.kind==='edge'&&Math.abs(e.x-10)<1e-6&&e.y===100,'accroche sur le segment');
ok(idx.query(30,50,3)===null,'rien à accrocher loin du dessin');
console.log(`Ashton géométrie : ${n}/${n} OK`);

// Étiquettes et tableau de surfaces.
const {parseLabelText,summarize,isDwelling}=await import('./measure.js');
const room=parseLabelText('Chambre 2 14.26 m²'); ok(room.cat==='Chambre'&&room.surface===14.26&&room.name==='Chambre 2'&&room.typo==='','étiquette de pièce');
const lgt=parseLabelText('Logement 3 - T3 - 65,2 m2'); ok(lgt.cat==='Logement'&&lgt.typo==='T3'&&lgt.surface===65.2,'étiquette de logement');
ok(parseLabelText('Dgt 3.35 m²').cat==='Dégagement','abréviation Dgt');
ok(parseLabelText('T4 bis').typo==='T4 bis'&&parseLabelText('T4 bis').cat==='Logement','typologie seule');
const K=0.0352778; // 1:100
const ms=[
  {type:'label',page:1,pts:[{x:0,y:0}],name:'Lgt 1',cat:'Logement',typo:'T3',surface:60},
  {type:'label',page:1,pts:[{x:0,y:0}],name:'Lgt 2',cat:'',typo:'T3',surface:70},
  {type:'label',page:1,pts:[{x:0,y:0}],name:'Lgt 3',cat:'Logement',typo:'T2',surface:45},
  {type:'area',page:1,pts:sq,cat:'Rangement',typo:'T3'},                         // 10×20 pt
  {type:'label',page:1,pts:[{x:0,y:0}],name:'Placard',cat:'Rangement',typo:'T3',surface:1.5},
  {type:'len',page:1,pts:[{x:0,y:0},{x:100,y:0}],cat:'Chambre',typo:'T3',role:'longueur'},
  {type:'len',page:1,pts:[{x:0,y:0},{x:80,y:0}],cat:'Chambre',typo:'T3',role:'largeur'},
  {type:'len',page:1,pts:[{x:0,y:0},{x:120,y:0}],cat:'Chambre',typo:'T3',role:'longueur'},
  {type:'len',page:2,pts:[{x:0,y:0},{x:999,y:0}],cat:'Chambre',typo:'T3',role:'longueur'}, // page 2 non étalonnée : ignorée
  {type:'count',page:1,pts:[{x:1,y:1},{x:2,y:2},{x:3,y:3}],cat:'Prise',typo:'T3'},
  {type:'count',page:1,pts:[{x:1,y:1}],cat:'Prise',typo:'T3'}];
ok(isDwelling(ms[1])&&!isDwelling(ms[4]),'étiquette logement / pièce');
const sum=summarize(ms,p=>p===1?K:null);
ok(JSON.stringify(sum.dwellings.map(d=>[d.typo,d.n,d.surface.min,d.surface.avg,d.surface.max]))==='[["T2",1,45,45,45],["T3",2,60,65,70]]','typologies : nombre et surfaces min/moy/max');
const rg=sum.elements.find(e=>e.cat==='Rangement'); near(rg.area.max,1.5,'rangement étiqueté'); near(rg.area.min,200*K*K,'rangement dessiné en m²'); ok(rg.area.n===2,'deux rangements');
const ch=sum.elements.find(e=>e.cat==='Chambre'); near(ch.len.avg,110*K,'longueur moyenne'); ok(ch.len.n===2&&ch.wid.n===1,'page non étalonnée ignorée'); near(ch.wid.max,80*K,'largeur');
ok(sum.counts.length===1&&sum.counts[0].n===4,'comptage cumulé');
const gsum=summarize([{type:'area',page:1,pts:sq,group:'Rangements'},{type:'label',page:1,pts:[{x:0,y:0}],cat:'Placard',surface:1.5,group:'Rangements'},{type:'len',page:1,pts:[{x:0,y:0},{x:100,y:0}],group:'Rangements'},{type:'count',page:1,pts:[{x:0,y:0},{x:1,y:1}],group:'Rangements'},{type:'area',page:1,pts:sq,group:''}],p=>K);
const gr=gsum.groups; ok(gr.length===1&&gr[0].n===4,'un groupe de quatre mesures'); near(gr[0].area.sum,200*K*K+1.5,'surface du groupe'); near(gr[0].len.sum,100*K,'longueur du groupe'); ok(gr[0].count===2,'comptage du groupe');
console.log(`Ashton étiquettes et tableau : ${n}/${n} OK`);

// Zone automatique : deux pièces de 100×60 pt séparées par un mur de 6 pt percé d'une porte de 25 pt, un pointillé dans la pièce A.
const {autoZone,SnapIndex:SI}=await import('./measure.js');
const S2=[], P2=[]; const line=(a,b,c,d)=>{ S2.push(a,b,c,d); P2.push(a,b,c,d); };
const rect=(x,y,w,h)=>{ line(x,y,x+w,y); line(x+w,y,x+w,y+h); line(x+w,y+h,x,y+h); line(x,y+h,x,y); };
rect(0,0,206,60);                                  // contour extérieur (nu intérieur)
line(100,0,100,20); line(106,0,106,20); line(100,20,106,20);   // mur entre A et B, jambage haut
line(100,45,100,60); line(106,45,106,60); line(100,45,106,45); // jambage bas : porte de 25 pt entre y=20 et y=45
for(let x=10;x<90;x+=6) line(x,30,x+3,30);          // pointillé isolé dans A
rect(20,5,15,10);                                   // meuble isolé dans A (trou rebouché)
line(0,30,50,60); // trait clair (projection) reliant deux murs de A : ne coupe pas la zone
const LIGHT=new Uint8Array(S2.length/4); LIGHT[LIGHT.length-1]=1;
const zi=new SI({points:Float32Array.from(P2),segments:Float32Array.from(S2),light:LIGHT});
const za=autoZone(zi,[{x:50,y:40}],{gap:32});
ok(za.rings?.length===1,`zone A : un contour (${JSON.stringify(za)})`.slice(0,200)); near(polygonArea(za.rings[0]),100*60,'zone A = 100×60, porte fermée au nu du mur, pointillé et meuble ignorés',1);
const zab=autoZone(zi,[{x:50,y:40},{x:150,y:5}],{gap:32}); // second clic près du mur
ok(zab.rings.length===1,'Maj : deux pièces voisines = une zone'); near(polygonArea(zab.rings[0]),2*100*60+6*25,'les deux pièces et le seuil de porte',2);
ok(autoZone(zi,[{x:50,y:40}],{gap:20}).error==='open'||polygonArea(autoZone(zi,[{x:50,y:40}],{gap:20}).rings[0])>12000,'porte plus large que la tolérance : la zone traverse');
ok(autoZone(zi,[{x:100,y:5}],{gap:32}).error==='wall','clic sur un trait refusé'); near(polygonArea(autoZone(zi,[{x:103,y:5}],{gap:32}).rings[0]),6*20,'clic dans l’épaisseur d’un mur : la section du mur',1);
// Option : retirer le meuble (trou) puis la pièce B ajoutée avec Maj.
const zm=autoZone(zi,[{x:50,y:40}],{gap:32,minus:[{x:27,y:10}]}); ok(zm.holes.length===1,'meuble retiré : un trou');
near(polygonArea(zm.rings[0])-zm.holes.reduce((s,h)=>s+polygonArea(h),0),6000-15*10,'surface moins le meuble (15×10)',8);
const zb=autoZone(zi,[{x:50,y:40},{x:150,y:5}],{gap:32,minus:[{x:150,y:30}]}); near(polygonArea(zb.rings[0]),6000,'pièce B retirée',2);
ok(autoZone(zi,[{x:50,y:40}],{gap:32,minus:[{x:60,y:30}]}).error==='empty','tout retirer : zone vide');
// Lasso : englobe A et la moitié de B → deux pièces ; seulement A → une.
const {roomsInLasso}=await import('./measure.js');
const L2=roomsInLasso(zi,[{x:-5,y:-5},{x:180,y:-5},{x:180,y:65},{x:-5,y:65}],{gap:32}); ok(L2.length===2,`lasso sur A et B : deux pièces (${L2.length})`);
ok(L2.every(g=>autoZone(zi,g,{gap:32}).rings),'chaque groupe donne une zone');
ok(roomsInLasso(zi,[{x:10,y:10},{x:90,y:10},{x:90,y:50},{x:10,y:50}],{gap:32}).length===1,'lasso dans A : une pièce');
ok(roomsInLasso(zi,[{x:110,y:10},{x:120,y:10},{x:120,y:20}],{gap:32}).length===0,'petit lasso : aucune pièce majoritairement dedans');
// Lit de 40×30 pt contre le mur du fond de la pièce C (une ligne fine le sépare de la pièce) : rattaché à C.
const S3=[]; const l3=(a,b,c,d)=>S3.push(a,b,c,d); const r3=(x,y,w,h)=>{ l3(x,y,x+w,y); l3(x+w,y,x+w,y+h); l3(x+w,y+h,x,y+h); l3(x,y+h,x,y); };
r3(0,0,150,100); r3(110,35,40,30);
const zc=new SI({points:Float32Array.from(S3),segments:Float32Array.from(S3)});
const LC=roomsInLasso(zc,[{x:-5,y:-5},{x:155,y:-5},{x:155,y:105},{x:-5,y:105}],{gap:25,thin:0.6});
ok(LC.length===1&&LC[0].length===2,`lit rattaché à la pièce (${JSON.stringify(LC.map(g=>g.length))})`);
near(polygonArea(autoZone(zc,LC[0],{gap:25}).rings[0]),150*100,'pièce avec le lit',3);
console.log(`Ashton zone automatique : ${n}/${n} OK`);

// v0.5.0 — correspondance ExtracTerre : min / moy / max par référence, quantités totalisées par colonne choisie.
{ const {correspondence}=await import('./measure.js');
  const box=(w,h)=>[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
  const rows=correspondence([{id:1,type:'area',page:1,pts:box(100,100),cat:'Chambre',typo:'T3'},{id:2,type:'area',page:1,pts:box(200,100),cat:'Chambre',typo:'T3'},
    {id:3,type:'len',page:1,pts:[{x:0,y:0},{x:100,y:0}],role:'largeur',cat:'Séjour'},{id:4,type:'count',page:1,pts:[{x:0,y:0},{x:1,y:1},{x:2,y:2}],name:'Comptage 1',field:'fan_count',ref:'Brasseur d’air'},
    {id:5,type:'count',page:2,pts:[{x:0,y:0}],name:'Comptage 2',field:'fan_count'},{id:6,type:'len',page:3,pts:[{x:0,y:0},{x:9,y:0}]}],p=>p===3?null:0.01);
  const by=k=>rows.find(r=>r.key===k);
  near(by('surface|chambre t3').min,1,'surface min'); near(by('surface|chambre t3').avg,1.5,'surface moyenne'); near(by('surface|chambre t3').max,2,'surface max');
  ok(by('largeur|séjour').n===1,'largeur à part des longueurs');
  ok(by('quantite|fan_count').total===4&&by('quantite|fan_count').n===2,'comptages d’une même colonne additionnés, toutes pages');
  ok(!rows.some(r=>r.kind==='longueur'),'page non étalonnée : longueur écartée');
  console.log(`Ashton correspondance : ${n}/${n} OK`); }
