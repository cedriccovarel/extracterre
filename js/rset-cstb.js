// v2.3.5 — « Récapitulatif Standardisé Energie Environnement » (fiche RSET / RSEE au format CSTB,
// imprimée depuis fiche.html : Pléiades, ClimaWin, Perrenoud…). Deux parties possibles :
//  • « Partie Etude Thermique » : par bâtiment (« Bâtiment : X » puis titre « "X" ») — SRef, logements,
//    Bbio / Bbiomax / gain, Cep / Cepmax / Cep,nr / Cep,nrmax / gains, tableau DH par groupe ;
//  • « Partie Etude Environnementale » : « Indicateurs principaux, à l'échelle du bâtiment N » —
//    Ic construction (+ max), Ic énergie (+ max), Ic composant, Ic chantier, stockage carbone.
// Le texte peut provenir d'un OCR (polices sans table Unicode) : chaque couple valeur / max est
// contrôlé (valeur ≤ max) et, à défaut, la valeur part en « À vérifier ».
import {normalizeText,parseFrNumber} from './utils.js';

// Milliers séparés par une espace seulement s'ils portent une décimale (« 2 190,5 ») : dans les tableaux,
// « 631 242 178 » est une suite de trois nombres, pas un seul.
const cs_NUM_RE=/[-+]?\d{1,3}(?:[ \u00a0]\d{3})+[.,]\d+|[-+]?\d+(?:[.,]\d+)?/g;
const cs_numbers=s=>(String(s||'').match(cs_NUM_RE)||[]).map(x=>parseFrNumber(x.replace(/[ \u00a0]/g,''))).filter(v=>v!==null);
const cs_lineText=l=>normalizeText(l?.text||'');

export function isCstbRseeFiche(doc){
  const t=normalizeText(String(doc?.read?.text||'').slice(0,60000));
  return /recapitulatif\s+standardise\s+energie\s+environnement/i.test(t)&&/partie\s*[«"]?\s*etude\s+(?:thermique|environnementale)/i.test(t);
}

function cs_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:cs_lineText(line)}));
  return out;
}

// Contexte bâtiment ligne par ligne (marqueurs explicites du format CSTB uniquement).
export function cstbBuildingContext(doc){
  const lines=cs_allLines(doc); let current=null; let afterTech=false; let scope='building'; const names=[];
  const set=(raw)=>{ const n=String(raw||'').replace(/^["“”']+|["“”']+$/g,'').trim(); if(!n||n.length>60||/^bat\.\d/i.test(n)) return; current=n; if(!names.includes(n)) names.push(n); };
  for(const x of lines){
    let m;
    if((m=x.t.match(/pour\s+le\s+batiment\s*:\s*(.+?)\s+Conformite\b/i))) set(m[1]);
    else if((m=x.t.match(/^Batiment\s*:\s*(.+)$/i))) set(m[1]);
    else if(afterTech&&(m=x.t.match(/^["“](.+)["”]$/))) set(m[1]);
    else if((m=x.t.match(/Resultats\s+sorties\s+detaillees\s*-\s*\((.+)\)/i))) set(m[1]);
    else if((m=x.t.match(/^Nom\s+du\s+batiment\s+(.+)$/i))) set(m[1]);
    else if((m=x.t.match(/a\s+l'echelle\s+du\s+batiment\s+(\d+)\b/i))) set(`Batiment ${m[1]}`);
    afterTech=/^Donnees\s+techniques\s+du\s+batiment/i.test(x.t);
    if(/^Batiment\s*:|echelle\s+du\s+batiment|niveau\s+batiment\b/i.test(x.t)) scope='building';
    else if(/^Exigences?\s+de\s+moyens|^Chapitres\s+et\s+articles\b/i.test(x.t)) scope='requirements';
    else if(scope==='requirements'&&/^Chapitre\s+\d|^Donnees\s+techniques\s+du\s+batiment/i.test(x.t)) scope='building';
    else if(/^Generation\s*:\s*["“]|Fonctionnement\s+de\s+la\s+generation|Generation\s+commune\s+liee|^Reseaux?\s+de\s+distribution\s+intergroupe/i.test(x.t)) scope='generation';
    else if(/echelle\s+de\s+la\s+(?:zone|parcelle)|niveau\s+(?:zones?\s+de\s+batiment|parcelle)|^Chapitre\s+[67]\b/i.test(x.t)) scope='other';
    x.building=current; x.scope=scope;
  }
  return {lines,names};
}
export function cstbBuildingNames(doc){ return cstbBuildingContext(doc).names; }

export function parseCstbRseeFiche(doc,occ,canonical=(s)=>s){
  const out=[]; const {lines}=cstbBuildingContext(doc);
  const ocrDoc=(doc.read?.pages||[]).some(p=>p.textSource==='ocr'||p.textSource==='hybrid');
  const origin='RSET / RSEE — récapitulatif standardisé CSTB';
  const emit=(x,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const ocr=x.page.textSource==='ocr'||x.page.textSource==='hybrid'; const o=occ(doc,x.page,x.line,field,value,`cstb:${method}`,ocr?Math.min(conf,extra.ocrOk?0.93:0.86):conf,unit,{building:canonical(x.building||'Bâtiment unique'),structuredPdf:true,origin,...(ocr?{ocrDerived:true}:{}),...extra}); if(o) out.push(o); };
  const byBuilding=new Map(); for(const x of lines){ const k=x.building||''; if(!byBuilding.has(k)) byBuilding.set(k,[]); byBuilding.get(k).push(x); }

  // --- Thermique -----------------------------------------------------------------------------------
  for(const x of lines){
    let m;
    if(/^Coef\s*f?\s*i?\s*cient\s+Bbio\b/i.test(x.t)){ const n=cs_numbers(x.t.replace(/^.*?Bbio/i,'')); if(n.length>=2){ const ok=n[0]<=n[1]; emit(x,'bbio',n[0],'bbio',ok?0.995:0.8,'points',{ocrOk:ok}); emit(x,'bbio_max',n[1],'bbio-max',ok?0.995:0.8,'points',{ocrOk:ok}); if(n.length>=3) emit(x,'bbio_gain',n[2],'bbio-gain',0.99,'%',{ocrOk:ok}); } }
    if(/Cep\s*\/\s*Cepmax.{0,6}Cep\s*,?\s*nr\s*\/\s*Cep\s*,?\s*nrmax/i.test(x.t)){ const n=cs_numbers(x.t.replace(/^.*?nrmax/i,'')); if(n.length>=4){ const ok=n[0]<=n[1]&&n[2]<=n[3]&&n[2]<=n[0]; const c=ok?0.995:0.8; emit(x,'cep',n[0],'cep',c,'kWhEP/m².an',{ocrOk:ok}); emit(x,'cep_max',n[1],'cep-max',c,'kWhEP/m².an',{ocrOk:ok}); emit(x,'cepnr',n[2],'cepnr',c,'kWhEP/m².an',{ocrOk:ok}); emit(x,'cepnr_max',n[3],'cepnr-max',c,'kWhEP/m².an',{ocrOk:ok}); if(n.length>=6){ emit(x,'cep_gain',n[4],'cep-gain',0.99,'%',{ocrOk:ok}); emit(x,'cepnr_gain',n[5],'cepnr-gain',0.99,'%',{ocrOk:ok}); } } }
    if((m=x.t.match(/^SRef\s*\/\s*usage\s+principal\s+(.+?)\s*m2?\s*\//i))){ const n=cs_numbers(m[1]); if(n.length===1) emit(x,'shab',n[0],'sref-batiment',0.97,'m²',{provenanceNote:'SRef du bâtiment (données générales).'}); }
    if((m=x.t.match(/^Nombre\s+de\s+logements\s+(\d+)\s*$/i))) emit(x,'housing_count',Number(m[1]),'nombre-logements',0.97);
  }
  // Partie environnementale : « Nom du bâtiment X » → « Surface de Référence [m2] » (bâtiment) et
  // « Nombre de logement » (somme des zones du bâtiment).
  { const env=new Map();
    for(const x of lines){ if(!x.building) continue; const k=x.building; if(!env.has(k)) env.set(k,{sref:null,lgt:[],seen:false});
      const e=env.get(k); let m;
      if(/^Nom\s+du\s+batiment\b/i.test(x.t)) e.seen=true;
      if(!e.seen) continue;
      if(!e.sref&&(m=x.t.match(/^Surface\s+de\s+Reference\s*\[m[2²?]?\]\s+(.+)$/i))){ const n=cs_numbers(m[1]); if(n.length===1) e.sref={x,v:n[0]}; }
      if((m=x.t.match(/^Nombre\s+de\s+logement\s+(\d+)\s*$/i))) e.lgt.push({x,v:Number(m[1])});
      if(/^Chapitre\s+3\b/i.test(x.t)) e.seen=false; }
    for(const e of env.values()){
      if(e.sref&&!out.some(o=>o.field==='shab'&&o.building===canonical(e.sref.x.building))) { const plaus=e.sref.v>0&&e.sref.v<=50000; emit(e.sref.x,'shab',e.sref.v,'sref-rsenv',plaus?0.96:0.7,'m²',{ocrOk:plaus,provenanceNote:plaus?'Surface de référence du bâtiment (RSEnv).':'Surface de référence peu plausible (séparateur décimal perdu ?) : à vérifier.'}); }
      if(e.lgt.length&&!out.some(o=>o.field==='housing_count'&&o.building===canonical(e.lgt[0].x.building))) emit(e.lgt[0].x,'housing_count',e.lgt.reduce((a,l)=>a+l.v,0),'logements-rsenv',0.95,'',{ocrOk:true,provenanceNote:`Somme des logements de ${e.lgt.length} zone(s).`});
    } }
  // Tableau DH : lignes « Oui|Non SRef DH h1 h2 h3 Conforme » → groupe le plus défavorable du bâtiment.
  for(const [b,ls] of byBuilding){
    if(!b) continue; let worst=null;
    for(const x of ls){ const m=x.t.match(/(?:^|\s)(?:Oui|Non)\s+([\d ,.]+?)\s+(?:Non\s+)?Conforme\b/i); if(!m) continue; const n=cs_numbers(m[1]); if(n.length<5) continue; const dh=n[1]; if(!worst||dh>worst.dh) worst={x,dh}; }
    if(worst){ emit(worst.x,'dh',worst.dh,'dh-worst-group',0.98,'°C.h',{provenanceNote:'Groupe le plus défavorable du tableau DH.'});
      const lim=ls.find(x=>/Le\s+DH\s+max\s+est\s+de\s+\d+/i.test(x.t)); const v=lim?Number(lim.t.match(/DH\s+max\s+est\s+de\s+(\d+)/i)[1]):null;
      if(v) emit(lim,'dh_max',v,'dh-max-texte',0.86,'°C.h',{reviewCap:0.86,provenanceNote:'DH max rappelé dans le texte (catégorie de contrainte extérieure 1) : à confirmer pour le groupe le plus défavorable.'}); }
  }

  // --- Seuils par période (RSEnv 2024+) : « Icconstruction Icconstruction_max Icconstruction_max_2022 … _2031 »
  //     puis, sur la ligne suivante, les valeurs dans le même ordre (idem pour Icenergie).
  lines.forEach((x,i)=>{
    const head=x.t.match(/^(Ic\s*construction|Ic\s*energie)\s+(Ic\s*(?:construction|energie)_max(?:\s+Ic\s*(?:construction|energie)_max_\d{4})*)\s*$/i); if(!head) return;
    const kind=/construction/i.test(head[1])?'construction':'energy';
    const cols=[kind,...head[2].split(/\s+(?=Ic)/i).map(c=>{ const y=c.match(/_(\d{4})$/); return y?`max_${y[1]}`:'max'; })];
    const vx=lines[i+1]; if(!vx) return; const v=cs_numbers(vx.t); if(v.length!==cols.length) return;
    const base=kind==='construction'?'ic_construction':'ic_energy';
    cols.forEach((c,k)=>{
      const field=c===kind?base:c==='max'?`${base}_max`:c==='max_2028'?`${base}_max_2028`:null; if(!field) return;
      emit(vx,field,v[k],`seuils-${kind}`,0.99,'kgCO2e/m²',{ocrOk:true,provenanceNote:`Tableau « Respect des ${kind==='construction'?'Icconstruction':'Icenergie'}_max » (valeur, max, max 2022/2025/2028${kind==='construction'?'/2031':''}).`});
    });
  });

  // --- Environnement -------------------------------------------------------------------------------
  const unitTail=(t)=>{ const i=t.search(/\]|m[²2°?]\s*\]?|\/m\b/); return i>=0?t.slice(i):t; };
  for(const [b,ls] of byBuilding){
    ls.forEach((x,i)=>{
      const t=x.t; if(x.scope!=='building') return; if(/par\s+occupant|annualis|parcelle|_?DED\b/i.test(t)) return;
      const next=ls[i+1]?.t||'';
      const isCons=/contribution\s*construction|\bI\s*c\s*_?\s*construction\b/i.test(t)&&!/valeur\s+maximale|inferieure|egale/i.test(t);
      const isEne=/contribution\s*[eé]nergie|\bI\s*c\s*_?\s*[eé]nergie\b/i.test(t)&&!/valeur\s+maximale|inferieure|egale|annualis/i.test(t);
      if(!isCons&&!isEne) return;
      // Les valeurs suivent l'unité entre crochets ([kgéq. CO2/m²]) ; sinon elles sont sur la ligne suivante.
      const afterUnit=(s)=>{ const k=s.indexOf(']'); return k>=0?cs_numbers(s.slice(k+1)):[]; };
      let src=x, n=afterUnit(t.replace(/CO\s*[2z₂]/gi,'CO'));
      if(!n.length&&/\[/.test(next)){ src=ls[i+1]; n=afterUnit(next.replace(/CO\s*[2z₂]/gi,'CO')); }
      if(!n.length) return;
      // « … [kgeq.CO2/m²] 532,36 max » : le max est le premier nombre de la ligne suivante.
      if(n.length===1&&/\bmax\s*$/i.test(src.t)){ const nx=ls[ls.indexOf(src)+1]; const m2=nx?cs_numbers(nx.t):[]; if(m2.length===1) n=[n[0],m2[0]]; }
      const v=n[0], mx=n.length>=2?n[1]:null, ok=(mx===null||v<=mx)&&v>=5;
      const f=isCons?'ic_construction':'ic_energy'; const fm=isCons?'ic_construction_max':'ic_energy_max';
      if(out.some(o=>o.field===f&&o.building===canonical(b))) return;
      emit(src,f,v,isCons?'ic-construction':'ic-energie',ok?0.98:0.75,'kgCO2e/m²',{ocrOk:ok,provenanceNote:ok?'':'Valeur supérieure au max lu : lecture à vérifier.'});
      if(mx!==null) emit(src,fm,mx,isCons?'ic-construction-max':'ic-energie-max',ok?0.98:0.75,'kgCO2e/m²',{ocrOk:ok});
    });
    for(const x of ls){
      let m; if(x.scope!=='building') continue;
      if(/^Composant\s*-\s*\/?\s*I?c\s*_?\s*composant/i.test(x.t)){ const n=cs_numbers(unitTail(x.t).replace(/CO\s*[2z₂]/gi,'CO')); if(n.length) emit(x,'ic_components',n[0],'ic-composant',0.97,'kgCO2e/m²',{ocrOk:true}); }
      if(/^Chantier\s*-\s*\/?\s*I?c\s*_?\s*chantier/i.test(x.t)){ const n=cs_numbers(unitTail(x.t).replace(/CO\s*[2z₂]/gi,'CO')); if(n.length) emit(x,'ic_site',n[0],'ic-chantier',0.97,'kgCO2e/m²',{ocrOk:true}); }
      if((m=x.t.match(/^Indicateur\s+de\s+stockage\s+Carbone\s*\[[^\]]*\]\s*([\d ,.]+)$/i))){ const n=cs_numbers(m[1]); if(n.length===1) emit(x,'stock_c_per_m2',n[0],'stockage-carbone',0.93,'kgC/m²',{ocrOk:true,provenanceNote:'Indicateur de stockage carbone du bâtiment (kgC/m²).'}); }
    }
  }
  // Contrôle croisé : Ic construction = Ic composant + Ic chantier (à 1 % près) → lecture confirmée, même en OCR.
  const byB=new Map(); for(const o of out){ if(!byB.has(o.building)) byB.set(o.building,{}); byB.get(o.building)[o.field]=o; }
  for(const g of byB.values()){
    const c=g.ic_construction,k=g.ic_components,ch=g.ic_site; if(!c||!k||!ch) continue;
    if(Math.abs(c.value-(k.value+ch.value))<=Math.max(0.5,c.value*0.01)) for(const o of [c,k,ch,g.ic_construction_max].filter(Boolean)) if(o.confidence<0.97&&(o!==g.ic_construction_max||o.value>=c.value)){ o.confidence=0.97; o.provenanceNote=[o.provenanceNote,'Cohérence vérifiée : Ic construction = Ic composant + Ic chantier.'].filter(Boolean).join(' '); }
  }
  return out;
}

// v2.3.5 — Rapport de simulation thermique dynamique (STD, confort d'été) : ce n'est pas une étude
// réglementaire. Seules les dispositions de la variante de base sont lues ; les variantes étudiées
// (rafraîchissement adiabatique, détente directe, BSO sur toutes les façades…) ne sont jamais reprises.
export function isStdReport(doc){
  const t=normalizeText(String(doc?.read?.text||'').slice(0,30000));
  return /simulation\s+thermique\s+dynamique|rapport\s+de\s+simulation\s+dynamique/i.test(t)&&/confort\s+d'ete|inconfort/i.test(t);
}
export function parseStdReport(doc,occ){
  const out=[]; const lines=cs_allLines(doc);
  const origin='Simulation thermique dynamique (confort d’été) — variante de base';
  const emit=(x,field,value,method,conf,note)=>{ const o=occ(doc,x.page,x.line,field,value,`std:${method}`,conf,'',{structuredPdf:true,origin,provenanceNote:note}); if(o) out.push(o); };
  const variantsAt=lines.findIndex(x=>/variantes?\s+etudiees/i.test(x.t)&&!/\.{4,}/.test(x.t));
  const base=variantsAt>=0?lines.slice(0,variantsAt):lines;
  const v0=variantsAt>=0?(()=>{ const i=lines.findIndex((x,k)=>k>variantsAt&&/V0\s*:\s*variante\s+de\s+base/i.test(x.t)); if(i<0) return []; const j=lines.findIndex((x,k)=>k>i&&/^\d+(?:\.\d+)+\s+V\d\s*:/i.test(x.t)); return lines.slice(i,j>0?j:i+40); })():[];
  const noCool=lines.find(x=>/pas\s+envisage\s+de\s+rafraichir|sans\s+(?:systeme\s+de\s+)?rafraichissement\s+actif/i.test(x.t));
  const noCoolNext=noCool?null:lines.find((x,i)=>/n'est\s+pas\s+envisage\s+de$/i.test(x.t)&&/rafraichi/i.test(lines[i+1]?.t||''));
  if(noCool||noCoolNext) emit(noCool||noCoolNext,'cooling','Aucun','no-active-cooling',0.9,'La STD indique qu’aucun rafraîchissement actif n’est envisagé (variantes de rafraîchissement non retenues).');
  const bso=v0.find(x=>/brise\s*-?\s*soleil\s+orientable|\bBSO\b/i.test(x.t))||base.find(x=>/protections?\s+solaires?\s+mobiles?/i.test(x.t));
  if(bso) emit(bso,'window_shading','BSO','base-variant-shading',0.88,'Protections solaires de la variante de base de la STD.');
  const triple=base.find(x=>/triples?\s+vitrages?/i.test(x.t));
  if(triple) emit(triple,'window_glazing','Triple vitrage','glazing-hypothesis',0.86,'Hypothèse de vitrage de la STD (à confirmer par la notice thermique).');
  const cta=base.find(x=>/\bCTA\b/.test(x.t));
  if(cta) emit(cta,'ventilation','CTA','ventilation-hypothesis',0.85,'Ventilation mécanique par CTA citée dans les hypothèses de la STD.');
  return out;
}
