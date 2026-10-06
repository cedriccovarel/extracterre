// v2.3.5 — « Sortie logiciel – Partie thermique » de Pléiades (IZUBA) : rapport RE2020 multi-bâtiments.
// Structure : « 1 Résultats RE2020 Energie » puis une section « 1.N <bâtiment> » par bâtiment
// (Bbio, Cep, Cep,nr, Ic énergie : valeur projet + max ; postes ; DH par groupe), puis
// « 5 Caractéristiques du projet » avec « 5.N <bâtiment> » (SRT déclarée, nombre de logements).
// Les noms de bâtiments sont repris des titres de section, jamais des lignes de tableau.
import {normalizeText,parseFrNumber} from './utils.js';

const pl_N='([-+]?\\d+(?:[\\s\\u00a0]\\d{3})*(?:[.,]\\d+)?)';
const pl_num=v=>{ const n=parseFrNumber(String(v??'').replace(/[\s ]/g,'')); return n===null?null:n; };
const pl_lineText=l=>normalizeText(l?.text||'');

export function isPleiadesThermalOutput(doc){
  const t=String(doc?.read?.text||'').slice(0,400000);
  return /pleiades\s*,?\s*version/i.test(t)&&/resultats\s+re2020\s+energie/i.test(t)&&/exigence\s+de\s+resultat\s*:\s*bbio/i.test(t);
}

function pl_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:pl_lineText(line)}));
  return out;
}
const pl_titleName=raw=>{ const s=String(raw||'').trim(); return /^batiment\b/i.test(s)?s.replace(/^batiment/i,'Bâtiment'):s; };

// Sections « 1.N Nom » (résultats) et « 5.N Nom » (caractéristiques), dans l'ordre du document.
export function pleiadesThermalSections(doc){
  const lines=pl_allLines(doc); const res=[]; const car=[];
  let chapter=null;
  lines.forEach((x,i)=>{
    const ch=x.t.match(/^(\d)\s+[A-Z]/); if(ch&&!/^\d\s+\d/.test(x.t)) chapter=Number(ch[1]);
    const m=x.t.match(/^([15])\.(\d{1,2})\s+(.{2,60})$/); if(!m) return;
    if(/[.]{4,}|\d+\s*$/.test(m[3])) return; // sommaire
    const name=pl_titleName(m[3]);
    if(m[1]==='1'&&chapter===1) res.push({index:i,name,pl_num:Number(m[2]),page:x.page.page});
    if(m[1]==='5'&&chapter===5&&!/^environnement$/i.test(m[3])) car.push({index:i,name,pl_num:Number(m[2]),page:x.page.page});
  });
  return {lines,res,car};
}
export function pleiadesThermalBuildingNames(doc){ const {res}=pleiadesThermalSections(doc); return [...new Set(res.map(s=>s.name))]; }

export function parsePleiadesThermalOutput(doc,occ,canonical=(s)=>s){
  const out=[]; const {lines,res,car}=pleiadesThermalSections(doc);
  const origin='Pléiades — sortie logiciel RE2020 (partie thermique)';
  const emit=(x,building,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`pleiades-sortie:${method}`,conf,unit,{building:canonical(building),structuredPdf:true,origin,...extra}); if(o) out.push(o); };
  const endOfChapter1=lines.findIndex(x=>/^2\s+Synthese\s+de\s+l'enveloppe/i.test(x.t));

  res.forEach((sec,k)=>{
    const end=k+1<res.length?res[k+1].index:(endOfChapter1>0?endOfChapter1:lines.length);
    const block=lines.slice(sec.index,end);
    const b=sec.name;
    const pair=(re)=>{ const x=block.find(l=>re.test(l.t)); if(!x) return null; const m=x.t.match(re); return {x,v:pl_num(m[1]),max:m[2]!==undefined?pl_num(m[2]):null}; };
    const bbio=pair(new RegExp(`^Besoins\\s+Bioclimatique\\s+${pl_N}\\s*points\\s+${pl_N}\\s*points`,'i'));
    if(bbio){ emit(bbio.x,b,'bbio',bbio.v,'bbio',0.995,'points'); emit(bbio.x,b,'bbio_max',bbio.max,'bbio-max',0.995,'points'); }
    const cepnr=pair(new RegExp(`^Consommation\\s+energie\\s+Primaire\\s+non\\s+renouvelable\\s+${pl_N}\\s*kWh\\s*EP\\/m²?2?\\s+${pl_N}`,'i'));
    const cep=pair(new RegExp(`^Consommation\\s+energie\\s+Primaire\\s+${pl_N}\\s*kWh\\s*EP\\/m²?2?\\s+${pl_N}`,'i'));
    if(cep){ emit(cep.x,b,'cep',cep.v,'cep',0.995,'kWhEP/m².an'); emit(cep.x,b,'cep_max',cep.max,'cep-max',0.995,'kWhEP/m².an'); }
    if(cepnr){ emit(cepnr.x,b,'cepnr',cepnr.v,'cepnr',0.995,'kWhEP/m².an'); emit(cepnr.x,b,'cepnr_max',cepnr.max,'cepnr-max',0.995,'kWhEP/m².an'); }
    const ic=pair(new RegExp(`^Indice\\s+Carbone\\s+Energie\\s+${pl_N}\\s*kg\\s*eq\\.?\\s*CO2\\s+${pl_N}`,'i'));
    if(ic){ emit(ic.x,b,'ic_energy',ic.v,'ic-energie',0.995,'kgCO2e/m²'); emit(ic.x,b,'ic_energy_max',ic.max,'ic-energie-max',0.995,'kgCO2e/m²'); }

    // Postes du Cep (premier bloc « Consommations de … » qui précède le total Cep, pas celui du Cep,nr).
    const cepIdx=cep?block.indexOf(cep.x):-1;
    if(cepIdx>0){
      const start=block.slice(0,cepIdx).map(l=>/^Exigence\s+de\s+resultat\s*:\s*Cep\b/i.test(l.t)).lastIndexOf(true);
      const posts=block.slice(Math.max(0,start),cepIdx);
      const map=[[/^Consommations\s+de\s+climatisation\s+/i,'cep_cooling'],[/^Consommations\s+d'eclairage\s+/i,'cep_lighting'],[/^Consommations\s+des\s+auxiliaires\s+de\s+ventilation\s+/i,'cep_aux_vent'],[/^Consommations\s+des\s+auxiliaires\s+hydrauliques\s+/i,'cep_aux_dist'],[/^Consommations\s+de\s+mobilite\s+interne\s+/i,'cep_mobility']];
      for(const [re,field] of map){ const x=posts.find(l=>re.test(l.t)); if(!x) continue; const m=x.t.replace(re,'').match(new RegExp(`^${pl_N}\\s*kWh`,'i')); if(m) emit(x,b,field,pl_num(m[1]),'cep-poste',0.99,'kWhEP/m².an'); }
    }
    // Postes Ic énergie (kg éq.CO2/m²).
    const icMap=[[/^IC\s+chauffage\s+/i,'ic_energy_heating'],[/^IC\s+climatisation\s+/i,'ic_energy_cooling'],[/^IC\s+ECS\s+/i,'ic_energy_ecs'],[/^IC\s+auxiliaires\s+de\s+ventilation\s+/i,'ic_energy_aux_vent'],[/^IC\s+auxiliaires\s+hydrauliques\s+/i,'ic_energy_aux_dist'],[/^IC\s+mobilite\s+interne\s+/i,'ic_energy_mobility']];
    for(const [re,field] of icMap){ const x=block.find(l=>re.test(l.t)); if(!x) continue; const m=x.t.replace(re,'').match(new RegExp(`^${pl_N}\\s*kg`,'i')); if(m) emit(x,b,field,pl_num(m[1]),'ic-poste',0.99,'kgCO2e/m²'); }

    // DH : groupe le plus défavorable de la section, avec son DH max.
    const dhStart=block.findIndex(l=>/^Exigence\s+de\s+resultat\s*:\s*Degres-?Heures/i.test(l.t));
    if(dhStart>=0){
      let worst=null;
      for(const l of block.slice(dhStart+1)){ const m=l.t.match(new RegExp(`^(.+?)\\s+${pl_N}\\s*°C\\.h\\s+${pl_N}\\s*°C\\.h\\s*$`,'i')); if(!m) { if(worst&&/^Exigences\s+de\s+moyens/i.test(l.t)) break; continue; } const v=pl_num(m[2]),mx=pl_num(m[3]); if(v!==null&&(!worst||v>worst.v)) worst={x:l,v,mx,group:m[1]}; }
      if(worst){ const note=`Groupe le plus défavorable : ${worst.group}.`; emit(worst.x,b,'dh',worst.v,'dh-worst-group',0.99,'°C.h',{provenanceNote:note}); emit(worst.x,b,'dh_max',worst.mx,'dh-max-worst-group',0.99,'°C.h',{provenanceNote:note}); }
    }
  });

  // Caractéristiques par bâtiment (chapitre 5).
  car.forEach((sec,k)=>{
    const end=k+1<car.length?car[k+1].index:lines.length;
    const block=lines.slice(sec.index,end); const b=sec.name;
    const srt=block.find(l=>new RegExp(`^SRT\\s+declaree\\s+${pl_N}\\s*m`,'i').test(l.t));
    if(srt) emit(srt,b,'shab',pl_num(srt.t.match(new RegExp(`^SRT\\s+declaree\\s+${pl_N}`,'i'))[1]),'srt-declaree',0.97,'m²',{provenanceNote:'SRT déclarée du bâtiment (chapitre 5).'});
    const lg=block.find(l=>/^Nombre\s+de\s+logements?\s+\d+/i.test(l.t));
    if(lg) emit(lg,b,'housing_count',Number(lg.t.match(/(\d+)\s*$/)?.[1]),'nombre-logements',0.97);
    const clim=block.filter(l=>/^Climatisation\s+(?:Oui|Non)\b/i.test(l.t));
    if(clim.length){ const on=clim.filter(l=>/^Climatisation\s+Oui/i.test(l.t)); emit(on[0]||clim[0],b,'cooling',on.length?'Climatisation active':'Aucun','groupes-climatisation',on.length?0.9:0.95,'',{provenanceNote:`${clim.length} groupe(s) : ${on.length} climatisé(s).`}); }
  });

  const dep=lines.find(x=>/^Departement\s*:\s*(\d{2,3}|2A|2B)\s*-/i.test(x.t));
  if(dep){ const d=dep.t.match(/^Departement\s*:\s*(\d{2,3}|2A|2B)/i)[1].padStart(2,'0'); const o=occ(doc,dep.page,dep.line,'department',d,'pleiades-sortie:department',0.97,'',{building:'Bâtiment unique',structuredPdf:true,origin}); if(o) out.push(o); }
  return out;
}
