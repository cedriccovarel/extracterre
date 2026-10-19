// v2.4.0 — Notices et rapports de bureau d'études en rénovation (RT existant, BBC Effinergie rénovation), quel que soit
// le rédacteur. Boîte à outils commune, appliquée en complément des parseurs dédiés (seuls les champs manquants sont repris) :
//  • tableaux de synthèse par bâtiment : lignes « Cep Initial 196.8 196.7 196.8 » sous un en-tête « Batiment A Batiment B … »,
//    ou colonnes « Etat initial / Projet » par bâtiment (« Logements6et7 Logement5 … » puis « Etatinitial Projet … ») ;
//  • blocs de bilan « ETAT INITIAL / Projet » + « Batiment n° 1 : A » + « TOTAL kWhEP/m².an : 151,88 » (énergie par usage) ;
//  • résultats « Batiment A Cep = 151,9 », « 5.2 Etat projete Batiment A … Cep = 84,9 ≤ 195 » ;
//  • tableau des typologies « Bati. T1 T2 T3 T4 T5 TOTAL SHAB SRT » (colonnes alignées sur l'en-tête) ;
//  • prose / listes à puces par phase (état existant / projet) : isolants « 16cm de polystyrene expanse λ=0.031 »,
//    « R=4.6 », menuiseries, occultations, générateurs, ECS, ventilation.
// La phase est donnée par le titre du chapitre (« ETAT EXISTANT », « PROJET », « HYPOTHESES », « ETAT FUTUR ») ; un texte
// d'hypothèses ou de programme de travaux décrit l'état projeté. Épaisseurs en mm, R en m².K/W.
import {normalizeText,parseFrNumber,normalizeGlazingType} from './utils.js';
import {insulationName} from './donnees-techniques.js';

const nr_t=l=>normalizeText(l?.text||'').replace(/\s+/g,' ').trim();
function nr_lines(doc){ const out=[]; for(const page of doc.read?.pages||[]) (page.lines||[]).forEach(line=>out.push({page,line,t:nr_t(line)})); return out; }
const nr_num=s=>parseFrNumber(String(s).replace(/\s+/g,''));
const NR_FOOT=/^(?:SAS\s+\S+\s+Bureau|Agence\s|\d{1,5}\s+(?:rue|route|avenue|bd)\b|Page\s+\d+\s*(?:\/|sur)|\d+\s*\/\s*\d+$|\d+\s+sur\s+\d+$)/i;

// Noms de bâtiments écrits sans espaces dans les tableaux (« Logements6et7 », « Logementscollectifs »).
export function nr_buildingLabel(raw){
  let s=normalizeText(raw).replace(/([a-z])(\d)/gi,'$1 $2').replace(/(\d)([a-z])/gi,'$1 $2').replace(/\b(\d+)\s*et\s*(\d+)\b/gi,'$1 et $2').replace(/\s+/g,' ').trim();
  if(/^logements?\s*collectifs?$/i.test(s.replace(/\s+/g,' '))||/^logementscollectifs?$/i.test(s.replace(/\s+/g,''))) return 'Collectif';
  return s;
}

// Bâtiments d'une notice : en-têtes de tableaux de synthèse (« Batiment A Batiment B … »), titres « Etat projete Batiment A ».
export function renovationNoticeBuildingNames(doc){
  const L=nr_lines(doc); const BLD=/\b(?:Batiments?|Bat\.?|Bati\.?)\s+[A-Z0-9]{1,4}\b|\bLogements?\s*(?:\d+\s*(?:et\s*\d+)?|collectifs?)\b|\bLogements?\d+(?:et\d+)?\b|\bLogementscollectifs\b/gi;
  const names=[];
  for(const x of L){ const h=x.t.match(BLD)||[]; if(h.length>=2&&x.t.replace(BLD,'').replace(/\s+/g,'').length<=12) names.push(...h.map(z=>nr_buildingLabel(z.replace(/^Bati?\.?\s+/i,'Batiment ')))); const m=x.t.match(/^(?:\d+(?:\.\d+)*\s+)?Etat\s+projete\s+(Batiment\s+\S+)$/i); if(m) names.push(m[1]); }
  return [...new Set(names)];
}
export function isRenovationNotice(doc){
  const t=String(doc?.read?.text||'').slice(0,300000);
  // Marqueurs forts de rénovation globale ; une notice RE2020 (construction neuve) n'est pas concernée.
  return /RT\s*-?\s*Ex(?:istante?)?\b|RT\s+existante?|Th-?C-?E\s*-?\s*ex\b|THCE\s*-?\s*EX|BBC\s+(?:Effinergie\s+)?renovation/i.test(t)
    &&/Cep|isolation|isolant|menuiseries/i.test(t)&&!(/\bRE\s?2020\b|\bBbio\b/i.test(t.slice(0,30000))&&!/RT\s+existante?|Th-?C-?E\s*-?\s*ex\b|THCE\s*-?\s*EX/i.test(t.slice(0,30000)));
}

const NR_PH_BEFORE=/\b(?:ETAT\s+(?:EXISTANT|INITIAL|ACTUEL)|EXISTANT\b|AVANT\s+TRAVAUX|DIAGNOSTIC|ETAT\s+DES\s+LIEUX)\b/i;
const NR_PH_AFTER=/\b(?:PROJET|ETAT\s+(?:FUTUR|PROJETE|RENOVE)|APRES\s+TRAVAUX|HYPOTHESES|PROGRAMME\s+DE\s+TRAVAUX|PRECONISATIONS?|SOLUTIONS?\s+(?:TECHNIQUES|RETENUES)|INTERVENTIONS|TRAVAUX\s+(?:PREVUS|ENVISAGES|RETENUS))\b/i;
const nr_heading=t=>t.length<=80&&!/\.{5,}/.test(t)&&(t.match(/\d+(?:[.,]\d+)?/g)||[]).length<=3&&(/^\d+(?:\s*\.\s*\d+)*\s*\.?\s+[A-Za-z][A-Za-z']{2,}/.test(t)||(/^[A-Z0-9 ''’\-:,()]{6,}$/.test(t)&&/[A-Z]{4}/.test(t)));
// Phase de chaque ligne d'après le dernier titre rencontré (avant = état existant, après = projet).
function nr_phases(L){
  let ph=null; const out=[];
  for(const x of L){ if(nr_heading(x.t)){ if(NR_PH_AFTER.test(x.t)&&!/^\s*\d*\.?\s*Etat\s+(?:existant|initial)/i.test(x.t)) ph='after'; else if(NR_PH_BEFORE.test(x.t)) ph='before'; } out.push(ph); }
  return out;
}

const NR_INS=s=>insulationName(s)||(/xtherm|polyplac|fibra\s+polystyrene|knauf\s+therm|nextherm|th\s?38\b|graphite/i.test(s)?'PSE':/foamglass|verre\s+cellulaire/i.test(s)?'Verre cellulaire':/flocage|floque|laine\s+minerale|soufflee|jetspray|comblissmo/i.test(s)?(/laine\s+de\s+verre/i.test(s)?'Laine de verre':/laine\s+de\s+roche/i.test(s)?'Laine de roche':'Laine minérale'):null);
const NR_KIND=s=>{ const h=s.slice(0,90).toLowerCase();
  if(/\bplanchers?\s+bas\b|\bsous[- ]sol\b|\bcaves?\b|vide\s+sanitaire|terre[- ]plein|plancher\s+(?:sur|du)\s+(?:garage|parking|lnc|local|hall|parvis|r\+1)/.test(h)) return 'floor';
  if(/\btoitures?\b|\bterrasses?\b|\bcombles?\b|planchers?\s+hauts?|\brampants?\b|\bplafonds?\b|\bsad\b/.test(h)&&!/^\s*murs?\b/.test(h)) return 'roof';
  if(/\bmurs?\b|\bfacades?\b|\bpignons?\b|parois?\s+verticales?|\bite\b|\biti\b/.test(h)) return 'wall';
  return null; };
const NR_F={wall:['wall_insulation','wall_insulation_thickness','wall_insulation_r','wall_structure'],roof:['roof_insulation','roof_insulation_thickness','roof_insulation_r','roof_structure'],floor:['floor_insulation','floor_insulation_thickness','floor_insulation_r','floor_structure']};
const NR_STRUCT=s=>/beton\s+cellulaire/i.test(s)?'Béton cellulaire':/bloc\s+beton|parpaing|agglo/i.test(s)?'Bloc béton / parpaing':/\bbeton\b/i.test(s)?'Béton armé':/brique/i.test(s)?'Brique terre cuite':/meuliere/i.test(s)?'Meulière':/pierre|moellon/i.test(s)?'Pierre':/ossature\s+bois/i.test(s)?'Ossature bois':null;
const NR_VECT=s=>/reseau\s+de\s+chaleur|chauffage\s+urbain|sous-?station|\bCPCU\b/i.test(s)?'Réseau de chaleur urbain':/pompes?\s+a\s+chaleur|\bPAC\b|thermodynamique/i.test(s)?'Électricité':/\bgaz\b|propane|gaz\s+naturel/i.test(s)?'Gaz':/fioul|fuel/i.test(s)?'Fioul':/granul|bois|biomasse/i.test(s)?'Bois / biomasse':/electri|effet\s+joule|convecteur|panneaux?\s+rayonnant/i.test(s)?'Électricité':null;
const NR_MODE=s=>/pompes?\s+a\s+chaleur\s+air\s*\/\s*eau|PAC\s+air\s*\/\s*eau|air\s*\/\s*eau/i.test(s)?'PAC air/eau':/pompes?\s+a\s+chaleur\s+air\s*\/\s*air|PAC\s+air\s*\/\s*air/i.test(s)?'PAC air/air':/geotherm/i.test(s)?'PAC géothermique':/pompes?\s+a\s+chaleur|\bPAC\b/i.test(s)?'PAC':/condensation/i.test(s)?'Chaudière condensation':/chaudiere\s+(?:gaz|propane)|chaufferie.{0,40}\bgaz\b|\bgaz\b.{0,40}chaufferie/i.test(s)?'Chaudière gaz':/chaudiere\s+(?:bois|granul)/i.test(s)?'Chaudière biomasse':/reseau\s+de\s+chaleur|sous-?station/i.test(s)?'Réseau de chaleur':/radiateurs?\s+electriques?|convecteurs?|panneaux?\s+rayonnants?/i.test(s)?'Chauffage électrique direct':null;
const NR_VENT=s=>/double\s+flux/i.test(s)?'VMC double flux':/hygro\w*\s*(?:reglable\s+)?(?:de\s+)?(?:type\s+)?B\b/i.test(s)?'VMC Hygro B':/hygro\w*\s*(?:reglable\s+)?(?:de\s+)?(?:type\s+)?A\b/i.test(s)?'VMC Hygro A':/hybride/i.test(s)?'Ventilation hybride':/simple\s+flux|extraction\s+mecanique|\bVMC\b/i.test(s)?(/autoreglable/i.test(s)?'VMC simple flux autoréglable':'VMC simple flux'):/ventilation\s+naturelle|tirage\s+naturel|conduits?\s+shunt/i.test(s)?'Ventilation naturelle':null;

// Éléments (puces, lignes « libellé valeur ») : une ligne qui commence un élément, ou qui suit une puce, ouvre un item.
function nr_items(L,ph){
  const out=[]; let cur=null;
  const opens=t=>/^(?:[•\-–▪●◦]|\d+\.\s|[a-z]\)\s)/.test(t)||/^(?:Murs?|Plancher|Planchers|Toiture|Toitures|Terrasse|Combles?|Plafond|Rampant|Pignon|Menuiseries?|Fenetres?|Production|Generation|Chauffage|Ventilation|ECS|Eau\s+chaude|Emetteurs?|Emission|Rafraichissement|Isolation|SAD)\b/i.test(t);
  L.forEach((x,i)=>{ if(NR_FOOT.test(x.t)||nr_heading(x.t)){ cur=null; if(nr_heading(x.t)) out.push({head:x.t,i,ph:ph[i],x,text:x.t,isHead:true}); return; }
    if(!cur||opens(x.t)||(/[.:]$/.test(cur.text)&&/^(?:Les?|La|L'|Des|Une?)\s/.test(x.t))){ cur={i,ph:ph[i],x,text:x.t.replace(/^[•\-–▪●◦]\s*|^\d+\.\s+/,''),prev:L.slice(Math.max(0,i-6),i).map(z=>z.t).reverse()}; out.push(cur); return; }
    if(cur.text.length<600) cur.text+=` ${x.t}`; });
  return out;
}
// Isolant d'un item : épaisseur (cm / mm), λ, R (donné ou calculé e/λ).
function nr_insulation(text){
  const name=NR_INS(text); if(!name) return null;
  const e=text.match(/(\d{1,3}(?:[.,]\d)?)\s*(cm|mm)\b(?!\s*[²2])/i); const lam=text.match(/λ\s*[=:]?\s*(0[.,]\d{2,3})/i)||text.match(/lambda\s*[=:]?\s*(0[.,]\d{2,3})/i);
  const Rm=text.match(/\bR\s*(?:=|≥|>=|:|>)\s*(\d{1,2}(?:[.,]\d{1,2})?)(?!\s*%)/);
  const mm=e?Math.round(nr_num(e[1])*(/mm/i.test(e[2])?1:10)):null; const l=lam?nr_num(lam[1]):null;
  let R=Rm?nr_num(Rm[1]):null, Rcalc=false; if(R===null&&mm&&l){ R=Math.round(mm/1000/l*100)/100; Rcalc=true; }
  if(mm!==null&&(mm<10||mm>600)) return null;
  return {name,mm,lambda:l,R,Rcalc};
}


// Générateurs de chauffage nommés explicitement : mode, énergie, état existant / remplacé, production mixte (ECS).
function nr_generators(t){
  const out=[]; const R=[
    [/pompes?\s+a\s+chaleur(?:\s+(?:de\s+type\s+)?(air\s*\/\s*eau|air\s*\/\s*air|eau\s*\/\s*eau|geothermiques?))?|\bPAC\s+(air\s*\/\s*eau|air\s*\/\s*air)/i,m=>({mode:/air\s*\/\s*eau/i.test(m[0])?'PAC air/eau':/air\s*\/\s*air/i.test(m[0])?'PAC air/air':/geotherm|eau\s*\/\s*eau/i.test(m[0])?'PAC géothermique':'PAC',vector:'Électricité'})],
    [/chaudieres?\s+(?:collectives?\s+|individuelles?\s+|murales?\s+)?(?:au\s+)?(gaz|propane|fioul|bois|granul\w*|biomasse)(?:[^.;]{0,40}?(condensation))?|chaudieres?\s+(?:collectives?\s+|individuelles?\s+)?a\s+condensation(?:[^.;]{0,30}?(gaz|fioul))?/i,m=>{ const e=m[1]||m[3]||'gaz'; const v=/fioul/i.test(e)?'Fioul':/bois|granul|biomasse/i.test(e)?'Bois / biomasse':'Gaz'; return {mode:v==='Bois / biomasse'?'Chaudière biomasse':/condensation/i.test(m[0])?'Chaudière condensation':'Chaudière gaz',vector:v}; }],
    [/chaufferie\b[^.;]{0,50}?\b(gaz|propane|fioul|bois|granul\w*)\b|\b(gaz|fioul)\b[^.;]{0,25}chaufferie/i,m=>{ const e=m[1]||m[2]; const v=/fioul/i.test(e)?'Fioul':/bois|granul/i.test(e)?'Bois / biomasse':'Gaz'; return {mode:v==='Bois / biomasse'?'Chaudière biomasse':'Chaudière gaz',vector:v}; }],
    [/reseau\s+de\s+chaleur\s+urbain|raccordement\s+au\s+reseau\s+de\s+chaleur|sous-?station|chauffage\s+urbain/i,()=>({mode:'Réseau de chaleur',vector:'Réseau de chaleur urbain'})],
    [/radiateurs?\s+electriques?|convecteurs?\s+electriques?|panneaux?\s+rayonnants?(?:\s+electriques?)?|chauffage\s+electrique\s+(?:direct|par)/i,()=>({mode:'Chauffage électrique direct',vector:'Électricité'})],
    [/poeles?\s+a\s+(?:bois|granul\w*)/i,()=>({mode:'Poêle',vector:'Bois / biomasse'})]];
  for(const [re,fn] of R){ const m=t.match(re); if(!m) continue; const g=fn(m); const around=t.slice(Math.max(0,m.index-80),m.index+m[0].length+160);
    const rep=t.match(/remplacement\s+de\s+(?:la|les|l.)\s*(?:\w+\s+){0,2}?(chaudieres?|chaufferie)\s+(\w+)?\s*(?:\w+\s+)?existante?s?/i);
    g.existing=/existante?s?|actuel|conserve/i.test(around); g.replaced=rep?(/fioul/i.test(rep[0])?'Fioul':/bois/i.test(rep[0])?'Bois / biomasse':/electri/i.test(rep[0])?'Électricité':'Gaz'):null;
    g.mixte=/double\s+servi|chauffage\s+et\s+(?:de\s+)?(?:l.)?(?:eau\s+chaude|ecs)|chauffage\s*\+\s*ecs|mixtes?\b|produira\s+le\s+chauffage\s+et/i.test(around); out.push(g); }
  return out;
}
// Production d'ECS nommée explicitement.
function nr_ecs(t){
  const m=t.match(/ballons?\s+(?:d.eau\s+chaude\s+)?(?:sanitaire\s+)?electriques?|chauffe[- ]eau\s+(electriques?|thermodynamiques?|gaz|solaires?)|cumulus|chauffe[- ]bains?|ballons?\s+thermodynamiques?|(?:ECS|eau\s+chaude\s+sanitaire)\s+(?:par|assuree\s+par|produite\s+par)\s+(?:la\s+|le\s+|les\s+|des\s+)?(chaudiere|chaufferie|PAC|pompe|ballons?|reseau)/i);
  if(!m) return null; const s=m[0];
  if(/thermodynamique/i.test(s)) return {vector:'Électricité',mode:'Chauffe-eau thermodynamique'};
  if(/electri|cumulus/i.test(s)||/ballons?$/i.test(m[2]||'')) return {vector:'Électricité',mode:'Ballon électrique'};
  if(/chauffe[- ]bain|gaz/i.test(s)) return {vector:'Gaz',mode:'Chaudière'};
  if(/solaire/i.test(s)) return {vector:'Solaire',mode:'Solaire thermique'};
  if(/chaudiere|chaufferie/i.test(m[2]||'')) return {vector:NR_VECT(t.slice(m.index,m.index+120))||null,mode:'Chaudière'};
  if(/PAC|pompe/i.test(m[2]||'')) return {vector:'Électricité',mode:'PAC'};
  if(/reseau/i.test(m[2]||'')) return {vector:'Réseau de chaleur urbain',mode:'Réseau de chaleur'};
  return null;
}

export function parseRenovationNotice(doc,occ,canonical=(s)=>s,opts={}){
  const out=[]; const L=nr_lines(doc); const ph=nr_phases(L); const origin=opts.origin||'Notice de bureau d’études (rénovation)';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value))) return; const o=occ(doc,x.page,x.line,field,value,`notice-reno:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,dedicatedRank:9,...extra}); if(o) out.push(o); };
  const has=(b,f)=>out.some(o=>o.field===f&&o.building===canonical(b));
  const U='Bâtiment unique';
  // 1. Tableaux de synthèse « en-tête de bâtiments » + lignes de valeurs.
  const BLD=/\b(?:Batiments?|Bat\.?|Bati\.?)\s+[A-Z0-9]{1,4}\b|\bLogements?\s*(?:\d+\s*(?:et\s*\d+)?|collectifs?)\b|\bLogements?\d+(?:et\d+)?\b|\bLogementscollectifs\b/gi;
  L.forEach((x,i)=>{
    const heads=x.t.match(BLD)||[]; if(heads.length<2||x.t.replace(BLD,'').replace(/\s+/g,'').length>12) return;
    const names=heads.map(h=>nr_buildingLabel(h.replace(/^Bati?\.?\s+/i,'Batiment ')));
    const nb=names.length; const split=/^Etat\s*initial\s+Projet\b/i.test(L[i+1]?.t||'')||/^Etatinitial\s*Projet/i.test(L[i+1]?.t||'');
    for(let k=i+1;k<Math.min(L.length,i+30);k++){
      const y=L[k], t=y.t; if(nr_heading(t)&&k>i+2) break;
      const toks=t.split(/\s+/); while(toks.length>1&&/^(?:-?\d+(?:[.,]\d+)?%?|[A-G])$/.test(toks[toks.length-1])) toks.pop();
      const lab=toks.join('').toLowerCase(); const lab2=normalizeText(t).toLowerCase();
      // Valeurs : nombres, ou « nombre classe » (« 230 E »), ou classes seules (« F B G B »).
      const tailN=(t.match(/(?:\s|^)(-?\d+(?:[.,]\d+)?%?)(?=\s|$)/g)||[]).map(z=>z.trim());
      const grades=(t.match(/(?:^|\s)([A-G])(?=\s|$)/g)||[]).map(z=>z.trim());
      const nextVals=()=>{ const n=L[k+1]?.t||''; const m=[...n.matchAll(/(\d+(?:[.,]\d+)?)\s+([A-G])\b/g)]; return m.length===nb?m:null; };
      const per=(vals,cb)=>{ if(split&&vals.length===2*nb) names.forEach((n,j)=>cb(n,vals[2*j],vals[2*j+1])); else if(!split&&vals.length===nb) names.forEach((n,j)=>cb(n,vals[j],null)); };
      const nums=tailN.filter(z=>!/%$/.test(z)).map(nr_num);
      const note={provenanceNote:`Tableau de synthèse des résultats (${names.join(', ')}).`};
      if(/^cepinitial$/.test(lab)) per(nums,(n,v)=>emit(y,n,'cep_before',v,'synthese-cep-initial',0.93,'kWhEP/m².an',note));
      else if(/^cepprojet$/.test(lab)) per(nums,(n,v)=>{ emit(y,n,'cep_after_final',v,'synthese-cep-projet',0.93,'kWhEP/m².an',note); emit(y,n,'cep',v,'synthese-cep-projet',0.9,'kWhEP/m².an',note); });
      else if(/^ubat(?:initial|existant)$/.test(lab)) per(nums,(n,v)=>emit(y,n,'ubat_before',v,'synthese-ubat-initial',0.9,'W/m².K',note));
      else if(/^ubatprojet$/.test(lab)) per(nums,(n,v)=>emit(y,n,'ubat_after',v,'synthese-ubat-projet',0.92,'W/m².K',note));
      else if(/^(?:lots|logements|nombredelogements|nblogements)$/.test(lab)) per(nums,(n,v)=>emit(y,n,'housing_count',v,'synthese-logements',0.85,'',note));
      else if(/consommation.*energieprimaire.*cep|^cep\(/.test(lab)&&split) per(nums,(n,a,b)=>{ emit(y,n,'cep_before',a,'synthese-cep-initial',0.92,'kWhEP/m².an',note); emit(y,n,'cep_after_final',b,'synthese-cep-projet',0.92,'kWhEP/m².an',note); emit(y,n,'cep',b,'synthese-cep-projet',0.9,'kWhEP/m².an',note); });
      else if(/classe.*energetique.*dpe|etiquette.*energie/.test(lab)&&split&&grades.length===2*nb) per(grades,(n,a,b)=>{ emit(y,n,'dpe_energy_before',a,'synthese-dpe',0.88,'',note); emit(y,n,'dpe_energy_after',b,'synthese-dpe',0.88,'',note); });
      else if(/classe.*carbone.*dpe|etiquette.*(?:ges|climat|co2)/.test(lab)&&split&&grades.length===2*nb) per(grades,(n,a,b)=>{ emit(y,n,'dpe_ges_before',a,'synthese-ges',0.88,'',note); emit(y,n,'dpe_ges_after',b,'synthese-ges',0.88,'',note); });
      else if(/consommationequivalentedpe/.test(lab)||/emission.*gaz.*effet.*serre/.test(lab2.replace(/\s/g,''))){ const nv=nextVals(); if(!nv) continue;
        const ges=/emission/.test(lab2), init=/initial|existant/.test(lab2);
        names.forEach((n,j)=>emit(L[k+1],n,ges?(init?'dpe_ges_before':'dpe_ges_after'):(init?'dpe_energy_before':'dpe_energy_after'),nv[j][2],ges?'synthese-ges':'synthese-dpe',0.88,'',{provenanceNote:`${ges?'Émissions':'Consommation équivalente DPE'} ${init?'initiales':'projet'} : ${nv[j][1]} (${n}).`})); }
    }
  });
  // 2. Blocs de bilan « ETAT INITIAL » / « Projet » + « Batiment n° 1 : A » + « TOTAL kWhEP/m².an : 151,88 ».
  L.forEach((x,i)=>{ const m=x.t.match(/^Batiment\s+n°\s*\d+\s*:\s*(.+)$/i); if(!m) return;
    const phase=/ETAT\s+INITIAL/i.test(L.slice(Math.max(0,i-3),i).map(z=>z.t).join(' '))?'before':/^Projet$|Modification|Projet/i.test(L.slice(Math.max(0,i-3),i).map(z=>z.t).join(' '))?'after':null; if(!phase) return;
    const B=`Batiment ${m[1].trim()}`; const blk=L.slice(i,i+30); const tot=blk.find(z=>/^TOTAL\s+kWhEP\/m².an\s*:\s*[\d,.]+/i.test(z.t)); if(!tot) return;
    const v=nr_num(tot.t.match(/kWhEP\/m².an\s*:\s*([\d,.]+(?:\s\d{3})*)/i)[1]); const note={provenanceNote:`Bilan Th-C-E ex « ${phase==='before'?'état initial':'projet'} » du bâtiment ${m[1].trim()}.`};
    if(phase==='before') emit(tot,B,'cep_before',v,'bilan-cep-initial',0.93,'kWhEP/m².an',note); else { emit(tot,B,'cep_after_final',v,'bilan-cep-projet',0.93,'kWhEP/m².an',note); emit(tot,B,'cep',v,'bilan-cep-projet',0.9,'kWhEP/m².an',note); }
    const sh=blk.find(z=>/^Surface\s+habitable\s*:\s*[\d\s,.]+m²/i.test(z.t)); if(sh) emit(sh,B,'shab',nr_num(sh.t.match(/:\s*([\d\s,.]+?)\s*m²/)[1]),'bilan-shab',0.9,'m²');
    // Énergie par usage (« CHAUFFAGE / Propane 345418,70 107,84 »).
    const use=(u)=>{ const k=blk.findIndex(z=>new RegExp(`^${u}$`,'i').test(z.t)); return k>=0?blk[k+1]:null; };
    for(const [u,fb,fa] of [['CHAUFFAGE','heating_vector_before','heating_vector_after'],['ECS','ecs_vector_before','ecs_vector_after']]){ const y=use(u); const vv=y?NR_VECT(y.t.replace(/[\d\s,.]+$/,'')):null; if(vv&&/\d/.test(y.t)) emit(y,B,phase==='before'?fb:fa,vv,`bilan-${u.toLowerCase()}`,0.9,'',{provenanceNote:`Énergie ${u.toLowerCase()} du bilan : ${y.t.replace(/[\d\s,.]+$/,'')}.`}); }
    if(phase==='after'){ const ep=re=>{ const y=blk.find(z=>re.test(z.t)); const n=y?(y.t.match(/([\d,.]+)\s*$/)||[])[1]:null; return y&&n?{y,v:nr_num(n)}:null; };
      const ecl=ep(/^ECLAIRAGE\s+[\d\s,.]+$/i), aux=ep(/^AUXILIAIRES\s+[\d\s,.]+$/i), ven=ep(/^VENTILATEURS\s+[\d\s,.]+$/i);
      if(ecl) emit(ecl.y,B,'cep_lighting',ecl.v,'bilan-eclairage',0.9,'kWhEP/m².an'); if(aux) emit(aux.y,B,'cep_aux_dist',aux.v,'bilan-auxiliaires',0.88,'kWhEP/m².an'); if(ven) emit(ven.y,B,'cep_aux_vent',ven.v,'bilan-ventilateurs',0.9,'kWhEP/m².an'); }
  });
  // 3. « Batiment A Cep = 151,9 » (état initial) / « Etat projete Batiment A … Cep = 84,9 ≤ 195 ».
  { let curB=null; L.forEach((x,i)=>{ const hb=x.t.match(/^(?:\d+(?:\.\d+)*\s+)?Etat\s+projete\s+(Batiment\s+\S+)/i); if(hb) curB=hb[1];
      let m=x.t.match(/^(Batiment\s+\S+)\s+Cep\s*=\s*(\d+(?:[.,]\d+)?)/i);
      if(m&&ph[i]==='before'||m&&/ETAT\s+INITIAL/i.test(L.slice(Math.max(0,i-4),i).map(z=>z.t).join(' '))){ emit(x,m[1],'cep_before',nr_num(m[2]),'cep-initial',0.9,'kWhEP/m².an',{provenanceNote:'Résultats Th-C-E ex : état initial.'}); return; }
      m=x.t.match(/^Cep\s*=\s*(\d+(?:[.,]\d+)?)\s*(?:≤|<=|<)\s*(\d+(?:[.,]\d+)?)/i);
      if(m&&curB){ const cp=nr_num(m[1]), cm=nr_num(m[2]); emit(x,curB,'cep_after_final',cp,'cep-projet',0.9,'kWhEP/m².an',{provenanceNote:'Résultats Th-C-E ex : état projeté.'}); emit(x,curB,'cep',cp,'cep-projet',0.88,'kWhEP/m².an'); emit(x,curB,'cep_max',cm,'cep-max',0.88,'kWhEP/m².an',{provenanceNote:`Objectif « Cep ≤ ${cm} » de l’état projeté.`}); emit(x,curB,'cep_gain',Math.round((cm-cp)/cm*1000)/10,'cep-gain',0.86,'%'); } }); }
  // 4. Tableau des typologies : « Bati. T1 T2 T3 T4 T5 TOTAL SHAB SRT » (valeurs alignées sur les colonnes de l'en-tête).
  L.forEach((x,i)=>{ if(!/\bT1\b.*\bT2\b.*\bTOTAL\b/i.test(x.t)||!x.line.items?.length) return;
    const cols=x.line.items.map(it=>({k:normalizeText(it.text).trim(),x:it.x})).filter(c=>/^(?:T\d|TOTAL|SHAB|SRT|SU|SHON)$/i.test(c.k));
    for(const y of L.slice(i+1,i+12)){ const it=y.line.items||[]; if(!it.length) continue; const first=normalizeText(it[0].text).trim(); if(/^TOTAL$/i.test(first)||!/^[A-Z0-9]{1,4}$/.test(first)) break;
      const B=`Batiment ${first}`; const cells={};
      for(const c of it.slice(1)){ const v=normalizeText(c.text).trim(); if(!/^\d/.test(v)) continue; const col=cols.slice().sort((a,b)=>Math.abs(a.x-c.x)-Math.abs(b.x-c.x))[0]; if(!col) continue; cells[col.k.toUpperCase()]=(cells[col.k.toUpperCase()]?cells[col.k.toUpperCase()]+' ':'')+v; }
      const n=k=>cells[k]?nr_num(cells[k]):null;
      if(n('TOTAL')) emit(y,B,'housing_count',n('TOTAL'),'typologies-total',0.9,'',{provenanceNote:'Tableau des typologies de logements.'});
      if(n('SHAB')) emit(y,B,'shab',n('SHAB'),'typologies-shab',0.88,'m²');
      const typ=Object.keys(cells).filter(k=>/^T\d$/.test(k)&&n(k)>0).map(k=>`${k} : ${n(k)}`); if(typ.length) emit(y,B,'housing_typologies',typ.join(' ; '),'typologies',0.88);
    } });
  // 5. Prose et listes par phase (état existant / projet).
  const items=nr_items(L,ph); const best={};
  const put=(key,val,score)=>{ if(!best[key]||score>best[key].score) best[key]={...val,score}; };
  let sec=null;
  for(const it of items){
    if(it.isHead){ sec=/menuiser|fenetre|vitrage/i.test(it.head)?'win':/ventil/i.test(it.head)?'vent':/chauff|generat|production|ecs|eau\s+chaude|system|equipement/i.test(it.head)?'sys':/isol|parois|murs?|planchers?|toiture|enveloppe|composition/i.test(it.head)?'env':sec; continue; }
    const t=it.text, p=it.ph||(/existant/i.test(t)?'before':'after');
    // Parois isolées.
    // Une puce peut enchaîner plusieurs phrases (« … des facades. Les toitures terrasses ont ete isolees avec 162 mm … ») :
    // chaque phrase porteuse d'un isolant est rattachée à sa propre paroi.
    const itemKind=NR_KIND(t)||(it.prev||[]).map(NR_KIND).find(Boolean)||null; const ctxPrev=(it.prev||[]).slice(0,3).join(' ');
    for(const cl of t.split(/(?<=\.)\s+(?=[A-Z])|\s+(?=(?:Les?|La)\s+(?:toitures?|murs?|planchers?|combles?|facades?)\b)/)){
      if(!NR_INS(cl)||!/\d\s*(?:cm|mm)\b|\bR\s*(?:=|≥|>=|:)\s*\d/i.test(cl)) continue; const kind=NR_KIND(cl)||itemKind; const ins=kind?nr_insulation(cl):null;
      if(!kind||!ins||/non\s+isole/i.test(cl.slice(0,60))) continue;
      const head=`${cl.slice(0,90)} ${ctxPrev}`;
      const sc=(/\bexterieurs?\b|\bfacades?\b|courante|terrasses?|combles?|sur\s+(?:cave|sous-sol|vide)/i.test(cl.slice(0,90))?2:0)+(ins.R?1:0)+(ins.mm?1:0)-(/garage|loggia|reduit|alleges?|cuisines|hall|parties?\s+communes|\bsas\b|pignon\s+sud/i.test(head)?2:0);
      put(`${p}|${kind}`,{x:it.x,ins,t:cl,kind},sc); const st=NR_STRUCT(`${cl.slice(0,140)} ${ctxPrev}`); if(st&&kind==='wall') put(`${p}|structure`,{x:it.x,v:st},1); }
    // Menuiseries.
    if(/menuiseries?|fenetres?|chassis|baies?/i.test(t)&&/pvc|alu|bois|vitrage|uw/i.test(t)&&!/portes?\s+(?:d.entree|palieres?|metalliques?)/i.test(t.slice(0,50))){
      const mat=/bois[- ]?alu/i.test(t)?'Bois/aluminium':/\bpvc\b/i.test(t)?'PVC':/\balu(?:minium)?\b|metal/i.test(t)?'Aluminium':/\bbois\b/i.test(t)?'Bois':null;
      const g=t.match(/\b(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{1,2})\b/); const gl=g?normalizeGlazingType(`${g[1]}/${g[2]}/${g[3]}${/argon/i.test(t)?' argon':''}`):/triple\s+vitrage/i.test(t)&&!/double\s+vitrage/i.test(t)?'Triple vitrage':/double\s+vitrage/i.test(t)?'Double vitrage':/simple\s+vitrage/i.test(t)?'Simple vitrage':null;
      const sh=/volets?\s+roulants?|\bVR\b/i.test(t)?'Volet roulant':/volets?\s+battants?/i.test(t)&&!/volets?\s+battants?\s+seront\s+remplac/i.test(t)?'Volet battant':/\bBSO\b|brise[- ]soleil/i.test(t)?'BSO':/persiennes?/i.test(t)?'Persienne':null;
      const kept=/maintenues|conservees|deja\s+(?:ete\s+)?changees/i.test(t);
      if(mat) put(`${kept?'after':p}|win_mat`,{x:it.x,v:mat},1); if(gl) put(`${kept?'after':p}|win_gl`,{x:it.x,v:gl},g?2:1); if(sh) put(`${p}|win_sh`,{x:it.x,v:sh},1); }
    // Générateurs : une expression de générateur explicite, l'énergie étant lue dans son voisinage immédiat (les
    // légendes de photos et tableaux de CEE qui citent « bois » ou « électricité » ne décrivent pas le chauffage).
    for(const g of nr_generators(t)){ const target=g.existing&&p==='after'&&!g.replaced?'after':p; put(`${target}|heat_v`,{x:it.x,v:g.vector},2); if(g.mode) put(`${target}|heat_m`,{x:it.x,v:g.mode},2);
      if(g.existing&&!g.replaced) put('before|heat_v',{x:it.x,v:g.vector},1); if(g.replaced) put('before|heat_v',{x:it.x,v:g.replaced},3);
      if(g.mixte){ put(`${target}|ecs_v`,{x:it.x,v:g.vector},2); put(`${target}|ecs`,{x:it.x,v:/PAC/.test(g.mode||'')?'PAC':['Gaz','Fioul','Bois / biomasse'].includes(g.vector)?'Chaudière':g.vector==='Réseau de chaleur urbain'?'Réseau de chaleur':null},2); } }
    { const e=nr_ecs(t); if(e){ put(`${p}|ecs_v`,{x:it.x,v:e.vector},1); if(e.mode) put(`${p}|ecs`,{x:it.x,v:e.mode},1); } }
    if(/ventil|VMC|extraction|hygro/i.test(t)&&!/ventilateurs?\s+(?:lies|du)|ventilation\s+du\s+generateur/i.test(t)){ const v=NR_VENT(t); if(v) put(`${p}|vent`,{x:it.x,v},sec==='vent'||/^Ventilation/i.test(t)?2:1); }
  }
  // Résultats en clair : « Consommation totale en energie primaire (kWhep/m2/an) 77.92 », « en classe C ».
  L.forEach((x,i)=>{ let m;
    if((m=x.t.match(/^Consommation\s+totale\s+en\s+energie\s+primaire\s*\([^)]*\)\s*(\d+(?:[.,]\d+)?)$/i))){ const p=ph[i]||'after'; emit(x,U,p==='before'?'cep_before':'cep_after_final',nr_num(m[1]),'cep-texte',0.88,'kWhEP/m².an'); if(p!=='before') emit(x,U,'cep',nr_num(m[1]),'cep-texte',0.85,'kWhEP/m².an'); }
    if((m=x.t.match(/^Surface\s+habitable\s*\(m2\)\s*(\d+(?:[.,]\d+)?)$/i))) emit(x,U,'shab',nr_num(m[1]),'shab',0.88,'m²');
    if((m=x.t.match(/^Surface\s+(?:habitable|chauffee)\s+(\d+(?:[.,]\d+)?)\s*m2$/i))&&!has(U,'shab')) emit(x,U,'shab',nr_num(m[1]),'shab',0.8,'m²',{reviewCap:0.85});
    if((m=x.t.match(/logements\s+sont\s+en\s+classe\s+([A-G])\b/i))) emit(x,U,'dpe_energy_after',m[1].toUpperCase(),'dpe-texte',0.86,'',{provenanceNote:x.t});
    if((m=x.t.match(/^Annee\s+de\s+(?:la\s+)?construction\s*:?\s*(\d{4})\b/i))) emit(x,U,'construction_year',Number(m[1]),'annee',0.88);
    if((m=x.t.match(/^Departement\s*:?\s*(\d{2,3}|2[AB])\b/i))) emit(x,U,'department',m[1],'departement',0.88,'',{secondarySourceOk:true});
    if((m=x.t.match(/\bCEP\s*(?:≤|<=|<)\s*(\d{2,3})\s*kWh(?:ep)?\s*\/\s*m²/i))&&/label|BBC|effinergie|HPE|objectif/i.test(L.slice(Math.max(0,i-4),i+1).map(z=>z.t).join(' '))&&!has(U,'cep_max')) emit(x,U,'cep_max',Number(m[1]),'cep-max-label',0.86,'kWhEP/m².an',{provenanceNote:`Exigence du label : ${x.t}`});
  });
  // Restitution des choix (prose).
  const targets=opts.targets?.length?opts.targets:[U];
  for(const p of ['before','after']){
    for(const kind of ['wall','roof','floor']){ const z=best[`${p}|${kind}`]; if(!z||p==='before') continue; const f=NR_F[kind]; const note={provenanceNote:`Notice : « ${z.t.slice(0,140)}${z.t.length>140?'…':''} »${z.ins.Rcalc?` (R calculé = e / λ = ${z.ins.mm/1000} / ${z.ins.lambda})`:''}.`};
      for(const b of targets){ emit(z.x,b,f[0],z.ins.name,`${kind}-isolant`,0.86,'',note); if(z.ins.mm) emit(z.x,b,f[1],z.ins.mm,`${kind}-epaisseur`,0.85,'mm',note); if(z.ins.R) emit(z.x,b,f[2],z.ins.R,`${kind}-r`,0.86,'m².K/W',note); } }
    const pick=(k,f,m,c=0.85)=>{ const z=best[`${p}|${k}`]; if(z&&z.v) for(const b of targets) emit(z.x,b,f,z.v,m,c,'',{provenanceNote:'Disposition décrite par la notice.'}); };
    if(p==='after'){ pick('win_mat','window_material','menuiseries'); pick('win_gl','window_glazing','vitrage'); pick('win_sh','window_shading','occultations'); pick('vent','ventilation','ventilation'); pick('heat_m','heating_mode_after','chauffage'); pick('heat_v','heating_vector_after','chauffage-vecteur'); pick('ecs_v','ecs_vector_after','ecs-vecteur'); pick('ecs','ecs','ecs'); pick('structure','wall_structure','structure',0.8); }
    else { pick('heat_v','heating_vector_before','chauffage-existant'); pick('ecs_v','ecs_vector_before','ecs-existant'); }
  }
  return out;
}
