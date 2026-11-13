// ExtracTerre v2.34.0 — fiabilité des données : comparaison d'une valeur extraite à la valeur de référence Salesforce
// (vérifiée par les évaluateurs, celle qui a servi à la certification). Partagé par l'appli et par le banc de vérité
// (tools/qualite/banc-salesforce.mjs).
import {FIELD_MAP} from './config.js';

const q_norm=s=>String(s??'').replace(/œ/gi,'oe').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/[’']/g,' ').replace(/[^a-z0-9.,+/-]+/g,' ').replace(/\s+/g,' ').trim();
export function q_number(v){
  if(typeof v==='number') return Number.isFinite(v)?v:null;
  const m=String(v??'').replace(/\s/g,'').replace(',','.').match(/^-?\d+(?:\.\d+)?$/);
  return m?Number(m[0]):null;
}
// Deux valeurs d'un même champ disent-elles la même chose ? Nombres : écart d'arrondi seulement (±0,05, ou 0,1 % au-delà de 100).
// Textes : même texte une fois normalisé, ou l'un contient l'autre (« Laine de verre » / « laine de verre 200 mm »).
export function sameValue(field,a,b){
  if(a===undefined||a===null||a===''||b===undefined||b===null||b==='') return false;
  const def=FIELD_MAP[field]||{};
  const na=q_number(a), nb=q_number(b);
  if(def.type==='number'||(na!==null&&nb!==null)){
    if(na===null||nb===null) return false;
    return Math.abs(na-nb)<=Math.max(0.051,Math.abs(nb)*0.001)+1e-9;
  }
  const x=q_norm(a), y=q_norm(b); if(!x||!y) return false;
  if(x===y) return true;
  return (x.length>=3&&y.includes(x))||(y.length>=3&&x.includes(y));
}

// Champs décrits en texte libre dans Salesforce (« Zépac 70 : 2*PAC… + secours chaudière ») et en catégorie dans les
// documents (« PAC ») : on compare les catégories. Juste si les catégories lues sont toutes dans Salesforce ;
// « non comparable » si l'un des deux ne nomme aucune catégorie (« Production commune avec le chauffage »).
const Q_CAT_RULES={
  energy:[['pac',/\bpac\b|pompe a chaleur|thermodynamique|\bcet\b|zepac|effipac|aerotherm|geotherm/],['reseau',/reseau de chaleur|chauffage urbain|sous ?-?station|\brcu\b|reseau urbain/],
    ['gaz',/\bgaz\b|chaudiere(?! bois)(?! a granul)|condensation|\bgn\b/],['elec',/electri|effet joule|\bjoule\b|convecteur|panneaux? rayonnant|radiateurs? electrique|ballons? electrique/],
    ['bois',/\bbois\b|granul|biomasse|pellet|buche/],['solaire',/solaire|\bcesi\b|\bssc\b/],['fioul',/fioul|fuel|mazout/]],
  ventilation:[['double',/double flux|\bdf\b/],['hygro',/hygro|\bsimple flux\b|\bsf\b|vmc/],['naturelle',/naturelle|vmr|ventilation par conduit/]],
  glazing:[['triple',/triple/],['double',/double|\b4[ ./-]?1[0-9][ ./-]?4\b|\b44[.,]2/]],
  insulation:[['lv',/laine de verre|\blv\b|\bgr ?3[0-9]\b/],['lr',/laine de roche|\blr\b|roche/],['pse',/polystyrene expanse|\bpse\b|\bpsee\b|\bpse[- ]?th/],['xps',/extrude|\bxps\b/],
    ['pu',/polyurethane|\bpu\b|\bpur\b|\bpir\b/],['fibre_bois',/fibre de bois|laine de bois|\bfdb\b/],['ouate',/ouate|cellulose/],['biosource',/chanvre|lin\b|coton|paille/],['laine_minerale',/laine minerale/]],
};
export const CAT_FIELDS={heating_mode_after:'energy',heating_vector_after:'energy',heating_vector_before:'energy',ecs:'energy',ecs_vector_after:'energy',ecs_vector_before:'energy',
  ventilation:'ventilation',window_glazing:'glazing',roof_insulation:'insulation',wall_insulation:'insulation',floor_insulation:'insulation',wall_ite_insulation:'insulation',wall_iti_insulation:'insulation'};
export function categoriesOf(field,v){
  const kind=CAT_FIELDS[field]; if(!kind) return null;
  const t=' '+q_norm(v)+' '; const set=new Set();
  for(const [k,re] of Q_CAT_RULES[kind]) if(re.test(t)) set.add(k);
  if(kind==='insulation'&&set.has('laine_minerale')&&(set.has('lv')||set.has('lr'))) set.delete('laine_minerale');
  return set;
}
// Résultat d'une comparaison à Salesforce : 'juste' | 'faux' | 'incomparable'.
export function compareToReference(field,docValue,refValue){
  if(CAT_FIELDS[field]){
    const d=categoriesOf(field,docValue), r=categoriesOf(field,refValue);
    if(!d.size||!r.size) return sameValue(field,docValue,refValue)?'juste':'incomparable';
    // Laine minérale (sans précision) = laine de verre ou de roche.
    const ok=[...d].every(k=>r.has(k)||(k==='laine_minerale'&&(r.has('lv')||r.has('lr')))||((k==='lv'||k==='lr')&&r.has('laine_minerale')));
    return ok?'juste':'faux';
  }
  return sameValue(field,docValue,refValue)?'juste':'faux';
}

// Niveaux de fiabilité. calib : {pairs:{'méthode|champ':{juste,faux}}, methods:{…}} produit par le banc de vérité.
export const RELIABILITY=Object.freeze({
  certifiee:{rank:4,label:'Certifiée (Salesforce, vérifiée par les évaluateurs)',short:'Certifiée'},
  sure:{rank:3,label:'Sûre (lecture mesurée juste ≥ 95 % face à Salesforce)',short:'Sûre'},
  probable:{rank:2,label:'Probable (lecture mesurée juste ≥ 85 % face à Salesforce)',short:'Probable'},
  averifier:{rank:1,label:'À vérifier (lecture non mesurée, peu fiable ou contredite par un autre document)',short:'À vérifier'},
});
const Q_SF_SRC=/salesforce/i;
// Exactitude mesurée d'une méthode de lecture pour un champ (sinon pour la méthode tous champs confondus).
export function methodAccuracy(calib,method,field=''){
  const pick=m=>{ if(!m) return null; const n=(m.juste||0)+(m.faux||0); return n>=CALIB_MIN?{rate:(m.juste||0)/n,n}:null; };
  return (field&&pick(calib?.pairs?.[`${method}|${field}`]))||pick(calib?.methods?.[method]);
}
export const CALIB_MIN=12, CALIB_SURE=0.95, CALIB_PROBABLE=0.85;
// Niveau d'une valeur : Salesforce = certifiée ; sinon le niveau MESURÉ par le banc de vérité pour cette méthode de
// lecture et ce champ ; une lecture non mesurée reste « à vérifier ». (Banc, validation croisée : la confirmation par un
// 2e document ou le seul fait d'être un XML ne prédisaient pas une valeur juste — 76 % et 33 %.)
export function reliabilityOf(o,{calib=null,field=''}={}){
  if(!o) return null;
  const m=String(o.method||''), f=field||o.field||'';
  if(m==='manual:free-paste'||Q_SF_SRC.test(o.fileName||'')) return 'certifiee';
  if(/^geocode:/.test(m)) return m==='geocode:ign'?'sure':'averifier';
  if(/^manual:/.test(m)||o.docType==='Correction manuelle') return 'sure'; // saisie ou validation de l'utilisateur
  const acc=(o.agreeFiles>=2&&methodAccuracy(calib,`accord${Math.min(3,o.agreeFiles)}`,f))||methodAccuracy(calib,m,f);
  if(acc) return acc.rate>=CALIB_SURE?'sure':acc.rate>=CALIB_PROBABLE?'probable':'averifier';
  return 'averifier';
}

// Calibration mesurée par le banc de vérité Salesforce (statistiques par méthode de lecture, sans donnée d'opération) :
// data/fiabilite-calibration.json, chargée au démarrage de l'appli et par l'import massif.
let CALIB=null;
export function setCalibration(c){ CALIB=c&&c.methods?c:null; return !!CALIB; }
export function getCalibration(){ return CALIB; }
const Q_NO_CONFIRM=/^(?:manual:|geocode:|derive:|coherence:|library:)/;
const Q_STUDY_DOC=/RSET|RSEE|RSENV|RT2012|RT Existant|[ÉE]tude thermique|[ÉE]tude carbone/i;
// Fiabilité de chaque valeur d'un résultat : {bâtiment: {champ: niveau}}.
export function reliabilityTable(result,{calib=CALIB,reasons=null}={}){
  const out={}, finals=result?.finals||[], detailed=result?.detailed||[];
  for(const row of result?.rows||[]){ const b=row.building, m={};
    for(const [f,v] of Object.entries(row)){
      if(f==='building'||v===undefined||v===null||v===''||!FIELD_MAP[f]) continue;
      const o=finals.find(x=>x.field===f&&x.building===b)||finals.find(x=>x.field===f&&x.building==='Bâtiment unique');
      if(!o) continue;
      // Valeur contestée : un autre document (autre fichier, lecture des documents) donne une autre valeur pour ce bâtiment
      // (ex. deux versions d'étude). Sans Salesforce, impossible de savoir laquelle a été certifiée → « à vérifier ».
      const contested=!!o.fileName&&detailed.some(d=>d.field===f&&(d.building===b||d.originalBuilding===b)&&d.fileName&&d.fileName!==o.fileName&&Q_STUDY_DOC.test(String(d.docType||''))&&!Q_NO_CONFIRM.test(String(d.method||''))&&d.value!==undefined&&d.value!==null&&d.value!==''&&!sameValue(f,d.value,v));
      const lvl=reliabilityOf(o,{calib,field:f});
      m[f]=contested&&lvl!=='certifiee'&&!/^manual:/.test(String(o.method||''))?'averifier':lvl;
      if(reasons) (reasons[b]=reasons[b]||{})[f]=contested?'contestée':methodAccuracy(calib,String(o.method||''),f)?'mesure':'non mesurée';
    }
    out[b]=m;
  }
  return out;
}
export function reliabilityCounts(table){
  const c={certifiee:0,sure:0,probable:0,averifier:0};
  for(const m of Object.values(table||{})) for(const k of Object.values(m)) if(c[k]!==undefined) c[k]++;
  return c;
}

// ---------- v2.35.0 — recoupement entre documents ----------
// Pour chaque bâtiment et chaque champ, toutes les lectures des documents (retenues ou non) sont regroupées par valeur
// (arrondi près, ou même catégorie). Score d'un groupe : somme, par fichier distinct, de la fiabilité mesurée de sa
// meilleure lecture (log-cote). Le groupe le mieux soutenu remplace la valeur retenue quand elle n'en fait pas partie,
// et complète un champ vide s'il est assez soutenu. Jamais sur une valeur Salesforce, saisie ou validée.
const Q_SKIP=/^(?:manual:|geocode:|derive:|coherence:)/;
const q_logit=p=>{ const x=Math.min(0.99,Math.max(0.5,p)); return Math.log(x/(1-x)); };
function q_groupKey(field,v){
  if(CAT_FIELDS[field]){ const c=categoriesOf(field,v); if(c&&c.size) return 'c:'+[...c].sort().join('+'); }
  const n=q_number(v); if(n!==null) return null; // nombres : regroupés par proximité
  return 't:'+q_norm(v);
}
// Fiabilité d'une lecture CANDIDATE (retenue ou non), mesurée par le banc : calib.cands['méthode|champ'].
function candAccuracy(calib,method,field){
  const m=calib?.cands?.[`${method}|${field}`]||calib?.cands?.[method]; if(!m) return null; const n=(m.juste||0)+(m.faux||0);
  return n>=8?(m.juste||0)/n:null;
}
// Probabilité qu'une valeur soit juste : au moins une de ses sources (fichiers distincts) est juste (« ou » bruité).
const q_noisyOr=ws=>1-ws.reduce((a,w)=>a*(1-Math.min(0.995,Math.max(0,w))),1);
export function recoupement(result,{calib=CALIB,prior=0.3,margin=0.15,fillMin=0.85,newestOnly=true}={}){
  if(!result?.rows) return {replaced:0,filled:0};
  const detailed=result.detailed||[], finals=result.finals||[]; let replaced=0, filled=0;
  const weight=o=>candAccuracy(calib,String(o.method||''),o.field)??prior;
  for(const row of result.rows){ const b=row.building;
    const byField=new Map();
    for(const d of detailed){ if(!d||!FIELD_MAP[d.field]||d.field==='building'||Q_SKIP.test(String(d.method||''))||d.userValidated||d.value===undefined||d.value===null||d.value==='') continue;
      if(!(d.building===b||d.originalBuilding===b||d.building==='Bâtiment unique')) continue;
      (byField.get(d.field)||byField.set(d.field,[]).get(d.field)).push(d); }
    for(const [field,cands0] of byField){
      const cur=finals.find(o=>o.field===field&&(o.building===b||o.building==='Bâtiment unique'));
      if(cur&&(cur.userValidated||/^manual:/.test(String(cur.method||''))||Q_SF_SRC.test(cur.fileName||''))) continue;
      let cands=cands0;
      if(newestOnly){ const dated=cands.filter(c=>c.versionFromFile&&Date.parse(c.studyDate)); if(dated.length){ const top=Math.max(...dated.map(c=>Date.parse(c.studyDate)));
        cands=cands.filter(c=>!(c.versionFromFile&&Date.parse(c.studyDate))||Date.parse(c.studyDate)>=top-36e5); } }
      const groups=[];
      for(const c of cands){ const k=q_groupKey(field,c.value);
        let g=k?groups.find(x=>x.k===k):groups.find(x=>x.k===null&&sameValue(field,x.rep.value,c.value));
        if(!g){ g={k,rep:c,files:new Map()}; groups.push(g); }
        const w=weight(c), f=c.fileName||c.docId||'?'; if(!g.files.has(f)||g.files.get(f)<w) g.files.set(f,w); if(w>weight(g.rep)) g.rep=c; }
      if(!groups.length) continue;
      for(const g of groups) g.p=q_noisyOr([...g.files.values()]);
      groups.sort((x,y)=>y.p-x.p||y.files.size-x.files.size);
      const best=groups[0];
      const has=row[field]!==undefined&&row[field]!==null&&row[field]!=='';
      const curG=has?groups.find(g=>g.k?g.k===q_groupKey(field,row[field]):sameValue(field,g.rep.value,row[field])):null;
      if(curG===best){ if(cur){ cur.agreeFiles=best.files.size; cur.agreeP=best.p; } continue; }
      if(has&&!(best.p>=(curG?.p||0)+margin)) { if(cur&&curG){ cur.agreeFiles=curG.files.size; cur.agreeP=curG.p; } continue; }
      if(!has&&best.p<fillMin) continue;
      const rep=best.rep, o={...rep,building:b,status:'retenu',agreeFiles:best.files.size,agreeP:best.p,recoupe:true,
        provenanceNote:`Recoupement : ${best.files.size} document(s) concordant(s)${has?` ; remplace « ${row[field]} »`:''}.`};
      const idx=cur?finals.indexOf(cur):-1; if(idx>=0) finals.splice(idx,1); finals.push(o); row[field]=rep.value;
      if(has) replaced++; else filled++;
    }
  }
  return {replaced,filled};
}
