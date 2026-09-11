import {DOC_TYPES,FIELD_DEFS,FIELD_MAP,normalizeFieldHeader,matchFieldByHeader,MATERIALS,STRUCTURES,HVAC,COOLING,WINDOW_MATERIALS,GLAZINGS,SHADINGS,ENR_TYPES,FAN_TYPES,ELEMENT_PATTERNS} from './config.js';
import {normalizeText,normLower,numbersIn,parseFrNumber,findFirstMatch,unique,clamp,maskNonDataNumerics,normalizeGlazingType} from './utils.js';
import {buildingForPosition,canonicalBuilding} from './buildings.js';
import {matchInsulationProduct,libraryNote} from './insulation-library.js';

function occ(doc,page,line,field,value,method,confidence=0.75,unit='',extra={}){
  if(value===null||value===undefined||value==='') return null;
  return {field,value,building:buildingForPosition(doc,page.page,line.index),docId:doc.id,fileName:doc.name,docType:doc.type,page:page.page,excerpt:normalizeText(line.text).slice(0,420),confidence:clamp(confidence),method,unit,...extra};
}
function push(out,o){ if(o) out.push(o); }
function lineWindow(page,i,before=2,after=2){ const ls=page.lines||[]; return ls.slice(Math.max(0,i-before),Math.min(ls.length,i+after+1)).map(x=>x.text).join(' | '); }
function firstValueAfterLabel(text,labelRe){ const flags=labelRe.flags.includes('i')?'i':''; const clean=normalizeText(maskNonDataNumerics(text)); const m=clean.match(new RegExp(`${labelRe.source}[^0-9+-]{0,90}([-+]?\\d+(?:[\\s.]\\d{3})*(?:[,.]\\d+)?)`,flags)); return m?parseFrNumber(m[1]):null; }
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
        let vals=numbersIn(s).filter(x=>x>=0); if(vals.length<2 && /^coefficient\s+bbio\b/i.test(s)) vals=numbersIn(lineWindow(page,i,0,1)).filter(x=>x>=0);
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
        let vals=numbersIn(s).filter(x=>x>=-100); if(vals.length<2) vals=numbersIn(lineWindow(page,i,0,2)).filter(x=>x>=-100);
        if(vals.length>=2){ push(out,occ(doc,page,line,'cep',vals[0],'rset:rt2012-cep-table',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cep_max',vals[1],'rset:rt2012-cep-table',0.995,'kWhEP/m².an')); if(vals.length>=3) push(out,occ(doc,page,line,'cep_gain',vals[2],'rset:rt2012-cep-table',0.99,'%')); }
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
  for(const page of doc.read.pages){ for(const line of page.lines||[]){ const s=normalizeText(line.text), building=buildingForPosition(doc,page.page,line.index); const patterns={bbio:/\bbbio\b(?!\s*max)/i,bbio_max:/\bbbio\s*max\b/i,cep:/\bcep\b(?!\s*,?\s*nr|\s*max)/i,cep_max:/\bcep\s*max\b/i,cepnr:/\bcep\s*,?\s*nr\b(?!\s*max)/i,cepnr_max:/\bcep\s*,?\s*nr\s*max\b/i,dh:/\bdh\b|degres?[- ]heures?/i};
    for(const [field,re] of Object.entries(patterns)){ const key=`${building}|${field}`; if(have.has(key)||!re.test(s)) continue; const val=firstValueAfterLabel(s,re); if(val!==null){ push(out,occ(doc,page,line,field,val,'rset:fallback-label',0.87,'',{building})); have.add(key); } }
  }} return out;
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
    for(const [field,re,unit] of specs){ if(re.test(ctx)){ const v=firstValueAfterLabel(ctx,re); if(v!==null) push(out,occ(doc,page,line,field,v,'generic:regulatory-label',0.91,unit,{excerpt:normalizeText(ctx).slice(0,420)})); } }
    for(const [field,re] of breakdown){ if(re.test(ctx)){ const v=firstValueAfterLabel(ctx,re); if(v!==null) push(out,occ(doc,page,line,field,v,'generic:cep-breakdown',0.90,'kWhEP/m².an',{excerpt:normalizeText(ctx).slice(0,420)})); } }
    const phase=phaseFromContext(ctx,doc);
    if(/\bubat\b/i.test(ctx)){ const v=firstValueAfterLabel(ctx,/\bubat\b/i); if(v!==null && phase==='before') push(out,occ(doc,page,line,'ubat_before',v,'renovation:ubat-before',0.92,'W/m².K',{excerpt:normalizeText(ctx).slice(0,420)})); if(v!==null && phase==='after') push(out,occ(doc,page,line,'ubat_after',v,'renovation:ubat-after',0.92,'W/m².K',{excerpt:normalizeText(ctx).slice(0,420)})); }
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
      for(const re of countPatterns){ const m=s.match(re); if(m){ const n=parseInt(m[1],10); if(n>0&&n<10000){ push(out,occ(doc,page,line,'housing_count',n,'program:housing-count-explicit',0.88,'',{excerpt:normalizeText(ctx).slice(0,420)})); break; } } }
      const yearPatterns=[/(?:annee\s+de\s+construction|année\s+de\s+construction|construit\s+en|construction\s+en|acheve\s+en|achevé\s+en|annee\s+d['’]achevement|année\s+d['’]achèvement)\D{0,20}(17\d{2}|18\d{2}|19\d{2}|20\d{2})/i,/(?:immeuble|batiment|bâtiment)\D{0,40}(?:de|en|construit\s+en)\s*(17\d{2}|18\d{2}|19\d{2}|20\d{2})/i];
      for(const re of yearPatterns){ const m=s.match(re); if(m){ push(out,occ(doc,page,line,'construction_year',parseInt(m[1],10),'program:construction-year',0.90)); break; } }
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
    if(ELEMENT_PATTERNS.window.test(ctx)){ const wm=findFirstMatch(ctx,WINDOW_MATERIALS), gl=normalizeGlazingType(ctx)||findFirstMatch(ctx,GLAZINGS), sh=findFirstMatch(ctx,SHADINGS); if(wm) push(out,occ(doc,page,line,'window_material',wm,'windows:material-context',0.89,'',{excerpt:ctx.slice(0,420)})); if(gl) push(out,occ(doc,page,line,'window_glazing',gl,'windows:glazing-context',0.90,'',{excerpt:ctx.slice(0,420)})); if(sh) push(out,occ(doc,page,line,'window_shading',sh,'windows:shading-context',0.90,'',{excerpt:ctx.slice(0,420)})); }
  }} return out;
}

function parseSystems(doc){
  const out=[];
  for(const page of doc.read.pages){ const lines=page.lines||[]; const pagePhase=phaseFromContext(page.text||'',doc); const resolvedPhase=ctx=>{ const p=phaseFromContext(ctx,doc); return p==='unknown'?pagePhase:p; }; for(let i=0;i<lines.length;i++){
    const line=lines[i], base=normalizeText(line.text), next=normalizeText(lines[i+1]?.text||''); const baseLow=normLower(base);
    const makeCtx=(kindRe,matcher)=>{ if(!kindRe.test(baseLow)) return null; if(matcher(base)) return base; return normalizeText(`${base} | ${next}`); };

    const heatCtx=makeCtx(/chauffage|chaudiere|pac|pompe\s+a\s+chaleur|radiateur|convecteur|plancher\s+chauffant|vrv|drv|sous[- ]station/i,t=>!!(findFirstMatch(t,HVAC.heating)||findFirstMatch(t,HVAC.vectors)));
    if(heatCtx){ const phase=resolvedPhase(heatCtx), mode=findFirstMatch(heatCtx,HVAC.heating), vec=findFirstMatch(heatCtx,HVAC.vectors); if(mode && phase!=='before') push(out,occ(doc,page,line,'heating_mode_after',mode,'systems:heating-mode-context',0.94,'',{excerpt:heatCtx.slice(0,420)})); if(vec && phase==='before') push(out,occ(doc,page,line,'heating_vector_before',vec,'systems:heating-vector-before',0.94,'',{excerpt:heatCtx.slice(0,420)})); if(vec && phase!=='before') push(out,occ(doc,page,line,'heating_vector_after',vec,'systems:heating-vector-after',0.93,'',{excerpt:heatCtx.slice(0,420)})); }

    const ecsCtx=makeCtx(/\becs\b|eau\s+chaude\s+sanitaire|chauffe[- ]eau|ballon|cumulus|cesi/i,t=>!!(findFirstMatch(t,HVAC.ecs)||findFirstMatch(t,HVAC.vectors)));
    if(ecsCtx){ const phase=resolvedPhase(ecsCtx), mode=findFirstMatch(ecsCtx,HVAC.ecs), vec=findFirstMatch(ecsCtx,HVAC.vectors); if(mode && phase!=='before') push(out,occ(doc,page,line,'ecs',mode,'systems:ecs-context',phase==='after'?0.96:0.94,'',{excerpt:ecsCtx.slice(0,420)})); if(vec && phase==='before') push(out,occ(doc,page,line,'ecs_vector_before',vec,'systems:ecs-vector-before',0.94,'',{excerpt:ecsCtx.slice(0,420)})); if(vec && phase!=='before') push(out,occ(doc,page,line,'ecs_vector_after',vec,'systems:ecs-vector-after',0.93,'',{excerpt:ecsCtx.slice(0,420)})); }

    let vent=findFirstMatch(base,HVAC.ventilation), ventCtx=base; if(!vent && /ventil|vmc|cta|air\s+neuf|extraction|hygro/i.test(baseLow)){ ventCtx=normalizeText(`${base} | ${next}`); vent=findFirstMatch(ventCtx,HVAC.ventilation); } const ventPhase=resolvedPhase(ventCtx); if(vent && ventPhase!=='before') push(out,occ(doc,page,line,'ventilation',vent,'systems:ventilation-context',ventPhase==='after'?0.96:0.94,'',{excerpt:ventCtx.slice(0,420)}));

    if(/refroid|rafraich|clim|froid|eau\s+glacee/i.test(baseLow)){ let cool=findFirstMatch(base,COOLING)||findFirstMatch(base,HVAC.heating), coolCtx=base; if(!cool){ coolCtx=normalizeText(`${base} | ${next}`); cool=findFirstMatch(coolCtx,COOLING)||findFirstMatch(coolCtx,HVAC.heating); } const coolPhase=resolvedPhase(coolCtx); if(cool && coolPhase!=='before') push(out,occ(doc,page,line,'cooling',cool,'systems:cooling-context',coolPhase==='after'?0.95:0.93,'',{excerpt:coolCtx.slice(0,420)})); }

    let enr=findFirstMatch(base,ENR_TYPES), enrCtx=base; if(!enr && /enr|renouvel|photovolta|solaire|biomasse|geotherm|recuperation|chaleur/i.test(baseLow)){ enrCtx=normalizeText(`${base} | ${next}`); enr=findFirstMatch(enrCtx,ENR_TYPES); } if(enr && /enr|renouvel|photovolta|solaire|biomasse|geotherm|recuperation|chaleur/i.test(normLower(enrCtx))){ push(out,occ(doc,page,line,'enr','Oui','enr:context',0.90,'',{excerpt:enrCtx.slice(0,420)})); push(out,occ(doc,page,line,'enr_type',enr,'enr:type-context',0.90,'',{excerpt:enrCtx.slice(0,420)})); }

    let fan=findFirstMatch(base,FAN_TYPES), fanCtx=base; if(!fan && /brasseur|ventilateur\s+de\s+plafond|hvls/i.test(baseLow)){ fanCtx=normalizeText(`${base} | ${next}`); fan=findFirstMatch(fanCtx,FAN_TYPES); } if(fan){ push(out,occ(doc,page,line,'fan_type',fan,'comfort:fan-type',0.94,'',{excerpt:fanCtx.slice(0,420)})); const m=fanCtx.match(/(?:nombre|nb\.?)\s*(?:de\s+)?(?:brasseurs?|ventilateurs?\s+de\s+plafond)\s*[:=\-]?\s*(\d+)/i)||fanCtx.match(/(\d+)\s+(?:brasseurs?|ventilateurs?\s+de\s+plafond)/i); if(m) push(out,occ(doc,page,line,'fan_count',parseInt(m[1],10),'comfort:fan-count',0.94,'',{excerpt:fanCtx.slice(0,420)})); }
  }} return out;
}

function parseDpe(doc){
  const out=[]; const name=normLower(doc.name);
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){ const line=lines[i], ctx=normalizeText(lineWindow(page,i,1,2)); if(!/dpe|classe\s+(?:energie|energetique|ges|climat)|etiquette\s+(?:energie|climat)|performance\s+energetique/i.test(normLower(ctx))) continue;
    const explicit=ctx.match(/(?:classe|etiquette)\s*(?:dpe\s*)?(?:energie|energetique|climat|ges)?\s*[:=\-]?\s*([A-G])\b/i)||ctx.match(/\b(?:energie|energetique|ges|climat)\s*[:=\-]\s*([A-G])\b/i); if(!explicit) continue;
    const letter=explicit[1].toUpperCase(), ges=/ges|climat|gaz\s+a\s+effet/i.test(normLower(ctx)), before=/avant|initial|existant|audit/.test(normLower(`${name} ${ctx}`)), after=/apres|final|reception|post[- ]travaux/.test(normLower(`${name} ${ctx}`)); if(!before&&!after) continue;
    const field=after?(ges?'dpe_ges_after':'dpe_energy_after'):(ges?'dpe_ges_before':'dpe_energy_before'); push(out,occ(doc,page,line,field,letter,'dpe:explicit-class-phase',0.94,'',{excerpt:ctx.slice(0,420)}));
  }} return out;
}

function parseCarbon(doc){
  const out=[]; const mappings=[
    ['ic_energy_heating',/ic\s*energie[^|]{0,45}chauffage/i],['ic_energy_cooling',/ic\s*energie[^|]{0,45}(?:refroid|froid)/i],['ic_energy_ecs',/ic\s*energie[^|]{0,45}(?:ecs|eau\s+chaude)/i],
    ['ic_energy_aux_vent',/ic\s*energie[^|]{0,60}auxiliaires?[^|]{0,25}ventil/i],['ic_energy_aux_dist',/ic\s*energie[^|]{0,60}auxiliaires?[^|]{0,25}distribution/i],['ic_energy_mobility',/ic\s*energie[^|]{0,60}(?:deplacements?|ascenseurs?|escalators?|parking)/i],
    ['ic_components',/ic\s*composants?(?:\s+batiment)?/i],['ic_site',/ic\s*chantier/i],['ic_energy',/ic\s*[eé]nergie(?:\s+batiment)?/i]
  ];
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){ const line=lines[i], ctx=normalizeText(lineWindow(page,i,1,2));
    for(const [f,re] of mappings){ if(re.test(ctx)){ const v=firstValueAfterLabel(ctx,re); const n=v!==null?v:numbersIn(ctx).at(-1); if(n!==null&&n!==undefined) push(out,occ(doc,page,line,f,n,'carbon:label-context',0.90,'kgCO2e/m²',{excerpt:ctx.slice(0,420)})); } }
    const lot=ctx.match(/(?:ic\s+composants?[^|]{0,25})?\blot\s*(1[0-3]|[1-9])\b/i); if(lot&&/ic|carbone|kg\s*co2/i.test(ctx)){ const n=numbersIn(ctx); if(n.length) push(out,occ(doc,page,line,`ic_lot_${lot[1]}`,n[n.length-1],'carbon:lot-context',0.90,'kgCO2e/m²',{excerpt:ctx.slice(0,420)})); }
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
function taggedLineMatch(raw,def){
  const src=String(raw??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim(), normalized=normalizeFieldHeader(src);
  if(!src||!normalized) return null;
  const tags=[...(def.tags||[])].sort((a,b)=>normalizeFieldHeader(b).length-normalizeFieldHeader(a).length);
  for(const tag of tags){
    const nt=normalizeFieldHeader(tag); if(!nt) continue;
    if(normalized===nt) return {value:null,tag,exact:true};
    if(normalized.startsWith(nt)){
      // Le libellé doit être suivi d'un vrai séparateur ou d'un espacement de tableau.
      const approx=src.slice(Math.min(src.length,tag.length));
      if(/^\s*(?::|=|\||;|\-|–|—)\s*/.test(approx)) return {value:taggedValue(def,approx.replace(/^\s*(?::|=|\||;|\-|–|—)\s*/,'')),tag,exact:true};
      // Cas OCR : le séparateur peut disparaître mais le reste commence clairement par une valeur.
      if(def.type==='number'&&/^\s+[-+]?\d/.test(approx)) return {value:taggedValue(def,approx),tag,exact:true};
    }
  }
  return null;
}
function taggedPresence(raw,def){
  if(!def.presence) return null;
  const n=normalizeFieldHeader(raw); if(!n) return null;
  for(const tag of def.tags||[]){
    const t=normalizeFieldHeader(tag); if(t.length<3||!n.includes(t)) continue;
    const explicitSelected=/(?:retenu|retenue|choisi|choisie|selection|sélection|mention|label|option|exigence)/i.test(raw);
    const negated=new RegExp(`(?:non|sans|aucun(?:e)?|pas\\s+de|non\\s+retenu(?:e)?|non\\s+choisi(?:e)?)\\s+[^|;,]{0,28}${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`,'i').test(normalizeFieldHeader(raw));
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
function parseTaggedFields(doc){
  if(doc.read?.kind==='spreadsheet') return parseTaggedSpreadsheet(doc);
  const out=[];
  for(const page of doc.read?.pages||[]){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], raw=String(line.text??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
      for(const def of FIELD_DEFS){
        if(def.key==='building') continue;
        const hit=taggedLineMatch(raw,def);
        if(hit){
          let value=hit.value;
          if(value===null && def.presence) value='Oui';
          if(value===null){
            // Valeur sur la ligne suivante, fréquent dans les formulaires PDF.
            const next=String(lines[i+1]?.text??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
            if(next && !FIELD_DEFS.some(f=>taggedLineMatch(next,f))) value=taggedValue(def,next);
          }
          if(value!==null&&value!=='') push(out,occ(doc,page,line,def.key,value,'tags:label-value',.915,'',{origin:`${doc.type} — libellé structuré`,provenanceNote:`Champ reconnu par le tag « ${hit.tag} ».`}));
          continue;
        }
        const presence=taggedPresence(raw,def);
        if(presence) push(out,occ(doc,page,line,def.key,presence.value,'tags:presence',presence.confidence,'',{origin:`${doc.type} — mention détectée`,provenanceNote:`Mention reconnue par le tag « ${presence.tag} »${presence.confidence<.9?' ; validation conseillée.':''}`}));
      }
    }
  }
  return out;
}

export function parseDocument(doc){
  let out=[];
  out.push(...parseTaggedFields(doc));
  // Surface bâtiment générique : SHAB, Sref/SRéf, surface habitable, surface du bâtiment, SU/SURT/SRT.
  if(doc.type!==DOC_TYPES.DPGF) out.push(...parseBuildingSurface(doc));
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(doc.type)) out.push(...parseRset(doc));
  if([DOC_TYPES.RT2012,DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL,DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV].includes(doc.type)) out.push(...parseGenericRegulatory(doc));
  if([DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL].includes(doc.type)) out.push(...parseThermalStudy(doc));
  out.push(...parseProgram(doc),...parseEnvelope(doc),...parseSystems(doc));
  if(doc.type===DOC_TYPES.DPE||/\bdpe\b/i.test(doc.read.text)) out.push(...parseDpe(doc));
  if([DOC_TYPES.CARBON,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RSENV].includes(doc.type)||/ic\s*(?:composants?|composant|energie|énergie|construction|chantier)/i.test(doc.read.text)) out.push(...parseCarbon(doc));
  // Un RSENV/ACV peut être classé « Étude carbone / ACV » tout en utilisant exactement
  // les tableaux détaillés RSEE (lots 1 à 13 + Énergie CE). On applique donc le même parseur.
  if([DOC_TYPES.CARBON,DOC_TYPES.RSENV].includes(doc.type)) addRsetCarbonBreakdown(doc,out);
  return out.filter(Boolean);
}
