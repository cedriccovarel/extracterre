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
globalThis.pdfjsLib=new Proxy(pdfjs,{get(t,k){ if(k==='GlobalWorkerOptions') return {}; const v=t[k]; return v; }});
pdfjs.GlobalWorkerOptions.workerSrc=require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
globalThis.XLSX=require('xlsx');
// Pas d'OCR en Node : les pages scannées sont signalées « PDF sans texte » (à traiter dans l'appli, OCR navigateur).

// Objet « File » minimal attendu par js/readers.js.
export function nodeFile(absPath,name=path.basename(absPath)){
  const st=fs.statSync(absPath); let buf=null;
  const load=async()=>buf||(buf=await fs.promises.readFile(absPath));
  return {name,size:st.size,lastModified:st.mtimeMs,
    async arrayBuffer(){ const b=await load(); return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength); },
    async text(){ return (await load()).toString('utf8'); },
    async bytes(){ return load(); }};
}
