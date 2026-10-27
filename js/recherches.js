// v2.6.0 — Recherches personnalisées : grilles de critères modifiables par l'utilisateur (mots-clés, synonymes, contexte,
// exclusions, type de réponse), appliquées au texte des documents d'un projet. Chaque résultat cite le document, la page et
// la ligne : une recherche ne produit jamais de valeur absente des documents. Les mots-clés peuvent être proposés par l'IA
// (Ollama en local), seule la description du critère lui est envoyée.
import {normLower,parseFrNumber} from './utils.js';

export const SEARCH_KINDS={presence:'Présence',number:'Nombre',text:'Texte',stats:'Statistiques'};
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
const srch_list=v=>(Array.isArray(v)?v:String(v??'').split(/[,;\n]/)).map(s=>String(s??'').trim()).filter(Boolean).slice(0,60);
const srch_normS=s=>normLower(s).replace(/[’'`]/g,' ');
const srch_numOrNull=v=>{ const n=typeof v==='number'?v:parseFrNumber(String(v??'')); return Number.isFinite(n)?n:null; };

// Grille reçue d'un fichier, de l'IA ou du stockage local : champs attendus seulement, typés un par un.
export function normalizeGrid(g={}){
  const themes=(Array.isArray(g.themes)?g.themes:[]).map(t=>({name:String(t?.name??'').trim().slice(0,120),min:Math.max(0,Math.round(srch_numOrNull(t?.min)??0)),required:srch_list(t?.required),applicableIf:String(t?.applicableIf??'').trim()})).filter(t=>t.name);
  const criteria=(Array.isArray(g.criteria)?g.criteria:[]).map(c=>({id:String(c?.id||srch_uidS()).replace(/[^\w-]/g,'').slice(0,40)||srch_uidS(),theme:String(c?.theme??'').trim().slice(0,120),label:String(c?.label??'').trim().slice(0,200),
    description:String(c?.description??'').trim().slice(0,600),kind:SEARCH_KINDS[c?.kind]?c.kind:'presence',unit:String(c?.unit??'').trim().slice(0,20),min:srch_numOrNull(c?.min),max:srch_numOrNull(c?.max),
    keywords:srch_list(c?.keywords),context:srch_list(c?.context),exclude:srch_list(c?.exclude),inverse:c?.inverse===true,window:Math.min(15,Math.max(0,Math.round(srch_numOrNull(c?.window)??4)))})).filter(c=>c.label);
  for(const c of criteria) if(c.theme&&!themes.some(t=>t.name===c.theme)) themes.push({name:c.theme,min:0,required:[],applicableIf:''});
  return {id:String(g.id||`g${Date.now().toString(36)}`).replace(/[^\w-]/g,'').slice(0,40),name:String(g.name||'Nouvelle recherche').trim().slice(0,80),description:String(g.description??'').trim().slice(0,2000),
    docFilter:String(g.docFilter??'').trim().slice(0,200),themes,criteria};
}

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
const srch_NUM_RE=/(?:^|[^\d,.])(\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*([a-z²³%€]{0,4}\d?)/gi;
function srch_numbersInLine(line,unit){
  const out=[]; const u=normLower(unit).replace(/\s+/g,''); const units=u==='m2'||u==='m²'?['m2','m²','m']:u?[u]:null;
  // Unité exacte : « 30 mm » n'est pas « 30 m ».
  for(const m of line.matchAll(srch_NUM_RE)){ const n=parseFrNumber(m[1]); if(n===null) continue; const after=normLower(m[2]||'').replace(/\d$/,''); if(units&&!units.includes(after)) continue; out.push(n); }
  return out;
}
function srch_docLines(doc){
  return (doc.read?.pages||[]).flatMap(p=>{ const lines=Array.isArray(p.lines)&&p.lines.length?p.lines.map(l=>String(l.text||'')):String(p.text||'').split(/\r?\n/); return lines.map((t,i)=>({page:p.page,i,t:srch_normS(t),raw:t})).filter(x=>x.t.trim()); });
}

// Applique une grille aux documents prêts d'un projet : {criteria:{id:{found,values,evidence}}, themes:{name:{found,min,ok,applicable}}}.
export function runSearchGrid(grid,docs,overrides={}){
  const g=normalizeGrid(grid); const filter=g.docFilter?srch_list(g.docFilter):[];
  const pool=(docs||[]).filter(d=>d.status==='ready'&&d.read?.pages?.length&&!d.read?.financialQuestionnaire&&(!filter.length||filter.some(f=>normLower(`${d.name} ${d.type||''}`).includes(normLower(f)))));
  const corpus=pool.map(d=>({d,lines:srch_docLines(d)}));
  const criteria={};
  for(const c of g.criteria){
    const ev=[]; const values=[]; const cap=c.kind==='stats'?2000:5;
    if(c.keywords.length) for(const {d,lines} of corpus){ let perDoc=0;
      for(let k=0;k<lines.length&&perDoc<cap;k++){ const L=lines[k]; if(!srch_anyTerm(c.keywords,L.t)||srch_anyTerm(c.exclude,L.t)) continue;
        const near=lines.slice(Math.max(0,k-c.window),k+c.window+1).filter(x=>x.page===L.page);
        if(c.context.length&&!near.some(x=>srch_anyTerm(c.context,x.t))) continue;
        let nums=[],ok=true;
        if(c.kind==='stats'){ const n=srch_cellNumbers(L.t,c.unit).find(x=>(c.min===null||x>=c.min)&&(c.max===null||x<=c.max)); if(n===undefined) continue; nums=[n]; values.push(n); }
        if(c.kind==='number'){ nums=srch_numbersInLine(L.t,c.unit); if(!nums.length&&!/\d/.test(L.t)&&lines[k+1]?.page===L.page) nums=srch_numbersInLine(lines[k+1].t,c.unit); /* valeur sur la ligne suivante seulement si le libellé n'a aucun nombre */
          if(!nums.length) continue; values.push(...nums); ok=nums.some(n=>(c.min===null||n>=c.min)&&(c.max===null||n<=c.max)); }
        ev.push({doc:d.name,docId:d.id,page:L.page,line:L.raw.trim().slice(0,300),context:near.map(x=>x.raw.trim()).join(' / ').slice(0,600),values:nums,ok}); perDoc++; } }
    const manual=overrides?.[c.id];
    // Critère « inverse » : un résultat est un indice contraire (critère non rempli), jamais une preuve de conformité.
    const found=manual==='Oui'?true:manual==='Non'||manual==='Sans objet'?false:c.inverse?false:ev.some(e=>e.ok);
    criteria[c.id]={found,contrary:!manual&&(c.inverse?ev.length>0:ev.length>0&&!ev.some(e=>e.ok)),manual:manual||'',values:c.kind==='stats'?values:[...new Set(values)],stats:c.kind==='stats'?srchStats(values):null,evidence:ev,text:c.kind==='text'?[...new Set(ev.map(e=>e.line))].slice(0,5).join(' ; '):''};
  }
  const themes={};
  for(const t of g.themes){
    const own=g.criteria.filter(c=>c.theme===t.name&&c.id!==t.applicableIf);
    const applicable=!t.applicableIf||!!criteria[t.applicableIf]?.found;
    const req=own.filter(c=>t.required.includes(c.id)), opt=own.filter(c=>!t.required.includes(c.id));
    const found=opt.filter(c=>criteria[c.id]?.found).length, reqOk=req.every(c=>criteria[c.id]?.found);
    themes[t.name]={applicable,found,min:t.min,required:req.length,requiredOk:reqOk,ok:applicable?(reqOk&&found>=t.min):null};
  }
  return {grid:g,criteria,themes,documents:pool.map(d=>d.name)};
}

// Valeur d'un critère dans le tableau / l'export.
export function searchCellValue(c,x){
  if(!x) return '';
  if(x.manual) return x.manual;
  if(x.contrary) return c.inverse?'Indice contraire':`Hors seuil (${x.values.join(' ; ')}${c.unit?` ${c.unit}`:''})`;
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
export const SECURITY_GRID=normalizeGrid({id:'securite-logements',name:'Sécurité des logements',docFilter:'',
  description:'Sécurisation des logements contre les intrusions, des abords, des halls, des parkings en sous-sol et des accès aux étages : indices relevés dans les CCTP (étude de l’existant).',
  themes:[{name:'Fenêtres en rez-de-chaussée',min:1},{name:'Portes d’entrée des logements',min:1},{name:'Abords extérieurs',min:5,required:['abords_portails']},
    {name:'Halls d’entrée',min:2},{name:'Parkings en sous-sol',min:3,required:['parking_portail'],applicableIf:'parking_present'},{name:'Accès aux étages',min:2}],
  criteria:[
    {id:'fen_volets',theme:'Fenêtres en rez-de-chaussée',label:'Volets roulants avec système anti-soulèvement',keywords:['anti soulevement','anti-relevage','re:verrou\\w*\\s+(?:automatique|anti)','blocage du tablier'],context:['volet','tablier']},
    {id:'fen_442',theme:'Fenêtres en rez-de-chaussée',label:'Vitrages 44.2 (retardateur d’effraction)',keywords:['re:\\b44[./ ]?2\\b','re:\\bsp\\s?10\\b','retardateur d effraction','retardateur d\'effraction'],context:['vitrage','fenetre','menuiserie','stadip','feuillete','baie']},
    {id:'fen_barreaux',theme:'Fenêtres en rez-de-chaussée',label:'Fenêtres protégées par des barreaux',keywords:['barreaux','barreaudage','grille de defense','grilles de defense','grille anti effraction'],context:['fenetre','baie','rez de chaussee','rdc','en tableau','tableau'],exclude:['cloture','portail','portillon','garde corps','garde-corps','main courante','tablier','lisse'],window:2},
    {id:'porte_3pts',theme:'Portes d’entrée des logements',label:'Porte pleine, serrure 3 points (hors 3 points de compression)',keywords:['re:serrure[^\\n]{0,40}3\\s*points','re:3\\s*points[^\\n]{0,20}(?:a|à)?\\s*p[eê]ne','re:cr[eé]mone[^\\n]{0,15}3\\s*points[^\\n]{0,40}a2p'],context:['porte palier','porte paliere','portes palieres','bloc porte palier','porte d entree','porte de logement','porte d\'entree'],exclude:['compression','fenetre','porte fenetre','porte-fenetre'],window:8},
    {id:'porte_a2p',theme:'Portes d’entrée des logements',label:'Bloc-porte A2P BP1 ou équivalent, serrure A2P 1 étoile minimum',keywords:['re:\\ba2p\\s*(?:bp\\s?[123]|\\*|[123]\\s*etoile)','re:\\bbp\\s?[123]\\b','re:\\ba2p\\b'],context:['porte','bloc porte','serrure'],exclude:['a2p r1','a2pr1'],window:8},
    {id:'abords_portails',theme:'Abords extérieurs',label:'Portails véhicules et piétons à accès sécurisé (obligatoire)',keywords:['portail','portillon'],context:['vigik','badge','digicode','controle d acces','telecommande','platine','interphone','visiophone','ventouse','gache electrique']},
    {id:'abords_cloture',theme:'Abords extérieurs',label:'Clôture d’au moins 1,80 m (ou règle du PLU)',kind:'number',unit:'m',min:1.8,keywords:['cloture','clotures'],context:['hauteur','ht','h ='],window:3},
    {id:'abords_acces_unique',theme:'Abords extérieurs',label:'Un seul point d’accès véhicules et piétons',keywords:['seul acces','acces unique','seul point d acces','unique point d acces']},
    {id:'abords_observables',theme:'Abords extérieurs',label:'Au moins 60 % des accès observables depuis un logement',keywords:['observable','surveillance naturelle','vue depuis les logements']},
    {id:'abords_separation',theme:'Abords extérieurs',label:'Pas de communication entre bâtiments',keywords:['separation des batiments','aucune communication entre','pas de communication entre']},
    {id:'abords_ombre',theme:'Abords extérieurs',label:'Suppression des zones d’ombre',keywords:['zone d ombre','zones d ombre']},
    {id:'abords_renfoncement',theme:'Abords extérieurs',label:'Renfoncements de 1,20 m maximum',kind:'number',unit:'m',max:1.2,keywords:['renfoncement','renfoncements','recoin']},
    {id:'abords_cheminement',theme:'Abords extérieurs',label:'Cheminements d’au moins 1,40 m de large',kind:'number',unit:'m',min:1.4,keywords:['cheminement','cheminements','allee pietonne','allees pietonnes'],context:['largeur','large']},
    {id:'abords_escaliers',theme:'Abords extérieurs',label:'Escaliers extérieurs sans dessous exploitable',keywords:['dessous d escalier','sous face d escalier','dessous des escaliers'],context:['ferme','condamne','obture','grille']},
    {id:'abords_aveugles',theme:'Abords extérieurs',label:'Absence de locaux aveugles non surveillés',keywords:['local aveugle','locaux aveugles']},
    {id:'hall_traversant',theme:'Halls d’entrée',label:'Hall non traversant (un seul point d’entrée et de sortie)',keywords:['non traversant','hall traversant','halls traversants'],context:['hall']},
    {id:'hall_vitrage',theme:'Halls d’entrée',label:'Hall vitré (> 30 % de la surface au sol) en 44.2',keywords:['re:\\b44[./ ]?2\\b','stadip','retardateur d effraction'],context:['hall','sas','porte d entree d immeuble','entree principale','ensemble vitre']},
    {id:'hall_sas',theme:'Halls d’entrée',label:'Sas sécurisé : badge + visiophone (platine IK08) puis serrure électronique à badge',keywords:['sas'],context:['badge','vigik','visiophone','interphone','platine','controle d acces','ventouse','gache electrique'],exclude:['cabinet','capital','siret','etabli par','sarl','societe'],window:6},
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
  ]});
