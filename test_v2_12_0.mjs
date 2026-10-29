// ExtracTerre v2.12.0 — Charger depuis Box : dossier du contrat, sous-dossiers d'évaluation, plus récents cochés. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {boxContractOf,boxContractKey,isEvaluationFolder,boxKindOf,boxPrecheck,boxFindOperation,boxListEvaluation} from './js/box-folder.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.12.0','version');
eq([' 00002474 - 83 - LES ARCS','00005115 - 34 - MARSEILLAN','00 - Dossier type copie','Autres'].map(boxContractOf),['00002474','00005115','',''],'contrat du dossier');
eq(['4723','00004723','OPE-1'].map(boxContractKey),['00004723','00004723',''],'contrat de l’opération');
eq(['Évaluation','Evaluation thermique','Suivi environnemental'].map(isEvaluationFolder),[true,true,false]);
eq(['CCTP','CCTP DPGF','Étude Carbone','Etude carbone','ACV','Étude Thermique','Etude thermique','Plans','DPGF'].map(boxKindOf),['cctp','cctp','carbone','carbone','carbone','thermique','thermique',null,null],'sous-dossiers');
const D=d=>Date.parse(d);
eq(boxPrecheck([{kind:'thermique',path:'Évaluation/Étude Thermique/2026 02/a.pdf',lastModified:D('2026-02-10')},{kind:'thermique',lastModified:D('2025-11-02')},{kind:'thermique',lastModified:D('2026-01-20')},{kind:'cctp',lastModified:D('2024-03-01')}]).map(x=>x.checked),[true,false,true,true],'plus récents cochés par dossier');
eq(boxPrecheck([{kind:'cctp',path:'Évaluation/CCTP/Lot 01.pdf',lastModified:D('2025-06-25')},{kind:'cctp',path:'Évaluation/CCTP/Mitigeurs/Certificat.pdf',lastModified:D('2025-11-27')},{kind:'thermique',path:'Évaluation/Étude Thermique/Old/RSET.pdf',lastModified:D('2026-03-01')},{kind:'thermique',path:'Évaluation/Étude Thermique/RSET.pdf',lastModified:D('2025-10-01')}]).map(x=>x.checked),[true,true,false,true],'sous-dossier thématique = groupe à part ; Old jamais coché');

// Faux dossier (même interface que la File System Access API).
const dir=(name,kids)=>({kind:'directory',name,async *entries(){ for(const k of kids) yield [k.name,k]; }});
const file=(name,date,size=1000)=>({kind:'file',name,async getFile(){ return {name,size,lastModified:D(date)}; }});
const root=dir('1 BEE Contrats',[dir('00001001 - 69 - LYON - FICTIF',[dir('Évaluation',[
  dir('Étude Thermique',[file('RSET v1.pdf','2025-06-01'),dir('2026 02',[file('RSET v2.pdf','2026-02-12'),file('RSEE v2.xml','2026-02-12')]),file('.DS_Store','2026-02-12')]),
  dir('CCTP',[file('Lot 01.pdf','2026-01-05'),file('Lot 02.docx','2026-01-05')]),dir('Plans',[file('P01.pdf','2026-01-05')])])]),dir(' 00001002 - 69 - AUTRE',[])]);
eq((await boxFindOperation(root,'1001'))?.name,'00001001 - 69 - LYON - FICTIF','dossier trouvé');
eq(await boxFindOperation(root,'1003'),null,'absent');
const {evaluation,items}=await boxListEvaluation(await boxFindOperation(root,'00001001'));
eq(evaluation,'Évaluation');
eq(items.map(x=>[x.kind,x.name,x.checked]),[['cctp','Lot 01.pdf',true],['thermique','RSET v2.pdf',true],['thermique','RSEE v2.xml',true],['thermique','RSET v1.pdf',false]],'CCTP puis thermique, récents cochés, Plans / .docx / .DS_Store ignorés');
eq(items[1].path,'Évaluation/Étude Thermique/2026 02/RSET v2.pdf','chemin relatif');
eq(boxPrecheck([['Lot 01 GO CCTP DCE Ind 1.pdf','2025-12-16'],['Lot 01 GO CCTP DCE Ind 2.pdf','2026-04-30'],['Lot 02 Etanchéité CCTP DCE Ind 1.pdf','2025-12-16']].map(([name,d])=>({kind:'cctp',name,path:`Évaluation/CCTP/${name}`,lastModified:D(d)}))).map(x=>x.checked),[false,true,true],'CCTP : dernière version de chaque lot');
console.log(`v2.12.0 — ${n} vérifications OK (données fictives)`);
