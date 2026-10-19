// v2.3.12 — Sorties logiciel thermiques reconnues ligne à ligne, d'après les emplacements surlignés et les corrections
// du pack d'amélioration (journal propriétaire) :
//  • Perrenoud U-Win / « RT existant » (« COEFFICIENT UBAT = 1,150 », « Ubat du bâtiment 1,150 »,
//    « Coefficient Cep (kWh énergie primaire / m²) 186,21 », « TIC=23,9 - TICRéf = 32,3 », « Type de ventilation : … »,
//    « Type de Chauffage : Gaz », « Lié à la génération : Chaufferie collective gaz », « Surface utile : … m² Surface Shon »,
//    « Année de construction Entre 1948 et 1975 », sections « Bâtiment : Bâtiment n°7 ») ;
//  • CYPE (rapport complet RT existant) : « 0.54 <= 1.25 56.80 % » sous « Coefficient moyen de déperdition »,
//    « 98.20 <= 214.61 » sous « Consommations conventionnelles », « 25.31 <= 27.89 » pour la Tic, « Cep max = 147.66 »,
//    « SHON (m²) 928.87 », compositions « 2 - Fibre de bois … R=3,85 16 cm » ;
//  • Pléiades RSET RT2012 : « Ubat(hiver) - 0.63 - 0.68 », « Coefficient Cep kWh-ep/m2SHON 89.81 104 -14.19 »,
//    « Groupe 1 °C 25.49 33.16 -7.67 » (Tic, Tic réf), « Surface utile ou habitable (m2) 948 », « Type d'energie - Gaz » ;
//  • tableaux verticaux « Bbio » / « Bbio max » / 52,4 / 60.
// Les valeurs de référence (Ubat réf, Cep réf) ne sont jamais rangées en « avant travaux » sans le signaler :
// elles le sont à vérifier quand l'état initial n'est pas fourni (convention observée dans les corrections).
import {normalizeText,parseFrNumber} from './utils.js';
import {insulationName} from './donnees-techniques.js';

const lt_n=s=>{ const v=parseFrNumber(String(s||'').replace(/\s+/g,'')); return Number.isFinite(v)?v:null; };
const lt_nums=s=>(String(s||'').match(/-?\d+(?:[.,]\d+)?/g)||[]).map(x=>parseFrNumber(x)).filter(v=>v!==null);

// Nombres d'une ligne U48Win : « ,7 » vaut 0,7 (zéro non imprimé).
const lt_numsU=s=>lt_nums(String(s||'').replace(/(^|[\s|])([-+]?)[.,](\d)/g,'$1$20,$3'));
// Bilan BE : « (kWh EF) 657 739,6 » est un seul nombre ; sans unité, les colonnes U48Win restent séparées.
const lt_numsB=s=>{ const m=String(s||'').match(/^\(kWh\s*E[FP]\)\s*(-?\d{1,3}(?:\s\d{3})*(?:,\d+)?)\s*$/i); return m?[lt_n(m[1])]:lt_numsU(s); };
const lt_nomBat=s=>normalizeText(String(s||'')).replace(/\s+/g,' ').trim();
const LT_USAGES={chauffage:/^CHAUFFAGE$/i,refroidissement:/^REFROIDISSEMENT$/i,ecs:/^ECS$/i,eclairage:/^ECLAIRAGE$/i,auxiliaires:/^AUXILIAIRES$/i};
const LT_CEP_ENERGIE={'Gaz':'cep_gas','Électricité':'cep_electricity','Réseau de chaleur urbain':'cep_district','Bois / biomasse':'cep_biomass'};
// Bilan d'un bâtiment (page « RÉSULTATS DE L'ÉTAT INITIAL / PROJET » d'U48Win) : énergies par usage (kWh EP) et
// totaux en kWhEP/m². L'énergie majoritaire d'un usage donne le vecteur ; les totaux du projet donnent les postes Cep.
function emitBilan(b,emit){
  const U=b.usages, x=b.x, B=b.B, apres=b.phase==='after';
  const note=w=>({provenanceNote:`Bilan de l’état ${apres?'projet':'initial'} (sortie Th-C-E ex) : ${w}.`});
  const dom=k=>{ const e=Object.entries(U[k]?.energies||{}).filter(([,v])=>v>0).sort((a,c)=>c[1]-a[1]); if(!e.length) return null; const tot=e.reduce((a,z)=>a+z[1],0); return {v:e[0][0],part:e[0][1]/tot}; };
  const ch=dom('chauffage'), ecs=dom('ecs');
  if(ch) emit(U.chauffage.x||x,B,apres?'heating_vector_after':'heating_vector_before',ch.v,'bilan-chauffage',0.95,'',note(`énergie majoritaire du chauffage (${Math.round(ch.part*100)} % de l’énergie primaire)`));
  if(ecs) emit(U.ecs.x||x,B,apres?'ecs_vector_after':'ecs_vector_before',ecs.v,'bilan-ecs',0.95,'',note(`énergie majoritaire de l’ECS (${Math.round(ecs.part*100)} %)`));
  if(!apres) return;
  const poste=(k,field,lib)=>{ const u=U[k]; if(u&&u.total!==null&&u.total!==undefined) emit(u.xTotal||x,B,field,u.total,`bilan-${k}`,0.95,'kWhEP/m².an',note(`total ${lib}`)); };
  poste('eclairage','cep_lighting','éclairage'); poste('auxiliaires','cep_aux_dist','auxiliaires'); poste('ventilateurs','cep_aux_vent','ventilateurs');
  if(U.refroidissement?.total>0) poste('refroidissement','cep_cooling','refroidissement');
  // Cep par énergie : chaque total d'usage est réparti selon la part de chaque énergie (les kWh sont déjà en énergie primaire).
  const parE={};
  for(const u of Object.values(U)){ if(u.total===null||u.total===undefined) continue; const somme=Object.values(u.energies).reduce((a,c)=>a+c,0);
    for(const [e,v] of Object.entries(u.energies)) parE[e]=(parE[e]||0)+(somme>0?u.total*v/somme:0); }
  for(const [e,v] of Object.entries(parE)){ const f=LT_CEP_ENERGIE[e]; if(f&&v>0) emit(x,B,f,Math.round(v*100)/100,'bilan-energie',0.93,'kWhEP/m².an',note(`somme des postes au ${e.toLowerCase()}`)); }
}

// Rapport U48Win (Perrenoud), RT existant globale (moteur Th-C-E ex) : résumé par bâtiment, saisies, bilans par usage.
export function isU48WinThcexReport(doc){
  const t=String(doc?.read?.text||'');
  return /calculs\s+r[ée]alis[ée]s\s+avec\s+le\s+logiciel\s+U48Win/i.test(t)&&/ThC\s*-?\s*Ex\b/i.test(t);
}

export function hasThermalSoftwareMarkers(doc){
  const t=String(doc?.read?.text||'').slice(0,800000);
  return /COEFFICIENT\s+UBAT\s*=|Ubat\s+du\s+b[aâ]timent\s+\d|TIC\s*=\s*\d+[.,]?\d*\s*-\s*TIC\s*R[ée]f|Coefficient\s+Cep\s+\(kWh|<=\s*\d+[.,]\d+\s+-?\d+[.,]\d+\s*%|Ubat\s*\(hiver\)\s*-\s*\d|Coefficient\s+Cep\s+kWh-?ep\/m2|Type\s+de\s+ventilation\s*:|Type\s+de\s+Chauffage\s*:?\s+\S|Surface\s+utile\s*:\s*[\d\s,]+m.?\s+Surface\s+Shon/i.test(t);
}
const lt_vent=v=>{ const s=normalizeText(v).toLowerCase();
  if(/double\s+flux/.test(s)) return 'VMC double flux'; if(/hygro\w*\s*(?:type\s*)?b\b/.test(s)) return 'VMC Hygro B'; if(/hygro\w*\s*(?:type\s*)?a\b/.test(s)) return 'VMC Hygro A';
  if(/auto-?r[ée]glable/.test(s)) return 'VMC simple flux autoréglable'; if(/simple\s+flux|extracteur/.test(s)) return 'VMC simple flux';
  if(/ouv\w*\.?\s*(?:de\s*|des\s*)?fen[eê]tres?|naturelle|tirage/.test(s)) return 'Ventilation naturelle'; return null; };
const lt_vector=v=>{ const s=normalizeText(v).toLowerCase();
  // Liste d'options d'un formulaire (« Autre (Thermodynamique, Gaz, Fioul, Bois, Réseau,...) ») : aucune valeur.
  if(/\bautre\s*\(|,\s*\.\.\.|(?:gaz|fioul|bois|electri\w*|reseau)[^,]{0,15},[^,]{0,15}(?:gaz|fioul|bois|electri\w*|reseau)/.test(s)) return null;
  if(/reseau\s+de\s+chaleur|chauffage\s+urbain|\brcu\b/.test(s)) return 'Réseau de chaleur urbain'; if(/\bgaz\b/.test(s)) return 'Gaz'; if(/fioul|fuel/.test(s)) return 'Fioul';
  if(/bois|granul|biomasse/.test(s)) return 'Bois / biomasse'; if(/electri|effet\s+joule|convecteur|panneau\s+rayonnant/.test(s)) return 'Électricité'; return null; };
const lt_phase=t=>{ const s=normalizeText(t).toLowerCase();
  if(/etat\s+(?:initial|existant)|avant\s+travaux|situation\s+initiale|batiment\s+existant/.test(s)) return 'before';
  if(/etat\s+projet|apres\s+travaux|etat\s+projete|\bvariante\b|\bscenario\b/.test(s)) return 'after'; return null; };

export function parseThermalSoftwarePatterns(doc,occ,canonical=(s)=>s){
  const out=[]; const origin='Sortie logiciel thermique (motifs reconnus)';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`logiciel-thermique:${method}`,conf,unit,{building:canonical(b||'Bâtiment unique'),structuredPdf:true,origin,dedicatedRank:12,...extra}); if(o) out.push(o); };
  let building=null; const seen=new Set();
  const once=(b,f,v)=>{ const k=`${b}|${f}|${v}`; if(seen.has(k)) return false; seen.add(k); return true; };
  // U48Win (Perrenoud, Th-C-E ex) : le résumé nomme « Batiment n° 01 : A/B » et les pages de saisie « BATIMENT : A/B ».
  // Quand le document fournit ce nom, il identifie le bâtiment, pour que toutes les sections convergent vers le même.
  const NOM_BAT=/^(?:Batiment\s*:\s*)?B[aâ]timent\s+n\s*[°º]?\s*(\d+)\s*:\s*(?!\s*B[aâ]timent\s+n)([^:]{1,40})$/i;
  const nommes=new Set();
  for(const page of doc.read?.pages||[]) for(const line of page.lines||[]){ const m=normalizeText(line.text||'').replace(/\s+/g,' ').trim().match(NOM_BAT); if(m) nommes.add(lt_nomBat(m[2])); }
  // Avec des bilans par usage (pages de résultats), les lignes d'émetteurs ne donnent plus le vecteur.
  // Rapports BE Th-C-E ex (CYPE, « Etat Existant Batiment ») : même bilan, sans le titre U48Win, en kWh d'énergie finale.
  const pageBilan=p=>/RESULTATS\s+DE\s+L.ETAT\s+(?:INITIAL|PROJET)/i.test(p.text||'')||(/^CHAUFFAGE$/m.test(p.text||'')&&/^Total\s+Energie\s+primaire\s*\(kwh\s*EP/im.test(p.text||''));
  const bilans=(doc.read?.pages||[]).some(pageBilan);
  let gesInitial=null;
  const logements=new Map(); let bilan=null, resultat=false, phaseChapitre=null;
  const finBilan=()=>{ if(bilan){ emitBilan(bilan,emit); bilan=null; } };
  for(const page of doc.read?.pages||[]){
    const lines=(page.lines||[]).map(line=>({page,line,t:normalizeText(line.text||'').replace(/\s+/g,' ').trim()}));
    // U48Win : le titre « ETAT INITIAL / ETAT PROJET » n'est imprimé qu'en tête de chapitre ; il vaut pour les pages suivantes.
    const enTete=lt_phase(lines.slice(0,12).map(x=>x.t).join(' ')); if(enTete) phaseChapitre=enTete;
    const pagePhase=enTete||(nommes.size?phaseChapitre:null)||lt_phase(lines.map(x=>x.t).join(' '));
    let element=null;
    const phaseBilan=/RESULTATS\s+DE\s+L.ETAT\s+PROJET/i.test(page.text||'')?'after':/RESULTATS\s+DE\s+L.ETAT\s+INITIAL/i.test(page.text||'')?'before':pageBilan(page)?pagePhase:null;
    let etiquette=null; const etiquettes={energy:[],ges:[]}; let cepPage=null;
    for(let i=0;i<lines.length;i++){
      const x=lines[i], t=x.t; let m;
      if(/^(?:Batiment\s*:\s*)?B[aâ]timent\s+n\s*[°º]?\s*\d+/i.test(t)&&t.length<70){ finBilan(); resultat=false; const nm=t.match(NOM_BAT); const all=[...t.matchAll(/B[aâ]timent\s+n\s*[°º]?\s*(\d+)/gi)];
        building=nm?`Batiment ${lt_nomBat(nm[2])}`:`Batiment ${all[all.length-1][1]}`; if(phaseBilan) bilan={B:building,phase:phaseBilan,usages:{},x,cur:null}; continue; } // « Bâtiment n° 2 : Bâtiment n°5 » → bâtiment 5
      if((m=t.match(/^BATIMENT\s*:\s*(.{1,40})$/))&&nommes.has(lt_nomBat(m[1]))){ finBilan(); resultat=false; building=`Batiment ${lt_nomBat(m[1])}`; continue; }
      const B=building;
      // --- U48Win : bilan par usage (pages de résultats) ------------------------------------------------------------------
      if(!bilan&&phaseBilan&&!/RESULTATS\s+DE\s+L.ETAT\s+(?:INITIAL|PROJET)\b/.test(page.text||'')&&LT_USAGES.chauffage.test(t)) bilan={B:B||'Bâtiment unique',phase:phaseBilan,usages:{},x,cur:null};
      if(bilan){
        const u=Object.keys(LT_USAGES).find(k=>LT_USAGES[k].test(t)); if(u){ bilan.cur=u; bilan.usages[u]??={energies:{},total:null,x}; continue; }
        if((m=t.match(/^Ventilateurs\s*\((Electrique|Electricite)\)\s+(.+)$/i))){ const v=lt_numsB(m[2]); const ve=(bilan.usages.ventilateurs??={energies:{},total:null,x}); if(v.length) ve.energies['Électricité']=(ve.energies['Électricité']||0)+v[0]; continue; }
        if((m=t.match(/^Vent\s*-\s*Total\s+Energie\s+primaire[^)]*\)\s*(.+)$/i))){ const v=lt_numsU(m[1]); const ve=(bilan.usages.ventilateurs??={energies:{},total:null,x}); if(v.length){ ve.total=v[0]; ve.xTotal=x; } continue; }
        if((m=t.match(/^Total\s+Energie\s+primaire[^)]*\)\s*(.+)$/i))&&bilan.cur){ const v=lt_numsU(m[1]); if(v.length){ bilan.usages[bilan.cur].total=v[0]; bilan.usages[bilan.cur].xTotal=x; } continue; }
        if(bilan.cur&&(m=t.match(/^(Gaz|Electrique|Electricite|Fioul|Bois|Reseau[^\d,(]*|Charbon|GPL|Propane)\s*((?:\(kWh\s*E[FP]\)\s*)?[-+\d,.].*)$/i))){ const e=lt_vector(m[1])||(/gpl|propane/i.test(m[1])?'Gaz':null); const v=lt_numsB(m[2]);
          if(e&&v.length){ const us=bilan.usages[bilan.cur]; us.energies[e]=(us.energies[e]||0)+v[0]; if(!us.x||v[0]>0) us.x=x; } continue; }
      }
      // --- U48Win : résumé de l'étude --------------------------------------------------------------------------------------
      if(/^Resultat\s+Projet\s+Reference\s+Gain/i.test(t)){ resultat=true; continue; }
      if(resultat&&(m=t.match(/^(Ubat|C)\s+([-+\d,.].*)$/))){ const v=lt_numsU(m[2]);
        if(v.length>=5){ const [pr,ref,gain,ini]=v; const note={provenanceNote:'Résumé de l’étude U48Win : colonnes Projet / Référence / Gain % / Initial.'};
          if(m[1]==='Ubat'){ if(pr>0&&pr<6) emit(x,B,'ubat_after',pr,'resume-ubat-projet',0.95,'W/m².K',note); if(ini>0&&ini<6) emit(x,B,'ubat_before',ini,'resume-ubat-initial',0.95,'W/m².K',note); }
          else { emit(x,B,'cep',pr,'resume-cep-projet',0.95,'kWhEP/m².an',note); emit(x,B,'cep_after_final',pr,'resume-cep-projet',0.95,'kWhEP/m².an',note);
            emit(x,B,'cep_max',ref,'resume-cep-reference',0.95,'kWhEP/m².an',{provenanceNote:'Résumé U48Win : Cep de référence (exigence RT existant globale : Cep ≤ Cep réf).'});
            emit(x,B,'cep_gain',gain,'resume-cep-gain',0.95,'%',{provenanceNote:`Gain imprimé par U48Win = (Cep réf − Cep projet) / Cep réf = (${ref} − ${pr}) / ${ref}.`});
            emit(x,B,'cep_before',ini,'resume-cep-initial',0.95,'kWhEP/m².an',note); } }
        continue; }
      if(/Groupe\s+Refroidissement\s+Categorie\s+Tic\s+Tic\s+Ref/i.test(lines[i-1]?.t||'')&&/\bCE\d\b/.test(t)){ const v=lt_numsU(t.replace(/^.*?\bCE\d\b/,'')); if(v.length>=2&&v[0]>=15&&v[0]<=45&&once(B,'tic',v[0])){ emit(x,B,'tic',v[0],'resume-tic',0.95,'°C'); emit(x,B,'tic_ref',v[1],'resume-tic-ref',0.95,'°C'); } continue; }
      if((m=t.match(/^Zone\s+traversante\s*:?\s*(Oui|Non)\b/i))){ const f=/oui/i.test(m[1])?'cross_ventilated':'non_cross_ventilated'; if(once(B,f,'Oui')) emit(x,B,f,'Oui','zone-traversante',0.95); continue; }
      if((m=t.match(/^Nombre\s+de\s+logements\s*:\s*(\d+)\s*$/i))&&B){ const n=+m[1]; const e=logements.get(B)||{n:0,x}; e.n+=n; logements.set(B,e); continue; }
      if((m=t.match(/^\d+-\d+-[a-z]\]\s*Ventilation\s*:\s*(.+)$/i))){ const v=lt_vent(m[1]); if(v&&once(B,`ventilation-saisie-${pagePhase}`,v)){ if(pagePhase==='before') emit(x,B,'ventilation_before',v,'ventilation-saisie-initiale',0.95); else emit(x,B,'ventilation',v,'ventilation-saisie',pagePhase==='after'?0.95:0.8,'',pagePhase==='after'?{}:{reviewCap:0.8,provenanceNote:'Phase de la page non identifiée : à vérifier s’il s’agit de l’état après travaux.'}); } continue; }
      const near=lines.slice(Math.max(0,i-3),i).map(y=>y.t).join(' ');
      // --- Perrenoud U-Win ---------------------------------------------------------------------------------------------
      if((m=t.match(/COEFFICIENT\s+UBAT\s+REF\s*=\s*(\d+[.,]\d+)/i))){ const v=lt_n(m[1]); if(once(B,'ubat_ref',v)) emit(x,B,'ubat_ref',v,'ubat-ref',0.93,'W/m².K',{provenanceNote:'Ubat du bâtiment de référence (« COEFFICIENT UBAT REF »).'}); continue; }
      if((m=t.match(/COEFFICIENT\s+UBAT\s*=\s*(\d+[.,]\d+)/i))){ const v=lt_n(m[1]); const ph=lt_phase(near)||pagePhase;
        if(ph==='after'){ if(once(B,'ubat_after',v)) emit(x,B,'ubat_after',v,'ubat-projet',0.94,'W/m².K'); }
        else if(once(B,'ubat_before',v)) emit(x,B,'ubat_before',v,'ubat-calcul',ph==='before'?0.94:0.86,'W/m².K',ph?{}:{reviewCap:0.86,provenanceNote:'« COEFFICIENT UBAT = » d’une page sans mention avant / après travaux : état initial présumé, à vérifier.'}); continue; }
      if((m=t.match(/^Ubat\s+du\s+b[aâ]timent\s+(\d+[.,]\d+)(.*)$/i))){ const v=lt_n(m[1]); const more=lt_nums(m[2]).length>=2||pagePhase==='after';
        const f=more?'ubat_after':'ubat_before'; if(once(B,f,v)) emit(x,B,f,v,more?'ubat-synthese-projet':'ubat-synthese-initial',0.9,'W/m².K',{provenanceNote:more?'Ligne de synthèse projet (valeur suivie des colonnes de référence).':'Ligne de synthèse de l’état initial (valeur seule).'}); continue; }
      if((m=t.match(/^Coefficient\s+Cep\s+(Existant|Initial|Projet|Ref\.?|Reference|Gain)\s*(?:\(%\)|\(kWh[^)]*\))\s*(-?\d+(?:[.,]\d+)?)$/i))){ const v=lt_n(m[2]); const k=normalizeText(m[1]).toLowerCase();
        const note={provenanceNote:`Synthèse de l’étude : « Coefficient Cep ${m[1]} ».`};
        if(/existant|initial/.test(k)){ if(once(B,'cep_before',v)) emit(x,B,'cep_before',v,'cep-existant',0.95,'kWhEP/m².an',note); }
        else if(k==='projet'){ cepPage=v; if(once(B,'cep_after_final',v)){ emit(x,B,'cep_after_final',v,'cep-projet',0.95,'kWhEP/m².an',note); emit(x,B,'cep',v,'cep-projet',0.95,'kWhEP/m².an',note); } }
        else if(k==='gain'){ if(once(B,'cep_gain',v)) emit(x,B,'cep_gain',v,'cep-gain',0.95,'%',note); }
        else if(once(B,'cep_max',v)) emit(x,B,'cep_max',v,'cep-reference',0.95,'kWhEP/m².an',{provenanceNote:'Cep de référence (exigence RT existant globale : Cep ≤ Cep réf).'});
        if(/existant|initial/.test(k)) cepPage=v; continue; }
      // Étiquettes énergie / GES de l'étude (échelle DPE d'avant 2021) : « 151 a 230 D 198 », colonnes énergie puis GES.
      if(/^Consommation\s+energetique/i.test(t)){ etiquette=/Emission\s+de\s+gaz/i.test(t)?'both':'energy'; continue; }
      if(/^Emission\s+de\s+gaz\s+a\s+effet\s+de\s+serre/i.test(t)){ etiquette='ges'; continue; }
      if(etiquette&&pagePhase){ const cl=[...t.matchAll(/(?:^|\s)(?:[≤<>]\s*\d+|\d+\s*a\s*\d+)\s+([A-G])\s+(\d+(?:[.,]\d+)?)(?=\s|$)/g)].map(z=>({c:z[1],v:lt_n(z[2]),x}));
        if(etiquette==='both'&&cl.length===2){ etiquettes.energy.push(cl[0]); etiquettes.ges.push(cl[1]); }
        else if(cl.length===1) (etiquette==='ges'?etiquettes.ges:etiquettes.energy).push(cl[0]);
        else if(etiquette==='both'&&cl.length===1) (cepPage!==null&&Math.abs(cl[0].v-cepPage)<=1?etiquettes.energy:etiquettes.ges).push(cl[0]);
        if(cl.length) continue; }
      if((m=t.match(/^Shab\s+m.?\s+(\d{1,3}(?:\s\d{3})*(?:,\d+)?)$/i))){ const v=lt_n(m[1]); if(v>8&&once(B,'shab',v)) emit(x,B,'shab',v,'shab',0.92,'m²'); continue; }
      if((m=t.match(/^Coefficient\s+Cep\s*\(kWh[^)]*\)\s+(\d+[.,]\d+)(.*)$/i))){ const v=lt_n(m[1]); const more=lt_nums(m[2]).length>=2;
        const f=more?'cep_after_final':'cep_before'; if(once(B,f,v)) emit(x,B,f,v,more?'cep-synthese-projet':'cep-synthese-initial',0.9,'kWhEP/m².an');
        const col=lt_numsU(m[2]); if(col.length>=3&&col[0]>v*0.5&&col[0]<v*3){ emit(x,B,'cep_max',col[0],'cep-synthese-reference',0.9,'kWhEP/m².an',{provenanceNote:'Colonne « Référence » de la synthèse (Cep réf).'}); emit(x,B,'cep_gain',col[1],'cep-synthese-gain',0.9,'%'); }
        continue; }
      if((m=t.match(/TIC\s*=\s*(\d+[.,]?\d*)\s*-\s*TIC\s*R[ée]f\s*=\s*(\d+[.,]?\d*)/i))){ const a=lt_n(m[1]), r=lt_n(m[2]); if(a>=15&&a<=45&&once(B,'tic',a)){ emit(x,B,'tic',a,'tic',0.95,'°C'); emit(x,B,'tic_ref',r,'tic-ref',0.95,'°C'); } continue; }
      if((m=t.match(/^Type\s+de\s+ventilation\s*:?\s*(.+)$/i))){ const v=lt_vent(m[1]); if(v&&once(B,`ventilation-${pagePhase}`,v)) emit(x,B,pagePhase==='before'?'ventilation_before':'ventilation',v,'ventilation',0.92); continue; }
      if((m=t.match(/^(?:Systeme\s+de\s+)?Ventil\.?\s*Ouv\.?\s*de\s*fen[eê]tres?/i))&&!/CTA\s+(?:double|simple)/i.test(t)){ if(once(B,`ventilation-fen-${pagePhase}`,'n')){ if(pagePhase==='before') emit(x,B,'ventilation_before','Ventilation naturelle','ventilation-fenetres',0.9,'',{provenanceNote:'Ventilation par ouverture des fenêtres (état initial).'}); else emit(x,B,'ventilation','Ventilation naturelle','ventilation-fenetres',pagePhase==='after'?0.9:0.84,'',pagePhase==='after'?{}:{reviewCap:0.84,provenanceNote:'Ventilation par ouverture des fenêtres (phase de la page non identifiée).'}); } continue; }
      if(!bilans&&(m=t.match(/^Type\s+de\s+Chauffage\s*:?\s+(.+)$/i))){ const v=lt_vector(m[1].replace(/Part\s+de\s+besoins.*$/i,'')); const ph=lt_phase(near)||pagePhase; if(v&&ph){ const f=ph==='before'?'heating_vector_before':'heating_vector_after'; if(once(B,f,v)) emit(x,B,f,v,'type-chauffage',0.9); } continue; }
      if(!bilans&&(m=t.match(/^Li[ée]e?\s+a\s+la\s+generation\s*:\s*(.+)$/i))){ const v=lt_vector(m[1]); const ph=lt_phase(near)||pagePhase; if(v&&ph){ const f=ph==='before'?'heating_vector_before':'heating_vector_after'; if(once(B,f,v)) emit(x,B,f,v,'generation',0.88); } continue; }
      if(!bilans&&(m=t.match(/^Type\s+d.?ECS\s*:?\s+(.+)$/i))){ const v=lt_vector(m[1]); const ph=lt_phase(near)||pagePhase; if(v&&ph){ const f=ph==='before'?'ecs_vector_before':'ecs_vector_after'; if(once(B,f,v)) emit(x,B,f,v,'type-ecs',0.88); } continue; }
      if((m=t.match(/^Surface\s+utile\s*:\s*([\d\s]+[.,]?\d*)\s*m.?\s+Surface\s+Shon/i))){ const v=lt_n(m[1]); if(v>8&&once(B,'shab',v)) emit(x,B,'shab',v,'surface-utile',0.9,'m²',{provenanceNote:'Surface utile de la fiche bâtiment (la SHON est indiquée à côté).'}); continue; }
      if((m=t.match(/^Annee\s+de\s+construction\s+(.+)$/i))){ const s=normalizeText(m[1]).toLowerCase(); const y=s.match(/^(\d{4})$/);
        if(y){ if(once(B,'construction_year',y[1])) emit(x,B,'construction_year',Number(y[1]),'annee',0.9); }
        else if(/avant\s+1948/.test(s)){ if(once(B,'built_before_1948','Oui')) emit(x,B,'built_before_1948','Oui','periode',0.95,'',{secondarySourceOk:true,provenanceNote:`Année de construction : ${m[1]}.`}); }
        else if(/entre\s+(19[4-9]\d|20\d\d)|apres\s+1948|depuis\s+19[4-9]\d/.test(s)){ if(once(B,'built_after_1948','Oui')) emit(x,B,'built_after_1948','Oui','periode',0.95,'',{secondarySourceOk:true,provenanceNote:`Année de construction : ${m[1]}.`}); }
        continue; }
      if(/^Avant\s+1948$/i.test(t)&&/construction|periode|annee/i.test(near+' '+(lines[i+1]?.t||''))){ if(once(B,'built_before_1948','Oui')) emit(x,B,'built_before_1948','Oui','periode',0.86,'',{secondarySourceOk:true}); continue; }
      // --- CYPE (comparaisons « projet <= référence gain % ») -----------------------------------------------------------
      if((m=t.match(/^(\d+[.,]\d+)\s*<=\s*(\d+[.,]\d+)\s+(-?\d+[.,]\d+)\s*%/))){
        const a=lt_n(m[1]), r=lt_n(m[2]);
        // Le libellé qui suit (« Ubat: … », « Cep: … », « Tic: … ») prime ; à défaut, l'intitulé juste au-dessus.
        const nextL=normalizeText(lines[i+1]?.t||'').toLowerCase(), prevL=normalizeText(lines[i-1]?.t||'').toLowerCase();
        const ctx=/^(?:ubat|cep|tic)\b/.test(nextL)?nextL:`${prevL} ${nextL}`;
        if(/ubat|deperdition\s+par\s+transmission/.test(ctx)&&a<6){ if(once(B,'ubat_after',a)){ emit(x,B,'ubat_after',a,'cype-ubat',0.94,'W/m².K',{provenanceNote:'Ubat projet (comparaison « projet <= référence »).'}); emit(x,B,'ubat_before',r,'cype-ubat-ref',0.8,'W/m².K',{reviewCap:0.8,provenanceNote:'Ubat de référence (Ubat réf) : retenu en « avant travaux » seulement après validation — l’état initial n’est pas donné ici.'}); } }
        else if(/consommation|cep\b/.test(ctx)&&a>=10){ if(once(B,'cep_after_final',a)){ emit(x,B,'cep_after_final',a,'cype-cep',0.94,'kWhEP/m².an'); emit(x,B,'cep',a,'cype-cep',0.9,'kWhEP/m².an'); emit(x,B,'cep_max',r,'cype-cep-ref',0.88,'kWhEP/m².an',{provenanceNote:'Cep de référence (exigence Cep ≤ Cepréf).'}); emit(x,B,'cep_before',r,'cype-cep-ref',0.8,'kWhEP/m².an',{reviewCap:0.8,provenanceNote:'Cep de référence : à valider avant de le retenir en « avant travaux ».'}); } }
        else if(/\btic\b|temperature\s+interieure/.test(ctx)&&a>=15&&a<=45){ if(once(B,'tic',a)){ emit(x,B,'tic',a,'cype-tic',0.94,'°C'); emit(x,B,'tic_ref',r,'cype-tic-ref',0.94,'°C'); } }
        continue; }
      if((m=t.match(/^Cep\s+max\s*=\s*(\d+[.,]\d+)\s*kWh/i))){ const v=lt_n(m[1]); if(once(B,'cep_max',v)) emit(x,B,'cep_max',v,'cep-max',0.9,'kWhEP/m².an'); continue; }
      if((m=t.match(/^SHON\s*\(m.?\)\s*(\d+[.,]?\d*)$/i))){ const v=lt_n(m[1]); if(v>8&&once(B,'shab',v)) emit(x,B,'shab',v,'shon',0.86,'m²',{provenanceNote:'SHON du projet (pas de SHAB / Sref dans ce document).'}); continue; }
      // Compositions « N - matériau [R=x,xx] e cm » rattachées au dernier intitulé de paroi.
      if(/^(?:Mur|Paroi|Fa[cç]ade|Plancher|Toiture|Combles?|Rampant|Terrasse|Dalle)/i.test(t)&&!/^\d/.test(t)&&!/\d\s*cm$/i.test(t)){ element=/^(?:Mur|Paroi|Fa[cç]ade)/i.test(t)?'wall':/(?:combles?|toiture|rampant|terrasse|plancher\s+haut|plafond)/i.test(t)?'roof':/plancher|dalle/i.test(t)?'floor':element; continue; }
      if(element&&(m=t.match(/^\d+\s*-\s*(.+?)\s+(?:-?\s*R\s*=\s*(\d+[.,]\d+)\s+)?(\d+(?:[.,]\d+)?)\s*cm$/i))){
        const name=insulationName(m[1]); const e=lt_n(m[3]); const R=m[2]?lt_n(m[2]):null;
        if(name&&e){ const F={wall:'wall',roof:'roof',floor:'floor'}[element]; if(once(B,`${F}_insulation`,'x')){ emit(x,B,`${F}_insulation`,name,'composition',0.9,'',{provenanceNote:`Couche « ${m[1]} » (${e} cm${R?`, R = ${R}`:''}).`}); emit(x,B,`${F}_insulation_thickness`,Math.round(e*10),'composition',0.88,'mm'); if(R) emit(x,B,`${F}_insulation_r`,R,'composition',0.9,'m².K/W'); } }
        continue; }
      // --- Pléiades RSET RT2012 ---------------------------------------------------------------------------------------
      if((m=t.match(/^Ubat\s*\(hiver\)\s*-\s*(\d+[.,]\d+)\s*-\s*(\d+[.,]\d+)/i))){ const v=lt_n(m[1]); if(once(B,'ubat_after',v)) emit(x,B,'ubat_after',v,'rset-ubat',0.9,'W/m².K'); continue; }
      if((m=t.match(/^Coefficient\s+Cep\s+kWh-?ep\/m2\s*\w*\s+(\d+[.,]\d+)\s+(\d+[.,]?\d*)\s+(-?\d+[.,]\d+)/i))){ const v=lt_n(m[1]), mx=lt_n(m[2]); if(once(B,'cep',v)){ emit(x,B,'cep',v,'rset-cep',0.95,'kWhEP/m².an'); emit(x,B,'cep_max',mx,'rset-cep-max',0.95,'kWhEP/m².an'); } continue; }
      if((m=t.match(/^Groupe\s+\d+\s*°C\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s+-?\d+[.,]\d+$/i))&&/Tic/i.test(near)){ const a=lt_n(m[1]), r=lt_n(m[2]); if(a>=15&&a<=45&&once(B,'tic',a)){ emit(x,B,'tic',a,'rset-tic',0.95,'°C'); emit(x,B,'tic_ref',r,'rset-tic-ref',0.95,'°C'); } continue; }
      if((m=t.match(/^Surface\s+utile\s+ou\s+habitable\s*\(m2?\)\s*(\d+[.,]?\d*)$/i))){ const v=lt_n(m[1]); if(v>8&&once(B,'shab',v)) emit(x,B,'shab',v,'rset-shab',0.93,'m²'); continue; }
      if((m=t.match(/^Type\s+d.?energie\s*-\s*(Gaz|Electricite|Fioul|Bois|Reseau)/i))){ const v=lt_vector(m[1]); if(v&&once(B,'heating_vector_after',v)) emit(x,B,'heating_vector_after',v,'rset-energie',0.88); continue; }
      // --- Tableau vertical : libellés « Bbio » / « Bbio max » puis valeurs ---------------------------------------------
      if(/^(?:Coefficient\s+)?Bbio$/i.test(t)&&/^Bbio\s*max$/i.test(lines[i+1]?.t||'')){ const a=lt_nums(lines[i+2]?.t||''), b=lt_nums(lines[i+3]?.t||'');
        if(a.length===1&&b.length===1&&a[0]>5&&b[0]>5){ if(once(B,'bbio',a[0])){ emit(lines[i+2],B,'bbio',a[0],'bbio-vertical',0.88,'points'); emit(lines[i+3],B,'bbio_max',b[0],'bbio-max-vertical',0.88,'points'); } } }
    }
    finBilan(); // un bilan ne déborde pas sur la page suivante
    if(pagePhase){ const av=pagePhase==='after', B=building||'Bâtiment unique', note={provenanceNote:'Étiquette de l’étude thermique (échelle DPE d’avant 2021, en kWhEP/m² SHON) ; à vérifier.',reviewCap:0.85};
      // Énergie : la valeur doit être le Cep de la page ; GES : l'état projet rappelle l'étiquette initiale, écartée.
      const en=etiquettes.energy.filter(e=>cepPage===null||Math.abs(e.v-cepPage)<=1); const ge=etiquettes.ges.filter(e=>!av||e.v!==gesInitial);
      if(en.length===1&&once(B,av?'dpe_energy_after':'dpe_energy_before',en[0].c)) emit(en[0].x,B,av?'dpe_energy_after':'dpe_energy_before',en[0].c,'etiquette-energie',0.85,'',note);
      if(ge.length===1&&once(B,av?'dpe_ges_after':'dpe_ges_before',ge[0].c)){ emit(ge[0].x,B,av?'dpe_ges_after':'dpe_ges_before',ge[0].c,'etiquette-ges',0.85,'',note); if(!av) gesInitial=ge[0].v; } }
  }
  finBilan();
  for(const [B,e] of logements) if(e.n>0) emit(e.x,B,'housing_count',e.n,'logements-zones',0.95,'',{provenanceNote:'Somme des « Nombre de logements » des zones du bâtiment.'});
  return out;
}
