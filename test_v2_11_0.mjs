// ExtracTerre v2.11.0 — DH ZT / DH ZNT à la place de DH ; colonnes ITE, ITI, Brasseur d'air, Climatisation active (Oui / Non). Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,FIELD_DEFS,FIELD_MAP,matchFieldByHeader,DEFAULT_SOURCE_RULES,DOC_TYPES} from './js/config.js';
import {analyzeDocuments,applyComparisonBases} from './js/engine.js';
import {parseDocument} from './js/parsers.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {readXmlText} from './js/readers.js';
import {parseFreePaste,freePasteValues,salesforceEvaluationToPaste} from './js/collage-libre.js';
import {textDoc,fictitiousRe2020Xml} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION,'2.13.0','version');

// Schéma : DH ZT / DH ZNT à la place de DH (DH reste interne), 4 colonnes Oui / Non en fin.
const cols=FIELD_DEFS.filter(f=>!f.hidden).map(f=>f.key);
ok(!cols.includes('dh')&&FIELD_MAP.dh.hidden,'DH n’est plus une colonne');
eq(cols.slice(cols.indexOf('dh_zt'),cols.indexOf('dh_zt')+3),['dh_zt','dh_znt','dh_max'],'à la place de DH');
eq(cols.slice(-4),['wall_ite','wall_iti','fan_presence','cooling_active'],'ajoutées en fin');
eq(['DH ZT','DH ZNT','ITE','ITI','Brasseur d’air','Climatisation active'].map(h=>matchFieldByHeader(h)?.key),['dh_zt','dh_znt','wall_ite','wall_iti','fan_presence','cooling_active'],'en-têtes');

// RSET PDF : colonne « Trav. » du tableau DH (Oui = traversante), groupe le plus défavorable de chaque type.
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:d.read.kind,re2020:d.read.re2020||null}); d.classification={...c,automaticType:c.type}; d.type=d.type||c.type; d.buildings=detectBuildings(d); d.status='ready'; return d; };
const rset=prep(textDoc('r1','RSET_fictif.pdf',DOC_TYPES.RSET_RE2020,'Bâtiment A\nCalcul de l\'indicateur degrés-heures d\'inconfort des groupes du bâtiment pour les occupants (DH)\nZone / Groupes Trav. S Indicateur degrés-heures (DH) en °C.h\nOui | 656,7 | 412,6 | 674 | 417 | 239 | Conforme\nOui | 300,2 | 530,1 | 600 | 400 | 200 | Conforme\nNon | 663,5 | 980,4 | 1006 | 755 | 431 | Conforme'));
const r1=analyzeDocuments([rset],structuredClone(DEFAULT_SOURCE_RULES),'Op').rows[0];
eq([r1.dh_zt,r1.dh_znt,r1.dh],[530.1,980.4,980.4],'RSET : DH ZT / DH ZNT, DH = le plus défavorable');

// XML RE2020 : Is_Traversant de la zone.
const {xml}=fictitiousRe2020Xml(); const xdoc=prep({id:'x1',name:'Tilleuls_RSEE.xml',read:readXmlText(xml)});
const xo=parseDocument(xdoc), xv=(f,b)=>xo.find(o=>o.field===f&&o.building===b)?.value;
eq([xv('dh_zt','Bâtiment A - COLLECTIF'),xv('dh_znt','Bâtiment A - COLLECTIF')],[620.4,undefined],'XML : zone traversante');
eq([xv('dh_zt','Bâtiment B - MAISONS'),xv('dh_znt','Bâtiment B - MAISONS')],[undefined,540],'XML : zone non traversante');

// Collage libre et fiche Salesforce.
eq(freePasteValues(parseFreePaste('DH ZT = 500,5\nDH ZNT = 800,8'))[0].values,{dh:800.8,dh_zt:500.5,cross_ventilated:'Oui',dh_znt:800.8,non_cross_ventilated:'Oui'},'collage DH ZT / DH ZNT');
const sf=salesforceEvaluationToPaste('Performance thermique\nBbio = 40 / 60\nDH ZT - T3 = 634,2 - T2 = 841,7\nDH ZNT - T2 = 700');
const sv=freePasteValues(parseFreePaste(sf.text))[0].values;
eq([sv.dh_zt,sv.dh_znt,sv.dh],[841.7,700,841.7],'Salesforce : chaque type garde son plus défavorable');

// Déductions Oui / Non (et DH d'un bâtiment à un seul type de zone) ; une saisie n'est jamais remplacée.
const src=f=>({field:f,building:'B',value:'x',method:'test'});
const res=(row)=>{ const r={rows:[{building:'B',...row}],finals:Object.keys(row).map(src)}; applyComparisonBases(r); return r.rows[0]; };
let r=res({dh:640,cross_ventilated:'Oui',wall_ite_insulation:'Laine de roche',fan_count:4,cooling:'Aucun'});
eq([r.dh_zt,r.dh_znt,r.wall_ite,r.wall_iti,r.fan_presence,r.cooling_active],[640,undefined,'Oui','Non','Oui','Non'],'déductions');
r=res({dh:640,cross_ventilated:'Oui',non_cross_ventilated:'Oui',fan_count:0,cooling:'PAC réversible'});
eq([r.dh_zt,r.dh_znt,r.wall_ite,r.wall_iti,r.fan_presence,r.cooling_active],[undefined,640,undefined,undefined,'Non','Oui'],'deux types de zones : DH non précisé reporté en ZNT');
r=res({dh:500}); eq([r.dh_zt,r.dh_znt],[undefined,500],'sans type de zone connu : ZNT');
r=res({wall_ite:'Non',wall_ite_r:4.5,cooling:'Climatisation active',cooling_active:'Non'});
eq([r.wall_ite,r.cooling_active],['Non','Non'],'saisies conservées');
eq(analyzeDocuments([prep(textDoc('n1','Notice.pdf',DOC_TYPES.RSET_RE2020,'Bâtiment A\nDH = 712 °C.h'))],structuredClone(DEFAULT_SOURCE_RULES),'Op').rows[0].dh_znt,712,'DH sans type de zone → DH ZNT');
console.log(`v2.13.0 — ${n} vérifications OK (données fictives)`);

// Session JSON complète : un projet exporté puis importé redonne les mêmes valeurs, sans les fichiers.
{
  const {serializeProjectFull,hydrateProjectFull}=await import('./js/persistence.js');
  const d={...rset,file:{name:'x'}}; const res0=analyzeDocuments([d],structuredClone(DEFAULT_SOURCE_RULES),'Op');
  const proj={id:'p1',label:'Projet 1',docs:[d],manualValues:{'Bâtiment A':{fan_count:2}},freePasteRows:[{building:'',values:{q4pa_surf:0.6}}]};
  const back=hydrateProjectFull(JSON.parse(JSON.stringify(serializeProjectFull(proj))));
  eq([back.docs[0].status,back.docs[0].file,back.docs[0].cachedOccurrences.length>0,back.manualValues,back.freePasteRows[0].values],['ready',null,true,proj.manualValues,{q4pa_surf:0.6}],'projet restitué');
  const res1=analyzeDocuments(back.docs,structuredClone(DEFAULT_SOURCE_RULES),'Op');
  eq([res1.rows[0].dh_zt,res1.rows[0].dh_znt],[res0.rows[0].dh_zt,res0.rows[0].dh_znt],'mêmes valeurs après import');
}
console.log(`v2.13.0 — session : ${n} vérifications OK`);
