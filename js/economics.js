import {DOC_TYPES} from './config.js';
import {normalizeText,normLower,parseFrNumber} from './utils.js';

function moneyValue(v){
  const s=String(v??'').replace(/\u00a0/g,' ').trim();
  if(!s) return null;
  const cleaned=s.replace(/€/g,'').replace(/\s/g,'');
  const n=parseFrNumber(cleaned); return n!==null&&n>=0?n:null;
}
function cleanLotLabel(s){ return normalizeText(String(s||'')).replace(/^total\s+/i,'').replace(/\s*[:|].*$/,'').replace(/\s{2,}/g,' ').trim(); }
function canonicalLotKey(label){ return normLower(label).replace(/\bn[°o]\b/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function candidateFromCells(cells,sheet=''){
  const vals=(cells||[]).map(v=>String(v??'').trim()); const joined=normalizeText(vals.join(' | ')); const low=normLower(joined);
  if(!/\blot\b/.test(low)||/sous[- ]?total|total\s+g[eé]n[eé]ral|tva|ttc/.test(low)) return null;
  const labelCell=vals.find(v=>/\blot\b/i.test(v))||'';
  const label=cleanLotLabel(labelCell || joined.split('|')[0]);
  const nums=[]; vals.forEach((v,idx)=>{ const n=moneyValue(v); if(n!==null) nums.push({n,idx,raw:v}); });
  if(!nums.length) return null;
  // Dans un DPGF, le montant HT de ligne/lot est généralement la dernière valeur monétaire de la ligne.
  const amount=nums[nums.length-1].n;
  if(!label||amount<=0) return null;
  const score=/total\s+lot/i.test(joined)?.99:(/montant\s*ht|prix\s*ht|total\s*ht/i.test(joined)?.97:.91);
  return {label,amount,confidence:score,sheet,excerpt:joined};
}
function parseDpgfDocument(doc){
  const out=[];
  for(const page of doc.read?.pages||[]){
    const lines=page.lines||[];
    for(const line of lines){
      let c=null;
      if(Array.isArray(line.cells)) c=candidateFromCells(line.cells,page.sheet||'');
      if(!c){
        const raw=normalizeText(line.text||''); const low=normLower(raw);
        if(/\blot\b/.test(low)&&!/tva|ttc|total\s+g[eé]n[eé]ral/.test(low)){
          const m=raw.match(/((?:lot|LOT)\s*(?:n?[°o]?\s*)?[0-9A-Z.-]{0,8}\s*[-–:]?\s*[^|€]{2,80}?)(?:\||\s{2,})([^|]*?(?:€|eur|ht)?\s*)$/i);
          const nums=[...raw.matchAll(/(?:^|\s|\|)(-?[\d\s]+(?:[.,]\d{1,2})?)\s*(?:€|eur)?(?=\s|\||$)/gi)].map(x=>moneyValue(x[1])).filter(x=>x!==null);
          if(nums.length){ const label=cleanLotLabel(m?.[1]||raw.split('|')[0]); const amount=nums[nums.length-1]; if(label&&amount>0) c={label,amount,confidence:/total\s+lot/i.test(raw)?.99:.91,sheet:page.sheet||'',excerpt:raw}; }
        }
      }
      if(c) out.push({...c,document:doc.name,page:page.page,docId:doc.id});
    }
    // Feuille dédiée à un lot : accepter un total HT explicite même si la ligne ne répète pas le mot LOT.
    if(page.sheet&&/\blot\b/i.test(page.sheet)){
      const totals=lines.filter(l=>/total\s*(?:du\s*)?(?:lot)?\s*ht|montant\s*ht|total\s*ht/i.test(l.text||''));
      for(const line of totals){ const nums=(line.cells||[]).map(moneyValue).filter(x=>x!==null); if(nums.length){ out.push({label:cleanLotLabel(page.sheet),amount:nums[nums.length-1],confidence:.98,sheet:page.sheet,excerpt:normalizeText(line.text),document:doc.name,page:page.page,docId:doc.id}); } }
    }
  }
  return out;
}
export function analyzeEconomicData(docs,operation='',manual={}){
  const candidates=docs.filter(d=>d.status==='ready'&&d.type===DOC_TYPES.DPGF).flatMap(parseDpgfDocument);
  const best=new Map();
  for(const c of candidates){ const key=canonicalLotKey(c.label); const prev=best.get(key); if(!prev||c.confidence>prev.confidence||c.confidence===prev.confidence) best.set(key,c); }
  const lots=[...best.values()].sort((a,b)=>a.label.localeCompare(b.label,'fr',{numeric:true}));
  for(const [label,value] of Object.entries(manual||{})){ const key=canonicalLotKey(label); const existing=lots.find(x=>canonicalLotKey(x.label)===key); if(existing){existing.amount=value;existing.manual=true;existing.confidence=1;} else lots.push({label,amount:value,manual:true,confidence:1,document:'Correction utilisateur',page:'',excerpt:'Valeur économique saisie manuellement'}); }
  const total=lots.reduce((s,x)=>s+(Number(x.amount)||0),0);
  return {operation,lots,total,documents:docs.filter(d=>d.status==='ready'&&d.type===DOC_TYPES.DPGF).map(d=>d.name)};
}
