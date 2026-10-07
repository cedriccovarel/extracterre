// Banc d'essai à partir d'un pack d'amélioration ExtracTerre (ZIP décompressé) — aucune donnée n'est stockée dans le dépôt.
// Usage : node tools/pack_bench.mjs . <dossier_du_pack> [rapport.json] [-v]
//  (1) signalements bêta « valeur fausse » : la valeur fausse ne doit plus sortir ;
//  (2) emplacements surlignés : la bonne valeur doit sortir quand les 3 lignes de contexte suffisent.
import fs from 'node:fs';
import path from 'node:path';
const repo='file://'+path.resolve(process.argv[2]||'.'), packDir=process.argv[3], verbose=process.argv.includes('-v');
const {parseDocument}=await import(repo+'/js/parsers.js');
const {normalizeText}=await import(repo+'/js/utils.js');
const {DOC_TYPES}=await import(repo+'/js/config.js');
const beta=JSON.parse(fs.readFileSync(packDir+'/erreurs_beta_proprietaire.json'));
const loc=JSON.parse(fs.readFileSync(packDir+'/apprentissage_emplacements.json'));
const mkDoc=(name,type,lines,page=1)=>{ const ls=lines.filter(Boolean).map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12})); const pg={page,text:ls.map(l=>l.text).join('\n'),lines:ls}; return {id:'b',name,type,familyMode:'auto',read:{kind:'pdf',pages:[pg],pageCount:1,text:pg.text},buildings:{names:['Bâtiment unique']}}; };
const same=(a,b)=>{ if(a===null||a===undefined||b===null||b===undefined) return false; const na=Number(a), nb=Number(b); if(Number.isFinite(na)&&Number.isFinite(nb)) return Math.abs(na-nb)<1e-6*Math.max(1,Math.abs(nb)); return normalizeText(String(a)).toLowerCase()===normalizeText(String(b)).toLowerCase(); };
const typeOf=t=>Object.values(DOC_TYPES).includes(t)?t:DOC_TYPES.UNKNOWN;
let wrongStill=0, wrongGone=0; const keys=new Set(); const stillList=[];
for(const e of beta.filter(e=>e.eventType==='beta_result_error')){
  const p=e.payload; if(!p.sourceExcerpt||/^manual:/.test(p.sourceMethod||'')||p.detectedValue===null) continue;
  const k=[p.field,p.detectedValue,p.sourceExcerpt].join('|'); if(keys.has(k)) continue; keys.add(k);
  const lines=String(p.sourceExcerpt).split(/\s\|\s/);
  const doc=mkDoc(p.sourceDocument||'doc.pdf',typeOf(e.payload.sourceDocType||guessType(p.sourceMethod,p.sourceDocument)),lines,p.sourcePage||1);
  let out=[]; try{ out=parseDocument(doc).filter(Boolean); }catch(err){ out=[]; }
  const bad=out.some(o=>o.field===p.field&&same(o.value,p.detectedValue)&&(o.confidence||0)>=0.65);
  if(bad){ wrongStill++; stillList.push(`${p.field}=${JSON.stringify(p.detectedValue)} [${p.sourceDocument?.slice(0,40)}] ${String(p.sourceExcerpt).slice(0,110)}`); } else wrongGone++;
}
function guessType(m='',n=''){ if(/rsenv/i.test(m)) return DOC_TYPES.RSENV; if(/renovation:|rtex/i.test(m)) return DOC_TYPES.RT_EXISTING; if(/rt2012|rset:/i.test(m)) return /re2020|rsee/i.test(n)?DOC_TYPES.RSET_RE2020:DOC_TYPES.RT2012; if(/carbon/i.test(m)) return DOC_TYPES.CARBON; return DOC_TYPES.THERMAL; }
// Emplacements appris : document reconstruit avec les lignes avant / valeur / après.
let found=0, missed=0; const missList=[]; const lk=new Set();
for(const e of loc){ const p=e.payload; if(p.correctedValue===null||p.correctedValue===undefined||p.correctedValue==='') continue;
  const k=[p.field,p.document,p.page,p.lineText].join('|'); if(lk.has(k)) continue; lk.add(k);
  const doc=mkDoc(p.document||'doc.pdf',typeOf(p.docType),[p.beforeLine,p.lineText,p.afterLine],p.page||1);
  let out=[]; try{ out=parseDocument(doc).filter(Boolean); }catch{}
  const ok=out.some(o=>o.field===p.field&&same(o.value,p.correctedValue));
  if(ok) found++; else { missed++; missList.push(`${p.docType} ${p.field}=${JSON.stringify(p.correctedValue)} | ${String(p.beforeLine||'').slice(0,50)} ‖ ${String(p.lineText).slice(0,90)} ‖ ${String(p.afterLine||'').slice(0,40)}`); }
}
console.log(`Signalements « valeur fausse » : ${wrongGone} corrigés, ${wrongStill} encore produits`);
console.log(`Emplacements appris (contexte 3 lignes) : ${found} retrouvés, ${missed} manqués`);
if(verbose){ console.log('--- encore produits'); stillList.forEach(s=>console.log(' ',s)); console.log('--- manqués'); missList.forEach(s=>console.log(' ',s)); }
if(process.argv[4]&&!process.argv[4].startsWith('-')) fs.writeFileSync(process.argv[4],JSON.stringify({wrongStill,wrongGone,found,missed,stillList,missList},null,1));
