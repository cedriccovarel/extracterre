// ExtracTerre v2.24.7 — « Charger depuis Box » : anciens noms de dossiers (« 75 - 1439 - … »), multi-contrats, archive, annulés,
// tous les dossiers d'évaluation sauf l'environnementale. Noms fictifs.
import {APP_VERSION} from './js/config.js';
import {boxFindOperation,boxListEvaluation} from './js/box-folder.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'2.32.1','version');
const file=(name,t=1)=>({kind:'file',name,async getFile(){ return {name,size:100,lastModified:t}; }});
const dir=(name,children=[])=>({kind:'directory',name,async *entries(){ for(const c of children) yield [c.name,c]; },async getDirectoryHandle(x){ const c=children.find(k=>k.name===x&&k.kind==='directory'); if(!c) throw new Error('absent'); return c; }});
const root=dir('1 BEE Contrats',[
  dir('00 - Dossier type copie'),
  dir('75 - 1439 - Paris - Rue Fictive',[dir('Evaluation Environnementale',[dir('Guide',[file('guide.pdf')])]),dir('Evaluation Thermique',[dir('CCTP',[file('CCTP lot 1.pdf')]),dir('Etude thermique',[file('Note RT.pdf')]),dir('Plans',[file('plan.pdf')])])]),
  dir('00004000 ET 00004001 - 59 - LILLE - Fictif'),
  dir('75 - 1692 - annulée - Paris Fictif'),
  dir('00 - Certifications réalisées - Archivage',[dir('00001500 - 94 - VILLE - Fictif')]),
  dir('00005000 - 13 - MARSEILLE'),dir('00 - Certifications réalisées - Archivage/x')
]);
const f=async c=>{ const r=await boxFindOperation(root,c); return r?(r.cancelled?'annulé:':'')+r.name:null; };
eq(await f('1439'),'75 - 1439 - Paris - Rue Fictive','ancien format « département - contrat »');
eq(await f('4001'),'00004000 ET 00004001 - 59 - LILLE - Fictif','dossier commun à deux contrats');
eq(await f('1500'),'00 - Certifications réalisées - Archivage/00001500 - 94 - VILLE - Fictif','dossier d’archive');
eq(await f('1692'),'annulé:75 - 1692 - annulée - Paris Fictif','dossier annulé signalé');
eq(await f('00005000'),'00005000 - 13 - MARSEILLE','format habituel');
eq(await f('9999'),null,'introuvable');
const op=await boxFindOperation(root,'1439'); const l=await boxListEvaluation(op);
eq(l.evaluation,'Evaluation Thermique','évaluation environnementale ignorée');
eq(l.items.map(i=>i.kind+':'+i.name).sort(),['cctp:CCTP lot 1.pdf','thermique:Note RT.pdf'],'CCTP et étude thermique listés, plans exclus');
console.log(`v2.31.0 — ${n} vérifications OK (données fictives)`);
