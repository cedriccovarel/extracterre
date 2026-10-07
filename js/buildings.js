import {isClimaWinSynthesis,climaWinBuildingSections,isClimaWinInputReport} from './climawin.js';
import {normalizeText,normLower,unique} from './utils.js';
import {isPleiadesThermalOutput,pleiadesThermalBuildingNames} from './pleiades-sortie.js';
import {isCstbRseeFiche,cstbBuildingNames} from './rset-cstb.js';
import {isCarbonNoticeRe2020,carbonNoticeBuildingNames} from './notice-carbone.js';
import {isBbcaCalculette,bbcaBuildingName} from './calculette-bbca.js';
import {isPleiadesAcvReport,isPleiadesServicesSummary,isHeatLossReport,pleiadesReportBuildingNames} from './pleiades-rapports.js';
import {isThermalNoticeColumns,thermalNoticeBuildingNames,isBiosourcedLabelNotice} from './notice-thermique.js';

export function canonicalBuilding(raw){
  let s=normalizeText(raw).replace(/^['"“”]+|['"“”]+$/g,'').trim();
  s=s.replace(/^(?:identifiant\s+)?(?:batiment|bâtiment)\s*[:\-]?\s*/i,'').trim();
  s=s.replace(/^bat\.?\s+/i,'').trim();
  s=s.replace(/\s*\(\s*\d+\s+zones?\s*\)\s*$/i,'').trim();
  s=s.replace(/\s*-\s*zone\s*:?.*$/i,'').trim();
  if(!s) return 'Bâtiment unique';
  const up=s.toUpperCase().replace(/\s+/g,' ');
  if(/^(UNIQUE|PRINCIPAL|ENSEMBLE)$/.test(up)) return 'Bâtiment unique';
  return `Bâtiment ${up.replace(/^BATIMENT\s+/,'').replace(/^BÂTIMENT\s+/,'')}`;
}

// Clé de regroupement prudente : elle neutralise les variantes d'écriture évidentes
// (Bât A / Batiment A / BAT-A) sans fusionner automatiquement des identifiants différents
// comme B et B1. Les rapprochements ambigus restent disponibles pour une fusion manuelle.
export function buildingMergeKey(raw){
  let s=normalizeText(raw).toLowerCase();
  if(!s) return '';
  s=s.replace(/["'“”]/g,' ')
    .replace(/\([^)]*zones?[^)]*\)/g,' ')
    .replace(/^\s*(?:identifiant\s+)?(?:batiment|bâtiment|bat|bât)\.?\s*[:\-]?\s*/i,'')
    .replace(/\s*-\s*zone\s*:?.*$/i,' ')
    .replace(/(?:batiment|bâtiment)/g,' ')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
  if(!s) return '';
  const tokens=s.split(/\s+/).filter(Boolean).map(t=>/^\d+$/.test(t)?String(parseInt(t,10)):t);
  return tokens.join(' ');
}

export function buildingCoreId(raw){
  const key=buildingMergeKey(raw); if(!key) return '';
  // Codes bâtiment fréquents : A, B, B1, C02, 100, 200, FA, FB…
  const first=key.split(' ')[0];
  if(/^(?:[a-z]{1,3}\d{0,3}|\d{1,4})$/.test(first)) return first.replace(/^([a-z]+)0+(\d+)$/,'$1$2').replace(/^0+(\d+)$/,'$1');
  return key;
}

export function buildingSimilarity(a,b){
  const ka=buildingMergeKey(a), kb=buildingMergeKey(b); if(!ka||!kb) return 0;
  if(ka===kb) return 1;
  const ca=buildingCoreId(a), cb=buildingCoreId(b);
  if(ca&&cb&&ca===cb) return .98;
  if(ca&&cb&&(ca.startsWith(cb)||cb.startsWith(ca))&&Math.abs(ca.length-cb.length)<=2) return .78;
  const A=new Set(ka.split(' ')), B=new Set(kb.split(' '));
  const inter=[...A].filter(x=>B.has(x)).length, union=new Set([...A,...B]).size;
  return union?inter/union:0;
}

function expectedBuildingCount(doc){
  for(const page of doc.read?.pages||[]){
    for(const line of page.lines||[]){
      const s=normalizeText(line.text);
      const m=s.match(/nombre\s+de\s+b[aâ]timents?\s*\/\s*zones?\s+du\s+projet\s*[:\-]?\s*(\d+)/i)
        ||s.match(/nombre\s+de\s+b[aâ]timents?\s+du\s+projet\s*[:\-]?\s*(\d+)/i);
      if(m) return parseInt(m[1],10);
    }
  }
  return null;
}

function cleanCandidate(raw){
  let s=normalizeText(raw).replace(/^['"“”]+|['"“”]+$/g,'').trim();
  s=s.replace(/\s*\(\s*\d+\s+zones?\s*\)\s*$/i,'').trim();
  s=s.replace(/\s*-\s*zone\s*:?.*$/i,'').trim();
  return s;
}

function looksLikeBuildingId(raw){
  const s=cleanCandidate(raw);
  if(!s||s.length>150) return false;
  if(/^(?:s|srt|sref|zone(?:s)?|usage|surface|ref|m2|projet)$/i.test(s)) return false;
  return /\d|[a-zà-ÿ]/i.test(s);
}

export function detectBuildings(doc){
  // v2.3.3 — synthèse ClimaWin : les bâtiments sont les titres de section « N. Bâtiment X » (jamais les lignes de tableau).
  if(isClimaWinSynthesis(doc)){
    const secs=climaWinBuildingSections(doc);
    if(secs.length){ const names=[...new Set(secs.map(x=>x.name))]; return {names,expectedCount:names.length,source:'climawin-sections',hits:secs.map(x=>({page:x.page,line:x.line,building:x.name}))}; }
  }
  // v2.3.5 — sortie Pléiades : bâtiments = titres « 1.N <nom> » des résultats RE2020.
  if(isPleiadesThermalOutput(doc)){
    const names=pleiadesThermalBuildingNames(doc).map(canonicalBuilding);
    if(names.length) return {names:[...new Set(names)],expectedCount:names.length,source:'pleiades-sortie-sections',hits:[]};
  }
  // v2.3.7 — éditions Pléiades (rapport ACV, synthèse des prestations, déperditions) : titres explicites.
  if(isPleiadesAcvReport(doc)||isPleiadesServicesSummary(doc)||isHeatLossReport(doc)){
    const names=pleiadesReportBuildingNames(doc).map(canonicalBuilding);
    return names.length?{names:[...new Set(names)],expectedCount:new Set(names).size,source:'pleiades-rapport',hits:[]}:{names:['Bâtiment unique'],hits:[],expectedCount:0,complete:true,aliases:{},source:'pleiades-rapport'};
  }
  // v2.3.9 — calculette BBCA : un bâtiment par fichier (« Projet …_Bat A » ou nom de fichier).
  if(isBbcaCalculette(doc)){
    const n=bbcaBuildingName(doc);
    return n==='Bâtiment unique'?{names:['Bâtiment unique'],hits:[],expectedCount:0,complete:true,aliases:{},source:'calculette-bbca'}:{names:[canonicalBuilding(n)],expectedCount:1,source:'calculette-bbca',hits:[]};
  }
  // v2.3.6 — notice carbone RE2020 : bâtiments = sections « EVALUATION DU BILAN CARBONE – BATIMENT X ».
  if(isCarbonNoticeRe2020(doc)){
    const names=carbonNoticeBuildingNames(doc).map(canonicalBuilding);
    if(names.length) return {names:[...new Set(names)],expectedCount:new Set(names).size,source:'notice-carbone-sections',hits:[]};
  }
  if(isThermalNoticeColumns(doc)){
    const names=thermalNoticeBuildingNames(doc).map(canonicalBuilding);
    if(names.length) return {names:[...new Set(names)],expectedCount:new Set(names).size,source:'notice-thermique-colonnes',hits:[]};
  }
  // Notice label biosourcé : tableaux FDES (identifiants numériques) — jamais de bâtiments détectés depuis ces lignes.
  if(isBiosourcedLabelNotice(doc)) return {names:['Bâtiment unique'],hits:[],expectedCount:0,complete:true,aliases:{},source:'notice-biosource'};
  // v2.3.5 — fiche RSET / RSEE CSTB : bâtiments = marqueurs « Bâtiment : X », « "X" », « Nom du bâtiment X ».
  if(isCstbRseeFiche(doc)){
    const names=cstbBuildingNames(doc).map(canonicalBuilding);
    if(names.length) return {names:[...new Set(names)],expectedCount:new Set(names).size,source:'cstb-rsee-sections',hits:[]};
  }
  // Rapport de saisie ClimaWin : données d'entrée, non exploitées (numérotation « Bâtiment 1/2/3 » ≠ synthèse A/B/C).
  if(isClimaWinInputReport(doc)) return {names:['Bâtiment unique'],hits:[],expectedCount:0,complete:true,aliases:{},source:'climawin-input-skipped'};
  // v2.3 — XML RE2020 : la liste des bâtiments est donnée par les balises Index/Name, sans heuristique.
  if(doc?.read?.re2020?.buildings?.length){
    const names=doc.read.re2020.buildings.map(b=>b.name);
    return {names,expectedCount:names.length,source:'xml-re2020',hits:[]};
  }
  const expectedCount=expectedBuildingCount(doc);
  const strong=[];
  let genericSingleHeadingSeen=false;

  const isGenericBuildingHeading=(raw='')=>{
    // Certains logiciels répètent des intitulés techniques comme
    // « Bâtiment : Bâtiment (RE2020) » ou « Bâtiment - bâtiment neuf Consommations ».
    // On retire tous les tokens « bâtiment » avant de décider s'il s'agit d'un vrai identifiant.
    const n=normLower(cleanCandidate(raw))
      .replace(/\b(?:batiment|bâtiment)\b/g,' ')
      .replace(/[()\[\]{}:;,_./\-–—]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    if(!n) return true;
    // Titres de logiciels/rapports qui décrivent la nature du calcul, pas un identifiant bâtiment.
    if(/^(?:re\s*2020|rt\s*2012|neuf|existant|projet|consommations?|resultats?|résultats?)$/.test(n)) return true;
    if(/^(?:neuf|existant|projet)\s+(?:consommations?|resultats?|résultats?)$/.test(n)) return true;
    if(/^(?:resultats?|résultats?)\s+(?:consommations?|enveloppe|energie|énergie|carbone)$/.test(n)) return true;
    return false;
  };

  // 1) Registre maître : les identifiants explicites du Chapitre 2 sont prioritaires.
  for(const page of doc.read?.pages||[]){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const text=normalizeText(lines[i].text);
      let raw=null, quality='heading';
      let m=text.match(/^identifiant\s+b[aâ]timent\s*[:\-]?\s*(.+)$/i);
      if(m){ raw=m[1]; quality='chapter2-id'; }
      // Les rapports logiciels utilisent souvent « 1.1. Bâtiment : BÂTIMENT A ».
      if(!raw){ m=text.match(/^(?:\d+(?:\.\d+)*\.?\s*)?(?:batiment|bâtiment)\s*:\s*(.+)$/i); if(m){raw=m[1];quality='building-heading';} }
      // Synthèses ACV (ClimaWin notamment) : « 1. Bâtiment A », « 2. Bâtiment B - 1 » sans deux-points.
      if(!raw && !/\bsommaire\b/i.test(page.text||'')){ m=text.match(/^(?:\d+(?:\.\d+)*\.?\s*)?(?:batiment|bâtiment)\s+([A-Z0-9][A-Z0-9 ._\/-]{0,80})$/i); if(m){raw=m[1];quality='building-heading';} }
      if(!raw) continue;
      raw=cleanCandidate(raw);
      if(isGenericBuildingHeading(raw)){ genericSingleHeadingSeen=true; continue; }
      if(!looksLikeBuildingId(raw)) continue;
      const building=canonicalBuilding(raw);
      if(building!=='Bâtiment unique') strong.push({building,page:page.page,line:lines[i].index,text:lines[i].text,quality});
    }
  }

  // Si on dispose d'identifiants Chapitre 2, ils définissent la liste canonique.
  let master=unique(strong.filter(h=>h.quality==='chapter2-id').map(h=>h.building));
  if(!master.length) master=unique(strong.map(h=>h.building));

  // Un rapport mono-bâtiment peut employer seulement « Bâtiment : Bâtiment (RE2020) »
  // ou « 1.1. Bâtiment : BÂTIMENT ». Dans ce cas, ne pas fabriquer de faux bâtiments
  // à partir d'intitulés de tableaux rencontrés plus loin dans le PDF.
  if(!master.length && genericSingleHeadingSeen && (!expectedCount || expectedCount===1))
    return {names:['Bâtiment unique'],hits:[],expectedCount,complete:!expectedCount||expectedCount===1,aliases:{}};

  // 2) Si nécessaire, détecter les en-têtes courts de type « Bat 100 (2 zones) ».
  if(!master.length || (expectedCount&&master.length<expectedCount)){
    const candidates=[];
    for(const page of doc.read?.pages||[]){ for(const line of page.lines||[]){
      const text=normalizeText(line.text);
      const m=text.match(/^bat(?:iment)?\s+([A-Z0-9][A-Z0-9 ._\/-]{0,80}?)(?:\s*\(\s*\d+\s+zones?\s*\))?$/i);
      if(m){ const building=canonicalBuilding(`Bat ${m[1]}`); if(building!=='Bâtiment unique') candidates.push({building,page:page.page,line:line.index,text:line.text,quality:'short-heading'}); }
    }}
    const counts=new Map(); for(const h of candidates) counts.set(h.building,(counts.get(h.building)||0)+1);
    const reliable=unique(candidates.filter(h=>(counts.get(h.building)||0)>=2).map(h=>h.building));
    master=unique([...master,...reliable]);
    strong.push(...candidates.filter(h=>master.includes(h.building)));
  }

  if(!master.length) return {names:['Bâtiment unique'],hits:[],expectedCount,complete:!expectedCount||expectedCount===1,aliases:{}};

  // 3) Construire les alias autorisés à partir du registre maître, puis repérer chaque changement de bâtiment
  // dans les chapitres 3/4, feuillets équipements/génération et sorties détaillées.
  const aliasMap=new Map();
  for(const b of master){
    const short=b.replace(/^Bâtiment\s+/i,'').trim();
    // Les identifiants courts A/B/1 ne doivent jamais être utilisés comme mots isolés :
    // cela créerait de faux changements de bâtiment sur les articles « a/à » du texte courant.
    const aliases=unique([`Bat ${short}`,`Batiment ${short}`,`Bâtiment ${short}`].map(normLower));
    aliasMap.set(b,{short:normLower(short),aliases});
  }
  const allHits=[...strong];
  const seen=new Set(allHits.map(h=>`${h.building}|${h.page}|${h.line}`));
  for(const page of doc.read?.pages||[]){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const text=normalizeText(lines[i].text), low=normLower(text);
      for(const [building,aliasDef] of aliasMap){
        const {short,aliases}=aliasDef;
        const matchedFull=aliases.some(a=>{
          if(!a) return false;
          const esc=a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
          if((short||'').length<=2){
            // A/B : accepter uniquement une vraie terminaison d'identifiant, jamais « bâtiment à usage ».
            return new RegExp(`(?:^|[^a-z0-9])${esc}(?=$|\\s*(?:\\(|s(?:ref|rt)?\\s*:|[-:])|[\\)\\]\"'])`,'i').test(low);
          }
          return new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`,'i').test(low);
        });
        const shortEsc=(short||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const matchedShort=!!shortEsc && (
          new RegExp(`\\(\\s*${shortEsc}\\s*\\)`,'i').test(low) ||
          new RegExp(`^\\s*${shortEsc}\\s+s(?:ref|rt)?\\s*:`,'i').test(low) ||
          low.trim()===short
        );
        if(!(matchedFull||matchedShort)) continue;
        const contextOK=/^(?:bat|b[aâ]timent|identifiant|g[eé]n[eé]ration|r[eé]sultats?\s+sorties?\s+d[eé]taill[eé]es?)/i.test(text)
          ||/chapitre\s+[234]|feuillets?\s+(?:equipements|équipements|generation|génération)|zone\s*:|b[aâ]timent\s*:/i.test(text)
          ||text.length<70;
        if(!contextOK) continue;
        const k=`${building}|${page.page}|${lines[i].index}`;
        if(!seen.has(k)){ seen.add(k); allHits.push({building,page:page.page,line:lines[i].index,text:lines[i].text,quality:'alias-heading'}); }
      }
    }
  }

  allHits.sort((a,b)=>(a.page-b.page)||((a.line??0)-(b.line??0)));
  // Dédupliquer les hits immédiatement répétés du même bâtiment ; ils sont inutiles pour l'ancrage.
  const hits=[];
  for(const h of allHits){ const p=hits[hits.length-1]; if(p&&p.building===h.building&&p.page===h.page&&Math.abs((p.line??0)-(h.line??0))<=1) continue; hits.push(h); }

  // v2.3.3 — une ligne de tableau (« Bâtiment A 19.00 7.20 1.90 … ») n'est jamais un bâtiment.
  const rowLike=n=>/(?:\s\d+[.,]\d+){3,}/.test(String(n))||/\s\d+[.,]\d+\s*%/.test(String(n));
  if(master.some(rowLike)){ const keep=master.filter(n=>!rowLike(n)); if(keep.length){ master.length=0; master.push(...keep); } for(let i=hits.length-1;i>=0;i--) if(rowLike(hits[i].building)) hits.splice(i,1); }
  return {names:master,hits,expectedCount,complete:!expectedCount||master.length===expectedCount,aliases:Object.fromEntries([...aliasMap].map(([k,v])=>[k,[...(v.aliases||[]),v.short].filter(Boolean)]))};
}

export function buildingForPosition(doc,pageNo,lineIndex){
  const b=doc.buildings||detectBuildings(doc); if(b.names.length===1) return b.names[0];
  const candidates=(b.hits||[]).filter(h=>h.page<pageNo||(h.page===pageNo&&(h.line??0)<=lineIndex));
  if(!candidates.length) return b.names[0]||'Bâtiment unique';
  candidates.sort((a,b)=>(b.page-a.page)||((b.line??0)-(a.line??0)));
  return candidates[0].building;
}

export function operationNameFromFiles(docs){
  if(!docs.length) return 'Opération';
  let s=docs[0].name.replace(/\.(pdf|xml|xlsx?|xls)$/i,'').replace(/\b(rset|rsee|rt2012|rsee?|dpgf|cctp|rapport|etude|étude)\b/ig,' ').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  return s||'Opération';
}
