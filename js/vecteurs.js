// ExtracTerre v2.19.0 — vecteur énergétique hybride (chauffage et ECS).
// « Hybride Gaz/Électricité » : le vecteur PRINCIPAL d'abord, puis le second. Jamais plus de deux vecteurs.
// Pour ne pas en faire un fourre-tout, l'hybride n'est retenu que :
//  • en texte, quand le document le dit (« PAC hybride », « bi-énergie », « bivalent », « PAC + chaudière gaz ») et que les
//    deux vecteurs sont nommés près de cette mention ; un « sèche-serviettes électrique » ailleurs ne compte pas ;
//  • en calcul (consommations par énergie), quand le second vecteur fait au moins 30 % de l'usage.
// Sinon le vecteur principal seul, comme avant.
import {HVAC} from './config.js';
import {normLower,findFirstMatch} from './utils.js';

export const HYBRID_SECOND_SHARE=0.3;
// Libellés courts dans l'hybride : « Hybride Gaz/Bois », « Hybride RCU/Gaz ».
const VX_SHORT={'Bois / biomasse':'Bois','Réseau de chaleur urbain':'RCU'};
export const hybridLabel=(main,second)=>main&&second&&main!==second?`Hybride ${VX_SHORT[main]||main}/${VX_SHORT[second]||second}`:(main||null);
export const isHybridVector=v=>/^Hybride\b/.test(String(v||''));

// Consommations par vecteur [[libellé, valeur]…] → vecteur principal, ou hybride si le second pèse ≥ 30 %.
export function vectorFromShares(entries){
  const by=new Map(); for(const [k,v] of entries||[]){ const n=Number(v); if(k&&Number.isFinite(n)&&n>0) by.set(k,(by.get(k)||0)+n); }
  const e=[...by].sort((a,b)=>b[1]-a[1]); if(!e.length) return null;
  const tot=e.reduce((s,x)=>s+x[1],0);
  return e[1]&&e[1][1]/tot>=HYBRID_SECOND_SHARE?hybridLabel(e[0][0],e[1][0]):e[0][0];
}

// Générateurs → vecteur (une PAC est électrique, sauf « PAC géothermique » qui reste Géothermie comme dans HVAC.vectors).
const VX_GEN=[
  ['Réseau de chaleur urbain',/\brcu\b|reseau\s+de\s+chaleur|chauffage\s+urbain|sous[- ]station/g],
  ['Bois / biomasse',/\bbois\b|biomasse|granules?\b|pellets?\b|plaquettes/g],
  ['Géothermie',/geotherm\w*/g],
  ['Fioul',/\bfioul\b|\bfuel\b|mazout/g],
  ['Gaz',/\bgaz\b|propane/g],
  ['Électricité',/\bpac\b|pompes?\s+a\s+chaleur|electri\w*|effet\s+joule|thermodynamique/g]
];
const VX_HYB_SIGNAL=/\bhybrides?\b|\bbi[- ]?energies?\b|\bbivalente?s?\b|\b(?:pac|pompes?\s+a\s+chaleur)\b[^|\n]{0,60}\+\s*chaudieres?\b|\bchaudieres?\b[^|\n]{0,60}\+\s*(?:pac|pompes?\s+a\s+chaleur)\b/;
const VX_SECONDARY=/(?:appoint|releve|secours|complement)/;

// Hybride lu dans le texte, ou null. Fenêtre de 90 caractères autour de la mention.
export function hybridFromText(text){
  const t=normLower(text).replace(/(?:ventilation|vmc|traitement|mode)\s+hybrides?/g,' ');
  const m=t.match(VX_HYB_SIGNAL); if(!m) return null;
  const a=Math.max(0,m.index-90), w=t.slice(a,m.index+m[0].length+90);
  const found=[];
  for(const [v,re] of VX_GEN){ re.lastIndex=0; let x; while((x=re.exec(w))){
    if(v==='Électricité'&&/geotherm/.test(w.slice(x.index,x.index+40))) continue;
    found.push({v,i:x.index,end:x.index+x[0].length}); } }
  const firsts=[]; for(const f of found.sort((p,q)=>p.i-q.i)) if(!firsts.some(z=>z.v===f.v)) firsts.push(f);
  if(firsts.length<2) return 'Hybride';
  // Le générateur « d'appoint » / « en relève » est le second ; sinon l'ordre du texte.
  // « PAC en appoint », « chaudière gaz en relève » (après le générateur) ; « relève par chaudière gaz », « appoint gaz »
  // (avant, sans virgule entre les deux : dans « PAC en appoint, chaudière gaz », le gaz n'est pas l'appoint).
  const sec=f=>new RegExp(`^(?:\\s+(?:[a-z/]+\\s+){0,3}?)?(?:en\\s+|d.\\s*|de\\s+)?${VX_SECONDARY.source}`).test(w.slice(f.end,f.end+40))
    ||new RegExp(`${VX_SECONDARY.source}\\w*(?:\\s+(?:par|en|au|a|de|d|du|une?|des?|la|le))*\\s+(?:[a-z]+\\s+)?$`).test(w.slice(Math.max(0,f.i-30),f.i));
  const two=firsts.slice(0,3); const main=two.find(f=>!sec(f))||two[0]; const second=two.find(f=>f!==main);
  return hybridLabel(main.v,second.v);
}

// Remplace findFirstMatch(text,HVAC.vectors) : hybride explicite, sinon premier vecteur reconnu.
export function detectVector(text){
  const h=hybridFromText(text); if(h) return h;
  return findFirstMatch(text,HVAC.vectors);
}
