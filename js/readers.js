import {MAX_OCR_WORKERS} from './config.js';
import {normalizeText, uid} from './utils.js';

const OCR_DEFAULTS={mode:'auto',lang:'fra+eng',scale:1.85,maxPixels:5200000,minChars:150};
function throwIfAborted(signal){ if(signal?.aborted){ const e=new Error(signal.reason==='analysis-timeout'?'Analyse interrompue après 5 minutes.':'Analyse annulée.'); e.name='AbortError'; throw e; } }


let OCR_ACTIVE=0;
let OCR_LIMIT=MAX_OCR_WORKERS;
const OCR_WAITING=[];
function pumpOcrQueue(){
  while(OCR_ACTIVE<OCR_LIMIT&&OCR_WAITING.length){
    const item=OCR_WAITING.shift();
    if(item.signal?.aborted){ item.reject(Object.assign(new Error('Analyse annulée.'),{name:'AbortError'})); continue; }
    OCR_ACTIVE++;
    item.cleanup?.();
    item.resolve(()=>{ OCR_ACTIVE=Math.max(0,OCR_ACTIVE-1); pumpOcrQueue(); });
  }
}
function acquireOcrSlot(signal,onWaiting=()=>{}){
  throwIfAborted(signal);
  if(OCR_ACTIVE<OCR_LIMIT){ OCR_ACTIVE++; return Promise.resolve(()=>{ OCR_ACTIVE=Math.max(0,OCR_ACTIVE-1); pumpOcrQueue(); }); }
  onWaiting(OCR_ACTIVE,OCR_WAITING.length+1);
  return new Promise((resolve,reject)=>{
    const item={signal,resolve,reject,cleanup:null};
    const abort=()=>{ const i=OCR_WAITING.indexOf(item); if(i>=0) OCR_WAITING.splice(i,1); reject(Object.assign(new Error('Analyse annulée.'),{name:'AbortError'})); };
    item.cleanup=()=>signal?.removeEventListener('abort',abort);
    signal?.addEventListener('abort',abort,{once:true}); OCR_WAITING.push(item);
  });
}
export function setOcrConcurrencyLimit(limit=MAX_OCR_WORKERS){
  const next=Math.max(1,Math.min(2,Math.round(Number(limit)||MAX_OCR_WORKERS)));
  OCR_LIMIT=next;
  pumpOcrQueue();
  return OCR_LIMIT;
}
export function ocrPoolStatus(){ return {active:OCR_ACTIVE,waiting:OCR_WAITING.length,max:OCR_LIMIT}; }

function groupItemsIntoLines(items, yTolerance=2.8) {
  const enriched=items.map((it,idx)=>({text:it.str||'',x:it.transform?.[4]||0,y:it.transform?.[5]||0,w:it.width||0,idx})).filter(i=>i.text.trim());
  enriched.sort((a,b)=>Math.abs(b.y-a.y)>yTolerance?b.y-a.y:a.x-b.x);
  const lines=[];
  for(const item of enriched){
    let line=lines.find(l=>Math.abs(l.y-item.y)<=yTolerance);
    if(!line){ line={y:item.y,items:[]}; lines.push(line); }
    line.items.push(item);
  }
  lines.sort((a,b)=>b.y-a.y);
  return lines.map((line,index)=>{
    line.items.sort((a,b)=>a.x-b.x);
    let text=''; let prev=null;
    for(const it of line.items){ if(prev){ const gap=it.x-(prev.x+prev.w); if(gap>2) text+=' '; } text+=it.text; prev=it; }
    return {index,text:normalizeText(text),items:line.items.map(it=>({text:it.text,x:it.x}))};
  }).filter(l=>l.text);
}

function ocrTextToLines(text=''){
  return String(text||'').split(/\r?\n/).map(normalizeText).filter(Boolean).map((text,index)=>({index,y:null,text,items:[],ocr:true}));
}

export function pdfTextQuality(text='',items=[]){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  if(!raw) return {score:0,chars:0,alnumRatio:0,weirdRatio:1,fragmentRatio:1};
  const chars=raw.length;
  const alnum=(raw.match(/[A-Za-zÀ-ÿ0-9]/g)||[]).length;
  const weird=(raw.match(/[�□■◆◇▯����]/g)||[]).length;
  const tokens=raw.split(/\s+/).filter(Boolean);
  const fragments=tokens.filter(t=>t.length===1&&!/[0-9A-Za-zÀ-ÿ]/.test(t)).length;
  const alnumRatio=alnum/Math.max(1,chars);
  const weirdRatio=weird/Math.max(1,chars);
  const fragmentRatio=fragments/Math.max(1,tokens.length);
  const lengthScore=Math.min(1,chars/520);
  const itemScore=Math.min(1,(items?.length||0)/65);
  const score=Math.max(0,Math.min(1,lengthScore*.28+alnumRatio*.38+itemScore*.20+(1-Math.min(1,weirdRatio*7))*.09+(1-Math.min(1,fragmentRatio*4))*.05));
  return {score,chars,alnumRatio,weirdRatio,fragmentRatio};
}


function countNumericTokens(line=''){
  return (String(line).match(/(?<![A-Za-zÀ-ÿ])[-+]?\d+(?:[,.]\d+)?/g)||[]).length;
}
function criticalTableNeedsOcr(text=''){
  const raw=String(text||'');
  const low=normalizeText(raw).toLowerCase();
  const lines=raw.split(/\r?\n/).map(normalizeText).filter(Boolean);
  // SHAB : l'en-tête est visible mais aucune ligne de zone exploitable n'est reconstruite.
  if(/surface\s+utile\s+(?:su|surt)|surf\.?\s*hab\.?\s*shab|shab\s+ou\s+surt|s\s*ref\s*\/\s*usage\s+principal|surface\s+habitable(?:\s+du\s+batiment)?|surface\s+du\s+batiment/.test(low)){
    const zoneRows=lines.filter(l=>/^zone\b/i.test(l)&&countNumericTokens(l)>=2).length;
    const explicitRows=lines.filter(l=>/(?:\bshab\s+ou\s+surt\b|\bshab\s*\/\s*su\b|\bs\s*ref\s*\/\s*usage\s+principal\b|^\s*s\s*ref\s*:|^\s*surface\s+(?:habitable|du\s+batiment)\b)/i.test(l)&&countNumericTokens(l)>=1).length;
    if(zoneRows===0&&explicitRows===0) return true;
  }
  // Cep détaillé : titre détecté mais aucune ligne bâtiment suffisamment structurée.
  if(/resultats?\s+detaille?s?\s+des\s+consommations\s+annuelles|consommations\s+annuelles\s+par\s+poste/.test(low)){
    const structured=lines.some(l=>/^(?:batiment|bâtiment)\b/i.test(l)&&countNumericTokens(l)>=6);
    const postRows=lines.filter(l=>/^(?:chauffage|refroidissement|ecs|eclairage|éclairage|auxiliaires|deplacement)/i.test(l)&&countNumericTokens(l)>=1).length;
    if(!structured&&postRows<3) return true;
  }
  // Bao Evolution / audits de rénovation : ces pages portent des consommations d'énergie primaire
  // par poste. Si l'en-tête existe mais que les lignes du tableau sont trop fragmentées, on OCRise
  // uniquement cette page afin de sécuriser Cep avant/après et les postes détaillés.
  if(/details\s+des\s+consommations/.test(low) && /energie\s+primaire/.test(low)){
    const labels=['chauffage','refroidissement','ecs','eclairage','auxiliaires','ventilateurs','autres usages'];
    const labelHits=labels.filter(label=>low.includes(label)).length;
    const numericPostRows=lines.filter(l=>/^(?:chauffage|refroidissement|ecs|eau\s+chaude|eclairage|éclairage|auxiliaires|ventilateurs|autres\s+usages|electricit)/i.test(l)&&countNumericTokens(l)>=2).length;
    const totalPrimary=lines.some(l=>/^total\b/i.test(l)&&countNumericTokens(l)>=2)||/total\s+kwh\s*ep\s*\/\s*m[²2]/i.test(low);
    if(labelHits<6||numericPostRows<4||!totalPrimary) return true;
  }
  // Le bilan GES Bao est court mais essentiel : OCR ciblé si les libellés sont visibles sans leurs valeurs.
  if(/evolution\s+emission\s+ges|emission\s+de\s+co2\s+avant\s+travaux/.test(low)){
    const gesRows=lines.filter(l=>/emission\s+de\s+co2\s+(?:avant|apres|après|des\s+travaux)/i.test(l)&&countNumericTokens(l)>=1).length;
    if(gesRows<2) return true;
  }
  // Bao : les pages Ubat, enveloppe et systèmes ont une structure stable. Si leur titre est lisible
  // mais que la valeur/ligne métier manque dans la couche texte, on OCRise uniquement cette page.
  if(/calcul\s+du\s+coefficient\s+ubat/.test(low) && !/coefficient\s+ubat\s*=\s*[-+]?\d+(?:[,.]\d+)?/.test(low)) return true;
  if(/details\s+des\s+parois/.test(low)){
    const compositionRows=lines.filter(l=>/(?:laine|isover|polysty|polyurethane|fibre\s+de\s+bois|ouate|brique|beton|béton)/i.test(l)&&countNumericTokens(l)>=1).length;
    if(compositionRows<2) return true;
  }
  if(/catalogue\s+des\s+vitrages/.test(low)){
    const vitrageRows=lines.filter(l=>/^fe\d+\b/i.test(l)&&countNumericTokens(l)>=2).length;
    if(vitrageRows<2 || (!/\bdouble\b|\btriple\b/i.test(low) && !/\buw\b/i.test(low))) return true;
  }
  if(/saisie\s+de\s+la\s+ventilation|saisie\s+de\s+l['’]?ecs|saisie\s+des\s+generations/.test(low)){
    const signals=['systeme de ventilation','type d ecs','type de stockage','type de generateur','type d energie pour la production de chaud'];
    const hits=signals.filter(x=>low.includes(x)).length;
    if(hits===0) return true;
  }
  // ACV / RSENV : si le tableau résumé des lots est détecté mais ses totaux sont cassés,
  // l'OCR de secours est utile même quand la couche texte générale semble bonne.
  if(/(?:1\s*[-–—]\s*vrd|energie\s*\(\s*ce\s*\)|iccomposant|ic\s*composant)/.test(low) && /total\s*(?:lot)?\s*:/.test(low)){
    const totals=lines.filter(l=>/^total\s*(?:lot)?\s*:/i.test(l)&&countNumericTokens(l)>=5).length;
    if(totals<2) return true;
  }
  return false;
}

export function shouldOcrPdfPage(text='',items=[],mode='auto'){
  if(mode==='off') return false;
  if(mode==='always'||mode==='max') return true;
  const q=pdfTextQuality(text,items);
  // Cas typiques : PDF scanné sans couche texte, texte minuscule, caractères cassés,
  // extraction trop fragmentée ou tableau métier critique dont les lignes sont incomplètes.
  return q.chars<OCR_DEFAULTS.minChars || (items?.length||0)<10 || q.score<0.56 || q.weirdRatio>0.025 || q.fragmentRatio>0.18 || criticalTableNeedsOcr(text);
}

function mergePdfAndOcrLines(pdfLines=[],ocrLines=[],pdfQuality=null,ocrQuality=null){
  if(!ocrLines.length) return {lines:pdfLines,source:'pdf'};
  if(!pdfLines.length) return {lines:ocrLines,source:'ocr'};
  const pq=pdfQuality?.score??0, oq=ocrQuality?.score??0;
  // Si la couche texte est très faible, l'OCR devient la base principale.
  if(oq>pq+0.17 || pq<0.42) return {lines:ocrLines,source:'ocr'};
  // Sinon on garde la géométrie PDF.js et on ajoute seulement les lignes OCR nouvelles.
  const seen=new Set(pdfLines.map(l=>normalizeText(l.text).toLowerCase()));
  const extra=ocrLines.filter(l=>{ const k=normalizeText(l.text).toLowerCase(); if(!k||seen.has(k)) return false; seen.add(k); return true; });
  return {lines:[...pdfLines,...extra.map((l,i)=>({...l,index:pdfLines.length+i}))],source:extra.length?'hybrid':'pdf'};
}

async function renderPdfPageForOcr(page,opts={}){
  const base=page.getViewport({scale:1});
  const wanted=opts.scale||OCR_DEFAULTS.scale;
  const maxPixels=opts.maxPixels||OCR_DEFAULTS.maxPixels;
  const scale=Math.min(wanted,Math.sqrt(maxPixels/Math.max(1,base.width*base.height)));
  const viewport=page.getViewport({scale:Math.max(1.25,scale)});
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.floor(viewport.width)); canvas.height=Math.max(1,Math.floor(viewport.height));
  const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:true});
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:ctx,viewport,background:'white'}).promise;
  return canvas;
}

async function createOcrWorker(lang,onLog=()=>{}){
  if(!globalThis.Tesseract?.createWorker) return null;
  return globalThis.Tesseract.createWorker(lang||OCR_DEFAULTS.lang,1,{logger:onLog});
}

export async function readPdf(file, onProgress=()=>{}, options={}) {
  if(!globalThis.pdfjsLib) throw new Error('PDF.js non chargé. Vérifiez la connexion au premier chargement.');
  globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const opts={...OCR_DEFAULTS,...options};
  if(opts.mode==='max'){ opts.scale=Math.max(Number(opts.scale)||0,3.0); opts.maxPixels=Math.max(Number(opts.maxPixels)||0,8000000); opts.minChars=0; }
  throwIfAborted(opts.signal);
  const ocrPages=[]; const ocrWarnings=[]; let activeOcrPage=1; let totalPages=1; let worker=null; let abortedWorker=false,releaseOcrSlot=null;
  const workerEnabled=opts.mode!=='off'&&!!globalThis.Tesseract?.createWorker;
  let workerInitError=null;
  let data=null, loadingTask=null, pdf=null;
  const pages=[];
  const ensureWorker=async()=>{
    if(worker||workerInitError||!workerEnabled) return worker;
    try{
      releaseOcrSlot=await acquireOcrSlot(opts.signal,(active,waiting)=>onProgress(.01,{stage:'ocr-wait',page:activeOcrPage,totalPages,message:`OCR en attente · ${active}/${OCR_LIMIT} actif · file ${waiting}`}));
      worker=await createOcrWorker(opts.lang,m=>{
        if(m?.status==='recognizing text'&&Number.isFinite(m.progress)) onProgress(((activeOcrPage-1)+.25+.68*m.progress)/Math.max(1,totalPages),{stage:'ocr',page:activeOcrPage,totalPages,ocrProgress:m.progress,message:`OCR · page ${activeOcrPage}/${totalPages} · ${Math.round(m.progress*100)} %`});
        else if(m?.status) onProgress(.01,{stage:'ocr-init',page:activeOcrPage,totalPages,message:`Initialisation OCR · ${m.status}`});
      });
      if(worker&&opts.mode==='max'&&typeof worker.setParameters==='function') try{ await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'}); }catch{}
    }catch(err){ workerInitError=err; if(releaseOcrSlot){ releaseOcrSlot(); releaseOcrSlot=null; } }
    return worker;
  };
  const abortHandler=()=>{ abortedWorker=true; if(worker){ try{worker.terminate();}catch{} } if(loadingTask){ try{loadingTask.destroy?.();}catch{} } };
  opts.signal?.addEventListener('abort',abortHandler,{once:true});
  try{
    data=await file.arrayBuffer();
    throwIfAborted(opts.signal);
    loadingTask=globalThis.pdfjsLib.getDocument({data});
    pdf=await loadingTask.promise;
    data=null; // PDF.js possède désormais sa copie ; libère la référence au gros ArrayBuffer du fichier.
    throwIfAborted(opts.signal);
    totalPages=pdf.numPages;
    for(let p=1;p<=pdf.numPages;p++){
      throwIfAborted(opts.signal);
      let page=null, content=null, canvas=null;
      try{
        page=await pdf.getPage(p);
        content=await page.getTextContent({includeMarkedContent:true});
        throwIfAborted(opts.signal);
        const pdfLines=groupItemsIntoLines(content.items);
        const pdfText=pdfLines.map(l=>l.text).join('\n');
        const pdfQuality=pdfTextQuality(pdfText,content.items);
        let finalLines=pdfLines, textSource='pdf', ocrConfidence=null;
        const needOcr=shouldOcrPdfPage(pdfText,content.items,opts.mode);
        onProgress(((p-1)+.18)/pdf.numPages,{stage:'pdf',page:p,totalPages:pdf.numPages,message:`Lecture PDF page ${p}/${pdf.numPages}`});
        if(needOcr){
          activeOcrPage=p;
          if(workerEnabled&&!worker&&!workerInitError) await ensureWorker();
          if(!globalThis.Tesseract?.createWorker){
            ocrWarnings.push(`Page ${p} : OCR requis mais Tesseract.js n'est pas chargé.`);
          } else if(!worker){
            ocrWarnings.push(`Page ${p} : worker OCR indisponible${workerInitError?` (${workerInitError?.message||workerInitError})`:''}.`);
          } else {
            try{
              canvas=await renderPdfPageForOcr(page,opts);
              const ret=await worker.recognize(canvas);
              throwIfAborted(opts.signal);
              const ocrText=String(ret?.data?.text||'');
              ocrConfidence=Number.isFinite(ret?.data?.confidence)?ret.data.confidence:null;
              const ocrLines=ocrTextToLines(ocrText);
              const ocrQuality=pdfTextQuality(ocrText,ocrLines.map(l=>({str:l.text})));
              const merged=mergePdfAndOcrLines(pdfLines,ocrLines,pdfQuality,ocrQuality);
              finalLines=merged.lines; textSource=merged.source; ocrPages.push(p);
            }catch(err){ if(opts.signal?.aborted) throw err; ocrWarnings.push(`Page ${p} : échec OCR (${err?.message||err}).`); }
          }
        }
        const text=finalLines.map(l=>l.text).join('\n');
        // Ne conserver que les structures réellement utilisées par les parseurs.
        // Pas de copie page.items ni de copie ocrText : ces objets doublaient/triplaient la RAM.
        pages.push({page:p,text,lines:finalLines,textSource,pdfTextQuality:pdfQuality.score,ocrConfidence});
        onProgress(p/pdf.numPages,{stage:'page-done',page:p,totalPages:pdf.numPages,message:`Page ${p}/${pdf.numPages} lue${textSource==='ocr'?' · OCR':textSource==='hybrid'?' · PDF + OCR':''}`});
      } finally {
        if(canvas){ try{canvas.width=1; canvas.height=1; canvas.remove?.();}catch{} canvas=null; }
        if(content?.items){ try{content.items.length=0;}catch{} }
        if(page){ try{page.cleanup?.();}catch{} }
        content=null; page=null;
      }
    }
    const text=pages.map(p=>p.text).join('\n\f\n');
    return {kind:'pdf',pages,text,pageCount:totalPages,ocr:{mode:opts.mode,used:ocrPages.length>0,pages:ocrPages,warnings:ocrWarnings,engine:'Tesseract.js',languages:opts.lang,parallelism:`global-pool-${OCR_LIMIT}`,quality:opts.mode==='max'?'maximum':'standard'}};
  } finally {
    opts.signal?.removeEventListener('abort',abortHandler);
    if(worker&&!abortedWorker){ try{await worker.terminate();}catch{} }
    worker=null;
    if(releaseOcrSlot){ releaseOcrSlot(); releaseOcrSlot=null; }
    if(pdf){ try{pdf.cleanup?.();}catch{} try{await pdf.destroy?.();}catch{} }
    else if(loadingTask){ try{await loadingTask.destroy?.();}catch{} }
    pdf=null; loadingTask=null; data=null;
  }
}

export function compactReadForRetention(read){
  if(!read) return null;
  const pages=(read.pages||[]).map(page=>({
    page:page.page,
    ...(page.sheet?{sheet:page.sheet}:{}),
    lines:(page.lines||[]).map(line=>({
      index:Number.isFinite(line.index)?line.index:0,
      text:String(line.text||''),
      ...(Array.isArray(line.cells)?{cells:line.cells.map(v=>v==null?'':String(v))}:{}),
      ...(line.ocr?{ocr:true}:{})
    })),
    ...(page.textSource?{textSource:page.textSource}:{}),
    ...(Number.isFinite(page.pdfTextQuality)?{pdfTextQuality:page.pdfTextQuality}:{}),
    ...(Number.isFinite(page.ocrConfidence)?{ocrConfidence:page.ocrConfidence}:{}),
  }));
  const text=String(read.text||pages.map(p=>p.lines.map(l=>l.text).join('\n')).join('\n\f\n'));
  return {kind:read.kind||'',pageCount:Number.isFinite(read.pageCount)?read.pageCount:pages.length,pages,text,ocr:read.ocr?{...read.ocr,warnings:[...(read.ocr.warnings||[])],pages:[...(read.ocr.pages||[])]}:null,retainedCompact:true};
}

export async function readXml(file){
  const text=await file.text(); const parser=new DOMParser(); const xml=parser.parseFromString(text,'application/xml');
  if(xml.querySelector('parsererror')) throw new Error('XML illisible ou invalide.');
  const rows=[]; let idx=0;
  const walk=(node,path=[])=>{
    for(const child of node.children||[]){ const p=[...path,child.tagName]; const value=(child.children.length===0?child.textContent:'').trim(); if(value) rows.push(`${p.join(' > ')} = ${value}`); walk(child,p); }
  }; walk(xml.documentElement,[xml.documentElement.tagName]);
  const normalized=rows.join('\n'); return {kind:'xml',pages:[{page:1,text:normalized,lines:rows.map(text=>({index:idx++,text}))}],text:normalized,pageCount:1};
}

export async function readSpreadsheet(file){
  if(!globalThis.XLSX) throw new Error('SheetJS non chargé. Vérifiez la connexion au premier chargement.');
  const data=await file.arrayBuffer(); const wb=globalThis.XLSX.read(data,{type:'array',cellDates:false,raw:false});
  const pages=[]; let p=1;
  for(const name of wb.SheetNames){ const ws=wb.Sheets[name]; const matrix=globalThis.XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
    const lines=matrix.map((row,index)=>({index,text:normalizeText(row.map(v=>String(v??'')).join(' | ')),cells:row})).filter(l=>l.text.replace(/\|/g,'').trim());
    pages.push({page:p++,sheet:name,text:lines.map(l=>l.text).join('\n'),lines});
  }
  return {kind:'spreadsheet',pages,text:pages.map(p=>`[${p.sheet}]\n${p.text}`).join('\n\f\n'),pageCount:pages.length};
}

export async function readFile(file,onProgress=()=>{},options={}){
  throwIfAborted(options.signal); const lower=file.name.toLowerCase();
  if(lower.endsWith('.pdf')) return readPdf(file,onProgress,options);
  if(lower.endsWith('.xml')) return readXml(file);
  if(lower.endsWith('.xlsx')||lower.endsWith('.xls')) return readSpreadsheet(file);
  throw new Error(`Format non pris en charge : ${file.name}`);
}

export function makeDocumentRecord(file){ return {id:uid('doc'),file,name:file.name,size:file.size,type:'En attente',classification:null,read:null,status:'pending',error:null}; }
