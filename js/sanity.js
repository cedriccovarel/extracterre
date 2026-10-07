// v2.3.12 — Garde-fous à l'extraction, tirés du pack d'amélioration (signalements bêta « valeur fausse ») :
//  • nombre collé à un libellé : « RT2012 » → 2012, « Bat.1 » / « Article 7-1 » → 1, « kgCO2e/m² » → 2,
//    « Groupe T3 » → 3, « Cep-20% » → -20, « 1.6.- Justification » → 6 ;
//  • valeur hors plage physique pour le champ : Cep = 0,904 (ratio Cep/Cepréf), Tic = 9 (numéro de groupe),
//    épaisseur 88 160 mm (« 88.16 m² »), Cep électricité 39 971 (kWh annuels), Ic énergie = 2 (exposant).
// Une occurrence rejetée ici ne masque plus la bonne valeur lors de la consolidation (la cohérence, elle, n'agit
// qu'après coup). Les valeurs XML, manuelles et validées ne sont jamais filtrées.
import {normalizeText} from './utils.js';

export const EXTRACTION_RANGES=Object.freeze({
  bbio:[5,400], bbio_max:[5,400], cep:[10,1500], cep_max:[30,1500], cepnr:[5,1500], cepnr_max:[20,1500],
  cep_before:[10,2500], cep_after_final:[10,1500], ubat_before:[0.05,5], ubat_after:[0.05,5],
  tic:[15,45], tic_ref:[15,45], dh:[0,3000], dh_max:[300,3000],
  cep_cooling:[0,400], cep_lighting:[0,200], cep_aux_vent:[0,200], cep_aux_dist:[0,200], cep_mobility:[0,200],
  cep_electricity:[0,1000], cep_gas:[0,1500], cep_district:[0,1500], cep_biomass:[0,1500],
  shab:[8,500000], housing_count:[1,5000], construction_year:[1000,2100],
  wall_insulation_thickness:[5,800], roof_insulation_thickness:[5,1000], floor_insulation_thickness:[5,800],
  wall_insulation_r:[0.2,20], roof_insulation_r:[0.2,25], floor_insulation_r:[0.2,20],
  ic_components:[20,4000], ic_site:[0,400], ic_energy:[5,3000], ic_construction:[20,5000], stock_c_per_m2:[0,400],
  ic_energy_heating:[0,2000], ic_energy_ecs:[0,2000], ic_energy_cooling:[0,1000], ic_energy_aux_vent:[0,500], ic_energy_aux_dist:[0,500], ic_energy_mobility:[0,500],
  bbio_gain:[-100,100], cep_gain:[-100,100], cepnr_gain:[-100,100]
});
const sn_NUM_FIELDS=new Set([...Object.keys(EXTRACTION_RANGES),...Array.from({length:13},(_,i)=>`ic_lot_${i+1}`)]);
const sn_YEAR_LIKE=/^(?:19|20)\d\d$/;

function sn_forms(v){
  const n=Number(v); if(!Number.isFinite(n)) return [];
  const s=String(Math.abs(n)); const neg=n<0?'-':''; const out=new Set([neg+s,neg+s.replace('.',',')]);
  if(/^0\./.test(s)){ out.add(neg+s.slice(1)); out.add(neg+s.slice(1).replace('.',',')); }
  // valeurs lues avec zéros de fin (« 1,150 », « 130,00 »)
  for(const d of [1,2,3]){ const f=Math.abs(n).toFixed(d); out.add(neg+f); out.add(neg+f.replace('.',',')); }
  return [...out].filter(Boolean).sort((a,b)=>b.length-a.length);
}
// La valeur apparaît-elle dans l'extrait uniquement « collée » à un libellé ?
export function numberOnlyGlued(value,excerpt=''){
  const ex=normalizeText(String(excerpt||'')); if(!ex) return false;
  const forms=sn_forms(value); if(!forms.length) return false;
  let any=false, standalone=false;
  for(const f of forms){
    let i=-1;
    while((i=ex.indexOf(f,i+1))>=0){
      const before=ex.slice(Math.max(0,i-2),i), after=ex.slice(i+f.length,i+f.length+2);
      const b1=before.slice(-1), a1=after.slice(0,1);
      // Fragment d'un autre nombre (« 722,94 » pour 22,94) : ni occurrence propre ni occurrence collée.
      if(/\d/.test(b1)||(/\d/.test(a1))||(/^[.,]\d/.test(after)&&!/[A-Za-z]/.test(b1))) continue;
      any=true;
      const gluedBefore=/[A-Za-z²³]/.test(b1)||/\d[.,]$/.test(before)||(b1==='-'&&/[A-Za-z0-9.]/.test(before.slice(0,1)))||(b1==='.'&&/[A-Za-z]/.test(before.slice(0,1)));
      const gluedAfter=/[A-Za-z0-9²³]/.test(a1)&&!/^(?:m|c|k|W|h|°|p)/i.test(a1)?true:(/^[.,]\d/.test(after))||/^\d/.test(a1);
      const pct=/^\s?%/.test(ex.slice(i+f.length,i+f.length+2));
      if(!gluedBefore&&!gluedAfter&&!pct) { standalone=true; break; }
    }
    if(standalone) break;
  }
  return any&&!standalone;
}
// Exposant isolé (« m² ») lu comme valeur, « Liens vers la CTA », département suivi d'autre texte…
export function sanitizeOccurrence(o){
  if(!o) return null;
  const m=String(o.method||'');
  if(o.userValidated||/^(?:xml:|manual:)/.test(m)||o.structuredXml) return o;
  const f=o.field; let v=o.value;
  if(f==='department'&&typeof v==='string'){ const d=normalizeText(v).match(/^\s*(\d{2,3}|2A|2B)\b/i); if(!d) return null; if(d[1]!==v) return {...o,value:d[1].toUpperCase().padStart(2,'0')}; }
  if(f==='ventilation'&&/^CTA$/i.test(String(v))&&/liens?\s+vers\s+la\s+cta/i.test(o.excerpt||'')&&!/(?:^|[^a-z])cta\s+(?:double|simple|avec|a\s|à\s)/i.test(o.excerpt||'')) return null;
  // Hiérarchie des sources apprise des décisions ✓/✕ du journal (taux d'acceptation des candidats « à vérifier ») :
  const dt=String(o.docType||''), present=/^tags:presence/.test(m), label=/^tags:label-value/.test(m);
  // « ENR » détecté par simple présence du mot : 0 accepté sur 34 (contrats, CCTP, descriptifs) → jamais proposé.
  if(present&&f==='enr'&&!/RSET|RSEE|thermique|RT Existant|RT2012/.test(dt)) return null;
  // Mentions / rénovation par présence dans un CCTP ou un document non classé : 2 acceptés sur 24.
  if(present&&/^(?:mention_|renovation$)/.test(f)&&/^(?:CCTP|Document inconnu|DPGF)$/.test(dt)) return null;
  // Mentions via libellé dans un descriptif (0/5) ; planchers hauts via libellé d'un document non classé (0/4).
  if(label&&/^mention_/.test(f)&&dt==='Descriptif du projet') return null;
  if(label&&f==='roof_structure'&&dt==='Document inconnu') return null;
  // Occultations devinées par le contexte d'un document non classé (0/4).
  if(/^windows:shading-context/.test(m)&&dt==='Document inconnu') return null;
  // Structure des parois devinée par le contexte d'une étude RT existant (2/12) : reste à vérifier, en bas de file.
  if(/^envelope:structure-context/.test(m)&&/^(?:wall_structure|floor_structure|roof_structure)$/.test(f)&&dt==='RT Existant') return {...o,confidence:Math.min(o.confidence||0,0.72),reviewCap:0.72};
  // Gain Cep recalculé depuis une ligne de synthèse RSET (0/4) : à vérifier.
  if(/^rset:cep-summary-row/.test(m)&&f==='cep_gain') return {...o,confidence:Math.min(o.confidence||0,0.8),reviewCap:0.8};
  if(!sn_NUM_FIELDS.has(f)) return o;
  const n=typeof v==='number'?v:Number(String(v).replace(',','.'));
  if(!Number.isFinite(n)) return o;
  const r=EXTRACTION_RANGES[f]||(/^ic_lot_/.test(f)?[-100,1500]:null);
  if(r&&(n<r[0]||n>r[1])) return null;
  // Année prise pour une valeur (« RT2012 », « RE2020 ») hors du champ année.
  if(f!=='construction_year'&&sn_YEAR_LIKE.test(String(n))&&/\b(?:RT|RE|E\+C-?)\s?\d{4}\b|\bRT\s?2012\b|\bRE\s?2020\b/i.test(o.excerpt||'')) return null;
  // Ubat entier ≥ 3 : numéro de chapitre ou de page (« 1.6.1.- … Ubat 6 »), jamais un coefficient W/m².K.
  if(/^ubat_/.test(f)&&Number.isInteger(n)&&n>=3) return null;
  // Numéro de page d'un sommaire (« Justification du calcul …………… 6 ») pris pour une valeur.
  { const ex=normalizeText(o.excerpt||''); const pages=[...ex.matchAll(/\.{5,}\s*(\d{1,3})\b/g)].map(x=>Number(x[1])); if(pages.includes(n)&&/\.{5,}/.test(ex)) return null; }
  // Valeurs issues des parseurs dédiés à une sortie structurée : leur lecture est positionnelle, pas de contrôle d'extrait.
  if(o.structuredPdf||Number.isFinite(o.dedicatedRank)) return o;
  if(o.excerpt&&numberOnlyGlued(n,o.excerpt)) return null;
  return o;
}
export function sanitizeOccurrences(list=[]){ return (list||[]).map(sanitizeOccurrence).filter(Boolean); }
