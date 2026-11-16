// v2.38.0 — Lecture de l'enveloppe dans les CCTP / DPGF : hiérarchie des lots et répertoire d'exclusions.
// Règle métier (utilisateur, 16/11/2026) : la mention d'une structure dans le CCTP du lot électricité ne vaut rien face au
// CCTP gros œuvre ; un échafaudage n'est pas une structure. Ce fichier est fait pour être complété à la main.
import {normLower} from './utils.js';

// Familles de lots, reconnues dans le nom du fichier, sinon dans l'en-tête de la 1re page (mots sans accents, minuscules).
// L'ordre compte : un fichier « LOT 13 PLOMBERIE - CHAUFFAGE - VMC » est rangé dans la première famille trouvée dans son nom.
export const LOT_FAMILIES=[
  // Annexes, synthèses et notices (souvent l'étude thermique jointe au CCTP) : document général, jamais bloqué.
  ['commun',/annexes?|syntheses?|etudes?\s+thermiques?|notes?\s+thermiques?|re\s?2020|rset|rsee|generalites|prescriptions\s+communes|communes?\s+a\s+tous|tous\s+corps\s+d.?etat|\btce\b|\bcctc\b|descriptif\s+general|notice\s+descriptive/],
  ['clos_couvert',/clos[\s_-]*couvert|enveloppe\s+du\s+batiment|macro[\s_-]*lot\s*0?1\b/],
  ['gros_oeuvre',/gros[\s_-]*(?:oeuvre|œuvre)|\bg\.?\s?o\b|\bmaconnerie|\bmacon|\binfrastructure|superstructure/],
  ['charpente',/charpente|ossature\s+bois|construction\s+bois|structure\s+bois|\bmob\b|\bclt\b/],
  ['couverture',/couverture|etancheite|toiture|zinguerie|bardeaux/],
  ['facade',/facades?|ravalement|enduits?|bardages?|\bite\b|isolation\s+(?:thermique\s+)?(?:par\s+l.?)?exterieur|vetures?|vetage/],
  ['isolation',/\bisolation\b|flocage|projection\s+isolante|calorifugeage/],
  ['menuiseries_ext',/menuiseries?\s+exterieures?|menuiseries?\s+ext\b|fenetres?|occultations?|volets?|fermetures?|portes?\s+(?:et\s+)?fenetres?/],
  ['platrerie',/platrerie|cloisons?|doublages?|faux[\s_-]*plafonds?|plafonds?\s+suspendus?|isolation\s+interieure|\biti\b/],
  ['sols',/chapes?|revetements?\s+(?:de\s+)?sols?|carrelages?|faiences?|sols?\s+souples|parquets?|resines?/],
  ['cvc',/chauffage|ventilation|\bcvc\b|\bcvcd\b|plomberie|sanitaires?|genie\s+climatique|climatisation|\bvmc\b|fluides|thermique\s+du\s+batiment/],
  ['electricite',/electricite|courants?\s+(?:forts|faibles)|\bcfo\b|\bcfa\b|eclairage|photovolta/],
  ['serrurerie',/serrurerie|metallerie|garde[\s-]*corps|ferronnerie/],
  ['menuiseries_int',/menuiseries?\s+interieures?|menuiseries?\s+int\b|agencement|placards?|portes?\s+interieures?/],
  ['peinture',/peintures?|signaletique|nettoyage|revetements?\s+muraux/],
  ['vrd',/\bvrd\b|espaces?\s+verts?|amenagements?\s+exterieurs?|voiries?|paysag|clotures?|terrassements?/],
  ['ascenseur',/ascenseurs?|elevateurs?|monte[\s-]*charges?/],
];

// Lots dont un CCTP / DPGF peut renseigner chaque donnée d'enveloppe. Absent de la liste = lu ailleurs (étude thermique,
// RSET…) mais pas dans ce lot. Lot non reconnu : lecture conservée (on ne bloque pas ce qu'on ne sait pas classer).
const STRUCT=['clos_couvert','gros_oeuvre','charpente','commun'];
export const ENVELOPE_LOTS={
  structure:[...STRUCT,'facade'], wall_structure:[...STRUCT,'facade'],
  roof_structure:[...STRUCT,'couverture'], floor_structure:STRUCT,
  wall:['clos_couvert','gros_oeuvre','charpente','facade','isolation','platrerie','commun'],     // isolant des murs (ITE / ITI)
  roof:['clos_couvert','gros_oeuvre','charpente','couverture','isolation','platrerie','commun'], // isolant de toiture / combles
  floor:['clos_couvert','gros_oeuvre','sols','isolation','platrerie','commun'],                // isolant de plancher bas
  window:['clos_couvert','menuiseries_ext','facade','commun']
};

// Répertoire d'exclusions : ouvrages qui ne sont pas la structure ni l'isolation du bâtiment, même s'ils en ont le vocabulaire.
// Une ligne qui en parle n'alimente jamais une donnée d'enveloppe. Ajouter une ligne = [motif, raison affichée].
export const ENVELOPE_EXCLUSIONS=[
  [/echafaudages?|etaiements?|\betais?\b|etayage|platelage/,'ouvrage provisoire de chantier'],
  [/base[\s-]*vie|cantonnements?|installations?\s+de\s+chantier|bungalows?|palissades?|baraquements?|clotures?\s+de\s+chantier/,'installation de chantier'],
  [/garde[\s-]*corps|main[\s-]*courantes?|lisses?\s+de\s+protection|rampes?\s+d.?escalier/,'garde-corps et protections'],
  [/clotures?|portails?|portillons?|murets?|murs?\s+de\s+cloture|murs?\s+de\s+soutenement/,'clôture et murs extérieurs'],
  [/regards?\s+(?:de\s+visite|d.?eaux|ep\b|eu\b|ev\b|beton|de\s+branchement)|caniveaux?|avaloirs?|fosses?\s+(?:septiques?|a\s+ascenseur)|cuves?|bassins?\s+de\s+retention|puisards?/,'réseaux et ouvrages enterrés'],
  [/massifs?\s+(?:support|d.?ancrage|beton\s+pour)|socles?|plots?\s+(?:beton|support)|platines?|chemins?\s+de\s+cables?|supports?\s+(?:d.?equipement|de\s+machine|de\s+pac|de\s+groupe)/,'support d’équipement'],
  [/auvents?|marquises?|pergolas?|carports?|abris?\s+(?:velos?|a\s+velos|poubelles?|de\s+jardin|bus)|locaux?\s+(?:velos?|poubelles?|ordures)|ediculess?|kiosques?/,'annexe extérieure'],
  [/mobiliers?|jardinieres?|bacs?\s+a\s+plantes?|bancs?\s+publics?|signaletique|totems?/,'mobilier et signalétique'],
  [/gaines?\s+(?:techniques?|palieres?)|trappes?\s+(?:de\s+visite|d.?acces)|coffres?\s+(?:de\s+volet|techniques?)|soffites?/,'gaines et habillages techniques'],
  [/protections?\s+(?:provisoires?|des\s+ouvrages)|bache|film\s+de\s+protection|nettoyage\s+de\s+chantier/,'protection de chantier'],
  [/maquettes?|prototypes?|echantillons?|essais?\s+(?:de\s+convenance|in\s+situ)|planches?\s+d.?essai/,'échantillons et essais']
];

// Famille du lot d'un document CCTP / DPGF ('' si non reconnue).
export function lotFamily(doc){
  const name=normLower(String(doc?.name||'').replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_]+/g,' '));
  // En-tête : seulement l'intitulé « LOT n … » de la 1re page (un sommaire qui cite tous les lots ne décide pas).
  const lines=String(doc?.read?.pages?.[0]?.text||'').slice(0,1500).split(/\r?\n/).map(l=>normLower(l));
  let title=''; for(const l of lines){ const m=l.match(/\blot\s*(?:n\W{0,2})?\s*\d{1,2}[a-z]?\b\s*[-–:.]?\s*(.{3,80})/); if(m){ title=m[1]; break; } }
  for(const src of [name,title]){ for(const [fam,re] of LOT_FAMILIES) if(re.test(src)) return fam; }
  return '';
}
// Le lot de ce document peut-il renseigner ce champ (clé de ENVELOPE_LOTS) ?
export function lotAllows(family,key){ if(!family) return true; const ok=ENVELOPE_LOTS[key]; return !ok||ok.includes(family); }
// Raison d'exclusion d'un extrait (texte), ou ''.
export function envelopeExclusion(text){ const t=normLower(String(text||'')); for(const [re,why] of ENVELOPE_EXCLUSIONS) if(re.test(t)) return why; return ''; }
export const ENV_READ=2; // version des règles d'enveloppe (rattrapage des lectures conservées, cf. engine)
