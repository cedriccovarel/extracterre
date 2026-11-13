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
export async function ssEnsure(h,mode='read'){ if(!h) return false; if(await h.queryPermission?.({mode})==='granted') return true; try{ return await h.requestPermission?.({mode})==='granted'; }catch{ return false; } }

async function ss_file(dir,rel){
  const parts=String(rel).split('/').filter(Boolean); let d=dir;
  for(const p of parts.slice(0,-1)) d=await d.getDirectoryHandle(p);
  return (await d.getFileHandle(parts.at(-1))).getFile();
}
export async function ssReadRegistry(dir){
  // Dossier encore vide (première utilisation) : registre vide, la première analyse le créera.
  let f; try{ f=await ss_file(dir,'registre.json'); }catch{ return {format:'extracterre-import-registry',version:1,updatedAt:null,files:{},operations:{},empty:true}; }
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
  folder=String(folder).split('/').pop();
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


// ---------- v2.24.1 — « Coller une liste de contrats » : demandes exécutées par le service d'import (tools/import/watch.mjs) ----------

// Liste collée depuis Excel (une ou plusieurs colonnes) → numéros de contrat (8 chiffres). Colonne choisie : en-tête
// contenant « contrat », sinon celle qui a le plus de numéros (évite départements, codes postaux, années d'une autre colonne).
export function ssParseContractPaste(text=''){
  const rows=String(text).replace(/\r/g,'').split('\n').filter(l=>l.trim()).map(l=>l.split('\t'));
  if(!rows.length) return {contracts:[],invalid:[],column:null};
  const width=Math.max(...rows.map(r=>r.length));
  const digits=v=>String(v||'').replace(/[\s.-]/g,'');
  const head=rows[0].findIndex(c=>/contrat/i.test(c||''));
  let col=head;
  if(col<0){ let best=-1; for(let c=0;c<width;c++){ const n=rows.filter(r=>/^\d{3,8}$/.test(digits(r[c]))).length; if(n>best){ best=n; col=c; } } }
  const contracts=[],invalid=[];
  rows.forEach((r,i)=>{ if(i===0&&head>=0) return; const raw=String(r[col]||'').trim(); if(!raw) return;
    const d=digits(raw), v=d.replace(/^0+/,'');
    if(!/^\d+$/.test(d)||!v||v.length>8){ invalid.push(raw); return; }
    const k=v.padStart(8,'0'); if(!contracts.includes(k)) contracts.push(k); });
  return {contracts,invalid,column:col};
}
async function ss_demandes(dir){ return dir.getDirectoryHandle('demandes',{create:true}); }
export async function ssWriteRequest(dir,contracts,mode='traitement',{ocr=true,cctpLots=[]}={}){
  const d=new Date(), p=n=>String(n).padStart(2,'0');
  const id=`demande-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const h=await (await ss_demandes(dir)).getFileHandle(`${id}.json`,{create:true}); const w=await h.createWritable();
  await w.write(JSON.stringify({format:'extracterre-import-request',id,mode,ocr,cctpLots,contrats:contracts,creeA:d.toISOString()},null,1)); await w.close();
  return id;
}
async function ss_json(dir,name){ try{ const f=await (await (await ss_demandes(dir)).getFileHandle(name)).getFile(); return JSON.parse(await f.text()); }catch{ return null; } }
export const ssReadStatus=(dir,id)=>ss_json(dir,`${id}.statut.json`);
// Service actif : battement de cœur de moins de 30 s.
export async function ssServiceState(dir){ const s=await ss_json(dir,'service.json'); return {alive:!!s&&Date.now()-Date.parse(s.vu)<30000,info:s}; }

// v2.28.0 — file des analyses : liste, arrêt / annulation (<id>.stop lu par le service), suppression.
export async function ssListRequests(dir){
  const d=await ss_demandes(dir), ids=[];
  for await (const [name,h] of d.entries()){ const m=h.kind==='file'&&name.match(/^(demande-[\w-]+)\.json$/); if(m&&!/\.statut$/.test(m[1])) ids.push(m[1]); }
  const out=[];
  for(const id of ids){ const req=await ss_json(dir,`${id}.json`), st=await ss_json(dir,`${id}.statut.json`); let stop=false; try{ await d.getFileHandle(`${id}.stop`); stop=true; }catch{}
    out.push({id,contracts:Array.isArray(req?.contrats)?req.contrats.length:0,mode:req?.mode||'traitement',ocr:req?.ocr!==false,createdAt:req?.creeA||'',status:st||null,stopAsked:stop}); }
  return out.sort((a,b)=>String(b.id).localeCompare(String(a.id)));
}
export async function ssStopRequest(dir,id,{immediat=false}={}){
  const h=await (await ss_demandes(dir)).getFileHandle(`${id}.stop`,{create:true}); const w=await h.createWritable();
  await w.write(JSON.stringify({at:new Date().toISOString(),immediat})); await w.close();
}
export async function ssDeleteRequest(dir,id){
  const d=await ss_demandes(dir);
  for(const ext of ['.json','.statut.json','.contrats.txt','.log','.stop']){ try{ await d.removeEntry(`${id}${ext}`); }catch{} }
}
export const ssRequestDone=st=>!!st&&['terminé','erreur','interrompu','annulé'].includes(st.etat);

// v2.31.0 — suivi visuel de l'analyse en cours : étapes, pourcentages, temps écoulé / restant, état de chaque contrat.
export const SS_STEPS=[['attente','Demande déposée'],['lecture','Lecture de Box'],['correspondance','Correspondance'],['extraction','Analyse des documents'],['fin','Terminé']];
export function ssDuration(ms){
  if(!Number.isFinite(ms)||ms<0) return '';
  if(ms<60000) return 'moins d’1 min'; const m=Math.round(ms/60000); if(m<60) return `${m} min`;
  const h=Math.floor(m/60), r=m%60; return r?`${h} h ${String(r).padStart(2,'0')}`:`${h} h`;
}
export function ssProgressModel(st,now=Date.now()){
  const done=ssRequestDone(st);
  const step=!st||st.etat==='en attente'?'attente':done?'fin':st.etape==='extraction'?'extraction':st.etape==='correspondance'?'correspondance':'lecture';
  // v2.31.2 — phase « Lecture de Box » : avancement des dossiers parcourus (avant la liste des opérations).
  const scanning=step==='lecture'&&st?.lecture;
  const o=scanning?{fait:st.lecture.fait,total:st.lecture.total,courante:st.lecture.courant}:st?.operations||{}, f=scanning?{}:st?.fichiers||{}, total=o.total||0, fait=Math.min(o.fait||0,total);
  // Part de l'opération en cours comptée via ses documents : la barre avance aussi pendant une longue opération.
  const docShare=!done&&total&&fait<total&&f.total?Math.min(1,(f.fait||0)/f.total):0;
  const pct=done&&st.etat==='terminé'?100:total?Math.min(99.9,100*(fait+docShare)/total):0;
  const t0=Date.parse(st?.debut), tx=Date.parse(scanning?st?.debutLecture:st?.debutExtraction), tEnd=Date.parse(st?.finA||st?.majA);
  const elapsed=Number.isFinite(t0)?(done&&Number.isFinite(tEnd)?tEnd:now)-t0:NaN;
  const progressed=fait+docShare;
  const eta=!done&&Number.isFinite(tx)&&progressed>=0.5&&total?(now-tx)/progressed*(total-progressed):NaN;
  const par=st?.parOp||{}, list=!scanning&&Array.isArray(st?.contrats)?st.contrats:[];
  const current=String(o.courante||'').split(' · ')[0];
  const tiles=list.map((c,i)=>{ const r=par[c];
    let state=r?.r||(i<fait?'ok':'attente');
    if(!r&&!done&&(c===current||(!current&&i===fait&&step==='extraction'))) state='encours';
    if(!r&&done&&i>=fait) state=st.etat==='terminé'?'ok':'nontraite';
    const detail=r&&r.f!=null?` · ${r.f} fichier(s), ${r.x||0} extrait(s)${r.v?`, ${r.v} à vérifier`:''}${r.e?`, ${r.e} erreur(s)`:''}`:'';
    return {contract:c,state,title:`${c} — ${SS_TILE_LABEL[state]||state}${detail}`}; });
  const counts={}; for(const t of tiles) counts[t.state]=(counts[t.state]||0)+1;
  return {step,done,unit:scanning?'dossier(s) Box parcouru(s)':'opération(s)',etat:st?.etat||'en attente',pct:Math.round(pct*10)/10,total,fait,
    docs:f.total&&!done?{fait:f.fait||0,total:f.total,courant:f.courant||''}:null,
    current:(()=>{ const [c,...rest]=String(o.courante||'').split(' · '), folder=rest.join(' · '); return folder&&folder.replace(/\s/g,'').includes(c.replace(/\s/g,''))?folder:String(o.courante||''); })(),
    elapsed,eta,tiles,counts,stale:!done&&st?.majA?now-Date.parse(st.majA)>10*60000:false};
}
export const SS_TILE_LABEL={ok:'traitée',inchangé:'inchangée (sautée)',erreurs:'avec erreurs',vide:'sans document',interrompu:'interrompue',encours:'en cours',attente:'en attente',nontraite:'non traitée'};

// v2.32.0 — chargement au fil de l'eau : contrats dont l'analyse est finie (avec documents) et pas encore chargés dans l'appli.
export function ssContractsToLoad(st,loaded=new Set()){
  if(!st||!Array.isArray(st.contrats)) return [];
  const par=st.parOp||{}, finished=st.etat==='terminé';
  return st.contrats.filter(c=>!loaded.has(c)&&(finished?par[c]?.r!=='vide':['ok','erreurs','inchangé'].includes(par[c]?.r)));
}
