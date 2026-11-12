// Lecture et extraction d'un fichier avec les modules de l'appli (même code que le glisser-déposer).
import './runtime.mjs';
import {nodeFile,readFileRetry} from './runtime.mjs';
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
  const data=new Uint8Array(await readFileRetry(abs));
  const task=pdfjs.getDocument({data,disableFontFace:true,isEvalSupported:false,verbosity:0});
  const pdf=await task.promise;
  try{
    const page=await pdf.getPage(1); const tc=await page.getTextContent();
    return groupItemsIntoLines(tc.items).map(l=>l.text).join('\n').trim();
  } finally { try{ await pdf.destroy(); }catch{} }
}

// Structure d'un XML : RSET / RSEE RE2020 (balise racine <projet> avec blocs RSET / RSEnv) ou DPE ADEME.
export async function probeXml(abs){
  const t=await readFileRetry(abs,'utf8');
  const head=t.slice(0,4000);
  if(isDpeXmlText(t)) return {re2020:null,dpe:true};
  if(/<projet[\s>]/i.test(head)||/<projet[\s>]/i.test(t.slice(0,200000))){
    if(/<RSEnv[\s>/]/.test(t)) return {re2020:'RSEE',dpe:false};
    if(/<RSET[\s>/]/.test(t)) return {re2020:'RSET',dpe:false};
  }
  // v2.25.0 — autres XML connus : entrée ThCEx (<Projet><Calcul_ThE>), dossier de contrôle thermique, index de DCE.
  if(/<Projet[\s>]/.test(head)&&/<Calcul_(ThE|projet)[\s>/]/i.test(t.slice(0,20000))) return {re2020:null,dpe:false,other:'thcex'};
  if(/<dossier_controle[\s>/]/i.test(head)) return {re2020:null,dpe:false,other:'controle'};
  if(/<dce[\s>/]/i.test(head)&&/<document[\s>/]/i.test(t.slice(0,20000))) return {re2020:null,dpe:false,other:'dce'};
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
export {enableOcr} from './runtime.mjs';
export function readResult(workDir,rel){ return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(workDir,rel))).toString('utf8')); }

// Lecture complète + parseurs. familyOverride : clé de DOCUMENT_FAMILIES choisie dans la liste « À vérifier ».
export async function extractFile(entry,{familyOverride=null,incompleteBelow=0.5,ocr=false,ocrOptions={}}={}){
  const file=nodeFile(entry.abs,entry.name);
  const d=makeDocumentRecord(file); d.relativePath=entry.relPath;
  if(familyOverride&&DOCUMENT_FAMILIES[familyOverride]){ d.familyMode='manual'; d.families=[familyOverride]; }
  else { d.familyMode='auto'; d.families=null; }
  d.read=await readFile(file,()=>{},{mode:ocr?'auto':'off',...(ocr?ocrOptions:{}),lang:'fra+eng',detectPlan:d.familyMode!=='manual',forcePlan:d.familyMode==='manual'&&familyOverride==='plan'});
  const pages=d.read?.pageCount||d.read?.pages?.length||0;
  const chars=String(d.read?.text||'').replace(/\s+/g,'').length;
  const ocrPages=d.read?.ocr?.pages?.length||0;
  const scan=d.read?.kind==='pdf'&&!d.read?.plan&&chars<Math.max(80,pages*40);
  prepareReadDocument(d);
  const {status,reason,completeness,fields}=docStatus(d,{scan});
  return {d,status,reason,completeness,pages,scan,fields};
}

// Famille de l'appli correspondant à un type (choix « Famille » d'un document), ou null.
export function familyForType(type){ const k=Object.keys(DOCUMENT_FAMILIES).find(k=>k!=='annex'&&DOCUMENT_FAMILIES[k].type===type); return k||(type===DOC_TYPES.RSEE_RE2020||type===DOC_TYPES.RSENV?'carbone':null); }
export function autoAgrees(appType,family){ return autoFamiliesForType(appType).includes(family); }

// v2.25.0 — statut d'un document lu. Un document incomplet ou sans donnée n'est plus « à vérifier » à lui seul : une étude
// est souvent découpée en plusieurs fichiers (RT Existant, CCTP par lot). Le contrôle se fait par opération (alertes de famille).
export function docStatus(d,{scan=false}={}){
  const found=new Set((d.cachedOccurrences||[]).map(o=>o?.field).filter(Boolean));
  const expected=d.read?.plan?[]:documentExpectedFields(d);
  const hit=expected.filter(e=>Array.isArray(e)?e.some(k=>found.has(k)):found.has(e));
  const completeness=expected.length?{found:hit.length,expected:expected.length}:null;
  if(d.parseError) return {status:'erreur',reason:`parseur en échec : ${d.parseError}`,completeness,fields:found.size};
  if(scan) return {status:'à vérifier',reason:'PDF sans texte (scan) : OCR à faire dans l’appli',completeness,fields:found.size};
  if(d.read?.plan) return {status:'traité',reason:'plan : non analysé (à mesurer dans Ashton)',completeness,fields:found.size};
  if(!found.size) return {status:'traité',reason:LOT_TYPES.has(d.type)?'lot : aucun champ suivi dans ce lot':'aucune donnée extraite (contrôle par opération)',completeness,fields:0};
  if(completeness&&hit.length<expected.length) return {status:'traité',reason:`${LOT_TYPES.has(d.type)?'lot':'partiel'} : ${hit.length}/${expected.length} champs attendus`,completeness,fields:found.size};
  return {status:'traité',reason:'',completeness,fields:found.size};
}

// Option --with-ai : IA locale (Ollama), propositions vérifiées mot pour mot, plafonnées à 85 %, à valider ✓ / ✕ dans l'appli.
export async function askLocalAi(d,{model='qwen2.5:7b'}={}){
  const res=await runLlmAssist(d,{config:{mode:'local',provider:'ollama',model,maxPages:6},fetchImpl:globalThis.fetch});
  return {accepted:res.accepted||[],rejected:(res.rejected||[]).length,note:res.note||''};
}

export {serializeDoc};
