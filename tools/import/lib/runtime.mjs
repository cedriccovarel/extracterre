// Environnement Node pour exécuter les modules de l'appli (js/*.js) sans navigateur :
// pdf.js 3.11.174 (même version que l'appli), SheetJS 0.18.5, stockage local en mémoire.
import {createRequire} from 'module';
import fs from 'fs';
import path from 'path';
const require=createRequire(import.meta.url);

if(!globalThis.localStorage){
  const m=new Map();
  globalThis.localStorage={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear(),key:i=>[...m.keys()][i]??null,get length(){return m.size;}};
}
if(!globalThis.sessionStorage) globalThis.sessionStorage=globalThis.localStorage;
if(!globalThis.performance) globalThis.performance={now:()=>Date.now()};

const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');
// readPdf affecte une URL de worker CDN : on lui donne un objet à part, le vrai pdf.js garde son worker local.
globalThis.pdfjsLib=new Proxy(pdfjs,{get(t,k){ if(k==='GlobalWorkerOptions') return {}; if(k==='getDocument'&&t.__getDocumentForApp) return t.__getDocumentForApp; const v=t[k]; return v; }});
pdfjs.GlobalWorkerOptions.workerSrc=require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
globalThis.XLSX=require('xlsx');
// OCR (v2.25.0) : même moteur que l'appli (tesseract.js 7), pages rendues par @napi-rs/canvas. Activé par enableOcr().
let OCR_ON=false;
export function enableOcr(){
  if(OCR_ON) return true;
  let napi,Tess; try{ napi=require('@napi-rs/canvas'); Tess=require('tesseract.js'); }catch{ return false; }
  class CanvasFactory{ create(w,h){ const canvas=napi.createCanvas(Math.max(1,w|0),Math.max(1,h|0)); return {canvas,context:canvas.getContext('2d')}; }
    reset(cc,w,h){ cc.canvas.width=Math.max(1,w|0); cc.canvas.height=Math.max(1,h|0); } destroy(cc){ cc.canvas.width=0; cc.canvas.height=0; cc.canvas=null; cc.context=null; } }
  const realGetDocument=pdfjs.getDocument;
  pdfjs.__getDocumentForApp=src=>realGetDocument({...(src||{}),canvasFactory:new CanvasFactory(),disableFontFace:true,isEvalSupported:false,verbosity:0});
  // readPdf crée la toile de la page par document.createElement('canvas').
  if(!globalThis.document) globalThis.document={createElement:t=>t==='canvas'?napi.createCanvas(1,1):{}};
  // tesseract.js sous Node lit une image PNG : la toile est convertie avant reconnaissance.
  const toImg=img=>img&&typeof img.toBuffer==='function'?img.toBuffer('image/png'):img;
  globalThis.Tesseract={...Tess,createWorker:async(...a)=>{ const w=await Tess.createWorker(...a); return new Proxy(w,{get(t,k){ if(k==='recognize') return (img,...r)=>t.recognize(toImg(img),...r); const v=t[k]; return typeof v==='function'?v.bind(t):v; }}); }};
  OCR_ON=true; return true;
}

import {withRetry} from './retry.mjs';
export {withRetry};
export const readFileRetry=(abs,enc)=>withRetry(()=>fs.promises.readFile(abs,enc));

// Objet « File » minimal attendu par js/readers.js.
export function nodeFile(absPath,name=path.basename(absPath)){
  const st=fs.statSync(absPath); let buf=null;
  const load=async()=>buf||(buf=await readFileRetry(absPath));
  return {name,size:st.size,lastModified:st.mtimeMs,
    async arrayBuffer(){ const b=await load(); return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength); },
    async text(){ return (await load()).toString('utf8'); },
    async bytes(){ return load(); }};
}
