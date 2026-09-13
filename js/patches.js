import {DOC_TYPES,FIELD_MAP} from './config.js';
import {normalizeText,normLower,parseFrNumber,clamp} from './utils.js';

const STORAGE_KEY='extracterre-improvement-patches-v1';
const SCHEMA='extracterre-improvement-patch/v1';
let registry=[];
const safeArray=v=>Array.isArray(v)?v:[];
const safeText=v=>String(v??'').slice(0,5000);

function validPatch(p){
  if(!p||p.schema!==SCHEMA||typeof p.id!=='string'||!p.id.trim()) throw new Error('Patch ExtracTerre invalide ou incompatible.');
  if(safeArray(p.extractionRules).length>120) throw new Error('Patch refusé : trop de règles.');
  for(const r of safeArray(p.extractionRules)){
    if(!r.field||!FIELD_MAP[r.field]) throw new Error(`Champ de patch inconnu : ${r.field||'—'}`);
    if(typeof r.regex!=='string'||r.regex.length>700) throw new Error(`Expression régulière invalide : ${r.id||r.field}`);
    try{ new RegExp(r.regex,'im'); }catch{ throw new Error(`Expression régulière invalide : ${r.id||r.field}`); }
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
function patchOccurrence(doc,page,line,r,value,p){
  return {field:r.field,value,building:r.building||'Bâtiment unique',docId:doc.id,fileName:doc.name,docType:doc.type,page:page?.page||1,excerpt:normalizeText(line?.text||r.label||'').slice(0,420),confidence:clamp(Number(r.confidence)||.91),method:`patch:${p.id}:${r.id||r.field}`,unit:r.unit||'',origin:`Patch ${p.title||p.id}`,provenanceNote:r.note||'Règle documentaire versionnée issue de la bibliothèque ExtracTerre.',patchId:p.id};
}
export function parsePatchOccurrences(doc){
  const out=[], text=String(doc?.read?.text||''), low=normLower(text);
  for(const p of registry){
    for(const r of safeArray(p.extractionRules)){
      if(safeArray(r.docTypes).length&&!r.docTypes.includes(doc.type)) continue;
      if(safeArray(r.requireAny).length&&!safeArray(r.requireAny).some(x=>low.includes(normLower(x)))) continue;
      if(safeArray(r.forbidAny).some(x=>low.includes(normLower(x)))) continue;
      let re; try{re=new RegExp(r.regex,'gim')}catch{continue;} let m,count=0;
      while((m=re.exec(text))&&count++<(Number(r.maxMatches)||4)){
        const raw=m[Number(r.valueGroup)||1]; if(raw==null) continue;
        let value=r.valueType==='number'?parseFrNumber(raw):normalizeText(raw);
        if(value==null||value==='') continue;
        const before=text.slice(0,m.index), pageNum=(before.match(/<PARSED TEXT FOR PAGE:/g)||[]).length||1;
        const page=doc.read.pages?.find(x=>x.page===pageNum)||doc.read.pages?.[0]||{page:pageNum,lines:[]};
        const line=page.lines?.find(x=>normalizeText(x.text).includes(normalizeText(String(raw)).slice(0,22)))||page.lines?.[0]||{text:m[0],index:0};
        out.push(patchOccurrence(doc,page,line,r,value,p));
        if(!r.allowMultiple) break;
      }
    }
  }
  return out;
}
export const PATCH_SCHEMA=SCHEMA;
