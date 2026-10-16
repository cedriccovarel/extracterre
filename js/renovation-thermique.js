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
  // Tic : « Exigence de resultat : Tic » puis « Groupe 1 22.93 °C 33.69 °C » (projet, référence).
  { const i=lines.findIndex(x=>/^Exigence\s+de\s+resultat\s*:\s*Tic\b/i.test(x.t));
    const g=i<0?null:lines.slice(i+1,i+6).find(x=>/^Groupe\s+\d+\s+[\d.]+\s*°C\s+[\d.]+\s*°C/i.test(x.t));
    if(g){ const [a,r]=rt_nums(g.t.replace(/^Groupe\s+\d+/i,'')); if(a>=15&&a<=45){ emit(g,'tic',a,'tic',0.95,'°C'); emit(g,'tic_ref',r,'tic-ref',0.95,'°C'); } } }
  // Postes du Cep projet : « Decomposition du Cep (hors prod. ENR) Projet: 72.77 » puis « Eclairage (5.8kWh/m², 8%) ».
  const poste={};
  { const i=lines.findIndex(x=>/^Decomposition\s+du\s+Cep\b.*\bProjet\s*:/i.test(x.t));
    if(i>=0) for(const x of lines.slice(i+1,i+10)){ if(/^Decomposition|^Conformite/i.test(x.t)) break; const m=x.t.match(/^(Chauffage|Refroidissement|ECS|Eclairage|Aux\.?\s*(?:generation|distribution|ventilation))\s*\(\s*([\d.]+)\s*kWh/i);
      if(m){ const k=normalizeText(m[1]).toLowerCase().replace(/\s+/g,' '); poste[/generation|distribution/.test(k)?'aux_dist':/ventilation/.test(k)?'aux_vent':k]=(poste[/generation|distribution/.test(k)?'aux_dist':/ventilation/.test(k)?'aux_vent':k]||0)+Number(m[2]); poste.x??=x; } } }
  if(poste.x){ const note={provenanceNote:'Décomposition du Cep projet (hors production ENR).'}; const r1=v=>Math.round(v*100)/100;
    if(poste.eclairage!==undefined) emit(poste.x,'cep_lighting',r1(poste.eclairage),'cep-eclairage',0.95,'kWhEP/m².an',note);
    if(poste.aux_vent!==undefined) emit(poste.x,'cep_aux_vent',r1(poste.aux_vent),'cep-aux-ventilation',0.95,'kWhEP/m².an',note);
    if(poste.aux_dist!==undefined) emit(poste.x,'cep_aux_dist',r1(poste.aux_dist),'cep-aux-generation',0.93,'kWhEP/m².an',{provenanceNote:'Décomposition du Cep projet : auxiliaires de génération et de distribution.'});
    if(poste.refroidissement>0) emit(poste.x,'cep_cooling',r1(poste.refroidissement),'cep-refroidissement',0.95,'kWhEP/m².an',note); }
  // Énergies : « dont chauffage electrique / bois / autres sources kWh initial projet reference » (énergie finale).
  // « Autres sources » est nommée par le générateur du projet (« Chaudiere gaz », « Gaz naturel ») ; le rapport ne décrit
  // pas le générateur initial : le vecteur avant travaux « autres sources » est une hypothèse à vérifier.
  { const conso=(u,src)=>{ const x=lines.find(y=>new RegExp(`^dont\\s+${u}\\s+${src}\\s+kWh\\s`,'i').test(y.t)); return x?{x,v:rt_nums(x.t.replace(/^.*?kWh/i,''))}:null; };
    const lib=lines.map(x=>x.t).join(' ');
    const autre=/chaudiere\s+gaz|\bgaz\s+naturel\b|\bpropane\b/i.test(lib)?'Gaz':/fioul/i.test(lib)?'Fioul':/reseau\s+de\s+chaleur|sous-?station/i.test(lib)?'Réseau de chaleur urbain':/chaudiere\s+(?:bois|granul)|biomasse/i.test(lib)?'Bois / biomasse':null;
    const usage={};
    for(const [u,fb,fa] of [['chauffage','heating_vector_before','heating_vector_after'],['ECS','ecs_vector_before','ecs_vector_after']]){
      const E={'Électricité':conso(u,'electrique'),'Bois / biomasse':conso(u,'bois'),autre:conso(u,'autres\\s+sources')};
      for(const [col,f] of [[0,fb],[1,fa]]){ const parts=Object.entries(E).filter(([,c])=>c&&c.v[col]>0).sort((a,b)=>b[1].v[col]-a[1].v[col]); if(!parts.length) continue;
        const [k,c]=parts[0]; const vect=k==='autre'?autre:k; if(!vect) continue; if(col===1) usage[u]={vect,seul:parts.length===1};
        const tot=parts.reduce((a,[,z])=>a+z.v[col],0), part=Math.round(c.v[col]/tot*100);
        const hyp=k==='autre'&&col===0;
        emit(c.x,f,vect,`${u.toLowerCase()}-energie`,hyp?0.8:0.94,'',{provenanceNote:`Consommations en énergie finale (${col?'projet':'état initial'}) : ${part} % « ${k==='autre'?'autres sources':k} »${k==='autre'?` = ${vect} (générateur décrit dans le rapport)`:''}.${hyp?' Hypothèse : même énergie qu’après travaux, le générateur initial n’étant pas décrit.':''}`,...(hyp?{reviewCap:0.8}:{})}); } }
    // Cep par énergie : chauffage et ECS mono-énergie, auxiliaires et éclairage électriques.
    if(poste.x&&usage.chauffage?.seul&&usage.ECS?.seul){ const parE={}; const add=(e,v)=>{ if(v>0) parE[e]=(parE[e]||0)+v; };
      add(usage.chauffage.vect,poste.chauffage); add(usage.ECS.vect,poste.ecs); add('Électricité',(poste.eclairage||0)+(poste.aux_vent||0)+(poste.aux_dist||0)); add('Électricité',poste.refroidissement);
      const F={'Gaz':'cep_gas','Électricité':'cep_electricity','Réseau de chaleur urbain':'cep_district','Bois / biomasse':'cep_biomass'};
      for(const [e,v] of Object.entries(parE)) if(F[e]) emit(poste.x,F[e],Math.round(v*100)/100,'cep-energie',0.93,'kWhEP/m².an',{provenanceNote:`Somme des postes du Cep projet au ${e.toLowerCase()}.`}); } }
  // Caractéristiques du projet.
  const dep=find(/^Departement\s*:?\s*(\d{2,3}|2A|2B)\s*-/i); if(dep) emit(dep,'department',dep.t.match(/(\d{2,3}|2A|2B)\s*-/i)[1].padStart(2,'0'),'departement',0.97,'',{building:'Bâtiment unique'});
  const yr=find(/^Annee\s*de\s*construction\s+\d{4}/i); if(yr){ const y=rt_nums(yr.t)[0]; if(y>=1500&&y<=2100) emit(yr,'construction_year',y,'annee',0.95); }
  const lg=find(/^Nombre\s+de\s+logements\s+\d+/i); if(lg) emit(lg,'housing_count',rt_nums(lg.t)[0],'logements',0.95);
  const sh=find(/^Surface\s+habitable\s+en\s+residentiel/i); if(sh){ const v=rt_nums(sh.t)[0]; if(v>0) emit(sh,'shab',v,'shab',0.95,'m²',{provenanceNote:'Surface habitable (groupe) de l’étude RT existant.'}); }
  // Compositions : paroi (« Type de paroi Paroi verticale / Plancher haut / Plancher bas ») puis couche isolante
  // « Fibre de bois 036 14.0 0.036 140 0.583 0.26 3.89 » (épaisseur cm, λ, ρ, Cs, U, R).
  let type=null, nature=''; const comp={};
  for(const x of lines){
    let m;
    if((m=x.t.match(/^Type\s+de\s+paroi\s+(Paroi\s+verticale|Plancher\s+haut|Plancher\s+bas|Toiture)/i))){ type=/verticale/i.test(m[1])?'wall':/bas/i.test(m[1])?'floor':'roof'; nature=''; continue; }
    // « Paroi sur locaux non chauffes » : la nature dit s'il s'agit d'un plancher (« Plancher sur local NC ») ou d'un mur.
    if(/^Type\s+de\s+paroi\s+Paroi\s+sur\s+locaux\s+non\s+chauffes/i.test(x.t)){ type='nc'; nature=''; continue; }
    if(/^Type\s+de\s+paroi\b/i.test(x.t)){ type=null; continue; }
    if((m=x.t.match(/^Nature\s+de\s+paroi\s+(.*)$/i))){ nature=m[1]; if(type==='nc') type=/plancher/i.test(nature)?'floor':/mur/i.test(nature)?'wall':null; continue; }
    if(!type||type==='nc') continue;
    // Couche sur deux lignes (nom long) : « Ecorock Mono L 1200 x l 600 x ep » puis « 13.4 0.036 120 0.286 0.27 3.70 ».
    const NUM=/(\d{1,3}(?:\.\d)?)\s+(0\.0\d{1,3})\s+\d+\s+[\d.]+\s+[\d.]+\s+([\d.]+)\s*$/;
    let r=x.t.match(new RegExp('^(.+?)\\s+'+NUM.source));
    if(!r){ const q=x.t.match(new RegExp('^'+NUM.source)); const prev=lines[lines.indexOf(x)-1]; if(q&&prev&&/[a-z]/i.test(prev.t)&&!/^\d/.test(prev.t)) r=[x.t,prev.t,q[1],q[2],q[3]]; }
    if(!r||!(INSUL_RE.test(r[1])||rt_insul(r[1]))) continue;
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
  // Baies : les portes intérieures et placards (« Type de baie » vide, cadre bois) ne décrivent pas les menuiseries ;
  // seules les fenêtres et portes-fenêtres comptent, valeur la plus fréquente.
  const cadreV=s=>/pvc/i.test(s)?'PVC':/bois.*alu|alu.*bois|mixte/i.test(s)?'Bois-aluminium':/alu/i.test(s)?'Aluminium':/bois/i.test(s)?'Bois':null, protV=s=>/volet\s+roulant/i.test(s)?'Volet roulant':/brise|bso|venitien/i.test(s)?'BSO':/store/i.test(s)?'Store':/battant|persienne/i.test(s)?'Volet battant':null;
  const baies=lines.map((x,k)=>/^Type\s+de\s+baie\s+(?:Fenetre|Porte\s+fenetre)\b/i.test(x.t)?lines.slice(k+1,k+10):null).filter(Boolean);
  const freq=(get)=>{ const c=new Map(); for(const b of baies){ const r=get(b); if(r&&r.v) c.set(r.v,{x:r.x,n:(c.get(r.v)?.n||0)+1}); } const top=[...c.entries()].sort((a,b)=>b[1].n-a[1].n)[0]; return top?{v:top[0],x:top[1].x,n:top[1].n}:null; };
  const dans=(b,re)=>b.find(y=>re.test(y.t));
  if(baies.length){ const note=r=>({provenanceNote:`Valeur la plus fréquente des fenêtres et portes-fenêtres (${r.n}/${baies.length}).`});
    const c=freq(b=>{ const y=dans(b,/^Type\s+de\s+cadre\s+\S/i); return y&&{x:y,v:cadreV(y.t.replace(/^Type\s+de\s+cadre\s+/i,''))}; }); if(c) emit(c.x,'window_material',c.v,'cadre',0.94,'',note(c));
    const g=freq(b=>{ const y=dans(b,/^Nom\s+codifie\s+\S/i); return y&&{x:y,v:normalizeGlazingType(y.t.replace(/^Nom\s+codifie\s+/i,''))}; }); if(g) emit(g.x,'window_glazing',g.v,'vitrage',0.94,'',note(g));
    const pr=freq(b=>{ const y=dans(b,/^Protection\s+(?!solaire)\S/i); return y&&!/pas\s+de\s+protection/i.test(y.t)&&{x:y,v:protV(y.t)}; }); if(pr) emit(pr.x,'window_shading',pr.v,'protection',0.92,'',note(pr)); }
  else {
    const cadre=find(/^Type\s+de\s+cadre\s+\S/i); if(cadre){ const s=cadre.t.replace(/^Type\s+de\s+cadre\s+/i,''); const v=/pvc/i.test(s)?'PVC':/bois.*alu|alu.*bois|mixte/i.test(s)?'Bois-aluminium':/alu/i.test(s)?'Aluminium':/bois/i.test(s)?'Bois':null; if(v) emit(cadre,'window_material',v,'cadre',0.94); }
    // Premier vitrage réellement décrit (les portes portent « Nom codifié sans objet »).
    for(const code of lines.filter(x=>/^Nom\s+codifie\s+\S/i.test(x.t))){ const g=normalizeGlazingType(code.t.replace(/^Nom\s+codifie\s+/i,'')); if(g){ emit(code,'window_glazing',g,'vitrage',0.94); break; } }
    const prot=find(/^Protection\s+(?!solaire)\S/i); if(prot&&!/pas\s+de\s+protection/i.test(prot.t)){ const s=prot.t; const v=/volet\s+roulant/i.test(s)?'Volet roulant':/brise|bso|venitien/i.test(s)?'BSO':/store/i.test(s)?'Store':/battant|persienne/i.test(s)?'Volet battant':null; if(v) emit(prot,'window_shading',v,'protection',0.92); }
  }
  // Systèmes.
  const gen=lines.findIndex(x=>/\(Volume\s+chauffe\b/i.test(x.t));
  if(gen>=0){ const blk=lines.slice(gen,gen+25).map(x=>x.t).join(' ');
    if(/effet\s+joule|panneau\s+rayonnant/i.test(blk)){ emit(lines[gen],'heating_mode_after','Chauffage électrique direct','generation',0.94); emit(lines[gen],'heating_vector_after','Électricité','generation-vecteur',0.94); }
    else if(/pompe\s+a\s+chaleur|\bPAC\b/i.test(blk)) emit(lines[gen],'heating_mode_after','PAC','generation',0.88);
    else if(/chaudiere\s+gaz|condensation/i.test(blk)||lines.some(x=>/^Chaudiere\s+gaz\s+a\s+condensation\b/i.test(x.t))) emit(lines[gen],'heating_mode_after','Chaudière condensation','generation',0.88);
    if(/Ballon|Stockage-Generation|Chauffe-?eau/i.test(blk)&&/effet\s+joule/i.test(blk)){ emit(lines[gen],'ecs','Ballon électrique','ecs',0.92); emit(lines[gen],'ecs_vector_after','Électricité','ecs-vecteur',0.92); }
  }
  const ven=find(/^Nouveau\s+systeme\s+de\s+ventilation\b/i)||find(/^Systeme\s+de\s+ventilation\s+(?!initiale)\S/i);
  if(ven){ const s=ven.t; const v=/double\s+flux/i.test(s)?'VMC double flux':/hygro\w*\s*B/i.test(s)?'VMC Hygro B':/hygro\w*\s*A/i.test(s)?'VMC Hygro A':/simple\s+flux/i.test(s)?'VMC simple flux':null; if(v) emit(ven,'ventilation',v,'ventilation',0.93); }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// v2.3.16 — Notice thermique RT existant rédigée en chapitres « État existant » / « État projeté » (sans tableau de
// synthèse standardisé) : chaque chapitre décrit les parois (« Descriptif des parois » : désignation, isolant, λ,
// épaisseur en cm, R), les menuiseries, les systèmes (« Combustible Gaz », « Mode Chauffage + ECS ») et donne le Cep
// (« Cep (kWh/(m²SRT.an) 300,83 ») et l'étiquette DPE calculée. La phase est donnée par le chapitre, jamais devinée.
const PH_HEAD=/^(\d+(?:\.\d+)*)\.?\s+Etat\s+(existant|initial|actuel|avant\s+travaux|projete|projet|apres\s+travaux|renove)\b/i;
function ph_phase(t){ const m=t.match(PH_HEAD); if(!m||/\.{5,}/.test(t)) return null; return /existant|initial|actuel|avant/i.test(m[2])?'before':'after'; }
export function isPhasedThermalNotice(doc){
  const lines=rt_allLines(doc); const t=lines.map(x=>x.t).join('\n').slice(0,400000);
  if(!/notice\s+thermique|etude\s+thermique/i.test(t)||!/RT\s*-?\s*Ex(?:istant)?\b|RT\s+existant|Th\s*-?\s*C\s*-?\s*E\s*-?\s*ex\b/i.test(t)) return false;
  if(/RE\s?2020|RSET\b|Fichier\s+standardise/i.test(t.slice(0,6000))) return false;
  const ph=new Set(lines.map(x=>ph_phase(x.t)).filter(Boolean)); return ph.has('before')&&ph.has('after');
}
const PH_VECT=[[/\bgaz\b/i,'Gaz'],[/\bfioul\b/i,'Fioul'],[/reseau\s+de\s+chaleur|chauffage\s+urbain|\bCPCU\b/i,'Réseau de chaleur urbain'],[/\bbois\b|granul|biomasse/i,'Bois / biomasse'],[/electri|effet\s+joule|pompe\s+a\s+chaleur|\bPAC\b/i,'Électricité']];
const ph_vector=s=>PH_VECT.find(([re])=>re.test(s))?.[1]||null;
const PH_GES=[[6,'A'],[11,'B'],[30,'C'],[50,'D'],[70,'E'],[100,'F']];
export function parsePhasedThermalNotice(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=rt_allLines(doc); const origin='Notice thermique RT existant (chapitres état existant / projeté)'; const B='Bâtiment unique';
  const emit=(x,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`notice-rtex-phases:${method}`,conf,unit,{building:canonical(B),structuredPdf:true,origin,dedicatedRank:10,...extra}); if(o) out.push(o); };
  const P={before:[],after:[]}; let phase=null;
  for(const x of lines){ const p=ph_phase(x.t); if(p){ phase=p; continue; } if(phase&&!/^\d+\s*\/\s*\d+$|Page\s+\d+\s+sur\s+\d+/i.test(x.t)) P[phase].push(x); }
  const word={before:'état existant',after:'état projeté'};
  // Cep du chapitre (première valeur « Cep … » du tableau des consommations).
  const cep={};
  for(const ph of ['before','after']){
    const x=P[ph].find(y=>/^Cep\b(?:\s+(?:projet|initial|existant|total))?\s*(?:\(\s*kWh[^\n]*?\)\s*|[:=]\s*)\d+(?:[.,]\d+)?\s*(?:kWh\S*)?$/i.test(y.t)); if(!x) continue;
    const v=parseFrNumber(x.t.replace(/\(\s*kWh[^\n]*?\)/i,'').match(/(\d+(?:[.,]\d+)?)/)[1]); if(!(v>0&&v<1500)) continue; cep[ph]=v;
    const note={provenanceNote:`Tableau des consommations théoriques du chapitre « ${word[ph]} ».`};
    if(ph==='before') emit(x,'cep_before',v,'cep-existant',0.95,'kWhEP/m².an',note);
    else { emit(x,'cep_after_final',v,'cep-projet',0.95,'kWhEP/m².an',note); emit(x,'cep',v,'cep-projet',0.9,'kWhEP/m².an',note); }
  }
  // v2.3.19 — pas de « Gain Cep » ici : la colonne mesure l'écart au Cep max, que la notice ne donne pas.
  // Étiquette DPE calculée : « 295 kWhEP/m²SHAB.an et une emission de 51 kgeqCO2/m²SHAB.an, correspondant respectivement a des etiquettes de niveau E ».
  for(const ph of ['before','after']){
    const L=P[ph]; const i=L.findIndex(y=>/\d+(?:[.,]\d+)?\s*kWh\s*EP\/m.{0,12}an\b.{0,80}?\d+(?:[.,]\d+)?\s*kg\s*eq\s*CO2/i.test(y.t)); if(i<0) continue;
    const txt=L.slice(i,i+3).map(y=>y.t).join(' '); const m=txt.match(/(\d+(?:[.,]\d+)?)\s*kWh\s*EP\/m.{0,12}?an\b.{0,80}?(\d+(?:[.,]\d+)?)\s*kg\s*eq\s*CO2.{0,120}?etiquettes?\s+(?:de\s+(?:niveau|classe)\s+)?([A-G])\b(?:\s+et\s+([A-G])\b)?/i); if(!m) continue;
    const kg=parseFrNumber(m[2]); const ges=m[4]?m[4]:/respectivement/i.test(txt)?m[3]:(PH_GES.find(([t])=>kg<=t)?.[1]||'G');
    const fe=ph==='before'?'dpe_energy_before':'dpe_energy_after', fg=ph==='before'?'dpe_ges_before':'dpe_ges_after';
    emit(L[i],fe,m[3].toUpperCase(),'dpe-energie',0.92,'',{provenanceNote:`Étiquette DPE calculée (${word[ph]}) : ${m[1]} kWhEP/m².an.`});
    emit(L[i],fg,ges.toUpperCase(),'dpe-ges',m[4]||/respectivement/i.test(txt)?0.92:0.86,'',{provenanceNote:`${m[2]} kgeqCO2/m².an${m[4]||/respectivement/i.test(txt)?'':' (classe GES déduite des seuils DPE)'} — ${word[ph]}.`});
  }
  // Parois de l'état projeté : chaque isolant (λ, épaisseur cm) est rattaché à la désignation la plus proche du tableau.
  const table=(L,re)=>{ const a=L.findIndex(y=>re.test(y.t)); if(a<0) return []; const b=L.findIndex((y,k)=>k>a&&/^Tableau\s+\d+/i.test(y.t)); return L.slice(a+1,b>a?b:a+40); };
  const DESIG=/\b(Murs?|Couverture|Toiture|Terrasse|Rampants?|Plancher\s+(?:bas|haut)|Combles?|Pignon)\b/i;
  const kindOf=t=>/\bmurs?\b|pignon/i.test(t)?'wall':/couverture|toiture|terrasse|rampant|plancher\s+haut|combles?/i.test(t)?'roof':/plancher\s+bas/i.test(t)?'floor':null;
  const walls={};
  for(const ph of ['before','after']){
    const T=table(P[ph],/Descriptif\s+des\s+parois/i); if(!T.length) continue;
    const D=T.map((y,k)=>({y,k})).filter(z=>DESIG.test(z.y.t)&&!/intermediaire/i.test(z.y.t));
    for(const [k,y] of T.entries()){
      if(ph==='before') continue;
      const r=y.t.match(new RegExp(INSUL_RE.source+'[^\\d]{0,20}(0[.,]\\d{2,3})\\s+(\\d{1,3}(?:[.,]\\d)?)(?:\\s+(\\d{1,2}(?:[.,]\\d{1,2})?))?','i')); if(!r) continue;
      const d=D.slice().sort((p,q)=>Math.abs(p.k-k)-Math.abs(q.k-k)||q.k-p.k)[0]; if(!d||Math.abs(d.k-k)>2) continue;
      const kind=kindOf(d.y.t); if(!kind||walls[kind]) continue;
      const type=rt_insul(r[1]); const e=parseFrNumber(r[3]);
      let R=r[4]?parseFrNumber(r[4]):null; if(R===null&&d.k!==k){ const n=rt_nums(d.y.t.replace(DESIG,'')); const last=n[n.length-1]; if(last>0.4&&last<15&&last!==e) R=last; }
      walls[kind]={x:d.y,type,e,R,d:d.y.t};
    }
    // Structure des murs : matériau porteur décrit dans la désignation ou sa composition.
    const wd=D.find(z=>/\bmurs?\b/i.test(z.y.t)); if(wd&&!walls.__structure){ const blk=T.slice(Math.max(0,wd.k-1),wd.k+2).map(y=>y.t).join(' ').toLowerCase();
      const v=/pierre/.test(blk)?'Pierre':/beton/.test(blk)?'Béton':/brique/.test(blk)?'Brique':/parpaing|agglo/.test(blk)?'Parpaing':/ossature\s+bois|\bmob\b/.test(blk)?'Ossature bois':null;
      if(v){ walls.__structure=1; emit(wd.y,'wall_structure',v,'mur-structure',0.9,'',{provenanceNote:`Composition du mur extérieur (${word[ph]}).`}); } }
  }
  for(const kind of ['wall','roof','floor']){ const w=walls[kind]; if(!w) continue; const f=RT_F[kind]; const note={provenanceNote:`Paroi « ${w.d} » de l’état projeté : ${w.type||'isolant'}, ${w.e} cm${w.R?`, R = ${w.R}`:''}.`};
    if(w.type) emit(w.x,f[0],w.type,`${kind}-isolant`,0.93,'',note); if(w.e>0&&w.e<80) emit(w.x,f[1],Math.round(w.e*10),`${kind}-epaisseur`,0.92,'mm',note); if(w.R>0) emit(w.x,f[2],w.R,`${kind}-r`,0.92,'m².K/W',note); }
  // Menuiseries et occultations de l'état projeté.
  const M=table(P.after,/Descriptif\s+des\s+menuiseries/i); const mt=M.map(y=>y.t).join(' ');
  if(M.length){ const mat=/cadre\s+bois|menuiseries?\s+bois|\bbois\b/i.test(mt)&&/alu/i.test(mt)?'Bois-aluminium':/\bPVC\b/i.test(mt)?'PVC':/alu/i.test(mt)?'Aluminium':/\bbois\b/i.test(mt)?'Bois':null;
    if(mat) emit(M.find(y=>/bois|pvc|alu/i.test(y.t)),'window_material',mat,'menuiseries',0.92,'',{provenanceNote:'Tableau des menuiseries de l’état projeté.'});
    const g=mt.match(/\b(\d{1,2}\/\d{1,2}\/\d{1,2}(?:\/\d{1,2}\/\d{1,2})?)\b/); const gl=g?normalizeGlazingType(g[1]):/triple\s+vitrage/i.test(mt)?'Triple vitrage':/double\s+vitrage/i.test(mt)?'Double vitrage':null;
    if(gl) emit(M.find(y=>g?y.t.includes(g[1]):/vitrage/i.test(y.t)),'window_glazing',gl,'vitrage',0.9,'',{provenanceNote:'Tableau des menuiseries de l’état projeté.'}); }
  const oi=P.after.findIndex(y=>/Occultations?|protections?\s+solaires/i.test(y.t)&&!/^Tableau/i.test(y.t));
  if(oi>=0){ const blk=P.after.slice(oi,oi+8).map(y=>y.t).join(' '); const sh=[[/\bBSO\b|brise[- ]soleil\s+orientable/i,'BSO'],[/persiennes?/i,'Persiennes'],[/volets?\s+roulants?/i,'Volets roulants'],[/volets?\s+battants?/i,'Volets battants'],[/stores?\s+(?:exterieurs?|toile)/i,'Stores extérieurs'],[/stores?\s+interieurs?/i,'Stores intérieurs']].filter(([re])=>re.test(blk)).map(z=>z[1]);
    if(sh.length) emit(P.after[oi],'window_shading',sh.join(' / '),'occultations',0.9,'',{provenanceNote:'Occultations prévues à l’état projeté.'}); }
  // Systèmes : vecteur de chauffage du générateur principal de chaque chapitre (« Combustible Gaz »).
  const vec={};
  for(const ph of ['before','after']){
    const L=P[ph]; const gi=L.findIndex(y=>/Chauffage\s*[–-]\s*Generation|Generation\s+(?:de\s+)?chauffage|Production\s+de\s+chauffage/i.test(y.t)); if(gi<0) continue;
    const blk=L.slice(gi,gi+10); const c=blk.find(y=>/^(?:Combustible|Energie|Vecteur)\s*:?\s*\S/i.test(y.t)); const typ=blk.find(y=>/^Type\s*:?\s*\S/i.test(y.t)); const mode=blk.find(y=>/^Mode\s*:?\s*\S/i.test(y.t));
    const v=c?ph_vector(c.t.replace(/^(?:Combustible|Energie|Vecteur)\s*:?\s*/i,'')):typ?ph_vector(typ.t):null; if(!v) continue; vec[ph]=v;
    emit(c||typ,ph==='before'?'heating_vector_before':'heating_vector_after',v,`chauffage-${ph}`,0.93,'',{provenanceNote:`Générateur principal de chauffage (${word[ph]}).`});
    if(mode&&/ECS/i.test(mode.t)) emit(mode,ph==='before'?'ecs_vector_before':'ecs_vector_after',v,`ecs-${ph}`,0.92,'',{provenanceNote:`Générateur mixte chauffage + ECS (${word[ph]}).`});
    if(ph==='after'&&typ){ const all=L.map(y=>y.t).join(' '); const hm=/pompe\s+a\s+chaleur|\bPAC\b/i.test(typ.t)?'PAC':/chaudiere/i.test(typ.t)?(/condensation/i.test(all)?'Chaudière condensation':v==='Gaz'?'Chaudière gaz':null):/radiateur|convecteur|effet\s+joule/i.test(typ.t)?'Chauffage électrique direct':/sous-station|reseau/i.test(typ.t)?'Réseau de chaleur urbain':null; if(hm) emit(typ,'heating_mode_after',hm,'generateur-projet',0.9,'',{provenanceNote:`${typ.t} (état projeté).`}); }
  }
  // ECS décrite en clair : « L'ECS est assuree pour 10 logements par les chaudieres individuelles et par des ballons electriques pour 4 logements ».
  for(const ph of ['before','after']){
    const L=P[ph]; const i=L.findIndex(y=>/L.ECS\s+(?:est|sera)\s+assure/i.test(y.t)); if(i<0) continue;
    const txt=L.slice(i,i+2).map(y=>y.t).join(' ').split(/\.\s/)[0]; const segs=txt.split(/\s+et\s+(?=par\b)/i);
    const w={}; for(const s2 of segs){ const v=/chaudi/i.test(s2)?(vec[ph]||null):ph_vector(s2); if(!v) continue; const n=Number((s2.match(/(\d+)\s+logements?/i)||[])[1]||1); w[v]=(w[v]||0)+n; }
    const top=Object.entries(w).sort((a,b)=>b[1]-a[1])[0]; if(!top) continue; const mixed=Object.keys(w).length>1;
    const f=ph==='before'?'ecs_vector_before':'ecs_vector_after'; if(out.some(o=>o.field===f)) continue;
    emit(L[i],f,top[0],`ecs-texte-${ph}`,mixed?0.86:0.92,'',{provenanceNote:mixed?`ECS mixte : ${Object.entries(w).map(([k,n])=>`${k} ${n}`).join(', ')} — vecteur majoritaire retenu.`:`ECS décrite par la notice (${word[ph]}).`});
  }
  // Ventilation de l'état projeté.
  const at=P.after.map(y=>y.t).join('\n'); const vx=P.after.find(y=>/ventilation\s+(?:simple|double)\s+flux|VMC|hygro/i.test(y.t));
  if(vx){ const v=/double\s+flux/i.test(at)?'VMC double flux':(()=>{ const h=at.match(/hygro\w*\s+(?:type\s+)?([AB])\b/i); return h?`VMC Hygro ${h[1].toUpperCase()}`:/simple\s+flux/i.test(at)?'VMC simple flux':null; })(); if(v) emit(vx,'ventilation',v,'ventilation-projet',0.92,'',{provenanceNote:'Système de ventilation de l’état projeté.'}); }
  // Programme : nombre de logements.
  const hl=lines.find(y=>/(?:compte|comprenant|de|creation\s+de)\s+(\d{1,4})\s+logements\b/i.test(y.t)&&!/pour\s+\d+\s+logements/i.test(y.t)); if(hl) emit(hl,'housing_count',Number(hl.t.match(/(\d{1,4})\s+logements\b/i)[1]),'logements',0.92);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// v2.3.18 — Note ClimaWin « Synthèse d'étude RTEx » (RT existant globale, moteur Th-C-E ex) :
//  « UBatinit UBatproj UBatref … / Garde-fous conformes 1.929 0.627 0.689 », « Cepinit Cepproj Cepref Cep_p Cepmax /
//  Tic conforme OUI 396.31 123.85 200.31 105.11 165.00 », Tic initial / projet / référence, parois opaques (isolant en cm,
//  couches « (20 cm) / … (14 cm) »), menuiseries, « Détail des consommations » par énergie (Initial / projet / référence).
export function isClimaWinRtexSynthesis(doc){
  const t=String(doc?.read?.text||'').slice(0,60000);
  return /ClimaWin/i.test(t)&&/Synthese\s+d.etude\s+RTEx/i.test(t)&&/Cepinit/i.test(t);
}
const cw_clean=s=>String(s||'').replace(/^Bat(?:iment)?\.?\s+/i,'').replace(/\s*-?\s*(?:apres|avant)\s+travaux\b.*$/i,'').replace(/\s*-?\s*(?:SOLUTION|OPTION|VARIANTE|SCENARIO)\b.*$/i,'').replace(/\s*-\s*(?:Generalites|Informations|Synthese)\b.*$/i,'').trim();
export function climaWinRtexBuildingName(doc){
  for(const x of rt_allLines(doc)){ const m=x.t.match(/^Batiment\s*:\s*(.+?)\s*-\s*Synthese\s+d.etude\s+RTEx/i)||x.t.match(/^Batiment\s*:\s*(.+?)\s*-\s*(?:Informations|Generalites)\b/i); if(m){ const n=cw_clean(m[1]); if(n) return `Batiment ${n}`; } }
  return 'Bâtiment unique';
}
export function parseClimaWinRtexSynthesis(doc,occ,canonical=(s)=>s){
  const out=[]; const L=rt_allLines(doc); const origin='ClimaWin — Synthèse d’étude RT existant'; const B=climaWinRtexBuildingName(doc);
  const emit=(x,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value))) return; const o=occ(doc,x.page,x.line,field,value,`climawin-rtex:${method}`,conf,unit,{building:canonical(B),structuredPdf:true,origin,dedicatedRank:6,...extra}); if(o) out.push(o); };
  const after=(re,n=3)=>{ const i=L.findIndex(x=>re.test(x.t)); return i<0?null:L.slice(i+1,i+1+n).find(x=>rt_nums(x.t).length>=3)||null; };
  // Ubat initial / projet / référence.
  { const x=after(/UBatinit.*UBatproj/i); if(x){ const v=rt_nums(x.t); const note={provenanceNote:'Tableau « UBatinit / UBatproj / UBatref » de la synthèse.'}; if(v[0]>0&&v[0]<5) emit(x,'ubat_before',v[0],'ubat-initial',0.95,'W/m².K',note); if(v[1]>0&&v[1]<5) emit(x,'ubat_after',v[1],'ubat-projet',0.95,'W/m².K',note); } }
  // Cep initial / projet / référence / Cep_p / Cepmax.
  { const x=after(/Cepinit.*Cepproj/i); if(x){ const v=rt_nums(x.t); const k=v.length; if(k>=5){ const [ci,cp,,,cm]=v.slice(k-5); const note={provenanceNote:'Tableau « Cepinit / Cepproj / Cepref / Cep_p / Cepmax » de la synthèse.'};
      emit(x,'cep_before',ci,'cep-initial',0.95,'kWhEP/m².an',note); emit(x,'cep_after_final',cp,'cep-projet',0.95,'kWhEP/m².an',note); emit(x,'cep',cp,'cep-projet',0.92,'kWhEP/m².an',note); emit(x,'cep_max',cm,'cep-max',0.92,'kWhEP/m².an',note);
      if(cm>0) emit(x,'cep_gain',Math.round((cm-cp)/cm*1000)/10,'cep-gain',0.93,'%',{provenanceNote:`Gain = (Cep max − Cep projet) / Cep max = (${cm} − ${cp}) / ${cm}.`}); } } }
  // Postes de consommation du projet (« Comparatif des consommations en énergie primaire » : Chauffage, Refroid., ECS, Ventil., Aux., Éclair.).
  { const i=L.findIndex(x=>/^Comparatif\s+des\s+consommations\s+en\s+energie\s+primaire/i.test(x.t)); const x=i>=0?L.slice(i+1,i+5).find(y=>/^Projet\s+[\d.,]/i.test(y.t)):null;
    if(x){ const v=rt_nums(x.t); if(v.length>=7){ const note={provenanceNote:'Ligne « Projet » du comparatif des consommations en énergie primaire (kWhep/m²).'};
      emit(x,'cep_cooling',v[1],'cep-froid',0.92,'kWhEP/m².an',note); emit(x,'cep_aux_vent',v[3],'cep-ventilation',0.92,'kWhEP/m².an',note); emit(x,'cep_aux_dist',v[4],'cep-auxiliaires',0.92,'kWhEP/m².an',note); emit(x,'cep_lighting',v[5],'cep-eclairage',0.92,'kWhEP/m².an',note); } } }
  // Tic projet / référence.
  { const i=L.findIndex(x=>/Ticinitial.*Ticprojet.*Ticref/i.test(x.t)); const x=i>=0?L.slice(i+1,i+4).find(y=>rt_nums(y.t).length>=3):null; if(x){ const v=rt_nums(x.t); const k=v.length; emit(x,'tic',v[k-2],'tic',0.95,'°C'); emit(x,'tic_ref',v[k-1],'tic-ref',0.95,'°C'); } }
  // Parois opaques : chaque ligne commence par la surface et le type ; l'épaisseur est la somme des couches « (n cm) » du bloc.
  { const rows=[]; L.forEach((x,i)=>{ const m=x.t.match(/^(\d+(?:[.,]\d+)?)\s+(Mur\s+exterieur|Pl\.\s*haut|Pl\.\s*bas|Plancher\s+(?:haut|bas)|Toiture)\b/i); if(m) rows.push({i,s:parseFrNumber(m[1]),kind:/mur/i.test(m[2])?'wall':/bas/i.test(m[2])?'floor':'roof'}); });
    const best={};
    rows.forEach((r,k)=>{ const prevEnd=k>0?rows[k-1].i+1:0; let a=r.i; while(a>prevEnd&&!/^(?:APS|AVT|EXI|PRJ)\b|^\S+\s*\/\s*\S+\s*-/i.test(L[a].t)) a--; const nxt=k+1<rows.length?rows[k+1].i:Math.min(L.length,r.i+5);
      let b=r.i+1; while(b<nxt&&!/^(?:APS|AVT|EXI|PRJ)\b|^Enveloppe\b|^\S+\s*\/\s*\S+\s*-/i.test(L[b].t)) b++;
      const blk=L.slice(a,b).map(y=>y.t).join(' '); const cms=[...blk.matchAll(/\((\d{1,2}(?:[.,]\d)?)\s*cm\)?/gi)].map(z=>parseFrNumber(z[1])).filter(v=>v>0);
      const e=cms.reduce((p,q)=>p+q,0); if(!(e>0)) return; if(!best[r.kind]||r.s>best[r.kind].s) best[r.kind]={...r,e,x:L[r.i],blk}; });
    const F={wall:'wall_insulation_thickness',roof:'roof_insulation_thickness',floor:'floor_insulation_thickness'};
    for(const [kind,r] of Object.entries(best)) emit(r.x,F[kind],Math.round(r.e*10),`${kind}-epaisseur`,0.92,'mm',{provenanceNote:`Paroi « ${r.x.t.slice(0,80)} » (${r.s} m²) : isolant ${r.e} cm.`}); }
  // Menuiseries.
  { const w=L.filter(x=>/^\d+(?:[.,]\d+)?\s+Fenetre\s+/i.test(x.t)); const mat=w.map(x=>/\bPVC\b/i.test(x.t)?'PVC':/alu/i.test(x.t)?'Aluminium':/\bbois\b/i.test(x.t)?'Bois':null).filter(Boolean); if(mat.length) emit(w[0],'window_material',mat[0],'menuiseries',0.92);
    const g=L.map(x=>x.t).join(' ').match(/\b([DT]V)\s+(\d{1,2}\/\d{1,2}\/\d{1,2})(?:[\s\S]{0,160}?\b(Argon|Krypton)\b)?/i); if(g){ const gl=normalizeGlazingType(`${g[2]} ${g[3]||''}`.trim()); if(gl) emit(w[0]||L[0],'window_glazing',gl,'vitrage',0.9); }
    if(w.some(x=>/volet/i.test(x.t))) emit(w.find(x=>/volet/i.test(x.t)),'window_shading','Volet roulant','occultations',0.88); }
  // Détail des consommations (énergie primaire par énergie) : Chauffage / Refroid. / ECS / Ventil. × Initial, projet, référence.
  { const i=L.findIndex(x=>/^Detail\s+des\s+consommations/i.test(x.t)); if(i>=0){
      const rows={}; for(const x of L.slice(i+1,i+16)){ if(/^Auxiliaires\b/i.test(x.t)) break; const m=x.t.match(/^(Electricite|Gaz|Fioul|Bois|Reseau)\s+(.*)$/i); if(m){ const v=rt_nums(m[2]); if(v.length>=8) rows[m[1].toLowerCase()]={x,v}; } }
      const lab={electricite:'Électricité',gaz:'Gaz',fioul:'Fioul',bois:'Bois / biomasse',reseau:'Réseau de chaleur urbain'};
      const dom=col=>{ const r=Object.entries(rows).map(([k,o])=>[k,o.v[col]||0,o.x]).filter(z=>z[1]>0).sort((a,b)=>b[1]-a[1]); if(!r.length) return null; const tot=r.reduce((s2,z)=>s2+z[1],0); return r[0][1]/tot>=0.6?{v:lab[r[0][0]],x:r[0][2]}:null; };
      const note=w=>({provenanceNote:`Énergie majoritaire du poste (${w}) dans le « Détail des consommations ».`});
      const hb=dom(0), ha=dom(1), eb=dom(6), ea=dom(7);
      if(hb) emit(hb.x,'heating_vector_before',hb.v,'chauffage-initial',0.92,'',note('chauffage initial')); if(ha) emit(ha.x,'heating_vector_after',ha.v,'chauffage-projet',0.92,'',note('chauffage projet'));
      if(eb) emit(eb.x,'ecs_vector_before',eb.v,'ecs-initial',0.92,'',note('ECS initiale')); if(ea) emit(ea.x,'ecs_vector_after',ea.v,'ecs-projet',0.92,'',note('ECS projet')); } }
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
