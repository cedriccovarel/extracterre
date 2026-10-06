// v2.3.6 — Notice carbone RE2020 de bureau d'études (ex. « Analyse du cycle de vie », éventuellement BBCA) :
// une section « N EVALUATION DU BILAN CARBONE – BATIMENT X (CAGE n) » par bâtiment avec
//  • le tableau « Evaluation projet / Seuils RE2020 » (Ic construction et Ic énergie + seuils),
//  • la calculette par lot (« 1.VRD … », « 2.1. Fondations … », « Ic Composants = »,  « Ic Chantier = »),
//  • les postes Ic énergie (« Chauffage 114 », « ECS 65 »…), et la ligne « Ic-Energie 214 ».
// Les seuils sont rangés dans « Max 2028 » quand la notice déclare viser le seuil 2028, sinon dans « Max ».
import {normalizeText,parseFrNumber} from './utils.js';

const nc_lineText=l=>normalizeText(l?.text||'');
const nc_num=s=>{ const m=String(s||'').match(/[-+]?\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|[-+]?\d+(?:[.,]\d+)?/); return m?parseFrNumber(m[0].replace(/[  ]/g,'')):null; };

export function isCarbonNoticeRe2020(doc){
  const t=String(doc?.read?.text||'').slice(0,800000);
  return /evaluation\s+du\s+bilan\s+carbone\s*[–-]\s*batiment/i.test(t)&&/ic\s*-?\s*construction/i.test(t);
}

function nc_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:nc_lineText(line)}));
  return out;
}
const nc_cleanName=s=>String(s||'').replace(/\(\s*cage\s*\d+\s*\)/i,'').replace(/\s+/g,' ').trim();

export function carbonNoticeSections(doc){
  const lines=nc_allLines(doc); const secs=[];
  lines.forEach((x,i)=>{
    const m=x.t.match(/^\d+\s+EVALUATION\s+DU\s+BILAN\s+CARBONE\s*[–-]\s*BATIMENT\s*(.*)$/i); if(!m||/\.{4,}/.test(x.t)) return;
    let name=m[1].trim(); if(!name||name.length<3) name=lines[i+1]?.t||'';
    name=nc_cleanName(name); if(name) secs.push({index:i,name:`Batiment ${name}`});
  });
  return {lines,secs};
}
export function carbonNoticeBuildingNames(doc){ return [...new Set(carbonNoticeSections(doc).secs.map(s=>s.name))]; }

export function parseCarbonNoticeRe2020(doc,occ,canonical=(s)=>s){
  const out=[]; const {lines,secs}=carbonNoticeSections(doc);
  const target2028=lines.some(x=>/seuils?\s+2028/i.test(x.t));
  const origin='Notice carbone RE2020 (bureau d’études)';
  const emit=(x,b,field,value,method,conf,unit='kgCO2e/m²',extra={})=>{ if(!x||value===null||value===undefined) return; const o=occ(doc,x.page,x.line,field,value,`notice-carbone:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,...extra}); if(o) out.push(o); };
  secs.forEach((sec,k)=>{
    const block=lines.slice(sec.index,k+1<secs.length?secs[k+1].index:lines.length); const b=sec.name;
    const find=re=>block.find(l=>re.test(l.t));
    // Tableau de synthèse : « max 519 565 -8% » (construction) puis « 214 284 -25% » (énergie).
    const consIdx=block.findIndex(l=>/^Seuil\s+IC\s+Construction/i.test(l.t)); const eneIdx=block.findIndex(l=>/^Seuil\s+IC\s+Energie/i.test(l.t));
    const triple=(from,to)=>{ for(const l of block.slice(Math.max(0,from),Math.max(from+1,to))){ const m=l.t.match(/(?:^|max\s+)([\d ,.]+?)\s+([\d ,.]+?)\s+[-+]?\d+\s*%/i); if(m) return {l,v:nc_num(m[1]),max:nc_num(m[2])}; } return null; };
    const cons=consIdx>=0?triple(consIdx,consIdx+4):null, ene=eneIdx>=0?triple(eneIdx,eneIdx+4):null;
    const maxField=target2028?'_max_2028':'_max';
    const note=target2028?'Seuil indiqué par la notice, qui vise la RE2020 seuil 2028.':'Seuil indiqué par la notice (période non précisée).';
    if(cons){ emit(cons.l,b,'ic_construction',cons.v,'synthese-ic-construction',0.97); emit(cons.l,b,`ic_construction${maxField}`,cons.max,'seuil-ic-construction',target2028?0.95:0.88,'kgCO2e/m²',{provenanceNote:note}); }
    if(ene){ emit(ene.l,b,'ic_energy',ene.v,'synthese-ic-energie',0.97); emit(ene.l,b,`ic_energy${maxField}`,ene.max,'seuil-ic-energie',target2028?0.95:0.88,'kgCO2e/m²',{provenanceNote:note}); }
    // Calculette : Ic composants / chantier / construction et lots.
    const eq=(re)=>{ const l=find(re); return l?{l,v:nc_num(l.t.replace(re,''))}:null; };
    const comp=eq(/^Ic\s+Composants\s*=\s*/i), site=eq(/^Ic\s+Chantier\s*=\s*/i), ic=eq(/^Ic\s+Construction\s*=\s*/i);
    if(comp) emit(comp.l,b,'ic_components',comp.v,'ic-composants',0.97);
    if(site) emit(site.l,b,'ic_site',site.v,'ic-chantier',0.97);
    if(ic&&!cons) emit(ic.l,b,'ic_construction',ic.v,'ic-construction',0.97);
    const lots={}; let firstLotLine=null;
    for(const l of block){ const m=l.t.match(/^(\d{1,2})\.(?:(\d)\.?)?\s*[A-Za-z].*?\s([-+]?\d+(?:[.,]\d+)?)$/); if(!m) continue; const lot=Number(m[1]); if(lot<1||lot>13) continue; const v=parseFrNumber(m[3]); if(v===null) continue; lots[lot]=(lots[lot]||0)+v; firstLotLine=firstLotLine||l; if(lot===13) break; }
    const lotSum=Object.values(lots).reduce((a,v)=>a+v,0);
    const lotsOk=comp&&Object.keys(lots).length>=10&&Math.abs(lotSum-comp.v)<=Math.max(2,comp.v*0.02);
    for(const [lot,v] of Object.entries(lots)) emit(firstLotLine,b,`ic_lot_${lot}`,Math.round(v*100)/100,'calculette-lot',lotsOk?0.95:0.86,'kgCO2e/m²',{provenanceNote:lotsOk?'Calculette par lot (Σ lots = Ic composants).':'Calculette par lot : somme non vérifiée.'});
    // Postes Ic énergie (calculette « Exploitation maîtrisée »).
    const posts=[[/^Chauffage\s+/i,'ic_energy_heating'],[/^Refroidissement\s+/i,'ic_energy_cooling'],[/^ECS\s+/i,'ic_energy_ecs'],[/^Auxiliaires\s+de\s+distribution\s+/i,'ic_energy_aux_dist'],[/^Auxiliaires\s+de\s+ventilation\s+/i,'ic_energy_aux_vent'],[/^Deplacements?\s+des\s+occupants/i,'ic_energy_mobility']];
    const expl=block.findIndex(l=>/Exploitation\s+Maitrisee/i.test(l.t));
    if(expl>=0) for(const [re,field] of posts){ const l=block.slice(expl).find(x=>re.test(x.t)&&/\s[-+]?\d+(?:[.,]\d+)?$/.test(x.t)); if(l) emit(l,b,field,nc_num(l.t.match(/([-+]?\d+(?:[.,]\d+)?)$/)[1]),'calculette-poste',0.93); }
  });
  // Mention BBCA visée.
  const bbca=lines.find(x=>/labelisation\s+(?:du\s+projet\s+)?BBCA|label\s+BBCA/i.test(x.t));
  if(bbca){ const o=occ(doc,bbca.page,bbca.line,'mention_bbca','Oui','notice-carbone:bbca',0.9,'',{building:'Bâtiment unique',origin,provenanceNote:'Labellisation BBCA visée par la notice carbone.'}); if(o) out.push(o); }
  return out;
}
