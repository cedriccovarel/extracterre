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
  for(const page of doc.read?.pages||[]){
    const lines=(page.lines||[]).map(line=>({page,line,t:normalizeText(line.text||'').replace(/\s+/g,' ').trim()}));
    const pagePhase=lt_phase(lines.slice(0,12).map(x=>x.t).join(' '))||lt_phase(lines.map(x=>x.t).join(' '));
    let element=null;
    for(let i=0;i<lines.length;i++){
      const x=lines[i], t=x.t; let m;
      if(/^(?:Batiment\s*:\s*)?B[aâ]timent\s+n\s*[°º]?\s*\d+/i.test(t)&&t.length<70){ const all=[...t.matchAll(/B[aâ]timent\s+n\s*[°º]?\s*(\d+)/gi)]; building=`Batiment ${all[all.length-1][1]}`; continue; } // « Bâtiment n° 2 : Bâtiment n°5 » → bâtiment 5
      const B=building;
      const near=lines.slice(Math.max(0,i-3),i).map(y=>y.t).join(' ');
      // --- Perrenoud U-Win ---------------------------------------------------------------------------------------------
      if((m=t.match(/COEFFICIENT\s+UBAT\s*=\s*(\d+[.,]\d+)/i))){ const v=lt_n(m[1]); const ph=lt_phase(near)||pagePhase;
        if(ph==='after'){ if(once(B,'ubat_after',v)) emit(x,B,'ubat_after',v,'ubat-projet',0.94,'W/m².K'); }
        else if(once(B,'ubat_before',v)) emit(x,B,'ubat_before',v,'ubat-calcul',ph==='before'?0.94:0.86,'W/m².K',ph?{}:{reviewCap:0.86,provenanceNote:'« COEFFICIENT UBAT = » d’une page sans mention avant / après travaux : état initial présumé, à vérifier.'}); continue; }
      if((m=t.match(/^Ubat\s+du\s+b[aâ]timent\s+(\d+[.,]\d+)(.*)$/i))){ const v=lt_n(m[1]); const more=lt_nums(m[2]).length>=2;
        const f=more?'ubat_after':'ubat_before'; if(once(B,f,v)) emit(x,B,f,v,more?'ubat-synthese-projet':'ubat-synthese-initial',0.9,'W/m².K',{provenanceNote:more?'Ligne de synthèse projet (valeur suivie des colonnes de référence).':'Ligne de synthèse de l’état initial (valeur seule).'}); continue; }
      if((m=t.match(/^Coefficient\s+Cep\s*\(kWh[^)]*\)\s+(\d+[.,]\d+)(.*)$/i))){ const v=lt_n(m[1]); const more=lt_nums(m[2]).length>=2;
        const f=more?'cep_after_final':'cep_before'; if(once(B,f,v)) emit(x,B,f,v,more?'cep-synthese-projet':'cep-synthese-initial',0.9,'kWhEP/m².an'); continue; }
      if((m=t.match(/TIC\s*=\s*(\d+[.,]?\d*)\s*-\s*TIC\s*R[ée]f\s*=\s*(\d+[.,]?\d*)/i))){ const a=lt_n(m[1]), r=lt_n(m[2]); if(a>=15&&a<=45&&once(B,'tic',a)){ emit(x,B,'tic',a,'tic',0.95,'°C'); emit(x,B,'tic_ref',r,'tic-ref',0.95,'°C'); } continue; }
      if((m=t.match(/^Type\s+de\s+ventilation\s*:?\s*(.+)$/i))){ const v=lt_vent(m[1]); if(v&&once(B,'ventilation',v)) emit(x,B,'ventilation',v,'ventilation',0.92); continue; }
      if((m=t.match(/^(?:Systeme\s+de\s+)?Ventil\.?\s*Ouv\.?\s*de\s*fen[eê]tres?/i))&&!/CTA\s+(?:double|simple)/i.test(t)){ if(once(B,`ventilation-${pagePhase}`,'n')) emit(x,B,'ventilation','Ventilation naturelle','ventilation-fenetres',pagePhase==='after'?0.9:0.84,'',pagePhase==='after'?{}:{reviewCap:0.84,provenanceNote:'Ventilation par ouverture des fenêtres (état décrit par la page ; à vérifier s’il s’agit de l’état initial).'}); continue; }
      if((m=t.match(/^Type\s+de\s+Chauffage\s*:?\s+(.+)$/i))){ const v=lt_vector(m[1].replace(/Part\s+de\s+besoins.*$/i,'')); const ph=lt_phase(near)||pagePhase; if(v&&ph){ const f=ph==='before'?'heating_vector_before':'heating_vector_after'; if(once(B,f,v)) emit(x,B,f,v,'type-chauffage',0.9); } continue; }
      if((m=t.match(/^Li[ée]e?\s+a\s+la\s+generation\s*:\s*(.+)$/i))){ const v=lt_vector(m[1]); const ph=lt_phase(near)||pagePhase; if(v&&ph){ const f=ph==='before'?'heating_vector_before':'heating_vector_after'; if(once(B,f,v)) emit(x,B,f,v,'generation',0.88); } continue; }
      if((m=t.match(/^Type\s+d.?ECS\s*:?\s+(.+)$/i))){ const v=lt_vector(m[1]); const ph=lt_phase(near)||pagePhase; if(v&&ph){ const f=ph==='before'?'ecs_vector_before':'ecs_vector_after'; if(once(B,f,v)) emit(x,B,f,v,'type-ecs',0.88); } continue; }
      if((m=t.match(/^Surface\s+utile\s*:\s*([\d\s]+[.,]?\d*)\s*m.?\s+Surface\s+Shon/i))){ const v=lt_n(m[1]); if(v>8&&once(B,'shab',v)) emit(x,B,'shab',v,'surface-utile',0.9,'m²',{provenanceNote:'Surface utile de la fiche bâtiment (la SHON est indiquée à côté).'}); continue; }
      if((m=t.match(/^Annee\s+de\s+construction\s+(.+)$/i))){ const s=normalizeText(m[1]).toLowerCase(); const y=s.match(/^(\d{4})$/);
        if(y){ if(once(B,'construction_year',y[1])) emit(x,B,'construction_year',Number(y[1]),'annee',0.9); }
        else if(/avant\s+1948/.test(s)){ if(once(B,'built_before_1948','Oui')) emit(x,B,'built_before_1948','Oui','periode',0.9,'',{secondarySourceOk:true,provenanceNote:`Année de construction : ${m[1]}.`}); }
        else if(/entre\s+(19[4-9]\d|20\d\d)|apres\s+1948|depuis\s+19[4-9]\d/.test(s)){ if(once(B,'built_after_1948','Oui')) emit(x,B,'built_after_1948','Oui','periode',0.9,'',{secondarySourceOk:true,provenanceNote:`Année de construction : ${m[1]}.`}); }
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
  }
  return out;
}
