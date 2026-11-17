// v2.6.0 — Recherches personnalisées : grilles de critères modifiables par l'utilisateur (mots-clés, synonymes, contexte,
// exclusions, type de réponse), appliquées au texte des documents d'un projet. Chaque résultat cite le document, la page et
// la ligne : une recherche ne produit jamais de valeur absente des documents. Les mots-clés peuvent être proposés par l'IA
// (Ollama en local), seule la description du critère lui est envoyée.
import {normLower,parseFrNumber,stripUnitExponents} from './utils.js';

export const SEARCH_KINDS={presence:'Présence',number:'Nombre',text:'Texte',stats:'Statistiques',field:'Rappel de colonne'};
// v2.23.0 — « Rappel de colonne » : reprend la valeur retenue d'une colonne (onglet Thermique, Enveloppe…) pour chaque bâtiment,
// avec sa source (document, page, extrait) ; aucun mot-clé, aucune valeur nouvelle.
// v2.8.2 — critère « Statistiques » (tableaux de surfaces) : une valeur par ligne trouvée, puis effectif, min, moyenne, max et centiles.
export const STAT_KEYS=[['n','Nombre'],['min','Min'],['mean','Moyenne'],['max','Max'],['p10','P10'],['p25','P25'],['p50','Médiane'],['p75','P75'],['p90','P90']];
const srch_pct=(sorted,q)=>{ const h=(sorted.length-1)*q, lo=Math.floor(h); return sorted[lo]+(sorted[Math.min(lo+1,sorted.length-1)]-sorted[lo])*(h-lo); }; /* interpolation linéaire, comme CENTILE.INCLURE d'Excel */
export function srchStats(values){
  const v=values.filter(Number.isFinite).sort((a,b)=>a-b); if(!v.length) return null; const r=x=>Math.round(x*100)/100;
  return {n:v.length,min:v[0],mean:r(v.reduce((a,b)=>a+b,0)/v.length),max:v[v.length-1],p10:r(srch_pct(v,.1)),p25:r(srch_pct(v,.25)),p50:r(srch_pct(v,.5)),p75:r(srch_pct(v,.75)),p90:r(srch_pct(v,.9))};
}
// Nombre isolé d'une ligne de tableau : « A101 » (n° de logement) ou « R+2 » ne sont pas des surfaces.
const srch_CELL_RE=/(?<![\w.,+\/-])(\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?![\d])\s*([a-z²³%]{0,3}\d?)/gi;
function srch_cellNumbers(line,unit){
  const u=normLower(unit).replace(/\s+/g,''), units=u==='m2'||u==='m²'?['m2','m²','']:u?[u,'']:null; const out=[];
  for(const m of line.matchAll(srch_CELL_RE)){ const n=parseFrNumber(m[1]); if(n===null) continue; const after=normLower(m[2]||'').replace(/\d$/,''); if(units&&!units.includes(after)) continue; out.push(n); }
  return out;
}
const srch_uidS=()=>`c${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
// v2.40.1 — l'éditeur affiche les termes séparés par « , » : une virgule à l'intérieur d'une expression (« re:serrure[^\n]{0,40}3 points »)
// coupait la règle en deux morceaux qui ne trouvaient plus rien (faux négatifs : portes 3 points, portail de parking…).
// Découpe hors accolades / crochets / parenthèses, et recollage des règles déjà coupées dans les grilles enregistrées.
const srch_open=t=>{ let d=0; for(const ch of t){ if('{[('.includes(ch)) d++; else if('}])'.includes(ch)) d--; } return d; };
function srch_splitTerms(str){ const out=[]; let cur='', d=0;
  for(const ch of String(str??'')){ if('{[('.includes(ch)) d++; else if('}])'.includes(ch)) d=Math.max(0,d-1);
    if(d===0&&/[,;\n]/.test(ch)){ out.push(cur); cur=''; } else cur+=ch; }
  out.push(cur); return out; }
function srch_rejoin(items){ const out=[]; let cur=null;
  for(const raw of items){ const t=String(raw??'').trim(); if(cur!==null){ cur+=','+t; if(srch_open(cur)<=0){ out.push(cur); cur=null; } continue; }
    if(/^re:/i.test(t)&&srch_open(t)>0) cur=t; else out.push(t); }
  if(cur!==null) out.push(cur); return out; }
const srch_list=v=>[...new Set(srch_rejoin(Array.isArray(v)?v:srch_splitTerms(v)).map(s=>String(s??'').trim()).filter(Boolean))].slice(0,60);
const srch_normS=s=>normLower(s).replace(/[’'`]/g,' ');
const srch_numOrNull=v=>{ const n=typeof v==='number'?v:parseFrNumber(String(v??'')); return Number.isFinite(n)?n:null; };

// Grille reçue d'un fichier, de l'IA ou du stockage local : champs attendus seulement, typés un par un.
// v2.29.0 — lots de CCTP utiles à une grille (import massif : les autres lots ne sont pas lus). Déduits des thèmes quand la
// grille n'en a pas encore ; modifiables dans l'éditeur (« Lots de CCTP à lire »).
const SRCH_LOT_RULES=[
  [/s[ée]curit|fen[êe]tre|porte|hall|abord|parking|acc[èe]s|intrusion/i,['menuiserie','menuiseries exterieures','menuiseries interieures','serrurerie','metallerie','electricite','courants faibles','controle d acces','interphonie','vrd','espaces exterieurs','amenagements exterieurs','cloture','portail','automatisme','fermeture']],
  [/brasseur|ventilateur/i,['electricite','cvc','chauffage','ventilation','vmc','plomberie','climatisation']],
  [/clim|refroidi/i,['cvc','chauffage','ventilation','vmc','climatisation','plomberie']],
  [/mode constructif|structure|constructi/i,['gros oeuvre','gros-oeuvre','maconnerie','structure','ossature bois','beton']]
];
// v2.39.0 — lots de CCTP toujours lus quand l'import massif filtre les lots : ils portent les isolants et les parois (colonnes
// d'enveloppe), indépendamment des grilles de Recherches.
export const CCTP_ENVELOPE_LOTS=['isolation','isolation thermique','ite','facade','facades','ravalement','bardage','platrerie','doublage','doublages','cloison','faux plafond','plafond','charpente','couverture','etancheite','chape','chapes','gros oeuvre','gros-oeuvre','maconnerie','structure','ossature bois','menuiseries exterieures'];
export function withEnvelopeLots(lots){ return lots?.length?[...new Set([...lots,...CCTP_ENVELOPE_LOTS])]:[]; }
export function gridCctpLots(g){
  if(Array.isArray(g?.cctpLots)&&g.cctpLots.length) return g.cctpLots;
  const names=[...(g?.themes||[]).map(t=>t.name),...(g?.criteria||[]).map(c=>c.theme)].join(' | ');
  return [...new Set(SRCH_LOT_RULES.filter(([re])=>re.test(names)).flatMap(([,lots])=>lots))];
}
export function normalizeGrid(g={}){
  const themes=(Array.isArray(g.themes)?g.themes:[]).map(t=>({name:String(t?.name??'').trim().slice(0,120),min:Math.max(0,Math.round(srch_numOrNull(t?.min)??0)),required:srch_list(t?.required),applicableIf:String(t?.applicableIf??'').trim()})).filter(t=>t.name);
  const criteria=(Array.isArray(g.criteria)?g.criteria:[]).map(c=>({id:String(c?.id||srch_uidS()).replace(/[^\w-]/g,'').slice(0,40)||srch_uidS(),theme:String(c?.theme??'').trim().slice(0,120),label:String(c?.label??'').trim().slice(0,200),
    description:String(c?.description??'').trim().slice(0,600),kind:SEARCH_KINDS[c?.kind]?c.kind:'presence',unit:String(c?.unit??'').trim().slice(0,20),min:srch_numOrNull(c?.min),max:srch_numOrNull(c?.max),
    field:String(c?.field??'').replace(/[^\w]/g,'').slice(0,40),keywords:srch_list(c?.keywords),context:srch_list(c?.context),exclude:srch_list(c?.exclude),weak:srch_list(c?.weak),excludeNear:srch_list(c?.excludeNear),allOf:srch_list(c?.allOf),inverse:c?.inverse===true,docContext:c?.docContext===true,window:Math.min(15,Math.max(0,Math.round(srch_numOrNull(c?.window)??4)))})).filter(c=>c.label);
  for(const c of criteria) if(c.theme&&!themes.some(t=>t.name===c.theme)) themes.push({name:c.theme,min:0,required:[],applicableIf:''});
  let rulesVersion=Math.max(0,Math.round(srch_numOrNull(g.rulesVersion)??0));
  if(g.id==='securite-logements'){ srch_migrateSecurity(criteria); if(rulesVersion<2){ srch_securityV2(criteria); rulesVersion=2; } }
  return {rulesVersion,id:String(g.id||`g${Date.now().toString(36)}`).replace(/[^\w-]/g,'').slice(0,40),name:String(g.name||'Nouvelle recherche').trim().slice(0,80),description:String(g.description??'').trim().slice(0,2000),
    docFilter:String(g.docFilter??'').trim().slice(0,200),themes,criteria,cctpLots:srch_list(g.cctpLots)};
}

// v2.14.0 — grille Sécurité déjà enregistrée : « A2P » ou « BP1 » seuls passent en indices insuffisants, les clôtures et
// barrières de chantier sont écartées ; les autres termes saisis par l'utilisateur sont gardés.
const SRCH_WEAK_DOOR=['re:\\ba2p\\b','re:\\bbp\\s?[123]\\b'], SRCH_SITE_FENCE=['chantier','barriere','barrieres','heras','palissade'], SRCH_HALL_THROUGH=['hall traversant','halls traversants'];
// v2.41.0 — grille Sécurité, règles v2 (vérifiées sur 647 opérations réelles) : le terme et son contexte sur la même ligne (ou à
// une ligne près) au lieu de 4 à 8 lignes autour, et exclusions ciblées. Faux positifs relevés avec les règles v1 : « locaux
// aveugles » (interrupteurs lumineux), « groupe non traversant » (RE2020), IK08 des luminaires, « 150 lux » des escaliers,
// « portail provisoire » de chantier, « Tli_sp = 0.442 », « pas de sous-sol », « alimentation ascenseur »…
// Appliquées une fois aux grilles enregistrées (rulesVersion < 2) ; une règle modifiée ensuite par l'utilisateur est gardée.
const SEC_44='re:(?<![\\d.,/])44[./]2(?![\\d])', SEC_RDC=['rez de chaussee','re:\\brdch?\\b','re:\\bR\\s?\\+\\s?0\\b','effraction','accessibles? depuis l exterieur'];
const SEC_ACCESS='(?:vigik|badges?|intratone|digicode|clavier|code d acces|controle d acces|telecommandes?|bips?|emetteurs?|platine|interphon\\w*|visiophon\\w*|videophon\\w*|ventouse|gache electrique|lecteur)';
// Bloc-porte BP1 « ou équivalent » : BP1/2/3, bloc-porte anti-effraction ou blindé, anti-effraction niveau 1, classe CR2/CR3 (EN 1627).
const SEC_BP_EQ='re:\\bbp\\s?[123]\\b|blocs?[- ]?portes?[^\\n]{0,60}(?:anti[- ]?effraction|blinde)|anti[- ]?effraction (?:de )?(?:niveau|classe) [123]|\\bcr\\s?[23]\\b';
export const SECURITY_RULES_V2={
  porte_a2p:{keywords:['re:\\ba2p\\s*(?:bp\\s?[123]|\\*|[123]\\s*etoile)','re:\\bbp\\s?[123]\\b.{0,40}\\ba2p\\b','re:blocs?[- ]?portes?[^\\n]{0,60}(?:anti[- ]?effraction|blinde)'],allOf:['re:\\ba2p\\b','re:\\bbp\\s?[123]\\b'],context:['porte','portes','bloc porte','blocs portes','serrure','serrures'],exclude:['re:sans\\s+bp','classement croissant','afin d obtenir','re:\\bnf\\s?p\\s?\\d','norme','normes'],window:8},
  fen_volets:{keywords:['anti soulevement','anti relevage','anti remontee','frein anti retour','re:verrou\\w* retardateur','re:volets?[^\\n]{0,60}retardateur d effraction','re:systeme (?:automatique )?de blocage[^\\n]{0,40}volets?','re:volets?[^\\n]{0,40}systeme (?:automatique )?de blocage','re:verrou\\w*\\s+(?:automatique|anti)','re:verrouillage automatique (?:du tablier|de la lame)','blocage du tablier'],context:['volet','tablier','re:lames? finales?','re:\\bvr\\b','rez de chaussee','re:\\brdch?\\b'],exclude:['baignoire','baignoires','receveur','douche','porte de garage','portail','gache','gaches'],window:3},
  // Choix utilisateur (17/11/2026, option b) : un 44.2 dans un CCTP de menuiseries extérieures compte, même sans « RDC ».
  fen_442:{docContext:true,keywords:[SEC_44,'re:\\bsp\\s?10\\b','retardateur d effraction','re:\\bp[45]a\\b'],context:[...SEC_RDC,'re:menuiseries? exterieures?','re:\\bm(?:enuiseries?)?\\.?\\s?ext\\b','re:\\bmext\\b'],exclude:['garde corps','garde-corps','re:w/m','re:tli','re:\\buw\\b','hall','halls','re:\\bsas\\b'],window:3},
  fen_barreaux:{keywords:['grille de defense','grilles de defense','grille anti effraction','barreaudage de defense','barreaux de defense','re:barreau\\w*[^\\n]{0,40}(?:fenetres?|baies?|chassis)\\b','re:(?:fenetres?|baies?|chassis)\\b[^\\n]{0,40}barreau','re:barreau\\w*[^\\n]{0,60}(?:pose )?en tableau'],context:[],exclude:['garde corps','garde-corps','remplissage','vides entre','cantonnement','base vie','convecteur','deperdition','cloture','portail','portillon','lisse','main courante','tablier'],window:2},
  porte_3pts:{keywords:['re:serrures?\\b[^\\n]{0,60}\\b(?:3|trois) points','re:\\b(?:3|trois) points\\b[^\\n]{0,30}(?:a |à )?p[eê]nes?','re:serrures?\\b[^\\n]{0,20}multi[- ]?points?','re:cr[eé]mone[^\\n]{0,15}3\\s*points[^\\n]{0,40}a2p'],
    context:['porte palier','porte paliere','portes palieres','bloc porte palier','blocs portes paliers','porte d entree','portes d entree','porte de logement','portes de logement','porte palière','menuiserie','menuiseries','bloc porte','blocs portes'],
    exclude:['compression','fenetre','fenetres','porte fenetre','porte-fenetre','portes fenetres','chassis','trappe','trappes','antipanique','anti panique','portillon','portail','placard','placards','gaine','gaines','coffret','boite aux lettres','re:points? de fixation','local technique','locaux techniques','porte de service','portes de service','urgence','re:\\bp\\s?26\\b','re:\\bnf\\s?p\\b','norme','normes','dtu'],
    excludeNear:['trappe','trappes','trappe de visite','gaine','gaines','coffret','placard','placards'],window:8,docContext:true},
  abords_portails:{keywords:[`re:(?:portail|portillon)s?\\b[^\\n]{0,80}${SEC_ACCESS}`,`re:${SEC_ACCESS}[^\\n]{0,80}(?:portail|portillon)`,'re:(?:portail|portillon)s?\\b[^\\n]{0,40}(?:motoris|automati(?:s|que))','re:(?:moniteur|poste interieur)[^\\n]{0,60}(?:portail|portillon)'],context:[],exclude:['provisoire','chantier','non prevu','sans objet','re:\\bpas de\\b','re:\\bnf\\s?p\\s?\\d','norme','normes'],window:0},
  abords_cloture:{exclude:['chantier','barriere','barrieres','heras','palissade','provisoire','provisoires','fdes','donnee environnementale'],excludeNear:['chantier','barriere','barrieres','heras','palissade','provisoire']},
  abords_acces_unique:{keywords:['re:(?:acces|entree) (?:unique|commun)e?[^\\n]{0,60}(?:vehicules?|pietons?|residence|site|parcelle|operation|ilot)','re:(?:un |le )?seul (?:point d )?acces[^\\n]{0,60}(?:vehicules?|pietons?|residence|site|parcelle|ilot)'],context:[],exclude:['provisoire','chantier','vmc','balcon','piece de vie','sejour','allumage','trappe','face d acces','handicap'],window:0},
  abords_observables:{keywords:['surveillance naturelle','vue depuis les logements','visibles depuis les logements','re:observables? depuis (?:les |un )?logements?'],context:[],exclude:[],window:0},
  abords_ombre:{keywords:['zone d ombre','zones d ombre'],context:['exterieur','exterieurs','exterieure','exterieures','abords','espaces verts','parvis','voirie','jardin','candelabre','candelabres','borne','bornes','eclairage public'],exclude:['escalier','escaliers','marche','marches','parking','sous sol','circulation interieure','circulations interieures','palier','paliers','plafond'],window:2},
  abords_cheminement:{keywords:['re:cheminements?\\b[^\\n]{0,80}\\b(?:largeur|large)\\b','re:\\b(?:largeur|large)\\b[^\\n]{0,40}cheminement','re:allees? pietonnes?[^\\n]{0,60}\\b(?:largeur|large)\\b'],context:[],exclude:['toiture','balise','balises','eclairage','technique'],window:0},
  abords_aveugles:{keywords:[],context:[],exclude:[],window:0}, // « locaux aveugles » des CCTP = pièces sans fenêtre (électricité) : jamais une preuve ; outil Ashton seul
  hall_traversant:{keywords:['re:\\bhalls?\\b[^\\n]{0,60}non traversants?','re:non traversants?[^\\n]{0,30}\\bhalls?\\b'],weak:['re:\\bhalls?\\b[^\\n]{0,40}(?<!non )\\btraversants?\\b'],context:[],exclude:['groupe','zone d usage','logement','logements'],window:0},
  hall_vitrage:{keywords:[SEC_44,'stadip','retardateur d effraction'],context:['re:\\bhalls?\\b','ensemble de hall','ensembles de hall','porte d entree d immeuble','entree principale','sas d entree'],exclude:['re:w/m','refend','garde corps','garde-corps','debit'],window:2,docContext:true},
  hall_sas:{keywords:['re:\\bsas (?:d entree|d acces au hall|du hall|de hall|hall)\\b','re:\\bsas\\b[^\\n]{0,40}\\bhalls?\\b','re:\\bhalls?\\b[^\\n]{0,40}\\bsas\\b'],context:['vigik','badge','badges','visiophone','videophone','interphone','platine','controle d acces','ventouse','gache electrique','lecteur'],exclude:['parking','parkings','sous sol','sous-sol','cave','caves','desenfumage','depression','surpression','re:\\bpas de\\b','non prevu','velo','velos','ordures','cabinet','capital','siret','sarl','societe'],window:3,docContext:true},
  hall_ik08:{keywords:['re:\\bik\\s?(?:0?8|09|10)\\b'],context:['platine','plaque de rue','plaque d appel','visiophone','videophone','interphone','portier','poste exterieur','poste de rue'],exclude:['eclairage','luminaire','luminaires','hublot','hublots','re:\\bled\\b','re:\\d\\s?lm\\b','bouton poussoir','detecteur','applique','appliques','prise','prises','projecteur','borne','bornes'],window:1},
  hall_eclairage:{keywords:['re:\\b(?:halls?|sas d entree)\\b[^\\n\\d]{0,45}(\\d+(?:[.,]\\d+)?)(?:\\s*(?:a|et|-)\\s*\\d+)?\\s*lux','re:(\\d+(?:[.,]\\d+)?)(?:\\s*(?:a|et|-)\\s*\\d+)?\\s*lux[^\\n\\d]{0,40}\\b(?:halls?|sas d entree)\\b'],context:[],exclude:['crepusculaire','seuil','reglable','luminosite','au droit','portillon','re:acces (?:aux|au|des) halls?','exterieur','exterieure','exterieurs','abords','parvis'],window:0},
  parking_present:{keywords:['parking en sous sol','parkings en sous sol','parc de stationnement souterrain','re:parkings?\\b[^\\n]{0,30}(?:en |au |du )?(?:sous[- ]sols?|souterrains?|enterres?)','re:sous[- ]sols?\\b[^\\n]{0,40}\\b(?:parkings?|stationnement|places de stationnement|boxes?)\\b','re:\\b(?:parkings?|stationnement)\\b[^\\n]{0,40}\\bsous[- ]sols?\\b','re:parkings? (?:au |en )?(?:niveau )?(?:r|n)\\s?-\\s?[12]\\b'],context:[],exclude:['re:pas de (?:niveau de )?sous','ne prevoit pas','sans sous','aucun sous','voisin','voisines','voisins','existants'],window:0},
  parking_portail:{keywords:['re:porte (?:collective )?(?:basculante|sectionnelle|de garage)[^\\n]{0,30}(?:motoris|automat|electri)','re:portail[^\\n]{0,40}(?:parking|sous[- ]sol|garage)','re:(?:parking|sous[- ]sol|garage)s?\\b[^\\n]{0,40}(?:portail|porte (?:basculante|sectionnelle))'],
    context:['telecommande','telecommandes','emetteur','emetteurs','badge','badges','vigik','intratone','controle d acces','cle','automatique','motorise','motorisee','videophone','visiophone','digicode','clavier','bip','bips'],exclude:['non prevu','sans objet','hors lot','re:\\bpas de\\b','re::\\s*so\\b','re:\\bnf\\s?p\\s?\\d','norme','normes'],window:4},
  parking_pieton:{keywords:['re:(?:porte pietonne|portillon|porte pieton)[^\\n]{0,80}(?:parking|sous[- ]sol|garage|stationnement)','re:(?:parking|sous[- ]sol|garage|stationnement)[^\\n]{0,80}(?:porte pietonne|portillon|porte pieton)'],context:['vigik','badge','badges','controle d acces','ventouse','gache','lecteur','telecommande','cle','digicode'],exclude:['jardin','cloture','clotures','velo','velos'],window:2},
  parking_hall_badge:{context:['vigik','badge','badges','controle d acces','gache','ventouse','lecteur'],exclude:['alimentation','motoris','vehicule','vehicules','velo','velos','local','locaux','cave','caves','basculante','sectionnelle','portail','garage'],window:1},
  parking_ascenseur:{keywords:['re:ascenseurs?\\b[^\\n]{0,80}(?:sous[- ]sols?|parkings?|niveau -|\\br\\s?-\\s?[12]\\b)','re:(?:sous[- ]sols?|parkings?)[^\\n]{0,80}ascenseurs?'],context:['vigik','badge','badges','cle','controle d acces','lecteur','rfid'],exclude:['alimentation','comptage','telephon','vmc','protection depart','coffret','pompier','pompiers'],window:1},
  parking_eclairage:{keywords:['re:\\b(?:parkings?|parcs? de stationnement|stationnement|sous[- ]sols?)\\b[^\\n\\d]{0,45}(\\d+(?:[.,]\\d+)?)(?:\\s*(?:a|et|-)\\s*\\d+)?\\s*lux','re:(\\d+(?:[.,]\\d+)?)(?:\\s*(?:a|et|-)\\s*\\d+)?\\s*lux[^\\n\\d]{0,40}\\b(?:parkings?|parcs? de stationnement|stationnement|sous[- ]sols?)\\b'],context:[],exclude:['crepusculaire','seuil','reglable','luminosite','exterieur','exterieurs','voirie','espaces verts'],window:0},
  etage_escaliers:{keywords:[`re:escaliers?\\b[^\\n]{0,80}${SEC_ACCESS}`,`re:${SEC_ACCESS}[^\\n]{0,80}escaliers?\\b`],context:[],exclude:['re:\\bdad\\b','tarif','declencheur','interrupteur','eclairage','alimentation','sas d entree','sous sol','sous-sol','parking','desenfumage'],window:0},
  etage_ascenseur:{keywords:['re:ascenseurs?\\b[^\\n]{0,80}(?:badges?|vigik|controle d acces|lecteur|rfid)','re:(?:badges?|vigik|controle d acces|lecteur|rfid)[^\\n]{0,80}(?:ascenseurs?|cabines?)\\b'],context:[],exclude:['alimentation','comptage','telephon','vmc','protection depart','coffret','pompier','pompiers','lift','location','sous sol','sous-sol','parking'],window:0}
};
function srch_migrateSecurity(criteria){
  const door=criteria.find(c=>c.id==='porte_a2p'); if(door){ door.keywords=door.keywords.filter(k=>!SRCH_WEAK_DOOR.includes(k)); for(const w of SRCH_WEAK_DOOR) if(!door.weak.includes(w)) door.weak.push(w);
    const both='re:\\bbp\\s?[123]\\b.{0,40}\\ba2p\\b'; if(!door.keywords.includes(both)) door.keywords.push(both);
    for(const w of SRCH_WEAK_DOOR) if(!door.allOf.includes(w)) door.allOf.push(w); }
  // v2.16.4 — « hall traversant » sans « non » est un indice contraire, plus une preuve.
  const hall=criteria.find(c=>c.id==='hall_traversant'); if(hall){ hall.keywords=hall.keywords.filter(k=>!SRCH_HALL_THROUGH.includes(k)); for(const w of SRCH_HALL_THROUGH) if(!hall.weak.includes(w)) hall.weak.push(w); }
  // v2.19.1 — grilles déjà enregistrées : la règle du statut « Partiel » est rappelée sous le sas.
  const sas=criteria.find(c=>c.id==='hall_sas'); if(sas&&!sas.description) sas.description='Partiel : Vigik (ou badge) + visiophone, mais sans platine IK08.';
  const fence=criteria.find(c=>c.id==='abords_cloture'); if(fence) for(const k of ['exclude','excludeNear']) for(const w of SRCH_SITE_FENCE) if(!fence[k].includes(w)) fence[k].push(w);
}
// Éléments de chantier (ascenseur ou monte-charge de chantier, barrières Heras, base vie, clôtures provisoires) : jamais une preuve.
export const SEC_SITE_EXCLUDE=['chantier','chantiers','base vie','cantonnement','cantonnements','heras','provisoire','provisoires','re:monte[- ]charges?'];
// Termes ajoutés par l'utilisateur (absents de la grille d'origine) : gardés en plus des règles v2.
function srch_securityV2(criteria){ for(const c of criteria){ const r=SECURITY_RULES_V2[c.id], v1=SECURITY_GRID_V1.criteria.find(x=>x.id===c.id)||{};
    if(r) for(const [k,v] of Object.entries(r)){ if(!Array.isArray(v)){ c[k]=v; continue; } const orig=new Set(srch_list(v1[k]||[])), mine=(c[k]||[]).filter(t=>!orig.has(t)&&!v.includes(t)); c[k]=[...v,...mine]; }
  for(const w of SEC_SITE_EXCLUDE) if(!c.exclude.includes(w)) c.exclude.push(w); } }
// Terme → expression : « re:… » = expression régulière ; sinon texte comparé sans accents ni casse, espaces et tirets souples.
const srch_termCache=new Map();
export function termRegex(term){
  if(srch_termCache.has(term)) return srch_termCache.get(term);
  let re=null;
  try{
    if(/^re:/i.test(term)) re=new RegExp(term.slice(3),'i');
    else { const t=srch_normS(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/[\s-]+/g,'[\\s-]*'); re=t?new RegExp(`(?:^|[^a-z0-9])${t}(?:s|x)?(?![a-z0-9])`,'i'):null; /* pluriel accepté : « volet » trouve « volets » */ }
  }catch{ re=null; }
  srch_termCache.set(term,re); return re;
}
const srch_anyTerm=(terms,text)=>terms.some(t=>termRegex(t)?.test(text));
function srch_captured(terms,text){ for(const t of terms){ if(!/^re:/i.test(t)) continue; const m=termRegex(t)?.exec(text); if(m&&m[1]!=null){ const n=parseFrNumber(m[1]); if(n!==null) return [n]; } } return []; }
const srch_NUM_RE=/(?:^|[^\d,.])(\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*([a-z²³%€]{0,4}\d?)/gi;
function srch_numbersInLine(line,unit){
  const out=[]; const u=normLower(unit).replace(/\s+/g,''); const units=u==='m2'||u==='m²'?['m2','m²','m']:u?[u]:null;
  // Unité exacte : « 30 mm » n'est pas « 30 m ».
  for(const m of stripUnitExponents(line).matchAll(srch_NUM_RE)){ const n=parseFrNumber(m[1]); if(n===null) continue; const after=normLower(m[2]||'').replace(/\d$/,''); if(units&&!units.includes(after)) continue; out.push(n); }
  return out;
}
function srch_docLines(doc){
  return (doc.read?.pages||[]).flatMap(p=>{ const lines=Array.isArray(p.lines)&&p.lines.length?p.lines.map(l=>String(l.text||'')):String(p.text||'').split(/\r?\n/); return lines.map((t,i)=>({page:p.page,i,t:srch_normS(t),raw:t})).filter(x=>x.t.trim()); });
}

// v2.16.4 — tables Ashton (project.planTables) : hall vitré = largeur des menuiseries × 2,20 m ÷ surface du hall (≥ 30 %) ;
// hall non traversant = un seul « Accès hall » compté. Un plan sans les deux mesures du hall ne donne pas de ratio.
export const HALL_GLAZING_HEIGHT=2.2, HALL_GLAZING_MIN=0.3;
const srch_fr=(v,d=2)=>v.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});
export function srchPlanFacts(planTables){
  const out={}, glz=[], acc=[], sum=rs=>rs.reduce((a,r)=>a+(Number(r.avg)||0)*(Number(r.n)||0),0);
  for(const [docId,t] of Object.entries(planTables||{})){ const rows=t.rows||[], ref=r=>srch_normS(t.refs?.[r.key]??r.ref), at=r=>({doc:t.docName||'Plan',docId,page:(r.pages||[])[0]||'',plan:true});
    const frame=rows.filter(r=>(r.kind==='largeur'||r.kind==='longueur')&&/menuiserie|vitr|chassis/.test(ref(r))), hall=rows.filter(r=>r.kind==='surface'&&/\bhall\b/.test(ref(r))&&!/menuiserie|vitr|acces/.test(ref(r)));
    const w=sum(frame), a=sum(hall);
    if(w>0&&a>0){ const ratio=w*HALL_GLAZING_HEIGHT/a, ok=ratio>=HALL_GLAZING_MIN, pct=Math.round(ratio*100);
      glz.push({ok,pct,ev:{...at(hall[0]),line:`Ashton : menuiseries ${srch_fr(w)} m × ${srch_fr(HALL_GLAZING_HEIGHT)} m = ${srch_fr(w*HALL_GLAZING_HEIGHT)} m² pour un hall de ${srch_fr(a)} m² → ${pct} % (${ok?'≥':'<'} 30 %)`,context:'',values:[pct],ok}}); }
    const access=rows.filter(r=>r.kind==='quantite'&&/\bacces\b/.test(ref(r)));
    if(access.length){ const n=access.reduce((s,r)=>s+(Number(r.total)||0),0), ok=n===1;
      acc.push({ok,n,ev:{...at(access[0]),line:`Ashton : ${n} accès au hall compté${n>1?'s':''} → ${ok?'hall non traversant':'hall traversant'}`,context:'',values:[n],ok}}); } }
  if(glz.length) out.hall_vitrage={ok:glz.every(x=>x.ok),ev:glz.map(x=>x.ev),detail:`vitrage ${glz.map(x=>`${x.pct} %`).join(' ; ')} de la surface du hall (Ashton)`};
  if(acc.length) out.hall_traversant={ok:acc.every(x=>x.ok),ev:acc.map(x=>x.ev),detail:`${acc.map(x=>x.n).join(' ; ')} accès compté(s) dans Ashton`};
  return out;
}

// v2.18.0 — outils Ashton dédiés : depuis l'onglet Recherches, une ligne ouvre Ashton sur son seul outil de vérification ;
// la réponse (Oui / Non + mesure) revient dans project.planChecks[critère] et fait foi, sauf décision manuelle.
export const ASHTON_CHECKS=Object.freeze({
  abords_observables:'Accès observables depuis un logement',abords_separation:'Communications entre bâtiments',abords_renfoncement:'Profondeur des renfoncements',
  abords_cheminement:'Largeur des cheminements',abords_aveugles:'Locaux aveugles',hall_traversant:'Accès du hall',hall_vitrage:'Vitrage du hall'});
export const hasAshtonCheck=id=>Object.prototype.hasOwnProperty.call(ASHTON_CHECKS,id);

// Applique une grille aux documents prêts d'un projet : {criteria:{id:{found,values,evidence}}, themes:{name:{found,min,ok,applicable}}}.
// v2.23.0 — result (facultatif) = résultat du projet ({rows, finals}) pour les critères « Rappel de colonne ».
const srch_fmt=v=>typeof v==='number'?v.toLocaleString('fr-FR',{maximumFractionDigits:2}):String(v).trim();
export function runSearchGrid(grid,docs,overrides={},planTables={},planChecks={},result=null){
  const g=normalizeGrid(grid); const filter=g.docFilter?srch_list(g.docFilter):[];
  const pool=(docs||[]).filter(d=>d.status==='ready'&&d.read?.pages?.length&&!d.read?.financialQuestionnaire&&(!filter.length||filter.some(f=>normLower(`${d.name} ${d.type||''}`).includes(normLower(f)))));
  const corpus=pool.map(d=>({d,lines:srch_docLines(d)}));
  const criteria={}, plan=srchPlanFacts(planTables);
  for(const c of g.criteria){
    const ev=[]; const values=[]; const cap=c.kind==='stats'?2000:5;
    if(c.kind==='field'&&c.field) for(const row of result?.rows||[]){ const v=row?.[c.field]; if(v===undefined||v===null||String(v).trim()==='') continue;
      const o=(result.finals||[]).find(x=>x.field===c.field&&(x.building===row.building||x.building==='Bâtiment unique'));
      const n=typeof v==='number'?v:parseFrNumber(String(v)), bounded=c.min!==null||c.max!==null;
      const ok=!bounded||(Number.isFinite(n)&&(c.min===null||n>=c.min)&&(c.max===null||n<=c.max));
      ev.push({doc:o?.fileName||'Valeur retenue (sans document)',docId:o?.docId||'',page:o?.page??'',line:`${row.building} : ${srch_fmt(v)}${c.unit?` ${c.unit}`:''}`,context:String(o?.excerpt||o?.provenanceNote||'').trim().slice(0,600),values:[v],ok,building:row.building,fromField:true}); values.push(v); }
    else if(c.keywords.length||c.weak.length) for(const {d,lines} of corpus){ let perDoc=0;
      // v2.41.0 — « docContext » : le nom du document vaut contexte (« CCTP ENSEMBLES DE HALLS.pdf »).
      const docHit=c.docContext&&c.context.length&&srch_anyTerm(c.context,srch_normS(d.name));
      for(let k=0;k<lines.length&&perDoc<cap;k++){ const L=lines[k];
        // « weak » : terme insuffisant à lui seul (« A2P » sans BP ni étoile) — trouvé, il compte comme indice contraire.
        const strong=srch_anyTerm(c.keywords,L.t), weak=!strong&&srch_anyTerm(c.weak,L.t); if((!strong&&!weak)||srch_anyTerm(c.exclude,L.t)) continue;
        const near=lines.slice(Math.max(0,k-c.window),k+c.window+1).filter(x=>x.page===L.page);
        // « excludeNear » : la ligne précédente ou suivante (« Barrière Heras » au-dessus d'une hauteur) écarte la ligne.
        if(c.excludeNear.length&&[lines[k-1],lines[k+1]].some(x=>x&&x.page===L.page&&srch_anyTerm(c.excludeNear,x.t))) continue;
        if(c.context.length&&!docHit&&!near.some(x=>srch_anyTerm(c.context,x.t))) continue;
        let nums=[],ok=!weak;
        // v2.16.4 — « allOf » : tous ces termes dans le même bloc (A2P et BP1) ; l'un sans l'autre = indice contraire.
        if(c.allOf.length) ok=c.allOf.every(t=>near.some(x=>srch_anyTerm([t],x.t)));
        if(c.kind==='stats'){ const n=srch_cellNumbers(L.t,c.unit).find(x=>(c.min===null||x>=c.min)&&(c.max===null||x<=c.max)); if(n===undefined) continue; nums=[n]; values.push(n); }
        // v2.41.0 — expression avec groupe (« hall … (\d+) lux ») : seule la valeur capturée compte, pas celle des escaliers sur la même ligne.
        if(c.kind==='number'){ const capN=srch_captured(c.keywords,L.t); nums=capN.length?capN:srch_numbersInLine(L.t,c.unit); if(!nums.length&&!/\d/.test(L.t)&&lines[k+1]?.page===L.page) nums=srch_numbersInLine(lines[k+1].t,c.unit); /* valeur sur la ligne suivante seulement si le libellé n'a aucun nombre */
          if(!nums.length) continue; values.push(...nums); ok=!weak&&nums.some(n=>(c.min===null||n>=c.min)&&(c.max===null||n<=c.max)); }
        ev.push({doc:d.name,docId:d.id,page:L.page,line:L.raw.trim().slice(0,300),context:near.map(x=>x.raw.trim()).join(' / ').slice(0,600),values:nums,ok}); perDoc++; } }
    const manual=overrides?.[c.id];
    // Critère « inverse » : un résultat est un indice contraire (critère non rempli), jamais une preuve de conformité.
    let found=manual==='Oui'?true:manual==='Non'||manual==='Sans objet'?false:c.inverse?false:ev.some(e=>e.ok);
    let contrary=!manual&&(c.inverse?ev.length>0:ev.length>0&&!ev.some(e=>e.ok)), detail='';
    // Mesures Ashton : décisives pour le ratio vitré et les accès du hall ; le 44.2 reste à trouver dans les documents.
    const chk=hasAshtonCheck(c.id)&&(planChecks||{})[c.id]&&['Oui','Non'].includes(planChecks[c.id].verdict)?planChecks[c.id]:null;
    const pf=chk?{ok:chk.verdict==='Oui',detail:`Ashton${chk.detail?` : ${chk.detail}`:''}`,
      ev:[{doc:chk.docName||'Plan',docId:chk.docId||'',page:chk.page||'',plan:true,line:`Ashton (outil dédié) : ${chk.verdict==='Oui'?'conforme':'non conforme'}${chk.detail?` — ${chk.detail}`:''}${chk.comment?` · ${chk.comment}`:''}`,context:'',values:[],ok:chk.verdict==='Oui'}]}:plan[c.id];
    if(pf){ const textOk=ev.some(e=>e.ok); ev.unshift(...pf.ev); detail=pf.detail;
      const ok=c.id==='hall_vitrage'?pf.ok&&textOk:pf.ok; if(c.id==='hall_vitrage'&&pf.ok&&!textOk) detail=`À vérifier : ${pf.detail}, 44.2 non trouvé dans les documents`;
      if(!manual){ found=ok; contrary=!pf.ok; } }
    criteria[c.id]={found,contrary,detail,manual:manual||'',values:c.kind==='stats'?values:[...new Set(values)],stats:c.kind==='stats'?srchStats(values):null,evidence:ev,text:c.kind==='text'?[...new Set(ev.map(e=>e.line))].slice(0,5).join(' ; '):c.kind==='field'?srch_fieldText(ev):''};
  }
  // v2.19.1 — statut « Partiel » du sas sécurisé : Vigik (ou badge) + visiophone trouvés, mais pas de platine IK08.
  // Partiel ne compte pas comme trouvé pour le thème ; la décision manuelle « Partiel » donne le même statut.
  const sas=criteria.hall_sas;
  if(sas){
    if(sas.manual==='Partiel'){ sas.partial=true; sas.found=false; sas.contrary=false; }
    else if(!sas.manual&&sas.found){
      const t=normLower(sas.evidence.filter(e=>e.ok).map(e=>`${e.line} ${e.context}`).join(' '));
      if(/\bvigik|\bbadges?\b/.test(t)&&/\bvisiophon|\bvideophon/.test(t)&&!criteria.hall_ik08?.found){ sas.found=false; sas.partial=true; sas.detail='Vigik + visiophone, platine IK08 non trouvée'; } } }
  // v2.41.0 — bloc-porte : « Oui » seulement pour A2P + BP1 (ou BP2 / BP3, classes supérieures). A2P + équivalent (bloc-porte
  // anti-effraction ou blindé, anti-effraction niveau 1, CR2 / CR3) = « Partiel » ; A2P seul, BP1 seul, « sans BP1 » ou rien = faux.
  const door=criteria.porte_a2p;
  if(door){
    if(door.manual==='Partiel'){ door.partial=true; door.found=false; door.contrary=false; }
    else if(!door.manual&&!door.found){ const eqRe=termRegex(SEC_BP_EQ), a2p=/\ba2p\b/;
      const eq=door.evidence.find(e=>{ const t=srch_normS(`${e.line} ${e.context}`); return a2p.test(t)&&eqRe.test(t)&&!/sans\s+bp/.test(t); });
      if(eq){ door.partial=true; door.contrary=false; door.detail='A2P + équivalent du BP1, BP1 non mentionné'; } } }
  const themes={};
  for(const t of g.themes){
    const own=g.criteria.filter(c=>c.theme===t.name&&c.id!==t.applicableIf);
    const applicable=!t.applicableIf||!!criteria[t.applicableIf]?.found;
    const req=own.filter(c=>t.required.includes(c.id)), opt=own.filter(c=>!t.required.includes(c.id));
    const found=opt.filter(c=>criteria[c.id]?.found).length, reqOk=req.every(c=>criteria[c.id]?.found);
    themes[t.name]={applicable,found,min:t.min,required:req.length,requiredOk:reqOk,ok:applicable?(reqOk&&found>=t.min):null};
  }
  const fieldHits=g.criteria.filter(c=>c.kind==='field').reduce((n,c)=>n+criteria[c.id].evidence.length,0);
  return {grid:g,criteria,themes,documents:pool.map(d=>d.name),fieldHits};
}

// Rappel de colonne : « Bâtiment A : 345 ; Bâtiment B : 410 » (la valeur seule pour un bâtiment unique).
function srch_fieldText(ev){ if(ev.length===1&&ev[0].building==='Bâtiment unique') return ev[0].line.replace(/^Bâtiment unique : /,''); return ev.map(e=>e.line).join(' ; '); }
// Valeur d'un critère dans le tableau / l'export.
export function searchCellValue(c,x){
  if(!x) return '';
  if(x.manual) return x.manual;
  if(c.kind==='field') return x.contrary?`Hors seuil (${x.text})`:x.text;
  if(x.partial) return `Partiel (${x.detail})`;
  if(x.detail) return x.found?`Oui (${x.detail})`:x.contrary?`Non conforme (${x.detail})`:x.detail;
  if(x.contrary) return c.inverse?'Indice contraire':c.kind==='presence'?'Non conforme':`Hors seuil (${x.values.join(' ; ')}${c.unit?` ${c.unit}`:''})`;
  if(c.kind==='stats') return x.stats?STAT_KEYS.map(([k,l])=>`${l} ${String(x.stats[k]).replace('.',',')}`).join(' · '):'';
  if(c.kind==='number') return x.found?x.values.filter(n=>(c.min===null||n>=c.min)&&(c.max===null||n<=c.max)).join(' ; '):'';
  if(c.kind==='text') return x.text;
  return x.found?'Oui':'';
}

// —— IA : formulation des mots-clés (critère) ou de toute une grille (description). Le texte des documents n'est pas envoyé.
export function keywordPrompt(crit,grid={}){
  return {system:`Tu aides à paramétrer un moteur de recherche plein texte sur des documents techniques du bâtiment en France (CCTP, DPGF, notices, tableaux de surfaces, études thermiques). Tu proposes des mots-clés et synonymes tels qu'ils sont réellement écrits dans ces documents (vocabulaire de CCTP, abréviations, marques génériques, normes). Réponds UNIQUEMENT par un objet JSON : {"keywords":[...],"context":[...],"exclude":[...]} — keywords : 4 à 15 expressions courtes (1 à 4 mots) qui signalent le critère ; context : 0 à 8 mots qui doivent apparaître à proximité pour éviter les faux positifs (ex. l'ouvrage concerné) ; exclude : 0 à 6 expressions qui signalent un faux positif. Pas d'expressions régulières, pas de phrases.`,
    user:`Recherche : ${grid.name||''}\nThème : ${crit.theme||''}\nCritère : ${crit.label}\n${crit.description?`Précisions : ${crit.description}\n`:''}Type de réponse : ${SEARCH_KINDS[crit.kind]||'Présence'}${crit.unit?` (unité ${crit.unit})`:''}\nMots-clés actuels : ${(crit.keywords||[]).join(', ')||'aucun'}`};
}
export function gridPrompt(description){
  return {system:`Tu transformes une demande de recherche documentaire (bâtiment, France) en grille de critères pour un moteur plein texte. Réponds UNIQUEMENT par un objet JSON : {"name":"…","themes":[{"name":"…","min":<nombre de critères à trouver>}],"criteria":[{"theme":"…","label":"…","kind":"presence"|"number"|"text","unit":"","min":null,"max":null,"keywords":[...],"context":[...],"exclude":[...]}]}. kind = number quand on cherche une valeur chiffrée (surface, hauteur, épaisseur…), avec son unité et ses bornes si la demande en donne. Les mots-clés sont des expressions courtes telles qu'écrites dans les CCTP / tableaux, sans expressions régulières.`,
    user:description};
}
export function parseLlmObject(text){ const s=String(text||'').replace(/```json|```/g,''); const a=s.indexOf('{'), b=s.lastIndexOf('}'); if(a<0||b<=a) throw new Error('Réponse IA non JSON.'); return JSON.parse(s.slice(a,b+1)); }

// —— Grille fournie : sécurisation des logements (étude de l'existant du marché). Termes « re: » pour les écritures variables.
const SECURITY_GRID_V1={id:'securite-logements',name:'Sécurité des logements',docFilter:'',
  description:'Sécurisation des logements contre les intrusions, des abords, des halls, des parkings en sous-sol et des accès aux étages : indices relevés dans les CCTP (étude de l’existant).',
  themes:[{name:'Fenêtres en rez-de-chaussée',min:1},{name:'Portes d’entrée des logements',min:1},{name:'Abords extérieurs',min:5,required:['abords_portails']},
    {name:'Halls d’entrée',min:2},{name:'Parkings en sous-sol',min:3,required:['parking_portail'],applicableIf:'parking_present'},{name:'Accès aux étages',min:2}],
  criteria:[
    {id:'fen_volets',theme:'Fenêtres en rez-de-chaussée',label:'Volets roulants avec système anti-soulèvement',keywords:['anti soulevement','anti-relevage','re:verrou\\w*\\s+(?:automatique|anti)','blocage du tablier'],context:['volet','tablier']},
    {id:'fen_442',theme:'Fenêtres en rez-de-chaussée',label:'Vitrages 44.2 (retardateur d’effraction)',keywords:['re:\\b44[./ ]?2\\b','re:\\bsp\\s?10\\b','retardateur d effraction','retardateur d\'effraction'],context:['vitrage','fenetre','menuiserie','stadip','feuillete','baie']},
    {id:'fen_barreaux',theme:'Fenêtres en rez-de-chaussée',label:'Fenêtres protégées par des barreaux',keywords:['barreaux','barreaudage','grille de defense','grilles de defense','grille anti effraction'],context:['fenetre','baie','rez de chaussee','rdc','en tableau','tableau'],exclude:['cloture','portail','portillon','garde corps','garde-corps','main courante','tablier','lisse'],window:2},
    {id:'porte_3pts',theme:'Portes d’entrée des logements',label:'Porte pleine, serrure 3 points (hors 3 points de compression)',keywords:['re:serrure[^\\n]{0,40}3\\s*points','re:3\\s*points[^\\n]{0,20}(?:a|à)?\\s*p[eê]ne','re:cr[eé]mone[^\\n]{0,15}3\\s*points[^\\n]{0,40}a2p'],context:['porte palier','porte paliere','portes palieres','bloc porte palier','porte d entree','porte de logement','porte d\'entree'],exclude:['compression','fenetre','porte fenetre','porte-fenetre'],window:8},
    {id:'porte_a2p',theme:'Portes d’entrée des logements',label:'Bloc-porte A2P BP1 ou équivalent, serrure A2P 1 étoile minimum',description:'« A2P » seul ou « BP1 » seul : non conforme à l’exigence.',keywords:['re:\\ba2p\\s*(?:bp\\s?[123]|\\*|[123]\\s*etoile)'],allOf:['re:\\ba2p\\b','re:\\bbp\\s?[123]\\b'],context:['porte','bloc porte','serrure'],exclude:['a2p r1','a2pr1'],window:8},
    {id:'abords_portails',theme:'Abords extérieurs',label:'Portails véhicules et piétons à accès sécurisé (obligatoire)',keywords:['portail','portillon'],context:['vigik','badge','digicode','controle d acces','telecommande','platine','interphone','visiophone','ventouse','gache electrique']},
    {id:'abords_cloture',theme:'Abords extérieurs',label:'Clôture d’au moins 1,80 m (ou règle du PLU)',description:'Les clôtures et barrières de chantier ne comptent pas.',kind:'number',unit:'m',min:1.8,keywords:['cloture','clotures'],context:['hauteur','ht','h ='],window:3},
    {id:'abords_acces_unique',theme:'Abords extérieurs',label:'Un seul point d’accès véhicules et piétons',keywords:['seul acces','acces unique','seul point d acces','unique point d acces']},
    {id:'abords_observables',theme:'Abords extérieurs',label:'Au moins 60 % des accès observables depuis un logement',keywords:['observable','surveillance naturelle','vue depuis les logements']},
    {id:'abords_separation',theme:'Abords extérieurs',label:'Pas de communication entre bâtiments',keywords:['separation des batiments','aucune communication entre','pas de communication entre']},
    {id:'abords_ombre',theme:'Abords extérieurs',label:'Suppression des zones d’ombre',keywords:['zone d ombre','zones d ombre']},
    {id:'abords_renfoncement',theme:'Abords extérieurs',label:'Renfoncements de 1,20 m maximum',kind:'number',unit:'m',max:1.2,keywords:['renfoncement','renfoncements','recoin']},
    {id:'abords_cheminement',theme:'Abords extérieurs',label:'Cheminements d’au moins 1,40 m de large',kind:'number',unit:'m',min:1.4,keywords:['cheminement','cheminements','allee pietonne','allees pietonnes'],context:['largeur','large']},
    {id:'abords_escaliers',theme:'Abords extérieurs',label:'Escaliers extérieurs sans dessous exploitable',keywords:['dessous d escalier','sous face d escalier','dessous des escaliers'],context:['ferme','condamne','obture','grille']},
    {id:'abords_aveugles',theme:'Abords extérieurs',label:'Absence de locaux aveugles non surveillés',keywords:['local aveugle','locaux aveugles']},
    {id:'hall_traversant',theme:'Halls d’entrée',label:'Hall non traversant (un seul point d’entrée et de sortie)',description:'Outil « Accès » d’Ashton : un seul accès compté = conforme. « Hall traversant » dans un document = indice contraire.',keywords:['non traversant'],weak:['hall traversant','halls traversants'],context:['hall']},
    {id:'hall_vitrage',theme:'Halls d’entrée',label:'Hall vitré (> 30 % de la surface au sol) en 44.2',description:'Dans Ashton : surface « Hall » et largeur « Menuiserie hall » ; ratio calculé avec une hauteur de 2,20 m. Le 44.2 est cherché dans les documents.',keywords:['re:\\b44[./ ]?2\\b','stadip','retardateur d effraction'],context:['hall','sas','porte d entree d immeuble','entree principale','ensemble vitre']},
    {id:'hall_sas',theme:'Halls d’entrée',label:'Sas sécurisé : badge + visiophone (platine IK08) puis serrure électronique à badge',description:'Partiel : Vigik (ou badge) + visiophone, mais sans platine IK08.',keywords:['sas'],context:['badge','vigik','visiophone','interphone','platine','controle d acces','ventouse','gache electrique'],exclude:['cabinet','capital','siret','etabli par','sarl','societe'],window:6},
    {id:'hall_ik08',theme:'Halls d’entrée',label:'Platine de rue anti-vandale IK08 ou plus',keywords:['re:\\bik\\s?(?:0?8|09|10)\\b'],context:['platine','visiophone','interphone','portier']},
    {id:'hall_eclairage',theme:'Halls d’entrée',label:'Éclairage du hall par détecteur, plus de 150 lux',kind:'number',unit:'lux',min:150,keywords:['lux'],context:['hall','detecteur','detection']},
    {id:'parking_present',theme:'Parkings en sous-sol',label:'Présence d’un parking en sous-sol (condition)',keywords:['parking en sous sol','parc de stationnement','sous sol','sous-sol'],context:['parking','stationnement','garage','vehicule']},
    {id:'parking_portail',theme:'Parkings en sous-sol',label:'Portail automatique verrouillé (obligatoire)',keywords:['re:porte (?:collective )?(?:basculante|sectionnelle|de garage)[^\\n]{0,30}(?:motoris|automat|electri)','re:portail[^\\n]{0,40}(?:parking|sous[- ]sol|garage)'],context:['telecommande','emetteur','badge','vigik','controle d acces','cle']},
    {id:'parking_pieton',theme:'Parkings en sous-sol',label:'Porte piétonne du parking avec contrôle d’accès',keywords:['porte pietonne','portillon'],context:['parking','sous sol','garage','stationnement'],exclude:['jardin','cloture','clotures'],window:1},
    {id:'parking_libre',theme:'Parkings en sous-sol',label:'Places en accès libre, sans porte basculante',inverse:true,keywords:['re:porte (?:individuelle )?basculante (?:manuelle|individuelle)','box ferme','boxes fermes'],description:'Un résultat signale des portes basculantes individuelles : critère NON rempli (à confirmer).'},
    {id:'parking_hall_badge',theme:'Parkings en sous-sol',label:'Accès parking depuis le hall par porte à badge',keywords:['re:(?:porte|sas)[^\\n]{0,60}(?:parking|sous[- ]sol)'],context:['badge','vigik','controle d acces','gache','ventouse']},
    {id:'parking_ascenseur',theme:'Parkings en sous-sol',label:'Accès au parking par l’ascenseur sécurisé',keywords:['ascenseur'],context:['badge','vigik','cle','controle d acces'],window:3},
    {id:'parking_eclairage',theme:'Parkings en sous-sol',label:'Éclairage du parking d’au moins 50 lux',kind:'number',unit:'lux',min:50,keywords:['lux'],context:['parking','sous sol','stationnement'],exclude:['cheminement','voirie','exterieur','espaces verts'],window:3},
    {id:'etage_escaliers',theme:'Accès aux étages',label:'Portes d’escaliers sécurisées (badge ou autre)',keywords:['escalier'],context:['badge','vigik','controle d acces','gache electrique','ventouse'],window:3},
    {id:'etage_ascenseur',theme:'Accès aux étages',label:'Accès aux ascenseurs sécurisé',keywords:['ascenseur'],context:['badge','vigik','controle d acces','lecteur'],window:3}
  ]};
export const SECURITY_GRID=normalizeGrid(SECURITY_GRID_V1);
