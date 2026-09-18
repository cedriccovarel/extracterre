import {APP_VERSION,DOC_TYPES,FIELD_MAP} from './config.js';
import {normalizeText,normLower,parseFrNumber,clamp} from './utils.js';
import {canonicalBuilding} from './buildings.js';

const STORAGE_KEY='extracterre-improvement-patches-v1';
const SCHEMA='extracterre-improvement-patch/v1';
let registry=[];
const safeArray=v=>Array.isArray(v)?v:[];
const safeText=v=>String(v??'').slice(0,5000);

function validateRegex(raw,label,max=1200){
  if(raw==null) return;
  if(typeof raw!=='string'||raw.length>max) throw new Error(`Expression régulière invalide : ${label}`);
  try{ new RegExp(raw,'im'); }catch{ throw new Error(`Expression régulière invalide : ${label}`); }
}
function versionParts(value=''){ return String(value||'').trim().replace(/^v/i,'').split('.').map(x=>Number.parseInt(x,10)||0); }
function compareVersions(a,b){
  const aa=versionParts(a),bb=versionParts(b),n=Math.max(aa.length,bb.length,3);
  for(let i=0;i<n;i++){ const d=(aa[i]||0)-(bb[i]||0); if(d) return d<0?-1:1; }
  return 0;
}
function validPatch(p){
  if(!p||p.schema!==SCHEMA||typeof p.id!=='string'||!p.id.trim()) throw new Error('Patch ExtracTerre invalide ou incompatible.');
  if(p.minAppVersion&&compareVersions(APP_VERSION,p.minAppVersion)<0) throw new Error(`Patch ${p.id} incompatible : ExtracTerre ${p.minAppVersion} minimum requis (version actuelle ${APP_VERSION}).`);
  if(safeArray(p.extractionRules).length>160) throw new Error('Patch refusé : trop de règles.');
  for(const r of safeArray(p.extractionRules)){
    if(!r.field||!FIELD_MAP[r.field]) throw new Error(`Champ de patch inconnu : ${r.field||'—'}`);
    validateRegex(r.regex,r.id||r.field,900);
    validateRegex(r.sectionStartRegex,`${r.id||r.field}: sectionStartRegex`);
    validateRegex(r.sectionEndRegex,`${r.id||r.field}: sectionEndRegex`);
  }
  return true;
}
function uniqueById(items){ const m=new Map(); for(const x of items){ if(x?.id) m.set(x.id,x); } return [...m.values()]; }
function readLocal(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return []} }
function writeLocal(items){ localStorage.setItem(STORAGE_KEY,JSON.stringify(items)); }
export async function initializeImprovementPatches(){
  let site=[];
  try{
    const res=await fetch(`./data/patches/manifest.json?ts=${Date.now()}`,{cache:'no-store'});
    if(res.ok){ const manifest=await res.json(); for(const entry of safeArray(manifest.patches)){ try{ validPatch(entry); site.push({...entry,_origin:'site'}); }catch(e){ console.warn('Patch site ignoré',e); } } }
  }catch(e){ console.warn('Manifest patches indisponible',e); }
  const local=[]; for(const p of readLocal()){ try{validPatch(p); local.push({...p,_origin:'local'});}catch(e){console.warn('Patch local ignoré',e);} }
  registry=uniqueById([...site,...local]); return registry;
}
export function getImprovementPatches(){return registry.map(p=>({id:p.id,title:p.title||p.id,version:p.version||'1.0.0',origin:p._origin||'site',description:p.description||''}));}
export function importImprovementPatchObject(p){ validPatch(p); const clean=JSON.parse(JSON.stringify(p)); const local=readLocal().filter(x=>x?.id!==clean.id); local.push(clean); writeLocal(local); registry=uniqueById([...registry.filter(x=>x.id!==clean.id),{...clean,_origin:'local'}]); return clean; }
export async function importImprovementPatchFile(file){ const txt=await file.text(); return importImprovementPatchObject(JSON.parse(txt)); }
export function removeLocalImprovementPatch(id){ const local=readLocal().filter(x=>x?.id!==id); writeLocal(local); registry=registry.filter(x=>!(x.id===id&&x._origin==='local')); }

function signatureMatchesDocument(signature,fileName,text){
  const n=normLower(fileName),t=normLower(text).slice(0,180000);
  const all=safeArray(signature?.all).every(x=>t.includes(normLower(x))||n.includes(normLower(x)));
  const any=!safeArray(signature?.any).length||safeArray(signature?.any).some(x=>t.includes(normLower(x))||n.includes(normLower(x)));
  const none=safeArray(signature?.none).some(x=>t.includes(normLower(x))||n.includes(normLower(x)));
  return all&&any&&!none;
}
function patchMatchesDocument(p,doc,text){
  const sigs=safeArray(p?.documentSignatures).filter(s=>!s?.docType||s.docType===doc.type);
  if(!sigs.length) return true;
  return sigs.some(s=>signatureMatchesDocument(s,doc.name||'',text));
}
export function patchClassifierScores(fileName,text=''){
  const n=normLower(fileName),t=normLower(text).slice(0,180000),scores={};
  for(const p of registry) for(const s of safeArray(p.documentSignatures)){
    const all=safeArray(s.all).every(x=>t.includes(normLower(x))||n.includes(normLower(x)));
    const any=!safeArray(s.any).length||safeArray(s.any).some(x=>t.includes(normLower(x))||n.includes(normLower(x)));
    const none=safeArray(s.none).some(x=>t.includes(normLower(x))||n.includes(normLower(x)));
    if(all&&any&&!none){ const k=s.docType; if(k) scores[k]=(scores[k]||0)+(Number(s.weight)||8); }
  }
  return scores;
}
function patchOccurrence(doc,page,line,r,value,p,buildingOverride=null){
  return {field:r.field,value,building:buildingOverride||r.building||'Bâtiment unique',docId:doc.id,fileName:doc.name,docType:doc.type,page:page?.page||1,excerpt:normalizeText(line?.text||r.label||'').slice(0,420),confidence:clamp(Number(r.confidence)||.91),method:`patch:${p.id}:${r.id||r.field}`,unit:r.unit||'',origin:`Patch ${p.title||p.id}`,provenanceNote:r.note||'Règle documentaire versionnée issue de la bibliothèque ExtracTerre.',patchId:p.id};
}
function pageLineForAbsoluteIndex(doc,text,absoluteIndex,raw,matchText=''){
  const before=text.slice(0,Math.max(0,absoluteIndex)), pageNum=(before.match(/<PARSED TEXT FOR PAGE:/g)||[]).length||1;
  const page=doc.read.pages?.find(x=>x.page===pageNum)||doc.read.pages?.[0]||{page:pageNum,lines:[]};
  const needle=normalizeText(String(raw??'')).slice(0,22);
  const line=page.lines?.find(x=>needle&&normalizeText(x.text).includes(needle))||page.lines?.find(x=>normalizeText(matchText).includes(normalizeText(x.text).slice(0,22)))||page.lines?.[0]||{text:matchText,index:0};
  return {page,line};
}
function ruleValue(r,m){
  if(Object.prototype.hasOwnProperty.call(r,'constantValue')) return r.constantValue;
  const raw=m[Number(r.valueGroup)||1]; if(raw==null) return null;
  return r.valueType==='number'?parseFrNumber(raw):normalizeText(raw);
}
function selectMatches(matches,r){
  if(!matches.length) return [];
  const mode=String(r.selection||'').toLowerCase();
  if(!mode) return r.allowMultiple?matches:matches.slice(0,1);
  const g=Number(r.selectionGroup)||Number(r.valueGroup)||1;
  const scored=matches.map(x=>({x,v:parseFrNumber(x.m[g])})).filter(z=>Number.isFinite(z.v));
  if(!scored.length) return matches.slice(0,1);
  scored.sort((a,b)=>mode==='min'?a.v-b.v:b.v-a.v);
  return [scored[0].x];
}
function sectionSlices(text,r){
  if(!r.sectionStartRegex) return [{text,start:0,building:r.building||null}];
  let sr; try{sr=new RegExp(r.sectionStartRegex,'gim')}catch{return []}
  const starts=[]; let sm;
  while((sm=sr.exec(text))){
    let building=r.building||null;
    const bg=Number(r.sectionBuildingGroup)||0;
    if(bg&&sm[bg]) building=canonicalBuilding(sm[bg]);
    starts.push({match:sm,start:sm.index,contentStart:sm.index+sm[0].length,building});
    if(sr.lastIndex===sm.index) sr.lastIndex++;
  }
  const out=[];
  for(let i=0;i<starts.length;i++){
    const cur=starts[i], hardEnd=i+1<starts.length?starts[i+1].start:text.length;
    let end=hardEnd;
    if(r.sectionEndRegex){
      try{ const er=new RegExp(r.sectionEndRegex,'im'), em=er.exec(text.slice(cur.contentStart,hardEnd)); if(em) end=cur.contentStart+em.index; }catch{}
    }
    out.push({text:text.slice(cur.contentStart,end),start:cur.contentStart,building:cur.building});
  }
  return out;
}
export function parsePatchOccurrences(doc){
  const out=[], text=String(doc?.read?.text||''), low=normLower(text);
  for(const p of registry){
    if(!patchMatchesDocument(p,doc,text)) continue;
    for(const r of safeArray(p.extractionRules)){
      if(safeArray(r.docTypes).length&&!r.docTypes.includes(doc.type)) continue;
      if(safeArray(r.requireAny).length&&!safeArray(r.requireAny).some(x=>low.includes(normLower(x)))) continue;
      if(safeArray(r.forbidAny).some(x=>low.includes(normLower(x)))) continue;
      const slices=sectionSlices(text,r);
      for(const section of slices){
        let re; try{re=new RegExp(r.regex,'gim')}catch{continue;} let m,count=0; const matches=[];
        while((m=re.exec(section.text))&&count++<(Number(r.maxMatches)||20)){
          matches.push({m,index:m.index});
          if(re.lastIndex===m.index) re.lastIndex++;
        }
        for(const hit of selectMatches(matches,r)){
          const value=ruleValue(r,hit.m); if(value==null||value==='') continue;
          const absoluteIndex=section.start+hit.index;
          const raw=Object.prototype.hasOwnProperty.call(r,'constantValue')?String(r.constantValue):hit.m[Number(r.valueGroup)||1];
          const {page,line}=pageLineForAbsoluteIndex(doc,text,absoluteIndex,raw,hit.m[0]);
          out.push(patchOccurrence(doc,page,line,r,value,p,section.building));
        }
      }
    }
  }
  return out;
}
export const PATCH_SCHEMA=SCHEMA;
