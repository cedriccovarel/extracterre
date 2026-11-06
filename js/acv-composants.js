// ExtracTerre v2.20.6 — Export CSV d'étude carbone RE2020 « composant par composant » (un fichier par bâtiment,
// ex. « BATIMENT B.csv ») : en-tête « Designation;Valx;DetailsGES;NumFiche;Quantite;Unite;dureeVie;TypeFiche;CO2Inies;StockC… »,
// puis quatre contributeurs, chacun fermé par « Total contributeur : » :
//  • « Composants » : lots « 1-VRD » … « 13-Equipements de production locale d'électricité », total du lot sur « . Total : » ;
//  • « Energie (CE) » : sections Chauffage, Ecs, Refroidissement, Eclairage, Auxiliaires…, total sur « . Total : » ;
//  • « Eau (CRE) » et « Chantier (Cha) ».
// Valeurs lues en kg éq. CO2/m² (colonne EGES), uniquement celles écrites dans le fichier. Un contributeur « Chantier »
// à 0 avec toutes ses sections à 0 n'est pas un résultat (contributeur non renseigné dans l'export) : rien n'est repris.
import {parseFrNumber} from './utils.js';

const AC_COLS=/^designation$/i;
const ac_cells=l=>Array.isArray(l?.cells)?l.cells.map(c=>String(c??'').trim()):String(l?.text||'').split(' | ').map(c=>c.trim());
export function isAcvComponentsCsv(doc){
  const r=doc?.read; if(r?.kind!=='spreadsheet') return false;
  const c=ac_cells(r.pages?.[0]?.lines?.[0]); return AC_COLS.test(c[0]||'')&&c.some(x=>/^detailsges$/i.test(x))&&c.some(x=>/^numfiche$/i.test(x))&&c.some(x=>/^co2inies$/i.test(x));
}
export function acvComponentsBuildingName(doc){
  const m=String(doc?.name||'').replace(/\.[a-z0-9]+$/i,'').match(/\bbat(?:iment)?\.?[\s_-]*([A-Z0-9]{1,4})\b/i);
  return m?`Bâtiment ${m[1].toUpperCase()}`:'Bâtiment unique';
}
const AC_ENERGY=[[/^chauffage$/i,'ic_energy_heating'],[/^ecs$/i,'ic_energy_ecs'],[/^refroidissement$/i,'ic_energy_cooling'],[/^auxiliaires?\s+ventilat/i,'ic_energy_aux_vent'],[/^auxiliaires?\s+distribution/i,'ic_energy_aux_dist']];
const ac_num=s=>{ const v=parseFrNumber(String(s||'').replace(/\s+/g,'')); return Number.isFinite(v)?v:null; };

export function parseAcvComponentsCsv(doc,occ,canonical=s=>s){
  const out=[], page=doc.read.pages[0], B=canonical(acvComponentsBuildingName(doc));
  const emit=(line,field,value,method,conf,note)=>{ if(value===null) return; const o=occ(doc,page,line,field,value,`acv-csv:${method}`,conf,'kgCO2e/m²',{building:B,structuredPdf:true,provenanceNote:note,origin:'Export CSV étude carbone RE2020 (composants)'}); if(o) out.push(o); };
  let contrib='', section=null; const sections=[];
  for(const line of page.lines||[]){ const c=ac_cells(line), a=c[0]||'', b=c[1]||'';
    if(/^total\s+contributeur/i.test(b)){ sections.push({contrib,total:true,line,value:ac_num(c[2])}); section=null; continue; }
    if(/^\.?\s*total\s*:?$/i.test(b)){ if(section){ section.line=line; section.value=ac_num(c[2]); sections.push(section); } section=null; continue; }
    if(a&&/^eges$/i.test(c[2]||'')){ section={contrib,title:a}; continue; }
    if(a&&!b&&c.slice(1).every(x=>!x)&&!/^\d+\.\d+\s/.test(a)&&!section) contrib=/^composants?$/i.test(a)?'components':/^energie/i.test(a)?'energy':/^eau/i.test(a)?'water':/^chantier/i.test(a)?'site':contrib;
  }
  const of=k=>sections.filter(s=>s.contrib===k);
  // Composants : 13 lots + total ; contrôle Σ lots = total (sinon à vérifier).
  const comp=of('components'), lots=comp.filter(s=>!s.total&&/^(1[0-3]|[1-9])\s*-/.test(s.title)), compTotal=comp.find(s=>s.total);
  const sum=lots.reduce((t,s)=>t+(s.value||0),0), ok=compTotal&&compTotal.value!==null&&Math.abs(sum-compTotal.value)<=0.02*Math.max(1,compTotal.value);
  for(const s of lots){ const n=s.title.match(/^(\d+)/)[1]; emit(s.line,`ic_lot_${n}`,s.value,'lot',ok?0.95:0.82,`Lot « ${s.title} » : total du lot (colonne EGES).`); }
  if(compTotal) emit(compTotal.line,'ic_components',compTotal.value,'composants',ok?0.95:0.82,ok?`Total du contributeur Composants (= somme des ${lots.length} lots).`:'Total du contributeur Composants (la somme des lots ne le retrouve pas : à vérifier).');
  // Énergie : total et postes qui ont une colonne ExtracTerre.
  const en=of('energy'), enTotal=en.find(s=>s.total);
  if(enTotal) emit(enTotal.line,'ic_energy',enTotal.value,'energie',0.93,'Total du contributeur Énergie (CE).');
  for(const s of en.filter(s=>!s.total)){ const f=AC_ENERGY.find(([re])=>re.test(s.title.trim())); if(f) emit(s.line,f[1],s.value,'energie-poste',0.93,`Poste « ${s.title} » du contributeur Énergie.`); }
  // Chantier : repris seulement s'il est renseigné (au moins une section non nulle).
  const ch=of('site'), chTotal=ch.find(s=>s.total);
  if(chTotal&&ch.some(s=>!s.total&&s.value>0)) emit(chTotal.line,'ic_site',chTotal.value,'chantier',0.93,'Total du contributeur Chantier.');
  return out;
}
