import {APP_VERSION} from './config.js';
const CLOUD_CONFIG_STORAGE_KEY='extracterre-cloud-config-v2';
const CLOUD_AUTH_STORAGE_KEY='extracterre-cloud-auth-v2';
const CLOUD_EXECUTION_MODE_KEY='extracterre-execution-mode-v2';
export const CLOUD_MODES=Object.freeze({
  auto:{key:'auto',label:'Hybride auto',description:'PDF lourds/OCR sur serveur ; petits documents localement'},
  local:{key:'local',label:'Local',description:'Tout analyser sur cet ordinateur'},
  remote:{key:'remote',label:'Serveur',description:'PDF envoyés au worker distant ; autres formats locaux'}
});
let cloudClient=null;

const CLOUD_MAX_CONCURRENCY=1;
let cloudActive=0;
const cloudWaiters=[];
function acquireCloudSlot(signal,onProgress=()=>{}){
  if(cloudActive<CLOUD_MAX_CONCURRENCY){ cloudActive++; return Promise.resolve(()=>releaseCloudSlot()); }
  onProgress(.005,{stage:'cloud-wait',message:'Cloud · attente du créneau gratuit'});
  return new Promise((resolve,reject)=>{
    const waiter={resolve,reject,signal,onAbort:null};
    waiter.onAbort=()=>{
      const i=cloudWaiters.indexOf(waiter); if(i>=0) cloudWaiters.splice(i,1);
      const e=new Error('Analyse distante interrompue.'); e.name='AbortError'; reject(e);
    };
    signal?.addEventListener?.('abort',waiter.onAbort,{once:true});
    cloudWaiters.push(waiter);
  });
}
function releaseCloudSlot(){
  cloudActive=Math.max(0,cloudActive-1);
  while(cloudWaiters.length){
    const waiter=cloudWaiters.shift();
    if(waiter.signal?.aborted) continue;
    waiter.signal?.removeEventListener?.('abort',waiter.onAbort);
    cloudActive++;
    waiter.resolve(()=>releaseCloudSlot());
    break;
  }
}

function defaultCloudConfig(){
  const cfg=globalThis.EXTRACTERRE_CLOUD_CONFIG||{};
  return {
    supabaseUrl:String(cfg.supabaseUrl||'').trim().replace(/\/$/,''),
    supabasePublishableKey:String(cfg.supabasePublishableKey||'').trim(),
    functions:{
      createJob:String(cfg.functions?.createJob||'extracterre-create-job'),
      startJob:String(cfg.functions?.startJob||'extracterre-start-job'),
      jobStatus:String(cfg.functions?.jobStatus||'extracterre-job-status'),
      finishJob:String(cfg.functions?.finishJob||'extracterre-finish-job')
    },
    storageBucket:String(cfg.storageBucket||'extracterre-temp'),
    autoRemoteMinBytes:Number(cfg.autoRemoteMinBytes)||6*1024*1024,
    maxRemoteBytes:Number(cfg.maxRemoteBytes)||700*1024*1024,
    pollIntervalMs:Number(cfg.pollIntervalMs)||1400,
    maxWaitMs:Number(cfg.maxWaitMs)||25*60*1000
  };
}
export function getCloudConfig(){
  const base=defaultCloudConfig();
  try{
    const local=JSON.parse(localStorage.getItem(CLOUD_CONFIG_STORAGE_KEY)||'null');
    if(local&&typeof local==='object'){
      if(typeof local.supabaseUrl==='string'&&local.supabaseUrl.trim()) base.supabaseUrl=local.supabaseUrl.trim().replace(/\/$/,'');
      if(typeof local.supabasePublishableKey==='string'&&local.supabasePublishableKey.trim()) base.supabasePublishableKey=local.supabasePublishableKey.trim();
    }
  }catch{}
  return base;
}
export function saveCloudConfig({supabaseUrl='',supabasePublishableKey=''}={}){
  const clean={supabaseUrl:String(supabaseUrl||'').trim().replace(/\/$/,''),supabasePublishableKey:String(supabasePublishableKey||'').trim()};
  localStorage.setItem(CLOUD_CONFIG_STORAGE_KEY,JSON.stringify(clean)); cloudClient=null; return getCloudConfig();
}
export function resetCloudConfig(){ localStorage.removeItem(CLOUD_CONFIG_STORAGE_KEY); cloudClient=null; return getCloudConfig(); }
export function cloudConfigured(){ const c=getCloudConfig(); return /^https:\/\//i.test(c.supabaseUrl)&&/^sb_publishable_/i.test(c.supabasePublishableKey)&&!!globalThis.supabase?.createClient; }
function getCloudClient(){
  if(cloudClient) return cloudClient;
  if(!globalThis.supabase?.createClient) throw new Error('Supabase.js n’est pas chargé. Rechargez la page avec une connexion internet.');
  const c=getCloudConfig();
  if(!c.supabaseUrl||!c.supabasePublishableKey) throw new Error('Configuration Cloud ExtracTerre incomplète.');
  cloudClient=globalThis.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:CLOUD_AUTH_STORAGE_KEY}});
  return cloudClient;
}
export async function getCloudSession(){
  if(!cloudConfigured()) return {configured:false,connected:false,user:null,error:null};
  try{
    const client=getCloudClient(); const {data,error}=await client.auth.getSession();
    if(error) return {configured:true,connected:false,user:null,error:error.message};
    const session=data?.session||null; return {configured:true,connected:!!session,user:session?.user||null,error:null};
  }catch(err){ return {configured:true,connected:false,user:null,error:err?.message||String(err)}; }
}
export async function cloudSignIn(email,password){
  const client=getCloudClient();
  const {data,error}=await client.auth.signInWithPassword({email:String(email||'').trim(),password:String(password||'')});
  if(error) throw error; return data?.session||null;
}
export async function cloudSignOut(){ if(!cloudConfigured()) return; const client=getCloudClient(); const {error}=await client.auth.signOut(); if(error) throw error; }
export function getExecutionMode(){ const raw=localStorage.getItem(CLOUD_EXECUTION_MODE_KEY)||'auto'; return CLOUD_MODES[raw]?raw:'auto'; }
export function setExecutionMode(mode){ const key=CLOUD_MODES[mode]?mode:'auto'; localStorage.setItem(CLOUD_EXECUTION_MODE_KEY,key); return key; }
export function shouldUseCloudForFile(file,mode='auto',ocrMode='auto'){
  if(!file||!/\.pdf$/i.test(file.name||'')) return false;
  const cfg=getCloudConfig(); const size=Number(file.size)||0;
  if(size>cfg.maxRemoteBytes) return false;
  if(mode==='local') return false;
  if(mode==='remote') return true;
  return ocrMode==='always'||size>=cfg.autoRemoteMinBytes;
}
export function cloudReasonForFile(file,mode='auto',ocrMode='auto'){
  if(!file||!/\.pdf$/i.test(file.name||'')) return 'format local';
  const cfg=getCloudConfig(),size=Number(file.size)||0;
  if(size>cfg.maxRemoteBytes) return 'taille hors plafond Cloud';
  if(mode==='remote') return 'mode Serveur';
  if(mode==='local') return 'mode Local';
  if(ocrMode==='always') return 'OCR renforcé';
  if(size>=cfg.autoRemoteMinBytes) return `PDF ≥ ${(cfg.autoRemoteMinBytes/1024/1024).toFixed(0)} Mo`;
  return 'PDF léger';
}
function throwIfCloudAborted(signal){ if(signal?.aborted){ const e=new Error('Analyse distante interrompue.'); e.name='AbortError'; throw e; } }
function sleepCloud(ms,signal){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){ const e=new Error('Analyse distante interrompue.'); e.name='AbortError'; reject(e); return; }
    const id=setTimeout(()=>{ signal?.removeEventListener?.('abort',onAbort); resolve(); },ms);
    const onAbort=()=>{ clearTimeout(id); const e=new Error('Analyse distante interrompue.'); e.name='AbortError'; reject(e); };
    signal?.addEventListener?.('abort',onAbort,{once:true});
  });
}
async function invokeCloudFunction(name,body){
  const client=getCloudClient(); const {data,error}=await client.functions.invoke(name,{body});
  if(error){ const msg=error?.context?.body||error?.message||String(error); throw new Error(`Cloud ExtracTerre : ${msg}`); }
  let out=data;
  if(out instanceof Uint8Array||out instanceof ArrayBuffer){ try{out=JSON.parse(new TextDecoder().decode(out));}catch{} }
  if(typeof out==='string'){ try{out=JSON.parse(out);}catch{} }
  if(out?.error&&!out?.ok) throw new Error(out.error);
  return out;
}
async function uploadCloudParts(file,upload,onProgress=()=>{},signal){
  const client=getCloudClient(); const bucket=getCloudConfig().storageBucket;
  const parts=Array.isArray(upload?.parts)&&upload.parts.length?upload.parts:[upload];
  const total=Math.max(1,Number(file.size)||1); let uploaded=0;
  for(let i=0;i<parts.length;i++){
    throwIfCloudAborted(signal); const part=parts[i];
    if(!part?.path||!part?.token) throw new Error('Autorisation d’upload Cloud incomplète.');
    const start=Number.isFinite(part.start)?part.start:uploaded;
    const end=Number.isFinite(part.end)?part.end:Math.min(file.size,start+(Number(part.size)||file.size));
    const blob=file.slice(start,end,'application/octet-stream');
    const {error}=await client.storage.from(bucket).uploadToSignedUrl(part.path,part.token,blob,{contentType:parts.length===1?'application/pdf':'application/octet-stream'});
    if(error) throw error;
    uploaded=end; onProgress(Math.min(.28,.03+.25*(uploaded/total)),{stage:'cloud-upload',message:`Cloud · envoi ${i+1}/${parts.length}`});
  }
  return parts.length;
}
async function fetchCloudRead(url,compression='gzip',signal){
  throwIfCloudAborted(signal); const response=await fetch(url,{cache:'no-store',signal});
  if(!response.ok) throw new Error(`Téléchargement index distant impossible (HTTP ${response.status}).`);
  if(compression==='gzip'){
    if(typeof DecompressionStream!=='function') throw new Error('Ce navigateur ne sait pas décompresser le résultat Cloud. Utilisez Chrome/Edge récent ou le mode Local.');
    const stream=response.body.pipeThrough(new DecompressionStream('gzip')); const text=await new Response(stream).text(); return JSON.parse(text);
  }
  return response.json();
}
export async function analyzePdfInCloud(file,{ocrMode='auto',onProgress=()=>{},signal}={}){
  if(!/\.pdf$/i.test(file?.name||'')) throw new Error('Le Cloud v2.1 traite uniquement les PDF ; XML/Excel restent locaux.');
  const releaseCloud=await acquireCloudSlot(signal,onProgress);
  try{
  const cfg=getCloudConfig();
  if((Number(file.size)||0)>cfg.maxRemoteBytes) throw new Error(`PDF trop volumineux pour le quota Cloud configuré (${Math.round(cfg.maxRemoteBytes/1024/1024)} Mo max).`);
  const session=await getCloudSession(); if(!session.connected) throw new Error('Connexion Cloud requise. Ouvrez « Cloud » et connectez votre compte Supabase.');
  throwIfCloudAborted(signal); onProgress(.01,{stage:'cloud-create',message:'Cloud · création du job'});
  const created=await invokeCloudFunction(cfg.functions.createJob,{originalFilename:file.name,fileSize:file.size,options:{ocrMode,clientVersion:typeof APP_VERSION==='string'?APP_VERSION:'2.1'}});
  if(!created?.ok||!created?.job?.id) throw new Error(created?.error||'Création du job Cloud impossible.');
  const jobId=created.job.id; let started=false;
  try{
    const partCount=await uploadCloudParts(file,created.upload,onProgress,signal);
    throwIfCloudAborted(signal); onProgress(.30,{stage:'cloud-queue',message:'Cloud · mise en file GitHub'});
    const start=await invokeCloudFunction(cfg.functions.startJob,{jobId});
    if(!start?.ok) throw new Error(start?.error||'Démarrage du worker impossible.'); started=true;
    const begun=Date.now(); let lastStatus='queued';
    while(Date.now()-begun<cfg.maxWaitMs){
      throwIfCloudAborted(signal);
      const status=await invokeCloudFunction(cfg.functions.jobStatus,{jobId});
      if(!status?.ok) throw new Error(status?.error||'État Cloud indisponible.');
      lastStatus=status.status||lastStatus;
      if(lastStatus==='queued') onProgress(.34,{stage:'cloud-queued',message:'Cloud · worker en attente'});
      else if(lastStatus==='processing') onProgress(.38,{stage:'cloud-processing',message:'Cloud · PDF/OCR sur GitHub'});
      else if(lastStatus==='error') throw new Error(status.errorMessage||'Le worker distant a échoué.');
      else if(lastStatus==='cancelled') throw new Error('Job Cloud annulé.');
      else if(lastStatus==='completed'){
        if(!status.readUrl){ throw new Error('Le worker a terminé mais aucun index documentaire v2.1 n’a été retourné. Mettez à jour extracterre-worker avec le pack V2.1.'); }
        onProgress(.78,{stage:'cloud-download',message:'Cloud · récupération de l’index'});
        const read=await fetchCloudRead(status.readUrl,status.readCompression||'gzip',signal);
        if(!read?.pages||!Array.isArray(read.pages)) throw new Error('Index documentaire Cloud invalide.');
        onProgress(.86,{stage:'cloud-done',message:'Cloud · lecture distante terminée'});
        try{ await invokeCloudFunction(cfg.functions.finishJob,{jobId}); }catch(err){ console.warn('Nettoyage Cloud différé',err); }
        return {read,cloud:{jobId,partCount,status:'completed',worker:status.result?.worker||'github-actions',workerVersion:status.result?.workerVersion||'',durationMs:Date.now()-begun,result:status.result||{}}};
      }
      await sleepCloud(cfg.pollIntervalMs,signal);
    }
    throw new Error('Le worker Cloud n’a pas terminé dans le délai maximal autorisé.');
  }catch(err){
    if(started) console.warn(`Job Cloud ${jobId} interrompu côté client`,err);
    throw err;
  }
  } finally { releaseCloud(); }
}
