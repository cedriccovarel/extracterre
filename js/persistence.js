import {APP_VERSION} from './config.js';

const DB_NAME='extracterre-local-workspace';
const DB_VERSION=2;
const WORKSPACE_STORE='workspaces';
const DOCUMENT_STORE='documents';
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
    };
    // PDF/XML : une seule chaîne par page suffit pour restaurer la recherche libre et les tags.
    // Excel : conserver les cellules, nécessaires au parseur économique DPGF lors d'une restauration.
    if(hasCells) base.lines=lines.map(serializeLine);
    else base.text=String(page.text||lines.map(l=>String(l.text||'')).join('\n'));
    return base;
  });
  return {kind:read.kind||'',pageCount:Number.isFinite(read.pageCount)?read.pageCount:pages.length,pages,ocr:safeJsonClone(read.ocr,null)};
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
    ocrWarnings:safeJsonClone(doc.ocrWarnings,[]),
    targetedLastAt:doc.targetedLastAt||null,
    targetedLastProposals:Number.isFinite(doc.targetedLastProposals)?doc.targetedLastProposals:null,
    targetedLastOcrPages:Number.isFinite(doc.targetedLastOcrPages)?doc.targetedLastOcrPages:null,
    targetedRejectedKeys:safeJsonClone(doc.targetedRejectedKeys,[]),
    targetedStatus:doc.targetedStatus==='running'?null:(doc.targetedStatus||null),
    persistedAnalysis:hasAnalysis
  };
}
function hydrateDocMeta(meta={}){
  return {...meta,file:null,read:null,cachedOccurrences:null,status:meta.status||'missing'};
}

function serializeProject(project={}){
  return {
    id:project.id,
    label:project.label||'Projet',
    customTitle:project.customTitle||'',
    operationName:project.operationName||'',
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
    uncertainRejectedKeys:safeJsonClone(project.uncertainRejectedKeys,[]),
    manualEconomics:safeJsonClone(project.manualEconomics,{}),
    economic:safeJsonClone(project.economic,null),
    expanded:project.expanded!==false
  };
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
    analysisCachedAt:doc.analysisCachedAt||Date.now(),
    storageMode:minimal?'results-only':compact?'compact':'full-index'
  };
}
async function putDocumentRecord(record){
  const db=await openDb();
  try{
    const tx=db.transaction(DOCUMENT_STORE,'readwrite');
    tx.objectStore(DOCUMENT_STORE).put(record);
    await transactionDone(tx);
  } finally { db.close(); }
}
export async function saveDocumentCheckpoint(projectId,doc){
  if(!doc?.id) return {saved:false,mode:'none'};
  try{
    // Toujours écrire l'index compact : les objets géométriques PDF.js/OCR ne doivent jamais
    // être clonés vers IndexedDB, car la sérialisation peut doubler brutalement la RAM.
    await putDocumentRecord(serializeDocAnalysis(projectId,doc,true,false));
    return {saved:true,mode:'compact'};
  }catch(err){
    const quota=err?.name==='QuotaExceededError'||/quota/i.test(String(err?.message||''));
    if(!quota) throw err;
    await putDocumentRecord(serializeDocAnalysis(projectId,doc,true,true));
    return {saved:true,mode:'results-only'};
  }
}

async function getDocumentRecord(db,id){
  const tx=db.transaction(DOCUMENT_STORE,'readonly');
  const done=transactionDone(tx);
  const record=await requestPromise(tx.objectStore(DOCUMENT_STORE).get(id));
  await done;
  return record||null;
}
export async function loadWorkspaceSnapshot(){
  const db=await openDb();
  try{
    const tx=db.transaction(WORKSPACE_STORE,'readonly');
    const done=transactionDone(tx);
    const record=await requestPromise(tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY));
    await done;
    if(!record||record.schema!==SNAPSHOT_SCHEMA||!Array.isArray(record.projects)) return null;
    const projects=[];
    for(const rawProject of record.projects){
      const project={...rawProject,docs:[]};
      for(const meta of rawProject.docs||[]){
        const doc=hydrateDocMeta(meta);
        if(meta.persistedAnalysis){
          const saved=await getDocumentRecord(db,meta.id);
          if(saved){
            doc.read=hydrateRead(saved.read);
            doc.cachedOccurrences=Array.isArray(saved.cachedOccurrences)?saved.cachedOccurrences:[];
            doc.buildings=saved.buildings||doc.buildings;
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
    const tx=db.transaction(DOCUMENT_STORE,'readwrite');
    tx.objectStore(DOCUMENT_STORE).delete(docId);
    await transactionDone(tx);
  } finally { db.close(); }
}

export async function clearWorkspaceSnapshot(){
  const db=await openDb();
  try{
    const tx=db.transaction([WORKSPACE_STORE,DOCUMENT_STORE],'readwrite');
    tx.objectStore(WORKSPACE_STORE).delete(WORKSPACE_KEY);
    tx.objectStore(DOCUMENT_STORE).clear();
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

