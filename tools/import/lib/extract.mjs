// Lecture et extraction d'un fichier avec les modules de l'appli (même code que le glisser-déposer).
import './runtime.mjs';
import {nodeFile} from './runtime.mjs';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {createRequire} from 'module';
import {readFile,makeDocumentRecord,groupItemsIntoLines} from '../../../js/readers.js';
import {prepareReadDocument} from '../../../js/doc-pipeline.js';
import {documentExpectedFields,DOCUMENT_FAMILIES,autoFamiliesForType} from '../../../js/parsers.js';
import {DOC_TYPES} from '../../../js/config.js';
import {isDpeXmlText} from '../../../js/dpe-3cl.js';
import {runLlmAssist} from '../../../js/llm-assist.js';
import {APP_VERSION} from '../../../js/config.js';
const require=createRequire(import.meta.url);
const LOT_TYPES=new Set([DOC_TYPES.CCTP,DOC_TYPES.DPGF]); // documents découpés par lot

// Texte de la 1re page d'un PDF (classement, règle d). '' = page sans texte (scan).
export async function firstPageText(abs){
  const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');
  const data=new Uint8Array(await fs.promises.readFile(abs));
  const task=pdfjs.getDocument({data,disableFontFace:true,isEvalSupported:false,verbosity:0});
  const pdf=await task.promise;
  try{
    const page=await pdf.getPage(1); const tc=await page.getTextContent();
    return groupItemsIntoLines(tc.items).map(l=>l.text).join('\n').trim();
  } finally { try{ await pdf.destroy(); }catch{} }
}

// Structure d'un XML : RSET / RSEE RE2020 (balise racine <projet> avec blocs RSET / RSEnv) ou DPE ADEME.
export async function probeXml(abs){
  const t=await fs.promises.readFile(abs,'utf8');
  const head=t.slice(0,4000);
  if(isDpeXmlText(t)) return {re2020:null,dpe:true};
  if(/<projet[\s>]/i.test(head)||/<projet[\s>]/i.test(t.slice(0,200000))){
    if(/<RSEnv[\s>/]/.test(t)) return {re2020:'RSEE',dpe:false};
    if(/<RSET[\s>/]/.test(t)) return {re2020:'RSET',dpe:false};
  }
  return {re2020:null,dpe:false};
}

// Document « prêt » tel que l'appli le garde après analyse (sans le File).
function serializeDoc(d,meta){
  return {format:'extracterre-import-doc',appVersion:APP_VERSION,meta,
    doc:{name:d.name,size:d.size,lastModified:d.file?.lastModified||null,relativePath:d.relativePath,type:d.type,classification:d.classification,
      families:d.families||null,familyMode:d.familyMode||'auto',specializedFamily:d.specializedFamily||null,buildings:d.buildings,read:d.read,
      cachedOccurrences:d.cachedOccurrences,analysisCachedAt:d.analysisCachedAt,rsetAddressRead:true,dhZonesRead:true,fanRead:2,bldRead:1,
      ocrWarnings:d.ocrWarnings||null,llmProposals:d.llmProposals||null}};
}
export function writeResult(workDir,sha,payload){
  const dir=path.join(workDir,'resultats'); fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,`${sha}.json.gz`); const tmp=`${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp,zlib.gzipSync(Buffer.from(JSON.stringify(payload),'utf8'),{level:6})); fs.renameSync(tmp,file);
  return path.relative(workDir,file);
}
export function readResult(workDir,rel){ return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(workDir,rel))).toString('utf8')); }

// Lecture complète + parseurs. familyOverride : clé de DOCUMENT_FAMILIES choisie dans la liste « À vérifier ».
export async function extractFile(entry,{familyOverride=null,incompleteBelow=0.5}={}){
  const file=nodeFile(entry.abs,entry.name);
  const d=makeDocumentRecord(file); d.relativePath=entry.relPath;
  if(familyOverride&&DOCUMENT_FAMILIES[familyOverride]){ d.familyMode='manual'; d.families=[familyOverride]; }
  else { d.familyMode='auto'; d.families=null; }
  d.read=await readFile(file,()=>{},{mode:'off',lang:'fra+eng',detectPlan:d.familyMode!=='manual',forcePlan:d.familyMode==='manual'&&familyOverride==='plan'});
  const pages=d.read?.pageCount||d.read?.pages?.length||0;
  const chars=String(d.read?.text||'').replace(/\s+/g,'').length;
  const scan=d.read?.kind==='pdf'&&!d.read?.plan&&chars<Math.max(80,pages*40);
  prepareReadDocument(d);
  let status='traité',reason='';
  const found=new Set((d.cachedOccurrences||[]).map(o=>o?.field).filter(Boolean));
  const expected=d.read?.plan?[]:documentExpectedFields(d);
  const hit=expected.filter(e=>Array.isArray(e)?e.some(k=>found.has(k)):found.has(e));
  const completeness=expected.length?{found:hit.length,expected:expected.length}:null;
  if(d.parseError){ status='erreur'; reason=`parseur en échec : ${d.parseError}`; }
  else if(scan){ status='à vérifier'; reason='PDF sans texte (scan) : OCR à faire dans l’appli'; }
  else if(d.read?.plan){ status='traité'; reason='plan : non analysé (à mesurer dans Ashton)'; }
  else if(!found.size&&LOT_TYPES.has(d.type)){ reason='lot : aucun champ suivi dans ce lot'; }
  else if(!found.size){ status='à vérifier'; reason='aucune donnée extraite par les parseurs'; }
  else if(completeness&&hit.length/expected.length<incompleteBelow){
    // Un CCTP / DPGF est découpé par lot : chacun ne couvre qu'une partie des champs, l'opération les réunit.
    if(LOT_TYPES.has(d.type)) reason=`lot : ${hit.length}/${expected.length} champs du CCTP`;
    else { status='à vérifier'; reason=`résultat incomplet : ${hit.length}/${expected.length} champs attendus`; }
  }
  return {d,status,reason,completeness,pages,scan,fields:found.size};
}

// Famille de l'appli correspondant à un type (choix « Famille » d'un document), ou null.
export function familyForType(type){ const k=Object.keys(DOCUMENT_FAMILIES).find(k=>k!=='annex'&&DOCUMENT_FAMILIES[k].type===type); return k||(type===DOC_TYPES.RSEE_RE2020||type===DOC_TYPES.RSENV?'carbone':null); }
export function autoAgrees(appType,family){ return autoFamiliesForType(appType).includes(family); }

// Option --with-ai : IA locale (Ollama), propositions vérifiées mot pour mot, plafonnées à 85 %, à valider ✓ / ✕ dans l'appli.
export async function askLocalAi(d,{model='qwen2.5:7b'}={}){
  const res=await runLlmAssist(d,{config:{mode:'local',provider:'ollama',model,maxPages:6},fetchImpl:globalThis.fetch});
  return {accepted:res.accepted||[],rejected:(res.rejected||[]).length,note:res.note||''};
}

export {serializeDoc};
