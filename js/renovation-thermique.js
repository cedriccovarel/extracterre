// v2.3.11 — Études thermiques de rénovation (RT existant globale, méthode Th-C-E ex) :
//  • notice thermique de bureau d'études « RT-Ex » : tableau de résultats par bâtiment
//    (« Batiment sur cour : » … « Ubat initial Cep initial … Ubat projet Cep projet … » puis la ligne de valeurs),
//    tableaux de compositions avant / après par « Immeuble rue / cour » (parois verticales, toitures, planchers bas :
//    « … Fibre de bois Interieur 0,036 14 3,9 Oui Oui » = isolant, λ, épaisseur cm, R), systèmes décrits en clair ;
//  • rapport Pléiades « Résultats RT Existant suivant la méthode THCE - Ex » : Cep (initial / projet / référence),
//    Ubat, caractéristiques du projet, compositions de parois, baies, générateurs, ventilation ;
//  • plan de repérage des isolants : légende « Isolation par l'intérieur en fibre de bois: e=14 cm ; λ=0,036 et R=3,89 ».
// Les épaisseurs sont exprimées en mm (convention ExtracTerre), les R en m².K/W.
import {normalizeText,parseFrNumber,normalizeGlazingType} from './utils.js';
import {insulationName} from './donnees-techniques.js';

const rt_lineText=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim();
function rt_allLines(doc){ const out=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>out.push({page,line,t:rt_lineText(line)})); return out; }
const rt_nums=s=>(String(s||'').match(/[-+]?\d+(?:[.,]\d+)?/g)||[]).map(x=>parseFrNumber(x)).filter(v=>v!==null);
const INSUL_RE=/(fibre\s+de\s+bois|laine\s+de\s+bois|laine\s+de\s+roche|laine\s+de\s+verre|laine\s+minerale|ouate\s+de\s+cellulose|fibre\s+de\s+cellulose|coton\s+recycle|polyurethane|polystyrene(?:\s+extrude)?|\bPSE\b|\bXPS\b|\bPIR\b|\bPUR\b|chanvre|liege|paille)/i;
const rt_insul=s=>insulationName(s)||(/coton/i.test(s)?'Biosourcé chanvre/lin/coton':null);
const RT_F={wall:['wall_insulation','wall_insulation_thickness','wall_insulation_r'],roof:['roof_insulation','roof_insulation_thickness','roof_insulation_r'],floor:['floor_insulation','floor_insulation_thickness','floor_insulation_r']};

// ---------------------------------------------------------------------------------------------------------------------
// Notice thermique RT-Ex (bureau d'études)
export function isRtexThermalNotice(doc){
  const t=String(doc?.read?.text||'').slice(0,400000);
  return /notice\s+thermique/i.test(t)&&/RT[- ]?Ex\b|RT\s+existant/i.test(t)&&/Ubat\s+initial\s+Cep\s+initial/i.test(t);
}
export function rtexNoticeBuildingNames(doc){
  const names=[]; for(const x of rt_allLines(doc)){ const m=x.t.match(/^Batiment\s+((?:sur\s+)?[A-Za-z0-9]+)\s*:\s*$/i); if(m) names.push(`Batiment ${m[1]}`); }
  return [...new Set(names)];
}
export function parseRtexThermalNotice(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=rt_allLines(doc); const origin='Notice thermique RT existant (bureau d’études)';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`notice-rtex:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,dedicatedRank:10,...extra}); if(o) out.push(o); };
  const names=rtexNoticeBuildingNames(doc);
  // 1. Résultats par bâtiment : ligne de valeurs sous l'en-tête « Ubat initial Cep initial … Ubat projet Cep projet … ».
  let cur=null;
  lines.forEach((x,i)=>{
    const m=x.t.match(/^Batiment\s+((?:sur\s+)?[A-Za-z0-9]+)\s*:\s*$/i); if(m){ cur=`Batiment ${m[1]}`; return; }
    if(!cur||!/Ubat\s+initial\s+Cep\s+initial/i.test(x.t)) return;
    const projHead=/Ubat\s+projet\s+Cep\s+projet/i.test(x.t);
    for(const y of lines.slice(i+1,i+6)){
      if(/[a-z]{3}/i.test(y.t.replace(/W\/\(m²\.K\)|kWhEP\/m²|kgeqCO2\/m²\.an/gi,''))) continue;
      const v=rt_nums(y.t); if(v.length<4) continue;
      const note={provenanceNote:`Tableau « Etat initial / Résultats projet » de la notice (${v.length} colonnes).`};
      emit(y,cur,'ubat_before',v[0],'ubat-initial',0.95,'W/m².K',note); emit(y,cur,'cep_before',v[1],'cep-initial',0.95,'kWhEP/m².an',note);
      if(projHead&&v.length>=6){ const k=v.length; emit(y,cur,'ubat_after',v[k-3],'ubat-projet',0.95,'W/m².K',note); emit(y,cur,'cep_after_final',v[k-2],'cep-projet',0.95,'kWhEP/m².an',note); }
      break;
    }
  });
  // 2. Compositions par « Immeuble rue / cour » (sections « > Parois verticales », « > Toitures », « > Planchers bas »).
  let section='', bld=null; const best={};
  for(const x of lines){
    if(/^>\s*Parois\s+verticales/i.test(x.t)) section='wall'; else if(/^>\s*Toitures/i.test(x.t)) section='roof'; else if(/^>\s*Planchers\s+bas/i.test(x.t)) section='floor'; else if(/^>\s*Planchers\s+intermediaires/i.test(x.t)) section='mid';
    else if(/^Dormant\b|^Ouvertures\b/i.test(x.t)) section='';
    const ib=x.t.match(/^Immeuble\s+(rue|cour|[A-Z0-9]{1,3})\b/i); if(ib) bld=`Batiment ${ib[1]}`;
    if(!section||section==='mid'||!bld) continue;
    const r=x.t.match(new RegExp(INSUL_RE.source+'\\s+(?:Interieur|Exterieur|ITI|ITE|ITR)?\\s*(0[.,]\\d{2,3})\\s+(\\d{1,3}(?:[.,]\\d)?)\\s+(\\d{1,2}[.,]\\d{1,2})','i'));
    if(!r) continue;
    const type=rt_insul(r[1]); if(!type) continue;
    // Parois verticales : seules les parois donnant sur l'extérieur décrivent l'isolation des façades.
    if(section==='wall'&&!/\bExterieur\b/i.test(x.t)) continue;
    (best[`${bld}|${section}`]=best[`${bld}|${section}`]||[]).push({x,type,e:parseFrNumber(r[3]),R:parseFrNumber(r[4])});
  }
  // Parois : épaisseur la plus fréquente ; toiture : la plus forte ; plancher bas : la première isolée.
  const pickers={wall:a=>{ const c={}; a.forEach(z=>c[z.e]=(c[z.e]||0)+1); const e=Object.entries(c).sort((p,q)=>q[1]-p[1]||q[0]-p[0])[0][0]; return a.find(z=>String(z.e)===e); },roof:a=>[...a].sort((p,q)=>q.e-p.e)[0],floor:a=>a[0]};
  for(const [key,arr] of Object.entries(best)){
    const [b,sec]=key.split('|'); const z=pickers[sec](arr);
    const note={provenanceNote:`Composition projetée (${arr.length} paroi(s) isolée(s) de ce type dans le tableau) : ${z.type}, ${z.e} cm, R = ${z.R}.`};
    emit(z.x,b,RT_F[sec][0],z.type,`${sec}-isolant`,0.93,'',note); emit(z.x,b,RT_F[sec][1],Math.round(z.e*10),`${sec}-epaisseur`,0.92,'mm',note); emit(z.x,b,RT_F[sec][2],z.R,`${sec}-r`,0.92,'m².K/W',note);
  }
  // 3. Menuiseries et systèmes (texte, communs aux bâtiments de la notice).
  const text=lines.map(x=>x.t).join('\n'); const targets=names.length?names:['Bâtiment unique'];
  const common=(field,value,re,method,conf=0.9)=>{ const x=lines.find(y=>re.test(y.t)); if(!x) return; for(const b of targets) emit(x,b,field,value,method,conf,'',{provenanceNote:'Disposition décrite par la notice pour les bâtiments du projet.'}); };
  if(/cadre\s+bois/i.test(text)) common('window_material','Bois',/cadre\s+bois/i,'menuiseries',0.9);
  if(/double\s+vitrage/i.test(text)) common('window_glazing','Double vitrage',/double\s+vitrage/i,'vitrage',0.88);
  const vmc=text.match(/VMC\s+simple\s+flux[^.\n]{0,30}?hygro\s*([AB])\b|VMC\s+(double\s+flux)|VMC\s+(simple\s+flux)/i);
  if(vmc) common('ventilation',vmc[1]?`VMC Hygro ${vmc[1].toUpperCase()}`:vmc[2]?'VMC double flux':'VMC simple flux',/VMC\s+(?:simple|double)\s+flux/i,'ventilation',0.93);
  if(/(?:chauffage\s+par|assures?\s+par)\s+(?:des\s+)?radiateurs?\s+electriques|radiateurs?\s+electriques?\s+connectes/i.test(text)){ common('heating_mode_after','Chauffage électrique direct',/radiateurs?\s+electriques/i,'chauffage',0.92); common('heating_vector_after','Électricité',/radiateurs?\s+electriques/i,'chauffage-vecteur',0.92); }
  if(/ballons?\s+(?:electriques?\s+)?a\s+accumulation/i.test(text)&&/tout\s+electrique|ballons?\s+electriques?|Chauffeo/i.test(text)){ common('ecs','Ballon électrique',/ballons?\s+(?:electriques?\s+)?a\s+accumulation/i,'ecs',0.9); common('ecs_vector_after','Électricité',/ballons?\s+(?:electriques?\s+)?a\s+accumulation/i,'ecs-vecteur',0.9); }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Rapport Pléiades RT existant (Th-C-E ex)
export function isPleiadesRtexReport(doc){
  const t=String(doc?.read?.text||'').slice(0,400000);
  return /Resultats\s+RT\s+Existant\s+suivant\s+la\s+methode\s+TH-?C-?E\s*-?\s*Ex/i.test(t);
}
function rt_fileBuilding(doc){
  const n=normalizeText(String(doc?.name||'')).replace(/[_\-.]+/g,' ');
  const m=n.match(/\b(?:batiment|bat)\s+(?:sur\s+)?([A-Za-z0-9]+)\b/i); return m&&!/^(?:pdf|rapport)$/i.test(m[1])?`Batiment ${m[1]}`:null;
}
export function pleiadesRtexBuildingNames(doc){
  const raw=[]; for(const x of rt_allLines(doc)){ const m=x.t.match(/^1\.\d+\s+(Batiment\s+.+)$/i); if(m) raw.push(m[1].trim()); }
  const uniq=[...new Set(raw)]; const fb=rt_fileBuilding(doc);
  // Un seul bâtiment numéroté par défaut (« Batiment 1 ») : le nom de fichier (« … batiment cour ») est plus parlant.
  if(uniq.length<=1&&fb&&(!uniq.length||/^Batiment\s+1$/i.test(uniq[0]))) return [fb];
  return uniq.length?uniq:(fb?[fb]:[]);
}
export function parsePleiadesRtexReport(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=rt_allLines(doc); const origin='Pléiades — résultats RT existant (Th-C-E ex)';
  const names=pleiadesRtexBuildingNames(doc); const B=canonical(names[0]||'Bâtiment unique');
  const emit=(x,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`pleiades-rtex:${method}`,conf,unit,{building:B,structuredPdf:true,origin,dedicatedRank:6,...extra}); if(o) out.push(o); };
  const find=re=>lines.find(x=>re.test(x.t));
  // Cep : « Coefficient Cep 171.5 » (projet) ; ligne « kWh ep/m² [initial] projet référence max ».
  const coef=find(/^Coefficient\s+Cep\s+[\d.,]+/i); const cepP=coef?rt_nums(coef.t)[0]:null;
  if(coef&&cepP!==null) emit(coef,'cep_after_final',cepP,'cep-projet',0.97,'kWhEP/m².an',{provenanceNote:'« Coefficient Cep » du projet après travaux.'});
  // v2.3.12 — d'après les surlignages du journal : Cep projet aussi en « Cep », « Cep max 149.5 kWh ep/m² » (exigence
  // du label visé), étiquettes équivalentes « Energie : Classe equivalente D » / « CO2 : Classe equivalente A ».
  if(coef&&cepP!==null) emit(coef,'cep',cepP,'cep',0.94,'kWhEP/m².an');
  { const cm=find(/^Cep\s+max\s+[\d.,]+\s*kWh/i); if(cm) emit(cm,'cep_max',rt_nums(cm.t)[0],'cep-max',0.92,'kWhEP/m².an',{provenanceNote:'« Cep max » de la page de conformité (exigence du label / de la RT existant).'}); }
  { const de=find(/^Energie\s*:\s*Classe\s+equivalente\s+([A-G])\b/i); if(de) emit(de,'dpe_energy_after',de.t.match(/Classe\s+equivalente\s+([A-G])/i)[1].toUpperCase(),'etiquette-energie',0.9,'',{provenanceNote:'Étiquette énergie équivalente après travaux (Pléiades).'}); }
  { const dg=find(/^CO2\s*:\s*Classe\s+equivalente\s+([A-G])\b/i); if(dg) emit(dg,'dpe_ges_after',dg.t.match(/Classe\s+equivalente\s+([A-G])/i)[1].toUpperCase(),'etiquette-co2',0.9,'',{provenanceNote:'Étiquette CO2 équivalente après travaux (Pléiades).'}); }
  const row=find(/^kWh\s*ep\/m²?\s+[\d.,]+\s+[\d.,]+/i);
  if(row&&cepP!==null){ const v=rt_nums(row.t.replace(/m²|m2/g,'')); const k=v.indexOf(cepP); if(k>0) emit(row,'cep_before',v[k-1],'cep-initial',0.95,'kWhEP/m².an',{provenanceNote:'Colonne « Cep initial » du tableau des résultats.'}); }
  // Ubat : « Ubat (hiver) W/m2.K [initial] projet référence ».
  const ub=find(/^Ubat\s*\(hiver\)/i);
  if(ub){ const v=rt_nums(ub.t.replace(/W\/m2\.K/i,'')).filter(x=>x<10); if(v.length>=2){ emit(ub,'ubat_after',v[v.length-2],'ubat-projet',0.96,'W/m².K',{provenanceNote:'Ubat projet (colonne « Projet », la dernière valeur étant la référence).'}); if(v.length>=3) emit(ub,'ubat_before',v[v.length-3],'ubat-initial',0.93,'W/m².K'); } }
  // Caractéristiques du projet.
  const dep=find(/^Departement\s*:?\s*(\d{2,3}|2A|2B)\s*-/i); if(dep) emit(dep,'department',dep.t.match(/(\d{2,3}|2A|2B)\s*-/i)[1].padStart(2,'0'),'departement',0.97,'',{building:'Bâtiment unique'});
  const yr=find(/^Annee\s+de\s+construction\s+\d{4}/i); if(yr){ const y=rt_nums(yr.t)[0]; if(y>=1500&&y<=2100) emit(yr,'construction_year',y,'annee',0.95); }
  const lg=find(/^Nombre\s+de\s+logements\s+\d+/i); if(lg) emit(lg,'housing_count',rt_nums(lg.t)[0],'logements',0.95);
  const sh=find(/^Surface\s+habitable\s+en\s+residentiel/i); if(sh){ const v=rt_nums(sh.t)[0]; if(v>0) emit(sh,'shab',v,'shab',0.95,'m²',{provenanceNote:'Surface habitable (groupe) de l’étude RT existant.'}); }
  // Compositions : paroi (« Type de paroi Paroi verticale / Plancher haut / Plancher bas ») puis couche isolante
  // « Fibre de bois 036 14.0 0.036 140 0.583 0.26 3.89 » (épaisseur cm, λ, ρ, Cs, U, R).
  let type=null, nature=''; const comp={};
  for(const x of lines){
    let m;
    if((m=x.t.match(/^Type\s+de\s+paroi\s+(Paroi\s+verticale|Plancher\s+haut|Plancher\s+bas|Toiture)/i))){ type=/verticale/i.test(m[1])?'wall':/bas/i.test(m[1])?'floor':'roof'; nature=''; continue; }
    if(/^Type\s+de\s+paroi\b/i.test(x.t)){ type=null; continue; }
    if((m=x.t.match(/^Nature\s+de\s+paroi\s+(.*)$/i))){ nature=m[1]; continue; }
    if(!type) continue;
    const r=x.t.match(/^(.+?)\s+(\d{1,3}(?:\.\d)?)\s+(0\.0\d{1,3})\s+\d+\s+[\d.]+\s+[\d.]+\s+([\d.]+)\s*$/);
    if(!r||!INSUL_RE.test(r[1])) continue;
    if(type==='wall'&&nature&&!/mur\s+exterieur/i.test(nature)) continue;
    const name=rt_insul(r[1]); if(!name) continue;
    (comp[type]=comp[type]||[]).push({x,name,e:Number(r[2]),R:Number(r[4])});
  }
  for(const [k,arr] of Object.entries(comp)){
    const cnt={}; arr.forEach(z=>cnt[`${z.name}|${z.e}`]=(cnt[`${z.name}|${z.e}`]||0)+1);
    const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]||Number(b[0].split('|')[1])-Number(a[0].split('|')[1]))[0][0]; const z=arr.find(y=>`${y.name}|${y.e}`===top);
    const note={provenanceNote:`Bibliothèque de parois du projet : ${z.name} ${z.e} cm (R = ${z.R}) — composition la plus fréquente (${cnt[top]}/${arr.length}).`};
    emit(z.x,RT_F[k][0],z.name,`${k}-isolant`,0.94,'',note); emit(z.x,RT_F[k][1],Math.round(z.e*10),`${k}-epaisseur`,0.93,'mm',note); emit(z.x,RT_F[k][2],z.R,`${k}-r`,0.93,'m².K/W',note);
  }
  // Baies.
  const cadre=find(/^Type\s+de\s+cadre\s+\S/i); if(cadre){ const s=cadre.t.replace(/^Type\s+de\s+cadre\s+/i,''); const v=/pvc/i.test(s)?'PVC':/bois.*alu|alu.*bois|mixte/i.test(s)?'Bois-aluminium':/alu/i.test(s)?'Aluminium':/bois/i.test(s)?'Bois':null; if(v) emit(cadre,'window_material',v,'cadre',0.94); }
  // Premier vitrage réellement décrit (les portes portent « Nom codifié sans objet »).
  for(const code of lines.filter(x=>/^Nom\s+codifie\s+\S/i.test(x.t))){ const g=normalizeGlazingType(code.t.replace(/^Nom\s+codifie\s+/i,'')); if(g){ emit(code,'window_glazing',g,'vitrage',0.94); break; } }
  const prot=find(/^Protection\s+(?!solaire)\S/i); if(prot&&!/pas\s+de\s+protection/i.test(prot.t)){ const s=prot.t; const v=/volet\s+roulant/i.test(s)?'Volet roulant':/brise|bso|venitien/i.test(s)?'BSO':/store/i.test(s)?'Store':/battant|persienne/i.test(s)?'Volet battant':null; if(v) emit(prot,'window_shading',v,'protection',0.92); }
  // Systèmes.
  const gen=lines.findIndex(x=>/^Generation\s+\d+\s+\(Volume\s+chauffe/i.test(x.t));
  if(gen>=0){ const blk=lines.slice(gen,gen+25).map(x=>x.t).join(' ');
    if(/effet\s+joule|panneau\s+rayonnant/i.test(blk)){ emit(lines[gen],'heating_mode_after','Chauffage électrique direct','generation',0.94); emit(lines[gen],'heating_vector_after','Électricité','generation-vecteur',0.94); }
    else if(/pompe\s+a\s+chaleur|\bPAC\b/i.test(blk)) emit(lines[gen],'heating_mode_after','PAC','generation',0.88);
    else if(/chaudiere\s+gaz|condensation/i.test(blk)) emit(lines[gen],'heating_mode_after','Chaudière condensation','generation',0.88);
    if(/Ballon|Stockage-Generation|Chauffe-?eau/i.test(blk)&&/effet\s+joule/i.test(blk)){ emit(lines[gen],'ecs','Ballon électrique','ecs',0.92); emit(lines[gen],'ecs_vector_after','Électricité','ecs-vecteur',0.92); }
  }
  const ven=find(/^Nouveau\s+systeme\s+de\s+ventilation\b/i)||find(/^Systeme\s+de\s+ventilation\s+(?!initiale)\S/i);
  if(ven){ const s=ven.t; const v=/double\s+flux/i.test(s)?'VMC double flux':/hygro\w*\s*B/i.test(s)?'VMC Hygro B':/hygro\w*\s*A/i.test(s)?'VMC Hygro A':/simple\s+flux/i.test(s)?'VMC simple flux':null; if(v) emit(ven,'ventilation',v,'ventilation',0.93); }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Plan de repérage des isolants (légende)
export function isInsulationMarkupPlan(doc){
  const t=String(doc?.read?.text||'').slice(0,100000);
  return /rep[eé]rage\s+des\s+isolants/i.test(t)&&/Isolation\s+[^:\n]{0,80}:\s*e\s*=\s*\d/i.test(t);
}
export function parseInsulationMarkupPlan(doc,occ){
  const out=[]; const lines=rt_allLines(doc); const origin='Plan de repérage des isolants (légende)';
  let group=''; const items=[];
  for(const x of lines){
    if(/^Isolants?\s+verticaux/i.test(x.t)){ group='wall'; continue; }
    if(/^Isolants?\s+horizontaux/i.test(x.t)){ group='h'; continue; }
    const m=x.t.match(/^Isolation\s+(.+?)\s+en\s+(.+?)\s*:\s*e\s*=\s*(\d+(?:[.,]\d+)?)\s*cm.*?R\s*=\s*(\d+(?:[.,]\d+)?)/i); if(!m) continue;
    const where=normalizeText(m[1]).toLowerCase();
    const kind=/toiture|comble|rampant/.test(where)?'roof':/plancher/.test(where)?'floor':(group==='wall'||/mur|vertical/.test(where))?'wall':null;
    const name=rt_insul(m[2]); if(!kind||!name) continue;
    items.push({x,kind,name,e:parseFrNumber(m[3]),R:parseFrNumber(m[4])});
  }
  for(const kind of ['wall','roof','floor']){
    const arr=items.filter(z=>z.kind===kind); if(!arr.length) continue;
    // Parois verticales et toitures : l'isolation principale est la plus épaisse ; plancher bas : la première citée.
    const z=kind==='floor'?arr[0]:[...arr].sort((a,b)=>b.e-a.e)[0];
    const others=arr.length>1?` Autres isolants repérés : ${arr.filter(y=>y!==z).map(y=>`${y.name} ${y.e} cm`).join(', ')}.`:'';
    const note={provenanceNote:`Légende du plan : ${z.name}, e = ${z.e} cm, R = ${z.R}.${others}`};
    const emit=(f,v,unit,conf)=>{ const o=occ(doc,z.x.page,z.x.line,f,v,`isolants-plan:${kind}`,conf,unit,{building:'Bâtiment unique',structuredPdf:true,origin,dedicatedRank:20,...note}); if(o) out.push(o); };
    emit(RT_F[kind][0],z.name,'',0.9); emit(RT_F[kind][1],Math.round(z.e*10),'mm',arr.length>1?0.86:0.9); emit(RT_F[kind][2],z.R,'m².K/W',arr.length>1?0.86:0.9);
  }
  return out;
}
