import {normLower,normalizeText} from './utils.js';

const LEARNING_DB_NAME='extracterre-learning-memory';
const LEARNING_DB_VERSION=1;
const LEARNING_SIGNAL_STORE='signals';
const LEARNING_SETTINGS_STORE='settings';
const cache={ready:false,signals:new Map(),profiles:[],disabled:new Set()};

function openLearningDb(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){ reject(new Error('IndexedDB indisponible.')); return; }
    const req=indexedDB.open(LEARNING_DB_NAME,LEARNING_DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(LEARNING_SIGNAL_STORE)){
        const s=db.createObjectStore(LEARNING_SIGNAL_STORE,{keyPath:'id'});
        s.createIndex('field','field',{unique:false}); s.createIndex('docType','docType',{unique:false}); s.createIndex('createdAt','createdAt',{unique:false});
      }
      if(!db.objectStoreNames.contains(LEARNING_SETTINGS_STORE)) db.createObjectStore(LEARNING_SETTINGS_STORE,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('Mémoire d’apprentissage indisponible.'));
  });
}
function reqP(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Erreur IndexedDB apprentissage.'));});}
function txP(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Transaction apprentissage impossible.'));tx.onabort=()=>reject(tx.error||new Error('Transaction apprentissage annulée.'));});}
function safe(v=''){return normalizeText(String(v||'')).trim();}
function anchorText(signal={}){return safe([signal.beforeLine,signal.lineText,signal.afterLine].filter(Boolean).join(' | '));}
function anchorTokens(text=''){
  return [...new Set(normLower(text).replace(/\d+(?:[.,]\d+)?/g,' ').replace(/[^a-zà-ÿ0-9]+/gi,' ').split(/\s+/).filter(t=>t.length>=3&&!/^(?:page|bâtiment|batiment|ligne|valeur|total)$/.test(t)))].slice(0,70);
}
function similarityTokens(a=[],b=[]){if(!a.length||!b.length)return 0;const A=new Set(a),B=new Set(b);let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(1,new Set([...A,...B]).size);}
function locationSimilarity(a,b){
  if(a.field!==b.field||String(a.docType||'')!==String(b.docType||'')) return 0;
  const text=similarityTokens(a.tokens||anchorTokens(a.anchor||''),b.tokens||anchorTokens(b.anchor||''));
  const pageA=Number(a.page),pageB=Number(b.page); let page=0;
  if(Number.isFinite(pageA)&&Number.isFinite(pageB)) page=Math.max(0,1-Math.abs(pageA-pageB)/5);
  const ratioA=Number(a.lineRatio),ratioB=Number(b.lineRatio); let ratio=0;
  if(Number.isFinite(ratioA)&&Number.isFinite(ratioB)) ratio=Math.max(0,1-Math.abs(ratioA-ratioB)/0.35);
  return Math.min(1,text*.72+page*.12+ratio*.16);
}
function profileReliability(p){return (p.confirmations+1)/(p.confirmations+p.rejections+2);}
function baseBoost(p){
  const n=p.confirmations,r=profileReliability(p); if(n<2||r<.55) return 0;
  const b=n>=10?.075:n>=5?.055:n>=3?.035:.018; return Math.max(0,b*Math.min(1,(r-.45)/.45));
}
function rebuildProfiles(){
  const groups=[];
  const signals=[...cache.signals.values()].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  for(const s of signals){
    if(!s?.field||!s?.docType) continue;
    const probe={field:s.field,docType:s.docType,page:s.page,lineRatio:s.lineRatio,anchor:anchorText(s),tokens:anchorTokens(anchorText(s))};
    let best=null,bestScore=0;
    for(const p of groups){const score=locationSimilarity(probe,p);if(score>bestScore){best=p;bestScore=score;}}
    if(!best||bestScore<.52){
      best={id:`profile-${groups.length+1}`,seedId:s.id,field:s.field,docType:s.docType,anchor:probe.anchor,tokens:probe.tokens,page:Number(s.page)||null,lineRatio:Number.isFinite(Number(s.lineRatio))?Number(s.lineRatio):null,confirmations:0,rejections:0,lastAt:0,samples:[],disabled:false}; groups.push(best);
    }
    if(s.polarity==='negative') best.rejections++; else best.confirmations++;
    best.lastAt=Math.max(best.lastAt,Number(s.createdAt)||0); if(best.samples.length<5) best.samples.push({page:s.page,lineText:s.lineText,selectedText:s.selectedText,polarity:s.polarity||'positive'});
    if(s.polarity!=='negative' && bestScore>=.52){ best.anchor=probe.anchor||best.anchor; best.tokens=probe.tokens.length?probe.tokens:best.tokens; if(Number.isFinite(Number(s.page))) best.page=Number(s.page); if(Number.isFinite(Number(s.lineRatio))) best.lineRatio=Number(s.lineRatio); }
  }
  for(const p of groups){ p.reliability=profileReliability(p); p.boost=baseBoost(p); p.disabled=cache.disabled.has(profileKey(p)); }
  cache.profiles=groups.sort((a,b)=>b.confirmations-a.confirmations||b.reliability-a.reliability);
}
function profileKey(p){return `${p.field}|${p.docType}|${p.seedId||normLower(p.anchor||'').slice(0,180)}`;}
async function putSignal(signal){
  const db=await openLearningDb(); try{const tx=db.transaction(LEARNING_SIGNAL_STORE,'readwrite');tx.objectStore(LEARNING_SIGNAL_STORE).put(signal);await txP(tx);}finally{db.close();}
}
function makeId(){try{return `learn-${Date.now()}-${crypto.randomUUID()}`;}catch{return `learn-${Date.now()}-${Math.random().toString(36).slice(2)}`;}}
export async function initializeLearningMemory(){
  const db=await openLearningDb(); try{
    const tx=db.transaction([LEARNING_SIGNAL_STORE,LEARNING_SETTINGS_STORE],'readonly'); const signals=await reqP(tx.objectStore(LEARNING_SIGNAL_STORE).getAll()); const disabled=await reqP(tx.objectStore(LEARNING_SETTINGS_STORE).get('disabledProfiles')); await txP(tx);
    cache.signals=new Map((signals||[]).map(s=>[s.id,s])); cache.disabled=new Set(disabled?.value||[]); cache.ready=true; rebuildProfiles(); return getLearningMemoryStats();
  }finally{db.close();}
}
export async function reinforceLearningLocation(location={},meta={}){
  const signal={id:String(meta.eventId||makeId()),createdAt:Number(meta.createdAt)||Date.now(),polarity:'positive',field:String(meta.field||location.field||''),docType:String(meta.docType||location.docType||''),document:String(location.document||meta.document||''),page:Number(location.page)||null,pageRatio:Number.isFinite(Number(location.pageRatio))?Number(location.pageRatio):null,lineIndex:Number.isFinite(Number(location.lineIndex))?Number(location.lineIndex):null,lineRatio:Number.isFinite(Number(location.lineRatio))?Number(location.lineRatio):null,lineText:safe(location.lineText),beforeLine:safe(location.beforeLine),afterLine:safe(location.afterLine),selectedText:safe(location.selectedText),building:String(meta.building||''),source:'user-highlight'};
  if(!signal.field||!signal.docType) return null; if(cache.signals.has(signal.id)) return signal; await putSignal(signal); cache.signals.set(signal.id,signal); rebuildProfiles(); return signal;
}
export async function penalizeLearningLocation(location={},meta={}){
  const signal={id:String(meta.eventId||makeId()),createdAt:Number(meta.createdAt)||Date.now(),polarity:'negative',field:String(meta.field||location.field||''),docType:String(meta.docType||location.docType||''),document:String(location.document||meta.document||''),page:Number(location.page)||null,lineRatio:Number.isFinite(Number(location.lineRatio))?Number(location.lineRatio):null,lineText:safe(location.lineText||meta.lineText),beforeLine:safe(location.beforeLine),afterLine:safe(location.afterLine),selectedText:safe(location.selectedText||meta.selectedText),building:String(meta.building||''),source:'user-rejection'};
  if(!signal.field||!signal.docType) return null; if(cache.signals.has(signal.id)) return signal; await putSignal(signal); cache.signals.set(signal.id,signal); rebuildProfiles(); return signal;
}
export function applyLearningBoosts(raw=[]){
  if(!cache.ready||!cache.profiles.length) return raw;
  return raw.map(o=>{
    if(!o?.field||!o?.docType||o.userValidated) return o;
    const probe={field:o.field,docType:o.docType,page:o.page,lineRatio:o.lineRatio,anchor:safe(o.excerpt||o.lineText||''),tokens:anchorTokens(o.excerpt||o.lineText||'')};
    let best=null,match=0; for(const p of cache.profiles){if(p.disabled||p.boost<=0)continue;const s=locationSimilarity(probe,p);if(s>match){best=p;match=s;}}
    if(!best||match<.42) return o;
    const boost=Math.min(.08,best.boost*Math.min(1,match/.72)); if(boost<=.002) return o;
    return {...o,confidence:Math.min(1,Number(o.confidence||0)+boost),learningBoost:boost,learningMatch:match,learningConfirmations:best.confirmations,learningReliability:best.reliability,learningProfile:profileKey(best)};
  });
}
export async function importRemoteLearningEvents(events=[]){
  let added=0;
  for(const e of events||[]){ if(!e?.id||cache.signals.has(e.id)) continue; const p=e.payload||{}; if(e.eventType==='parser_location_learning'){await reinforceLearningLocation(p,{eventId:e.id,createdAt:e.createdAt,field:p.field,docType:p.docType,building:p.building});added++;} else if(e.eventType==='parser_location_rejection'){await penalizeLearningLocation(p,{eventId:e.id,createdAt:e.createdAt,field:p.field,docType:p.docType,building:p.building});added++;} }
  return added;
}
export function listLearningProfiles(){return cache.profiles.map(p=>({...p,key:profileKey(p)}));}
export function getLearningMemoryStats(){const active=cache.profiles.filter(p=>!p.disabled);return {ready:cache.ready,signals:cache.signals.size,profiles:cache.profiles.length,activeProfiles:active.length,strongProfiles:active.filter(p=>p.confirmations>=5&&p.reliability>=.7).length};}
export async function setLearningProfileEnabled(key,enabled=true){
  if(enabled) cache.disabled.delete(key); else cache.disabled.add(key);
  const db=await openLearningDb(); try{const tx=db.transaction(LEARNING_SETTINGS_STORE,'readwrite');tx.objectStore(LEARNING_SETTINGS_STORE).put({key:'disabledProfiles',value:[...cache.disabled]});await txP(tx);}finally{db.close();} rebuildProfiles(); return getLearningMemoryStats();
}
export async function clearLearningMemory(){
  const db=await openLearningDb(); try{const tx=db.transaction([LEARNING_SIGNAL_STORE,LEARNING_SETTINGS_STORE],'readwrite');tx.objectStore(LEARNING_SIGNAL_STORE).clear();tx.objectStore(LEARNING_SETTINGS_STORE).clear();await txP(tx);}finally{db.close();} cache.signals.clear();cache.disabled.clear();rebuildProfiles();return getLearningMemoryStats();
}

export function __learningMemoryTestProfile(confirmations=5,rejections=0){ const p={field:'cep',docType:'RSET RE2020',anchor:'chapitre exigences cep maximum consommation energie',tokens:anchorTokens('chapitre exigences cep maximum consommation energie'),page:5,lineRatio:.4,confirmations,rejections}; p.reliability=profileReliability(p);p.boost=baseBoost(p);p.disabled=false;return p;}
export function __learningMemoryTestSimilarity(a,b){return locationSimilarity(a,b);}
