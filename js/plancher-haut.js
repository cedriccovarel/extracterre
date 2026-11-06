// ExtracTerre v2.20.2 — « Planchers hauts » (roof_structure) : le matériau / la structure du plancher haut
// (dalle béton, poutrelles-hourdis, prédalle, plancher bois, charpente…) ; sans matériau écrit, aucune valeur (jamais de défaut),
// jamais le statut de la toiture (« toiture terrasse non accessible », « toiture en pente ») qui n'est pas demandé.
import {normLower} from './utils.js';

const PH_MATS=[
  ['Poutrelles-hourdis',/poutrell\w*|hourdis|entrevous/],
  ['Prédalle',/predalles?\b/],
  ['Bac acier collaborant',/(?:bac|plancher)\s+(?:acier\s+)?collaborant/],
  ['Plancher bois',/plancher\s+bois|solivage|solives?\b|\bclt\b|bois\s+lamelle\s+croise|bois\s+massif|caissons?\s+bois|dalle\s+bois/],
  ['Charpente bois',/charpente\s+(?:en\s+)?bois|charpente\s+traditionnelle|fermettes?\b|chevrons?\b/],
  ['Charpente métallique',/charpente\s+(?:metallique|acier)/],
  ['Bac acier',/bacs?\s+acier/],
  ['Dalle béton',/dalle|beton|\bb\.?a\.?\b/]
];
// Matériau / structure du plancher haut écrit dans le libellé, sinon null (« combles » seul n'est pas un matériau).
export function roofStructureFrom(text){
  const t=normLower(text); if(!t.trim()) return null;
  for(const [v,re] of PH_MATS) if(re.test(t)) return v;
  return null;
}
// Statut de toiture sans matériau (terrasse accessible ou non, végétalisée, en pente…).
export const isRoofStatusOnly=v=>{ const t=normLower(v); return /terrasse|toiture|\ben\s+pente\b|rampant|\baccessible|vegetalis|\bcombles?\b/.test(t)&&!roofStructureFrom(t); };
// Valeur proposée pour « Planchers hauts » : matériau gardé, statut converti en matériau si le texte en contient un, sinon écarté.
export function cleanRoofStructure(v){ if(v==null||v==='') return v; const s=String(v); if(!isRoofStatusOnly(s)) return /terrasse|toiture|combles?/i.test(s)?roofStructureFrom(s)||null:s; return null; }
