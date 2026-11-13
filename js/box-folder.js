import {folderContracts,isFdesName} from './import-rules.js';
// v2.12.1 — dossier Box (via Box Drive) couplé à ExtracTerre : « 2 PRODUCTION EVALUATION/1 BEE Contrats » est choisi une fois,
// son accès est gardé par Chrome (File System Access API) ; pour une opération, le dossier « 0000xxxx - … » de son contrat est
// retrouvé et ses sous-dossiers d'évaluation CCTP, Étude carbone et Étude thermique sont proposés, les plus récents cochés.
// Les fichiers sont lus sur le poste : rien n'est envoyé.

export const BOX_KINDS=[['cctp','CCTP',/\bcctp\b/],['carbone','Étude carbone',/carbone|\bacv\b/],['thermique','Étude thermique',/thermique/]];
export const BOX_EXTENSIONS=/\.(pdf|xml|xlsx|xls|csv|json|zip)$/i;
const bx_norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
// « 00005115 - 34 - MARSEILLAN… » (espace initial toléré) ; contrat comparé sur 8 chiffres.
export const boxContractOf=name=>{ const m=String(name||'').match(/^\s*0*([1-9]\d{0,7})\s*-/); return m?m[1].padStart(8,'0'):''; }; // « 00 - Dossier type » n'est pas un contrat
export const boxContractKey=c=>{ const m=String(c||'').match(/^\s*0*([1-9]\d{0,7})\s*$/); return m?m[1].padStart(8,'0'):''; };
export const isEvaluationFolder=name=>/^evaluation/.test(bx_norm(name));
export const boxKindOf=name=>{ const n=bx_norm(name); return BOX_KINDS.find(([,,re])=>re.test(n))?.[0]||null; };
// Les plus récents : par groupe, les fichiers déposés dans les 45 jours qui précèdent le plus récent (un même envoi).
// Un sous-dossier daté (« 2026 02 », « 02 2026 », « 2020_12 Etude thermique ») est une version du même groupe ;
// « Old / Ancien / Archive » n'est jamais coché ; un autre sous-dossier (« Mitigeurs ») forme son propre groupe.
export const BOX_RECENT_DAYS=45;
const BX_VERSION=/^(?:\d{2,4}[\s._-]*\d{1,2}(?:[\s._-]*\d{2,4})?)(?:\b|_)/, BX_ARCHIVE=/^(?:old|anciens?|archives?|obsoletes?|perimes?)\b/;
export function boxGroupOf(path){ const parts=String(path).split('/').slice(2,-1).map(bx_norm); return {archived:parts.some(x=>BX_ARCHIVE.test(x)),group:parts.filter(x=>!BX_VERSION.test(x)&&!BX_ARCHIVE.test(x)).join('/')}; }
// CCTP : un fichier par lot, mis à jour lot par lot → la version la plus récente de chaque document (indice / révision mis à part).
export const boxDocKey=name=>bx_norm(name).replace(/\.[a-z0-9]+$/,'').replace(/\b(?:ind(?:ice)?|rev|v|version)\s*\.?\s*\d+\b/g,'').replace(/[\s_.-]+/g,' ').trim();
export function boxPrecheck(items){
  const key=it=>it.kind==='cctp'?`cctp|${boxGroupOf(it.path||'').group}|${boxDocKey(it.name||it.path||'')}`:`${it.kind}|${boxGroupOf(it.path||'').group}`, newest={};
  for(const it of items) if(!boxGroupOf(it.path||'').archived) newest[key(it)]=Math.max(newest[key(it)]||0,it.lastModified||0);
  return items.map(it=>({...it,checked:!boxGroupOf(it.path||'').archived&&(it.lastModified||0)>=newest[key(it)]-(it.kind==='cctp'?0:BOX_RECENT_DAYS*864e5)}));
}

// --- Accès au dossier (Chrome / Edge) : poignée gardée dans une petite base IndexedDB dédiée.
const BOX_DB='extracterre-box', BOX_STORE='handles';
function boxDb(){ return new Promise((res,rej)=>{ const r=indexedDB.open(BOX_DB,1); r.onupgradeneeded=()=>r.result.createObjectStore(BOX_STORE); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function boxStore(mode,fn){ const db=await boxDb(); try{ return await new Promise((res,rej)=>{ const tx=db.transaction(BOX_STORE,mode); const q=fn(tx.objectStore(BOX_STORE)); tx.oncomplete=()=>res(q?.result); tx.onerror=()=>rej(tx.error); }); } finally { db.close(); } }
export const boxSupported=()=>typeof globalThis.showDirectoryPicker==='function';
export async function boxSavedRoot(){ try{ return await boxStore('readonly',s=>s.get('root'))||null; }catch{ return null; } }
export async function boxPickRoot(){ const h=await globalThis.showDirectoryPicker({id:'extracterre-box',mode:'read'}); try{ await boxStore('readwrite',s=>s.put(h,'root')); }catch(err){ console.warn('Dossier Box non mémorisé',err); } return h; }
// À appeler pendant un clic : Chrome redemande l'accès à chaque session.
export async function boxEnsureAccess(h){ if(!h) return false; if(await h.queryPermission?.({mode:'read'})==='granted') return true; try{ return await h.requestPermission?.({mode:'read'})==='granted'; }catch{ return false; } } // sans clic récent, Chrome refuse la demande : on renvoie « non » au lieu de lever une erreur

// v2.24.7 — mêmes règles que l'import massif (js/import-rules.js) : « 75 - 1439 - Paris … », « 00001629 ET 00001630 - … »,
// « 00001807, 1808, 1806 - … » ; dossiers annulés écartés ; dossier d'archive « 00 - Certifications réalisées - Archivage » cherché aussi
// (la racine prime). Plusieurs dossiers actifs : le premier trouvé, les autres signalés.
export const BOX_ARCHIVE_DIRS=['00 - Certifications réalisées - Archivage'];
export async function boxFindOperation(root,contract){
  const key=boxContractKey(contract); if(!key) return null;
  const hits=[],cancelled=[];
  const scan=async(dir,prefix)=>{ for await (const [name,h] of dir.entries()){ if(h.kind!=='directory') continue; const r=folderContracts(name);
    if(r.contracts.includes(key)) (r.cancelled?cancelled:hits).push({name:prefix+name,handle:h}); } };
  await scan(root,'');
  if(!hits.length) for(const a of BOX_ARCHIVE_DIRS){ let d=null; try{ d=await root.getDirectoryHandle(a); }catch{} if(d) await scan(d,`${a}/`); }
  if(!hits.length) return cancelled.length?{...cancelled[0],cancelled:true}:null;
  return {...hits[0],others:hits.slice(1).map(x=>x.name)};
}
async function bx_child(dir,test){ for await (const [name,h] of dir.entries()) if(h.kind==='directory'&&test(name)) return {name,handle:h}; return null; }
async function bx_files(dir,path,kind,out,depth){
  for await (const [name,h] of dir.entries()){
    if(name.startsWith('.')) continue;
    if(h.kind==='directory'){ if(depth<3) await bx_files(h,`${path}/${name}`,kind,out,depth+1); continue; }
    if(!BOX_EXTENSIONS.test(name)||isFdesName(name)) continue; // v2.32.2 — fiches FDES jamais lues
    const f=await h.getFile(); out.push({kind,path:`${path}/${name}`,name,size:f.size,lastModified:f.lastModified,file:f});
  }
}
// Fichiers des sous-dossiers CCTP / Étude carbone / Étude thermique de « Évaluation », plus récents en tête.
// v2.24.7 — tous les dossiers « Évaluation… » sont parcourus (anciens contrats : « Evaluation Thermique » à côté de « Evaluation
// Environnementale », dans un ordre quelconque), sauf l'évaluation environnementale.
export async function boxListEvaluation(opDir){
  const evs=[];
  for await (const [name,h] of opDir.handle.entries()) if(h.kind==='directory'&&isEvaluationFolder(name)&&!/environnement/.test(bx_norm(name))) evs.push({name,handle:h});
  if(!evs.length) return {evaluation:null,items:[]};
  evs.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  const items=[];
  for(const ev of evs) for await (const [name,h] of ev.handle.entries()){ if(h.kind!=='directory') continue; const kind=boxKindOf(name); if(kind) await bx_files(h,`${ev.name}/${name}`,kind,items,1); }
  return {evaluation:evs.map(e=>e.name).join(' + '),items:boxPrecheck(items).sort((a,b)=>BOX_KINDS.findIndex(k=>k[0]===a.kind)-BOX_KINDS.findIndex(k=>k[0]===b.kind)||b.lastModified-a.lastModified)};
}
