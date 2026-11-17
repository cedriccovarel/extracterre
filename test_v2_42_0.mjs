// ExtracTerre v2.43.0 — règles validées le 17/11/2026 : A (document d'ancrage Salesforce) et B (indice du nom de fichier).
import assert from 'node:assert/strict';
import {consolidate,docIndice} from './js/engine.js';
import {DEFAULT_SOURCE_RULES} from './js/config.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
// B — indice lu dans le nom de fichier
eq([docIndice('RT2012 ind A.pdf'),docIndice('RT2012 - indice C.pdf'),docIndice('Notice thermique 1.8.pdf'),docIndice('Etude v2.pdf'),docIndice('RSET 20250728.pdf')],[1,3,1.08,2,null],'indices');
const D=(id,name,type='RSET RE2020')=>({id,name,type,buildings:{names:['Bâtiment unique']}});
const O=(docId,field,value,extra={})=>({field,value,building:'Bâtiment unique',docId,fileName:docId,docType:extra.docType||'RSET RE2020',confidence:0.95,sourceTier:'main',hierarchyRank:5,method:'cstb:x',...extra});
const val=(r,f)=>r.rows[0][f];
// Deux versions d'un même RSET, même rang : l'indice le plus élevé l'emporte
{ const docs=[D('a','RSET ind A.pdf'),D('c','RSET ind C.pdf')];
  const r=consolidate(docs,[O('a','tic',30.1),O('c','tic',29.4)],DEFAULT_SOURCE_RULES);
  eq(val(r,'tic'),29.4,'indice C > indice A'); }
// A — Salesforce (valeurs collées) donne Bbio 63,2 et Cep 55,7 : la version qui concorde fournit le DH et le Tic
{ const docs=[D('old','RSET 2025-01.pdf'),D('new','RSET 2026-05 ind B.pdf')];
  const occ=[O('old','bbio',63.2),O('old','cep',55.7),O('old','dh',410),O('old','ic_construction',640),
             O('new','bbio',68.3),O('new','cep',60.1),O('new','dh',520),O('new','ic_construction',610),
             {field:'bbio',value:63.2,building:'Bâtiment unique',docId:'manual-paste',docType:'Entrée manuelle',confidence:1,sourceTier:'main',manualDefinitive:true},
             {field:'cep',value:55.7,building:'Bâtiment unique',docId:'manual-paste',docType:'Entrée manuelle',confidence:1,sourceTier:'main',manualDefinitive:true}];
  const r=consolidate(docs,occ,DEFAULT_SOURCE_RULES);
  eq([val(r,'bbio'),val(r,'cep')],[63.2,55.7],'Salesforce reste la valeur affichée');
  eq(val(r,'dh'),410,'DH de la version retenue par Salesforce (et non le plus défavorable des deux versions)');
  eq(val(r,'ic_construction'),640,'IC de la version d\'ancrage, malgré l\'indice B de l\'autre');
  // sans valeur Salesforce : comportement inchangé (indice B > sans indice, DH le plus défavorable)
  const r2=consolidate(docs,occ.filter(o=>!o.manualDefinitive),DEFAULT_SOURCE_RULES);
  eq(val(r2,'dh'),520,'sans ancrage : DH le plus défavorable, comme avant'); }
// Ancrage partiel (Bbio seul concorde) : pas d'ancrage
{ const docs=[D('x','RSET 1.pdf'),D('y','RSET 2.pdf')];
  const occ=[O('x','bbio',50),O('x','cep',70),O('x','tic',27),O('y','bbio',51),O('y','cep',60),O('y','tic',28),
    {field:'bbio',value:50,building:'Bâtiment unique',docId:'m',docType:'Entrée manuelle',confidence:1,sourceTier:'main',manualDefinitive:true},
    {field:'cep',value:60,building:'Bâtiment unique',docId:'m',docType:'Entrée manuelle',confidence:1,sourceTier:'main',manualDefinitive:true}];
  const r=consolidate(docs,occ,DEFAULT_SOURCE_RULES); eq(typeof val(r,'tic'),'number','un choix est fait sans ancrage'); }
console.log(`test_v2_42_0 : ${n}/${n} OK`);
// D — sources rétrogradées en secondaire (jamais supprimées)
{ const {DEFAULT_SOURCE_RULES:R,SOURCE_DEMOTIONS_V2:X,LEGACY_SOURCE_RULES:L}=await import('./js/config.js');
  eq([R.cepnr.main.includes('RT2012'),R.cepnr.secondary.includes('RT2012')],[false,true],'Cepnr : RT2012 en secondaire');
  eq([R.postcode.main.includes('Plan architectural'),R.postcode.secondary.includes('Plan architectural')],[false,true],'Code postal : plan en secondaire');
  eq(R.wall_insulation_r.main.includes('CCTP'),true,'R isolant des murs : CCTP reste principal (lot isolation)');
  eq(R.bbio.main.slice(0,2),['RSEE RE2020','RSET RE2020'],'Bbio : règle inchangée');
  eq(Object.keys(X).every(k=>L[k]),true,'ancienne règle gardée pour les réglages personnalisés'); n++; }
console.log(`test_v2_42_0 (D) OK`);
