// v2.4.0 — DPE 2021 (méthode 3CL-DPE2021, tous logiciels : DPEWIN, ClimaWin…) et récapitulatifs de DPE par logement.
// Les étiquettes du DPE sont des images : les classes sont recalculées depuis les valeurs imprimées (énergie primaire totale
// et émissions annuelles rapportées à la surface), avec les seuils réglementaires du DPE 2021 (métropole) ; l'étiquette
// énergie est la plus défavorable des deux classes (« double seuil »).
// Phase : un DPE décrit l'état au jour de la visite (avant travaux) ; une « annexe DPE » d'étude de rénovation, un DPE
// « projeté » ou « après travaux » décrit l'état projeté.
// Les recommandations de travaux (packs) et la liste des solutions ENR ne décrivent pas le logement : elles ne sont pas lues.
import {normalizeText,parseFrNumber} from './utils.js';

const dp_t=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim();
function dp_lines(doc){ const out=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>out.push({page,line,t:dp_t(line)})); return out; }
const dp_n=s=>parseFrNumber(String(s||'').replace(/\s+/g,''));
const EP=[[70,'A'],[110,'B'],[180,'C'],[250,'D'],[330,'E'],[420,'F']], GES=[[6,'A'],[11,'B'],[30,'C'],[50,'D'],[70,'E'],[100,'F']];
const cls=(v,T)=>T.find(([s])=>v<=s)?.[1]||'G';
const worst=(a,b)=>a>b?a:b;
export function dpeClasses(cep,ges){ const e=cls(cep,EP), g=cls(ges,GES); return {energy:worst(e,g),ges:g,energyOnly:e}; }

export function isDpe2021(doc){
  const t=String(doc?.read?.text||'').slice(0,200000);
  return /diagnostic\s+de\s+performance\s+n°/i.test(t)&&/DPE\s+(?:energetique|diagnostic|\/\s*ANNEXES)/i.test(t)&&/energie\s+totale\s+pour/i.test(t);
}
export function isDpeRecapTable(doc){
  const t=String(doc?.read?.text||'').slice(0,40000);
  return /Cep\s+init\b/i.test(t)&&/Cep\s+reno\b/i.test(t)&&/Etiquette/i.test(t)&&/\bLgt\.?\s*\w+/i.test(t);
}
const DP_V=s=>/gaz/i.test(s)?'Gaz':/electri/i.test(s)?'Électricité':/fioul/i.test(s)?'Fioul':/bois|granul/i.test(s)?'Bois / biomasse':/reseau|chaleur\s+urbain/i.test(s)?'Réseau de chaleur urbain':null;
function dp_split(L){ const st=[]; L.forEach((x,i)=>{ if(/^diagnostic\s+de\s+performance\s+n°/i.test(x.t)) st.push(i); }); return st.map((a,k)=>({a,b:k+1<st.length?st[k+1]:L.length})); }
export function dpeBuildingName(seg){
  const mis=seg.find(x=>/^mission\s*:/i.test(x.t)); const m=mis?.t.match(/(?:Maison|Logement|Appartement|Lgt\.?)\s*n?°?\s*(\w+)/i); return m?`Logement ${m[1]}`:null;
}

export function dpe2021BuildingNames(doc){
  const L=dp_lines(doc); const segs=dp_split(L); const S=segs.map(sg=>L.slice(sg.a,sg.b));
  if(S.some(z=>/immeuble|batiment\s+collectif/i.test(z.find(x=>/^type\s+de\s+bien\s*:/i.test(x.t))?.t||''))) return ['Bâtiment unique'];
  const n=[...new Set(S.map(dpeBuildingName).filter(Boolean))]; return n.length?n:['Bâtiment unique'];
}
export function dpeRecapBuildingNames(doc){ return [...new Set(dp_lines(doc).map(x=>(x.t.match(/^Lgt\.?\s*([A-Z]?\s*\d+|[A-Z])\b.*\bT\d\s+\d/)||[])[1]).filter(Boolean).map(k=>`Logement ${k.replace(/\s+/g,' ')}`))]; }
export function parseDpe2021(doc,occ,canonical=(s)=>s){
  const out=[]; const L=dp_lines(doc); const origin='DPE 2021 (3CL)';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`dpe-3cl:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,dedicatedRank:7,...extra}); if(o) out.push(o); };
  const segs=dp_split(L); if(!segs.length) return out;
  const cover=L.slice(0,segs[0].a).map(x=>x.t).join(' ');
  const after=/annexe\s+dpe|dpe\s+projete|apres\s+travaux|etat\s+(?:futur|projete)|conversion/i.test(cover)||/DPE\s+projete|apres\s+travaux/i.test(L.slice(segs[0].a,segs[0].a+12).map(x=>x.t).join(' '));
  const inferred=after&&!/DPE\s+projete|apres\s+travaux/i.test(L.slice(segs[0].a,segs[0].a+12).map(x=>x.t).join(' '));
  const parsed=segs.map(sg=>{ const S=L.slice(sg.a,sg.b); const f=re=>S.find(x=>re.test(x.t));
    const type=(f(/^type\s+de\s+bien\s*:/i)?.t.replace(/^.*?:\s*/,'')||'').trim();
    const sx=f(/^surface\s*(?:habitable|de\s*reference)\s*:/i); const surf=sx?dp_n((sx.t.match(/:\s*([\d\s.,]+)\s*m/i)||[])[1]):null;
    const ex=S.find(x=>/^energie\s+totale\s+pour(?:\s+les)?\s+\d/i.test(x.t)); const ep=ex?dp_n(ex.t.match(/pour(?:\s+les)?\s+([\d\s]+)\s*kWh/i)?.[1]):null;
    const gx=f(/emet\s*[\d\s]+\s*kg\s+de\s+CO/i); const kg=gx?dp_n(gx.t.match(/emet\s*([\d\s]+?)\s*kg/i)[1]):null;
    // Tableau « Montants et consommations annuels » : seules ses lignes chiffrées décrivent les énergies du logement
    // (les pages suivantes listent des solutions ENR — « chauffage au bois » — qui ne sont pas en place).
    const m0=S.findIndex(x=>/Montants\s+et\s+consommations\s+annuels/i.test(x.t)); const C=m0>=0?S.slice(m0,m0+30):[];
    const use=re=>{ const k=C.findIndex(x=>re.test(x.t)&&/\d/.test(x.t+' '+(C[C.indexOf(x)+1]?.t||''))); if(k<0) return null; const S=C; const own=S[k].t; const v=DP_V(own.replace(re,''))||DP_V(S[k+1]?.t||''); return v?{x:S[k],v}:null; };
    const heat=use(/^chauffage\s+(?=\S)/i), ecs=use(/^(?:ECS|eau\s+chaude)\b\s*/i);
    const yr=f(/^annee\s+de\s+construction\s*:/i);
    const eq=k=>{ const i=S.findIndex(x=>/Vue\s+d.ensemble\s+des\s+equipements/i.test(x.t)); return i<0?'':S.slice(i,i+14).map(x=>x.t).join(' '); };
    return {S,type,surf,sx,ep,ex,kg,gx,heat,ecs,yr,eqt:eq(),name:dpeBuildingName(S)}; });
  // Un DPE « Immeuble » (bâtiment collectif) fait foi ; sinon chaque DPE de logement est rattaché à son logement.
  const coll=parsed.filter(p=>/immeuble|batiment\s+collectif/i.test(p.type));
  const use=coll.length?coll.slice(0,1).map(p=>({...p,B:'Bâtiment unique'})):parsed.map(p=>({...p,B:parsed.length===1&&!p.name?'Bâtiment unique':(p.name||'Bâtiment unique')}));
  const P=after?'after':'before';
  const note=(p,extra='')=>({provenanceNote:`DPE ${after?'de l’état projeté':'de l’état existant'}${inferred?' (annexe DPE de l’étude de rénovation)':''} : ${p.ep} kWhEP/an et ${p.kg} kg CO₂/an pour ${p.surf} m²${extra}.`,...(inferred?{reviewCap:0.88}:{})});
  for(const p of use){ if(!(p.surf>0)) continue;
    if(p.ep>0&&p.kg>=0){ const cep=Math.round(p.ep/p.surf*10)/10, ges=Math.round(p.kg/p.surf*10)/10; const c=dpeClasses(cep,ges);
      emit(p.ex,p.B,`dpe_energy_${P}`,c.energy,'etiquette-energie',0.9,'',note(p,` → ${cep} kWhEP/m².an (classe ${c.energyOnly}), ${ges} kgCO₂/m².an (classe ${c.ges}) ; étiquette = classe la plus défavorable`));
      emit(p.gx||p.ex,p.B,`dpe_ges_${P}`,c.ges,'etiquette-ges',0.9,'',note(p,` → ${ges} kgCO₂/m².an`)); }
    if(p.heat) emit(p.heat.x,p.B,`heating_vector_${P}`,p.heat.v,'chauffage-energie',0.9,'',{provenanceNote:`Consommation de chauffage du DPE : ${p.heat.x.t.slice(0,80)}.`});
    if(p.ecs) emit(p.ecs.x,p.B,`ecs_vector_${P}`,p.ecs.v,'ecs-energie',0.9,'',{provenanceNote:`Consommation d’eau chaude du DPE : ${p.ecs.x.t.slice(0,80)}.`});
    if(P==='before') emit(p.sx,p.B,'shab',p.surf,'surface',0.85,'m²',{reviewCap:0.85});
    if(p.yr){ const y=p.yr.t.replace(/^.*?:\s*/,''); const m=y.match(/(\d{4})(?:\s+et\s+(\d{4}))?/); if(m&&!m[2]) emit(p.yr,p.B,'construction_year',Number(m[1]),'annee',0.85); else if(m) emit(p.yr,p.B,Number(m[1])>=1948?'built_after_1948':'built_before_1948','Oui','periode',0.85,'',{provenanceNote:`Année de construction : ${y}.`}); }
    if(p.eqt){ const t=p.eqt, x=p.S.find(z=>/Vue\s+d.ensemble\s+des\s+equipements/i.test(z.t)); const v=/double\s+flux/i.test(t)?'VMC double flux':/hygro\s*B/i.test(t)?'VMC Hygro B':/hygro\s*A/i.test(t)?'VMC Hygro A':/simple\s+flux/i.test(t)?'VMC simple flux':null; if(v) emit(x,p.B,P==='after'?'ventilation':'ventilation_before',v,'equipements',0.86); }
    if(P==='after'&&p.eqt){ const t=p.eqt; const mode=/pompe\s+a\s+chaleur\s+air\s*\/\s*eau|PAC\s+air\s*\/\s*eau/i.test(t)?'PAC air/eau':/condensation/i.test(t)?'Chaudière condensation':/chaudiere\s+gaz/i.test(t)?'Chaudière gaz':null; const x=p.S.find(z=>/Vue\s+d.ensemble\s+des\s+equipements/i.test(z.t));
      if(mode) emit(x,p.B,'heating_mode_after',mode,'equipements',0.86); }
  }
  if(coll.length&&parsed.length>1) emit(coll[0].S[0],'Bâtiment unique','housing_count',parsed.filter(p=>/appartement|maison|logement/i.test(p.type)).length||null,'dpe-logements',0.8,'',{provenanceNote:'Nombre de DPE de logements joints au DPE du bâtiment.',reviewCap:0.8});
  const dep=L.find(x=>/^Departement\s+\d{2,3}\b/i.test(x.t)); if(dep) emit(dep,'Bâtiment unique','department',dep.t.match(/(\d{2,3})\b/)[1],'departement',0.9,'',{secondarySourceOk:true});
  return out;
}

// Récapitulatif « Lgt. 1 9 Route du Panama T4 87 269 56 E E 72 2 B A » (Cep / GES / étiquettes initiaux puis rénovés).
export function parseDpeRecapTable(doc,occ,canonical=(s)=>s){
  const out=[]; const L=dp_lines(doc); const origin='Récapitulatif DPE par logement';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`dpe-recap:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,dedicatedRank:7,...extra}); if(o) out.push(o); };
  const typ={}; let n=0, first=null;
  for(const x of L){ const m=x.t.match(/^Lgt\.?\s*([A-Z]?\s*\d+|[A-Z])\b.*?\b(T\d)\s+(\d+(?:[.,]\d+)?)\s+(\d+)\s+(\d+)\s+([A-G])\s+([A-G])\s+(\d+)\s+(\d+)\s+([A-G])\s+([A-G])\s*$/); if(!m) continue;
    const B=`Logement ${m[1].replace(/\s+/g,' ')}`; n++; first=first||x; typ[m[2]]=(typ[m[2]]||0)+1;
    const note={provenanceNote:`Récapitulatif DPE : ${m[2]}, ${m[3]} m², Cep ${m[4]} → ${m[8]}, GES ${m[5]} → ${m[9]}.`};
    emit(x,B,'dpe_energy_before',m[6],'energie-init',0.9,'',note); emit(x,B,'dpe_ges_before',m[7],'ges-init',0.9,'',note); emit(x,B,'dpe_energy_after',m[10],'energie-reno',0.9,'',note); emit(x,B,'dpe_ges_after',m[11],'ges-reno',0.9,'',note);
    emit(x,B,'shab',dp_n(m[3]),'surface',0.86,'m²',note); emit(x,B,'housing_typologies',`${m[2]} : 1`,'typologie',0.86,'',note); emit(x,B,'housing_count',1,'logement',0.85); }
  if(n&&first){ emit(first,'Bâtiment unique','housing_count',n,'total-logements',0.86,'',{provenanceNote:`${n} logements dans le récapitulatif DPE.`}); emit(first,'Bâtiment unique','housing_typologies',Object.entries(typ).sort().map(([k,v])=>`${k} : ${v}`).join(' ; '),'typologies',0.86); }
  return out;
}
