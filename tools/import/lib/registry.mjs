// Registre des sources.
// - Local (dossier de travail, sur cet ordinateur) : registre.json, lisible par l'appli (vue « Suivi des sources »).
// - Supabase (si configuré) : copie de référence CHIFFRÉE (tables extracterre_import_*), accessible à la seule clé
//   de service ; identifiants remplacés par des HMAC, contenu en AES-256-GCM (voir crypto.mjs).
import fs from 'fs';
import path from 'path';
import {deriveKeys,newSalt,hmac,encryptJson,decryptJson,CHECK_PLAIN,KDF_ITERATIONS} from './crypto.mjs';

export const REGISTRY_FORMAT='extracterre-import-registry';

function atomicWrite(file,text){ const tmp=`${file}.tmp-${process.pid}`; fs.writeFileSync(tmp,text); fs.renameSync(tmp,file); }

export class SupabaseStore{
  constructor({url,serviceKey,fetchImpl=globalThis.fetch}){
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(url||'').replace(/\/$/,''))) throw new Error('SUPABASE_URL invalide (attendu : https://xxxx.supabase.co).');
    if(!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente du fichier .env.');
    this.url=String(url).replace(/\/$/,''); this.key=serviceKey; this.fetch=fetchImpl;
  }
  headers(extra={}){ return {apikey:this.key,Authorization:`Bearer ${this.key}`,'Content-Type':'application/json',...extra}; }
  async req(method,pathQ,body,extra){
    for(let attempt=1;;attempt++){
      let res;
      try{ res=await this.fetch(`${this.url}/rest/v1/${pathQ}`,{method,headers:this.headers(extra),body:body==null?undefined:JSON.stringify(body)}); }
      catch(err){ if(attempt<4){ await new Promise(r=>setTimeout(r,800*attempt)); continue; } throw new Error(`Supabase injoignable : ${err.message}`); }
      if(res.ok){ const t=await res.text(); return t?JSON.parse(t):null; }
      const t=await res.text();
      if((res.status>=500||res.status===429)&&attempt<4){ await new Promise(r=>setTimeout(r,800*attempt)); continue; }
      if(/relation .* does not exist|Could not find the table/i.test(t)) throw new Error('Tables Supabase absentes : appliquer supabase/migrations/20261112_import_massif.sql (voir README).');
      throw new Error(`Supabase ${res.status} : ${t.slice(0,300)}`);
    }
  }
  async getAll(table,select){
    const out=[]; const page=1000;
    for(let from=0;;from+=page){
      const rows=await this.req('GET',`${table}?select=${select}&order=${table==='extracterre_import_keys'?'id':'updated_at'}.asc`,null,{Range:`${from}-${from+page-1}`,'Range-Unit':'items'});
      out.push(...rows); if(rows.length<page) return out;
    }
  }
  async upsert(table,rows,onConflict){
    for(let i=0;i<rows.length;i+=200) await this.req('POST',`${table}?on_conflict=${onConflict}`,rows.slice(i,i+200),{Prefer:'resolution=merge-duplicates,return=minimal'});
  }
}

// Clés de chiffrement : sel stocké dans Supabase, phrase secrète vérifiée par une valeur témoin.
export async function openKeys(store,passphrase){
  const rows=await store.req('GET','extracterre_import_keys?select=id,salt,iterations,check_value');
  if(!rows.length){
    const salt=newSalt(); const keys=deriveKeys(passphrase,salt);
    await store.req('POST','extracterre_import_keys',[{id:1,salt,iterations:KDF_ITERATIONS,check_value:encryptJson(keys,CHECK_PLAIN)}],{Prefer:'return=minimal'});
    return {keys,created:true};
  }
  const r=rows[0]; const keys=deriveKeys(passphrase,r.salt,r.iterations||KDF_ITERATIONS);
  let ok=false; try{ ok=decryptJson(keys,r.check_value)===CHECK_PLAIN; }catch{}
  if(!ok) throw new Error('Phrase secrète incorrecte (elle ne correspond pas à celle utilisée au premier import).');
  return {keys,created:false};
}

export class Registry{
  constructor({workDir,store=null,keys=null}){
    this.workDir=workDir; this.store=store; this.keys=keys;
    this.filePath=path.join(workDir,'registre.json');
    this.data={format:REGISTRY_FORMAT,version:1,updatedAt:null,files:{},operations:{}};
    this.dirtyFiles=new Set(); this.dirtyOps=new Set();
  }
  static fileId(contract,relPath){ return `${contract}|${relPath}`; }
  async load(){
    if(fs.existsSync(this.filePath)){
      const d=JSON.parse(fs.readFileSync(this.filePath,'utf8'));
      if(d?.format===REGISTRY_FORMAT) this.data={...this.data,...d,files:d.files||{},operations:d.operations||{}};
    }
    if(this.store&&this.keys){
      const files=await this.store.getAll('extracterre_import_files','file_key,payload,updated_at');
      for(const row of files){
        let e; try{ e=decryptJson(this.keys,row.payload); }catch{ continue; }
        const id=Registry.fileId(e.contract,e.relPath); const cur=this.data.files[id];
        if(!cur||String(cur.updatedAt||'')<String(e.updatedAt||'')) this.data.files[id]=e;
      }
      const ops=await this.store.getAll('extracterre_import_operations','contract_key,payload,updated_at');
      for(const row of ops){
        let o; try{ o=decryptJson(this.keys,row.payload); }catch{ continue; }
        const cur=this.data.operations[o.contract];
        if(!cur||String(cur.updatedAt||'')<String(o.updatedAt||'')) this.data.operations[o.contract]=o;
      }
    }
    return this;
  }
  file(contract,relPath){ return this.data.files[Registry.fileId(contract,relPath)]||null; }
  filesOf(contract){ return Object.values(this.data.files).filter(f=>f.contract===contract); }
  byHash(sha){ return Object.values(this.data.files).find(f=>f.sha256===sha&&f.resultFile)||null; }
  putFile(entry){ entry.updatedAt=new Date().toISOString(); const id=Registry.fileId(entry.contract,entry.relPath); this.data.files[id]=entry; this.dirtyFiles.add(id); return entry; }
  operation(contract){ return this.data.operations[contract]||null; }
  putOperation(op){ op.updatedAt=new Date().toISOString(); this.data.operations[op.contract]=op; this.dirtyOps.add(op.contract); return op; }
  async flush(){
    this.data.updatedAt=new Date().toISOString();
    fs.mkdirSync(this.workDir,{recursive:true});
    atomicWrite(this.filePath,JSON.stringify(this.data));
    if(this.store&&this.keys&&(this.dirtyFiles.size||this.dirtyOps.size)){
      const files=[...this.dirtyFiles].map(id=>this.data.files[id]).filter(Boolean).map(e=>({
        file_key:hmac(this.keys,`${e.contract}|${e.relPath}`),contract_key:hmac(this.keys,e.contract),content_key:e.sha256?hmac(this.keys,e.sha256):null,
        family:e.family||null,status:e.status,is_current:!!e.isCurrent,missing:!!e.missing,payload:encryptJson(this.keys,e),
        processed_at:e.processedAt||null,missing_since:e.missingSince||null,updated_at:e.updatedAt}));
      const ops=[...this.dirtyOps].map(c=>this.data.operations[c]).filter(Boolean).map(o=>({
        contract_key:hmac(this.keys,o.contract),status:o.status||null,fingerprint:o.fingerprint?hmac(this.keys,o.fingerprint):null,payload:encryptJson(this.keys,o),updated_at:o.updatedAt}));
      if(files.length) await this.store.upsert('extracterre_import_files',files,'file_key');
      if(ops.length) await this.store.upsert('extracterre_import_operations',ops,'contract_key');
    }
    this.dirtyFiles.clear(); this.dirtyOps.clear();
  }
}
