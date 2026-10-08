// v2.3.14 — « Étude d'impact réglementaire sur le changement climatique — Bilan carbone RE2020 » (récapitulatif carbone
// de bureau d'études, ex. BE ACT « Récap Carbone ») :
//  • page « Conformité RE 2020 » : « Ic.energie 73,43 kgeqCO2/m²Sref Ic.energiemax= 533,67 … »,
//    « Ic.construction 594,21 … Ic.constructionmax= 743,89 … », « Ic.construction2028= 619,15 » ;
//  • graphique par lot : valeurs accolées par l'export PDF (« 27,06 47,28 84,24 5,5840,27 … 29,4414,54 ») sur l'axe
//    « Lot 1 … Lot 13 Ic Chantier » → 13 lots + Ic chantier, contrôlés : Σ lots + chantier = Ic construction ;
//  • page « Résultats complémentaires » : Ic.chantier, stock de carbone biogénique (StockC) ;
//  • hypothèses : surface de référence.
// Les pages suivantes (préconisations FDES lot par lot) ne décrivent pas le projet : elles ne sont pas lues.
import {normalizeText,parseFrNumber} from './utils.js';

const rk_lt=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim();
export function isRecapCarboneRe2020(doc){
  const t=String(doc?.read?.text||'').slice(0,200000);
  return /Ic\.?\s*energie\s+[\d\s,.]+\s*kgeqCO2\/m.?\s*Sref\s+Ic\.?\s*energie\s*max\s*=/i.test(t)&&/Ic\.?\s*construction\s+[\d\s,.]+\s*kgeqCO2/i.test(t);
}
function rk_lines(doc){ const out=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>out.push({page,line,t:rk_lt(line)})); return out; }
export function recapCarboneBuildingName(doc){
  const t=normalizeText(String(doc?.read?.text||'').slice(0,20000));
  const m=t.match(/(?:etude\s+realisee\s+pour\s+le|pour\s+le)\s+batiment\s+([A-Z0-9]{1,4})\b/i)||normalizeText(String(doc?.name||'')).match(/\bBat(?:iment)?\.?[\s_]*([A-Z0-9]{1,3})\b/i);
  return m?`Batiment ${m[1].toUpperCase()}`:'Bâtiment unique';
}
const rk_num=s=>{ const v=parseFrNumber(String(s||'').replace(/\s+/g,'')); return Number.isFinite(v)?v:null; };

export function parseRecapCarboneRe2020(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=rk_lines(doc); const B=canonical(recapCarboneBuildingName(doc)); const origin='Récapitulatif carbone RE2020 (bureau d’études)';
  const emit=(x,field,value,method,conf,unit='kgCO2e/m²',extra={})=>{ if(!x||value===null||value===undefined) return; const o=occ(doc,x.page,x.line,field,value,`recap-carbone:${method}`,conf,unit,{building:B,structuredPdf:true,origin,dedicatedRank:6,...extra}); if(o) out.push(o); };
  const NUM='(\\d{1,4}(?:\\s\\d{3})*(?:[.,]\\d+)?)';
  let ice=null, icc=null, site=null;
  for(const x of lines){ let m;
    if(!ice&&(m=x.t.match(new RegExp(`^Ic\\.?\\s*energie\\s+${NUM}\\s*kgeqCO2.*?Ic\\.?\\s*energie\\s*max\\s*=\\s*${NUM}`,'i')))){ ice={x,v:rk_num(m[1])}; emit(x,'ic_energy',ice.v,'ic-energie',0.97); emit(x,'ic_energy_max',rk_num(m[2]),'ic-energie-max',0.95); continue; }
    if(!icc&&(m=x.t.match(new RegExp(`^Ic\\.?\\s*construction\\s+${NUM}\\s*kgeqCO2.*?Ic\\.?\\s*construction\\s*max\\s*=\\s*${NUM}`,'i')))){ icc={x,v:rk_num(m[1])}; emit(x,'ic_construction',icc.v,'ic-construction',0.97); emit(x,'ic_construction_max',rk_num(m[2]),'ic-construction-max',0.95); continue; }
    if((m=x.t.match(new RegExp(`^Ic\\.?\\s*construction\\s*2028\\s*=\\s*${NUM}`,'i')))&&!out.some(o=>o.field==='ic_construction_max_2028')){ emit(x,'ic_construction_max_2028',rk_num(m[1]),'ic-construction-2028',0.95,'kgCO2e/m²',{provenanceNote:'Seuil Ic construction 2028 rappelé par le récapitulatif.'}); continue; }
    if((m=x.t.match(new RegExp(`^Ic\\.?\\s*energie\\s*2028\\s*=\\s*${NUM}`,'i')))&&!out.some(o=>o.field==='ic_energy_max_2028')){ emit(x,'ic_energy_max_2028',rk_num(m[1]),'ic-energie-2028',0.95); continue; }
    if(!site&&(m=x.t.match(new RegExp(`Ic\\.?\\s*chantier\\s+${NUM}\\s*kgeqCO2`,'i')))){ site={x,v:rk_num(m[1])}; emit(x,'ic_site',site.v,'ic-chantier',0.96); continue; }
  }
  // Stock de carbone biogénique : « Carbone biogenique stocke » / « 50,38 kgeqCO2 » / « (StockC) ».
  const st=lines.findIndex(x=>/^Carbone\s+biogenique\s+stocke$/i.test(x.t));
  if(st>=0){ const y=lines.slice(st,st+3).find(z=>/^\d+(?:[.,]\d+)?\s*kgeqCO2/i.test(z.t)); if(y) emit(y,'stock_c_per_m2',rk_num(y.t.match(/^(\d+(?:[.,]\d+)?)/)[1]),'stock-c',0.92,'kg/m²',{provenanceNote:'Carbone biogénique stocké (StockC) du récapitulatif.'}); }
  // Graphique par lot : ligne de valeurs accolées juste avant l'axe « Lot 1 Lot 2 … Ic Chantier ».
  const axis=lines.findIndex(x=>/^Lot\s+1\s+Lot\s+2\s+Lot\s+3\b.*Lot\s+13\b/i.test(x.t));
  if(axis>=0){
    const cand=lines.slice(Math.max(0,axis-3),axis).reverse().find(x=>((x.t.match(/\d{1,4},\d{2}/g)||[]).length>=13));
    if(cand){
      const vals=(cand.t.match(/\d{1,4},\d{2}/g)||[]).map(rk_num); const withSite=/Ic\s+Chantier/i.test(lines[axis].t);
      const lots=vals.slice(0,13); const chartSite=withSite&&vals.length>=14?vals[13]:null;
      const sumLots=Math.round(lots.reduce((a,v)=>a+v,0)*100)/100;
      const siteV=site?.v??chartSite;
      const ok=lots.length===13&&icc&&siteV!==null&&Math.abs(sumLots+siteV-icc.v)<=Math.max(1,icc.v*0.01);
      lots.forEach((v,k)=>emit(cand,`ic_lot_${k+1}`,v,'lot',ok?0.95:0.84,'kgCO2e/m²',ok?{provenanceNote:`Graphique « Détails d’impact carbone par lot » (Σ lots ${sumLots} + chantier ${siteV} = Ic construction ${icc.v}).`}:{reviewCap:0.84,provenanceNote:'Graphique par lot : somme non vérifiée, à contrôler.'}));
      if(ok){ emit(cand,'ic_components',sumLots,'ic-composants',0.94,'kgCO2e/m²',{provenanceNote:`Σ des lots 1 à 13 = Ic construction (${icc.v}) − Ic chantier (${siteV}).`}); if(!site&&chartSite!==null) emit(cand,'ic_site',chartSite,'ic-chantier-graphique',0.9); }
    }
  }
  // Surface de référence (tableau « Caractéristiques du chantier » : première surface).
  const hyp=lines.findIndex(x=>/^Caracteristiques\s+du\s+chantier/i.test(x.t)||/Surface\s+de\s+Reference/i.test(x.t)||/^Reference\s+theoriques/i.test(x.t));
  if(hyp>=0){ const y=lines.slice(hyp,hyp+8).find(z=>/^\d{1,3}(?:\s\d{3})*(?:,\d+)?\s*m²\s+\d/.test(z.t)); if(y&&lines.slice(Math.max(0,hyp-2),hyp+8).some(z=>/Surface\s+de|Reference/i.test(z.t))){ const v=rk_num(y.t.match(/^(\d{1,3}(?:\s\d{3})*(?:,\d+)?)/)[1]); if(v>8) emit(y,'shab',v,'sref',0.88,'m²',{provenanceNote:'Surface de référence (hypothèses du projet).'}); } }
  return out;
}
