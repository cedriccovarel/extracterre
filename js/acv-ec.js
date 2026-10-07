// v2.3.4 — Notice ACV E+C- (RSEnv Pléiades / « Récapitulatif Energie Environnement »).
// Format type : notice de BET (introduction, résultats globaux) + annexe RSEnv structurée :
// « Données générales <bâtiment> », « Niveaux ENERGIE-CARBONE » (BEPOS, Eges, Eges PCE, niveaux),
// quantitatifs par contributeur (« <bâtiment> - SRT : 713.30 m2 »).
// Les valeurs de l'annexe RSEnv (sortie logiciel) priment sur les valeurs arrondies du texte de la notice.
// Les graphiques par lot sont des images : aucune valeur de lot n'est inventée.
import {normalizeText,parseFrNumber} from './utils.js';

const ec_NUM='([-+]?\\d+(?:[.,]\\d+)?)';
const ec_lineText=l=>normalizeText(l?.text||'');

export function isEcAcvNotice(doc){
  const t=String(doc?.read?.text||'').slice(0,600000);
  const ec=/niveaux?\s+energie\s*-\s*carbone/i.test(t)||/recapitulatif\s+energie\s+environnement/i.test(t);
  return ec&&/eges\s*,?\s*pce/i.test(t)&&/\beges\b/i.test(t);
}

function ec_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:ec_lineText(line)}));
  return out;
}
const ec_levelNumber=s=>{ const m=String(s||'').match(/niveau\s*(\d)/i); return m?Number(m[1]):null; };

// Libellés du tableau « Données générales » : sur une ligne (« Libellé valeur ») ou coupés
// autour de la valeur (« Energie principale pour le » / « Electricite » / « chauffage »).
const ec_GENERAL_LABELS={
  structureType:'type de structure principale',
  material:'materiau principal',
  infill:'materiaux de remplissage de facade',
  floor:'type de plancher',
  ventilation:'type de ventilation principale',
  heatingEnergy:'energie principale pour le chauffage',
  ecsEnergy:"energie principale pour l'ecs",
  coolingEnergy:'energie principale pour le froid',
  heatingGen:'generateur principal pour le chauffage',
  ecsGen:"generateur principal pour l'ecs"
};
function ec_readGeneralBlock(lines){
  const found={};
  const low=lines.map(x=>x.t.toLowerCase());
  for(const [key,label] of Object.entries(ec_GENERAL_LABELS)){
    for(let i=0;i<lines.length&&!found[key];i++){
      const l=low[i];
      if(l.startsWith(label+' ')){ const v=lines[i].t.slice(label.length).trim(); if(v) found[key]={value:v,at:lines[i]}; continue; }
      if(label.startsWith(l+' ')&&i+2<lines.length){
        const rest=label.slice(l.length+1);
        if(low[i+2]===rest||low[i+2].startsWith(rest)) { const v=lines[i+1].t.trim(); if(v) found[key]={value:v,at:lines[i+1],label:lines[i]}; }
      }
    }
  }
  return found;
}

function ec_heatingMode(gen=''){
  const s=gen.toLowerCase();
  if(/pac|pompe\s+a\s+chaleur/.test(s)){
    if(/nappe|eau\s*\/\s*eau|eau\s+glycolee|sol\s*\/\s*eau|geotherm|sonde/.test(s)) return /nappe/.test(s)?'PAC eau/eau (eau de nappe)':'PAC géothermique';
    if(/air\s*\/\s*eau/.test(s)) return 'PAC air/eau';
    if(/air\s*\/\s*air/.test(s)) return 'PAC air/air';
    return 'PAC';
  }
  if(/chaudiere.*gaz|gaz.*condensation/.test(s)) return 'Chaudière gaz';
  if(/bois|granul|biomasse/.test(s)) return 'Chaudière bois';
  if(/effet\s+joule|convecteur|radiateur\s+electrique|panneau\s+rayonnant/.test(s)) return 'Effet Joule';
  if(/reseau\s+de\s+chaleur/.test(s)) return 'Réseau de chaleur';
  return null;
}
function ec_energyVector(v=''){
  const s=v.toLowerCase();
  if(/electric/.test(s)) return 'Électricité';
  if(/gaz/.test(s)) return 'Gaz';
  if(/reseau/.test(s)) return 'Réseau de chaleur';
  if(/bois|biomasse|granul/.test(s)) return 'Bois / biomasse';
  if(/fioul/.test(s)) return 'Fioul';
  return null;
}
function ec_ecsSystem(v=''){
  const s=v.toLowerCase();
  if(/thermodynamique/.test(s)) return 'Chauffe-eau thermodynamique';
  if(/instantane/.test(s)) return 'Chauffe-eau électrique instantané';
  if(/chauffe-eau\s+electrique|ballon\s+electrique|cumulus/.test(s)) return 'Ballon électrique';
  if(/solaire/.test(s)) return 'Chauffe-eau solaire';
  return null;
}
function ec_ventilationSystem(v=''){
  const s=v.toLowerCase();
  if(/double\s+flux/.test(s)) return 'VMC double flux';
  if(/hygro\w*\s*b/.test(s)) return 'VMC Hygro B';
  if(/hygro\w*\s*a/.test(s)) return 'VMC Hygro A';
  if(/simple\s+flux/.test(s)) return 'VMC simple flux';
  if(/naturelle/.test(s)) return 'Ventilation naturelle';
  return null;
}
const ec_cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;

export function parseEcAcvNotice(doc,occ){
  const out=[]; const lines=ec_allLines(doc);
  const origin='Notice ACV E+C- — annexe RSEnv';
  const emit=(at,field,value,method,conf,unit='',extra={})=>{ if(!at||value===null||value===undefined||value==='') return; const o=occ(doc,at.page,at.line,field,value,`acv-ec:${method}`,conf,unit,{structuredPdf:true,origin,...extra}); if(o) out.push(o); };
  const find=re=>lines.find(x=>re.test(x.t));
  const numAfter=(re)=>{ const x=lines.find(l=>re.test(l.t)); if(!x) return null; const m=x.t.match(re); const v=m?parseFrNumber(m[1]):null; return v===null?null:{value:v,at:x}; };

  // --- Carbone : Eges PCE (contributeur Produits de construction et équipements) --------------------
  const egesPce=numAfter(new RegExp(`^Eges\\s*,?\\s*PCE\\s+${ec_NUM}\\s*$`,'i'));
  const egesTotal=numAfter(new RegExp(`^Eges\\s+${ec_NUM}\\s*$`,'i'));
  const egesPceSummary=numAfter(new RegExp(`Eges\\s*,?\\s*PCE\\s*=\\s*${ec_NUM}\\s*kg`,'i'));
  const egesSummary=numAfter(new RegExp(`(?:^|[-•]\\s*)Eges\\s*=\\s*${ec_NUM}\\s*kg`,'i'));
  const pce=egesPce||egesPceSummary;
  if(pce){
    const v=Math.round(pce.value*100)/100;
    const totalTxt=(egesTotal||egesSummary)?` Eges total (tous contributeurs) = ${Math.round((egesTotal||egesSummary).value*100)/100} kg éq.CO2/m².`:'';
    emit(pce.at,'ic_components',v,egesPce?'eges-pce':'eges-pce-summary',egesPce?0.95:0.92,'kgCO2e/m²',{
      provenanceNote:`Indicateur E+C- « Eges PCE » (Produits de construction et équipements, ACV statique sur 50 ans, kg éq.CO2/m² SDP) — équivalent E+C- de l'IC composants ; non comparable à l'Ic,composant RE2020 (ACV dynamique).${totalTxt}`});
    // v2.3.11 — colonnes Eges dédiées.
    emit(pce.at,'eges_pce',v,egesPce?'eges-pce-col':'eges-pce-summary-col',egesPce?0.96:0.93,'kgCO2e/m²',{provenanceNote:'Indicateur E+C- « Eges PCE » (kg éq.CO2/m² SDP, ACV statique 50 ans).'});
  }
  { const tot=egesTotal||egesSummary; if(tot) emit(tot.at,'eges_total',Math.round(tot.value*100)/100,egesTotal?'eges-total':'eges-total-summary',egesTotal?0.96:0.93,'kgCO2e/m²',{provenanceNote:'Indicateur E+C- « Eges » tous contributeurs (kg éq.CO2/m² SDP).'}); }
  { const max=numAfter(new RegExp(`^Eges\\s*,?\\s*PCE\\s*,?\\s*max\\s+${ec_NUM}\\s*$`,'i')); if(max) emit(max.at,'eges_pce_max',Math.round(max.value*100)/100,'eges-pce-max',0.93,'kgCO2e/m²'); }
  { const max=numAfter(new RegExp(`^Eges\\s*,?\\s*max\\s+${ec_NUM}\\s*$`,'i')); if(max) emit(max.at,'eges_total_max',Math.round(max.value*100)/100,'eges-max',0.93,'kgCO2e/m²'); }

  // --- Niveaux Énergie / Carbone ------------------------------------------------------------------
  const bepos=find(/^Niveau\s+BEPOS\s+Niveau\s*\d/i);
  const carbon=find(/^Niveau\s+E\s*ges\s+Niveau\s*\d/i);
  const eLevel=bepos?ec_levelNumber(bepos.t.replace(/^Niveau\s+BEPOS/i,'')):null;
  const cLevel=carbon?ec_levelNumber(carbon.t.replace(/^Niveau\s+E\s*ges/i,'')):null;
  if(eLevel) emit(bepos,'energy_level',`E${eLevel}`,'bepos-level',0.95,'',{provenanceNote:`Niveau BEPOS du référentiel E+C- (« Niveau ${eLevel} »).`});
  if(eLevel&&cLevel) emit(carbon,'performance',`E${eLevel}C${cLevel}`,'energy-carbon-level',0.88,'',{provenanceNote:`Niveaux E+C- de l'annexe RSEnv : Énergie ${eLevel} (BEPOS), Carbone ${cLevel} (Eges). À valider : le libellé « Performance » attendu peut différer.`});

  // --- Surface de référence du RSEnv (« <bâtiment> - SRT : 713.30 m2 ») ------------------------------
  const srt=numAfter(new RegExp(`-\\s*SRT\\s*:\\s*${ec_NUM}\\s*m(?:2|²)`,'i'));
  if(srt){
    const sdp=numAfter(new RegExp(`^SDP\\s+${ec_NUM}\\s*m(?:2|²)`,'i')), srtNotice=numAfter(new RegExp(`^SRT\\s+${ec_NUM}\\s*m(?:2|²)`,'i'));
    const other=[srtNotice&&`SRT ${srtNotice.value} m² (p.${srtNotice.at.page.page})`,sdp&&`SDP ${sdp.value} m² (p.${sdp.at.page.page})`].filter(Boolean);
    const diverge=other.length&&[srtNotice,sdp].some(x=>x&&Math.abs(x.value-srt.value)>0.5);
    emit(srt.at,'shab',srt.value,'rsenv-srt',diverge?0.86:0.93,'m²',{provenanceNote:`SRT déclarée dans les quantitatifs du RSEnv.${diverge?` Le texte de la notice indique une autre surface (${other.join(', ')}) : à vérifier.`:''}`});
  }

  // --- Données générales du bâtiment (tableau RSEnv) -----------------------------------------------
  // Dernière occurrence du titre : la première est souvent l'entrée du sommaire (« ....... 12 »).
  const start=lines.map((x,i)=>/^\d+\.\s*Donnees\s+generales\b/i.test(x.t)&&!/\.{4,}|\s\d+\s*$/.test(x.t)?i:-1).filter(i=>i>=0).pop()??-1;
  if(start>=0){
    let end=lines.findIndex((x,i)=>i>start&&/niveaux?\s+energie\s*-\s*carbone/i.test(x.t)); if(end<0) end=Math.min(lines.length,start+60);
    const g=ec_readGeneralBlock(lines.slice(start,end));
    const gNote='Tableau « Données générales » de l’annexe RSEnv.';
    if(g.structureType||g.material){
      const mat=g.material?.value, typ=g.structureType?.value;
      const value=mat&&typ?`${ec_cap(mat)} (${typ.toLowerCase()})`:ec_cap(mat||typ);
      emit((g.material||g.structureType).at,'structure',value,'general-structure',0.92,'',{provenanceNote:gNote});
    }
    if(g.infill){ const v=g.infill.value.toLowerCase(); const ins=/paille/.test(v)?'Paille':/chanvre/.test(v)?'Chanvre':/laine\s+de\s+bois|fibre\s+de\s+bois/.test(v)?'Laine de bois':/ouate/.test(v)?'Ouate de cellulose':null; if(ins) emit(g.infill.at,'wall_insulation',ins,'general-infill',0.9,'',{provenanceNote:`${gNote} Matériau de remplissage de façade : ${g.infill.value}.`}); }
    if(g.floor) emit(g.floor.at,'floor_structure',ec_cap(g.floor.value),'general-floor',0.9,'',{provenanceNote:gNote});
    if(g.ventilation){ const v=ec_ventilationSystem(g.ventilation.value); if(v) emit(g.ventilation.at,'ventilation',v,'general-ventilation',0.96,'',{provenanceNote:`${gNote} ${g.ventilation.value}.`}); }
    if(g.heatingEnergy){ const v=ec_energyVector(g.heatingEnergy.value); if(v) emit(g.heatingEnergy.at,'heating_vector_after',v,'general-heating-energy',0.95,'',{provenanceNote:gNote}); }
    if(g.heatingGen){ const v=ec_heatingMode(g.heatingGen.value); if(v) emit(g.heatingGen.at,'heating_mode_after',v,'general-heating-generator',0.95,'',{provenanceNote:`${gNote} Générateur : ${g.heatingGen.value}.`}); }
    if(g.ecsEnergy){ const v=ec_energyVector(g.ecsEnergy.value); if(v) emit(g.ecsEnergy.at,'ecs_vector_after',v,'general-ecs-energy',0.95,'',{provenanceNote:gNote}); }
    if(g.ecsGen){ const v=ec_ecsSystem(g.ecsGen.value); if(v) emit(g.ecsGen.at,'ecs',v,'general-ecs-generator',0.94,'',{provenanceNote:`${gNote} Générateur ECS : ${g.ecsGen.value}.`}); }
  }

  // --- ENR : panneaux photovoltaïques saisis dans les quantitatifs (lot 13) ------------------------------
  const pvLine=lines.find(x=>/photovoltaiques?/i.test(x.t)&&/\b(?:PEP|FDES|INIES|Wc|kWc)\b/i.test(x.t));
  if(pvLine){ emit(pvLine,'enr','Oui','pv-quantities',0.93,'',{provenanceNote:'Panneaux photovoltaïques saisis dans le contributeur Composants (lot 13).'}); emit(pvLine,'enr_type','Photovoltaïque','pv-quantities',0.93,'',{provenanceNote:'Panneaux photovoltaïques saisis dans le contributeur Composants (lot 13).'}); }

  // --- Département (« Département 69 - Rhône (H1 c) ») ---------------------------------------------------
  const dep=find(/^Departement\s+(\d{2,3}|2A|2B)\s*-/i);
  if(dep){ const d=dep.t.match(/^Departement\s+(\d{2,3}|2A|2B)/i)[1].padStart(2,'0'); emit(dep,'department',d,'department',0.97,'',{provenanceNote:'Données administratives de l’opération (RSEnv).'}); }

  return out;
}
