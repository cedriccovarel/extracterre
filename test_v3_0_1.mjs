// ExtracTerre v3.0.2 — lecteurs enveloppe : doublages complexes, titre de section, épaisseurs invraisemblables. Textes fictifs.
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {parseDocument} from './js/parsers.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'3.0.2','version');
const mk=(type,lines)=>({id:'t',name:'test.pdf',type,status:'ready',buildings:{names:['Bâtiment unique']},read:{pages:[{page:1,text:lines.join('\n'),lines:lines.map((t,i)=>({index:i,text:t}))}]}});
const get=(type,lines,f,min=0.9)=>[...new Set(parseDocument(mk(type,lines)).filter(o=>o.field===f&&o.confidence>=min).map(o=>o.value))];
eq(get(DOC_TYPES.CCTP,['MURS DE FACADES','Doublage thermique type Doublissimo 100+13 sur les murs exterieurs'],'wall_insulation_thickness'),[100],'Doublissimo 100+13 → 100 mm (mur)');
eq(get(DOC_TYPES.RT2012,['Isolation et Parois','• Brique collee 20 cm (R ≥ 1.14) + Pregymax 32 80+13 (R=2.55)'],'wall_insulation_thickness'),[80],'Pregymax 80+13 : l’isolant, pas la brique');
eq(get(DOC_TYPES.RT2012,['Isolation et Parois','• Brique collee 20 cm (R ≥ 1.14) + Pregymax 32 80+13 (R=2.55)'],'wall_insulation_r'),[2.55],'R du doublage');
eq(get(DOC_TYPES.CCTP,['Doublage thermo-acoustique par panneaux complexe type PREGYMAX 30','13+101 R=3.35 de SINIAT ou equivalent'],'wall_insulation_thickness'),[101],'doublage sur deux lignes : 13+101');
eq(get(DOC_TYPES.RT2012,['Plancher bas','Dalle de compression : epaisseur 5 cm.','Hourdis beton','Laine de verre : epaisseur 140 mm ; R = 4,000 m².°C/W.'],'floor_insulation_thickness'),[140],'titre de section « Plancher bas » à 3 lignes');
eq(get(DOC_TYPES.CCTP,['Cloisons de distribution 72/48','Doublage des gaines techniques en plaques BA13'],'wall_insulation_thickness'),[],'doublage de gaines en BA13 : rien');
eq(get(DOC_TYPES.CCTP,['Murs exterieurs','Doublage PSE ep. 13 mm'],'wall_insulation_thickness'),[],'mur 13 mm : invraisemblable, pas retenu d’office');
eq(get(DOC_TYPES.CCTP,['Murs exterieurs','Doublage PSE ep. 13 mm'],'wall_insulation_thickness',0.5),[13],'… mais proposé à vérifier');
console.log(`v3.0.2 — ${n} vérifications OK (textes fictifs)`);
