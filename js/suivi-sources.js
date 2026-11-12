// ExtracTerre v2.24.0 — espace « Import massif & suivi des sources ».
// Lit le dossier de travail du script tools/import (registre.json, resultats/*.json.gz) choisi par l'utilisateur
// (File System Access) et y écrit decisions.json (choix faits dans « À vérifier »). Les dossiers Box ne sont jamais modifiés.

export const IMPORT_SPACE=(()=>{ try{ return new URLSearchParams(globalThis.location?.search||'').get('espace')==='import'; }catch{ return false; } })();
export const SS_STATUS_ORDER=['à vérifier','erreur','à traiter','nouveau','traité','ignoré'];

const SS_DB='extracterre-import-ui', SS_STORE='handles';
function ss_db(){ return new Promise((res,rej)=>{ const r=indexedDB.open(SS_DB,1); r.onupgradeneeded=()=>r.result.createObjectStore(SS_STORE); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function ss_store(mode,fn){ const db=await ss_db(); return new Promise((res,rej)=>{ const tx=db.transaction(SS_STORE,mode); const req=fn(tx.objectStore(SS_STORE)); tx.oncomplete=()=>{ db.close(); res(req?.result); }; tx.onerror=()=>{ db.close(); rej(tx.error); }; }); }

export const ssSupported=()=>typeof globalThis.showDirectoryPicker==='function';
export async function ssSavedWorkDir(){ try{ return await ss_store('readonly',s=>s.get('work'))||null; }catch{ return null; } }
export async function ssPickWorkDir(){ const h=await globalThis.showDirectoryPicker({id:'extracterre-import-work',mode:'readwrite'}); try{ await ss_store('readwrite',s=>s.put(h,'work')); }catch{} return h; }
export async function ssEnsure(h,mode='read'){ if(!h) return false; if(await h.queryPermission?.({mode})==='granted') return true; return await h.requestPermission?.({mode})==='granted'; }

async function ss_file(dir,rel){
  const parts=String(rel).split('/').filter(Boolean); let d=dir;
  for(const p of parts.slice(0,-1)) d=await d.getDirectoryHandle(p);
  return (await d.getFileHandle(parts.at(-1))).getFile();
}
export async function ssReadRegistry(dir){
  let f; try{ f=await ss_file(dir,'registre.json'); }catch{ throw new Error('registre.json absent : choisissez le dossier de travail du script (par défaut ExtracTerre-import dans votre dossier personnel), après un premier traitement.'); }
  const r=JSON.parse(await f.text());
  if(r?.format!=='extracterre-import-registry') throw new Error('Ce fichier n’est pas un registre d’import ExtracTerre.');
  return r;
}
export async function ssReadResult(dir,rel){
  const f=await ss_file(dir,rel);
  const stream=f.stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
export async function ssReadDecisions(dir){ try{ const f=await ss_file(dir,'decisions.json'); return JSON.parse(await f.text())||{files:{}}; }catch{ return {format:'extracterre-import-decisions',files:{}}; } }
export async function ssWriteDecisions(dir,obj){
  const h=await dir.getFileHandle('decisions.json',{create:true}); const w=await h.createWritable();
  await w.write(JSON.stringify({format:'extracterre-import-decisions',updatedAt:new Date().toISOString(),files:obj.files||{}},null,1)); await w.close();
}

// Motif « À vérifier » regroupé pour le filtre.
export function ssReasonCategory(reason=''){
  const r=String(reason).toLowerCase();
  if(/scan|ocr/.test(r)) return 'PDF sans texte (scan)';
  if(/contradictoire/.test(r)) return 'Indices contradictoires';
  if(/version/.test(r)) return 'Ordre des versions ambigu';
  if(/incomplet/.test(r)) return 'Résultat incomplet';
  if(/aucune donnée/.test(r)) return 'Aucune donnée extraite';
  if(/xml/.test(r)) return 'XML non reconnu';
  if(/aucun indice/.test(r)) return 'Type inconnu';
  if(/parseur|lecture/.test(r)) return 'Erreur de lecture';
  return 'Autre';
}

// Vue par opération : documents courants par famille, historique, disparus, compteurs.
export function ssOperations(registry){
  const files=Object.values(registry?.files||{}), byOp=new Map();
  for(const op of Object.values(registry?.operations||{})) byOp.set(op.contract,{...op,files:[]});
  for(const f of files){ if(!byOp.has(f.contract)) byOp.set(f.contract,{contract:f.contract,folder:f.folder,files:[]}); byOp.get(f.contract).files.push(f); }
  return [...byOp.values()].map(op=>{
    const c={total:0,traite:0,review:0,errors:0,ignored:0,missing:0,history:0,todo:0};
    for(const f of op.files){
      if(f.missing){ c.missing++; continue; }
      c.total++;
      if(f.status==='traité') c.traite++; else if(f.status==='à vérifier') c.review++; else if(f.status==='erreur') c.errors++;
      else if(f.status==='ignoré'){ if(f.versionGroup&&!f.isCurrent) c.history++; else c.ignored++; } else c.todo++;
    }
    return {...op,counts:c};
  }).sort((a,b)=>String(a.contract).localeCompare(String(b.contract)));
}

// Fichiers à charger dans l'opération : version courante, extraite, et validée (traité, ou acceptée dans l'appli).
export function ssLoadableFiles(registry,contract,decisions={}){
  return Object.values(registry?.files||{}).filter(f=>f.contract===contract&&!f.missing&&f.isCurrent&&f.resultFile&&
    (f.status==='traité'||(f.status==='à vérifier'&&decisions[`${f.contract}|${f.relPath}`]?.accept)));
}

// Nom d'opération lisible tiré du nom de dossier : « 00001234 - 59 - LILLE - LES TILLEULS » → « LILLE - LES TILLEULS ».
export function ssOperationName(folder=''){
  return String(folder).replace(/^\s*(?:annul[ée]e?\s*-\s*)?[\d\s,;+&\/._–-]*(?:(?:et|and)\b[\d\s,;+&\/._–-]*)*/i,'').replace(/^(?:\d{2}|2a|2b)\s*-\s*/i,'').trim()||String(folder).trim();
}

// Dossier lié : compare le dossier d'opération (poignée Box) au registre — nouveaux, modifiés, disparus.
export async function ssCompareLinked(opHandle,registry,contract){
  const known=new Map(Object.values(registry?.files||{}).filter(f=>f.contract===contract&&!f.missing).map(f=>[f.relPath,f]));
  const op=(registry?.operations||{})[contract]; const dirs=(op?.families||[]).map(x=>x.relDir);
  const seen=new Set(), added=[], changed=[];
  async function walk(dir,rel,depth,directOnly){
    for await (const [name,h] of dir.entries()){
      const r=rel?`${rel}/${name}`:name;
      if(h.kind==='directory'){ if(!directOnly&&depth<8) await walk(h,r,depth+1,false); continue; }
      const f=await h.getFile(); seen.add(r); const k=known.get(r);
      if(!k){ if(!/^(~\$|\._|\.)/.test(name)) added.push({relPath:r,size:f.size,lastModified:f.lastModified}); }
      else if(k.size!==f.size||Math.abs((k.mtimeMs||0)-f.lastModified)>2000) changed.push({relPath:r,size:f.size,lastModified:f.lastModified});
    }
  }
  for(const fam of op?.families||[]){
    let d=opHandle; try{ for(const p of fam.relDir.split('/')) d=await d.getDirectoryHandle(p); }catch{ continue; }
    await walk(d,fam.relDir,0,!!fam.container);
  }
  const gone=[...known.values()].filter(f=>dirs.some(d=>f.relPath.startsWith(`${d}/`))&&!seen.has(f.relPath)&&f.status!=='ignoré');
  return {added,changed,gone};
}
