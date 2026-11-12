import {APP_VERSION} from './config.js';

// v2.24.0 — l'espace « Import massif » (?espace=import) a sa propre base : la session actuelle n'est jamais touchée.
const DB_NAME=(()=>{ try{ return new URLSearchParams(globalThis.location?.search||'').get('espace')==='import'?'extracterre-import-workspace':'extracterre-local-workspace'; }catch{ return 'extracterre-local-workspace'; } })();
const DB_VERSION=3;
const WORKSPACE_STORE='workspaces';
const DOCUMENT_STORE='documents';
// v2.20.7 — texte des documents rangé à part : le démarrage ne charge plus le texte de toutes les opérations.
const READ_STORE='documentReads';
const READS_MIGRATED_KEY='reads-split-v1';
const JOURNAL_STORE='learningJournal';
const WORKSPACE_KEY='current';
const SNAPSHOT_SCHEMA=1;

function openDb(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){ reject(new Error('IndexedDB indisponible dans ce navigateur.')); return; }
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(WORKSPACE_STORE)) db.createObjectStore(WORKSPACE_STORE,{keyPath:'key'});
      if(!db.objectStoreNames.contains(DOCUMENT_STORE)){
        const store=db.createObjectStore(DOCUMENT_STORE,{keyPath:'id'});
        store.createIndex('projectId','projectId',{unique:false});
      }
      if(!db.objectStoreNames.contains(READ_STORE)) db.createObjectStore(READ_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(JOURNAL_STORE)){
        const journal=db.createObjectStore(JOURNAL_STORE,{keyPath:'id'});
        journal.createIndex('createdAt','createdAt',{unique:false});
        journal.createIndex('syncedAt','syncedAt',{unique:false});
        journal.createIndex('eventType','eventType',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Impossible d’ouvrir la base locale IndexedDB.'));
  });
}

function requestPromise(req){
  return new Promise((resolve,reject)=>{ req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('Erreur IndexedDB.')); });
}
function transactionDone(tx){
  return new Promise((resolve,reject)=>{ tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error||new Error('Transaction IndexedDB impossible.')); tx.onabort=()=>reject(tx.error||new Error('Transaction IndexedDB annulée.')); });
}
function safeJsonClone(value,fallback=null){
  if(value===undefined) return fallback;
  try{return JSON.parse(JSON.stringify(value));}catch{return fallback;}
}
function serializeLine(line={}){
  const out={index:Number.isFinite(line.index)?line.index:0,text:String(line.text||'')};
  if(Array.isArray(line.cells)) out.cells=line.cells.map(v=>v==null?'':String(v));
  if(line.ocr) out.ocr=true;
  return out;
}
function serializeRead(read){
  if(!read) return null;
  const pages=(read.pages||[]).map(page=>{
    const lines=page.lines||[];
    const hasCells=lines.some(line=>Array.isArray(line.cells));
    const base={
      page:page.page,
      ...(page.sheet?{sheet:page.sheet}:{}),
      ...(page.textSource?{textSource:page.textSource}:{}),
      ...(Number.isFinite(page.pdfTextQuality)?{pdfTextQuality:page.pdfTextQuality}:{}),
      ...(Number.isFinite(page.ocrConfidence)?{ocrConfidence:page.ocrConfidence}:{}),
      ...(Number.isFinite(page.re2020Building)?{re2020Building:page.re2020Building}:{}),
    };
    // PDF/XML : une seule chaîne par page suffit pour restaurer la recherche libre et les tags.
    // Excel : conserver les cellules, nécessaires au parseur économique DPGF lors d'une restauration.
    if(hasCells) base.lines=lines.map(serializeLine);
    else base.text=String(page.text||lines.map(l=>String(l.text||'')).join('\n'));
    return base;
  });
  return {kind:read.kind||'',pageCount:Number.isFinite(read.pageCount)?read.pageCount:pages.length,pages,ocr:safeJsonClone(read.ocr,null),...(read.re2020?{re2020:safeJsonClone(read.re2020,null),xmlFormat:read.xmlFormat||'re2020'}:{}),...(read.financialQuestionnaire?{financialQuestionnaire:safeJsonClone(read.financialQuestionnaire,null)}:{})};
}
function hydrateRead(read){
  if(!read) return null;
  const pages=(read.pages||[]).map(page=>{
    let lines;
    if(Array.isArray(page.lines)) lines=page.lines.map(line=>({...line,items:[]}));
    else lines=String(page.text||'').split(/\r?\n/).filter(Boolean).map((text,index)=>({index,text,items:[]}));
    const text=String(page.text||lines.map(l=>l.text||'').join('\n'));
    return {...page,text,lines};
  });
  return {...read,pages,text:pages.map(p=>p.text).join('\n\f\n'),retainedCompact:true};
}

function serializeDocMeta(doc={}){
  const hasAnalysis=Array.isArray(doc.cachedOccurrences)||!!doc.read;
  const status=doc.status==='reading'?'missing':(!hasAnalysis&&doc.status==='pending'?'missing':doc.status);
  return {
    id:doc.id,
    name:doc.name||'',
    size:Number(doc.size)||0,
    relativePath:doc.relativePath||doc.name||'',
    type:doc.type||'En attente',
    classification:safeJsonClone(doc.classification,null),
    status:status||'missing',
    error:doc.error||null,
    buildings:safeJsonClone(doc.buildings,null),
    analysisCachedAt:doc.analysisCachedAt||null,
    // v2.19.3 — rattrapages déjà faits (voir analyzeDocuments).
    rsetAddressRead:!!doc.rsetAddressRead,
    dhZonesRead:!!doc.dhZonesRead,
    fanRead:Number(doc.fanRead)||0,
    bldRead:Number(doc.bldRead)||0,
    lowText:typeof doc.lowText==='boolean'?doc.lowText:undefined,
    climaWinInput:typeof doc.climaWinInput==='boolean'?doc.climaWinInput:undefined,
    ocrWarnings:safeJsonClone(doc.ocrWarnings,[]),
    targetedLastAt:doc.targetedLastAt||null,
    targetedLastProposals:Number.isFinite(doc.targetedLastProposals)?doc.targetedLastProposals:null,
    targetedLastOcrPages:Number.isFinite(doc.targetedLastOcrPages)?doc.targetedLastOcrPages:null,
    targetedRejectedKeys:safeJsonClone(doc.targetedRejectedKeys,[]),
    targetedStatus:doc.targetedStatus==='running'?null:(doc.targetedStatus||null),
    processingLocation:doc.processingLocation||null,
    remoteAnalysis:safeJsonClone(doc.remoteAnalysis,null),
    cloudFallback:doc.cloudFallback||null,
    specializedFamily:doc.specializedFamily||'annex',
    specializedLabel:doc.specializedLabel||'',
    families:safeJsonClone(doc.families,null),
    familyMode:doc.familyMode||'auto',
    importKey:doc.importKey||'',
    importSha:doc.importSha||'',
    llmProposals:safeJsonClone(doc.llmProposals,null),
    persistedAnalysis:hasAnalysis
  };
}
// v2.19.2 — texte des documents préparé à la première lecture seulement (recherches, relecture) : au démarrage, 280 opérations
// ne découpent plus des milliers de pages en lignes. La valeur enregistrée reste brute jusque-là.
// v2.20.7 — texte d'un document : chargé (valeur brute préparée à la première lecture), ou seulement enregistré
// (magasin documentReads) et rechargé à la demande par loadDocumentReads. Toute affectation de doc.read marque le
// texte comme à réenregistrer : il n'est jamais déchargé avant d'avoir été écrit.
const readSlots=new WeakMap();
function installRead(doc,slot){
  readSlots.set(doc,slot);
  Object.defineProperty(doc,'read',{configurable:true,enumerable:true,
    get(){ if(slot.raw){ slot.value=hydrateRead(slot.raw); slot.raw=null; } return slot.value; },
    set(v){ slot.value=v; slot.raw=null; slot.loaded=true; slot.stored=false; slot.gen=(slot.gen||0)+1; }});
}
function lazyRead(doc,raw,stored=false){ installRead(doc,{value:null,raw:raw||null,loaded:true,stored}); }
// Document dont le texte est enregistré mais pas chargé.
function storedRead(doc){ installRead(doc,{value:null,raw:null,loaded:false,stored:true}); }
export function docReadLoaded(doc){ const s=doc&&readSlots.get(doc); return !s||s.loaded; }
export function docReadStored(doc){ return !!(doc&&readSlots.get(doc)?.stored); }
// Libère le texte d'un document déjà enregistré ; sans effet s'il reste à écrire.
export function unloadDocumentRead(doc){ const s=doc&&readSlots.get(doc); if(!s||!s.stored||!s.loaded) return false; s.value=null; s.raw=null; s.loaded=false; return true; }
function hydrateDocMeta(meta={}){
  return {...meta,file:null,read:null,cachedOccurrences:null,status:meta.status||'missing'};
}

function serializeProject(project={}){
  return {
    id:project.id,
    label:project.label||'Projet',
    customTitle:project.customTitle||'',
    operationName:project.operationName||'',
    lastOpenedAt:Number(project.lastOpenedAt)||0,
    salesforceImports:Array.isArray(project.salesforceImports)?project.salesforceImports.slice(-50).map(i=>({at:Number(i?.at)||0,values:Number(i?.values)||0})):[], // v2.20.7 // v2.20.3 — « Derniers projets ouverts »
    analysisRuns:Array.isArray(project.analysisRuns)?project.analysisRuns.slice(-50).map(r=>({at:Number(r?.at)||0,docs:Number(r?.docs)||0,newDocs:Number(r?.newDocs)||0})):[], // v2.21.0
    docs:(project.docs||[]).map(serializeDocMeta),
    // Le résultat consolidé est recalculé à la restauration depuis les occurrences checkpointées.
    // Ne pas le dupliquer ici évite une copie mémoire potentiellement massive à chaque sauvegarde.
    result:null,
    buildingOverrides:safeJsonClone(project.buildingOverrides,{}),
    deletedBuildings:safeJsonClone(project.deletedBuildings,[]),
    manualTags:safeJsonClone(project.manualTags,[]),
    projectTags:safeJsonClone(project.projectTags,[]),
    manualValues:safeJsonClone(project.manualValues,{}),
    manualSources:safeJsonClone(project.manualSources,{}),
    manualPasteRaw:project.manualPasteRaw||'',
    manualPasteRows:safeJsonClone(project.manualPasteRows,[]),
    manualPasteColumns:safeJsonClone(project.manualPasteColumns,[]),
    retainedOccurrences:safeJsonClone(project.retainedOccurrences,[]),
    uncertainRejectedKeys:safeJsonClone(project.uncertainRejectedKeys,[]),
    manualEconomics:safeJsonClone(project.manualEconomics,{}),
    economic:safeJsonClone(project.economic,null),
    searchOverrides:safeJsonClone(project.searchOverrides,{}),
    searchCache:safeJsonClone(project.searchCache,{}),
    tileCache:safeJsonClone(project.tileCache,null),
    geocodes:safeJsonClone(project.geocodes,{}),
    freePasteRows:safeJsonClone(project.freePasteRows,[]),
    planTables:safeJsonClone(project.planTables,{}),
    planChecks:safeJsonClone(project.planChecks,{}),
    favorite:!!project.favorite,
    ownerName:project.ownerName||'',
    // v2.24.0 — opération alimentée par l'import massif (contrat, dossier, dernière mise à jour).
    // v2.24.3 — documents déchargés de l'onglet Économie (restent dans l'opération pour les autres colonnes).
    economicExcluded:safeJsonClone(project.economicExcluded,[]),
    importContract:project.importContract||'',
    importFolder:project.importFolder||'',
    importSyncedAt:project.importSyncedAt||null,
    expanded:project.expanded!==false
  };
}

// v2.12.1 — projet complet pour l'export JSON de session : métadonnées + lecture compacte et occurrences de chaque
// document (comme le checkpoint IndexedDB), afin qu'un import restitue toutes les données sans les fichiers sources.
export function serializeProjectFull(project={}){
  const docs=project.docs||[];
  return {...serializeProject(project),docs:docs.map(d=>({...serializeDocMeta(d),analysis:Array.isArray(d.cachedOccurrences)||d.read?serializeDocAnalysis(project.id,d,true,false):null}))};
}
export function hydrateProjectFull(raw={}){
  return {...raw,docs:(raw.docs||[]).map(({analysis,...meta})=>{ const doc=hydrateDocMeta(meta);
    if(analysis){ doc.read=hydrateRead(analysis.read); doc.cachedOccurrences=Array.isArray(analysis.cachedOccurrences)?analysis.cachedOccurrences:[];
      for(const k of ['buildings','classification','type','specializedFamily','specializedLabel','families','familyMode','analysisCachedAt']) if(analysis[k]!=null) doc[k]=analysis[k];
      doc.persistenceMode=analysis.storageMode||'compact'; doc.status='ready'; }
    else doc.status='missing';
    return doc; })};
}
export async function saveWorkspaceSnapshot({projects=[],activeProjectId=null,activeTab='summary'}={}){
  const record={
    key:WORKSPACE_KEY,
    schema:SNAPSHOT_SCHEMA,
    appVersion:APP_VERSION,
    savedAt:Date.now(),
    activeProjectId,
    activeTab,
    projects:projects.map(serializeProject)
  };
  const db=await openDb();
  try{
    const tx=db.transaction(WORKSPACE_STORE,'readwrite');
    tx.objectStore(WORKSPACE_STORE).put(record);
    await transactionDone(tx);
  } finally { db.close(); }
  return {savedAt:record.savedAt,projects:record.projects.length};
}

function serializeDocAnalysis(projectId,doc,compact=false,minimal=false){
  return {
    id:doc.id,
    projectId,
    savedAt:Date.now(),
    appVersion:APP_VERSION,
    read:minimal?null:serializeRead(doc.read),
    cachedOccurrences:Array.isArray(doc.cachedOccurrences)?doc.cachedOccurrences:[],
    buildings:safeJsonClone(doc.buildings,null),
    classification:safeJsonClone(doc.classification,null),
    type:doc.type||'En attente',
    specializedFamily:doc.specializedFamily||'annex',
    specializedLabel:doc.specializedLabel||'',
    families:safeJsonClone(doc.families,null),
    familyMode:doc.familyMode||'auto',
    analysisCachedAt:doc.analysisCachedAt||Date.now(),
    storageMode:minimal?'results-only':compact?'compact':'full-index'
  };
}
async function putDocumentRecord(record,read){
  const db=await openDb();
  try{
    const tx=db.transaction([DOCUMENT_STORE,READ_STORE],'readwrite');
    tx.objectStore(DOCUMENT_STORE).put(record);
    if(read!==undefined) tx.objectStore(READ_STORE).put({id:record.id,read});
    await transactionDone(tx);
  } finally { db.close(); }
}
export async function saveDocumentCheckpoint(projectId,doc){
  if(!doc?.id) return {saved:false,mode:'none'};
  try{
    // Toujours écrire l'index compact : les objets géométriques PDF.js/OCR ne doivent jamais
    // être clonés vers IndexedDB, car la sérialisation peut doubler brutalement la RAM.
    // v2.20.7 — le texte va dans documentReads ; s'il n'est pas chargé (opération fermée), celui enregistré reste en place.
    // Un texte réaffecté pendant l'écriture (génération changée) reste « à écrire ».
    const loaded=docReadLoaded(doc), slot=loaded?trackRead(doc):null, gen=slot?.gen, read=loaded?serializeRead(doc.read):undefined;
    await putDocumentRecord(serializeDocAnalysis(projectId,doc,true,true),read);
    if(slot&&slot.gen===gen) slot.stored=read!==null;
    return {saved:true,mode:'compact'};
  }catch(err){
    const quota=err?.name==='QuotaExceededError'||/quota/i.test(String(err?.message||''));
    if(!quota) throw err;
    // Quota dépassé : résultats seuls ; le texte reste en mémoire (jamais déchargé, puisqu'il n'est pas enregistré).
    await putDocumentRecord(serializeDocAnalysis(projectId,doc,true,true),null);
    if(docReadLoaded(doc)) trackRead(doc).stored=false;
    return {saved:true,mode:'results-only'};
  }
}
// Texte suivi par un accesseur (un document lu dans cette session a une simple propriété read).
function trackRead(doc){
  const cur=readSlots.get(doc); if(cur) return cur;
  const slot={value:doc.read,raw:null,loaded:true,stored:false,gen:0}; installRead(doc,slot); return slot;
}

async function getDocumentRecord(db,id){
  const tx=db.transaction(DOCUMENT_STORE,'readonly');
  const done=transactionDone(tx);
  const record=await requestPromise(tx.objectStore(DOCUMENT_STORE).get(id));
  await done;
  return record||null;
}
async function getDocumentRecords(db,ids,onProgress){
  const out=new Map(); if(!ids.length) return out;
  const tx=db.transaction(DOCUMENT_STORE,'readonly'), store=tx.objectStore(DOCUMENT_STORE), done=transactionDone(tx);
  let n=0; await Promise.all(ids.map(id=>requestPromise(store.get(id)).then(r=>{ if(r) out.set(id,r); n++; if(onProgress&&(n%25===0||n===ids.length)) onProgress(n,ids.length); })));
  await done; return out;
}
// v2.20.7 — une fois : le texte des documents déjà enregistrés passe de « documents » à « documentReads », document par
// document (curseur), sans rien perdre. Un enregistrement d'une version plus ancienne (texte dans « documents ») est
// déplacé de la même façon au démarrage suivant.
async function migrateReadsOut(db){
  const tx=db.transaction([DOCUMENT_STORE,READ_STORE,WORKSPACE_STORE],'readwrite'), done=transactionDone(tx);
  const docs=tx.objectStore(DOCUMENT_STORE), reads=tx.objectStore(READ_STORE), ws=tx.objectStore(WORKSPACE_STORE);
  let moved=0;
  await new Promise((resolve,reject)=>{ const req=docs.openCursor(); req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{ const c=req.result; if(!c){ resolve(); return; } const r=c.value;
      if(r&&r.read){ reads.put({id:r.id,read:r.read}); c.update({...r,read:null}); moved++; }
      c.continue(); }; });
  ws.put({key:READS_MIGRATED_KEY,at:Date.now(),moved});
  await done; return moved;
}
// Textes enregistrés des documents demandés (ceux qui ne sont pas chargés), en une transaction ; renvoie le nombre chargé.
export async function loadDocumentReads(docs){
  const todo=(docs||[]).filter(d=>d&&!docReadLoaded(d)); if(!todo.length) return 0;
  const db=await openDb();
  try{
    const tx=db.transaction(READ_STORE,'readonly'), store=tx.objectStore(READ_STORE), done=transactionDone(tx);
    const recs=await Promise.all(todo.map(d=>requestPromise(store.get(d.id))));
    await done;
    let n=0; todo.forEach((d,i)=>{ const s=readSlots.get(d); if(!s||s.loaded) return; s.raw=recs[i]?.read||null; s.value=null; s.loaded=true; s.stored=!!recs[i]?.read; n++; });
    return n;
  } finally { db.close(); }
}
export async function loadWorkspaceSnapshot(onProgress=null){
  const db=await openDb();
  try{
    { const tx=db.transaction(WORKSPACE_STORE,'readonly'), done=transactionDone(tx); const flag=await requestPromise(tx.objectStore(WORKSPACE_STORE).get(READS_MIGRATED_KEY)); await done;
      // Après la migration, un document écrit par une version antérieure (onglet resté ouvert) peut encore porter son texte : repris ci-dessous.
      if(!flag) await migrateReadsOut(db); }
    const tx=db.transaction(WORKSPACE_STORE,'readonly');
    const done=transactionDone(tx);
    const record=await requestPromise(tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY));
    await done;
    if(!record||record.schema!==SNAPSHOT_SCHEMA||!Array.isArray(record.projects)) return null;
    const projects=[];
    // v2.19.2 — tous les documents enregistrés lus dans une seule transaction (avant : une transaction attendue par document).
    const ids=record.projects.flatMap(p=>(p.docs||[]).filter(m=>m.persistedAnalysis).map(m=>m.id));
    const savedById=await getDocumentRecords(db,ids,onProgress);
    const legacy=[...savedById.values()].filter(r=>r.read);
    if(legacy.length){ const tx=db.transaction([DOCUMENT_STORE,READ_STORE],'readwrite'), done=transactionDone(tx);
      for(const r of legacy){ tx.objectStore(READ_STORE).put({id:r.id,read:r.read}); tx.objectStore(DOCUMENT_STORE).put({...r,read:null}); }
      await done; for(const r of legacy) r.read=null; }
    let storedIds; { const tx=db.transaction(READ_STORE,'readonly'), done=transactionDone(tx); storedIds=new Set(await requestPromise(tx.objectStore(READ_STORE).getAllKeys())); await done; }
    for(const rawProject of record.projects){
      const project={...rawProject,docs:[]};
      for(const meta of rawProject.docs||[]){
        const doc=hydrateDocMeta(meta);
        if(meta.persistedAnalysis){
          const saved=savedById.get(meta.id);
          if(saved){
            // v2.20.7 — texte laissé sur le disque : chargé à l'ouverture de l'opération (loadDocumentReads).
            if(storedIds.has(meta.id)) storedRead(doc); else lazyRead(doc,null);
            doc.cachedOccurrences=Array.isArray(saved.cachedOccurrences)?saved.cachedOccurrences:[];
            doc.buildings=saved.buildings||doc.buildings;
            doc.specializedFamily=saved.specializedFamily||doc.specializedFamily||'annex';
            doc.specializedLabel=saved.specializedLabel||doc.specializedLabel||'';
            doc.classification=saved.classification||doc.classification;
            doc.type=saved.type||doc.type;
            doc.analysisCachedAt=saved.analysisCachedAt||doc.analysisCachedAt;
            doc.persistenceMode=saved.storageMode||'full-index';
            doc.status='ready';
          }else if(!doc.result){ doc.status='missing'; }
        }else if(!doc.file){ doc.status='missing'; }
        project.docs.push(doc);
      }
      projects.push(project);
    }
    return {...record,projects};
  } finally { db.close(); }
}

export async function deleteDocumentCheckpoint(docId){
  if(!docId) return;
  const db=await openDb();
  try{
    const tx=db.transaction([DOCUMENT_STORE,READ_STORE],'readwrite');
    tx.objectStore(DOCUMENT_STORE).delete(docId);
    tx.objectStore(READ_STORE).delete(docId);
    await transactionDone(tx);
  } finally { db.close(); }
}

export async function clearWorkspaceSnapshot(){
  const db=await openDb();
  try{
    const tx=db.transaction([WORKSPACE_STORE,DOCUMENT_STORE,READ_STORE],'readwrite');
    tx.objectStore(WORKSPACE_STORE).delete(WORKSPACE_KEY);
    tx.objectStore(DOCUMENT_STORE).clear();
    tx.objectStore(READ_STORE).clear();
    await transactionDone(tx);
  } finally { db.close(); }
}

export async function getWorkspaceStorageInfo(){
  try{
    const estimate=await navigator.storage?.estimate?.();
    const persisted=await navigator.storage?.persisted?.();
    return {supported:true,usage:estimate?.usage||0,quota:estimate?.quota||0,persisted:!!persisted};
  }catch{return {supported:!!globalThis.indexedDB,usage:0,quota:0,persisted:false};}
}

export async function requestPersistentStorage(){
  try{return !!(await navigator.storage?.persist?.());}catch{return false;}
}

function makeJournalId(){
  try{return `evt-${Date.now()}-${crypto.randomUUID()}`;}catch{return `evt-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;}
}
function compactJournalPayload(value,depth=0){
  if(depth>5) return '[profondeur limitée]';
  if(value===null||value===undefined) return value??null;
  if(typeof value==='string') return value.length>900?`${value.slice(0,900)}…`:value;
  if(typeof value==='number'||typeof value==='boolean') return value;
  if(Array.isArray(value)) return value.slice(0,220).map(v=>compactJournalPayload(v,depth+1));
  if(typeof value==='object'){
    const out={}; let n=0;
    for(const [k,v] of Object.entries(value)){
      if(++n>120){ out.__truncated=true; break; }
      out[k]=compactJournalPayload(v,depth+1);
    }
    return out;
  }
  return String(value);
}
export async function appendLearningEvent(event={}){
  const record={
    id:event.id||makeJournalId(),
    schema:1,
    appVersion:event.appVersion||APP_VERSION,
    createdAt:Number(event.createdAt)||Date.now(),
    eventType:String(event.eventType||'event'),
    projectRef:String(event.projectRef||''),
    instanceId:String(event.instanceId||''),
    accessRole:String(event.accessRole||''),
    payload:compactJournalPayload(event.payload||{}),
    syncedAt:event.syncedAt||null,
    syncError:null
  };
  const db=await openDb();
  try{
    const tx=db.transaction(JOURNAL_STORE,'readwrite');
    tx.objectStore(JOURNAL_STORE).put(record);
    await transactionDone(tx);
  }finally{db.close();}
  return record;
}
export async function listLearningEvents({unsyncedOnly=false,limit=50000}={}){
  const db=await openDb();
  try{
    const tx=db.transaction(JOURNAL_STORE,'readonly');
    const done=transactionDone(tx);
    const all=await requestPromise(tx.objectStore(JOURNAL_STORE).getAll());
    await done;
    const rows=(all||[]).filter(x=>!unsyncedOnly||!x.syncedAt).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    return rows.slice(Math.max(0,rows.length-Math.max(1,limit)));
  }finally{db.close();}
}
export async function getLearningJournalStats(){
  const events=await listLearningEvents({limit:50000});
  return {
    total:events.length,
    unsynced:events.filter(x=>!x.syncedAt).length,
    firstAt:events[0]?.createdAt||null,
    lastAt:events[events.length-1]?.createdAt||null,
    byType:events.reduce((acc,e)=>(acc[e.eventType]=(acc[e.eventType]||0)+1,acc),{})
  };
}
export async function markLearningEventsSynced(ids=[],syncedAt=Date.now()){
  const wanted=new Set(ids||[]); if(!wanted.size) return 0;
  const db=await openDb(); let count=0;
  try{
    const tx=db.transaction(JOURNAL_STORE,'readwrite');
    const store=tx.objectStore(JOURNAL_STORE);
    for(const id of wanted){
      const record=await requestPromise(store.get(id));
      if(record){ record.syncedAt=syncedAt; record.syncError=null; store.put(record); count++; }
    }
    await transactionDone(tx);
  }finally{db.close();}
  return count;
}
export async function markLearningEventsSyncError(ids=[],message=''){
  const wanted=new Set(ids||[]); if(!wanted.size) return 0;
  const db=await openDb(); let count=0;
  try{
    const tx=db.transaction(JOURNAL_STORE,'readwrite');
    const store=tx.objectStore(JOURNAL_STORE);
    for(const id of wanted){
      const record=await requestPromise(store.get(id));
      if(record){ record.syncError=String(message||'').slice(0,500); store.put(record); count++; }
    }
    await transactionDone(tx);
  }finally{db.close();}
  return count;
}

