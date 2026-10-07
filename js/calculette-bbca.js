// v2.3.9 — Calculette BBCA (V4.x, association BBCA) — export PDF ou classeur Excel d'origine.
// Un fichier par bâtiment (« Projet Caen Couvrechef_Bat A »). Onglets / pages :
//  • « 1. Info et Seuils BBCA » : Client, Projet, Sref projet, Nombre de logement, seuils BBCA (≠ seuils RE2020) ;
//  • « 2. Emissions carbone » : Ic Construction par lot (« 1.VRD … 9 », « 2.1. Fondations … 22,42 »,
//    « 2.3 Parcs de stationnement … 30 » → sous-lots additionnés), « Ic Composants = », « Ic Chantier = »,
//    « Ic Construction = », postes « Exploitation Maîtrisée » (Chauffage, ECS…), « Ic Energie = », « Ic Eau = » ;
//  • « Score BBCA » : score et niveau visé (Standard / Performance / Excellence).
// Les seuils BBCA ne sont pas des seuils réglementaires RE2020 : ils ne remplissent pas les colonnes « Max ».
import {normalizeText,parseFrNumber} from './utils.js';

const bb_lineText=l=>normalizeText(l?.text||'').replace(/\s*\|\s*/g,' ').replace(/\s+/g,' ').trim();

export function isBbcaCalculette(doc){
  const t=String(doc?.read?.text||'').slice(0,300000);
  return /Calculette\s+BBCA|Score\s+BBCA\s+V\d/i.test(t)&&/Ic\s+Composants\s*(?:\|\s*)*=/i.test(t)&&/Ic\s+Projet\s+BBCA/i.test(t);
}

function bb_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:bb_lineText(line),cells:Array.isArray(line.cells)?line.cells.map(c=>String(c??'').trim()).filter(Boolean):null}));
  return out;
}

// Nombre d'une cellule / fin de ligne. Excel (SheetJS, format affiché) : « 3,000 m² », « 491.4 » → la virgule
// suivie de 3 chiffres est un séparateur de milliers. PDF : « 3 000 m² », « 491,4 ».
function bb_num(s,spreadsheet){
  let v=String(s||'').replace(/ | /g,' ').replace(/\s*(?:m²|m2|kg.*|points?|%)\s*$/i,'').trim();
  if(spreadsheet&&/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(v)) v=v.replace(/,/g,'');
  v=v.replace(/^(-?\d{1,3}(?: \d{3})+)(?=$|[.,]\d)/,m=>m.replace(/ /g,''));
  return /^[-+]?\d+(?:[.,]\d+)?$/.test(v)?parseFrNumber(v):null;
}
// Valeur portée par une ligne : dernière cellule (classeur) ou fin de ligne (PDF).
function bb_value(x,spreadsheet){
  if(x.cells&&x.cells.length>=2) return bb_num(x.cells[x.cells.length-1],true);
  const m=x.t.match(/(-?\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?)\s*(?:m²|m2|points?)?\s*$/i);
  return m?bb_num(m[1],spreadsheet):null;
}
function bb_text(x){
  if(x.cells&&x.cells.length>=2) return x.cells[x.cells.length-1];
  return null;
}

function bb_projectLine(lines){ return lines.find(x=>/^Projet\s+\S/i.test(x.t)&&!/^Projet\s+\d/.test(x.t)); }
function bb_projectName(lines){
  const x=bb_projectLine(lines); if(!x) return '';
  return (bb_text(x)||x.t.replace(/^Projet\s+/i,'')).trim();
}
// « Caen Couvrechef_Bat A » → « Batiment A » ; à défaut le nom de fichier (« BBCA__Bat_B.pdf »).
export function bbcaBuildingName(doc){
  const lines=bb_allLines(doc); const p=normalizeText(bb_projectName(lines));
  const re=/(?:^|[\s_\-–])(?:Bat(?:iment)?|Bât(?:iment)?|Bloc)[\s_.\-]*([A-Z0-9]{1,3})\s*$/i;
  let m=p.match(re); if(m) return `Batiment ${m[1].toUpperCase()}`;
  m=normalizeText(String(doc?.name||'').replace(/\.[a-z0-9]+$/i,'')).match(re); if(m) return `Batiment ${m[1].toUpperCase()}`;
  return 'Bâtiment unique';
}

export function parseBbcaCalculette(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=bb_allLines(doc); const ss=doc.read?.kind==='spreadsheet';
  const B=canonical(bbcaBuildingName(doc)); const origin=`Calculette BBCA (${ss?'classeur Excel':'PDF'})`;
  const emit=(x,field,value,method,conf,unit='kgCO2e/m²',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`calculette-bbca:${method}`,conf,unit,{building:extra.building||B,structuredPdf:true,origin,...extra}); if(o) out.push(o); };
  const find=(re,from=0)=>lines.slice(from).find(x=>re.test(x.t));
  const val=(re,from=0)=>{ const x=find(re,from); return x?{x,v:bb_value(x,ss)}:null; };

  // Données générales.
  const proj=bb_projectLine(lines);
  if(proj){ const name=bb_projectName(lines).replace(/[\s_\-–]+(?:Bat(?:iment)?|Bât(?:iment)?|Bloc)[\s_.\-]*[A-Z0-9]{1,3}\s*$/i,'').trim(); if(name) emit(proj,'operation_name',name,'projet',0.95,'',{building:'Bâtiment unique',secondarySourceOk:true,provenanceNote:`« Projet » de la calculette BBCA : ${bb_projectName(lines)}.`}); }
  const cli=find(/^Client\s+\S/i); if(cli){ const v=(bb_text(cli)||cli.t.replace(/^Client\s+/i,'')).trim(); if(v) emit(cli,'owner_company',v,'client',0.95,'',{building:'Bâtiment unique',secondarySourceOk:true,provenanceNote:'« Client » de la calculette BBCA (maître d’ouvrage).'}); }
  const typ=find(/^Type\s+de\s+batiment\s+\S/i); if(typ){ const raw=(bb_text(typ)||typ.t.replace(/^Type\s+de\s+batiment\s+/i,'')).trim(); if(raw) emit(typ,'work_type',workTypeFromLabel(raw),'type-batiment',0.95,'',{building:'Bâtiment unique',secondarySourceOk:true,provenanceNote:`« Type de bâtiment » : ${raw}.`}); }
  const sref=val(/^Sref\s+projet\b/i); if(sref&&sref.v>0&&sref.v<100000) emit(sref.x,'shab',sref.v,'sref',0.95,'m²',{provenanceNote:'Sref projet (calculette BBCA).'});
  const lgt=val(/^Nombre\s+de\s+logements?\b/i); if(lgt&&lgt.v>0&&lgt.v<5000&&Number.isInteger(lgt.v)) emit(lgt.x,'housing_count',lgt.v,'logements',0.95,'');

  // Calculette « 2. Emissions carbone ».
  const start=Math.max(0,lines.findIndex(x=>/^Emissions\s+carbone$|^1\.\s*Construction\s+Raisonnee/i.test(x.t)));
  const comp=val(/^Ic\s+Composants\s*=/i,start), site=val(/^Ic\s+Chantier\s*=/i,start), cons=val(/^Ic\s+Construction\s*=/i,start);
  const consistent=comp&&site&&cons&&comp.v!==null&&site.v!==null&&cons.v!==null&&Math.abs(comp.v+site.v-cons.v)<=0.6;
  const confC=consistent?0.98:0.95;
  if(comp&&comp.v!==null) emit(comp.x,'ic_components',comp.v,'ic-composants',confC);
  if(site&&site.v!==null) emit(site.x,'ic_site',site.v,'ic-chantier',confC);
  if(cons&&cons.v!==null) emit(cons.x,'ic_construction',cons.v,'ic-construction',confC,'kgCO2e/m²',consistent?{provenanceNote:'Ic construction = Ic composants + Ic chantier (vérifié).'}:{});
  // Lots 1 à 13 (sous-lots 2.1 / 2.2 / 2.3 additionnés).
  const lots={}, lotLines={};
  for(const x of lines.slice(start)){
    if(/^Ic\s+(?:Titre|Composants)/i.test(x.t)) break;
    const m=x.t.match(/^(\d{1,2})\.(?:(\d)\.?)?\s*[A-Za-z]/); if(!m) continue;
    const lot=Number(m[1]); if(lot<1||lot>13) continue;
    const v=bb_value(x,ss); if(v===null) continue;
    lots[lot]=(lots[lot]||0)+v; lotLines[lot]=lotLines[lot]||x;
  }
  const lotSum=Object.values(lots).reduce((a,v)=>a+v,0);
  const lotsOk=comp&&comp.v!==null&&Object.keys(lots).length>=10&&Math.abs(lotSum-comp.v)<=Math.max(1,comp.v*0.01);
  for(const [lot,v] of Object.entries(lots)) emit(lotLines[lot],`ic_lot_${lot}`,Math.round(v*100)/100,'lot',lotsOk?0.97:0.86,'kgCO2e/m²',{provenanceNote:lotsOk?`Calculette BBCA par lot (Σ lots ${Math.round(lotSum*100)/100} = Ic composants ${comp.v}).`:'Calculette BBCA par lot : somme différente de Ic composants, à vérifier.'});
  // Exploitation maîtrisée : postes Ic énergie et Ic énergie.
  const expl=lines.findIndex(x=>/Exploitation\s+Maitrisee/i.test(x.t));
  const ene=val(/^Ic\s+Energie\s*=/i,Math.max(0,expl));
  const posts=[[/^Chauffage\b/i,'ic_energy_heating'],[/^Refroidissement\b/i,'ic_energy_cooling'],[/^ECS\b/i,'ic_energy_ecs'],[/^Auxiliaires\s+de\s+distribution\b/i,'ic_energy_aux_dist'],[/^Auxiliaires\s+de\s+ventilation\b/i,'ic_energy_aux_vent'],[/^Deplacements?\s+des\s+occupants/i,'ic_energy_mobility'],[/^Eclairage\b/i,null]];
  const postVals={};
  if(expl>=0){
    const endIdx=ene?lines.indexOf(ene.x):expl+12;
    for(const x of lines.slice(expl+1,endIdx)) for(const [re,field] of posts){ if(!re.test(x.t)) continue; const v=bb_value(x,ss); if(v!==null){ postVals[field||'eclairage']=v; if(field) emit(x,field,v,'poste-energie',0.95); } break; }
  }
  if(ene&&ene.v!==null){
    const s=Object.values(postVals).reduce((a,v)=>a+v,0); const ok=Object.keys(postVals).length>=4&&Math.abs(s-ene.v)<=0.6;
    emit(ene.x,'ic_energy',ene.v,'ic-energie',ok?0.98:0.95,'kgCO2e/m²',ok?{provenanceNote:'Ic énergie = somme des postes (vérifié).'}:{});
  }
  // Mention BBCA : démarche de labellisation (niveau visé d'après le score).
  const score=val(/^Score\s+BBCA\s*=/i); const ic=x=>{ const r=val(x); return r&&r.v!==null?r.v:null; };
  const eau=ic(/^Ic\s+Eau\s*=/i), projet=ic(/^Ic\s+Projet\s+BBCA\s*=/i), smax=ic(/^Ic\s+Construction\s+BBCA\s+max\s*=/i), emax=ic(/^Ic\s+Energie\s+BBCA\s+max\s*=/i);
  const level=score&&score.v!==null?(score.v>=30?'BBCA Excellence':score.v>=15?'BBCA Performance':score.v>=0?'BBCA Standard':null):null;
  const at=find(/^Calculette\s+BBCA|^Score\s+BBCA\s+V/i)||lines[0];
  const details=[level&&`niveau ${level} (score ${score.v} points)`,projet!==null&&`Ic projet BBCA ${projet}`,eau!==null&&`Ic eau ${eau}`,smax!==null&&`seuil BBCA Ic construction ${smax}`,emax!==null&&`seuil BBCA Ic énergie ${emax}`].filter(Boolean).join(' ; ');
  if(at) emit(at,'mention_bbca','Oui','label-vise',0.95,'',{provenanceNote:`Calculette BBCA renseignée${details?` — ${details}`:''}.`});
  return out;
}

// v2.3.10 / v2.3.11 — Calculette BBCA Rénovation (feuille « Résultats BBCA réno »), classeur Excel, export PDF ou
// « Fiche de synthèse – résultat BBCA » reproduite en annexe d'une notice ACV (un bloc « Bâtiment sur rue : » par bâtiment).
//  • tableau « Périmètre de la rénovation | lots rénovés | Impact carbone du lot rénové | Impact du lot comptabilisé ? »
//    (« Lot 1. VRD | Oui | 1 | Oui » … « Lot 12 » ; en PDF la ligne peut être coupée : « Lot 5. Cloisonnement-… » / « Oui 31 Oui ») ;
//  • indicateurs « Eges PCE / PCENA / énergie / chantier / eau / Eges » et leurs seuils « … max » (kg CO2 eq/m² SDP)
//    → colonnes Eges (et Eges Max) ; tableau de résultats d'une notice (« PCE 480 320 -33 % » : seuil, projet) ;
//  • données projet : Nom du projet, Typologie de rénovation / du bâtiment, Surface de plancher (SDP), label visé.
export function isBbcaRenovationCalculette(doc){
  const t=normalizeText(String(doc?.read?.text||'').slice(0,600000));
  return /Label\s+BBCA\s+R[ée]novation/i.test(t)&&/Eges\s*PCE/i.test(t)&&/P[ée]rim[eè]tre\s+de\s+la\s+r[ée]novation|Impact\s+carbone\s+du\s+lot\s+r[ée]nov/i.test(t);
}
const br_cells=l=>Array.isArray(l?.cells)?l.cells.map(c=>String(c??'').trim()):null;
export function workTypeFromLabel(v=''){
  const s=normalizeText(v).toLowerCase();
  if(/logements?\s+collectifs?|residentiel\s+collectif|habitation\s+collective|immeuble\s+collectif/.test(s)) return 'Logement collectif';
  if(/maisons?\s+individuelles?|logements?\s+individuels?|individuel/.test(s)) return 'Maison individuelle';
  if(/bureau/.test(s)) return 'Bureaux';
  if(/enseignement|scolaire|ecole/.test(s)) return 'Enseignement';
  return String(v).trim()||null;
}
// « Paris · Réaumur · bat. Cour » → { operation: « Paris · Réaumur », building: « Batiment Cour » }
function br_splitProject(name=''){
  const m=String(name).match(/^(.*?)[\s·_\-–,]+(?:bat(?:iment)?|bât(?:iment)?|immeuble)\.?\s*(?:sur\s+)?([A-Za-zÀ-ÿ0-9]+)\s*$/i);
  const clean=v=>String(v).replace(/\s+/g,' ').replace(/[\s·_\-–,]+$/,'').trim();
  return m?{operation:clean(m[1]),building:`Batiment ${m[2]}`}:{operation:clean(name),building:null};
}
const BR_EGES=[['pce','eges_pce'],['pcena','eges_pcena'],['energie','eges_energy'],['chantier','eges_site'],['eau','eges_water']];

export function parseBbcaRenovationCalculette(doc,occ,canonical=(s)=>s){
  const out=[]; const ss=doc.read?.kind==='spreadsheet';
  const all=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>{ const t=bb_lineText(line).replace(/^[^A-Za-z0-9]+/,'').replace(/\bEges\s*(?=[A-Za-z(])/gi,'Eges ').replace(/\s*\(/g,' ('); all.push({page,line,t,cells:br_cells(line)}); });
  const origin=`Calculette BBCA Rénovation (${ss?'classeur Excel':'PDF'})`;
  // Blocs par bâtiment : « Bâtiment sur rue : » (annexe de notice) ; sinon un seul bloc.
  const heads=[]; all.forEach((x,i)=>{ const m=x.t.match(/^Batiment\s+((?:sur\s+)?[A-Za-z0-9]+)\s*:\s*$/i); if(m&&all.slice(i+1,i+4).some(y=>/^Label\s+BBCA\s+Renovation/i.test(y.t))) heads.push({i,name:`Batiment ${m[1]}`}); });
  const blocks=heads.length?heads.map((h,k)=>({name:h.name,lines:all.slice(h.i,k+1<heads.length?heads[k+1].i:all.length)})):[{name:null,lines:all}];
  const fileB=(()=>{ const m=normalizeText(String(doc?.name||'')).match(/(?:^|[\s_\-])bat(?:iment)?[\s_.\-]+(?:sur[\s_]+)?([A-Za-z0-9]+?)(?:[\s_.\-]+v?\d|[\s_.\-]+PRO|\.|$)/i); return m?`Batiment ${m[1]}`:null; })();
  for(const blk of blocks){
    const lines=blk.lines;
    const after=(x,re)=>{ if(x.cells){ const i=x.cells.findIndex(c=>re.test(normalizeText(c).replace(/\s*\(/g,' ('))); const v=x.cells.slice(Math.max(0,i)+1).find(c=>c!==''); return v??null; } return x.t.replace(re,'').trim()||null; };
    const field=(re)=>{ const x=lines.find(l=>re.test(l.t)); if(!x) return null; const raw=after(x,re); return raw===null?{x,raw:''}:{x,raw:String(raw).trim()}; };
    const num=(re)=>{ const f=field(re); if(!f) return null; const v=f.x.cells?bb_num(f.raw.replace(/\s*\(.*$/,''),true):bb_value(f.x,false); return v===null?null:{x:f.x,v}; };
    const nom=field(/^Nom\s+du\s+projet\b/i);
    const split=br_splitProject(nom?.raw||'');
    const B=canonical(blk.name||split.building||fileB||'Bâtiment unique');
    const emit=(x,f,value,method,conf,unit='kgCO2e/m²',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,f,value,`calculette-bbca-reno:${method}`,conf,unit,{building:B,structuredPdf:true,origin,dedicatedRank:8,...extra}); if(o) out.push(o); };
    const admin={secondarySourceOk:true};
    // Données projet.
    if(nom&&split.operation) emit(nom.x,'operation_name',split.operation,'nom-projet',0.95,'',{...admin,building:'Bâtiment unique',provenanceNote:`« Nom du projet » de la calculette BBCA Rénovation : ${nom.raw}.`});
    const typo=field(/^Typologie\s+de\s+renovation\b/i); if(typo&&typo.raw) emit(typo.x,'renovation',typo.raw.replace(/^renovation\b/i,'Rénovation').replace(/\blegere\b/i,'légère'),'typologie-renovation',0.95,'',{...admin,provenanceNote:'« Typologie de rénovation » de la calculette BBCA Rénovation.'});
    const bat=field(/^Typologie\s+du\s+batiment\b/i); if(bat&&bat.raw) emit(bat.x,'work_type',workTypeFromLabel(bat.raw),'typologie-batiment',0.95,'',{...admin,provenanceNote:`« Typologie du bâtiment » : ${bat.raw}.`});
    const sdp=num(/^Surface\s+de\s+plancher(?:\s*\([^)]*\))?/i);
    if(sdp&&sdp.v>0&&sdp.v<200000) emit(sdp.x,'shab',sdp.v,'sdp',0.95,'m²',{...admin,provenanceNote:'Surface de plancher (SDP) : surface de référence des indicateurs de la calculette BBCA Rénovation.'});
    // Tableau des lots : colonne « Impact carbone du lot rénové ».
    const headIdx=lines.findIndex(l=>/Perimetre\s+de\s+la\s+renovation|Impact\s+carbone\s+du\s+lot\s+renov/i.test(l.t));
    const head=headIdx>=0?lines[headIdx]:null;
    const col=head?.cells?head.cells.findIndex(c=>/Impact\s+carbone\s+du\s+lot\s+renov/i.test(normalizeText(c))):-1;
    const countedCol=head?.cells?head.cells.findIndex(c=>/comptabilis/i.test(normalizeText(c))):-1;
    const lots={}, lotLines={}, counted={};
    if(headIdx>=0) for(let i=headIdx+1;i<lines.length;i++){
      const x=lines[i]; const m=x.t.match(/^Lot\s*0?(\d{1,2})\s*[.\-:]/i);
      if(!m){ if(Object.keys(lots).length>=12||/^(?:Eges|Indicateurs|Calcul)\b/i.test(x.t)) break; continue; }
      const lot=Number(m[1]); if(lot<1||lot>13) continue;
      let v=null, cnt=null;
      if(x.cells&&col>=0){ v=bb_num(x.cells[col],true); if(countedCol>=0) cnt=/^non$/i.test(x.cells[countedCol]||''); }
      else {
        const re=/(?:^|\s)(Oui|Non)\s+(-?\d+(?:[.,]\d+)?)(?:\s+(Oui|Non))?\s*$/i;
        let p=x.t.match(re); if(!p&&lines[i+1]&&!/^Lot\s*\d/i.test(lines[i+1].t)) p=lines[i+1].t.match(/^(Oui|Non)\s+(-?\d+(?:[.,]\d+)?)(?:\s+(Oui|Non))?\s*$/i);
        if(p){ v=parseFrNumber(p[2]); cnt=p[3]?/^non$/i.test(p[3]):null; }
      }
      if(v===null) continue;
      lots[lot]=v; lotLines[lot]=x; counted[lot]=cnt;
    }
    // Indicateurs Eges (valeur projet) et seuils (« … max »).
    const eg={};
    for(const [k,f] of [...BR_EGES,['','eges_total']]){
      const lab=k?`Eges\\s+${k}`:'Eges';
      const val=num(new RegExp(`^${lab}\\s*\\(`,'i')), max=num(new RegExp(`^${lab}\\s+max\\s*\\(`,'i'));
      if(val){ eg[f]=val.v; emit(val.x,f,val.v,`eges-${k||'total'}`,0.97,'kgCO2e/m²',{provenanceNote:`Calculette BBCA Rénovation (kg CO2 eq/m² SDP).`}); }
      if(max) emit(max.x,`${f}_max`,max.v,`eges-${k||'total'}-max`,0.95,'kgCO2e/m²',{provenanceNote:'Seuil BBCA Rénovation de la calculette (kg CO2 eq/m² SDP).'});
    }
    const lotSum=Object.entries(lots).filter(([k])=>counted[k]!==true).reduce((a,[,v])=>a+v,0);
    const pce=eg.eges_pce;
    const lotsOk=pce!==undefined&&Object.keys(lots).length>=10&&Math.abs(lotSum-pce)<=Math.max(2,pce*0.03);
    for(const [lot,v] of Object.entries(lots)) emit(lotLines[lot],`ic_lot_${lot}`,v,'lot-renove',0.95,'kgCO2e/m²',{provenanceNote:`Colonne « Impact carbone du lot rénové » (kg CO2 eq/m² SDP)${counted[lot]?' — lot non comptabilisé dans Eges PCE':''}.${pce!==undefined?` Σ lots ${Math.round(lotSum*100)/100} ${lotsOk?'≈':'≠'} Eges PCE ${pce}.`:''}`});
    // Tableau de résultats d'une notice : « PCE 480 320 -33 % » (seuil BBCA réno, projet).
    // Label visé.
    const lab=field(/^Label\s+BBCA\s+Renovation\s*:?/i);
    if(lab){ const pts=num(/^TOTAL\b/i); emit(lab.x,'mention_bbca','Oui','label-vise',0.95,'',{provenanceNote:`Calculette BBCA Rénovation — niveau : ${lab.raw||'non précisé'}${pts?` (${pts.v} points)`:''}.`}); }
  }
  // Notice ACV : tableaux « Résultats de l'ACV du bâtiment sur rue » (Seuil BBCA Réno | Projet | % gain).
  all.forEach((x,i)=>{
    const m=x.t.match(/^Resultats\s+de\s+l.?ACV\s+du\s+batiment\s+(.+?)\s*$/i); if(!m) return;
    const B=canonical(`Batiment ${m[1]}`);
    for(const y of all.slice(i+1,i+14)){
      const r=y.t.match(/^(PCE|PCENA|Energie|Eau|Chantier|Total)\s+([\d  ]+(?:[.,]\d+)?)\s+([\d  ]+(?:[.,]\d+)?)\s+(?:[-+]?\d+\s*%|OK)/i); if(!r) continue;
      const f=({pce:'eges_pce',pcena:'eges_pcena',energie:'eges_energy',eau:'eges_water',chantier:'eges_site',total:'eges_total'})[r[1].toLowerCase()];
      const seuil=parseFrNumber(r[2].replace(/[  ]/g,'')), projet=parseFrNumber(r[3].replace(/[  ]/g,''));
      if(out.some(o=>o.field===f&&o.building===B)) continue;
      const o1=occ(doc,y.page,y.line,f,projet,'notice-acv-reno:resultats',0.95,'kgCO2e/m²',{building:B,structuredPdf:true,origin:'Notice ACV BBCA Rénovation — résultats',provenanceNote:'Tableau de résultats ACV (projet, kg CO2 eq/m² SDP).'}); if(o1) out.push(o1);
      const o2=occ(doc,y.page,y.line,`${f}_max`,seuil,'notice-acv-reno:seuils',0.93,'kgCO2e/m²',{building:B,structuredPdf:true,origin:'Notice ACV BBCA Rénovation — résultats',provenanceNote:'Seuil BBCA Rénovation du tableau de résultats.'}); if(o2) out.push(o2);
    }
  });
  return out;
}

// Bâtiments d'une calculette BBCA Rénovation (blocs « Bâtiment sur rue : », « Nom du projet …bat. Cour », nom de fichier).
export function bbcaRenovationBuildingNames(doc,canonical=(s)=>s){
  const names=new Set(parseBbcaRenovationCalculette(doc,(d,p,l,field,v,m,c,u,extra)=>({field,building:extra?.building}),canonical).filter(o=>o&&o.field!=='operation_name').map(o=>o.building));
  return [...names];
}
