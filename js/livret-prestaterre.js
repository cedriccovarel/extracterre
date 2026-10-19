// v2.4.0 — Livret d'opération Prestaterre Certifications (page de garde) : données administratives et programme.
//  « N° DE CONTRAT / OPERATION : 00003973 / OPE-003449 », « NOM DE L'OPERATION : … », « MAITRE D'OUVRAGE : … »,
//  « OUVRAGE : Logement collectif : 50 logement(s) - 1 batiment(s) », « REFERENTIEL : BEE Logement Renovation – Version du
//  06/03/2023 », « MENTION(S) : Label BBC Effinergie Renovation (…) », « PROFIL SPECIFIQUE : Aucun ».
// Les remarques d'évaluation des pages suivantes (« Il est prévu au CCTP… ») ne décrivent pas le projet : elles ne sont pas lues.
import {normalizeText} from './utils.js';

const lv_t=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim();
export function isPrestaterreBooklet(doc){
  const p1=(doc?.read?.pages?.[0]?.lines||[]).map(lv_t).join('\n');
  return /LIVRET\s+D.OPERATION/i.test(p1)&&/Prestaterre/i.test(p1)&&/N°\s+DE\s+CONTRAT/i.test(p1);
}
export function parsePrestaterreBooklet(doc,occ){
  const out=[]; const page=doc.read.pages[0]; const L=(page.lines||[]).map(line=>({line,t:lv_t(line)})); const B='Bâtiment unique'; const origin='Livret d’opération Prestaterre';
  const emit=(x,field,value,method,conf=0.95,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,page,x.line,field,value,`livret:${method}`,conf,unit,{building:B,structuredPdf:true,origin,dedicatedRank:3,...extra}); if(o) out.push(o); };
  const val=re=>{ const x=L.find(z=>re.test(z.t)); return x?{x,v:x.t.replace(re,'').replace(/^\s*:\s*/,'').trim()}:null; };
  let z;
  if((z=val(/^N°\s+DE\s+CONTRAT\s*\/\s*OPERATION\b/i))){ const [c,o]=z.v.split(/\s*\/\s*/); if(c) emit(z.x,'contract_number',c,'contrat'); if(o) emit(z.x,'internal_code',o,'operation'); }
  if((z=val(/^NOM\s+DE\s+L.OPERATION\b/i))) emit(z.x,'operation_name',z.v,'nom');
  if((z=val(/^MAITRE\s+D.OUVRAGE\b/i))) emit(z.x,'owner_company',z.v,'moa');
  if((z=val(/^ADRESSE\s+DE\s+L.OPERATION\b/i))){ const i=L.indexOf(L.find(y=>y===z.x)); const cpL=[z.x,L[i+1]].find(y=>/\b\d{5}\b/.test(y?.t||'')); if(cpL){ const cp=cpL.t.match(/\b(\d{5})\b/)[1]; emit(cpL,'department',/^97/.test(cp)?cp.slice(0,3):/^20/.test(cp)?(Number(cp)<20200?'2A':'2B'):cp.slice(0,2),'departement',0.93,'',{provenanceNote:`Code postal de l’opération : ${cp}.`}); } }
  if((z=val(/^OUVRAGE\b/i))){ const m=z.v.match(/^(.+?)\s*:\s*(\d+)\s*logement\(?s?\)?\s*-\s*(\d+)\s*batiment/i);
    if(m){ const kind=m[1].trim(), n=Number(m[2]), b=Number(m[3]); emit(z.x,'work_type',kind,'ouvrage'); emit(z.x,'housing_total',n,'logements'); emit(z.x,'building_total',b,'batiments'); emit(z.x,'housing_count',n,'logements',0.9);
      const pre=/collectif/i.test(kind)?'housing_collective':/group/i.test(kind)?'housing_grouped':null; if(pre){ emit(z.x,`${pre}_units`,n,'logements-type'); emit(z.x,`${pre}_buildings`,b,'batiments-type'); }
      else if(/individuel|diffus|maison/i.test(kind)) emit(z.x,'housing_individual_scattered',n,'logements-type'); } }
  if((z=val(/^REFERENTIEL\b/i))){ const m=z.v.match(/^(.+?)\s*[–-]\s*Version\s+du\s+(.+)$/i); emit(z.x,'reference_name',(m?m[1]:z.v).trim(),'referentiel'); if(m) emit(z.x,'reference_version',m[2].trim(),'version'); if(/renovation/i.test(z.v)) emit(z.x,'renovation','Oui','renovation'); }
  if((z=val(/^MENTION(?:\(S\)|S)?\s*(?=:)/i))){ emit(z.x,'mentions',z.v,'mentions'); if(/effinergie/i.test(z.v)) emit(z.x,'mention_effinergie','Oui','effinergie'); if(/bbca/i.test(z.v)) emit(z.x,'mention_bbca','Oui','bbca'); if(/biosourc/i.test(z.v)) emit(z.x,'mention_biosourced_building','Oui','biosource'); }
  if((z=val(/^PROFIL\s+SPECIFIQUE\b/i))) emit(z.x,'specific_profile',z.v,'profil');
  if((z=val(/^PERFORMANCE\b/i))) emit(z.x,'performance',z.v,'performance');
  return out;
}
