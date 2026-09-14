import {DOC_TYPES,FIELD_DEFS,FIELD_MAP,normalizeFieldHeader,matchFieldByHeader,MATERIALS,STRUCTURES,HVAC,COOLING,WINDOW_MATERIALS,GLAZINGS,SHADINGS,ENR_TYPES,FAN_TYPES,ELEMENT_PATTERNS} from './config.js';
import {normalizeText,normLower,numbersIn,parseFrNumber,findFirstMatch,unique,clamp,maskNonDataNumerics,normalizeGlazingType} from './utils.js';
import {buildingForPosition,canonicalBuilding} from './buildings.js';
import {matchInsulationProduct,libraryNote} from './insulation-library.js';
import {parsePatchOccurrences} from './patches.js';

function occ(doc,page,line,field,value,method,confidence=0.75,unit='',extra={}){
  if(value===null||value===undefined||value==='') return null;
  return {field,value,building:buildingForPosition(doc,page.page,line.index),docId:doc.id,fileName:doc.name,docType:doc.type,page:page.page,excerpt:normalizeText(line.text).slice(0,420),confidence:clamp(confidence),method,unit,...extra};
}
function push(out,o){ if(o) out.push(o); }
function lineWindow(page,i,before=2,after=2){ const ls=page.lines||[]; return ls.slice(Math.max(0,i-before),Math.min(ls.length,i+after+1)).map(x=>x.text).join(' | '); }
function firstValueAfterLabel(text,labelRe){ const flags=labelRe.flags.includes('i')?'i':''; const clean=normalizeText(maskNonDataNumerics(text)); const m=clean.match(new RegExp(`(?:${labelRe.source})[^0-9+-]{0,90}([-+]?\\d+(?:[\\s.]\\d{3})*(?:[,.]\\d+)?)`,flags)); return m?parseFrNumber(m[1]):null; }
function phaseFromContext(text,doc){
  const s=normLower(`${doc.name} ${text}`);
  if(/\b(?:avant\s+travaux|etat\s+initial|etat\s+existant|existant|initial|avant\s+renovation|situation\s+initiale)\b/.test(s)) return 'before';
  if(/\b(?:apres\s+travaux|etat\s+projet|projet|projete|final|reception|neuf|remplace|nouveau|future?)\b/.test(s)) return 'after';
  if(doc.type===DOC_TYPES.RT_EXISTING) return 'before';
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(doc.type)) return 'after';
  return 'unknown';
}
function targetFromContext(s){ if(ELEMENT_PATTERNS.wall.test(s)) return 'wall'; if(ELEMENT_PATTERNS.floor.test(s)) return 'floor'; if(ELEMENT_PATTERNS.roof.test(s)) return 'roof'; return null; }
function explicitThickness(s){
  const m=s.match(/(?:ep(?:aisseur)?\.?|e)\s*(?:isolant(?:e)?\s*)?(?:=|:)?\s*(\d{1,4}(?:[,.]\d+)?)\s*(mm|cm|m)\b/i)||s.match(/\b(\d{2,4}(?:[,.]\d+)?)\s*(mm|cm)\b/i);
  if(!m) return null; let v=parseFrNumber(m[1]); const u=m[2].toLowerCase(); if(u==='cm') v*=10; if(u==='m') v*=1000; return v;
}
function explicitR(s){ const m=s.match(/(?:\bresistance\s+thermique\b|\bR\b)\s*(?:thermique\s*)?(?:=|:|de)?\s*(\d+(?:[,.]\d+)?)/i); return m?parseFrNumber(m[1]):null; }

function rowNumericValues(line){
  const items=(line?.items||[]).map(it=>({text:normalizeText(it.text||it.str||''),x:Number(it.x)||0}));
  const nums=[];
  for(const it of items){ if(/^[-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?$/.test(it.text)){ const v=parseFrNumber(it.text); if(v!==null) nums.push({...it,value:v}); } }
  return nums;
}
function valueNearestX(line,targetX,maxDistance=95){
  if(targetX==null) return null; const nums=rowNumericValues(line); if(!nums.length) return null;
  nums.sort((a,b)=>Math.abs(a.x-targetX)-Math.abs(b.x-targetX)); return Math.abs(nums[0].x-targetX)<=maxDistance?nums[0].value:null;
}
function headerXNear(lines,start,re){
  for(let k=Math.max(0,start-1);k<=Math.min(lines.length-1,start+2);k++){
    for(const it of lines[k].items||[]){ const t=normalizeText(it.text||it.str||''); if(re.test(t)) return Number(it.x)||null; }
  }
  return null;
}
function shabValueFromRow(line,shabX=null){
  const xVal=valueNearestX(line,shabX,125); if(xVal!==null && xVal>0) return xVal;
  let nums=numbersIn(line.text||'');
  if(nums.length<2) return null;
  const low=normLower(line.text||'');
  // Une ligne peut commencer par « Zone 02 » : l'identifiant de zone n'est pas une surface.
  if(/^zone\s+\d+\b/.test(low) && nums.length>=3) nums=nums.slice(1);
  // Dans les tableaux Chapitre 2 RT2012/RE2020 : première valeur = surface réglementaire,
  // deuxième valeur = colonne « Surface utile ... / SHAB », puis viennent CE1/CE2/.../groupes.
  if(nums.length>=2 && nums[0]>0 && nums[1]>=0) return nums[1];
  return null;
}
function rsetShabFromChapter2(doc){
  const out=[];
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const h=normalizeText(lines[i].text);
      if(!/surface\s+utile\s+(?:su|surt)|surf\.?\s*hab\.?\s*shab/i.test(h)) continue;
      const building=buildingForPosition(doc,page.page,lines[i].index);
      const shabX=headerXNear(lines,i,/surface\s+utile|\bshab\b/i);
      const rows=[];
      for(let j=i+1;j<Math.min(lines.length,i+40);j++){
        const line=lines[j], t=normalizeText(line.text), low=normLower(t);
        if(/^(?:nombre\s+de\s+logements|type\s+de\s+construction|type\s+de\s+r[eé]seau|exigences?\s+de\s+r[eé]sultat|batiment\s*:|bâtiment\s*:)/i.test(t)) break;
        // Les vraies lignes de zones contiennent le libellé ZONE et au moins deux valeurs de surface.
        // Avec extraction PDF, le libellé et les valeurs sont normalement sur la même ligne.
        if(!/^zone\b/i.test(t) || /^zone\(s\)\s+du\s+batiment|^zone\(s\)\s+du\s+bâtiment/i.test(t)) continue;
        const v=shabValueFromRow(line,shabX);
        if(v!==null && v>0){ rows.push({label:t.replace(/\s+/g,' ').slice(0,120),value:v,line}); continue; }
        // Certains PDF scindent le libellé et les chiffres : regarder uniquement les 3 lignes suivantes,
        // sans jamais prendre un « m2 » d'en-tête comme valeur.
        for(let k=j+1;k<Math.min(lines.length,j+4);k++){
          const nt=normalizeText(lines[k].text);
          if(/\bzone\b/i.test(nt)) break;
          const nv=shabValueFromRow(lines[k],shabX);
          if(nv!==null && nv>0 && numbersIn(nt).length>=2){ rows.push({label:t,value:nv,line:lines[k]}); j=k; break; }
        }
      }
      if(!rows.length) continue;
      // Uniquement une occurrence par ligne de zone ; ne jamais sommer deux extractions du même groupe.
      const seen=new Set(), uniq=[];
      for(const r of rows){ const k=`${r.line.index}|${Math.round(r.value*1000)}`; if(!seen.has(k)){seen.add(k);uniq.push(r);} }
      const sum=Math.round(uniq.reduce((a,r)=>a+r.value,0)*1000)/1000;
      const detail=uniq.map(r=>`${r.label}: ${String(r.value).replace('.',',')} m²`).join(' + ');
      push(out,occ(doc,page,uniq[0].line,'shab',sum,'rset:chapter2-shab-column',0.995,'m²',{building,surfacePriority:101,derivedFromDocument:uniq.length>1,origin:'RSET Chapitre 2',excerpt:`Chapitre 2 — colonne « Surface utile SU/SURT ou surf. hab. SHAB » : ${detail}${uniq.length>1?` = ${String(sum).replace('.',',')} m²`:''}`,provenanceNote:uniq.length>1?'SHAB = somme stricte des lignes de zones dans la colonne « Surface utile SU/SURT ou surf. hab. SHAB » du Chapitre 2 pour ce bâtiment.':'SHAB lue directement dans la colonne « Surface utile SU/SURT ou surf. hab. SHAB » du Chapitre 2.'}));
    }
  }
  // Un seul résultat SHAB final par bâtiment, même si l'en-tête est scindé sur plusieurs lignes.
  const best=new Map();
  for(const o of out){ const cur=best.get(o.building); if(!cur || String(o.excerpt||'').length>String(cur.excerpt||'').length) best.set(o.building,o); }

  // Secours strict : certains RSET répètent explicitement « SHAB ou SURT 1 169,1 m² »
  // dans les feuillets techniques. On ne l'utilise que si le Chapitre 2 n'a rien fourni
  // pour ce bâtiment et si une vraie surface (>20 m²) est portée par la même ligne.
  for(const page of doc.read.pages||[]){
    for(const line of page.lines||[]){
      const t=normalizeText(line.text), low=normLower(t);
      if(!/\bshab\s+ou\s+surt\b|\bsurf\.?\s*hab\.?\s*shab\b/i.test(t)) continue;
      if(/ratio|1\s*\/\s*6|tic\b|tic\s*r[eé]f|surface\s+utile\s+surt/i.test(low)) continue;
      const vals=numbersIn(t).filter(v=>Number.isFinite(v)&&v>20&&v<100000);
      if(!vals.length) continue;
      const building=buildingForPosition(doc,page.page,line.index);
      if(best.has(building)) continue;
      const value=vals[0];
      best.set(building,occ(doc,page,line,'shab',value,'rset:explicit-shab-fallback',0.96,'m²',{building,surfacePriority:100,origin:'RSET — mention SHAB explicite',excerpt:t.slice(0,420),provenanceNote:'Valeur utilisée uniquement en secours car la ligne porte explicitement la mention « SHAB ou SURT » avec une surface exploitable.'}));
    }
  }
  return [...best.values()].filter(Boolean);
}
function plausibleBuildingSurface(value){
  return Number.isFinite(value) && value>=10 && value<1000000;
}
function parseBuildingSurface(doc){
  const out=[];
  // Le champ historique `shab` devient le champ de surface bâtiment de référence.
  // Priorité sémantique : SHAB explicite > Sref/SRéf > surface habitable > surface du bâtiment > SU/SURT/SRT/SHONRT explicite.
  // On n'extrait jamais une simple occurrence de "m²", ni une surface de paroi/baie/zone sans libellé bâtiment.
  const patterns=[
    {kind:'SHAB',re:/^\s*(?:shab|surf\.?\s*hab\.?\s*shab)(?:\s*(?:ou|\/|-)\s*(?:su|surt))?\s*(?:\([^)]*\))?\s*[:=]?\s*/i,confidence:.997},
    {kind:'SHAB / SU',re:/^\s*shab\s*\/\s*su\s*[:=]?\s*/i,confidence:.997},
    {kind:'Sref',re:/^\s*s\s*ref\s*\/\s*usage\s+principal\s*[:=]?\s*/i,confidence:.996},
    {kind:'Sref',re:/^\s*s\s*ref\s*(?:\([^)]*\))?\s*[:=]?\s*/i,confidence:.994},
    {kind:'Sref',re:/^\s*surface\s+(?:de\s+)?r[eé]f[eé]rence(?:\s+du\s+b[aâ]timent)?\s*[:=]\s*/i,confidence:.992},
    {kind:'Surface habitable',re:/^\s*surface\s+habitable(?:\s+(?:du|de)\s+b[aâ]timent(?:\s+r[eé]sidentiel)?)?\s*(?:\([^)]*\))?\s*[:=]?\s*/i,confidence:.994},
    {kind:'Surface bâtiment',re:/^\s*surface\s+(?:totale\s+)?(?:du\s+)?b[aâ]timent\s*(?:\([^)]*\))?\s*[:=]?\s*/i,confidence:.989},
    {kind:'Surface de plancher',re:/^\s*surface\s+de\s+plancher(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.976},
    {kind:'Surface réglementaire',re:/^\s*surface\s+r[eé]glementaire(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.986},
    {kind:'Surface thermique',re:/^\s*surface\s+thermique(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.984},
    {kind:'Surface totale',re:/^\s*surface\s+totale(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.983},
    {kind:'SU',re:/^\s*surface\s+utile(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.982},
    {kind:'SURT',re:/^\s*surt\s*(?:totale)?\s*[:=]?\s*/i,confidence:.978},
    {kind:'SRT',re:/^\s*srt\s*(?:totale)?\s*[:=]?\s*/i,confidence:.975},
    {kind:'SHONRT',re:/^\s*shonrt\s*(?:totale)?\s*[:=]?\s*/i,confidence:.972},
    {kind:'Surface',re:/^\s*surface\s*[:=]\s*/i,confidence:.970}
  ];
  const byBuilding=new Map();
  const accept=(page,line,value,kind,confidence,method,excerptText='')=>{
    if(!plausibleBuildingSurface(value)) return;
    const building=buildingForPosition(doc,page.page,line.index);
    const semanticPriority=/SHAB/i.test(kind)?100:/Surface habitable/i.test(kind)?98:/Sref/i.test(kind)?96:/Surface bâtiment|Surface réglementaire|Surface thermique/i.test(kind)?94:/Surface totale|Surface de plancher|SU|SURT/i.test(kind)?92:/SRT|SHONRT/i.test(kind)?88:/^Surface$/i.test(kind)?86:90;
    const candidate=occ(doc,page,line,'shab',value,method,confidence,'m²',{
      building,
      surfacePriority:semanticPriority,
      origin:`${doc.type} — ${kind}`,
      excerpt:(excerptText||normalizeText(line.text)).slice(0,420),
      provenanceNote:`Surface bâtiment lue explicitement sous le libellé « ${kind} ». Le champ accepte SHAB, Sref/SRéf, surface habitable, surface du bâtiment, surface réglementaire/thermique/totale, SU, SURT, SRT ou SHONRT selon le document.`
    });
    if(!candidate) return;
    const cur=byBuilding.get(building);
    if(!cur || candidate.confidence>cur.confidence || (candidate.confidence===cur.confidence && candidate.page<cur.page)) byBuilding.set(building,candidate);
  };
  for(const page of doc.read.pages||[]){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], raw=normalizeText(line.text), low=normLower(raw);
      if(!raw) continue;
      // Exclure les lignes de ratios, exigences réglementaires et surfaces d'éléments constructifs.
      if(/ratio\s*\/\s*sref|1\s*\/\s*6|surface\s+(?:de\s+)?(?:fa[cç]ade|baie|paroi|plancher|toiture|mur)|w\s*\/\s*\(?m2\s*sref|kwh\s*\/\s*\(?m2\s*sref|kg\s*(?:eq\.)?\s*co2\s*\/\s*m2\s*sref/i.test(low)) continue;

      // Cas très courant RSEE : « SRef / usage principal 1 138,5 m2 / ... » (pas de : ou =).
      let m=raw.match(/^\s*s\s*ref\s*\/\s*usage\s+principal\s+([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)\s*m(?:2|²)(?=\s|\/|$)/i);
      if(m){ accept(page,line,parseFrNumber(m[1]),'Sref',.998,'surface:sref-usage-principal',raw); continue; }

      // Cas synthèse : « Type de travaux : ... Sref : 330,8 m² » ; le libellé n'est pas en début de ligne.
      m=raw.match(/\bs\s*ref\s*:\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)\s*m(?:2|²)(?=\s|\/|$)/i);
      if(m){ accept(page,line,parseFrNumber(m[1]),'Sref',.996,'surface:sref-inline',raw); continue; }

      // Valeur SHAB explicite en tableau : « Shab m² 5 110,25 » ou « SHAB : 5 110,25 m² ».
      // Ce format détaillé prime sur une valeur SHAB/SU arrondie trouvée ailleurs dans le même document.
      m=raw.match(/^\s*shab\s*(?:\([^)]*\))?\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)(?:\s*m(?:2|²))?\b/i);
      if(m){ accept(page,line,parseFrNumber(m[1]),'SHAB',.999,'surface:shab-explicit-table',raw); continue; }

      // Cas étude thermique : « ... SHAB/SU : 5110 m² ... » dans une ligne descriptive globale.
      m=raw.match(/\bshab\s*\/\s*su\s*:\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)\s*m(?:2|²)?\b/i);
      if(m){ accept(page,line,parseFrNumber(m[1]),'SHAB / SU',.997,'surface:shab-su-inline',raw); continue; }

      let matched=false;
      for(const spec of patterns){
        const lm=raw.match(spec.re); if(!lm) continue;
        const tail=raw.slice(lm[0].length);
        // Cas direct : « SHAB 1 138,5 m² », « Surface habitable 5110 m² »...
        const vm=tail.match(/^\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)\s*(?:m(?:2|²))?(?=\s|\/|$)/i);
        if(vm){ const directValue=parseFrNumber(vm[1]); if(plausibleBuildingSurface(directValue)){ accept(page,line,directValue,spec.kind,spec.confidence,`surface:${spec.kind.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,raw); matched=true; break; } }

        // PDF.js sépare parfois l'unité « m² » et la valeur sur deux lignes, voire place
        // le « 2 » exposant avant la vraie surface. On regarde uniquement le voisinage immédiat
        // du libellé et on ignore tout nombre < 10 (exposant, indice de zone, ratio...).
        const compactLabel=/^(?:shab(?:\s*(?:ou|\/)\s*(?:su|surt))?|s\s*ref(?:\s*\/\s*usage\s+principal)?|surt(?:\s+totale)?|srt(?:\s+totale)?|shonrt(?:\s+totale)?|surface(?:\s+(?:habitable|utile|r[eé]glementaire|thermique|totale|de\s+plancher|(?:de\s+)?r[eé]f[eé]rence|(?:totale\s+)?(?:du\s+)?b[aâ]timent))?)(?:\s*\([^)]*\))?\s*(?::|=)?\s*(?:m(?:2|²))?\s*$/i;
        if(compactLabel.test(raw) || /^s\s*ref\s*\/\s*usage\s+principal\b/i.test(raw) || /^srt\b/i.test(raw)){
          const near=normalizeText([tail,...lines.slice(i+1,i+3).map(x=>x.text)].join(' | '));
          const nearVals=numbersIn(near).filter(plausibleBuildingSurface);
          if(nearVals.length){
            const chosen=nearVals[0];
            accept(page,line,chosen,spec.kind,spec.confidence-.002,`surface:${spec.kind.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-nearby`,`${raw} | ${lines.slice(i+1,i+3).map(x=>normalizeText(x.text)).join(' | ')}`);
            matched=true; break;
          }
        }
      }
      if(matched) continue;
    }
  }
  return [...byBuilding.values()].filter(Boolean);
}

function rsetChapter2Structured(doc){
  const out=[]; const ticByBuilding=new Map();
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], s=normalizeText(line.text), building=buildingForPosition(doc,page.page,line.index);
      let m=s.match(/^nombre\s+de\s+logements\s*[:\-]?\s*(\d+)/i);
      if(m) push(out,occ(doc,page,line,'housing_count',parseInt(m[1],10),'rset:chapter2-housing-count',0.995,'',{building,origin:'RSET Chapitre 2'}));
      if(/^(?:zone\s+)?traversante\b/i.test(normLower(s)) && !/non\s+traversante/i.test(normLower(s))) push(out,occ(doc,page,line,'cross_ventilated','Oui','rset:chapter2-zone-type',0.98,'',{building,origin:'RSET Chapitre 2'}));
      if(/non\s+traversante/i.test(normLower(s))) push(out,occ(doc,page,line,'non_cross_ventilated','Oui','rset:chapter2-zone-type',0.98,'',{building,origin:'RSET Chapitre 2'}));

      // RT2012 : le tableau Tic contient une ligne par groupe. On retient le groupe le plus défavorable,
      // c.-à-d. celui dont Tic - TicRef est le plus élevé (marge de sécurité la plus faible).
      const header=normalizeText(lineWindow(page,i,0,6));
      if(/zones?\s+ou\s+parties?\s+de\s+zones?.*\btic\b.*\btic\s*(?:ref|r[eé]f)/i.test(header)){
        for(let j=i+1;j<Math.min(lines.length,i+24);j++){
          const rowLine=lines[j], row=normalizeText(lineWindow(page,j,0,2));
          if(/tic\s+repr[eé]sente|exigences?\s+de\s+r[eé]sultat/i.test(row)) break;
          if(!/conforme|non\s+conforme/i.test(row)) continue;
          const nums=numbersIn(row);
          if(nums.length<4) continue;
          const surface=nums[nums.length-4], tic=nums[nums.length-3], ref=nums[nums.length-2], delta=nums[nums.length-1];
          if(!(tic>10&&tic<50&&ref>10&&ref<50&&delta>-20&&delta<20)) continue;
          const cur=ticByBuilding.get(building);
          if(!cur||delta>cur.delta) ticByBuilding.set(building,{tic,ref,delta,surface,page,rowLine,excerpt:row});
        }
      }
    }
  }
  for(const [building,r] of ticByBuilding){
    push(out,occ(doc,r.page,r.rowLine,'tic',r.tic,'rset:chapter2-tic-worst-group',0.995,'°C',{building,origin:'RSET Chapitre 2',excerpt:r.excerpt,provenanceNote:'Tic du groupe le plus défavorable du bâtiment (marge Tic - TicRef la plus élevée).'}));
    push(out,occ(doc,r.page,r.rowLine,'tic_ref',r.ref,'rset:chapter2-tic-worst-group',0.995,'°C',{building,origin:'RSET Chapitre 2',excerpt:r.excerpt,provenanceNote:'TicRef correspondant au groupe le plus défavorable retenu pour le bâtiment.'}));
  }
  return out;
}

function buildingFromKnownAlias(doc,text,fallback='Bâtiment unique'){
  const low=normLower(text);
  for(const b of doc.buildings?.names||[]){
    if(b==='Bâtiment unique') continue;
    const short=normLower(b.replace(/^Bâtiment\s+/i,'')).trim();
    if(!short) continue;
    const esc=short.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    // Ne jamais rechercher un identifiant court (A/B/1...) comme simple sous-chaîne :
    // « a » apparaît dans presque tous les libellés et contaminait auparavant les bâtiments suivants.
    const explicit=[`bat\\.?\\s*${esc}`,`batiment\\s*${esc}`,`bâtiment\\s*${esc}`];
    if(explicit.some(src=>{
      if(short.length<=2) return new RegExp(`(?:^|[^a-z0-9])${src}(?=$|\\s*(?:\\(|s(?:ref|rt)?\\s*:|[-:])|[\\)\\]\"'])`,'i').test(low);
      return new RegExp(`(?:^|[^a-z0-9])${src}(?:$|[^a-z0-9])`,'i').test(low);
    })) return b;
    if(new RegExp(`\\(\\s*${esc}\\s*\\)`,'i').test(low)) return b;
    if(low.trim()===short) return b;
  }
  return fallback;
}

function envelopeRowStart(low){
  if(/^parois\s+verticales\b/.test(low)) return 'wall';
  if(/^planchers\s+bas\b/.test(low)) return 'floor';
  if(/^planchers\s+hauts\b/.test(low)) return 'roof';
  return null;
}
function parseEnvelopeRowSegment(lines,start,category){
  let end=start+1;
  for(;end<Math.min(lines.length,start+34);end++){
    const low=normLower(lines[end].text||'');
    if(envelopeRowStart(low) || /^total\s+(?:parois|planchers)|^parois\s+sur\s+locaux|^parois\s+vitr[eé]es|^liaisons?\s+ponts/i.test(low)) break;
  }
  const preStart=Math.max(0,start-5);
  const seg=lines.slice(start,end), ctx=normalizeText(lines.slice(preStart,end).map(x=>x.text).join(' | '));
  const mat=findFirstMatch(ctx,MATERIALS), struct=findFirstMatch(ctx,STRUCTURES);
  const allNums=numbersIn(ctx);
  let thickness=null,totalR=null,pairLine=null;
  // La table RSET contient un couple [épaisseur isolant (cm), R total isolants].
  // Chercher le couple sur une ligne avant de chercher dans le segment concaténé.
  const candidates=[];
  for(let j=0;j<seg.length;j++){
    const ns=numbersIn(seg[j].text||'');
    for(let q=0;q<ns.length-1;q++){
      const a=ns[q],b=ns[q+1];
      if(a>=4 && a<=100 && b>=0 && b<=15 && (b===0 || a/Math.max(b,0.1)>=1.15)) candidates.push({a,b,j,score:(b>0?4:1)+(a>=8?1:0)});
    }
  }
  // Si le PDF a fusionné toute la ligne, les mêmes règles restent valables sur la chaîne concaténée.
  for(let q=0;q<allNums.length-1;q++){
    const a=allNums[q],b=allNums[q+1];
    if(a>=4 && a<=100 && b>=0 && b<=15 && (b===0 || a/Math.max(b,0.1)>=1.15)) candidates.push({a,b,j:-1,score:(b>0?2:0)+(a>=8?1:0)});
  }
  candidates.sort((a,b)=>b.score-a.score || (b.b>0)-(a.b>0));
  if(candidates.length){ thickness=candidates[0].a*10; totalR=candidates[0].b; pairLine=candidates[0].j; }
  if(totalR===null){ const r=explicitR(ctx); if(r!==null&&r<=15) totalR=r; }

  let surface=null;
  // Surface : couple [U, surface] situé après épaisseur/R ; U est typiquement <= 5 W/m².K.
  const surfCandidates=[];
  for(let j=0;j<seg.length;j++){
    const ns=numbersIn(seg[j].text||'');
    for(let q=0;q<ns.length-1;q++){
      const u=ns[q],sf=ns[q+1];
      if(u>=0.01&&u<=5&&sf>0.5&&sf<20000){
        // Écarter le couple épaisseur/R lui-même.
        if(thickness!==null && Math.abs(u-thickness/10)<0.001 && totalR!==null && Math.abs(sf-totalR)<0.001) continue;
        surfCandidates.push({u,sf,j,score:(sf>=10?4:1)+(j>(pairLine??-1)?2:0)});
      }
    }
  }
  surfCandidates.sort((a,b)=>b.score-a.score || b.sf-a.sf);
  if(surfCandidates.length) surface=surfCandidates[0].sf;

  return {mat,struct,thickness,totalR,surface:surface||0,ctx,end};
}
function representativeEnvelopeRecords(doc){
  const recs=[];
  for(const page of doc.read.pages){ const lines=page.lines||[];
    // Les tables de parois sont structurées dans le Chapitre 4. Ne jamais interpréter les
    // tableaux pédagogiques du Chapitre 3 comme des fiches isolants.
    if(!/donn[eé]es\s+r[eé]capitulatives\s+sur\s+les\s+parois/i.test(page.text||'')) continue;
    for(let i=0;i<lines.length;i++){
      const category=envelopeRowStart(normLower(lines[i].text||''));
      if(!category) continue;
      const r=parseEnvelopeRowSegment(lines,i,category);
      if(r.totalR===null&&r.thickness===null&&!r.mat&&!r.struct) continue;
      recs.push({building:buildingForPosition(doc,page.page,lines[i].index),category,mat:r.mat,struct:r.struct,thickness:r.thickness,totalR:r.totalR,surface:r.surface,page,line:lines[i],ctx:r.ctx});
      i=Math.max(i,r.end-1);
    }
  }
  const dedup=new Map();
  for(const r of recs){ const k=[r.building,r.category,r.mat||'',r.struct||'',r.thickness||'',r.totalR||'',r.surface||''].join('|'); if(!dedup.has(k)) dedup.set(k,r); }
  return [...dedup.values()];
}

function rsetEnvelopeStructured(doc){
  const out=[], recs=representativeEnvelopeRecords(doc);
  for(const building of doc.buildings?.names||[]){
    for(const category of ['wall','floor','roof']){
      const pool=recs.filter(r=>r.building===building&&r.category===category);
      if(!pool.length) continue;
      // Par champ, prendre l'enregistrement de plus grande surface qui porte réellement l'information.
      const bestFor=(pred)=>pool.filter(pred).sort((a,b)=>(b.surface||0)-(a.surface||0))[0];
      const rRec=bestFor(r=>r.totalR!==null&&r.totalR>0), thRec=bestFor(r=>r.thickness!==null&&r.thickness>0), matRec=bestFor(r=>!!r.mat), stRec=bestFor(r=>!!r.struct);
      const add=(rec,field,value,unit='')=>{ if(!rec||value===null||value===undefined||value==='') return; push(out,occ(doc,rec.page,rec.line,field,value,'rset:chapter4-envelope-dominant',0.995,unit,{building,origin:'RSET Chapitre 4',excerpt:rec.ctx.slice(0,420),provenanceNote:`Valeur lue dans le tableau « Données récapitulatives sur les parois » du bâtiment ; paroi représentative choisie par la plus grande surface${rec.surface?` (${rec.surface} m²)`:''}.`})); };
      add(matRec,`${category}_insulation`,matRec?.mat);
      add(stRec,`${category}_structure`,stRec?.struct);
      if(category==='wall'&&stRec) add(stRec,'structure',stRec.struct);
      add(thRec,`${category}_insulation_thickness`,thRec?.thickness,'mm');
      add(rRec,`${category}_insulation_r`,rRec?.totalR,'m².K/W');
    }
  }

  // Menuiseries : compter une fois chaque ligne/entrée, sans fenêtre glissante qui surpondère les mots voisins.
  const tally=new Map();
  const addT=(b,k,v,page,line,ctx,weight=1)=>{ if(!v)return; const key=`${b}|${k}|${v}`; const x=tally.get(key)||{building:b,field:k,value:v,count:0,page,line,ctx}; x.count+=weight; tally.set(key,x); };
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){
    const raw=normalizeText(lines[i].text), low=normLower(raw), b=buildingForPosition(doc,page.page,lines[i].index);
    // Une entrée de baie commence le plus souvent par ses dimensions. Regrouper l'entrée jusqu'à la baie suivante
    // évite de compter plusieurs fois le même PVC / vitrage / volet quand le PDF scinde les colonnes en lignes.
    if(/^\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\b/i.test(raw)){
      let j=i+1;
      for(;j<Math.min(lines.length,i+18);j++){
        const t=normalizeText(lines[j].text);
        if(/^\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\b/i.test(t) || /^total\s+(?:verticales|horizontales)|^parois\s+vitr[eé]es|^liaisons?/i.test(t)) break;
      }
      const ctx=normalizeText(lines.slice(i,j).map(x=>x.text).join(' | '));
      addT(b,'window_material',findFirstMatch(ctx,WINDOW_MATERIALS),page,lines[i],ctx);
      addT(b,'window_glazing',normalizeGlazingType(ctx)||findFirstMatch(ctx,GLAZINGS),page,lines[i],ctx);
      let sh=findFirstMatch(ctx,SHADINGS);
      if(!sh&&/volet\s+avec\s+gestion/i.test(normLower(ctx))) sh='Volet avec gestion manuelle';
      addT(b,'window_shading',sh,page,lines[i],ctx);
      i=Math.max(i,j-1);
      continue;
    }
    // Fallback pour des exports PDF dont les dimensions ne sont pas conservées sur une même ligne.
    if(/^volet\s+avec/i.test(low)){
      const ctx=normalizeText(lines.slice(i,Math.min(lines.length,i+4)).map(x=>x.text).join(' '));
      addT(b,'window_shading','Volet avec gestion manuelle',page,lines[i],ctx);
    } else if(/^sans\s+protection\s+mobile/i.test(low)) addT(b,'window_shading','Sans occultation',page,lines[i],raw);
  }}
  for(const b of doc.buildings?.names||[]){ for(const f of ['window_material','window_glazing','window_shading']){ const xs=[...tally.values()].filter(x=>x.building===b&&x.field===f).sort((a,c)=>c.count-a.count); if(xs[0]) push(out,occ(doc,xs[0].page,xs[0].line,f,xs[0].value,'rset:chapter4-windows-majority',0.995,'',{building:b,origin:'RSET Chapitre 4',excerpt:xs[0].ctx.slice(0,420),provenanceNote:`Valeur dominante repérée dans les lignes de menuiseries du bâtiment (${xs[0].count} occurrence(s) non dupliquée(s)).`})); } }
  return out;
}

function rsetSystemsStructured(doc){
  const out=[];
  // Ventilation, au niveau bâtiment/zone dans les feuillets équipements.
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const s=normalizeText(lines[i].text), low=normLower(s), building=buildingForPosition(doc,page.page,lines[i].index);
      if(/groupe\s+de\s+ventilation\s+simple\s+flux/.test(low) && /oui\b/.test(low)){
        let mode='VMC simple flux autoréglable'; const ctx=normalizeText(lines.slice(i,Math.min(lines.length,i+8)).map(x=>x.text).join(' | '));
        if(/hygror[eé]glable\s+type\s*b[^|]{0,20}oui/i.test(ctx)) mode='VMC Hygro B'; else if(/hygror[eé]glable\s+type\s*a[^|]{0,20}oui/i.test(ctx)) mode='VMC Hygro A';
        push(out,occ(doc,page,lines[i],'ventilation',mode,'rset:equipment-ventilation',0.995,'',{building,origin:'RSET Feuillets équipements',excerpt:ctx.slice(0,420)}));
      }
      if(/groupe\s+de\s+ventilation\s+double\s+flux/.test(low) && /oui\b/.test(low)) push(out,occ(doc,page,lines[i],'ventilation','VMC double flux','rset:equipment-ventilation',0.995,'',{building,origin:'RSET Feuillets équipements'}));
    }
  }

  // Génération : l'en-tête « Génération : ... BAT xxx » fixe explicitement le bâtiment desservi.
  let current=null, coldSection=false;
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const s=normalizeText(lines[i].text), low=normLower(s);
      if(/^g[eé]n[eé]ration\s*:/i.test(s)){ current=buildingFromKnownAlias(doc,s,buildingForPosition(doc,page.page,lines[i].index)); coldSection=false; continue; }
      if(!current||current==='Bâtiment unique') continue;
      if(/g[eé]n[eé]rateurs?\s+affect[eé]s?\s+[aà]\s+la\s+production\s+de\s+froid/i.test(s)){ coldSection=true; continue; }
      if(coldSection && /pas\s+de\s+g[eé]n[eé]rateurs?\s+de\s+ce\s+type/i.test(low)){
        push(out,occ(doc,page,lines[i],'cooling','Aucun','rset:generation-no-cooling',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:s})); coldSection=false; continue;
      }
      if(/cat[eé]gorie\s+du\s+g[eé]n[eé]rateur|type\s+d['’]?energie\s+de\s+base|poste\s+de\s+consommation\s+assur[eé]e|chaudi[eè]re|pompe\s+[aà]\s+chaleur|r[eé]seau\s+de\s+chaleur/i.test(low)){
        const ctx=normalizeText(lines.slice(i,Math.min(lines.length,i+4)).map(x=>x.text).join(' | '));
        const mode=findFirstMatch(ctx,HVAC.heating), vec=findFirstMatch(ctx,HVAC.vectors), ecs=findFirstMatch(ctx,HVAC.ecs);
        if(mode) push(out,occ(doc,page,lines[i],'heating_mode_after',mode,'rset:generation-heating',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:ctx.slice(0,420)}));
        if(vec){ push(out,occ(doc,page,lines[i],'heating_vector_after',vec,'rset:generation-heating-vector',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:ctx.slice(0,420)})); if(/ecs|eau\s+chaude|sanitaire|ballon|stockage/i.test(normLower(ctx))) push(out,occ(doc,page,lines[i],'ecs_vector_after',vec,'rset:generation-ecs-vector',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:ctx.slice(0,420)})); }
        if(ecs||(/chauffage\s*\+\s*eau\s+chaude\s+sanitaire/i.test(ctx)&&mode?.includes('Chaudière'))) push(out,occ(doc,page,lines[i],'ecs',ecs||'Chaudière','rset:generation-ecs',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:ctx.slice(0,420)}));
      }
    }
  }
  return out;
}

function buildingFromDetailedLine(text,fallback='Bâtiment unique'){
  const s=normalizeText(text);
  let m=s.match(/^(.+?)\s+S(?:Ref|RT)?\s*:\s*[-+]?\d[\d\s.,]*\s+Consommations\s+et\s+productions\s+annuelles\s+du\s+batiment/i);
  if(m) return canonicalBuilding(m[1]);
  m=s.match(/resultats\s+sorties\s+detaillees\s*-\s*\((.+)\)/i); if(m) return canonicalBuilding(m[1]);
  return fallback;
}
function parseBuildingSummaryRow(line){
  const s=normalizeText(line.text); const m=s.match(/^(?:batiment|bâtiment)\s*\((.+?)\)\s+(.*)$/i); if(!m) return null;
  return {building:canonicalBuilding(m[1]),values:numbersIn(m[2]),excerpt:s,consumed:0};
}
function parseBuildingSummaryRowAt(lines,index){
  const direct=parseBuildingSummaryRow(lines[index]);
  if(direct && direct.values.length) return direct;
  const first=normalizeText(lines[index]?.text||'');
  // Perrenoud/PDF.js peut placer les chiffres sur la ligne « Bâtiment » puis le nom sur
  // les 1 à 2 lignes suivantes : « Bâtiment 1169,1 ... » / « (Batiment » / « A) ».
  if(/^(?:batiment|bâtiment)\s+[-+]?\d/i.test(first)){
    const vals=numbersIn(first);
    const tail=normalizeText(lines.slice(index+1,Math.min(lines.length,index+4)).map(x=>x?.text||'').join(' '));
    const m=tail.match(/^\(\s*(?:batiment|bâtiment|bat)\s+(.+?)\s*\)/i) || tail.match(/^\(\s*(.+?)\s*\)/i);
    if(vals.length && m) return {building:canonicalBuilding(m[1]),values:vals,excerpt:normalizeText(first+' '+tail),consumed:Math.min(3,lines.length-index-1)};
  }
  const parts=[];
  for(let k=index;k<Math.min(lines.length,index+5);k++){
    const t=normalizeText(lines[k]?.text||'');
    if(!t) continue;
    parts.push(t);
    const joined=normalizeText(parts.join(' '));
    const m=joined.match(/^(?:batiment|bâtiment)\s*(?:\((.+?)\)|:?\s*([^0-9]+?))?\s+([-+]?\d[\d\s.,].*)$/i);
    if(m){
      const name=normalizeText(m[1]||m[2]||'').replace(/^[-–—:\s]+|[-–—:\s]+$/g,'');
      const vals=numbersIn(m[3]);
      if(vals.length) return {building:canonicalBuilding(name||'Bâtiment unique'),values:vals,excerpt:joined,consumed:k-index};
    }
    // Cas fréquent PDF : « Bâtiment » / « (Batiment A) » / ligne numérique.
    const m2=joined.match(/^(?:batiment|bâtiment)\s*\((.+?)\)\s*$/i);
    if(m2 && k+1<lines.length){
      const nums=numbersIn(lines[k+1]?.text||'');
      if(nums.length) return {building:canonicalBuilding(m2[1]),values:nums,excerpt:normalizeText(joined+' '+(lines[k+1]?.text||'')),consumed:k+1-index};
    }
  }
  return direct;
}
function rsetDetailedConsumptionData(doc){
  const byBuilding=new Map();
  const ensure=b=>{ if(!byBuilding.has(b)) byBuilding.set(b,{building:b,posts:null,energy:null,energyRows:{},page:null,line:null,basis:null,cep:null,cepnr:null,cepmax:null,cepnrmax:null}); return byBuilding.get(b); };
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const s=normalizeText(lines[i].text), low=normLower(s);
      // Bloc détaillé par poste et par énergie, en EF (RE2020) ou directement en EP (RT2012).
      if(/consommations\s+et\s+productions\s+annuelles\s+du\s+batiment\s+par\s+poste\s+et\s+par\s+type\s+d['’]?energie/i.test(low)){
        const context=normalizeText(lines.slice(Math.max(0,i-3),Math.min(lines.length,i+5)).map(x=>x.text).join(' | '));
        const building=buildingFromKnownAlias(doc,context,buildingFromDetailedLine(s,buildingForPosition(doc,page.page,lines[i].index))); const d=ensure(building); d.page=page; d.line=lines[i];
        d.basis=/energie\s+primaire|énergie\s+primaire/i.test(context)?'primary':'final';
        let headerIdx=-1, hasCoal=false;
        for(let j=i;j<Math.min(lines.length,i+10);j++) if(/\bgaz\b.*\bfod\b.*\bbois\b.*electricite/i.test(normLower(lines[j].text))){headerIdx=j;hasCoal=/charbon/i.test(normLower(lines[j].text));break;}
        const colX={};
        if(headerIdx>=0){
          for(let j=headerIdx;j<Math.min(lines.length,headerIdx+3);j++) for(const it of lines[j].items||[]){ const t=normLower(it.text||it.str||''), x=Number(it.x)||0; if(/^gaz$/.test(t)) colX.gas=x; else if(/^fod$/.test(t)) colX.fod=x; else if(/^charbon$/.test(t)) colX.coal=x; else if(/^bois$/.test(t)) colX.biomass=x; else if(/electricite/.test(t)) colX.electricity=x; else if(/reseau/.test(t)&&colX.district==null) colX.district=x; }
        }
        const rowDefs=[
          ['heating',/^(?:poste\s+de\s+consommation\s+)?chauffage\b/i],
          ['cooling',/^(?:refroidissement|refroid\.?|froid|climatisation)\b/i],
          ['ecs',/^(?:ecs|eau\s+chaude\s+sanitaire)\b/i],
          ['lighting',/^(?:eclairage|éclairage)\b/i],
          ['auxVent',/^(?:auxiliaires?\s+(?:vmc|ventil(?:ation|ateurs?))|aux\.?\s*ventil(?:ation|ateurs?))\b/i],
          ['mobility',/^(?:deplacements?|déplacements?|ascenseurs?|parking|autres\s+usages)\b/i]
        ];
        for(let j=i+1;j<Math.min(lines.length,i+32);j++){
          const t=normalizeText(lines[j].text); if(/consommations\s+annuelles\s+par\s+poste\s+en\s+energie/i.test(normLower(t))) break;
          let key=null; for(const [k,re] of rowDefs) if(re.test(normLower(t))){key=k;break;}
          if(/^auxiliaires?$/i.test(t) && /distribution/i.test(normalizeText(lines[j+1]?.text||''))){ key='auxDist'; j++; }
          else if(/^(?:auxiliaires?\s+(?:de\s+)?distribution|aux\.?\s*distribution)/i.test(normLower(t))) key='auxDist';
          if(!key) continue;
          const line=lines[j], vals={};
          if(Object.keys(colX).length>=4){ for(const [carrier,x] of Object.entries(colX)){ const v=valueNearestX(line,x,78); if(v!==null) vals[carrier]=v; } }
          let ns=numbersIn(line.text||'');
          if(!ns.length && ['lighting','auxVent','auxDist','mobility'].includes(key)){
            const follow=normalizeText(lines.slice(j,Math.min(lines.length,j+3)).map(x=>x.text).join(' ')); ns=numbersIn(follow);
          }
          if(!Object.keys(vals).length){
            if(hasCoal&&ns.length>=6){ [vals.gas,vals.fod,vals.coal,vals.biomass,vals.electricity,vals.district]=ns.slice(-6); }
            else if(ns.length>=5){ [vals.gas,vals.fod,vals.biomass,vals.electricity,vals.district]=ns.slice(-5); }
            else if(['lighting','auxVent','auxDist','mobility'].includes(key) && ns.length) vals.electricity=ns.at(-1);
          }
          if(Object.keys(vals).length) d.energyRows[key]={...vals,line,page};
        }
      }
      // Tableaux récapitulatifs annuels par poste ou par énergie, en EF ou EP.
      if(/consommations\s+annuelles\s+par\s+poste\s+en\s+energie\s+(?:finale|primaire)/i.test(low)){
        const basis=/primaire/i.test(low)?'primary':'final'; let kind=null, header='';
        for(let j=i+1;j<Math.min(lines.length,i+12);j++){ const t=normLower(lines[j].text); header+=' '+t; if(/\bch\b.*\bfr\b.*\becs\b|chauffage.*refroid.*ecs/.test(header)){kind='posts';break;} if(/\bgaz\b.*\bfod\b.*\bbois\b.*electricite/.test(header)){kind='energy';break;} }
        for(let j=i+1;j<Math.min(lines.length,i+32);j++){
          const row=parseBuildingSummaryRowAt(lines,j); if(!row) continue; const rowFallback=row.building==='Bâtiment unique'?buildingForPosition(doc,page.page,lines[j].index):row.building; const d=ensure(buildingFromKnownAlias(doc,row.excerpt||row.building,rowFallback)); d.page=page; d.line=lines[j]; d.basis=d.basis||basis; const v=row.values;
          if(kind==='posts'){
            if(v.length>=12) d.posts={heating:v[1],cooling:v[2],ecs:v[3],lighting:v[4],auxVent:v[5],auxDist:v[6],mobility:v[7],furniture:v[8],pv:v[9],cogen:v[10],total:v[11],surface:v[0]};
            else if(v.length>=10) d.posts={heating:v[1],cooling:v[2],ecs:v[3],lighting:v[4],auxVent:v[5],auxDist:v[6],pv:v[7],cogen:v[8],total:v[9],surface:v[0]};
          }
          if(kind==='energy'){
            const hasCoal=/charbon/i.test(header);
            if(hasCoal&&v.length>=10) d.energy={gas:v[1],fod:v[2],coal:v[3],biomass:v[4],electricity:v[5],district:v[6],pv:v[7],cogen:v[8],total:v[9],surface:v[0]};
            else if(v.length>=9) d.energy={gas:v[1],fod:v[2],biomass:v[3],electricity:v[4],district:v[5],pv:v[6],cogen:v[7],total:v[8],surface:v[0]};
          }
          break;
        }
      }
      // RE2020 : tableau explicite « Bâtiment / Zone(s) S Coefficient Cep Coefficient Cep,nr ».
      if(/batiment\s*\/\s*zone\(s\).*coefficient\s+cep(?!\s*max).*coefficient\s+cep\s*[,._-]?\s*nr(?!\s*max)/i.test(low)){
        for(let j=i+1;j<Math.min(lines.length,i+10);j++){
          const row=parseBuildingSummaryRowAt(lines,j); if(!row) continue;
          const v=row.values; if(v.length<3) continue;
          const building=buildingFromKnownAlias(doc,row.building,buildingForPosition(doc,page.page,lines[j].index));
          const d=ensure(building); d.page=page; d.line=lines[j]; d.cep=v.at(-2); d.cepnr=v.at(-1);
          break;
        }
      }
      // RE2020 / rapports Perrenoud : en-tête et ligne valeur parfois séparés pour Cep,nr max.
      if(/cep\s*[,._-]?\s*nr.*(?:_?max|maximal)/i.test(low)){
        const ctx=normalizeText(lines.slice(i,Math.min(lines.length,i+4)).map(x=>x.text).join(' '));
        if(/cep\s*[,._-]?\s*nr.*(?:_?max|maximal)/i.test(normLower(ctx))){
          for(let j=i;j<Math.min(lines.length,i+5);j++){
            const t=normalizeText(lines[j].text); if(!/^cep\s*[,._-]?\s*nr\b/i.test(normLower(t))) continue;
            const ns=numbersIn(t); if(ns.length>=2){
              const building=buildingForPosition(doc,page.page,lines[j].index); const d=ensure(building); d.page=page; d.line=lines[j]; d.cepnr=ns[0]; d.cepnrmax=ns[1];
              if(ns.length>=3) d.cepnrGain=ns[2];
            }
          }
        }
      }
      // Variante de sortie détaillée : tableau des coefficients maximaux.
      if(/coefficient\s+cep\s*max.*cep\s*[,._-]?\s*nr\s*max|coefficient\s+cepmax.*cep\s*[,._-]?\s*nrmax/i.test(low)){
        for(let j=i+1;j<Math.min(lines.length,i+10);j++){
          const row=parseBuildingSummaryRowAt(lines,j); if(!row) continue; const v=row.values; if(v.length<3) continue;
          const building=buildingFromKnownAlias(doc,row.building,buildingForPosition(doc,page.page,lines[j].index)); const d=ensure(building); d.page=page; d.line=lines[j]; d.cepmax=v.at(-2); d.cepnrmax=v.at(-1); break;
        }
      }
    }
  }
  return byBuilding;
}
function addRsetCepBreakdown(doc,out){
  const data=rsetDetailedConsumptionData(doc);
  for(const [building,d] of data){ if(!d.page||!d.line) continue;
    const primary=d.basis==='primary';
    const factor=primary?{gas:1,fod:1,coal:1,biomass:1,electricity:1,district:1}:{gas:1,fod:1,coal:1,biomass:1,electricity:2.3,district:1};
    const add=(field,value,note,confidence=0.99)=>{ if(value==null||!Number.isFinite(value)) return; push(out,occ(doc,d.page,d.line,field,Math.round(value*1000)/1000,primary?'rset:detailed-output-primary':'rset:detailed-output-cep',confidence,'kWhEP/m².an',{building,derivedFromDocument:!primary,origin:primary?'RSET — Résultats sorties détaillées (énergie primaire)':'RSET — Résultats sorties détaillées',excerpt:`Résultats sorties détaillées — ${building}. ${note}`,provenanceNote:primary?'Valeur directement lue dans le tableau des consommations en énergie primaire du RSET.':'Valeur de Cep détaillée calculée à partir des consommations en énergie finale du RSET ; les valeurs documentaires directes restent prioritaires.'})); };
    const postValue=(key)=>{ const row=d.energyRows[key]; if(!row) return null; let sum=0,found=false; for(const [k,v] of Object.entries(row)){ if(['line','page'].includes(k)||typeof v!=='number'||factor[k]==null) continue; sum+=v*factor[k]; found=true; } return found?sum:null; };
    // Coefficients explicites : ils sont lus directement dans les tableaux RSET, sans estimation.
    const addCoefficient=(field,value,label,unit='kWhEP/m².an')=>{ if(value==null||!Number.isFinite(value)) return; push(out,occ(doc,d.page,d.line,field,Math.round(value*1000)/1000,'rset:coefficient-direct',0.999,unit,{building,origin:'RSET — coefficient explicite',excerpt:`${label} — ${building} : ${value}`,provenanceNote:'Valeur directement lue dans le RSET.'})); };
    addCoefficient('cep',d.cep,'Coefficient Cep');
    addCoefficient('cepnr',d.cepnr,'Coefficient Cep,nr');
    addCoefficient('cep_max',d.cepmax,'Coefficient Cep max');
    addCoefficient('cepnr_max',d.cepnrmax,'Coefficient Cep,nr max');
    addCoefficient('cepnr_gain',d.cepnrGain,'Gain Cep,nr','%');
    const postDefs=[['cep_cooling','cooling','Refroidissement'],['cep_lighting','lighting','Éclairage'],['cep_aux_vent','auxVent','Auxiliaires VMC'],['cep_aux_dist','auxDist','Auxiliaires distribution'],['cep_mobility','mobility','Déplacements occupants']];
    // Priorité au tableau récapitulatif « Consommations annuelles par poste » :
    // il donne explicitement une valeur bâtiment pour chaque poste et résiste mieux aux PDF dont
    // les colonnes sont fragmentées. Le tableau par énergie reste un secours / contrôle.
    for(const [field,key,label] of postDefs){
      if(d.posts&&d.posts[key]!=null){
        const f=primary?1:2.3;
        add(field,d.posts[key]*f,`${label} : ${d.posts[key]}${primary?' kWhEP/m².an (lu directement).':` kWhEF/m².an × ${f}.`}`);
        continue;
      }
      const v=postValue(key);
      if(v!==null) add(field,v,`${label} : ${v} kWhEP/m².an${primary?' (lu directement)':' après conversion'}.`);
    }
    if(d.energy){
      add('cep_gas',(d.energy.gas||0)*factor.gas,`Gaz : ${d.energy.gas||0}${primary?' kWhEP/m².an.':' kWhEF/m².an × 1.'}`);
      add('cep_biomass',(d.energy.biomass||0)*factor.biomass,`Bois/biomasse : ${d.energy.biomass||0}${primary?' kWhEP/m².an.':' kWhEF/m².an × 1.'}`);
      add('cep_electricity',(d.energy.electricity||0)*factor.electricity,`Électricité : ${d.energy.electricity||0}${primary?' kWhEP/m².an.':` kWhEF/m².an × ${factor.electricity}.`}`);
      add('cep_district',(d.energy.district||0)*factor.district,`Réseau de chaleur : ${d.energy.district||0}${primary?' kWhEP/m².an.':' kWhEF/m².an × 1.'}`);
    }
  }
}


function totalTailValue(page,index,maxLines=4){
  const lines=page.lines||[]; const first=normalizeText(lines[index]?.text||''); const firstNums=numbersIn(first);
  // Les tableaux ACV comportent généralement 7 à 8 colonnes numériques sur la ligne Total.
  // Si elles sont déjà présentes, ne jamais avaler un numéro de page ou un artefact de la ligne suivante.
  if(firstNums.length>=7) return firstNums.at(-1);
  const parts=[first];
  for(let j=index+1;j<Math.min(lines.length,index+maxLines);j++){
    const t=normalizeText(lines[j]?.text||'');
    if(/[A-Za-zÀ-ÿ]/.test(t)) break;
    parts.push(t);
    const nums=numbersIn(parts.join(' ')); if(nums.length>=7) return nums.at(-1);
  }
  const nums=numbersIn(parts.join(' ')); return nums.length?nums.at(-1):null;
}

function addRsetCarbonBreakdown(doc,out){
  const energyHeadings=[
    ['ic_energy_heating',/^chauffage\s*$/i],
    ['ic_energy_ecs',/^(?:ecs|eau\s+chaude\s+sanitaire)\s*$/i],
    ['ic_energy_cooling',/^refroidissement\s*$/i],
    ['ic_energy_aux_vent',/^auxiliaires?\s+(?:ventilateurs?|ventilation)\s*$/i],
    ['ic_energy_aux_dist',/^auxiliaires?\s+distribution\s*$/i],
    ['ic_energy_mobility',/^(?:ascenseur(?:s)?\s*\/\s*parking|deplacements?|déplacements?)\s*$/i]
  ];
  let mode=null,currentLot=null,currentEnergy=null;
  for(const page of doc.read.pages||[]){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], t=normalizeText(line.text), low=normLower(t);
      // Les pages de résultats ACV utilisent des titres numérotés « 1-VRD », « 8-CVC », etc.
      // Les sections d'entrée du logiciel utilisent aussi « Lot 11 : ... » : ne pas les confondre
      // avec le tableau de résultats, sinon un Total sans rapport peut être attribué au mauvais lot.
      const pageLow=normLower(page.text||'');
      const carbonSummaryPage=/total\s+lot\s*:/.test(pageLow) && ((pageLow.match(/total\s*:/g)||[]).length>=2);
      const numberedLot=t.match(/^\s*(1[0-3]|[1-9])\s*[-–—]\s*(.+)$/i);
      const namedLot=carbonSummaryPage?t.match(/^\s*lot\s*(1[0-3]|[1-9])\s*[:\-–—]\s*(.+)$/i):null;
      const lot=numberedLot||namedLot;
      const lotLabelLooksValid=lot && /vrd|fondation|infrastructure|superstructure|maconn|maçon|couverture|etanche|étanch|charpente|zinguer|cloison|doublage|plafond|menuiser|facade|façade|revetement|revêtement|cvc|chauffage|ventilation|sanitaire|plomberie|reseaux?|réseaux?|communication|courant\s+faible|elevateur|élévateur|transport\s+interieur|production\s+locale/i.test(normLower(lot[2]));
      // Dans le tableau ACV de synthèse, les libellés peuvent être coupés sur plusieurs lignes
      // (« 11-Réseaux de » puis « communication ... »). Le numéro reste alors une ancre fiable.
      if(lot && (lotLabelLooksValid || (mode==='components'&&carbonSummaryPage))){ mode='components'; currentLot=parseInt(lot[1],10); currentEnergy=null; continue; }
      if(/^energie\s*\(\s*ce\s*\)/i.test(low)){ mode='energy'; currentLot=null; currentEnergy=null; continue; }
      if(/^eau\s*\(\s*cre\s*\)/i.test(low)){ mode='water'; currentLot=null; currentEnergy=null; continue; }
      if(/^chantier\s*\(\s*cha\s*\)/i.test(low)){ mode='site'; currentLot=null; currentEnergy=null; continue; }
      if(mode==='energy'){
        if(/^(?:chauffage|ecs|eau\s+chaude\s+sanitaire|refroidissement|eclairage|éclairage|auxiliaires?|ascenseur|deplacements?|déplacements?)/i.test(t)) currentEnergy=null;
        for(const [field,re] of energyHeadings){ if(re.test(t)){ currentEnergy=field; break; } }
      }
      if(/^total\s*:/i.test(low)){
        const value=totalTailValue(page,i,4); if(value==null||!Number.isFinite(value)) continue;
        const building=buildingForPosition(doc,page.page,line.index);
        if(mode==='components'&&currentLot){
          push(out,occ(doc,page,line,`ic_lot_${currentLot}`,value,`rset:carbon-lot-${currentLot}-total`,0.995,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`IC composants lot ${currentLot} — Total cycle de vie : ${value} kgCO2e/m²`}));
        } else if(mode==='energy'&&currentEnergy){
          push(out,occ(doc,page,line,currentEnergy,value,'rset:carbon-energy-post-total',0.995,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`${currentEnergy} — Total cycle de vie : ${value} kgCO2e/m²`}));
        }
      }
      if(/^total\s+lot\s*:/i.test(low)){
        const value=totalTailValue(page,i,4); if(value==null||!Number.isFinite(value)) continue;
        const building=buildingForPosition(doc,page.page,line.index);
        if(mode==='components') push(out,occ(doc,page,line,'ic_components',value,'rset:carbon-components-total',0.998,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`IC composants bâtiment — Total Lot : ${value} kgCO2e/m²`}));
        else if(mode==='energy') push(out,occ(doc,page,line,'ic_energy',value,'rset:carbon-energy-total',0.998,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`IC énergie bâtiment — Total Lot : ${value} kgCO2e/m²`}));
        else if(mode==='site') push(out,occ(doc,page,line,'ic_site',value,'rset:carbon-site-total',0.998,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`IC chantier — Total Lot : ${value} kgCO2e/m²`}));
      }
    }
  }
}

export function parseRset(doc){
  const out=[];
  for(const page of doc.read.pages){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], s=normalizeText(line.text), win=lineWindow(page,i,0,4);
      if(/coefficient\s+bbio/i.test(s)){
        // Ne jamais lire les numéros d'article / de bâtiment comme des valeurs Bbio.
        // Ex.: « 1-2° Le coefficient Bbio ... Conforme » ou « ... - Bât.1 ».
        const narrative=/\b(?:article|art\.?|conforme|inferieur|inférieur|egal|égal|exigence)\b/i.test(s) || /-\s*b[aâ]t\.?\s*\d+\s*$/i.test(s);
        let vals=[];
        if(!narrative && /^\s*coefficient\s+bbio\b/i.test(s)) vals=numbersIn(s).filter(x=>x>=0&&x<1000);
        if(vals.length<2 && !narrative && /^\s*coefficient\s+bbio\b/i.test(s)) vals=numbersIn(lineWindow(page,i,0,1)).filter(x=>x>=0&&x<1000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'bbio',vals[0],'rset:bbio-table',0.99)); push(out,occ(doc,page,line,'bbio_max',vals[1],'rset:bbio-table',0.99)); if(vals.length>=3) push(out,occ(doc,page,line,'bbio_gain',vals[2],'rset:bbio-table',0.98,'%')); }
      }
      if(/coefficients?\s+cep\s*\/\s*cep\s*(?:max)?/i.test(s)){
        let vals=numbersIn(s).filter(x=>x>=-100); if(vals.length<4) vals=numbersIn(lineWindow(page,i,0,2)).filter(x=>x>=-100);
        if(vals.length>=4){
          push(out,occ(doc,page,line,'cep',vals[0],'rset:cep-table',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cep_max',vals[1],'rset:cep-table',0.995,'kWhEP/m².an'));
          push(out,occ(doc,page,line,'cepnr',vals[2],'rset:cep-table',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cepnr_max',vals[3],'rset:cep-table',0.995,'kWhEP/m².an'));
          if(vals.length>=5) push(out,occ(doc,page,line,'cep_gain',vals[4],'rset:cep-table',0.99,'%')); if(vals.length>=6) push(out,occ(doc,page,line,'cepnr_gain',vals[5],'rset:cep-table',0.99,'%'));
        }
      } else if(/^coefficient\s+cep\b/i.test(s)){
        // Une ligne de sommaire telle que « Coefficient Cep max du bâtiment - Bât.1 »
        // ne porte aucune valeur de résultat. On exige une vraie ligne de tableau numérique.
        const headingOnly=/du\s+b[aâ]timent|b[aâ]t\.?\s*\d+|sommaire/i.test(s) && !/[=:]|\d+[,.]\d+/.test(s);
        let vals=headingOnly?[]:numbersIn(s).filter(x=>x>=-100&&x<5000);
        if(vals.length<2 && !headingOnly && /[=:]|\d+[,.]\d+/.test(s)) vals=numbersIn(lineWindow(page,i,0,2)).filter(x=>x>=-100&&x<5000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'cep',vals[0],'rset:rt2012-cep-table',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cep_max',vals[1],'rset:rt2012-cep-table',0.995,'kWhEP/m².an')); if(vals.length>=3) push(out,occ(doc,page,line,'cep_gain',vals[2],'rset:rt2012-cep-table',0.99,'%')); }
      }
      // Récapitulatifs logiciels compacts : « Bbio 43,2 65,9 34,45 ».
      if(/^bbio\b/i.test(s) && !/^bbio\s*(?:max|maxi|maximal|_max)\b/i.test(s)){
        const vals=numbersIn(s).filter(x=>x>=-100&&x<5000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'bbio',vals[0],'rset:bbio-summary-row',0.997,'points')); push(out,occ(doc,page,line,'bbio_max',vals[1],'rset:bbio-summary-row',0.997,'points')); if(vals.length>=3) push(out,occ(doc,page,line,'bbio_gain',vals[2],'rset:bbio-summary-row',0.995,'%')); }
      }
      // Récapitulatifs logiciels compacts : « Cep 45,5 80,5 43,48 » / « Cep,nr 45,5 59 22,88 ».
      if(/^cep\s*[,._-]?\s*nr\b/i.test(s) && !/coefficient/i.test(s)){
        const vals=numbersIn(s).filter(x=>x>=-100&&x<5000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'cepnr',vals[0],'rset:cepnr-summary-row',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cepnr_max',vals[1],'rset:cepnr-summary-row',0.995,'kWhEP/m².an')); if(vals.length>=3) push(out,occ(doc,page,line,'cepnr_gain',vals[2],'rset:cepnr-summary-row',0.99,'%')); }
      } else if(/^cep\b/i.test(s) && !/^cep\s*[,._-]?\s*nr\b/i.test(s) && !/coefficient/i.test(s)){
        const vals=numbersIn(s).filter(x=>x>=-100&&x<5000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'cep',vals[0],'rset:cep-summary-row',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cep_max',vals[1],'rset:cep-summary-row',0.995,'kWhEP/m².an')); if(vals.length>=3) push(out,occ(doc,page,line,'cep_gain',vals[2],'rset:cep-summary-row',0.99,'%')); }
      }
      if(/\bdh\b|degres?[- ]heures?/i.test(s)){
        const explicit=firstValueAfterLabel(s,/\bDH\b|degres?[- ]heures?/i); if(explicit!==null) push(out,occ(doc,page,line,'dh',explicit,'rset:dh-explicit',0.98,'°C.h'));
        const max=firstValueAfterLabel(s,/DH\s*(?:max|seuil)|degres?[- ]heures?\s*(?:max|seuil)/i); if(max!==null) push(out,occ(doc,page,line,'dh_max',max,'rset:dh-explicit',0.97,'°C.h'));
      }
      if(/conforme|non\s+conforme/i.test(s) && i>0){
        const context=lineWindow(page,i,5,0);
        if(/\bdh\b|degres?[- ]heures?/i.test(context)){
          const yn=s.match(/\b(?:oui|non)\b/i);
          if(yn){
            const n=numbersIn(s.slice(yn.index));
            if(n.length>=2){
              const building=buildingForPosition(doc,page.page,line.index);
              push(out,occ(doc,page,line,'dh',n[1],'rset:dh-row',0.97,'°C.h',{building,context:'tableau DH',excerpt:normalizeText(context).slice(0,420)}));
            }
          }
        }
      }
      if(/\bzone(?:s)?\s+traversante|\bgroupe\s+traversant/i.test(s) && !/non\s+traversant/i.test(s)) push(out,occ(doc,page,line,'cross_ventilated','Oui','rset:traversant',0.88));
      if(/\bzone(?:s)?\s+non\s+traversante|\bgroupe\s+non\s+traversant/i.test(s)) push(out,occ(doc,page,line,'non_cross_ventilated','Oui','rset:non-traversant',0.88));
      if(/ic\s*composants?/i.test(s)){ const n=numbersIn(s); if(n.length) push(out,occ(doc,page,line,'ic_components',n[0],'rset:ic-components',0.97,'kgCO2e/m²')); }
      if(/ic\s*chantier/i.test(s)){ const n=numbersIn(s); if(n.length) push(out,occ(doc,page,line,'ic_site',n[0],'rset:ic-site',0.97,'kgCO2e/m²')); }
      if(/ic\s*[eé]nergie/i.test(s)){ const n=numbersIn(s); if(n.length) push(out,occ(doc,page,line,'ic_energy',n[0],'rset:ic-energy',0.97,'kgCO2e/m²')); }
      const lot=s.match(/\blot\s*(1[0-3]|[1-9])\b/i); if(lot&&/ic|carbone|kg\s*co2/i.test(s)){ const n=numbersIn(s); if(n.length) push(out,occ(doc,page,line,`ic_lot_${lot[1]}`,n[n.length-1],`rset:ic-lot-${lot[1]}`,0.90,'kgCO2e/m²')); }
    }
  }
  // Extraction structurée par bâtiment : le registre bâtiment est construit avant les parseurs.
  out.push(...rsetChapter2Structured(doc));
  // SHAB RSET : source de référence = Chapitre 2, colonne « Surface utile SU ou surf. hab. SHAB ».
  out.push(...rsetShabFromChapter2(doc));
  out.push(...rsetEnvelopeStructured(doc));
  out.push(...rsetSystemsStructured(doc));
  addRsetCepBreakdown(doc,out);
  addRsetCarbonBreakdown(doc,out);
  return fallbackRset(doc,out);
}

function fallbackRset(doc,current){
  const have=new Set(current.map(o=>`${o.building}|${o.field}`)); const out=[...current];
  for(const page of doc.read.pages){ for(const line of page.lines||[]){ const s=normalizeText(line.text), building=buildingForPosition(doc,page.page,line.index); if(/certification|referentiel|référentiel|performance|niveau|label|objectif|seuil|article|\bart\.?\s*\d+|représente|represente/i.test(normLower(s))) continue; const patterns={bbio:/\bbbio\b(?!\s*max)/i,bbio_max:/\bbbio\s*max\b/i,cep:/\bcep\b(?!\s*,?\s*nr|\s*max)/i,cep_max:/\bcep\s*max\b/i,cepnr:/\bcep\s*,?\s*nr\b(?!\s*max)/i,cepnr_max:/\bcep\s*,?\s*nr\s*max\b/i,dh:/\bdh\b|degres?[- ]heures?/i};
    for(const [field,re] of Object.entries(patterns)){ const key=`${building}|${field}`; if(have.has(key)||!re.test(s)) continue; const val=firstValueAfterLabel(s,re); if(val!==null){ push(out,occ(doc,page,line,field,val,'rset:fallback-label',0.87,'',{building})); have.add(key); } }
  }} return out;
}

function isRegulatoryNarrativeNoise(text=''){
  const low=normLower(text);
  return /(?:^|\b)(?:article|art\.?\s*\d+|rappel|definition|définition|objectif|critere|critère|cible|exigence|reglementation|réglementation|methode|méthode)(?:\b|\s)/i.test(low)
    || /(?:est|doit\s+etre|doit\s+être)\s+(?:inferieur|inférieur|superieur|supérieur|egal|égal)|\brepresente\b|\breprésente\b|\bconforme\b/i.test(low);
}
function explicitMetricCarrier(line='',re){
  const raw=normalizeText(line), low=normLower(raw);
  if(!re.test(raw)) return false;
  // Refuse les phrases réglementaires/descriptives : une métrique doit être portée par une ligne de résultat,
  // un couple libellé-valeur ou un tableau compact.
  if(isRegulatoryNarrativeNoise(raw) && !/^(?:coefficient\s+)?(?:bbio|cep(?:\s*[,._-]?\s*nr)?|dh|degres?[- ]heures?|tic|ubat)\b/i.test(raw)) return false;
  return /[:=|]|\d[,.]\d|\b\d{2,}(?:[,.]\d+)?\b/.test(raw) || /^(?:coefficient\s+)?(?:bbio|cep|dh|tic|ubat)\b/i.test(low);
}

function parseGenericRegulatory(doc){
  const out=[];
  const specs=[
    ['bbio_max',/\bbbio\s*(?:max|maxi|maximal|_max)\b/i,'points'],['bbio',/\bbbio\b(?!\s*(?:max|maxi|maximal|_max))/i,'points'],
    ['cepnr_max',/\bcep\s*[,._-]?\s*nr\s*(?:max|maxi|maximal|_max)\b/i,'kWhEP/m².an'],['cepnr',/\bcep\s*[,._-]?\s*nr\b(?!\s*(?:max|maxi|maximal|_max))/i,'kWhEP/m².an'],
    ['cep_max',/\bcep\s*(?:max|maxi|maximal|_max)\b/i,'kWhEP/m².an'],['cep',/\bcep\b(?!\s*[,._-]?\s*nr|\s*(?:max|maxi|maximal|_max))/i,'kWhEP/m².an'],
    ['dh_max',/\b(?:dh|degres?[- ]heures?)\s*(?:max|maxi|maximal|seuil)\b/i,'°C.h'],['dh',/\b(?:dh|degres?[- ]heures?)\b(?!\s*(?:max|maxi|maximal|seuil))/i,'°C.h'],
    ['tic_ref',/\btic\s*(?:ref|reference|référence|max)\b/i,'°C'],['tic',/\btic\b(?!\s*(?:ref|reference|référence|max))/i,'°C']
  ];
  const breakdown=[
    ['cep_cooling',/\bcep\b[^|]{0,45}(?:refroidissement|refroid|froid|climatisation)/i],['cep_lighting',/\bcep\b[^|]{0,45}(?:eclairage|éclairage)/i],
    ['cep_aux_vent',/\bcep\b[^|]{0,60}(?:auxiliaires?\s+(?:de\s+)?ventilation|ventilation)/i],['cep_aux_dist',/\bcep\b[^|]{0,60}(?:auxiliaires?\s+(?:de\s+)?distribution|distribution)/i],
    ['cep_mobility',/\bcep\b[^|]{0,60}(?:deplacements?|déplacements?|ascenseurs?|escalators?)/i],['cep_electricity',/\bcep\b[^|]{0,45}(?:electricite|électricité)/i],
    ['cep_gas',/\bcep\b[^|]{0,45}\bgaz\b/i],['cep_district',/\bcep\b[^|]{0,55}(?:reseau\s+de\s+chaleur|réseau\s+de\s+chaleur|rcu)/i],['cep_biomass',/\bcep\b[^|]{0,55}(?:bois|biomasse|granules|granulés)/i]
  ];
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){ const line=lines[i], s=normalizeText(line.text), ctx=lineWindow(page,i,1,2);
    for(const [field,re,unit] of specs){ if(explicitMetricCarrier(s,re)||(!isRegulatoryNarrativeNoise(ctx)&&re.test(ctx))){ const carrier=explicitMetricCarrier(s,re)?s:ctx; const v=firstValueAfterLabel(carrier,re);
      // Garde-fous issus du journal bêta : « RT2012 » ne doit jamais devenir Tic=2012/Ticref=2012.
      // Les températures réglementaires Tic/Ticref plausibles sont exprimées en °C.
      if(v!==null && ((field==='tic'||field==='tic_ref') && (v<5||v>60))) continue;
      // Les autres indicateurs ne doivent pas capturer un millésime isolé après un libellé.
      if(v!==null && v>=1900 && v<=2100) continue;
      if(v!==null) push(out,occ(doc,page,line,field,v,'generic:regulatory-label',0.91,unit,{excerpt:normalizeText(ctx).slice(0,420)})); } }
    for(const [field,re] of breakdown){ if(!isRegulatoryNarrativeNoise(ctx)&&re.test(ctx)){ const v=firstValueAfterLabel(ctx,re); if(v!==null) push(out,occ(doc,page,line,field,v,'generic:cep-breakdown',0.90,'kWhEP/m².an',{excerpt:normalizeText(ctx).slice(0,420)})); } }
    const phase=phaseFromContext(ctx,doc);
    if(/\bubat\b/i.test(ctx)){
      // Le mot Ubat dans un index, un intitulé de chapitre ou une formule n'est pas une valeur.
      // On ne conserve le fallback générique que si le voisinage porte explicitement une valeur plausible.
      const lowCtx=normLower(ctx);
      const structuralHeading=/\b(?:index|sommaire|justification\s+du\s+calcul|coefficient\s+moyen.*ubat\s*$)\b/i.test(lowCtx);
      const m=ctx.match(/\bubat\b[^\n|]{0,45}?(?:[:=]|\bprojet\b|\binitial\b|\bavant\b|\bapres\b|\baprès\b)?\s*(-?\d+(?:[,.]\d+)?)/i);
      const v=m?parseFrNumber(m[1]):null;
      if(!structuralHeading && v!==null && v>0.02 && v<8){
        if(phase==='before') push(out,occ(doc,page,line,'ubat_before',v,'renovation:ubat-before',0.92,'W/m².K',{excerpt:normalizeText(ctx).slice(0,420)}));
        if(phase==='after') push(out,occ(doc,page,line,'ubat_after',v,'renovation:ubat-after',0.92,'W/m².K',{excerpt:normalizeText(ctx).slice(0,420)}));
      }
    }
    if(/\bcep\b/i.test(ctx) && !/cep\s*[,._-]?\s*nr/i.test(ctx)){ const v=firstValueAfterLabel(ctx,/\bcep\b/i); if(v!==null && phase==='before') push(out,occ(doc,page,line,'cep_before',v,'renovation:cep-before',0.91,'kWhEP/m².an',{excerpt:normalizeText(ctx).slice(0,420)})); if(v!==null && phase==='after' && /final|reception|apres\s+travaux/i.test(normLower(`${doc.name} ${ctx}`))) push(out,occ(doc,page,line,'cep_after_final',v,'renovation:cep-after-final',0.92,'kWhEP/m².an',{excerpt:normalizeText(ctx).slice(0,420)})); }
  }} return out;
}


function thermalStudyPhase(text){
  const low=normLower(text);
  // Rapports de rénovation (Bao Evolution, audits, RT existant...) : l'état initial doit
  // rester distinct de l'état après travaux, même lorsque le titre de phase n'est présent
  // qu'une fois en haut de page.
  if(/(?:^|\b)(?:etat|état)\s+(?:initial|existant)\b|\bavant\s+travaux\b|\bsituation\s+initiale\b/.test(low)) return 'before';
  if(/(?:^|\b)(?:etat|état)\s+(?:apres|après)\s+travaux\b|\b(?:variante|modification)\s*(?:n[°ºo]?\s*)?\d*[^\n]{0,60}(?:apres|après)\s+travaux\b|(?:^|\b)(?:etat|état)\s+(?:projete|projeté|scenario|scénario)\b|\bscenario\s+\d+\b|\bscénario\s+\d+\b/.test(low)) return 'after';
  return '';
}


function isStructuredRenovationThermalDocument(doc){
  const s=normLower(`${doc?.name||''}\n${doc?.read?.text||''}`);
  return /bao\s*(?:evolution|evolution)|catalogue\s+des\s+parois\s+de\s+l['’]?etat\s+initial|details\s+des\s+consommations[\s\S]{0,160}energie\s+primaire|bilan\s+energetique[\s\S]{0,80}bilan\s+co2/.test(s);
}
function baoNumber(value=''){
  let t=String(value??'').replace(/\u00a0/g,' ').trim();
  if(/^[-+]?[,.]\d+$/.test(t)) t=t.replace(/^([-+]?)\s*([,.])/,'$10$2');
  return parseFrNumber(t);
}
function baoNumericTail(raw=''){
  const cleaned=String(raw??'').replace(/(?<!\d)([-+]?),(?=\d)/g,'$10,');
  return numbersIn(cleaned);
}
function baoPhaseFromPage(page){
  const low=normLower(page?.text||'');
  if(/etat\s+apres\s+travaux|modification\s+(?:prioritaire|n[°ºo]?\s*\d+)|variante\s+\d+/.test(low)) return 'after';
  if(/etat\s+initial|etat\s+existant/.test(low)) return 'before';
  return '';
}
function baoLineAfter(lines,index,max=2){
  const parts=[];
  for(let j=index;j<Math.min(lines.length,index+max+1);j++){
    const t=normalizeText(lines[j]?.text||''); if(t) parts.push(t);
  }
  return normalizeText(parts.join(' | '));
}
function baoPrimaryFromRow(raw=''){
  const ns=baoNumericTail(raw);
  // Format Bao courant : Energie finale | Energie primaire | Dépense.
  // La consommation primaire est donc l'avant-dernière valeur, jamais le montant en euros.
  if(ns.length>=3) return ns.at(-2);
  if(ns.length===2) return ns.at(-1);
  return null;
}
function baoFinalEnergyFromRow(raw=''){
  const ns=baoNumericTail(raw);
  if(ns.length>=3) return ns.at(-3);
  if(ns.length===2) return ns[0];
  return null;
}
function baoEnergyPage(page){
  const low=normLower(page?.text||'');
  if(!/details\s+des\s+consommations/.test(low)||!/energie\s+primaire/.test(low)) return null;
  const phase=baoPhaseFromPage(page); if(!phase) return null;
  const lines=page.lines||[], values={}, finalEnergy={};
  const defs=[
    ['heating',/^chauffage\b/i],['cooling',/^refroidissement\b/i],['ecs',/^ecs\b|^eau\s+chaude\s+sanitaire\b/i],
    ['lighting',/^eclairage\b|^éclairage\b/i],['auxDist',/^auxiliaires\b/i],['auxVent',/^ventilateurs\b|^ventilation\b/i],['other',/^autres\s+usages\b/i]
  ];
  const headingRe=/^(?:chauffage|refroidissement|ecs|eau\s+chaude\s+sanitaire|eclairage|éclairage|auxiliaires|ventilateurs|ventilation|autres\s+usages|total\b)/i;
  let total=null,totalFinalEnergy=null, totalMwh=null,gesTonnes=null,gesKgM2=null;
  for(let i=0;i<lines.length;i++){
    const raw=normalizeText(lines[i].text), lowLine=normLower(raw);
    for(const [key,re] of defs){
      if(!re.test(raw)) continue;
      let source=raw, primary=baoPrimaryFromRow(source), ef=baoFinalEnergyFromRow(source);
      if(primary===null){
        for(let j=i+1;j<Math.min(lines.length,i+3);j++){
          const nraw=normalizeText(lines[j].text); if(!nraw) continue;
          if(headingRe.test(nraw)) break;
          const pv=baoPrimaryFromRow(nraw); if(pv!==null){ source=`${raw} | ${nraw}`; primary=pv; ef=baoFinalEnergyFromRow(nraw); break; }
        }
      }
      // Bao laisse parfois les colonnes énergie vides pour un poste nul et n'imprime que « 0,00 » en dépense.
      // On ne convertit ce zéro en énergie primaire que pour le refroidissement ET seulement si le rapport
      // indique ailleurs qu'il n'y a pas de système de refroidissement.
      if(key==='cooling'&&primary===null&&baoNumericTail(raw).length===1&&baoNumericTail(raw)[0]===0&&/sans\s+systeme\s+de\s+refroidissement/.test(normLower(page?._docText||''))){ primary=0; ef=0; }
      if(primary!==null&&primary>=0&&primary<5000){ values[key]=primary; if(ef!==null) finalEnergy[key]=ef; }
    }
    if(/^total\b/i.test(raw)&&!/depense|abonnement/i.test(lowLine)){
      const ns=baoNumericTail(raw); if(ns.length>=2){
        if(ns.length>=3){ totalFinalEnergy=ns.at(-3); total=ns.at(-2); }
        else total=ns.at(-1);
      }
    }
    let m;
    if((m=raw.match(/total\s+mwh\s*ep\s*\/\s*an\s*:\s*([-+]?\s*\d*[,.]?\d+)/i))) totalMwh=baoNumber(m[1]);
    if((m=raw.match(/total\s*\(\s*tonnes?\s*\)\s*:\s*([-+]?\s*\d*[,.]?\d+)/i))) gesTonnes=baoNumber(m[1]);
    if((m=raw.match(/total\s+kwh\s*ep\s*\/\s*m[²2]\s*\.?(?:an)?\s*:\s*([-+]?\s*\d*[,.]?\d+)/i))) total=baoNumber(m[1]);
    if((m=raw.match(/total\s*\(\s*kg\s*\/\s*m[²2]\s*\)\s*:\s*([-+]?\s*\d*[,.]?\d+)/i))) gesKgM2=baoNumber(m[1]);
  }
  return {page,phase,values,finalEnergy,total,totalFinalEnergy,totalMwh,gesTonnes,gesKgM2};
}
function parseStructuredRenovationThermal(doc){
  if(!isStructuredRenovationThermalDocument(doc)) return [];
  const out=[], allText=normLower(doc.read?.text||'');
  const add=(page,line,field,value,method,confidence=.995,unit='',extra={})=>{ if(value===null||value===undefined||value==='') return; push(out,occ(doc,page,line,field,value,method,confidence,unit,{origin:'Étude thermique rénovation structurée',...extra})); };
  const energyPages=[], recap={}, gesAbsolute={};
  let titleHousing=null, firstBuildingLine=null;

  let activePhase='';
  for(const page of doc.read.pages||[]){
    // Permet au parseur de ligne de vérifier les systèmes annoncés ailleurs dans le rapport sans multiplier les recherches.
    page._docText=allText;
    const explicitPagePhase=baoPhaseFromPage(page); if(explicitPagePhase) activePhase=explicitPagePhase;
    const phase=activePhase, lines=page.lines||[];
    const ep=baoEnergyPage(page); if(ep) energyPages.push(ep);
    for(let i=0;i<lines.length;i++){
      const line=lines[i], raw=normalizeText(line.text), low=normLower(raw), ctx=baoLineAfter(lines,i,2); let m;
      const building=buildingForPosition(doc,page.page,line.index);
      if(!firstBuildingLine&&/batiment\s+n[°ºo]?\s*1|bâtiment\s+n[°ºo]?\s*1/i.test(raw)) firstBuildingLine={page,line,building};
      if(titleHousing===null&&(m=raw.match(/(?:etude\s+thermique\s+)?(\d+)\s+logements?\b/i))){ const n=parseInt(m[1],10); if(n>0&&n<10000) titleHousing={n,page,line,building}; }

      if((m=raw.match(/numero\s+de\s+departement\s*:\s*(\d{1,3})/i))){ const d=m[1].padStart(2,'0'); add(page,line,'department',d,'bao:department-code',.999,'',{building:'Bâtiment unique',excerpt:ctx}); }
      if((m=raw.match(/type\s+de\s+batiment\s*:\s*(.+)$/i))){ const v=normLower(m[1]); const work=/logements?\s+collectifs?/.test(v)?'Logement collectif':/maisons?\s+individuelles?|logements?\s+individuels?/.test(v)?'Maison individuelle':normalizeText(m[1]); add(page,line,'work_type',work,'bao:building-type',.995,'',{building:'Bâtiment unique',excerpt:ctx}); }
      if((m=raw.match(/surface\s+habitable\s*:\s*([\d\s.,]+)\s*m[²2]/i))){ const v=parseFrNumber(m[1]); if(v&&v>20) add(page,line,'shab',v,'bao:shab',.999,'m²',{building,surfacePriority:100,excerpt:ctx,provenanceNote:'Surface habitable explicitement indiquée par Bao Evolution.'}); }
      // Bao imprime une valeur Ubat explicite dans deux blocs distincts. On la rattache à la phase
      // déterminée par les titres de section, et jamais à une valeur U de paroi voisine.
      if((m=raw.match(/coefficient\s+ubat\s*=\s*([-+]?\d+(?:[,.]\d+)?)/i))){
        const v=parseFrNumber(m[1]);
        if(v!==null&&phase==='before') add(page,line,'ubat_before',v,'bao:ubat-before-explicit',.999,'W/m².K',{building,excerpt:ctx,provenanceNote:'Valeur lue sur la ligne « COEFFICIENT UBAT » du bloc ÉTAT INITIAL.'});
        if(v!==null&&phase==='after') add(page,line,'ubat_after',v,'bao:ubat-after-explicit',.999,'W/m².K',{building,excerpt:ctx,provenanceNote:'Valeur lue sur la ligne « COEFFICIENT UBAT » du bloc ÉTAT APRÈS TRAVAUX.'});
      }

      // Systèmes avant/après : lecture des champs exacts Bao, sans interpréter les listes d'exemples entre parenthèses.
      if((m=raw.match(/systeme\s+de\s+refroidissement\s*:\s*(.+)$/i))&&phase==='after'){
        const v=/sans\s+systeme\s+de\s+refroidissement/i.test(m[1])?'Sans système de refroidissement':findFirstMatch(m[1],COOLING)||normalizeText(m[1]);
        add(page,line,'cooling',v,'bao:cooling-after',.999,'',{building,excerpt:ctx});
      }
      if((m=raw.match(/type\s+de\s+chauffage\s*:\s*electrique\s+thermodynamique/i))){
        if(phase==='before') add(page,line,'heating_vector_before','Électricité','bao:heating-vector-before',.999,'',{building,excerpt:ctx});
        if(phase==='after') add(page,line,'heating_vector_after','Électricité','bao:heating-vector-after',.999,'',{building,excerpt:ctx});
      }
      if((m=raw.match(/type\s+de\s+generateur\s*:\s*(.+)$/i))&&phase==='after'){
        const mode=findFirstMatch(m[1],HVAC.heating); if(mode) add(page,line,'heating_mode_after',mode,'bao:heating-generator-after',.999,'',{building,excerpt:ctx});
      }
      if((m=raw.match(/type\s+d['’]?energie\s+pour\s+la\s+production\s+de\s+chaud\s*:\s*(.+)$/i))){
        const vec=findFirstMatch(m[1],HVAC.vectors); if(vec&&phase==='before') add(page,line,'heating_vector_before',vec,'bao:generator-energy-before',.999,'',{building,excerpt:ctx}); if(vec&&phase==='after') add(page,line,'heating_vector_after',vec,'bao:generator-energy-after',.999,'',{building,excerpt:ctx});
      }
      if((m=raw.match(/type\s+d['’]?ecs\s*:\s*(.+)$/i))){ const vec=findFirstMatch(m[1],HVAC.vectors); if(vec&&phase==='before') add(page,line,'ecs_vector_before',vec,'bao:ecs-vector-before',.999,'',{building,excerpt:ctx}); if(vec&&phase==='after') add(page,line,'ecs_vector_after',vec,'bao:ecs-vector-after',.999,'',{building,excerpt:ctx}); }
      if((m=raw.match(/type\s+de\s+stockage\s*:\s*(.+)$/i))&&phase==='after'){
        const mode=findFirstMatch(m[1],HVAC.ecs); if(mode){
          const nearby=normalizeText(lines.slice(Math.max(0,i-2),Math.min(lines.length,i+4)).map(x=>x.text).join(' | '));
          const vol=nearby.match(/volume\s+de\s+stockage\s*:\s*([\d.,]+)/i), count=nearby.match(/nombre\s*:\s*(\d+)/i);
          const note=[count?`${count[1]} ballon(s)`:null,vol?`${String(vol[1]).replace('.',',')} L`:null].filter(Boolean).join(' · ');
          add(page,line,'ecs',mode,'bao:ecs-storage-after',.999,'',{building,excerpt:ctx,provenanceNote:note?`Production ECS : ${note}.`:'Type de stockage explicitement indiqué.'});
        }
      }
      if((m=raw.match(/systeme\s+de\s+ventilation\s*:\s*(.+)$/i))&&phase==='after'){
        const vent=findFirstMatch(m[1],HVAC.ventilation)||normalizeText(m[1]); add(page,line,'ventilation',vent,'bao:ventilation-after',.999,'',{building,excerpt:ctx});
      }

      // Enveloppe : on privilégie l'état final quand le rapport est une rénovation.
      if(phase==='after'){
        if(/parois?\s+me\d*\s*\/\s*murs?\s+exterieurs?|murs?\s+exterieurs?/i.test(raw)){
          const block=normalizeText(lines.slice(i,Math.min(lines.length,i+15)).map(x=>x.text).join(' | '));
          if(/brique\s+creuse/i.test(block)) add(page,line,'wall_structure','Brique terre cuite','bao:wall-structure-after',.998,'',{building,excerpt:block.slice(0,420)});
          const iso=block.match(/doublage\s+isover[^|]{0,80}?(?:r\s*=\s*([\d.,]+))?[^|]{0,80}?\b(\d{1,3}(?:[,.]\d+)?)\s*(?:cm\b)?/i);
          const rr=block.match(/doublage\s+isover[^|]{0,80}?r\s*=\s*([\d.,]+)/i), th=block.match(/doublage\s+isover[^|]{0,120}?\b(\d{1,2}(?:[,.]\d+)?)\s*(?:cm)\b/i);
          if(/doublage\s+isover/i.test(block)) add(page,line,'wall_insulation','Laine de verre','bao:wall-insulation-after',.93,'',{building,libraryDerived:true,excerpt:block.slice(0,420),provenanceNote:'Matériau déduit de la marque ISOVER et contrôlé par le couple épaisseur/R ; le rapport n’indique pas le nom produit exact.'});
          const directIsoRow=block.match(/doublage\s+isover\s+r\s*=\s*([\d.,]+)\s+(\d{1,3}(?:[,.]\d+)?)\s+([\d.,]+)\s+100/i);
          if(directIsoRow){ const rv=parseFrNumber(directIsoRow[1]), tv=parseFrNumber(directIsoRow[2]); if(tv) add(page,line,'wall_insulation_thickness',tv*10,'bao:wall-insulation-thickness-after',.999,'mm',{building,excerpt:block.slice(0,420),provenanceNote:'Épaisseur lue dans la ligne de composition Bao (colonne cm).'}); if(rv) add(page,line,'wall_insulation_r',rv,'bao:wall-insulation-r-after',.999,'m².K/W',{building,excerpt:block.slice(0,420)}); }
          else { if(th){ const v=parseFrNumber(th[1]); if(v) add(page,line,'wall_insulation_thickness',v*10,'bao:wall-insulation-thickness-after',.998,'mm',{building,excerpt:block.slice(0,420)}); } if(rr){ const v=parseFrNumber(rr[1]); if(v) add(page,line,'wall_insulation_r',v,'bao:wall-insulation-r-after',.999,'m².K/W',{building,excerpt:block.slice(0,420)}); } }
        }
        if(/parois?\s+to\d*\s*\/\s*plafond|type\s+de\s+plafond/i.test(raw)){
          const block=normalizeText(lines.slice(i,Math.min(lines.length,i+15)).map(x=>x.text).join(' | '));
          if(/dalle\s+beton|plancher\s*-?\s*dalle\s+beton/i.test(normLower(block))) add(page,line,'roof_structure','Dalle béton','bao:roof-structure-after',.997,'',{building,excerpt:block.slice(0,420)});
          if(/laine\s+de\s+verre/i.test(block)){ add(page,line,'roof_insulation','Laine de verre','bao:roof-insulation-after',.999,'',{building,excerpt:block.slice(0,420)}); const r=block.match(/laine\s+de\s+verre[^|]{0,100}?\b(\d{1,2}(?:[,.]\d+)?)\s+([\d.,]+)\s+100/i); if(r){ add(page,line,'roof_insulation_thickness',parseFrNumber(r[1])*10,'bao:roof-thickness-after',.997,'mm',{building,excerpt:block.slice(0,420)}); add(page,line,'roof_insulation_r',parseFrNumber(r[2]),'bao:roof-r-after',.997,'m².K/W',{building,excerpt:block.slice(0,420)}); } }
        }
        if(/parois?\s+pl\s*\/\s*plancher|type\s+de\s+plancher/i.test(raw)){
          const block=normalizeText(lines.slice(i,Math.min(lines.length,i+18)).map(x=>x.text).join(' | '));
          if(/dalle\s+beton|plancher\s*-?\s*dalle\s+beton/i.test(normLower(block))) add(page,line,'floor_structure','Dalle béton','bao:floor-structure-after',.997,'',{building,excerpt:block.slice(0,420)});
          // Ne pas recopier l'isolant de l'état initial si Bao annonce « Paroi non rénovée » et qu'aucune couche isolante n'est présente dans le bloc final.
          if(!/paroi\s+non\s+renovee/i.test(normLower(block))){
            if(/laine\s+de\s+roche/i.test(block)) add(page,line,'floor_insulation','Laine de roche','bao:floor-insulation-after',.999,'',{building,excerpt:block.slice(0,420)});
          }
        }
        if(/catalogue\s+des\s+vitrages|\bfe\d+\b.*\bdouble\b/i.test(raw)){
          const block=normalizeText(lines.slice(i,Math.min(lines.length,i+18)).map(x=>x.text).join(' | '));
          const lame=block.match(/\+\s*(\d{1,2}(?:[,.]\d+)?)\s*mm/i); const gl=/\bdouble\b/i.test(block)&&lame?`Double vitrage — lame ${String(parseFrNumber(lame[1])).replace('.',',')} mm`:normalizeGlazingType(block); if(gl) add(page,line,'window_glazing',gl,'bao:glazing-after',.999,'',{building,excerpt:block.slice(0,420),provenanceNote:'Bao indique la nature du vitrage et la largeur de lame, mais pas les épaisseurs des verres : aucune composition 4.x.4 n’est inventée.'});
          if(/volet\s+roulant\s+alu/i.test(block)) add(page,line,'window_shading','Volet roulant','bao:shading-after',.999,'',{building,excerpt:block.slice(0,420),provenanceNote:'Fermeture indiquée par Bao : volet roulant aluminium.'});
        }
      }

      // Récapitulatif : deuxième source indépendante de contrôle pour Cep total et GES surfacique.
      if(/\betat\s+initial\b/i.test(raw)&&/\d/.test(raw)&&/recapitulatif/i.test(normLower(page.text||''))){ const ns=baoNumericTail(raw.replace(/^\s*\d+\s*/,'')); if(ns.length>=3) recap.before={mwh:ns[0],cep:ns[1],gesKgM2:ns[2]}; }
      if(/\betat\s+apres\s+travaux\b/i.test(raw)&&/\d/.test(raw)&&/recapitulatif/i.test(normLower(page.text||''))){ const ns=baoNumericTail(raw.replace(/^\s*\d+\s*/,'')); if(ns.length>=3) recap.after={mwh:ns[0],cep:ns[1],gesKgM2:ns[2]}; }

      if((m=raw.match(/emission\s+de\s+co2\s+avant\s+travaux\s*:\s*([\d\s.,-]+)\s*kg\s*co2/i))) gesAbsolute.before=baoNumber(m[1]);
      if((m=raw.match(/emission\s+de\s+co2\s+apres\s+travaux\s*:\s*([\d\s.,-]+)\s*kg\s*co2/i))) gesAbsolute.after=baoNumber(m[1]);
      if((m=raw.match(/emission\s+de\s+co2\s+des\s+travaux\s*:\s*([\d\s.,-]+)\s*kg\s*co2/i))) gesAbsolute.works=baoNumber(m[1]);
      if((m=raw.match(/economie\s+realisee\s*:\s*([-+\d\s.,]+)\s*kg/i))) gesAbsolute.saving30y=baoNumber(m[1]);
    }
  }

  if(titleHousing){
    add(titleHousing.page,titleHousing.line,'housing_count',titleHousing.n,'bao:housing-count-title',.995,'',{building:titleHousing.building,provenanceNote:'Nombre de logements lu une seule fois dans le titre du rapport Bao.'});
    if(/type\s+de\s+batiment\s*:\s*logements?\s+collectifs?/.test(allText)){
      add(titleHousing.page,titleHousing.line,'housing_collective_units',titleHousing.n,'bao:collective-housing-count',.99,'',{building:'Bâtiment unique'});
      add(titleHousing.page,titleHousing.line,'housing_total',titleHousing.n,'bao:housing-total',.99,'',{building:'Bâtiment unique'});
    }
  }
  if(firstBuildingLine){
    add(firstBuildingLine.page,firstBuildingLine.line,'building_total',1,'bao:single-building',.93,'',{building:'Bâtiment unique',derivedFromDocument:true,provenanceNote:'Un seul identifiant bâtiment est présent dans le rapport Bao analysé.'});
    if(/type\s+de\s+batiment\s*:\s*logements?\s+collectifs?/.test(allText)) add(firstBuildingLine.page,firstBuildingLine.line,'housing_collective_buildings',1,'bao:single-collective-building',.93,'',{building:'Bâtiment unique',derivedFromDocument:true,provenanceNote:'Le rapport décrit un seul bâtiment et le qualifie de logements collectifs.'});
  }

  for(const e of energyPages){
    const lines=e.page.lines||[], line=lines.find(l=>/^total\b/i.test(normalizeText(l.text))&&!/depense/i.test(normLower(l.text)))||lines.find(l=>/total\s+kwh\s*ep/i.test(normLower(l.text)))||lines[0];
    const building=buildingForPosition(doc,e.page.page,line?.index||0);
    const vals=e.values;
    const sumKeys=['heating','cooling','ecs','lighting','auxDist','auxVent','other'];
    const complete=sumKeys.every(k=>Number.isFinite(vals[k]));
    const sum=complete?Math.round(sumKeys.reduce((a,k)=>a+vals[k],0)*1000)/1000:null;
    const crossOk=Number.isFinite(e.total)&&Number.isFinite(sum)&&Math.abs(e.total-sum)<=0.12;
    const summary=recap[e.phase]; const recapOk=Number.isFinite(summary?.cep)&&Number.isFinite(e.total)&&Math.abs(summary.cep-e.total)<=0.15;
    const parts=[['Chauffage',vals.heating],['Refroidissement',vals.cooling],['ECS',vals.ecs],['Éclairage',vals.lighting],['Aux. distribution',vals.auxDist],['Aux. ventilation',vals.auxVent],['Autres usages',vals.other]].filter(([,v])=>Number.isFinite(v));
    const breakdown=parts.map(([k,v])=>`${k} ${String(v).replace('.',',')}`).join(' ; ');
    const gesParts=[];
    if(Number.isFinite(e.gesKgM2)) gesParts.push(`${String(e.gesKgM2).replace('.',',')} kgCO₂e/m².an`);
    if(Number.isFinite(e.gesTonnes)) gesParts.push(`${String(e.gesTonnes).replace('.',',')} tCO₂e/an`);
    if(Number.isFinite(gesAbsolute[e.phase])) gesParts.push(`${String(gesAbsolute[e.phase]).replace('.',',')} kgCO₂e/an (évolution GES)`);
    const discrepancy=Number.isFinite(e.gesTonnes)&&Number.isFinite(gesAbsolute[e.phase])&&Math.abs(e.gesTonnes*1000-gesAbsolute[e.phase])>Math.max(25,e.gesTonnes*1000*.03);
    const note=`Consommations d’énergie primaire par poste : ${breakdown}${Number.isFinite(e.total)?` ; total ${String(e.total).replace('.',',')} kWhEP/m².an`:''}.${gesParts.length?` Bilan GES : ${gesParts.join(' ; ')}.`:''}${crossOk?' Somme des postes = total Bao : contrôle OK.':''}${recapOk?' Récapitulatif final cohérent avec le tableau détaillé.':''}${discrepancy?' Attention : les deux valeurs annuelles de GES imprimées dans le rapport ne sont pas strictement cohérentes ; elles sont conservées séparément sans fusion.':''}`;
    const meta={building,excerpt:normalizeText(e.page.text||'').slice(0,420),provenanceNote:note,baoBreakdown:{...vals},baoEnergyFinal:{...e.finalEnergy},baoGes:{kgM2:e.gesKgM2,tonnesPerYear:e.gesTonnes,kgPerYear:gesAbsolute[e.phase],worksKgPerYear:gesAbsolute.works,saving30yKg:gesAbsolute.saving30y},baoChecks:{postSum:sum,crossOk,recapOk,recap:summary||null}};
    if(Number.isFinite(e.total)){
      if(e.phase==='before') add(e.page,line,'cep_before',e.total,'bao:primary-energy-total-before',(crossOk&&recapOk)?0.999:0.997,'kWhEP/m².an',meta);
      else { add(e.page,line,'cep_after_final',e.total,'bao:primary-energy-total-after',(crossOk&&recapOk)?0.999:0.997,'kWhEP/m².an',meta); add(e.page,line,'cep',e.total,'bao:primary-energy-total-project',(crossOk&&recapOk)?0.999:0.997,'kWhEP/m².an',meta); }
    }
    // Les colonnes détaillées existantes du schéma décrivent le résultat projet/final : ne pas y injecter l'état initial.
    if(e.phase==='after'){
      const map=[['cep_cooling','cooling'],['cep_lighting','lighting'],['cep_aux_dist','auxDist'],['cep_aux_vent','auxVent']];
      for(const [field,key] of map) if(Number.isFinite(vals[key])) add(e.page,line,field,vals[key],`bao:primary-energy-post-${key}`,.999,'kWhEP/m².an',meta);
      // Dans ce Bao, tous les postes du bilan sont électriques. Le total EP peut donc alimenter Cep électricité,
      // mais uniquement si aucune autre énergie combustible/réseau n'est décrite dans le tableau de bilan.
      const pageEnergyLow=normLower(e.page.text||'');
      if(Number.isFinite(e.total)&&/electricit/.test(pageEnergyLow)&&!/(?:gaz\s+naturel|fuel\s+domestique|fioul|biomasse|reseau\s+de\s+chaleur)/.test(pageEnergyLow)) add(e.page,line,'cep_electricity',e.total,'bao:primary-energy-by-vector-electricity',.985,'kWhEP/m².an',{...meta,derivedFromDocument:true,provenanceNote:`${note} Cep électricité = total, car aucune autre énergie n’est portée par ce tableau de bilan.`});
    }
  }

  // Nettoyage des propriétés temporaires placées sur les pages.
  for(const page of doc.read.pages||[]) try{ delete page._docText; }catch{}
  return out;
}

function parseThermalStudy(doc){
  const out=[];
  const add=(page,line,field,value,method,confidence=.98,unit='',extra={})=>{ if(value===null||value===undefined||value==='') return; push(out,occ(doc,page,line,field,value,method,confidence,unit,{origin:doc.type===DOC_TYPES.RT_EXISTING?'RT Existant':'Étude thermique',...extra})); };
  for(const page of doc.read.pages){ const lines=page.lines||[]; let phase=thermalStudyPhase(page.text||''); let currentPost=''; const pageLow=normLower(page.text||'');
    // Les chapitres 4.x décrivent l'existant, 5.x les travaux projetés et 6.1/6.2 les résultats avant/après.
    // Bao Evolution utilise plutôt « ETAT INITIAL » puis « Modification / Etat après travaux ».
    if(/\b6\.1\.?\s+(?:etat|état)\s+existant|\b4\.1\.?\s+(?:etat|état)\s+existant|\betat\s+initial\b/.test(pageLow)) phase='before';
    if(/\b6\.2\.?\s+(?:etat|état)\s+(?:projete|projeté)|\b5\.4\.?\s+scenario|\b5\.4\.\d|\betat\s+apres\s+travaux\b|\bmodification\s+n?[°ºo]?\s*\d+/.test(pageLow)) phase='after';
    for(let i=0;i<lines.length;i++){
      const line=lines[i], raw=normalizeText(line.text), low=normLower(raw), ctx=normalizeText(lineWindow(page,i,1,2));
      const explicitPhase=thermalStudyPhase(raw); if(explicitPhase) phase=explicitPhase;
      const building=buildingForPosition(doc,page.page,line.index);
      let m;
      // SHAB / SU globale explicitement annoncée par l'étude.
      if((m=raw.match(/(?:shab\s*\/\s*su|surface\s+habitable)\s*[:=]?\s*([\d\s.,]+)/i))){ const v=parseFrNumber(m[1]); if(v&&v>20) add(page,line,'shab',v,'thermal:shab-explicit',.99,'m²',{building,surfacePriority:100,excerpt:ctx.slice(0,420)}); }
      if((m=raw.match(/^\s*shab\s+(?:m2|m²)\s+([\d\s.,]+)/i))){ const v=parseFrNumber(m[1]); if(v&&v>20) add(page,line,'shab',v,'thermal:shab-summary',.99,'m²',{building,surfacePriority:100,excerpt:ctx.slice(0,420)}); }

      // Ubat : uniquement les libellés de résultats explicites, jamais un nombre voisin (ex. « gain 57 % »).
      if((m=raw.match(/ubat\s+(?:du\s+)?b[aâ]timent\s*[:=]?\s*(\d+(?:[,.]\d+)?)/i))){ const v=parseFrNumber(m[1]); if(phase==='before') add(page,line,'ubat_before',v,'thermal:ubat-before-structured',.995,'W/m².K',{building,excerpt:ctx.slice(0,420)}); else if(phase==='after') add(page,line,'ubat_after',v,'thermal:ubat-after-structured',.995,'W/m².K',{building,excerpt:ctx.slice(0,420)}); }
      if((m=raw.match(/ubat\s+(?:initial|avant)\s*[:=]?\s*(\d+(?:[,.]\d+)?)/i))) add(page,line,'ubat_before',parseFrNumber(m[1]),'thermal:ubat-before-summary',.995,'W/m².K',{building,excerpt:ctx.slice(0,420)});
      if((m=raw.match(/ubat\s+(?:projet|apr[eè]s)\s*[:=]?\s*(\d+(?:[,.]\d+)?)/i))) add(page,line,'ubat_after',parseFrNumber(m[1]),'thermal:ubat-after-summary',.995,'W/m².K',{building,excerpt:ctx.slice(0,420)});
      if((m=raw.match(/coefficient\s+ubat\s*[:=]\s*(\d+(?:[,.]\d+)?)/i))){ const v=parseFrNumber(m[1]); if(phase==='before') add(page,line,'ubat_before',v,'thermal:bao-ubat-before',.999,'W/m².K',{building,excerpt:ctx.slice(0,420),provenanceNote:'Coefficient Ubat explicite du bloc Etat initial.'}); else if(phase==='after') add(page,line,'ubat_after',v,'thermal:bao-ubat-after',.999,'W/m².K',{building,excerpt:ctx.slice(0,420),provenanceNote:'Coefficient Ubat explicite du bloc Etat après travaux.'}); }

      // Coefficients Cep : ne retenir que les lignes de résultat, pas les objectifs réglementaires dans le texte.
      if((m=raw.match(/coefficient\s+cep\s+existant[^0-9]{0,80}(\d+(?:[,.]\d+)?)/i))){ const v=parseFrNumber(m[1]); add(page,line,'cep_before',v,'thermal:cep-before-structured',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)}); }
      if((m=raw.match(/coefficient\s+cep\s+projet[^0-9]{0,80}(\d+(?:[,.]\d+)?)/i))){ const v=parseFrNumber(m[1]); add(page,line,'cep',v,'thermal:cep-project-structured',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)}); add(page,line,'cep_after_final',v,'thermal:cep-after-structured',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)}); }
      if((m=raw.match(/coefficient\s+cep\s+(?:r[eé]f\.?|reference|référence|max)[^0-9]{0,80}(\d+(?:[,.]\d+)?)/i))) add(page,line,'cep_max',parseFrNumber(m[1]),'thermal:cep-reference',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)});
      if((m=raw.match(/coefficient\s+cep\s+gain[^0-9]{0,50}(\d+(?:[,.]\d+)?)/i))) add(page,line,'cep_gain',parseFrNumber(m[1]),'thermal:cep-gain',.995,'%',{building,excerpt:ctx.slice(0,420)});
      // RT existant : ligne de tableau « Groupe 001 °C 25.02 28.44 -3.42 ».
      if(/tic\s*\(a\)|tic\s+ref\s*\(b\)|temp[eé]ratures?\s+d['’]?ete/i.test(pageLow)){
        const tm=raw.match(/(?:groupe|zone)[^°]{0,80}°c\s+([-+]?\d+(?:[,.]\d+)?)\s+([-+]?\d+(?:[,.]\d+)?)/i);
        if(tm){ add(page,line,'tic',parseFrNumber(tm[1]),'thermal:tic-table',.995,'°C',{building,excerpt:ctx.slice(0,420)}); add(page,line,'tic_ref',parseFrNumber(tm[2]),'thermal:tic-ref-table',.995,'°C',{building,excerpt:ctx.slice(0,420)}); }
      }


      // État courant du tableau de consommations par poste.
      if(/^chauffage\b/i.test(raw)) currentPost='heating';
      else if(/^refroidissement\b/i.test(raw)) currentPost='cooling';
      else if(/^ecs\b|^eau\s+chaude\s+sanitaire\b/i.test(raw)) currentPost='ecs';
      else if(/^eclairage\b|^éclairage\b/i.test(raw)) currentPost='lighting';
      else if(/^auxiliaires\b/i.test(raw)) currentPost='aux';
      if(currentPost==='cooling'&&/sans\s+objet/i.test(low)) add(page,line,'cep_cooling',0,'thermal:cep-cooling-none',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)});
      if(/total\s+energie\s+primaire/i.test(low)){
        const nums=numbersIn(raw), v=nums.length?nums[nums.length-1]:null;
        if(v!==null&&v>=0&&v<1000){
          if(currentPost==='cooling') add(page,line,'cep_cooling',v,'thermal:cep-cooling-total',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)});
          else if(currentPost==='lighting') add(page,line,'cep_lighting',v,'thermal:cep-lighting-total',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)});
          else if(currentPost==='aux'&&!/^vent\s*-/i.test(raw)) add(page,line,'cep_aux_dist',v,'thermal:cep-aux-distribution-total',.97,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420),provenanceNote:'Valeur « Total énergie primaire » du bloc auxiliaires ; la part ventilateurs est lue séparément lorsqu’elle est fournie.'});
        }
      }
      if(/vent\s*-\s*total\s+energie\s+primaire/i.test(low)){ const nums=numbersIn(raw); if(nums.length) add(page,line,'cep_aux_vent',nums[nums.length-1],'thermal:cep-aux-vent',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)}); }

      // Tableaux de prescriptions isolants : Paroi + produit + épaisseur + R sur une même ligne.
      const target=targetFromContext(raw); const mat=findFirstMatch(raw,MATERIALS);
      if(target&&mat&&/(?:ecorock|fibrexpan|efigreen|isolant|laine|pse|pur|pir|xps)/i.test(low)){
        const nums=numbersIn(raw); let th=null,r=null;
        // Dans les tableaux BET : les deux nombres après le produit sont généralement Ep. cm puis R isolant.
        for(let q=0;q<nums.length-1;q++){ if(nums[q]>=2&&nums[q]<=60&&nums[q+1]>=0.5&&nums[q+1]<=12){ th=nums[q]*10; r=nums[q+1]; break; } }
        add(page,line,`${target}_insulation`,mat,'thermal:insulation-table',.995,'',{building,excerpt:ctx.slice(0,420)});
        if(th!==null) add(page,line,`${target}_insulation_thickness`,th,'thermal:insulation-thickness-table',.995,'mm',{building,excerpt:ctx.slice(0,420)});
        if(r!==null) add(page,line,`${target}_insulation_r`,r,'thermal:insulation-r-table',.995,'m².K/W',{building,excerpt:ctx.slice(0,420)});
      }

      // Équipements projetés explicitement décrits dans les chapitres travaux.
      if(phase==='after'){
        if(/simple\s+flux\s+hygror[eé]glable\s+de\s+type\s+a|vmc\s+hygro\s*a/i.test(raw)) add(page,line,'ventilation','VMC Hygro A','thermal:project-ventilation',.995,'',{building,excerpt:ctx.slice(0,420)});
        if(/chaudi[eè]res?.{0,45}gaz.{0,25}condensation|gaz\s+[aà]\s+condensation/i.test(raw)){ add(page,line,'heating_mode_after','Chaudière condensation','thermal:project-heating',.995,'',{building,excerpt:ctx.slice(0,420)}); add(page,line,'heating_vector_after','Gaz','thermal:project-heating-vector',.995,'',{building,excerpt:ctx.slice(0,420)}); }
        if(/production\s+d['’]?ecs\s+collective|production\s+ecs\s+collective/i.test(raw)) add(page,line,'ecs','ECS collective','thermal:project-ecs',.98,'',{building,excerpt:ctx.slice(0,420)});
      }
    }
  }
  return out;
}

function parseProgram(doc){
  const out=[];
  for(const page of doc.read.pages){ const lines=page.lines||[], pageTypes=[];
    for(let i=0;i<lines.length;i++){ const line=lines[i], s=normalizeText(line.text), ctx=lineWindow(page,i,1,1);
      const countPatterns=[/(?:nombre|nb\.?|nombre\s+total)\s*(?:de\s+)?logements?\s*[:=\-]?\s*(\d+)/i,/\bconstruction\s+de\s+(\d+)\s+logements?\b/i,/\bprogramme\s+(?:de|comprenant)\s+(\d+)\s+logements?\b/i,/\b(?:comprend|comprenant|comporte)\s+(\d+)\s+logements?\b/i,/\b(\d+)\s+logements?\b/i];
      const repeatedThermalHeader=/(?:etude|étude)\s+(?:thermique|energetique|énergétique)\s+\d+\s+logements?/i.test(s)&&page.page>1;
      if(!repeatedThermalHeader) for(const re of countPatterns){ const m=s.match(re); if(m){ const n=parseInt(m[1],10); if(n>0&&n<10000){ push(out,occ(doc,page,line,'housing_count',n,'program:housing-count-explicit',0.88,'',{excerpt:normalizeText(ctx).slice(0,420)})); break; } } }
      const yearPatterns=[/(?:annee\s+de\s+construction|année\s+de\s+construction|construit\s+en|construction\s+en|acheve\s+en|achevé\s+en|annee\s+d['’]achevement|année\s+d['’]achèvement)\D{0,20}(17\d{2}|18\d{2}|19\d{2}|20\d{2})/i,/(?:immeuble|batiment|bâtiment)\D{0,40}(?:de|en|construit\s+en)\s*(17\d{2}|18\d{2}|19\d{2}|20\d{2})/i];
      for(const re of yearPatterns){ const m=s.match(re); if(m){ const around=normLower(s); if(/(?:entre|de)\s+(?:17|18|19|20)\d{2}\s+(?:et|a|à|-)\s+(?:17|18|19|20)\d{2}/.test(around)) break; push(out,occ(doc,page,line,'construction_year',parseInt(m[1],10),'program:construction-year',0.90)); break; } }
      if(![DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(doc.type) && [DOC_TYPES.PLAN,DOC_TYPES.SURFACE,DOC_TYPES.NOTICE,DOC_TYPES.PERMIT].includes(doc.type)){ const found=s.match(/\b(?:studio|T1\s*bis|T[1-9]|F[1-9]|maison\s+individuelle|duplex|triplex)\b/ig)||[]; pageTypes.push(...found.map(x=>x.toUpperCase().replace(/\s+/g,' '))); }
    }
    const ty=unique(pageTypes); if(ty.length){ const line=lines.find(l=>/(?:studio|T1\s*bis|T[1-9]|F[1-9]|maison\s+individuelle|duplex|triplex)/i.test(l.text))||lines[0]; const conf=[DOC_TYPES.PLAN,DOC_TYPES.SURFACE].includes(doc.type)?0.88:0.94; push(out,occ(doc,page,line,'housing_typologies',ty.join(', '),'program:typologies-page',conf,'',{excerpt:`Typologies explicites détectées sur la page : ${ty.join(', ')}`})); }
  } return out;
}

function parseEnvelope(doc){
  const out=[];
  for(const page of doc.read.pages){
    if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(doc.type) && /(?:chapitre\s*3\s*:.*indicateurs|donn[eé]es\s+r[eé]capitulatives\s+sur\s+les\s+parois)/i.test(page.text||'')) continue;
    const lines=page.lines||[]; for(let i=0;i<lines.length;i++){
    const line=lines[i], base=normalizeText(line.text); let ctx=base, target=targetFromContext(base);
    const baseMat=findFirstMatch(base,MATERIALS), baseStruct=findFirstMatch(base,STRUCTURES);
    if(target) ctx=normalizeText(lineWindow(page,i,0,2));
    else if(baseMat||baseStruct){ ctx=normalizeText(lineWindow(page,i,1,0)); target=targetFromContext(ctx); }
    else if(ELEMENT_PATTERNS.window.test(base)) ctx=normalizeText(lineWindow(page,i,0,2));
    else continue;
    const explicitTh=explicitThickness(base)??explicitThickness(ctx);
    const productMatch=(target&&matchInsulationProduct(base,target,explicitTh))||(target&&matchInsulationProduct(ctx,target,explicitTh));
    const mat=productMatch?.material||baseMat||findFirstMatch(ctx,MATERIALS), struct=baseStruct||findFirstMatch(ctx,STRUCTURES);
    const hasEnvelope=/isol|thermi|paroi|mur|facade|toiture|plancher|dalle|combles|rampant|ite|iti|sarking|bardage|doublage|contre[- ]cloison|solive/i.test(ctx);
    if(struct && hasEnvelope){ const field=target?`${target}_structure`:'structure'; push(out,occ(doc,page,line,field,struct,'envelope:structure-context',target?0.91:0.87,'',{excerpt:ctx.slice(0,420)})); }
    if(mat && target && hasEnvelope){
      const productExtra=productMatch?{libraryProductMatch:true,libraryBrand:productMatch.brand,libraryProduct:productMatch.product,librarySource:productMatch.source}:{};
      push(out,occ(doc,page,line,`${target}_insulation`,mat,productMatch?'envelope:insulation-product':'envelope:insulation-context',productMatch?0.96:0.93,'',{excerpt:ctx.slice(0,420),...productExtra}));
      if(explicitTh!==null) push(out,occ(doc,page,line,`${target}_insulation_thickness`,explicitTh,'envelope:thickness-context',productMatch?0.96:0.94,'mm',{excerpt:ctx.slice(0,420),...productExtra}));
      else if(productMatch?.variant && productMatch.thicknessEvidence==='product-context'){
        push(out,occ(doc,page,line,`${target}_insulation_thickness`,productMatch.variant.thickness,'library:insulation-thickness',0.93,'mm',{excerpt:ctx.slice(0,420),libraryDerived:true,origin:'Bibliothèque isolants',provenanceNote:libraryNote(productMatch,'thickness'),...productExtra}));
      }
      const r=explicitR(base)??explicitR(ctx);
      if(r!==null) push(out,occ(doc,page,line,`${target}_insulation_r`,r,'envelope:r-context',0.98,'m².K/W',{excerpt:ctx.slice(0,420),...productExtra}));
      else if(productMatch?.variant && productMatch.score>=0.96 && productMatch.thicknessEvidence){
        push(out,occ(doc,page,line,`${target}_insulation_r`,productMatch.variant.r,'library:insulation-r',0.94,'m².K/W',{excerpt:ctx.slice(0,420),libraryDerived:true,origin:'Bibliothèque isolants',provenanceNote:libraryNote(productMatch,'r'),...productExtra}));
      }
    }
    if(ELEMENT_PATTERNS.window.test(ctx)){ const materialCtx=ctx.replace(/volets?\s+roulants?\s+(?:alu(?:minium)?|pvc|bois)/ig,' ').replace(/fermeture\s*:?\s*(?:alu(?:minium)?|pvc|bois)/ig,' '); const wm=findFirstMatch(materialCtx,WINDOW_MATERIALS); const glazingEvidence=/(?:simple|double|triple)\s+(?:vitrage|verre)|\bdouble\s*\+?\s*\d{1,2}(?:[,.]\d+)?\s*mm\b|\d{1,2}\s*(?:\/|-)\s*\d{1,2}(?:\s*(?:ar(?:gon)?|kr(?:ypton)?|air))?\s*(?:\/|-)\s*\d{1,2}|\d{1,2}\.\d{1,2}\.\d{1,2}/i.test(ctx); const gl=glazingEvidence?(normalizeGlazingType(ctx)||findFirstMatch(ctx,GLAZINGS)):null; let sh=findFirstMatch(base,SHADINGS); if(!sh && !/sans\s+protection|sans\s+occultation/i.test(ctx)) sh=findFirstMatch(ctx,SHADINGS); if(wm) push(out,occ(doc,page,line,'window_material',wm,'windows:material-context',0.89,'',{excerpt:ctx.slice(0,420)})); if(gl) push(out,occ(doc,page,line,'window_glazing',gl,'windows:glazing-context',0.90,'',{excerpt:ctx.slice(0,420)})); if(sh) push(out,occ(doc,page,line,'window_shading',sh,'windows:shading-context',0.90,'',{excerpt:ctx.slice(0,420)})); }
  }} return out;
}

function parseSystems(doc){
  const out=[]; let inheritedPhase='unknown';
  for(const page of doc.read.pages){ const lines=page.lines||[]; const explicitPagePhase=phaseFromContext(page.text||'',doc); if(explicitPagePhase!=='unknown') inheritedPhase=explicitPagePhase; const pagePhase=inheritedPhase; const resolvedPhase=ctx=>{ const p=phaseFromContext(ctx,doc); return p==='unknown'?pagePhase:p; }; for(let i=0;i<lines.length;i++){
    const line=lines[i], base=normalizeText(line.text), next=normalizeText(lines[i+1]?.text||''); const baseLow=normLower(base); const envInventoryNoise=/(?:\binies\b|fiche\s+de\s+donn[eé]es\s+environnementales|mise\s+[aà]\s+disposition\s+d['’]?un\s+kwh|impact\s+environnemental|contribution\s+composant)/i.test(baseLow);
    const makeCtx=(kindRe,matcher)=>{ if(!kindRe.test(baseLow)) return null; if(matcher(base)) return base; return normalizeText(`${base} | ${next}`); };

    const heatCtx=makeCtx(/chauffage|chaudiere|pac|pompe\s+a\s+chaleur|radiateur|convecteur|plancher\s+chauffant|vrv|drv|sous[- ]station/i,t=>!!(findFirstMatch(t,HVAC.heating)||findFirstMatch(t,HVAC.vectors)));
    if(heatCtx){ const phase=resolvedPhase(heatCtx), heatLow=normLower(heatCtx); const heatNoise=envInventoryNoise||/(?:taux\s+de\s+couverture|si\s+chauffage|dont\s+chauffage|exigence|rappel|exemple|scenario\s+non\s+retenu|scénario\s+non\s+retenu|hypoth[eè]se)/i.test(heatLow)||(/\bsolaire\b/i.test(heatLow)&&/(?:^|\s)0(?:[,.]0+)?(?:\s+0(?:[,.]0+)?)*\s*$/.test(heatLow)); const mode=heatNoise?null:findFirstMatch(heatCtx,HVAC.heating); const optionList=/type\s+de\s+chauffage\s*:\s*autre\s*\([^)]*(?:gaz|fioul|bois|reseau)[^)]*\)/i.test(heatLow); const strongVector=/^(?:type\s+d['’]?energie|type\s+d['’]?énergie|energie|énergie|combustible|vecteur|alimentation)\s*[:=-]/i.test(heatCtx)||/(?:chaudi[eè]re|pac|pompe\s+[aà]\s+chaleur|sous[- ]station|r[eé]seau\s+de\s+chaleur|convecteur|radiateur|plancher\s+chauffant)/i.test(heatLow); const vec=(!heatNoise&&!optionList&&strongVector)?findFirstMatch(heatCtx,HVAC.vectors):null; if(mode && phase!=='before') push(out,occ(doc,page,line,'heating_mode_after',mode,'systems:heating-mode-context',0.94,'',{excerpt:heatCtx.slice(0,420)})); if(vec && phase==='before') push(out,occ(doc,page,line,'heating_vector_before',vec,'systems:heating-vector-before',0.94,'',{excerpt:heatCtx.slice(0,420)})); if(vec && phase!=='before') push(out,occ(doc,page,line,'heating_vector_after',vec,'systems:heating-vector-after',0.93,'',{excerpt:heatCtx.slice(0,420)})); }

    const ecsCtx=makeCtx(/\becs\b|eau\s+chaude\s+sanitaire|chauffe[- ]eau|ballon|cumulus|cesi/i,t=>!!(findFirstMatch(t,HVAC.ecs)||findFirstMatch(t,HVAC.vectors)));
    if(ecsCtx){ const phase=resolvedPhase(ecsCtx), mode=findFirstMatch(ecsCtx,HVAC.ecs), vec=findFirstMatch(ecsCtx,HVAC.vectors); if(mode && phase!=='before') push(out,occ(doc,page,line,'ecs',mode,'systems:ecs-context',phase==='after'?0.96:0.94,'',{excerpt:ecsCtx.slice(0,420)})); if(vec && phase==='before') push(out,occ(doc,page,line,'ecs_vector_before',vec,'systems:ecs-vector-before',0.94,'',{excerpt:ecsCtx.slice(0,420)})); if(vec && phase!=='before') push(out,occ(doc,page,line,'ecs_vector_after',vec,'systems:ecs-vector-after',0.93,'',{excerpt:ecsCtx.slice(0,420)})); }

    let vent=findFirstMatch(base,HVAC.ventilation), ventCtx=base; if(!vent && /ventil|vmc|cta|air\s+neuf|extraction|hygro/i.test(baseLow)){ ventCtx=normalizeText(`${base} | ${next}`); vent=findFirstMatch(ventCtx,HVAC.ventilation); } const ventPhase=resolvedPhase(ventCtx); if(vent && ventPhase!=='before') push(out,occ(doc,page,line,'ventilation',vent,'systems:ventilation-context',ventPhase==='after'?0.96:0.94,'',{excerpt:ventCtx.slice(0,420)}));

    if(/refroid|rafraich|clim|froid|eau\s+glacee/i.test(baseLow)){ let cool=findFirstMatch(base,COOLING)||findFirstMatch(base,HVAC.heating), coolCtx=base; if(!cool){ coolCtx=normalizeText(`${base} | ${next}`); cool=findFirstMatch(coolCtx,COOLING)||findFirstMatch(coolCtx,HVAC.heating); } const coolLow=normLower(coolCtx); if(envInventoryNoise||/(?:inconnu|non\s+specifie|non\s+spécifié|sans\s+objet|non\s+concerne|non\s+concerné)/i.test(coolLow)) cool=null; if(/sans\s+systeme\s+de\s+refroidissement|sans\s+système\s+de\s+refroidissement|zone\s+non\s+refroidie|pas\s+de\s+climatisation\s+active|absence\s+de\s+climatisation/i.test(coolLow)) cool='Aucun'; if(/chauffe[- ]eau\s+thermodynamique|\bcet\b/i.test(coolLow) && /\bsplit\b/i.test(coolLow) && !/climatisation|refroidissement\s+actif|rafraichissement\s+actif/i.test(coolLow)) cool=null; const coolPhase=resolvedPhase(coolCtx); if(cool && coolPhase!=='before') push(out,occ(doc,page,line,'cooling',cool,'systems:cooling-context',coolPhase==='after'?0.95:0.93,'',{excerpt:coolCtx.slice(0,420)})); }

    let enr=findFirstMatch(base,ENR_TYPES), enrCtx=base; if(!enr && /enr|renouvel|photovolta|solaire|biomasse|geotherm|recuperation|chaleur/i.test(baseLow)){ enrCtx=normalizeText(`${base} | ${next}`); enr=findFirstMatch(enrCtx,ENR_TYPES); } const enrLow=normLower(enrCtx); const enrNoise=/(?:autres?\s+solutions?|exemples?|possibilit[eé]s?|recommandations?|peut\s+etre|peut\s+être|pourrait|envisager|liste\s+non\s+exhaustive)/i.test(enrLow); const enrInstalled=/(?:pr[eé]sence|installation\s+(?:photovolta|solaire|bois|biomasse|g[eé]otherm)|install[eé]e?s?|mis(?:e)?\s+en\s+place|sera\s+install[eé]|g[eé]n[eé]rateurs?\s+photovolta|panneaux?\s+(?:solaires?\s+)?photovolta|capteurs?\s+solaires?|[eé]quipements?\s+solaires?)\b/i.test(enrLow); if(enr && !enrNoise && enrInstalled && /enr|renouvel|photovolta|solaire|biomasse|geotherm|recuperation|chaleur/i.test(enrLow)){ push(out,occ(doc,page,line,'enr','Oui','enr:installed-context',0.93,'',{excerpt:enrCtx.slice(0,420)})); push(out,occ(doc,page,line,'enr_type',enr,'enr:type-installed-context',0.93,'',{excerpt:enrCtx.slice(0,420)})); }

    let fan=findFirstMatch(base,FAN_TYPES), fanCtx=base; if(!fan && /brasseur|ventilateur\s+de\s+plafond|hvls/i.test(baseLow)){ fanCtx=normalizeText(`${base} | ${next}`); fan=findFirstMatch(fanCtx,FAN_TYPES); } if(fan){ push(out,occ(doc,page,line,'fan_type',fan,'comfort:fan-type',0.94,'',{excerpt:fanCtx.slice(0,420)})); const m=fanCtx.match(/(?:nombre|nb\.?)\s*(?:de\s+)?(?:brasseurs?|ventilateurs?\s+de\s+plafond)\s*[:=\-]?\s*(\d+)/i)||fanCtx.match(/(\d+)\s+(?:brasseurs?|ventilateurs?\s+de\s+plafond)/i); if(m) push(out,occ(doc,page,line,'fan_count',parseInt(m[1],10),'comfort:fan-count',0.94,'',{excerpt:fanCtx.slice(0,420)})); }
  }} return out;
}

function parseDpe(doc){
  const out=[]; const name=normLower(doc.name);
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){
    const line=lines[i], ctx=normalizeText(lineWindow(page,i,1,2)), low=normLower(ctx);
    if(!/dpe|classe\s+(?:energie|energetique|énergie|énergétique|ges|climat)|etiquette\s+(?:energie|énergie|climat)|performance\s+energetique|performance\s+énergétique/i.test(low)) continue;
    const narrative=/(?:classe\s+[a-g]\s+minimum|etiquette\s+[a-g]\s*\(|doivent?\s+parvenir|passoires?|crit[eè]res?|eco[- ]?pret|éco[- ]?prêt|sup[eé]rieur|inf[eé]rieur|peuvent?\s+b[eé]n[eé]ficier|obligation\s+de\s+r[eé]sultat)/i.test(low);
    const explicitSection=doc.type===DOC_TYPES.DPE||/(?:[eé]tiquettes?\s+(?:[eé]tat|sc[eé]nario)|dpe\s+(?:avant|apr[eè]s)|classe\s+(?:energie|énergie|ges)\s+(?:avant|apr[eè]s))/i.test(low);
    if(narrative||!explicitSection) continue;
    const explicit=ctx.match(/(?:classe|etiquette|étiquette)\s*(?:dpe\s*)?(?:energie|énergie|energetique|énergétique|climat|ges)?\s*[:=\-]?\s*([A-G])\b/i)||ctx.match(/\b(?:energie|énergie|energetique|énergétique|ges|climat)\s*[:=\-]\s*([A-G])\b/i); if(!explicit) continue;
    const letter=explicit[1].toUpperCase(), ges=/ges|climat|gaz\s+a\s+effet|gaz\s+à\s+effet/i.test(low), before=/avant|initial|existant|audit/.test(normLower(`${name} ${ctx}`)), after=/apres|après|final|reception|réception|post[- ]travaux|scenario|scénario|projet/.test(normLower(`${name} ${ctx}`));
    // Un DPE neuf/final isolé est une donnée après travaux/finale.
    const finalAfter=after||(doc.type===DOC_TYPES.DPE&&!before&&/(?:\bneuf\b|dpe[-_ ]?2021)/i.test(normLower(`${name} ${page.text||''}`)));
    if(!before&&!finalAfter) continue;
    const field=finalAfter?(ges?'dpe_ges_after':'dpe_energy_after'):(ges?'dpe_ges_before':'dpe_energy_before'); push(out,occ(doc,page,line,field,letter,'dpe:explicit-class-phase',0.96,'',{excerpt:ctx.slice(0,420)}));
  }} return out;
}

function parseCarbon(doc){
  const out=[]; const mappings=[
    ['ic_energy_heating',/ic\s*[eé]nergie[^|]{0,45}chauffage/i],['ic_energy_cooling',/ic\s*[eé]nergie[^|]{0,45}(?:refroid|froid)/i],['ic_energy_ecs',/ic\s*[eé]nergie[^|]{0,45}(?:ecs|eau\s+chaude)/i],
    ['ic_energy_aux_vent',/ic\s*[eé]nergie[^|]{0,60}auxiliaires?[^|]{0,25}ventil/i],['ic_energy_aux_dist',/ic\s*[eé]nergie[^|]{0,60}auxiliaires?[^|]{0,25}distribution/i],['ic_energy_mobility',/ic\s*[eé]nergie[^|]{0,60}(?:deplacements?|déplacements?|ascenseurs?|escalators?|parking)/i],
    ['ic_components',/ic\s*composants?(?:\s+batiment)?/i],['ic_site',/ic\s*chantier/i],['ic_energy',/ic\s*[eé]nergie(?:\s+batiment)?/i]
  ];
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){ const line=lines[i], raw=normalizeText(line.text||''), ctx=normalizeText(lineWindow(page,i,1,2));
    // Une occurrence carbone générique doit porter elle-même le libellé ET une valeur.
    // Les titres de chapitres, n° de lot et tableaux d'autres indicateurs ne sont jamais utilisés ici.
    const strongCarrier=/kg\s*(?:eq|éq)?\.?\s*co2|kgco2|[:=]/i.test(raw);
    if(strongCarrier){
      for(const [f,re] of mappings){
        if(!re.test(raw)) continue;
        const v=firstValueAfterLabel(raw,re);
        if(v!==null) push(out,occ(doc,page,line,f,v,'carbon:explicit-label',0.94,'kgCO2e/m²',{excerpt:ctx.slice(0,420)}));
      }
    }
    // Forme autorisée : « IC composants lot 8 = 39,09 ». Un simple « LOT : 08 - CVC » est un titre.
    const lot=raw.match(/ic\s+composants?\s+lot\s*(1[0-3]|[1-9])\s*(?:[:=|-])\s*([-+]?\d+(?:[,.]\d+)?)/i);
    if(lot){ const v=parseFrNumber(lot[2]); if(v!==null) push(out,occ(doc,page,line,`ic_lot_${lot[1]}`,v,'carbon:explicit-lot-label',0.96,'kgCO2e/m²',{excerpt:ctx.slice(0,420)})); }
  }} return out;
}


// Dictionnaire central des 167 colonnes ExtracTerre.
// Ce parseur reste volontairement strict : il exploite les couples libellé/valeur explicites
// et les tableaux Excel, tandis que les parseurs RSET/RSEE/thermiques spécialisés gardent la priorité.
function taggedValue(def,raw=''){
  const text=String(raw??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
  if(!text) return null;
  if(def.type==='number'){
    // Le parseur générique ne tranche jamais une ligne de tableau contenant plusieurs nombres
    // (ex. « Bbio | 43,8 | 65,9 | 33,5 »). Ces tableaux restent au parseur métier spécialisé.
    const cleaned=text.replace(/(?:€|euros?|ht|ttc|m²|m2|kwh[^\s;|]*|kg[^\s;|]*|logements?|batiments?|bâtiments?)/ig,' ').trim().replace(/^[^0-9+\-]+|[^0-9]+$/g,'').trim();
    if(!/^[-+]?\d+(?:[ \u00a0]\d{3})*(?:[,.]\d+)?$/.test(cleaned)) return null;
    const n=parseFrNumber(cleaned);
    return n!==null&&Number.isFinite(n)?n:null;
  }
  return text.replace(/^[:=|;\-–—\s]+/,'').trim()||null;
}
// Index de tags précompilé : auparavant chaque ligne de chaque PDF reparcourait les 167 champs,
// retriait leurs tags et les renormalisait. Sur un rapport dense cela pouvait monopoliser le thread
// principal plusieurs secondes et déclencher « page ne répond pas ».
const TAG_CACHE_BY_KEY=new Map();
const TAG_PREFIX_INDEX=new Map();
for(const def of FIELD_DEFS){
  const tags=[...(def.tags||[])].map(tag=>({tag,norm:normalizeFieldHeader(tag)})).filter(x=>x.norm).sort((a,b)=>b.norm.length-a.norm.length);
  TAG_CACHE_BY_KEY.set(def.key,tags);
  for(const item of tags){
    const first=item.norm.split(/\s+/)[0]; if(!first) continue;
    let defs=TAG_PREFIX_INDEX.get(first); if(!defs){ defs=new Set(); TAG_PREFIX_INDEX.set(first,defs); }
    defs.add(def);
  }
}
const PRESENCE_DEFS=FIELD_DEFS.filter(def=>def.presence);
function taggedCandidateDefs(normalized=''){
  const first=String(normalized||'').split(/\s+/)[0];
  return first?[...(TAG_PREFIX_INDEX.get(first)||[])]:[];
}
function taggedLineMatch(raw,def,normalizedInput=''){
  const src=String(raw??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim(), normalized=normalizedInput||normalizeFieldHeader(src);
  if(!src||!normalized) return null;
  const tags=TAG_CACHE_BY_KEY.get(def.key)||[];
  for(const {tag,norm:nt} of tags){
    if(normalized===nt) return {value:null,tag,exact:true};
    if(normalized.startsWith(nt)){
      const approx=src.slice(Math.min(src.length,tag.length));
      if(/^\s*(?::|=|\||;|\-|–|—)\s*/.test(approx)) return {value:taggedValue(def,approx.replace(/^\s*(?::|=|\||;|\-|–|—)\s*/,'')),tag,exact:true};
      if(def.type==='number'&&/^\s+[-+]?\d/.test(approx)) return {value:taggedValue(def,approx),tag,exact:true};
    }
  }
  return null;
}
function taggedPresence(raw,def,normalizedInput=''){
  if(!def.presence) return null;
  const n=normalizedInput||normalizeFieldHeader(raw); if(!n) return null;
  for(const {tag,norm:t} of TAG_CACHE_BY_KEY.get(def.key)||[]){
    if(t.length<3||!n.includes(t)) continue;
    const explicitSelected=/(?:retenu|retenue|choisi|choisie|selection|sélection|mention|label|option|exigence)/i.test(raw);
    const negated=new RegExp(`(?:non|sans|aucun(?:e)?|pas\s+de|non\s+retenu(?:e)?|non\s+choisi(?:e)?)\s+[^|;,]{0,28}${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`,'i').test(n);
    return {value:negated?'Non':'Oui',confidence:explicitSelected ? 0.90 : 0.82,tag};
  }
  return null;
}
function parseTaggedSpreadsheet(doc){
  const out=[];
  for(const page of doc.read?.pages||[]){
    const rows=(page.lines||[]).filter(l=>Array.isArray(l.cells)); if(!rows.length) continue;
    let header=null, map=[];
    for(const line of rows.slice(0,12)){
      const m=line.cells.map((cell,col)=>{ const def=matchFieldByHeader(cell); return def?{col,def}:null; }).filter(Boolean);
      if(m.length>(header?.count||0)) header={line,count:m.length,index:line.index},map=m;
    }
    if(!header||header.count<2) continue;
    const dataRows=rows.filter(l=>l.index>header.index);
    for(const line of dataRows){
      const buildingEntry=map.find(x=>x.def.key==='building');
      const rawBuilding=buildingEntry?String(line.cells[buildingEntry.col]??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim():'';
      const building=rawBuilding||'Bâtiment unique';
      for(const {col,def} of map){
        if(def.key==='building') continue;
        const raw=String(line.cells[col]??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim(); if(!raw) continue;
        const value=taggedValue(def,raw); if(value===null||value==='') continue;
        push(out,occ(doc,page,line,def.key,value,'tags:spreadsheet-header',.965,'',{building,origin:`${doc.type} — tableau structuré`,provenanceNote:`Colonne reconnue par le tag « ${normalizeText(header.line.cells[col]||def.label)} ».`}));
      }
    }
  }
  return out;
}
const TECHNICAL_DOC_TYPES=new Set([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL,DOC_TYPES.RSENV,DOC_TYPES.CARBON,DOC_TYPES.DPE]);
const SAFE_TECH_TAG_KEYS=new Set(['internal_code','operation_name','owner_company','work_type','housing_count','housing_total','building_total','reference_name','reference_version','department','construction_year']);
function taggedFieldAllowedForDocument(doc,def){
  if(!TECHNICAL_DOC_TYPES.has(doc.type)) return true;
  return SAFE_TECH_TAG_KEYS.has(def.key);
}

function parseTaggedFields(doc){
  if(doc.read?.kind==='spreadsheet') return parseTaggedSpreadsheet(doc);
  const out=[];
  for(const page of doc.read?.pages||[]){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], raw=String(line.text??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
      if(!raw) continue;
      const normalized=normalizeFieldHeader(raw), matched=new Set();
      for(const def of taggedCandidateDefs(normalized)){
        if(def.key==='building'||!taggedFieldAllowedForDocument(doc,def)) continue;
        const hit=taggedLineMatch(raw,def,normalized);
        if(!hit) continue;
        matched.add(def.key);
        let value=hit.value;
        if(value===null && def.presence) value='Oui';
        if(value===null){
          const next=String(lines[i+1]?.text??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
          if(next){
            const nextNorm=normalizeFieldHeader(next);
            const nextIsLabel=taggedCandidateDefs(nextNorm).some(f=>!!taggedLineMatch(next,f,nextNorm));
            if(!nextIsLabel) value=taggedValue(def,next);
          }
        }
        if(value!==null&&value!=='') push(out,occ(doc,page,line,def.key,value,'tags:label-value',.915,'',{origin:`${doc.type} — libellé structuré`,provenanceNote:`Champ reconnu par le tag « ${hit.tag} ».`}));
      }
      for(const def of PRESENCE_DEFS){
        if(!taggedFieldAllowedForDocument(doc,def)||matched.has(def.key)) continue;
        const presence=taggedPresence(raw,def,normalized);
        if(presence) push(out,occ(doc,page,line,def.key,presence.value,'tags:presence',presence.confidence,'',{origin:`${doc.type} — mention détectée`,provenanceNote:`Mention reconnue par le tag « ${presence.tag} »${presence.confidence<.9?' ; validation conseillée.':''}`}));
      }
    }
  }
  return out;
}



// v1.1.17 — lecture hiérarchique des familles réglementaires.
// Le but n'est plus de laisser toutes les occurrences d'un mot-clé se concurrencer à égalité :
// on encode la position fonctionnelle de la donnée (résultat réglementaire, sortie détaillée,
// récapitulatif, annexe, lot, zone...) afin que la consolidation puisse privilégier la bonne couche.
function semanticHierarchyRank(doc,o){
  const m=String(o?.method||'');
  const e=normLower(`${o?.origin||''} ${o?.excerpt||''}`);
  if(o?.userValidated) return 0;

  if(doc.type===DOC_TYPES.RT2012){
    if(/rt2012:chapter2-|rset:chapter2-|rset:rt2012-cep-table|rset:bbio-table|rset:chapter2-tic-worst-group/.test(m)) return 5;
    if(/rset:coefficient-direct|rset:detailed-output-primary|rset:detailed-output-cep/.test(m)) return 10;
    if(/rset:chapter4-|rset:equipment-|rset:generation-/.test(m)) return 15;
    if(/rset:(?:bbio|cep|cepnr)-summary-row/.test(m)) return 25;
    if(/annexe|valeurs\s+cles|synthese/.test(e)) return 35;
    if(/generic:|tags:/.test(m)) return 80;
    return 45;
  }
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020].includes(doc.type)){
    if(/rset:chapter2-|rset:cep-table|rset:bbio-table|rset:dh-row|rset:dh-explicit/.test(m)) return 5;
    if(/rset:coefficient-direct|rset:detailed-output-primary|rset:detailed-output-cep/.test(m)) return 10;
    if(/rset:chapter4-|rset:equipment-|rset:generation-/.test(m)) return 15;
    if(/rset:carbon-(?:components|energy|site|lot|energy-post)-total|rsenv:building-summary|rsenv:lot-summary/.test(m)) return 8;
    if(/rset:(?:bbio|cep|cepnr)-summary-row/.test(m)) return 25;
    if(/generic:|tags:/.test(m)) return 80;
    return 45;
  }
  if(doc.type===DOC_TYPES.RSENV){
    if(/rsenv:building-summary/.test(m)) return 5;
    if(/rsenv:lot-summary|rset:carbon-lot-/.test(m)) return 10;
    if(/rset:carbon-(?:components|energy|site)-total/.test(m)) return 8;
    if(/parse-carbon|carbon:|generic:|tags:/.test(m)) return 70;
    return 40;
  }
  if(doc.type===DOC_TYPES.CARBON){
    // Une ACV libre est une bonne source carbone, mais une éventuelle reprise Bbio/Cep/Tic
    // reste une source de contrôle et ne doit pas concurrencer un RSET/RSEE primaire.
    if(/ic_|carbon|acv/.test(e+m)) return 25;
    return 75;
  }
  if(doc.type===DOC_TYPES.RT_EXISTING){
    if(/patch:|rt-existing|cype|therm/.test(m+e)) return 10;
    if(/generic:/.test(m)) return 70;
    return 35;
  }
  return Number.isFinite(o?.hierarchyRank)?o.hierarchyRank:50;
}

function annotateSemanticHierarchy(doc,out){
  return out.map(o=>({...o,hierarchyRank:semanticHierarchyRank(doc,o)}));
}


function parseRt2012Hierarchical(doc){
  if(doc.type!==DOC_TYPES.RT2012) return [];
  const out=[];
  let inChapter2=false;
  for(const page of doc.read?.pages||[]){
    const pageLow=normLower(page.text||'');
    if(/chapitre\s*2\s*:/.test(pageLow)) inChapter2=true;
    if(/chapitre\s*[34]\s*:/.test(pageLow) && !/chapitre\s*2\s*:/.test(pageLow)) inChapter2=false;
    if(!inChapter2 && !/(?:coefficient\s+bbio|coefficient\s+cep|tic\s+en\s*°?c)/i.test(page.text||'')) continue;
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], t=normalizeText(line.text||'');
      if(/^coefficient\s+bbio\b/i.test(t)){
        const v=numbersIn(t).filter(x=>x>=0&&x<1000); if(v.length>=2){
          push(out,occ(doc,page,line,'bbio',v[0],'rt2012:chapter2-bbio',0.999,'points',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
          push(out,occ(doc,page,line,'bbio_max',v[1],'rt2012:chapter2-bbio',0.999,'points',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
          if(v.length>=3) push(out,occ(doc,page,line,'bbio_gain',v[2],'rt2012:chapter2-bbio',0.998,'%',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
        }
      }
      if(/^coefficient\s+cep\b/i.test(t)){
        const v=numbersIn(t).filter(x=>x>=-100&&x<5000); if(v.length>=2){
          push(out,occ(doc,page,line,'cep',v[0],'rt2012:chapter2-cep',0.999,'kWhEP/m².an',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
          push(out,occ(doc,page,line,'cep_max',v[1],'rt2012:chapter2-cep',0.999,'kWhEP/m².an',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
          if(v.length>=3) push(out,occ(doc,page,line,'cep_gain',v[2],'rt2012:chapter2-cep',0.998,'%',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
        }
      }
      if(/conforme/i.test(t)){
        const m=t.match(/(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(-?\d+(?:[,.]\d+)?)\s+conforme/i);
        if(m){ const tic=parseFrNumber(m[1]), ref=parseFrNumber(m[2]); if(tic>=5&&tic<=60&&ref>=5&&ref<=60){
          const building=buildingForPosition(doc,page.page,line.index);
          push(out,occ(doc,page,line,'tic',tic,'rt2012:chapter2-tic',0.999,'°C',{building,origin:'RT2012 — Chapitre 2 résultats réglementaires',provenanceNote:'Tic lue sur la ligne de groupe du tableau réglementaire.'}));
          push(out,occ(doc,page,line,'tic_ref',ref,'rt2012:chapter2-tic',0.999,'°C',{building,origin:'RT2012 — Chapitre 2 résultats réglementaires',provenanceNote:'TicRef lue sur la même ligne que la Tic du groupe.'}));
        }}
      }
    }
  }
  return out;
}

function parseRsenvHierarchical(doc){
  if(doc.type!==DOC_TYPES.RSENV) return [];
  const out=[];
  let chapter=0, currentLot=null, building='Bâtiment unique';
  for(const page of doc.read?.pages||[]){
    const lines=page.lines||[];
    const pageLow=normLower(page.text||'');
    const bmLine=(page.lines||[]).map(x=>normalizeText(x.text||'')).find(x=>/^B[aâ]timent\s+[A-Za-z0-9._-]+(?:\s|$)/i.test(x)); const bm=bmLine?bmLine.match(/^B[aâ]timent[ \t]+([A-Za-z0-9._-]+)/i):null; if(bm) building=canonicalBuilding(`Bâtiment ${bm[1]}`);
    if(/chapitre\s*5\s*:/.test(pageLow)) chapter=5;
    else if(/chapitre\s*6\s*:/.test(pageLow)) chapter=6;
    else if(/chapitre\s*7\s*:/.test(pageLow)) chapter=7;
    for(let i=0;i<lines.length;i++){
      const line=lines[i], t=normalizeText(line.text||''), low=normLower(t);
      const lot=t.match(/^\s*(?:lot\s*)?(1[0-3]|0?[1-9])\s*[-–—:]\s*(.+)$/i);
      if(lot && /vrd|fondation|infrastructure|superstructure|maçon|macon|couverture|charpente|cloison|doublage|menuiser|façade|facade|revêtement|revetement|cvc|chauffage|ecs|ventilation|sanitaire|réseaux?|reseaux?|communication|élévateur|elevateur|photovolta|production\s+locale/i.test(normLower(lot[2]))) currentLot=parseInt(lot[1],10);
      if(chapter===5){
        const defs=[
          ['ic_components',/^ic\s+composant(?:s)?\b(?![^|]{0,40}\blot\b)/i],
          ['ic_site',/^ic\s+chantier\b/i],
          ['ic_energy',/^ic\s+[eé]nergie\b(?![^|]{0,40}annualis)/i]
        ];
        for(const [field,re] of defs){ if(re.test(t) && !/\blot\b/i.test(t) && !/annualis/i.test(t)){
          const nums=numbersIn(t).filter(v=>v>=0&&v<10000); if(nums.length) push(out,occ(doc,page,line,field,nums[0],'rsenv:building-summary',0.999,'kgCO2e/m²',{building,origin:'RSENV — Chapitre 5 niveau bâtiment',provenanceNote:'Indicateur lu dans les sorties ACV au niveau bâtiment, prioritaires sur les quantitatifs, zones et annexes.'}));
        }}
        if(currentLot && /(?:ic\s+(?:composant\s+)?dynamique\s+du\s+lot|ic\s+dynamique\s+lot)/i.test(t)){
          const nums=numbersIn(t).filter(v=>v>=0&&v<10000); if(nums.length) push(out,occ(doc,page,line,`ic_lot_${currentLot}`,nums[0],'rsenv:lot-summary',0.999,'kgCO2e/m²',{building,origin:'RSENV — Chapitre 5 contribution Composant / lot',provenanceNote:`Valeur carbone du lot ${currentLot} lue dans la sortie ACV niveau bâtiment.`}));
        }
      }
    }
  }
  return out;
}


function pruneHierarchicalShadowed(doc,out){
  if(doc.type===DOC_TYPES.RSENV){
    const strongFields=new Set(out.filter(o=>/^rsenv:(?:building|lot)-summary/.test(String(o.method||''))).map(o=>o.field));
    if(strongFields.size) out=out.filter(o=>!strongFields.has(o.field) || /^rsenv:(?:building|lot)-summary/.test(String(o.method||'')) || o.userValidated);
  }
  if(doc.type===DOC_TYPES.RT2012){
    const strong=new Set(out.filter(o=>/^rt2012:chapter2-|rset:chapter2-|rset:bbio-table|rset:rt2012-cep-table/.test(String(o.method||''))).map(o=>o.field));
    if(strong.size) out=out.filter(o=>!strong.has(o.field) || !/rset:(?:bbio|cep|cepnr)-summary-row|generic:regulatory-label/.test(String(o.method||'')) || o.userValidated);
  }
  return out;
}

export function parseDocument(doc){
  let out=[];
  out.push(...parseTaggedFields(doc));
  // Surface bâtiment générique : SHAB, Sref/SRéf, surface habitable, surface du bâtiment, SU/SURT/SRT.
  if(doc.type!==DOC_TYPES.DPGF) out.push(...parseBuildingSurface(doc));
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(doc.type)) out.push(...parseRset(doc));
  out.push(...parseRt2012Hierarchical(doc));
  if(doc.type===DOC_TYPES.THERMAL) out.push(...parseGenericRegulatory(doc));
  if([DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL].includes(doc.type)){ const structuredRenovation=isStructuredRenovationThermalDocument(doc); if(structuredRenovation) out.push(...parseStructuredRenovationThermal(doc)); out.push(...parseThermalStudy(doc)); }
  out.push(...parseProgram(doc),...parseEnvelope(doc));
  // Un DPE contient de nombreuses recommandations et exemples (PAC, biomasse, climatisation, ENR).
  // Ils ne décrivent pas nécessairement les équipements réellement en place : pas de parseur systèmes générique sur DPE.
  if(doc.type!==DOC_TYPES.DPE) out.push(...parseSystems(doc));
  if(doc.type===DOC_TYPES.DPE||/\bdpe\b/i.test(doc.read.text)) out.push(...parseDpe(doc));
  if([DOC_TYPES.CARBON,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RSENV].includes(doc.type)||/ic\s*(?:composants?|composant|energie|énergie|construction|chantier)/i.test(doc.read.text)) out.push(...parseCarbon(doc));
  // Un RSENV/ACV peut être classé « Étude carbone / ACV » tout en utilisant exactement
  // les tableaux détaillés RSEE (lots 1 à 13 + Énergie CE). On applique donc le même parseur.
  if([DOC_TYPES.CARBON,DOC_TYPES.RSENV].includes(doc.type)) addRsetCarbonBreakdown(doc,out);
  out.push(...parseRsenvHierarchical(doc));
  // Patches déclaratifs : uniquement des règles de bibliothèque validées, sans eval/JS externe.
  out.push(...parsePatchOccurrences(doc));
  out=pruneHierarchicalShadowed(doc,out.filter(Boolean));
  return annotateSemanticHierarchy(doc,out);
}
