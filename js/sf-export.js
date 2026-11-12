// ExtracTerre v2.26.0 — export Salesforce « Opérations (détails) » (.xls HTML, .xlsx ou .csv) : une ligne par opération,
// colonnes « Évaluation: Performance thermique », « … Parois verticales »… Chaque ligne est reconstituée en fiche et lue par
// le même décodeur que le favori Salesforce (collage-libre.js) : mêmes valeurs, mêmes bâtiments, même priorité.
const SFX_SECTIONS=['Performance thermique','Planchers hauts','Parois verticales','Planchers bas','Menuiseries extérieures','Ponts thermiques','Chauffage','Régulation','Eau chaude sanitaire',"Renouvellement d'air",'Énergies renouvelables','Observations générales'];
// Entités nommées courantes (accents français) ; un export peut écrire « &eacute; » au lieu de « é ».
const SFX_ENT={eacute:'é',egrave:'è',ecirc:'ê',euml:'ë',agrave:'à',acirc:'â',ccedil:'ç',ocirc:'ô',ouml:'ö',ucirc:'û',ugrave:'ù',uuml:'ü',icirc:'î',iuml:'ï',Eacute:'É',Egrave:'È',Ecirc:'Ê',Agrave:'À',Acirc:'Â',Ccedil:'Ç',Ocirc:'Ô',Icirc:'Î',oelig:'œ',OElig:'Œ',rsquo:'’',lsquo:'‘',laquo:'«',raquo:'»',deg:'°',sup2:'²',sup3:'³',euro:'€',hellip:'…',ndash:'–',mdash:'—',times:'×',middot:'·'};
const sfx_norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();

// Tableau HTML d'un export « .xls » de Salesforce → lignes de cellules (les <br> deviennent des retours à la ligne).
export function sfxParseHtmlTable(html){
  const decode=t=>t.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(m,d)=>String.fromCharCode(Number(d))).replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCharCode(parseInt(h,16)))
    .replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&([A-Za-z]+[0-9]?);/g,(m,k)=>SFX_ENT[k]??m).replace(/&amp;/g,'&').replace(/\r/g,'').trim();
  const rows=[];
  for(const tr of String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) rows.push([...tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m=>decode(m[1])));
  return rows;
}

// Colonnes reconnues : contrat, code interne, statut de l'évaluation, sections techniques.
export function sfxColumns(headers){
  const h=(headers||[]).map(x=>sfx_norm(String(x).replace(/^[^:]*:\s*(?=[^:]+$)/,'')));
  const full=(headers||[]).map(sfx_norm);
  const find=re=>full.findIndex(x=>re.test(x));
  const sections=[];
  SFX_SECTIONS.forEach(title=>{ const i=h.indexOf(sfx_norm(title)); if(i>=0) sections.push({index:i,title}); });
  // v2.30.0 — adresse de l'opération : « Rue », « Ville », « Code postal de l'opération (texte) ».
  const short=h;
  return {contract:find(/num[ée]?e?ro du contrat|^contrat$/),code:find(/(^|: )code interne$/),evalStatus:find(/evaluation: statut$/),sections,
    street:short.findIndex(x=>/^(rue|adresse|voie|(adresse|rue) de l'? ?operation)$/.test(x)),city:short.findIndex(x=>/^(ville|commune|ville de l'? ?operation)$/.test(x)),postcode:short.findIndex(x=>/^code postal/.test(x))};
}

// Ligne → fiche (même texte que la page lue par le favori) + valeurs directes (contrat, statut de l'évaluation).
export function sfxFiche(row,cols){
  const code=cols.code>=0?String(row[cols.code]||'').trim():'';
  const parts=[];
  if(/^OPE-\d{6}$/.test(code)) parts.push(code,'');
  for(const s of cols.sections){ const v=String(row[s.index]||'').trim(); if(v) parts.push(s.title,v,''); }
  const contractRaw=cols.contract>=0?String(row[cols.contract]||'').replace(/\s/g,''):'';
  const contract=/^\d{1,8}$/.test(contractRaw)?contractRaw.replace(/^0+/,'').padStart(8,'0'):'';
  const cell=i=>i>=0?String(row[i]||'').replace(/\s+/g,' ').trim():'';
  let postcode=cell(cols.postcode).replace(/\s/g,''); if(/^\d{4}$/.test(postcode)) postcode='0'+postcode; if(!/^\d{5}$/.test(postcode)) postcode='';
  const address=cell(cols.street), city=cell(cols.city);
  return {address,postcode,city,text:parts.join('\n'),code,contract,evaluationStatus:cols.evalStatus>=0?String(row[cols.evalStatus]||'').trim():'',hasTechnical:cols.sections.some(s=>String(row[s.index]||'').trim())};
}
