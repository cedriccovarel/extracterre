// v2.3.6 — Notice thermique RE2020 de bureau d'études avec tableaux de synthèse en colonnes par bâtiment :
//   « POSTE | BATIMENT CENTRAL | BATIMENT NORD | BATIMENT SUD » puis « BBIO 56,40 59,00 62,20 », « CEP_MAX … »,
//   « CEP,NR … », « ICENERGIE … », « GAIN … % » (selon le tableau), « Nombre total des logements 37 14 10 »,
//   « Surface habitable totale (Sref) 2521,3 m² … », DH par bâtiment (« GROUPE CHAUFFE 412,90 1250 »).
// Les colonnes sont associées aux bâtiments de l'en-tête, dans l'ordre : aucune valeur n'est recopiée d'un bâtiment à l'autre.
// Notice « label bâtiment biosourcé » : seule la démarche de labellisation est relevée (les tableaux FDES ne décrivent pas le projet).
import {normalizeText,parseFrNumber} from './utils.js';

const nt_lineText=l=>normalizeText(l?.text||'');
const nt_nums=s=>(String(s||'').match(/[-+]?\d+(?:[.,]\d+)?/g)||[]).map(x=>parseFrNumber(x)).filter(v=>v!==null);

export function isThermalNoticeColumns(doc){
  const t=String(doc?.read?.text||'').slice(0,400000);
  return /note\s*thermique|notice\s+thermique/i.test(t)&&/poste\s+batiment\s+\S+\s+batiment\s+\S+/i.test(t)&&/\bbbio\b/i.test(t);
}
export function isBiosourcedLabelNotice(doc){
  const t=String(doc?.read?.text||'').slice(0,200000);
  return /label\s+batiment\s+biosource/i.test(t)&&/masse\s+(?:de\s+)?(?:carbone\s+biogenique|matiere\s+biosourcee)/i.test(t);
}

function nt_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:nt_lineText(line)}));
  return out;
}
// En-tête « POSTE BATIMENT A BATIMENT B … » ou « BATIMENT A BATIMENT B … » (noms d'un mot).
function nt_header(t){
  const s=t.replace(/^POSTE\s+/i,'');
  if(!/^BATIMENT\s+\S+(?:\s+BATIMENT\s+\S+)+\s*$/i.test(s)) return null;
  return s.split(/\s*BATIMENT\s+/i).map(x=>x.trim()).filter(Boolean);
}
export function thermalNoticeBuildingNames(doc){
  for(const x of nt_allLines(doc)){ const h=nt_header(x.t); if(h&&h.length>=2) return h.map(n=>`Batiment ${n}`); }
  return [];
}

export function parseThermalNoticeColumns(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=nt_allLines(doc);
  const origin='Notice thermique RE2020 — tableaux de synthèse par bâtiment';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined) return; const o=occ(doc,x.page,x.line,field,value,`notice-thermique:${method}`,conf,unit,{building:canonical(`Batiment ${b}`),structuredPdf:true,origin,...extra}); if(o) out.push(o); };
  let names=null, table='', gainDone=new Set();
  const ROWS={
    bbio:[[/^BBIO\s/i,'bbio','points'],[/^BBIO_?MAX\s/i,'bbio_max','points'],[/^GAIN\s/i,'bbio_gain','%']],
    cep:[[/^CEP\s/i,'cep','kWhEP/m².an'],[/^CEP_?MAX\s/i,'cep_max','kWhEP/m².an'],[/^GAIN\s/i,'cep_gain','%'],[/^REFROIDISSEMENT\s/i,'cep_cooling','kWhEP/m².an'],[/^ECLAIRAGE\s/i,'cep_lighting','kWhEP/m².an'],[/^AUX\.?\s*DE\s+DISTRIBUTION\s/i,'cep_aux_dist','kWhEP/m².an'],[/^AUX\.?\s*DE\s+VENTILATION\s/i,'cep_aux_vent','kWhEP/m².an'],[/^ASCENSEUR/i,'cep_mobility','kWhEP/m².an']],
    cepnr:[[/^CEP\s*,\s*NR\s/i,'cepnr','kWhEP/m².an'],[/^CEP\s*,\s*NR_?MAX\s/i,'cepnr_max','kWhEP/m².an'],[/^GAIN\s/i,'cepnr_gain','%']],
    ic:[[/^ICENERGIE\s/i,'ic_energy','kgCO2e/m²'],[/^ICENERGIE_?MAX\s/i,'ic_energy_max','kgCO2e/m²']]
  };
  for(let i=0;i<lines.length;i++){
    const x=lines[i], t=x.t;
    if(/BESOINS\s+BIOCLIMATIQUES/i.test(t)) table='bbio';
    else if(/ENERGIE\s+PRIMAIRE\s+NON\s+RENOUVELABLE|\(CEP\s*,\s*NR/i.test(t)) table='cepnr';
    else if(/CONSOMMATIONS\s+D'ENERGIE\s+PRIMAIRE|\(CEP\s+EN/i.test(t)) table='cep';
    else if(/ICENERGIE\s+EN|CHANGEMENT\s+CLIMATIQUE\s+DES\s+CONSOMMATIONS/i.test(t)) table='ic';
    else if(/RESULTATS?\s+BBIO\s+RT\s*2012|PARTIE\s+COMMERCES/i.test(t)) table='';
    const h=nt_header(t); if(h&&h.length>=2){ names=h; continue; }
    if(!names||!table) continue;
    for(const [re,field,unit] of ROWS[table]){
      if(!re.test(t)) continue;
      if(field.endsWith('_gain')&&gainDone.has(field)) continue;
      const v=nt_nums(t.replace(re,' ')); if(v.length!==names.length) continue;
      names.forEach((n,k)=>emit(x,n,field,v[k],`${table}-colonnes`,0.97,unit));
      if(field.endsWith('_gain')) gainDone.add(field);
      break;
    }
  }
  // Données générales : « BATIMENT HABITATION COLLECTIVE CENTRAL NORD SUD » puis logements / Sref.
  const gi=lines.findIndex(x=>/^BATIMENT\s+HABITATION\s+COLLECTIVE\s+(.+)$/i.test(x.t));
  if(gi>=0){
    const cols=lines[gi].t.replace(/^BATIMENT\s+HABITATION\s+COLLECTIVE\s+/i,'').split(/\s+/).filter(Boolean);
    for(const x of lines.slice(gi+1,gi+8)){
      if(/^Nombre\s+total\s+des\s+logements/i.test(x.t)){ const v=nt_nums(x.t); if(v.length===cols.length) cols.forEach((n,k)=>emit(x,n,'housing_count',v[k],'logements-colonnes',0.97)); }
      if(/^Surface\s+habitable\s+totale/i.test(x.t)){ const v=nt_nums(x.t.replace(/^.*?\)/,'')); if(v.length===cols.length) cols.forEach((n,k)=>emit(x,n,'shab',v[k],'sref-colonnes',0.97,'m²')); }
    }
  }
  // DH : « BATIMENT X » seul sur sa ligne, puis lignes de groupes « … DH DH_MAX ✓ ».
  for(let i=0;i<lines.length;i++){
    const m=lines[i].t.match(/^BATIMENT\s+(\S+)\s*$/i); if(!m) continue;
    let worst=null;
    for(const y of lines.slice(i+1,i+12)){ if(/^BATIMENT\s+\S+\s*$/i.test(y.t)) break; const g=y.t.match(/^(.+?)\s+([\d.,]+)\s+(\d{3,4})\s*✓?\s*$/); if(g&&!/^DH\b|GROUPE\s+DH/i.test(y.t)){ const dh=parseFrNumber(g[2]),mx=Number(g[3]); if(dh!==null&&(!worst||dh>worst.dh)) worst={y,dh,mx,group:g[1]}; } }
    if(worst&&lines.slice(i+1,i+4).some(y=>/DH\s*\(/i.test(y.t))){ emit(worst.y,m[1],'dh',worst.dh,'dh-groupe',0.97,'°C.h',{provenanceNote:`Groupe : ${worst.group}.`}); emit(worst.y,m[1],'dh_max',worst.mx,'dh-max-groupe',0.97,'°C.h'); }
  }
  // Ventilation par bâtiment : « … hygroréglable type B … Localisation : tous les logements … bâtiment X ».
  lines.forEach((x,i)=>{
    const m=x.t.match(/^Localisation\s*:.*batiment\s+(\S+)\s*$/i); if(!m) return;
    const ctx=lines.slice(Math.max(0,i-8),i).map(y=>y.t).join(' ');
    const v=/hygro\w*\s+type\s+B/i.test(ctx)?'VMC Hygro B':/hygro\w*\s+type\s+A/i.test(ctx)?'VMC Hygro A':/double\s+flux/i.test(ctx)?'VMC double flux':/simple\s+flux|autoreglable/i.test(ctx)?'VMC simple flux':null;
    if(v&&/ventilation|VMC|extracteur/i.test(ctx)) emit(x,m[1],'ventilation',v,'ventilation-localisation',0.93);
  });
  return out;
}

export function parseBiosourcedLabelNotice(doc,occ){
  const lines=nt_allLines(doc);
  const x=lines.find(y=>/label\s+batiment\s+biosource/i.test(y.t)); if(!x) return [];
  const lvl=x.t.match(/niveau\s+(\d)\s+du\s+label\s+2012/i);
  const out=[occ(doc,x.page,x.line,'mention_biosourced_building','Oui','biosource:label-vise',0.92,'',{building:'Bâtiment unique',structuredPdf:true,origin:'Notice label bâtiment biosourcé',provenanceNote:'Estimation des quantités de matières biosourcées pour le label Bâtiment Biosourcé.'})];
  if(lvl) out.push(occ(doc,x.page,x.line,'biosourced_2013',`Niveau ${lvl[1]}`,'biosource:niveau-2012',0.88,'',{building:'Bâtiment unique',structuredPdf:true,origin:'Notice label bâtiment biosourcé',provenanceNote:`Objectif « niveau ${lvl[1]} du label 2012 » cité par la notice.`}));
  return out.filter(Boolean);
}
