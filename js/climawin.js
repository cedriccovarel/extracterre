// ExtracTerre v2.3.3 — synthèse d'étude ClimaWin 2020 (RE2020), PDF multi-bâtiments.
// Structure stable : « N. Bâtiment X » → N.1 Étude / N.2 Bâtiment / N.3 Enveloppe / N.4 Synthèse RE2020.
// Chaque indicateur est lu dans sa propre table, rattaché au bâtiment de sa section (jamais deviné par
// proximité de mots), et contrôlé par recoupement (Σ zones = Sref, gains recalculés, etc.).
import {normalizeText} from './utils.js';
import {canonicalBuilding} from './buildings.js';

const cw_NUM='-?\\d+(?:[.,]\\d+)?';
const cw_num=s=>{ const v=Number(String(s).replace(/\s+/g,'').replace(',','.')); return Number.isFinite(v)?v:null; };
const cw_round=(v,d=2)=>{ const f=10**d; return Math.round(v*f)/f; };

export function isClimaWinSynthesis(doc){
  const t=String(doc?.read?.text||'').slice(0,400000);
  return /synthese\s+d['’]?etude\s+realisee\s+avec\s+climawin\s+2020/i.test(t)&&/calcul\s+bbio\s*:\s*resultats\s+par\s+zone|bbio\s*\(points\)/i.test(t);
}

// Rapport « Saisie détaillée » ClimaWin : paramètres d'entrée (parois, menuiseries, locaux). Volumineux (300 à 700 pages),
// numéroté « Bâtiment 1/2/3 » et sans résultat réglementaire : il n'est pas exploité par l'extraction automatique.
export function isClimaWinInputReport(doc){
  const t=String(doc?.read?.text||'').slice(0,60000);
  return /climawin\s+2020/i.test(t)&&/rapport\s+detaille/i.test(t)&&/\b3\.\s*parois\b/i.test(t)&&!/synthese\s+d['’]?etude\s+realisee\s+avec\s+climawin/i.test(t);
}

// Sections « N. Bâtiment X » (hors sommaire : le vrai titre est suivi de « N.1. Étude »).
export function climaWinBuildingSections(doc){
  const out=[];
  for(const page of doc?.read?.pages||[]){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const m=String(lines[i].text||'').match(/^\d+\.\s+(Batiment\s+.+)$/i);
      if(!m) continue;
      const next=String(lines[i+1]?.text||'');
      if(!/^\d+\.1\.\s+Etude\s*$/i.test(next)) continue;
      out.push({name:canonicalBuilding(m[1].trim()),page:page.page,line:lines[i].index});
    }
  }
  return out;
}

function cw_studyDateOf(lines){
  for(const l of lines){ const m=String(l.text).match(/^Date\s+(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/i); if(m) return `${m[3]}-${m[2]}-${m[1]}${m[4]?'T'+m[4]:''}`; }
  return null;
}

const cw_USAGE_FIELDS={fr:'cep_cooling',ecl:'cep_lighting',vent:'cep_aux_vent',dist:'cep_aux_dist',depl:'cep_mobility'};
const cw_VECTOR_LABEL={elec:'Électricité',gaz:'Gaz',fioul:'Fioul',bois:'Bois / biomasse',reseau:'Réseau de chaleur urbain'};
const cw_VECTOR_FIELD={elec:'cep_electricity',gaz:'cep_gas',reseau:'cep_district',bois:'cep_biomass'};

export function parseClimaWinSynthesis(doc,occ){
  const sections=climaWinBuildingSections(doc); if(!sections.length) return [];
  const pages=doc.read.pages||[]; const out=[];
  // Lignes aplaties avec leur page, pour borner chaque section jusqu'au titre suivant.
  const flat=[]; for(const p of pages) for(const l of p.lines||[]) flat.push({page:p,line:l,text:String(l.text||'')});
  const posOf=(s)=>flat.findIndex(f=>f.page.page===s.page&&f.line.index===s.line);
  for(let si=0;si<sections.length;si++){
    const sec=sections[si]; const from=posOf(sec); const to=si+1<sections.length?posOf(sections[si+1]):flat.length;
    if(from<0) continue; const seg=flat.slice(from,to); const building=sec.name;
    const emit=(f,field,value,method,conf,unit='',extra={})=>{ if(value===null||value===undefined||(typeof value==='number'&&!Number.isFinite(value))) return;
      const o=occ(doc,f.page,f.line,field,value,`climawin:${method}`,conf,unit,{building,structuredPdf:true,studyDate:studyDate,origin:'ClimaWin 2020 — synthèse d\'étude RE2020',...extra}); if(o) out.push(o); };
    const studyDate=cw_studyDateOf(seg);
    const find=(re)=>{ for(const f of seg){ const m=f.text.match(re); if(m) return {f,m}; } return null; };
    const gain=(v,max)=>max?cw_round((max-v)/max*100,2):null;

    // ---- Indicateurs réglementaires (boîtes « VALEUR / EXIGENCE ») ----
    const rows=[['bbio',/^BBio \(points\)\s+(cw_NUM)\s+(cw_NUM)\s+-?\d+\s*%/,'bbio','bbio_max','bbio_gain','points'],
                ['cepnr',/^Cep,nr \(kWhep\/\(m².an\)\)\s+(cw_NUM)\s+(cw_NUM)\s+-?\d+\s*%/,'cepnr','cepnr_max','cepnr_gain','kWhEP/m².an'],
                ['cep',/^Cep \(kWhep\/\(m².an\)\)\s+(cw_NUM)\s+(cw_NUM)\s+-?\d+\s*%/,'cep','cep_max','cep_gain','kWhEP/m².an'],
                ['ic',/^Ic,energie\b.*?\s(cw_NUM)\s+(cw_NUM)\s+-?\d+\s*%/,'ic_energy',null,null,'kgCO2e/m²']];
    let cepVal=null;
    for(const [,reTpl,fv,fmax,fgain,unit] of rows){
      const re=new RegExp(reTpl.source.replace(/cw_NUM/g,cw_NUM),'i'); const hit=find(re); if(!hit) continue;
      const v=cw_num(hit.m[1]), mx=cw_num(hit.m[2]); if(fv==='cep') cepVal=v;
      emit(hit.f,fv,v,'indicator-box',0.995,unit,{excerpt:hit.f.text});
      if(fmax) emit(hit.f,fmax,mx,'indicator-box',0.995,unit,{excerpt:hit.f.text});
      if(fgain&&mx) emit(hit.f,fgain,gain(v,mx),'indicator-gain-calc',0.99,'%',{derivedFromDocument:true,excerpt:hit.f.text,provenanceNote:`Gain = (exigence − valeur) / exigence, calculé sur les deux valeurs de la même ligne ClimaWin (écart ClimaWin arrondi : ${hit.m[0].match(/-?\d+\s*%$/)?.[0]}).`});
    }
    // ---- Confort d'été : groupe le plus défavorable (DH le plus élevé), DH max du même groupe ----
    let worst=null;
    for(const f of seg){ const m=f.text.match(new RegExp(`^DH de Groupe d'usage.*?\\s(${cw_NUM})\\s+(${cw_NUM})\\s+-?\\d+\\s*%$`,'i')); if(!m) continue; const dh=cw_num(m[1]), mx=cw_num(m[2]); if(!worst||dh>worst.dh) worst={dh,mx,f,count:(worst?.count||0)+1}; else worst.count++; }
    if(worst){ emit(worst.f,'dh',worst.dh,'dh-worst-group',0.99,'°C.h',{excerpt:worst.f.text,provenanceNote:`Groupe le plus défavorable parmi ${worst.count} groupe(s) du bâtiment.`}); emit(worst.f,'dh_max',worst.mx,'dh-worst-group',0.99,'°C.h',{excerpt:worst.f.text}); }
    // ---- Surface : « Enveloppe : détails par entité » (ligne bâtiment) > Σ zones > « Surface totale » ----
    let sref=null, srefLine=null;
    const sameBuilding=(label)=>canonicalBuilding(String(label).trim())===building;
    for(const f of seg){ const m=f.text.match(new RegExp(`^(Batiment\\s+.+?)\\s(${cw_NUM})\\s+${cw_NUM}\\s+${cw_NUM}\\s+${cw_NUM}\\s+${cw_NUM}\\s+${cw_NUM}\\s*%\\s+${cw_NUM}`,'i')); if(m&&sameBuilding(m[1])){ sref=cw_num(m[2]); srefLine=f; break; } }
    // ---- Zones : logements, traversant ----
    let housing=0, zoneArea=0, zoneLine=null, trav=false, nonTrav=false, zoneHits=0;
    for(const f of seg){ const m=f.text.match(new RegExp(`\\(RE2020\\)\\s*-\\s*(${cw_NUM})\\s*m².*?-\\s*(\\d+)\\s+logements?\\b.*?-\\s*(Non traversante|Traversante)`,'i')); if(m){ housing+=Number(m[2]); zoneArea+=cw_num(m[1]); zoneLine=zoneLine||f; zoneHits++; if(/^non/i.test(m[3])) nonTrav=true; else trav=true; continue; }
      const mb=f.text.match(new RegExp(`\\(RE2020\\)\\s*-\\s*(${cw_NUM})\\s*m²`,'i')); if(mb&&/Bureaux|Commerce|Enseignement|Sante/i.test(f.text)) zoneArea+=cw_num(mb[1]); }
    if(sref!==null) emit(srefLine,'shab',sref,'entity-table-sref',0.995,'m²',{excerpt:srefLine.text,provenanceNote:'Sref du bâtiment (tableau « Enveloppe : détails par entité »).'});
    else if(zoneArea>0&&zoneLine) emit(zoneLine,'shab',cw_round(zoneArea,2),'zones-sum',0.97,'m²',{derivedFromDocument:true,excerpt:zoneLine.text});
    if(zoneHits){ emit(zoneLine,'housing_count',housing,'zones-sum',0.98,'',{derivedFromDocument:zoneHits>1,excerpt:zoneLine.text,provenanceNote:`Somme des logements des ${zoneHits} zone(s) d'usage résidentielles du bâtiment.`});
      if(trav) emit(zoneLine,'cross_ventilated','Oui','zone-type',0.98,'',{excerpt:zoneLine.text}); if(nonTrav) emit(zoneLine,'non_cross_ventilated','Oui','zone-type',0.98,'',{excerpt:zoneLine.text}); }
    // ---- Production locale d'électricité (10 valeurs sur la ligne du bâtiment) ----
    for(const f of seg){ const m=f.text.match(new RegExp(`^(Batiment\\s+.+?)\\s((?:${cw_NUM}\\s+){9}${cw_NUM})$`,'i')); if(!m||!sameBuilding(m[1])) continue; const v=m[2].split(/\s+/).map(cw_num); if(v.length!==10) continue; const efPv=v[4];
      if(efPv>0){ emit(f,'enr','Oui','pv-balance',0.97,'',{excerpt:f.text,provenanceNote:`Production PV ${efPv} kWhef/m².an (bilan de la production locale d'électricité).`}); emit(f,'enr_type','Photovoltaïque','pv-balance',0.97,'',{excerpt:f.text}); }
      else if(!(v[7]>0)) { emit(f,'enr','Non','pv-balance',0.96,'',{excerpt:f.text,provenanceNote:'Bilan de production locale d\'électricité nul pour ce bâtiment (PV = 0).'}); emit(f,'enr_type','Aucun','pv-balance',0.96,'',{excerpt:f.text}); }
      if(v[7]>0) emit(f,'enr_type','Cogénération','pv-balance',0.9,'',{excerpt:f.text}); break; }
    // ---- Consommations par usage et par vecteur (colonne « Tot EP ») ----
    const vecEP={}; const useEP={}; let sawVector=new Set(); let lastLine=null;
    for(const f of seg){ const m=f.text.match(new RegExp(`^Cef (elec|gaz|fioul|bois|reseau)-(ch|fr|ecs|ecl|vent|dist|depl|mobi)\\s+((?:${cw_NUM}\\s+){12})(${cw_NUM})(?:\\s+(${cw_NUM}))?$`,'i')); if(!m) continue;
      const vec=m[1].toLowerCase(), use=m[2].toLowerCase(); const ep=m[5]!==undefined?cw_num(m[5]):null; sawVector.add(vec); lastLine=f;
      if(ep===null) continue; (useEP[use]=useEP[use]||{})[vec]=ep; if(use!=='mobi') vecEP[vec]=(vecEP[vec]||0)+ep;
      if(vec==='elec'&&cw_USAGE_FIELDS[use]) emit(f,cw_USAGE_FIELDS[use],ep,'usage-ep',0.99,'kWhEP/m².an',{excerpt:f.text,provenanceNote:`Colonne « Tot EP » de la ligne « Cef ${vec}-${use} ».`}); }
    for(const [vec,total] of Object.entries(vecEP)){ const field=cw_VECTOR_FIELD[vec]; if(field&&lastLine) emit(lastLine,field,cw_round(total,1),'vector-ep-sum',0.95,'kWhEP/m².an',{derivedFromDocument:true,excerpt:lastLine.text,provenanceNote:`Somme des « Tot EP » du vecteur ${cw_VECTOR_LABEL[vec]} (hors mobilier).`}); }
    const dominant=(use)=>{ const row=useEP[use]; if(!row) return null; const e=Object.entries(row).sort((a,b)=>b[1]-a[1]); if(!e.length||e[0][1]<=0) return null; const tot=e.reduce((s,x)=>s+x[1],0); return e[0][1]/tot>=0.7?cw_VECTOR_LABEL[e[0][0]]:'Hybride'; };
    const hv=dominant('ch'), ev=dominant('ecs');
    if(hv&&lastLine) emit(lastLine,'heating_vector_after',hv,'vector-dominant',0.93,'',{derivedFromDocument:true,excerpt:lastLine.text,provenanceNote:'Vecteur énergétique majoritaire de la ligne « Cef …-ch » (consommations importées).'});
    if(ev&&lastLine) emit(lastLine,'ecs_vector_after',ev,'vector-dominant',0.93,'',{derivedFromDocument:true,excerpt:lastLine.text,provenanceNote:'Vecteur énergétique majoritaire de la ligne « Cef …-ecs ».'});
    void cepVal;
  }
  return out;
}

// Étude présente en plusieurs versions : on garde la date d'étude la plus récente par bâtiment.
export function studyDateRank(o){ const d=Date.parse(o?.studyDate||''); return Number.isFinite(d)?d:0; }

// ---------------------------------------------------------------------------
// Enveloppe : les cellules d'un tableau ClimaWin sont éclatées sur plusieurs lignes PDF. Chaque ligne
// d'« ancre » (surface + type de paroi) est entourée de ses cellules : on rattache chaque ligne à
// l'ancre la plus proche verticalement, puis on retient la paroi dominante (surface) par catégorie.
// ---------------------------------------------------------------------------
const cw_ANCHOR=/(\d+(?:\.\d+)?)\s+(Mur exterieur|Mur sur LNC|Pl\. ?bas sur sol|Pl\. ?bas sur LNC|Pl\. haut sur LNC|Pl\. haut exter\.|Rampants?)(?=\s|$)/i;
const cw_CATEGORY=t=>/^mur exterieur/i.test(t)?'wall':/bas sur sol/i.test(t)?'floor':/^pl\. ?bas sur lnc/i.test(t)?'floor_lnc':/^(?:pl\. haut|rampant)/i.test(t)?'roof':null;
function cw_sanitizeCell(s){
  return String(s).replace(/\b\d+\.\d{2,3}(?:\/\d?\.?\d*)?\b/g,' ').replace(/\b\d+(?:\.\d+)?\s*%/g,' ')
    .replace(/\(\s*\d+(?:\.\d+)?\s*cm\s*\)/gi,' ').replace(/\(\s*\d+(?:\.\d+)?(?=\s|$)/g,' ').replace(/\bcm\)/gi,' ')
    .replace(/\bR\s*=\s*[\d,.]+/gi,' ').replace(/\b\d{3,4}\s*x\s*\d{3,4}(?:\s*x\s*\d+)?\b/gi,' ').replace(/\b\d+\s*mm\b/gi,' ').replace(/\s+/g,' ').trim();
}
// Les colonnes « Type » et « Nature » (Mur extérieur, Pl. haut sur LNC, ITI…) trompent le parseur d'enveloppe :
// on les retire pour les planchers et toitures, et le libellé de catégorie garde la main.
function cw_categoryClean(cat,text){
  let t=String(text);
  if(cat==='wall') return t;
  t=t.replace(/\bPl\. ?(?:bas|haut)[^\s]*\s+sur\s+\w+/gi,' ').replace(/\bMur\s+exterieur\b/gi,' ').replace(/\bRampants?\b/gi,'rampant').replace(/\bIT[IER]\b/g,' ').replace(/\bB[eé]ton\b|\bBeton\b/g,' ').replace(/\bParpaing\b/gi,' ');
  return t.replace(/\s+/g,' ').trim();
}
// Regroupe les lignes d'un tableau en « rangées » : l'interligne intra-cellule (~3-4 pt) est très inférieur
// à l'espace entre deux rangées (≥ 8 pt) dans les tableaux ClimaWin.
function cw_clusterRows(lines,gap=7.5){
  const sorted=[...lines].sort((a,b)=>(b.line.y??0)-(a.line.y??0)||a.line.index-b.line.index); const rows=[]; let cur=null,prevY=null;
  for(const f of sorted){ const y=f.line.y??0; if(!cur||prevY-y>gap){ cur=[]; rows.push(cur); } cur.push(f); prevY=y; }
  return rows;
}
export function climaWinEnvelopeLines(doc){
  const sections=climaWinBuildingSections(doc); if(!sections.length) return [];
  const flat=[]; for(const p of doc.read.pages||[]) for(const l of p.lines||[]) flat.push({page:p.page,line:l,text:String(l.text||'')});
  const posOf=s=>flat.findIndex(f=>f.page===s.page&&f.line.index===s.line);
  const out=[];
  for(let si=0;si<sections.length;si++){
    const sec=sections[si]; const from=posOf(sec), to=si+1<sections.length?posOf(sections[si+1]):flat.length; if(from<0) continue;
    const seg=flat.slice(from,to); const building=sec.name;
    const byPage=new Map(); for(const f of seg){ if(!byPage.has(f.page)) byPage.set(f.page,[]); byPage.get(f.page).push(f); }
    const opaque=[], glazed=[];
    for(const [,lines] of byPage){
      let mode=null; const hasHeader=lines.some(x=>/Enveloppe du batiment\s*:/i.test(x.text)); const regO=[], regG=[];
      for(const f of lines){
        if(/Enveloppe du batiment\s*:\s*parois opaques/i.test(f.text)){ mode='o'; continue; }
        if(/Enveloppe du batiment\s*:\s*menuiseries/i.test(f.text)){ mode='g'; continue; }
        if(/Enveloppe du batiment\s*:\s*ponts thermiques|Enveloppe\s*:\s*details/i.test(f.text)){ mode=null; continue; }
        if(/^Construction de .* Page \d+|^ClimaWin 2020|^Surface Type |^m² (?:W|\()/i.test(f.text)) continue;
        // page de continuation sans titre : le type de tableau se déduit des ancres
        const m=mode||(!hasHeader?(cw_ANCHOR.test(f.text)?'o':(/Fenetre|Porte\s+Alu/i.test(f.text)?'g':null)):null);
        if(m==='o') regO.push(f); else if(m==='g') regG.push(f);
      }
      if(!hasHeader&&regO.length===0&&regG.length===0){ for(const f of lines) { if(/^Construction de|^ClimaWin/i.test(f.text)) continue; (lines.some(x=>cw_ANCHOR.test(x.text))?regO:regG).push(f); } }
      for(const r of cw_clusterRows(regO)) opaque.push(r); for(const r of cw_clusterRows(regG)) glazed.push(r);
    }
    const rows=[];
    for(const r of opaque){
      const blob=r.map(x=>x.text).join(' '); const anchor=r.find(x=>cw_ANCHOR.test(x.text)); if(!anchor) continue; const m=anchor.text.match(cw_ANCHOR); const cat=cw_CATEGORY(m[2]); if(!cat||/coffre/i.test(blob)) continue;
      const lam=(anchor.text.match(/\s(\d\.\d{3})(?:\/|\s)/)||[])[1];
      const cms=[...blob.matchAll(/\((\d+(?:\.\d+)?)(?!\d|\.\d|\s*\)|\s*(?:mm|m²))/g)].map(x=>Number(x[1]));
      rows.push({cat,surface:Number(m[1]),blob,lambda:lam?Number(lam):null,cms,anchor});
    }
    for(const cat of ['wall','floor','roof']){
      let cand=rows.filter(r=>r.cat===cat); if(cat==='floor'&&!cand.length) cand=rows.filter(r=>r.cat==='floor_lnc'); if(!cand.length) continue;
      const r=cand.sort((a,b)=>b.surface-a.surface)[0]; const single=r.cms.length===1; const e=single?Math.round(r.cms[0]*10):null; const R=e&&r.lambda?Math.round(e/1000/r.lambda*100)/100:null;
      const label={wall:'Mur extérieur isolation',floor:'Plancher bas isolation',roof:'Toiture combles isolation'}[cat];
      out.push({building,category:cat,anchor:r.anchor,surface:r.surface,thicknessMm:e,rValue:R,text:`${label} : ${cw_categoryClean(cat,cw_sanitizeCell(r.blob))}${e?` ${e} mm`:''}`});
    }
    // --- menuiseries : vitrage et protection majoritaires (en surface) ---
    const glaz=new Map(), prot=new Map(); const matCount=new Map(); let matLine=null;
    for(const r of glazed){
      const blob=r.map(x=>x.text).join(' '); const m=blob.match(/(\d+\.\d+)\s+(Fenetre|Porte)\s+(Alu\.|PVC|Bois|Mixte)/i); if(!m||/^porte/i.test(m[2])) continue;
      const surf=Number(m[1]); const g=blob.match(/\b(DV|TV|SV)\s*([\d/]+)\s*(Argon|Air|Krypton)?/i); const gk=g?`${g[1].toUpperCase()} ${g[2]}${g[3]?' '+g[3]:''}`:null;
      if(gk) glaz.set(gk,(glaz.get(gk)||0)+surf); const pk=/Volet moto/i.test(blob)?'volet roulant motorisé':/Volet/i.test(blob)?'volet roulant':null; if(pk) prot.set(pk,(prot.get(pk)||0)+surf);
      const mk={'alu.':'aluminium',pvc:'PVC',bois:'bois',mixte:'mixte bois-alu'}[m[3].toLowerCase()]; matCount.set(mk,(matCount.get(mk)||0)+surf); matLine=matLine||r[0];
    }
    const top=m=>[...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(matLine) out.push({building,category:'window',anchor:matLine,text:`Menuiseries ${top(matCount)||''} ${top(glaz)||''} ${top(prot)||''}`.replace(/\s+/g,' ').trim()});
  }
  return out;
}

// ---------------------------------------------------------------------------
// Récapitulatif thermique d'un BE (modèle « BE ACT — Préconisations et remarques Thermique »).
// Résultats du lot (bâtiment le plus défavorable) + descriptif des systèmes. Les valeurs de performance
// sont rattachées à « Bâtiment unique » : elles ne sont jamais recopiées sur chaque bâtiment d'un lot.
// ---------------------------------------------------------------------------
export function isBeActRecap(doc){
  const t=String(doc?.read?.text||'').slice(0,200000);
  return /performance\s+du\s+batiment\s+selon\s+la\s+re\s*2020/i.test(t)&&/systemes\s+principaux\s+du\s+projet|gestionnaire\s+d['’]?energie|analyse\s+thermique\s+du\s+projet|respect\s+des\s+exigences\s+de\s+moyens/i.test(t);
}
export function parseBeActRecap(doc,occ){
  const out=[]; const pages=doc.read.pages||[];
  const lotM=String(doc.read.text||'').match(/Etude realisee pour le (Lot\s*\w+)/i); const lot=lotM?lotM[1]:null;
  const base={structuredPdf:true,lotLevel:true,origin:`Récapitulatif thermique BE${lot?' — '+lot:''}`,};
  const emit=(page,line,field,value,method,conf,unit='',extra={})=>{ const o=occ(doc,page,line,field,value,`recap-be:${method}`,conf,unit,{...base,...extra}); if(o) out.push(o); };
  const cw_NUMC='[-+]?\\s*\\d+(?:[.,]\\d+)?';
  const perf=[[/^Bbio projet\s*=\s*(§)\s*points\s*Bbiomax\s*=\s*(§)\s*points\s*Gain\s*=\s*(§)\s*%/i,'bbio','bbio_max','bbio_gain','points'],
              [/^Cep nr projet\s*=\s*(§)\s*kWhep\/m².*?Cep nr max\s*=\s*(§)\s*kWhep\/m².*?Gain\s*=\s*(§)\s*%/i,'cepnr','cepnr_max','cepnr_gain','kWhEP/m².an'],
              [/^Cep projet\s*=\s*(§)\s*kWhep\/m².*?Cepmax\s*=\s*(§)\s*kWhep\/m².*?Gain\s*=\s*(§)\s*%/i,'cep','cep_max','cep_gain','kWhEP/m².an']];
  for(const page of pages) for(const line of page.lines||[]){
    const t=String(line.text||'');
    for(const [reTpl,fv,fmax,fgain,unit] of perf){ const m=t.match(new RegExp(reTpl.source.replace(/§/g,cw_NUMC),'i')); if(!m) continue;
      const ex={excerpt:t,provenanceNote:`Résultat du lot${lot?' ('+lot+')':''} sur le bâtiment le plus défavorable : à attribuer au bâtiment concerné.`};
      emit(page,line,fv,cw_num(m[1]),'performance',0.97,unit,ex); emit(page,line,fmax,cw_num(m[2]),'performance',0.97,unit,ex); emit(page,line,fgain,cw_num(m[3]),'performance',0.97,'%',ex); }
  }
  const all=[]; for(const p of pages) for(const l of p.lines||[]) all.push({p,l,t:String(l.text||'')});
  const findLine=(re)=>all.find(x=>re.test(x.t));
  const rev=findLine(/Reversible\s*:\s*OUI/i); if(rev) emit(rev.p,rev.l,'cooling','PAC réversible','systems',0.96,'',{excerpt:rev.t});
  const pac=findLine(/PAC\s+AIR\/EAU/i); if(pac){ emit(pac.p,pac.l,'heating_mode_after','PAC air/eau','systems',0.96,'',{excerpt:pac.t}); emit(pac.p,pac.l,'heating_vector_after','Électricité','systems-vector',0.92,'',{derivedFromDocument:true,excerpt:pac.t,provenanceNote:'Pompe à chaleur : vecteur électrique.'}); }
  const thermo=findLine(/Ballons?\s+thermo/i), elec=findLine(/Ballons?\s+electriques?|^electriques\s+\w+|T2 et moins\s*:\s*Ballons/i);
  if(thermo) emit(thermo.p,thermo.l,'ecs','Chauffe-eau thermodynamique','systems',0.94,'',{excerpt:thermo.t});
  if(elec) emit(elec.p,elec.l,'ecs','Ballon électrique','systems',0.92,'',{excerpt:elec.t});
  if(thermo||elec) emit((thermo||elec).p,(thermo||elec).l,'ecs_vector_after','Électricité','systems-vector',0.92,'',{derivedFromDocument:true,excerpt:(thermo||elec).t});
  const vent=findLine(/Hygroreglable\s+type\s+B/i); if(vent) emit(vent.p,vent.l,'ventilation','VMC Hygro B','systems',0.95,'',{excerpt:vent.t});
  const pv=findLine(/Nombre\s*:\s*(\d+)\s*panneaux/i); if(pv){ emit(pv.p,pv.l,'enr','Oui','systems',0.95,'',{excerpt:pv.t}); emit(pv.p,pv.l,'enr_type','Photovoltaïque','systems',0.95,'',{excerpt:pv.t}); }
  const vre=findLine(/Fenetre\s+ALU\s*\+\s*VRE/i); if(vre){ emit(vre.p,vre.l,'window_material','Aluminium','windows',0.95,'',{excerpt:vre.t}); emit(vre.p,vre.l,'window_shading','Volet roulant','windows',0.93,'',{excerpt:vre.t,provenanceNote:'VRE = volet roulant électrique (type de menuiserie majoritaire).'}); }
  const gl=all.map(x=>x.t.match(/\b(\d)\s*-\s*(\d{1,2})\s*-\s*(\d)\b/)).find(Boolean); if(gl&&vre) emit(vre.p,vre.l,'window_glazing',`${gl[1]}/${gl[2]}/${gl[3]}`,'windows',0.9,'',{excerpt:vre.t});
  return out;
}
