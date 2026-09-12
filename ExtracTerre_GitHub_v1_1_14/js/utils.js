export function normalizeText(s='') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
}
export function normLower(s=''){ return normalizeText(s).toLowerCase(); }

export function normalizeGlazingType(value='') {
  const raw=String(value??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/×/g,'x').replace(/\s+/g,' ').trim();
  if(!raw) return null;
  const gasFrom=(text='')=>{
    if(/\b(?:argon|gaz\s+argon)\b/i.test(text)||/\bAr\b/.test(text)) return 'Ar';
    if(/\b(?:krypton|gaz\s+krypton)\b/i.test(text)||/\bKr\b/.test(text)) return 'Kr';
    if(/\b(?:lame\s+d['’]?air|air)\b/i.test(text)) return 'Air';
    return '';
  };
  const n=v=>String(v).replace(',', '.').replace(/\.0+$/,'');
  const plausible=parts=>parts.every((x,i)=>{ const v=Number(String(x).replace(',','.')); return Number.isFinite(v)&&v>0&&(i%2===1?(v>=6&&v<=40):(v>=2&&v<=12)); });
  // Triple vitrage, ex. 4/12/4/12/4 Ar.
  let m=raw.match(/(?<!\d)(\d{1,3}(?:[,.]\d)?)\s*(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)\s*(?:(Ar(?:gon)?|Kr(?:ypton)?|air)\s*)?(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)\s*(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)\s*(?:(Ar(?:gon)?|Kr(?:ypton)?|air)\s*)?(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)(?!\d)/i);
  if(m){ const parts=[m[1],m[2],m[4],m[5],m[7]]; if(plausible(parts)){ const gas=gasFrom(`${m[3]||''} ${m[6]||''} ${raw}`); return `${parts.map(n).join('.')}${gas?` ${gas}`:''}`; } }
  // Double vitrage, ex. 4/16/4 Argon ou 4-16Ar-4.
  m=raw.match(/(?<!\d)(\d{1,3}(?:[,.]\d)?)\s*(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)\s*(?:(Ar(?:gon)?|Kr(?:ypton)?|air)\s*)?(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)(?!\d)/i);
  if(m){ const parts=[m[1],m[2],m[4]]; if(plausible(parts)){ const gas=gasFrom(m[3]||raw); return `${parts.map(n).join('.')}${gas?` ${gas}`:''}`; } }
  // Les RSET écrivent parfois directement « 4.16.4 Ar ».
  m=raw.match(/(?<!\d)(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})(?!\d)/);
  if(m&&plausible([m[1],m[2],m[3]])){ const gas=gasFrom(raw); return `${m[1]}.${m[2]}.${m[3]}${gas?` ${gas}`:''}`; }
  const low=normLower(raw);
  // Certains rapports Bao Evolution n'indiquent pas l'épaisseur des verres mais seulement
  // « Double +15mm ». On conserve l'information réellement présente sans inventer 4/15/4.
  m=raw.match(/\bdouble(?:\s+vitrage)?\s*(?:[-–—:]\s*)?lame\s*(?:de\s*)?(\d{1,2}(?:[,.]\d+)?)\s*mm\b/i)||raw.match(/\bdouble(?:\s+vitrage)?\s*\+?\s*(\d{1,2}(?:[,.]\d+)?)\s*mm\b/i);
  if(m) return `Double vitrage — lame ${n(m[1])} mm`;
  if(/triple\s+vitrage|3\s+vitrages|triple\s+verre/.test(low)) return 'Triple vitrage';
  if(/double\s+vitrage|2\s+vitrages|vitrage\s+vir|faible\s+emissiv|low-e|peu\s+emissif/.test(low)) return /vir|faible\s+emissiv|low-e|peu\s+emissif/.test(low)?'Double vitrage VIR':'Double vitrage';
  if(/simple\s+vitrage|simple\s+verre/.test(low)) return 'Simple vitrage';
  return null;
}
export function parseFrNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v == null) return null;
  const s = String(v).replace(/\u00a0/g,' ').replace(/\s(?=\d{3}(?:\D|$))/g,'').replace(',', '.').replace(/[^0-9+\-.]/g,'');
  if (!s || !/[0-9]/.test(s)) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
export function maskNonDataNumerics(text='') {
  // Les millésimes réglementaires et versions logicielles sont des identifiants, jamais des valeurs métier.
  // Ex. RE2020 / RE 2020 / RT2012 / RT 2012 ne doivent pas devenir 2020 / 2012 dans un champ IC/Cep.
  return String(text)
    .replace(/\b(?:RE|RT)\s*[-_ ]?\s*(?:2012|2020)\b/gi,m=>m.replace(/\d/g,'x'))
    .replace(/\bIC\s*(?:energie|énergie|construction)\s*(?:2025|2028|2031)\b/gi,m=>m.replace(/\d/g,'x'))
    .replace(/\b(?:version|v)\.?\s*\d+(?:[.,]\d+){1,5}\b/gi,m=>m.replace(/\d/g,'x'));
}
export function numbersIn(text='') {
  // Ne jamais fusionner une suite de colonnes comme « 505 212 162 116 ».
  // On recolle uniquement les séparateurs de milliers non ambigus (ex. « 1 663,5 »).
  let s=maskNonDataNumerics(text).replace(/(?<![\d,.])(\d{1,2})[ \u00a0](\d{3})(?=[,.]\d+)/g,'$1$2');
  const out=[];
  // Interdit également de démarrer au milieu d'un identifiant alphanumérique (RE2020, BAT001, etc.).
  const re=/(?<![A-Za-z0-9])[-+]?\d+(?:[,.]\d+)?(?![A-Za-z0-9])/g;
  for (const m of s.matchAll(re)) { const n=parseFrNumber(m[0]); if(n!==null) out.push(n); }
  return out;
}
export function clamp(v,min=0,max=1){ return Math.max(min,Math.min(max,v)); }
export function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
export function uid(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
export function excerpt(text, needle='', radius=120){
  const s=String(text||'').replace(/\s+/g,' ').trim(); if(!s) return '';
  const i=needle ? normLower(s).indexOf(normLower(needle)) : -1;
  if(i<0) return s.slice(0, radius*2);
  return `${i>radius?'…':''}${s.slice(Math.max(0,i-radius),Math.min(s.length,i+needle.length+radius))}${i+needle.length+radius<s.length?'…':''}`;
}
export function unique(arr){ return [...new Set(arr.filter(v=>v!==null&&v!==undefined&&v!==''))]; }
export function downloadBlob(blob, name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000); }
export function tokenize(s=''){ return normLower(s).split(/[^a-z0-9]+/).filter(x=>x.length>1); }
export function scoreTokens(query,text){ const q=tokenize(query), t=normLower(text); if(!q.length) return 0; return q.reduce((a,w)=>a+(t.includes(w)?1:0),0)/q.length; }
export function findFirstMatch(text, pairs){ for(const [label,re] of pairs){ if(re.test(normalizeText(text))) return label; } return null; }
export function formatValue(v){ if(v===null||v===undefined||v==='') return 'non précisé'; if(typeof v==='number') return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(v); return String(v); }
