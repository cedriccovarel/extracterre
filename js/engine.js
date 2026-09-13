import {FIELD_DEFS,FIELD_MAP,FIELD_TAGS,REQUIRED_RSET_FIELDS,REQUIRED_RE2020_RSET_FIELDS,REQUIRED_RT2012_RSET_FIELDS,DOC_TYPES,MIN_RETAINED_CONFIDENCE,MIN_REVIEW_CONFIDENCE,DEFAULT_SOURCE_RULES,matchFieldByHeader} from './config.js';
import {sourceTier,sourceRank} from './routing.js';
import {formatValue,normLower,normalizeText,scoreTokens,unique,numbersIn,maskNonDataNumerics,normalizeGlazingType} from './utils.js';
import {operationNameFromFiles,detectBuildings,buildingMergeKey,buildingCoreId,buildingSimilarity,canonicalBuilding,buildingForPosition} from './buildings.js';
import {parseDocument} from './parsers.js';
import {INSULATION_LIBRARY_VARIANT_COUNT,CORE_INSULATION_VARIANT_COUNT} from './insulation-library.js';
import {buildProjectTags} from './tags.js';
import {classifyDocument} from './classifier.js';
import {shouldOcrPdfPage} from './readers.js';

function valueKey(v){ return typeof v==='number'?v.toFixed(6):normLower(v); }
export function routeAndDeduplicate(raw,rules){
  // Normalisation transversale : quelle que soit la source (RSET, CCTP, Excel, manuel),
  // le résultat Menuiseries vitrage privilégie la composition technique 4.16.4 Ar.
  const normalizedRaw=raw.map(o=>o?.field==='window_glazing'?{...o,value:normalizeGlazingType(o.value)||o.value}:o);
  let routed=normalizedRaw.map(o=>({...o,sourceTier:o.userValidated?'main':sourceTier(o.field,o.docType,rules),sourceRank:o.userValidated?-1:sourceRank(o.field,o.docType,rules)})).map(o=>{ if(o.userValidated) return {...o,confidence:1,sourceTier:'main',sourceRank:-1}; const adj=o.libraryDerived?(o.sourceTier==='main'?0:o.sourceTier==='secondary'?-0.03:o.sourceTier==='forbidden'?-0.5:-0.10):(o.sourceTier==='main'?0.05:o.sourceTier==='secondary'?-0.03:o.sourceTier==='forbidden'?-0.5:-0.10); return {...o,confidence:Math.max(0,Math.min(1,o.confidence+adj))}; });
  const agreement=new Map();
  for(const o of routed){ const k=[o.field,valueKey(o.value),o.building].join('|'); if(!agreement.has(k)) agreement.set(k,new Set()); agreement.get(k).add(o.docId); }
  routed=routed.map(o=>{ const n=agreement.get([o.field,valueKey(o.value),o.building].join('|'))?.size||1; const boost=n>=3?0.05:n>=2?0.03:0; return {...o,confidence:Math.max(0,Math.min(1,o.confidence+boost)),agreementSources:n}; });
  const seen=new Map();
  for(const o of routed){ const k=[o.field,valueKey(o.value),o.building,o.docId,o.page,o.excerpt].join('|'); const prev=seen.get(k); if(!prev||o.confidence>prev.confidence) seen.set(k,o); }
  return [...seen.values()];
}


function resolveManualBuilding(name,manual={}){
  let cur=name, guard=0;
  while(manual?.[cur] && manual[cur]!==cur && guard++<12) cur=manual[cur];
  return manual?.[cur]||cur;
}

export function buildBuildingGrouping(docs,rawOccurrences=[],manualOverrides={}){
  const docNames=unique(docs.flatMap(d=>d.buildings?.names||[])).filter(Boolean);
  const occNames=unique(rawOccurrences.map(o=>o.building)).filter(Boolean);
  const names=unique([...docNames,...occNames]).filter(b=>b!=='Bâtiment unique');
  const authoritative=unique(docs.filter(d=>[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV].includes(d.type)).flatMap(d=>d.buildings?.names||[])).filter(b=>b&&b!=='Bâtiment unique');
  const aliasMap={}; const modes={};

  const authByCore=new Map();
  for(const a of authoritative){ const c=buildingCoreId(a); if(!c) continue; const list=authByCore.get(c)||[]; list.push(a); authByCore.set(c,list); }
  const allByKey=new Map();
  for(const n of names){ const k=buildingMergeKey(n); if(!k) continue; const list=allByKey.get(k)||[]; list.push(n); allByKey.set(k,list); }

  for(const n of names){
    let target=n, mode='distinct';
    const core=buildingCoreId(n), key=buildingMergeKey(n);
    const auth=core?authByCore.get(core)||[]:[];
    if(auth.length===1){ target=auth[0]; mode=target===n?'rset-master':'auto-rset'; }
    else if(key && (allByKey.get(key)||[]).length>1){
      const group=allByKey.get(key); const master=group.find(x=>authoritative.includes(x))||group.slice().sort((a,b)=>a.length-b.length)[0];
      target=master; mode=target===n?'auto-master':'auto-exact';
    }
    const manualTarget=manualOverrides?.[n]||manualOverrides?.[target];
    if(manualTarget){ target=resolveManualBuilding(manualTarget,manualOverrides); mode='manual'; }
    aliasMap[n]=target;
    modes[n]=mode;
  }

  // Une cible manuelle peut elle-même correspondre à une variante typographique d'un maître RSET.
  for(const [n,t0] of Object.entries(aliasMap)){
    let t=resolveManualBuilding(t0,manualOverrides);
    const core=buildingCoreId(t), auth=core?authByCore.get(core)||[]:[];
    if(modes[n]!=='manual'&&auth.length===1) t=auth[0];
    aliasMap[n]=t;
  }

  const canonicalNames=unique(names.map(n=>aliasMap[n]||n));
  const suggestions=[];
  for(let i=0;i<canonicalNames.length;i++) for(let j=i+1;j<canonicalNames.length;j++){
    const a=canonicalNames[i], b=canonicalNames[j], score=buildingSimilarity(a,b);
    if(score>=.72 && score<.98) suggestions.push({a,b,score});
  }
  suggestions.sort((a,b)=>b.score-a.score);
  const aliases=names.map(source=>({source,target:aliasMap[source]||source,mode:modes[source]||'distinct'}));
  return {aliasMap,aliases,authoritative,canonicalNames,suggestions,manualOverrides:{...manualOverrides}};
}

function mappedBuilding(name,grouping){
  if(name==='Bâtiment unique') return name;
  return grouping?.aliasMap?.[name]||name;
}

export function consolidate(docs,occurrences,rules,operationName='',grouping=null){
  const operation=operationName||operationNameFromFiles(docs);
  const detected=unique(docs.flatMap(d=>(d.buildings?.names||['Bâtiment unique']).map(b=>mappedBuilding(b,grouping))));
  const fromOcc=unique(occurrences.map(o=>o.building)).filter(Boolean);
  const explicit=unique([...detected,...fromOcc]).filter(b=>b!=='Bâtiment unique');
  const buildings=explicit.length?explicit:['Bâtiment unique'];
  const finals=[]; const rows=[];

  // Index field+bâtiment : l'ancienne consolidation refiltrait toutes les occurrences pour chacun
  // des 167 champs et chacun des bâtiments. Avec plusieurs centaines de dossiers cela pouvait
  // bloquer le thread principal plusieurs secondes.
  const byFieldBuilding=new Map();
  for(const o of occurrences){
    const key=`${o.field}|${o.building||'Bâtiment unique'}`;
    const list=byFieldBuilding.get(key); if(list) list.push(o); else byFieldBuilding.set(key,[o]);
  }
  const candidatesFor=(field,building)=>{
    const exact=byFieldBuilding.get(`${field}|${building}`)||[];
    if(building==='Bâtiment unique') return exact;
    const global=byFieldBuilding.get(`${field}|Bâtiment unique`)||[];
    return global.length?exact.concat(global):exact;
  };

  for(const building of buildings){
    const row={building};
    for(const f of FIELD_DEFS){
      if(f.key==='building') continue;
      const candidates=candidatesFor(f.key,building).filter(o=>o.sourceTier!=='forbidden');
      if(!candidates.length) continue;
      const eligible=candidates.filter(o=>o.confidence>=MIN_RETAINED_CONFIDENCE);
      const main=eligible.filter(o=>o.sourceTier==='main'); const secondary=eligible.filter(o=>o.sourceTier==='secondary');
      // v1.1.13 : une source non routée ne remplit plus automatiquement le tableau final.
      // Elle reste disponible dans la file « À vérifier » pour éviter les faux positifs.
      let pool=main.length?main:secondary;
      if(!pool.length) continue;
      const insulationField=/^(?:wall|floor|roof)_insulation(?:_|$)/.test(f.key);
      const directRset=insulationField?pool.filter(o=>!o.libraryDerived&&[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020].includes(o.docType)):[];
      if(directRset.length) pool=directRset;
      else { const directPool=pool.filter(o=>!o.libraryDerived); if(directPool.length) pool=directPool; }
      pool=[...pool].sort((a,b)=>{
        const ar=Number.isFinite(a.sourceRank)?a.sourceRank:sourceRank(f.key,a.docType,rules), br=Number.isFinite(b.sourceRank)?b.sourceRank:sourceRank(f.key,b.docType,rules);
        if(ar!==br) return ar-br;
        if(f.key==='shab'){ const ap=Number(a.surfacePriority)||0, bp=Number(b.surfacePriority)||0; if(ap!==bp) return bp-ap; }
        return b.confidence-a.confidence;
      });
      let chosen=pool[0];
      if(f.key==='dh') { const dhRows=pool.filter(o=>o.method==='rset:dh-row'); const numeric=(dhRows.length?dhRows:pool).filter(o=>typeof o.value==='number'); if(numeric.length) chosen=numeric.sort((a,b)=>b.value-a.value)[0]; }
      row[f.key]=chosen.value; finals.push({...chosen,status:'retenu',operation});
    }
    if(row.operation===undefined) row.operation=operation;
    if(row.operation_name===undefined&&operationName) row.operation_name=operationName;
    rows.push(row);
  }

  const finalIds=new Set(finals.map(o=>[o.field,o.building,o.docId,o.page,o.excerpt,valueKey(o.value)].join('|')));
  const directFinalExact=new Set(), directFinalGlobal=new Set();
  for(const f of finals){
    if(f.libraryDerived) continue;
    if(f.building==='Bâtiment unique') directFinalGlobal.add(f.field);
    else directFinalExact.add(`${f.field}|${f.building}`);
  }
  const detailed=occurrences.map(o=>{
    const retained=finalIds.has([o.field,o.building,o.docId,o.page,o.excerpt,valueKey(o.value)].join('|'));
    const directWinner=!retained&&o.libraryDerived&&(directFinalGlobal.has(o.field)||directFinalExact.has(`${o.field}|${o.building}`));
    return {...o,status:retained?'retenu':'rejeté',rejectionReason:retained?'':(o.sourceTier==='unrouted'?'Source non autorisée pour remplissage automatique':o.confidence<MIN_RETAINED_CONFIDENCE?`Confiance < ${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`:directWinner?'Valeur documentaire directe prioritaire sur la bibliothèque':'Non retenu après consolidation')};
  });
  return {operation,buildings,rows,finals,detailed,buildingAliases:grouping?.aliases||[],buildingSuggestions:grouping?.suggestions||[],authoritativeBuildings:grouping?.authoritative||[],buildingOverrides:grouping?.manualOverrides||{}};
}

export function diagnostics(docs,finals,grouping=null){
  const alerts=[];
  for(const d of docs){
    const standardized=/recapitulatif\s+standardise\s+d['’]?etude\s+thermique|r[eé]capitulatif\s+standardis[eé]\s+d['’]?etude\s+thermique/i.test(normLower(d.read?.text||''));
    if(![DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(d.type) || (d.type===DOC_TYPES.RT2012&&!standardized)) continue;
    const rawBs=d.buildings?.names||['Bâtiment unique']; const bs=rawBs.map(b=>mappedBuilding(b,grouping));
    if(d.buildings?.expectedCount && rawBs.length!==d.buildings.expectedCount) alerts.push({level:'error',docId:d.id,fileName:d.name,message:`Découpage bâtiments incomplet : le RSET annonce ${d.buildings.expectedCount} bâtiment(s)/zone(s), mais ${rawBs.length} identifiant(s) bâtiment ont été détectés.`});
    const required=expectedFieldsForDocument(d);
    for(const b of bs){
      let found=0;
      for(const field of required){ const ok=finals.some(o=>o.docId===d.id&&o.field===field&&(o.building===b||bs.length===1)); if(ok) found++; else alerts.push({level:'warning',docId:d.id,fileName:d.name,building:b,field,message:`RSET incomplet — ${b} : ${FIELD_MAP[field].label} absent ou confiance < ${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`}); }
      if(found<required.length) alerts.push({level:'warning',docId:d.id,fileName:d.name,building:b,message:`Complétude réglementaire ${b} : ${found}/${required.length} champs structurés obligatoires.`});
    }
  }
  for(const d of docs){ if(d.read?.kind==='pdf'&&d.read.text.replace(/\s/g,'').length<40) alerts.push({level:'warning',docId:d.id,fileName:d.name,message:'PDF sans couche texte exploitable — OCR probablement nécessaire.'}); if(d.error) alerts.push({level:'error',docId:d.id,fileName:d.name,message:d.error}); }
  return alerts;
}


function expectedFieldsForDocument(doc){
  const text=normLower(doc?.read?.text||'');
  if(doc.type===DOC_TYPES.RT2012) return [...REQUIRED_RT2012_RSET_FIELDS];
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020].includes(doc.type)){
    const base=[...REQUIRED_RE2020_RSET_FIELDS];
    if(/ic\s*(?:composants?|construction)|(?:1\s*[-–—]\s*vrd)|energie\s*\(\s*ce\s*\)/i.test(text)) base.push('ic_components','ic_energy','ic_site',...Array.from({length:13},(_,i)=>`ic_lot_${i+1}`));
    return unique(base);
  }
  if([DOC_TYPES.RSENV,DOC_TYPES.CARBON].includes(doc.type)) return ['ic_components','ic_site',...Array.from({length:13},(_,i)=>`ic_lot_${i+1}`),'ic_energy'];
  return [];
}
function buildCompleteness(docs,finals,grouping){
  const checks=[]; let expected=0,found=0;
  for(const d of docs){
    const fields=expectedFieldsForDocument(d); if(!fields.length) continue;
    const rawBs=d.buildings?.names||['Bâtiment unique']; const buildings=rawBs.map(b=>mappedBuilding(b,grouping));
    for(const building of buildings){
      const missing=[]; let ok=0;
      for(const field of fields){
        const hit=finals.some(o=>o.field===field&&(o.building===building||o.building==='Bâtiment unique'||buildings.length===1));
        if(hit) ok++; else missing.push(field);
      }
      expected+=fields.length; found+=ok; checks.push({docId:d.id,fileName:d.name,docType:d.type,building,found:ok,expected:fields.length,missing});
    }
  }
  return {found,expected,missing:Math.max(0,expected-found),percent:expected?Math.round(found/expected*100):null,checks};
}
function buildUncertain(detailed=[]){
  const best=new Map();
  for(const o of detailed){
    if(o.sourceTier==='forbidden'||o.confidence<MIN_REVIEW_CONFIDENCE) continue;
    // Les candidats non routés restent à vérifier même au-dessus de 90 % :
    // une bonne ressemblance textuelle ne remplace pas une source métier autorisée.
    if(o.sourceTier!=='unrouted'&&o.confidence>=MIN_RETAINED_CONFIDENCE) continue;
    const k=`${o.building}|${o.field}`; const prev=best.get(k);
    const rank=o.sourceRank??999, prevRank=prev?.sourceRank??999;
    if(!prev||rank<prevRank||(rank===prevRank&&o.confidence>prev.confidence)) best.set(k,o);
  }
  return [...best.values()].sort((a,b)=>b.confidence-a.confidence);
}

export function analyzeDocuments(docs,rules,operationName='',buildingOverrides={},extraOccurrences=[]){
  const raw=[...(extraOccurrences||[])]; let newlyParsedCount=0, reusedParsedCount=0;
  for(const d of docs){
    if(Array.isArray(d.cachedOccurrences)){ raw.push(...d.cachedOccurrences); reusedParsedCount++; continue; }
    const parsed=parseDocument(d); d.cachedOccurrences=parsed; d.analysisCachedAt=Date.now(); raw.push(...parsed); newlyParsedCount++;
  }
  const grouping=buildBuildingGrouping(docs,raw,buildingOverrides);
  const remappedRaw=raw.map(o=>{ const mapped=mappedBuilding(o.building,grouping); return {...o,originalBuilding:o.originalBuilding||o.building,building:mapped}; });
  const occurrences=routeAndDeduplicate(remappedRaw,rules); const consolidated=consolidate(docs,occurrences,rules,operationName,grouping); const alerts=diagnostics(docs,consolidated.finals,grouping);
  if(grouping.suggestions?.length) alerts.push({level:'warning',message:`${grouping.suggestions.length} rapprochement(s) de bâtiments ambigu(s) sont proposés à la vérification manuelle.`});
  const completeness=buildCompleteness(docs,consolidated.finals,grouping);
  const uncertain=buildUncertain(consolidated.detailed);
  return {...consolidated,occurrences,alerts,grouping,completeness,uncertain,newlyParsedCount,reusedParsedCount};
}

export function freeSearch(docs,query){
  const rawQuery=query.trim(); if(!rawQuery) return [];
  const qlow=normLower(rawQuery);
  const surfaceQuery=/\b(?:shab|sref|surt|srt|surface)\b/.test(qlow);
  const cepQuery=/\bcep\b|cep\s*,?\s*nr/.test(qlow);
  const icEnergyQuery=/\bic\s*(?:energie|énergie)\b|icenergie/.test(qlow);
  const icComponentsQuery=/\bic\s*composants?\b|iccomposant/.test(qlow);
  const icQuery=icEnergyQuery||icComponentsQuery||/^\s*ic\s*$/.test(qlow);

  let variants=[rawQuery];
  if(surfaceQuery) variants.push('shab','sref','surface habitable','surface de référence','surface utile','surt','srt','surface du bâtiment');
  else {
    const synonymGroups={
      toiture:['toiture','plancher haut','combles'],facade:['facade','mur','paroi verticale'],chaudiere:['chaudiere','chauffage'],isolation:['isolation','isolant','thermique']
    };
    for(const [key,arr] of Object.entries(synonymGroups)) if(qlow.includes(key)) variants.push(...arr);
  }
  if(cepQuery) variants.push('cep','coefficient cep','consommations annuelles par poste');
  if(icEnergyQuery) variants.push('ic énergie','ic energie','energie ce','énergie ce');
  else if(icComponentsQuery) variants.push('ic composants','iccomposant');
  else if(icQuery) variants.push('ic','carbone','acv');
  const uniqueVariants=[...new Set(variants.map(v=>normLower(v)).filter(Boolean))];

  const variantScore=(variant,text)=>{
    const vt=variant.split(/[^a-z0-9]+/).filter(x=>x.length>1||x==='ic'); if(!vt.length) return 0;
    const tt=new Set(normLower(text).split(/[^a-z0-9]+/).filter(Boolean));
    return vt.reduce((n,t)=>n+(tt.has(t)?1:0),0)/vt.length;
  };
  const surfacePositive=t=>/\bshab\b|\bs\s*ref\b|\bsref\b|\bsurt\b|\bsrt\b|\bshonrt\b|surface\s+(?:habitable|utile|r[eé]glementaire|thermique|totale\s+(?:du\s+)?b[aâ]timent|(?:de\s+)?reference|(?:de\s+)?référence|(?:totale\s+)?du\s+batiment|(?:totale\s+)?du\s+bâtiment|de\s+plancher)/i.test(t);
  const surfaceNoise=t=>/ratio\s*1\s*\/\s*6|surface\s+(?:de\s+)?(?:parcelle|vegetalis|végétalis|arrosee|arrosée|impermeabilis|imperméabilis|facade|façade|baie|paroi|plancher\s+(?:haut|bas)|toiture|mur|isolant)|temperature\s+de\s+surface|température\s+de\s+surface|surface\s+(?:totale\s+)?d[eé]perditive|(?:kwhep|kwh|w|kg[^|]{0,12})\s*\/\s*m(?:2|²)\s*(?:shab|sref|surt|srt)\b/i.test(t);
  const surfaceRelevant=t=>surfacePositive(t)&&!surfaceNoise(t);
  const surfaceDataSegment=t=>surfaceRelevant(t)
    && /(?:m(?:2|²)|[:=]\s*[-+]?\d)/i.test(t)
    && !/(?:w\s*\/|kwh\s*\/|kg\s*(?:eq\.?\s*)?co2\s*\/|ratio|q4pa|d[eé]perdition|coefficient|seuil|max(?:imum)?\b)/i.test(t);
  const intentRelevant=t=>{
    if(surfaceQuery) return String(t).split('|').some(seg=>surfaceRelevant(seg));
    if(icEnergyQuery) return /\bic\s*(?:energie|énergie)\b|icenergie|energie\s*\(\s*ce\s*\)|énergie\s*\(\s*ce\s*\)/i.test(t);
    if(icComponentsQuery) return /\bic\s*composants?\b|iccomposant/i.test(t);
    if(icQuery) return /\bic\b|iccomposant|icenergie|\bacv\b|kg\s*(?:eq\.?\s*)?co2/i.test(t);
    if(cepQuery) return /\bcep\b|consommations?\s+annuelles?\s+par\s+poste/i.test(t);
    return true;
  };
  const probableNumber=(current,context)=>{
    const segments=String(context).split('|').map(x=>x.trim()).filter(Boolean);
    const safeCurrent=maskNonDataNumerics(current), safeContext=maskNonDataNumerics(context);
    let nums=numbersIn(safeCurrent); if(!nums.length) nums=numbersIn(safeContext);
    if(surfaceQuery){
      // Prendre la valeur sur le segment portant réellement le libellé de surface,
      // pas un numéro d'article situé sur la ligne voisine.
      const surfaceSegment=segments.find(seg=>surfaceDataSegment(seg)&&numbersIn(maskNonDataNumerics(seg)).some(v=>v>20&&v<250000));
      if(!surfaceSegment) return null;
      const clean=normalizeText(maskNonDataNumerics(surfaceSegment));
      const explicitPatterns=[
        /\bshab(?:\s*(?:\/|ou)\s*(?:su|surt))?\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i,
        /\bs\s*ref(?:\s*\/\s*usage\s+principal)?\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i,
        /\bsref(?:\s*\/\s*usage\s+principal)?\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i,
        /surface\s+(?:habitable|utile|r[eé]glementaire|thermique|(?:totale\s+)?du\s+b[aâ]timent|de\s+plancher|(?:de\s+)?r[eé]f[eé]rence)[^0-9]{0,35}([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i,
        /\b(?:surt|srt|shonrt)\b\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i
      ];
      for(const re of explicitPatterns){ const m=clean.match(re); if(m){ const v=Number(String(m[1]).replace(/\s/g,'').replace(',','.')); if(v>20&&v<250000) return v; } }
      const vals=numbersIn(clean).filter(v=>v>20&&v<250000);
      return vals[0]??null;
    }
    if(cepQuery){
      const wantsNr=/cep\s*,?\s*nr|cepnr/.test(qlow), wantsMax=/\bmax\b/.test(qlow);
      const coeffLine=segments.find(x=>/coefficients?\s+cep\s*\/\s*cep\s*(?:max)?/i.test(x));
      const coeffNums=numbersIn(maskNonDataNumerics(coeffLine||'')).filter(v=>v>=-100&&v<5000);
      if(coeffLine && coeffNums.length>=4){
        if(wantsNr&&wantsMax) return coeffNums[3];
        if(wantsNr) return coeffNums[2];
        if(wantsMax) return coeffNums[1];
        return coeffNums[0];
      }
      // Lignes de synthèse RE2020 : « Cep 45,5 80,5 43,48 » / « Cep,nr 45,5 59 22,88 ».
      const rowRe=wantsNr?/^\s*cep\s*,?\s*nr\b/i:/^\s*cep\b(?!\s*,?\s*nr)/i;
      const row=segments.find(x=>rowRe.test(normalizeText(x)));
      if(row){
        const vals=numbersIn(maskNonDataNumerics(row)).filter(v=>v>=-100&&v<5000);
        if(vals.length){ if(wantsMax&&vals.length>=2) return vals[1]; return vals[0]; }
      }
      // Recherche par poste : refroidissement, éclairage, auxiliaires, déplacements...
      const postPatterns=[];
      if(/refroid|clim|froid/.test(qlow)) postPatterns.push(/refroid|clim|froid/i);
      if(/eclairage|éclairage/.test(qlow)) postPatterns.push(/eclairage|éclairage/i);
      if(/aux.*vent|ventilat/.test(qlow)) postPatterns.push(/aux.*vent|ventilat/i);
      if(/aux.*dist|distribution/.test(qlow)) postPatterns.push(/aux.*dist|distribution/i);
      if(/deplacement|déplacement|ascenseur|mobilite|mobilité/.test(qlow)) postPatterns.push(/deplacement|déplacement|ascenseur|mobilite|mobilité/i);
      if(postPatterns.length){
        const rowPost=segments.find(x=>postPatterns.some(re=>re.test(x))&&numbersIn(maskNonDataNumerics(x)).length);
        if(rowPost){ const vals=numbersIn(maskNonDataNumerics(rowPost)).filter(v=>v>=0&&v<5000); if(vals.length) return vals[vals.length-1]; }
      }
      // Sans ligne Cep explicite, ne pas prendre un numéro d'article, une surface ou un millésime voisin.
      return null;
    }
    if(icComponentsQuery){
      const explicit=normalizeText(context).match(/\bic\s*composants?\s*(?:=|:)?\s*([-+]?\d+(?:[,.]\d+)?)/i)||normalizeText(context).match(/\biccomposant\s*(?:=|:)?\s*([-+]?\d+(?:[,.]\d+)?)/i);
      if(explicit) return parseFloat(explicit[1].replace(',','.'));
    }
    if(icEnergyQuery){
      const explicit=normalizeText(context).match(/\bic\s*(?:energie|énergie)\s*(?:=|:)?\s*([-+]?\d+(?:[,.]\d+)?)/i)||normalizeText(context).match(/\bicenergie\s*(?:=|:)?\s*([-+]?\d+(?:[,.]\d+)?)/i);
      if(explicit) return parseFloat(explicit[1].replace(',','.'));
      // Dans les tableaux ACV, l'intitulé « Energie (CE) » est souvent sur la ligne précédente
      // et la valeur du poste sur la ligne courante : le dernier nombre de la ligne est le total.
      const rowVals=numbersIn(safeCurrent).filter(v=>v>=0&&v<100000); if(rowVals.length) return rowVals[rowVals.length-1];
    }
    return nums.length?nums[nums.length-1]:null;
  };

  const results=[];
  for(const d of docs){
    for(const page of d.read?.pages||[]){
      const lines=page.lines||[];
      for(let i=0;i<lines.length;i++){
        const line=lines[i], text=line.text||'';
        // Une fenêtre élargie est nécessaire pour les tableaux PDF où l'intitulé de section
        // (ex. « ENERGIE (CE) » / « IC composants » / « SRef ») est séparé de la ligne de valeur.
        // On reste local à la page afin d'éviter de mélanger des tableaux éloignés.
        const context=lines.slice(Math.max(0,i-4),Math.min(lines.length,i+5)).map(x=>x.text||'').filter(Boolean).join(' | ');
        if(!intentRelevant(context)) continue;
        if(cepQuery && /chapitre\s+\d+.*cep/i.test(normLower(context)) && !/coefficients?\s+cep|consommations?\s+annuelles?/i.test(normLower(context))) continue;
        const baseScore=Math.max(0,...uniqueVariants.map(v=>variantScore(v,context))); if(baseScore<0.5) continue;
        const low=normLower(text); const headingLike=/^(?:chapitre|section|partie)\s+\d+\b|^\d+(?:\.\d+){1,}\.?\s+|logiciel\s+et\s+version|version\s*:/i.test(low);
        // En ACV, une ligne voisine peut contenir « IC énergie » alors que la ligne courante
        // n'est qu'un identifiant/numéro de section. On ne garde que les vraies lignes de
        // données énergie (libellé IC, poste, total, ou section Energie (CE)).
        if(icEnergyQuery && !/(?:\bic\s*(?:energie|énergie)\b|icenergie|energie\s*\(\s*ce\s*\)|énergie\s*\(\s*ce\s*\)|chauffage|refroidissement|\becs\b|eclairage|éclairage|auxiliaires?|ventilat(?:eur|ion)|distribution|deplacements?|déplacements?|ascenseur|parking|total\s+(?:lot|:))/i.test(text)) continue;
        const probable=headingLike?null:probableNumber(text,context);
        if(surfaceQuery && probable!==null){
          const validCarrier=String(context).split('|').map(x=>x.trim()).filter(Boolean).some(seg=>surfaceDataSegment(seg)&&numbersIn(maskNonDataNumerics(seg)).some(v=>Math.abs(v-probable)<1e-6));
          if(!validCarrier) continue;
        }
        if((surfaceQuery||cepQuery||icQuery) && probable===null) continue;
        if((cepQuery||icQuery) && headingLike && probable===null) continue;
        const numericBonus=probable!==null?.08:0, exactBonus=variantScore(qlow,context)>=.99?.06:0;
        const rank=baseScore+numericBonus+exactBonus-(headingLike?.18:0);
        const confidence=Math.min(.98,.46+baseScore*.46+numericBonus+exactBonus); if(confidence<MIN_RETAINED_CONFIDENCE) continue;
        results.push({value:probable??'—',numericValue:probable,document:d.name,docId:d.id,page:page.page,building:buildingForPosition(d,page.page,line.index),excerpt:normalizeText(context).slice(0,420),confidence,score:rank});
      }
    }
  }
  const seen=new Set();
  return results.sort((a,b)=>b.score-a.score||b.confidence-a.confidence).filter(x=>{ const k=`${x.docId}|${x.page}|${x.building}|${x.value}`; if(seen.has(k)) return false; seen.add(k); return true; }).slice(0,150);
}


export function runSelfTests(){
  const tests=[]; const assert=(name,ok,details='')=>tests.push({name,ok:!!ok,details});
  const mk=(text,type=DOC_TYPES.RSET_RE2020)=>({id:'test',name:'RSET_TEST.pdf',type,read:{pages:[{page:1,lines:text.split('\n').map((text,index)=>({text,index})),text}],text},buildings:{names:['Bâtiment A'],hits:[{building:'Bâtiment A',page:1,line:0}]}});
  const r=parseDocument(mk('Bâtiment A\nCoefficient Bbio | 43,8 | 65,9 | 33,5\nCoefficients Cep / Cepmax - Cep,nr / Cep,nrmax | 65 | 82,3 | 65 | 67,8 | 21 | 4,1\nDH = 988,2'));
  const get=f=>r.find(o=>o.field===f)?.value;
  assert('RSET Bbio',get('bbio')===43.8,`obtenu ${get('bbio')}`); assert('RSET Bbio Max',get('bbio_max')===65.9); assert('RSET Cep',get('cep')===65); assert('RSET Cep Max',get('cep_max')===82.3); assert('RSET Cepnr',get('cepnr')===65); assert('RSET Cepnr Max',get('cepnr_max')===67.8); assert('RSET DH',get('dh')===988.2);
  const t=parseDocument(mk('Bâtiment A\nT2 T3 T4',DOC_TYPES.RSET_RE2020)); assert('Typologies interdites dans parseur RSET',!t.some(o=>o.field==='housing_typologies'));
  assert('Colonnes numériques non concaténées',JSON.stringify(numbersIn('505 212 162 116'))===JSON.stringify([505,212,162,116]));
  assert('Vitrage Climawin feuilleté 8/16(argon)/44.2',normalizeGlazingType('8/16(argon)/44.2 Si')==='8.16.44.2 Ar');
  assert('Vitrage Climawin feuilleté 44.2/16(argon)/4',normalizeGlazingType('44.2/16(argon)/4')==='44.2.16.4 Ar');
  const dhTable=parseDocument(mk('Bâtiment A\nZone / Groupes SRef Indicateur degrés-heures (DH) en °C.h\nNb heures inconfort\nOui | 663,4 | 505 | 212 | 162 | 116 | Conforme\nNon | 475,1 | 791,4 | 266 | 211 | 164 | Conforme',DOC_TYPES.RSET_RE2020)); assert('Tableau DH réel',dhTable.some(o=>o.field==='dh'&&o.value===791.4)); assert('SHAB jamais calculée depuis le tableau DH',!dhTable.some(o=>o.field==='shab'));
  const shabDoc=mk('Bâtiment : Batiment A\nZone(s) du bâtiment Usage zone S (m²) Surface utile SU ou surf. hab. SHAB Nombre de groupes\nZone traversante\n604,1 604,1 1\nZone non traversante\n914,1 914,1 1\nNombre de logements 25',DOC_TYPES.RSET_RE2020); const shabParsed=parseDocument(shabDoc); assert('SHAB Chapitre 2 = somme colonne SHAB',shabParsed.some(o=>o.field==='shab'&&Math.abs(o.value-1518.2)<0.001),String(shabParsed.find(o=>o.field==='shab')?.value));
  const namedBuilding=mk('Bâtiment : BAT Fa - Bat de 3 MI accolés\nIdentifiant Bâtiment \"BAT Fa - Bat de 3 MI accolés\"',DOC_TYPES.RSET_RE2020); namedBuilding.buildings=detectBuildings(namedBuilding); assert('Nom bâtiment RSET descriptif conservé',namedBuilding.buildings.names.includes('Bâtiment FA - BAT DE 3 MI ACCOLES'),namedBuilding.buildings.names.join(', '));
  const detailDoc=mk('Bâtiment : Batiment B\nCoefficient Bbio | 50 | 70 | 28,6\nCoefficients Cep / Cepmax - Cep,nr / Cep,nrmax | 72 | 89,1 | 72 | 73,4 | 19,2 | 1,9\nBatiment B S : 1138,5 Consommations et productions annuelles du bâtiment par poste et par type d’énergie exprimée en énergie finale\nGaz FOD Bois Electricité Réseau de chaleur\nPoste de consommation Chauffage 0 0 0 16,8 0\nRefroidissement 0 0 0 1,1 0\nECS 0 0 0 9,3 0\nEclairage 1,9\nAuxiliaires VMC 0,5\nAuxiliaires distribution 0\nDéplacement 1,7\nS Consommations annuelles par poste en énergie finale\nCH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements Mobilier Prod. photovoltaïque Prod. cogénération Total annuel\nBâtiment (Batiment B) 1138,5 16,8 1,1 9,3 1,9 0,5 0 1,7 24,8 0 0 56,1\nS Consommations annuelles par poste en énergie finale\nGaz FOD Bois Electricité Réseau chaleur Prod. photovoltaïque Prod. cogénération Total annuel\nBâtiment (Batiment B) 1138,5 0 0 0 31,3 0 0 0 31,3',DOC_TYPES.RSET_RE2020); const detailParsed=parseDocument(detailDoc); assert('RSET sorties détaillées -> Cep éclairage',detailParsed.some(o=>o.field==='cep_lighting'&&Math.abs(o.value-4.37)<0.001),String(detailParsed.find(o=>o.field==='cep_lighting')?.value)); assert('RSET sorties détaillées -> Cep refroidissement',detailParsed.some(o=>o.field==='cep_cooling'&&Math.abs(o.value-2.53)<0.001),String(detailParsed.find(o=>o.field==='cep_cooling')?.value)); assert('RSET sorties détaillées -> Cep électricité',detailParsed.some(o=>o.field==='cep_electricity'&&Math.abs(o.value-71.99)<0.001),String(detailParsed.find(o=>o.field==='cep_electricity')?.value));
  const d=parseDocument(mk('Bâtiment A\nFaçade : laine de roche 160 mm R = 4,50',DOC_TYPES.CCTP)); assert('Isolant façade normalisé',d.some(o=>o.field==='wall_insulation'&&o.value==='Laine de roche')); assert('Épaisseur façade',d.some(o=>o.field==='wall_insulation_thickness'&&o.value===160)); assert('R façade',d.some(o=>o.field==='wall_insulation_r'&&o.value===4.5));
  const thresholdDoc={id:'threshold-test',name:'TEST.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment A']}};
  const thresholdOcc=[
    {field:'structure',value:'Sous seuil',building:'Bâtiment A',docId:'threshold-test',fileName:'TEST.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'test 89%',confidence:0.89,method:'test',sourceTier:'main'},
    {field:'ventilation',value:'Au seuil',building:'Bâtiment A',docId:'threshold-test',fileName:'TEST.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'test 90%',confidence:0.90,method:'test',sourceTier:'main'}
  ];
  const thresholdResult=consolidate([thresholdDoc],thresholdOcc,DEFAULT_SOURCE_RULES,'Test seuil');
  assert('Confiance < 90 % exclue',thresholdResult.rows[0].structure===undefined);
  assert('Confiance >= 90 % retenue',thresholdResult.rows[0].ventilation==='Au seuil');
  const rich=parseDocument(mk('Façade extérieure : doublage ITE ROCKMUR ép. 160 mm résistance thermique R = 4,50\nVentilation : VMC simple flux hygro B\nChauffage projet : chaudière gaz à condensation\nECS : chauffe-eau thermodynamique CET\nMenuiseries extérieures : châssis aluminium double vitrage faible émissivité, volets roulants',DOC_TYPES.CCTP));
  assert('Alias isolant produit -> Laine de roche',rich.some(o=>o.field==='wall_insulation'&&o.value==='Laine de roche'));
  assert('Contexte ITE épaisseur',rich.some(o=>o.field==='wall_insulation_thickness'&&o.value===160));
  assert('VMC hygro B élargie',rich.some(o=>o.field==='ventilation'&&o.value==='VMC Hygro B'));
  assert('Chaudière condensation élargie',rich.some(o=>o.field==='heating_mode_after'&&o.value==='Chaudière condensation'));
  assert('CET élargi',rich.some(o=>o.field==='ecs'&&o.value==='Chauffe-eau thermodynamique'));
  assert('Menuiserie alu élargie',rich.some(o=>o.field==='window_material'&&o.value==='Aluminium'));
  assert('Vitrage VIR élargi',rich.some(o=>o.field==='window_glazing'&&o.value==='Double vitrage VIR'));
  const program=parseDocument(mk('Construction de 53 logements\nA 001 T4 - 79,22 m²\nB 001 T3 - 65,74 m²\nB 004 T2 - 45,26 m²',DOC_TYPES.PLAN));
  assert('Nombre logements formulation construction de',program.some(o=>o.field==='housing_count'&&o.value===53));
  assert('Typologies plan agrégées',program.some(o=>o.field==='housing_typologies'&&/T2/.test(o.value)&&/T3/.test(o.value)&&/T4/.test(o.value)));
  const mixedText='Bâtiment A\nToiture terrasse : isolant TMS ép. 120 mm R = 5,45\nPlancher bas sur parking : laine de verre GR32 100 mm R = 3,15\nChauffage projet : chaudière gaz à condensation - gaz naturel\nECS projet : chauffe-eau thermodynamique CET - électricité';
  const mixedDoc=mk(mixedText,DOC_TYPES.CCTP); mixedDoc.name='CCTP_TEST.pdf';
  const mixedParsed=parseDocument(mixedDoc);
  assert('Contexte voisin sans contamination toiture/plancher',mixedParsed.some(o=>o.field==='roof_insulation'&&o.value==='PUR')&&!mixedParsed.some(o=>o.field==='roof_insulation'&&o.value==='Laine de verre'));
  assert('Bibliothèque cœur = 150 variantes demandées',CORE_INSULATION_VARIANT_COUNT===150,String(CORE_INSULATION_VARIANT_COUNT));
  assert('Bibliothèque isolants totale = 173 variantes',INSULATION_LIBRARY_VARIANT_COUNT===173,String(INSULATION_LIBRARY_VARIANT_COUNT));
  const mixedResult=analyzeDocuments([mixedDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test vocabulaire');
  assert('Détections contextuelles conservées à >= 90 %',mixedResult.rows[0].roof_insulation==='PUR'&&mixedResult.rows[0].heating_mode_after==='Chaudière condensation');
  const libDoc=mk('Façade extérieure ITE : Isover GR32 ép. 120 mm',DOC_TYPES.CCTP); libDoc.name='CCTP_LIBRARY.pdf'; const libResult=analyzeDocuments([libDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test bibliothèque');
  const libR=libResult.finals.find(o=>o.field==='wall_insulation_r'); assert('Fallback R bibliothèque avec produit + épaisseur',libR?.value===3.75&&libR?.libraryDerived===true,`${libR?.value} ${libR?.method}`);
  const directLibDoc=mk('Façade extérieure ITE : Isover GR32 ép. 120 mm R = 3,80',DOC_TYPES.CCTP); directLibDoc.name='CCTP_DIRECT.pdf'; const directLibResult=analyzeDocuments([directLibDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test priorité directe'); const directR=directLibResult.finals.find(o=>o.field==='wall_insulation_r'); assert('R direct prioritaire sur bibliothèque',directR?.value===3.8&&!directR?.libraryDerived,`${directR?.value} ${directR?.method}`);
  const sourcePriorityDocR={id:'rset-priority',name:'RSET.pdf',type:DOC_TYPES.RSET_RE2020,buildings:{names:['Bâtiment A']}};
  const sourcePriorityDocC={id:'cctp-priority',name:'CCTP.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment A']}};
  const sourcePriorityResult=consolidate([sourcePriorityDocR,sourcePriorityDocC],[{field:'wall_insulation_r',value:3.7,building:'Bâtiment A',docId:'rset-priority',fileName:'RSET.pdf',docType:DOC_TYPES.RSET_RE2020,page:1,excerpt:'RSET R=3,7',confidence:.91,method:'test:rset-direct',sourceTier:'main'},{field:'wall_insulation_r',value:3.8,building:'Bâtiment A',docId:'cctp-priority',fileName:'CCTP.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'CCTP R=3,8',confidence:.99,method:'test:cctp-direct',sourceTier:'main'}],DEFAULT_SOURCE_RULES,'Test priorité RSET');
  assert('Isolation directe RSET prioritaire',sourcePriorityResult.rows[0].wall_insulation_r===3.7,String(sourcePriorityResult.rows[0].wall_insulation_r));
  const fuzzyDoc=mk('Façade extérieure ITE : Pavaflx Confort ép. 120 mm',DOC_TYPES.CCTP); fuzzyDoc.name='CCTP_FUZZY.pdf'; const fuzzyResult=analyzeDocuments([fuzzyDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test fuzzy');
  assert('Nom produit proche / faute légère reconnu',fuzzyResult.rows[0].wall_insulation==='Fibre de bois'&&fuzzyResult.rows[0].wall_insulation_r===3.15,`${fuzzyResult.rows[0].wall_insulation} / ${fuzzyResult.rows[0].wall_insulation_r}`);
  const noThicknessDoc=mk('Façade extérieure ITE : Isover GR32',DOC_TYPES.CCTP); noThicknessDoc.name='CCTP_NO_THICKNESS.pdf'; const noThicknessResult=analyzeDocuments([noThicknessDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test pas invention');
  assert('Produit sans épaisseur : aucun R bibliothèque inventé',noThicknessResult.rows[0].wall_insulation_r===undefined,String(noThicknessResult.rows[0].wall_insulation_r));
  assert('ECS ne récupère pas le vecteur chauffage voisin',mixedResult.rows[0].ecs_vector_after==='Électricité');

  // RSET RT2012 multi-bâtiments : le registre Chapitre 2 doit créer exactement une ligne par identifiant.
  const multiText=`Nombre de bâtiments/zones du projet 4 ( Bât. 1 : 2 zones. Bât. 2 : 2 zones. Bât. 3 : 1 zone. Bât. 4 : 3 zones. )
Identifiant Bâtiment Bat 100
Identifiant Bâtiment Bat 200
Identifiant Bâtiment Bat 300
Identifiant Bâtiment Bat 400`;
  const multiDoc={id:'multi-rt',name:'RSET_RT2012.pdf',type:DOC_TYPES.RT2012,read:{pages:[{page:1,text:multiText,lines:multiText.split('\n').map((text,index)=>({text,index}))}],text:multiText}};
  multiDoc.buildings=detectBuildings(multiDoc);
  assert('RT2012 registre maître = 4 bâtiments',multiDoc.buildings.names.length===4&&multiDoc.buildings.expectedCount===4,multiDoc.buildings.names.join(', '));
  const multiConsolidated=consolidate([multiDoc],[],DEFAULT_SOURCE_RULES,'Multi');
  assert('RT2012 4 bâtiments = 4 lignes export',multiConsolidated.rows.length===4,String(multiConsolidated.rows.length));

  // En RT2012, les sorties détaillées sont déjà exprimées en énergie primaire : aucune conversion ×2,3.
  const epText=`Identifiant Bâtiment Bat 100
Résultats sorties détaillées
Bat 100
Consommations et productions annuelles du bâtiment par poste et par type d'énergie exprimée en énergie primaire (kWh ep/m2 SRT)
Gaz FOD Charbon Bois Electricité Réseau de chaleur
Chauffage 25,5 0 0 0 0,6 0
ECS 22,5 0 0 0 0,5 0
Eclairage 4,1
Auxiliaires VMC 1,3
Auxiliaires distribution 1,6
SRT m2 Consommations annuelles par poste en énergie primaire (kWh ep/m2 SRT)
Chauffage Refroid. ECS Eclairage Auxiliaires VMC Aux. distribution Prod. photov. Prod. cogénération Total annuel
Bâtiment (Bat 100) 947,3 26,1 0 23 4,1 1,3 1,6 0 0 56,1
SRT m2 Consommations annuelles par poste en énergie primaire (kWh ep/m2 SRT)
Gaz FOD Charbon Bois Electricité Réseau chaleur Prod. photov. Prod. cogénération Total annuel
Bâtiment (Bat 100) 947,3 48 0 0 0 8,2 0 0 0 56,2`;
  const epDoc={id:'ep-rt',name:'RSET_RT2012_EP.pdf',type:DOC_TYPES.RT2012,read:{pages:[{page:1,text:epText,lines:epText.split('\n').map((text,index)=>({text,index,items:[]}))}],text:epText}}; epDoc.buildings=detectBuildings(epDoc);
  const epParsed=parseDocument(epDoc);
  assert('RT2012 Cep détaillé primaire lu sans reconversion',epParsed.some(o=>o.field==='cep_lighting'&&o.value===4.1)&&epParsed.some(o=>o.field==='cep_electricity'&&o.value===8.2),`${epParsed.find(o=>o.field==='cep_lighting')?.value}/${epParsed.find(o=>o.field==='cep_electricity')?.value}`);

  // RE2020 : tableaux PDF fréquemment éclatés sur plusieurs lignes.
  const reSplitText=`Identifiant Bâtiment Batiment A
Résultats sorties détaillées - (Batiment A)
S Consommations annuelles par poste en énergie finale
CH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements Mobilier Prod. photovoltaïque Prod. cogénération Total annuel
Bâtiment
(Batiment A)
1169,1 10,4 4,7 7,8 2 0,6 0 0,1 24,8 0 0 50,4
S Consommations annuelles par poste en énergie finale
Gaz FOD Bois Electricité Réseau chaleur Prod. photovoltaïque Prod. cogénération Total annuel
Bâtiment (Batiment A) 1169,1 0 0 0 25,6 0 0 0 25,6
Bâtiment / Zone(s) S Coefficient Cep Coefficient Cep,nr
Bâtiment (Batiment A) 1169,1 72,3 59,6
Cep,nr Cep,nr_Max Gain en %
Cep,nr 59,6 67,5 11,7`;
  const reSplitDoc={id:'re-split',name:'RSET_RE2020_SPLIT.pdf',type:DOC_TYPES.RSET_RE2020,read:{pages:[{page:1,text:reSplitText,lines:reSplitText.split('\n').map((text,index)=>({text,index,items:[]}))}],text:reSplitText}}; reSplitDoc.buildings=detectBuildings(reSplitDoc);
  const reSplitParsed=parseDocument(reSplitDoc);
  assert('RE2020 ligne bâtiment éclatée -> Cep refroidissement',reSplitParsed.some(o=>o.field==='cep_cooling'&&Math.abs(o.value-10.81)<.001),String(reSplitParsed.find(o=>o.field==='cep_cooling')?.value));
  assert('RE2020 ligne bâtiment éclatée -> Cep éclairage',reSplitParsed.some(o=>o.field==='cep_lighting'&&Math.abs(o.value-4.6)<.001),String(reSplitParsed.find(o=>o.field==='cep_lighting')?.value));
  assert('RE2020 ligne bâtiment éclatée -> Cep auxiliaire ventilation',reSplitParsed.some(o=>o.field==='cep_aux_vent'&&Math.abs(o.value-1.38)<.001),String(reSplitParsed.find(o=>o.field==='cep_aux_vent')?.value));
  assert('RE2020 ligne bâtiment éclatée -> Cep auxiliaire distribution = 0',reSplitParsed.some(o=>o.field==='cep_aux_dist'&&o.value===0),String(reSplitParsed.find(o=>o.field==='cep_aux_dist')?.value));
  assert('RE2020 ligne bâtiment éclatée -> Cep déplacement occupants',reSplitParsed.some(o=>o.field==='cep_mobility'&&Math.abs(o.value-.23)<.001),String(reSplitParsed.find(o=>o.field==='cep_mobility')?.value));
  assert('RE2020 tableau coefficient -> Cep,nr',reSplitParsed.some(o=>o.field==='cepnr'&&o.value===59.6),String(reSplitParsed.find(o=>o.field==='cepnr')?.value));
  assert('RE2020 récapitulatif -> Cep,nr max',reSplitParsed.some(o=>o.field==='cepnr_max'&&o.value===67.5),String(reSplitParsed.find(o=>o.field==='cepnr_max')?.value));

  // Deux bâtiments successifs : les identifiants courts A/B ne doivent jamais se contaminer.
  const multiReText=`Identifiant Bâtiment Batiment A
Coefficients Cep / Cepmax - Cep,nr / Cep,nrmax 82,7 88,9 35,3 73,2 7 51,8
Résultats sorties détaillées - (Batiment A)
S Consommations annuelles par poste en énergie finale
CH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements Mobilier Prod. photovoltaïque Prod. cogénération Total annuel
Bâtiment (Batiment A) 1169,1 10,4 4,7 7,8 2 0,6 0 0,1 24,8 0 0 50,4
Identifiant Bâtiment Batiment B
Coefficients Cep / Cepmax - Cep,nr / Cep,nrmax 84,4 86,3 35,7 71,1 2,2 49,8
Résultats sorties détaillées - (Batiment B)
S Consommations annuelles par poste en énergie finale
CH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements Mobilier Prod. photovoltaïque Prod. cogénération Total annuel
Bâtiment (Batiment B) 1323,3 10,1 4,6 7,6 2 0,6 0 0,1 24,8 0 0 49,8`;
  const multiReDoc={id:'multi-re',name:'RSET_MULTI.pdf',type:DOC_TYPES.RSET_RE2020,read:{pages:[{page:1,text:multiReText,lines:multiReText.split('\n').map((text,index)=>({text,index,items:[]}))}],text:multiReText}}; multiReDoc.buildings=detectBuildings(multiReDoc);
  const multiReParsed=parseDocument(multiReDoc);
  const val=(b,f)=>multiReParsed.find(o=>o.building===b&&o.field===f&&o.method==='rset:cep-table')?.value;
  assert('RSET multi-bâtiments : Cep,nr A conservé sur A',val('Bâtiment A','cepnr')===35.3,String(val('Bâtiment A','cepnr')));
  assert('RSET multi-bâtiments : Cep,nr B conservé sur B',val('Bâtiment B','cepnr')===35.7,String(val('Bâtiment B','cepnr')));
  const postVal=(b,f)=>multiReParsed.find(o=>o.building===b&&o.field===f&&o.method==='rset:detailed-output-cep')?.value;
  assert('RSET multi-bâtiments : refroidissement B rattaché au bon bâtiment',Math.abs((postVal('Bâtiment B','cep_cooling')??0)-10.58)<.001,String(postVal('Bâtiment B','cep_cooling')));

  // Analyse incrémentale : un document déjà extrait réutilise son cache et n'est pas reparsé.
  const thermalFixture=mk(`ETUDE ÉNERGÉTIQUE TH-CEx\nÉtat Existant Bâtiment\nUbat du bâtiment 1,580\nCoefficient Cep Existant (kWh énergie primaire / m² Shon) 198,0\nÉtat projeté Scénario 2\nUbat du bâtiment 0,660\nCoefficient Cep Projet (kWh énergie primaire / m² Shon) 97,7\nCoefficient Cep Réf. (kWh énergie primaire / m² Shon) 157,7\nECLAIRAGE\nTotal Energie primaire (kWh EP /m²Shon) 27,8\nAUXILIAIRES\nVent - Total Energie primaire (kwh EP /m²Shon) 5,1`,DOC_TYPES.THERMAL);
  const thermalParsed=parseDocument(thermalFixture);
  assert('Étude thermique -> Ubat avant',thermalParsed.some(o=>o.field==='ubat_before'&&o.value===1.58),String(thermalParsed.find(o=>o.field==='ubat_before')?.value));
  assert('Étude thermique -> Ubat projet',thermalParsed.some(o=>o.field==='ubat_after'&&o.value===0.66),String(thermalParsed.find(o=>o.field==='ubat_after')?.value));
  assert('Étude thermique -> Cep projet',thermalParsed.some(o=>o.field==='cep'&&o.value===97.7),String(thermalParsed.find(o=>o.field==='cep')?.value));
  assert('Étude thermique -> Cep référence',thermalParsed.some(o=>o.field==='cep_max'&&o.value===157.7),String(thermalParsed.find(o=>o.field==='cep_max')?.value));
  assert('Étude thermique -> Cep éclairage',thermalParsed.some(o=>o.field==='cep_lighting'&&o.value===27.8),String(thermalParsed.find(o=>o.field==='cep_lighting')?.value));
  assert('Étude thermique -> Cep auxiliaire ventilation',thermalParsed.some(o=>o.field==='cep_aux_vent'&&o.value===5.1),String(thermalParsed.find(o=>o.field==='cep_aux_vent')?.value));
  const cachedDoc={id:'cached-doc',name:'ancien.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment A']},cachedOccurrences:[{field:'structure',value:'Béton',building:'Bâtiment A',docId:'cached-doc',fileName:'ancien.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'Béton',confidence:.96,method:'cached'}]};
  const cachedResult=analyzeDocuments([cachedDoc],DEFAULT_SOURCE_RULES,'Cache');
  assert('Analyse incrémentale réutilise les documents déjà analysés',cachedResult.reusedParsedCount===1&&cachedResult.newlyParsedCount===0&&cachedResult.rows[0].structure==='Béton',`${cachedResult.reusedParsedCount}/${cachedResult.newlyParsedCount}`);
  const newText='Mur extérieur PSE R=3.8';
  const newDoc={id:'new-doc',name:'nouveau.txt',type:DOC_TYPES.CCTP,read:{pages:[{page:1,text:newText,lines:[{text:newText,index:0,items:[]}]}],text:newText},buildings:{names:['Bâtiment A']}};
  const incremented=analyzeDocuments([cachedDoc,newDoc],DEFAULT_SOURCE_RULES,'Cache');
  assert('Analyse incrémentale ne parse que le nouveau document',incremented.reusedParsedCount===1&&incremented.newlyParsedCount===1,`${incremented.reusedParsedCount}/${incremented.newlyParsedCount}`);

  const tagText='Résidence sénior avec traitement des eaux grises, démarche biodiversité et suivi de la qualité de l air intérieur.';
  const tagDoc={id:'tag-doc',name:'notice.pdf',type:DOC_TYPES.NOTICE,read:{pages:[{page:1,text:tagText,lines:[{text:tagText,index:0}]}],text:tagText},buildings:{names:['Bâtiment unique']}};
  const tags=buildProjectTags([tagDoc],{rows:[{building:'Bâtiment unique',cep:40,cep_max:100}]},[]);
  assert('Tags projet : eaux grises / biodiversité / sénior',tags.some(t=>/eaux grises/i.test(t.label))&&tags.some(t=>/biodiversit/i.test(t.label))&&tags.some(t=>/sénior/i.test(t.label)),tags.map(t=>t.label).join(', '));
  assert('Tag dynamique performance CEP',tags.some(t=>/Performance CEP -60/.test(t.label)),tags.map(t=>t.label).join(', '));

  // Regroupement bâtiments : variantes évidentes automatiques, identifiants ambigus uniquement sur validation manuelle.
  const aliasDocs=[
    {id:'rset-a',name:'RSET A.pdf',type:DOC_TYPES.RT2012,buildings:{names:['Bâtiment A']}},
    {id:'cctp-a',name:'CCTP A.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bât A']}}
  ];
  const aliasGrouping=buildBuildingGrouping(aliasDocs,[{building:'BAT A'}],{});
  assert('Bât A / Bâtiment A / BAT A fusionnés automatiquement',aliasGrouping.aliasMap['Bât A']==='Bâtiment A'&&aliasGrouping.aliasMap['BAT A']==='Bâtiment A',JSON.stringify(aliasGrouping.aliasMap));

  const ambiguousDocs=[
    {id:'b',name:'B.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment B']}},
    {id:'b1',name:'B1.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment B1']}}
  ];
  const ambiguousGrouping=buildBuildingGrouping(ambiguousDocs,[],{});
  assert('B et B1 restent distincts sans validation',ambiguousGrouping.canonicalNames.length===2,ambiguousGrouping.canonicalNames.join(', '));
  assert('B et B1 proposés comme rapprochement possible',ambiguousGrouping.suggestions.some(x=>[x.a,x.b].includes('Bâtiment B')&&[x.a,x.b].includes('Bâtiment B1')),JSON.stringify(ambiguousGrouping.suggestions));

  const manualGrouping=buildBuildingGrouping(ambiguousDocs,[],{'Bâtiment B1':'Bâtiment B'});
  const mergeRaw=[
    {field:'structure',value:'Béton',building:'Bâtiment B',docId:'b',fileName:'B.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'structure',confidence:.95,method:'test'},
    {field:'ventilation',value:'VMC Hygro B',building:'Bâtiment B1',docId:'b1',fileName:'B1.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'ventilation',confidence:.95,method:'test'}
  ].map(o=>({...o,originalBuilding:o.building,building:mappedBuilding(o.building,manualGrouping)}));
  const mergeOcc=routeAndDeduplicate(mergeRaw,DEFAULT_SOURCE_RULES);
  const mergeResult=consolidate(ambiguousDocs,mergeOcc,DEFAULT_SOURCE_RULES,'Fusion',manualGrouping);
  assert('Fusion manuelle = une seule ligne avec données cumulées',mergeResult.rows.length===1&&mergeResult.rows[0].structure==='Béton'&&mergeResult.rows[0].ventilation==='VMC Hygro B',JSON.stringify(mergeResult.rows));

  const carbonDetailText=`Bâtiment A
1-VRD
Total : 1 2 3 4 25,58 0 0 25,58
6-Façades et menuiseries extérieures
Total : 27,82 1,80 16,99 0,4438092 43,73 0,0 0,0 43,73
8-CVC
Total : 38,97 3,06 90,14 5,78 125,7 0,0 0,0 125,7
Total Lot : 279,3 48,24 208,2 33,44 547,3 0,0 0,0 547,3
Energie (CE)
Chauffage
Total : 0 0 0 0 28,12 0 0 28,12
Ecs
Total : 0 0 0 0 15,42 0 0 15,42
Refroidissement
Total : 0 0 0 0 2,53 0 0 2,53
Eclairage
Total : 0 0 0 0 5,73 0 0 5,73
Auxiliaires Ventilateurs
Total : 0 0 0 0 3,80 0 0 3,80
Auxiliaires Distribution
Total : 0 0 0 0 0,2530752 0 0 0,2530752
Ascenseur / parking
Total : 0 0 0 0 0,5061504 0 0 0,5061504
Total Lot : 0 0 0 0 56,35 0 0 56,35
Eau (CRE)
Total Lot : 0 0 54,81 0 54,81 0 0 54,81
Chantier (Cha)
Total Lot : 0 0 0 0 7,55 0 0 7,55`;
  const carbonDetailDoc=mk(carbonDetailText,DOC_TYPES.RSET_RE2020); const carbonDetail=parseDocument(carbonDetailDoc); const cval=f=>carbonDetail.find(o=>o.field===f&&String(o.method||'').startsWith('rset:carbon'))?.value;
  assert('RSEE détaillé -> IC composants lot 1',cval('ic_lot_1')===25.58,String(cval('ic_lot_1')));
  assert('RSEE détaillé -> IC composants lot 6',cval('ic_lot_6')===43.73,String(cval('ic_lot_6')));
  assert('RSEE détaillé -> IC composants lot 8',cval('ic_lot_8')===125.7,String(cval('ic_lot_8')));
  assert('RSEE détaillé -> IC composants bâtiment',cval('ic_components')===547.3,String(cval('ic_components')));
  assert('RSEE détaillé -> IC énergie chauffage',cval('ic_energy_heating')===28.12,String(cval('ic_energy_heating')));
  assert('RSEE détaillé -> IC énergie refroidissement',cval('ic_energy_cooling')===2.53,String(cval('ic_energy_cooling')));
  assert('RSEE détaillé -> IC énergie auxiliaires ventilation',cval('ic_energy_aux_vent')===3.8,String(cval('ic_energy_aux_vent')));
  assert('RSEE détaillé -> IC énergie auxiliaires distribution',Math.abs((cval('ic_energy_aux_dist')??0)-.2530752)<1e-9,String(cval('ic_energy_aux_dist')));
  assert('RSEE détaillé -> IC énergie déplacements',Math.abs((cval('ic_energy_mobility')??0)-.5061504)<1e-9,String(cval('ic_energy_mobility')));
  assert('RSEE détaillé -> IC énergie bâtiment',cval('ic_energy')===56.35,String(cval('ic_energy')));
  assert('RSEE détaillé -> IC chantier',cval('ic_site')===7.55,String(cval('ic_site')));

  const validated=routeAndDeduplicate([{field:'cep_cooling',value:4.2,building:'Bâtiment A',docId:'ocr',fileName:'RSET.pdf',docType:DOC_TYPES.RSET_RE2020,page:9,excerpt:'OCR',confidence:.73,method:'ocr',userValidated:true}],DEFAULT_SOURCE_RULES);
  assert('Validation utilisateur OCR -> confiance 100 % et source principale',validated[0]?.confidence===1&&validated[0]?.sourceTier==='main',JSON.stringify(validated[0]));

  // v1.0.19 : tolérance aux rapports logiciels mono-bâtiment dont les titres génériques
  // ressemblent à tort à des identifiants bâtiment.
  const genericBuildingText=`1.1. Bâtiment : BÂTIMENT
Bâtiment : Bâtiment (RE2020)
Bâtiment : Bâtiment - bâtiment neuf Consommations
ICcomposant = 547,3 kg eq.CO2/m² SRef`;
  const genericBuildingDoc={id:'generic-building',name:'RSENV_TEST.pdf',type:DOC_TYPES.RSET_RE2020,read:{pages:[{page:1,text:genericBuildingText,lines:genericBuildingText.split('\n').map((text,index)=>({text,index,items:[]}))}],text:genericBuildingText}};
  genericBuildingDoc.buildings=detectBuildings(genericBuildingDoc);
  assert('Rapport mono-bâtiment : titres RE2020/Consommations non créés comme bâtiments',genericBuildingDoc.buildings.names.length===1&&genericBuildingDoc.buildings.names[0]==='Bâtiment unique',genericBuildingDoc.buildings.names.join(', '));

  const rsenvClass=classifyDocument('Mon_projet_RSENV.pdf','Indicateur de changement climatique ICcomposant = 547,3 kg eq.CO2/m² SRef RE2020');
  assert('Nom de fichier RSENV reconnu comme source RSENV',rsenvClass.type===DOC_TYPES.RSENV,`${rsenvClass.type} ${JSON.stringify(rsenvClass.reason)}`);
  const rseeClass=classifyDocument('Mon_projet_RSEE.pdf','Récapitulatif standardisé d’étude énergétique et environnementale RE2020 Cep,nr DH IC composants');
  assert('RSEE distingué du RSET dans le routage',rseeClass.type===DOC_TYPES.RSEE_RE2020,`${rseeClass.type} ${JSON.stringify(rseeClass.reason)}`);

  const regTokenNumbers=numbersIn('IC énergie est inférieure à IC énergie max conformément à la RE2020');
  assert('RE2020 jamais interprété comme valeur numérique',regTokenNumbers.length===0,JSON.stringify(regTokenNumbers));
  const falseIcDoc=mk('IC énergie est inférieure à IC énergie max conformément à la RE2020',DOC_TYPES.RSET_RE2020);
  const falseIc=parseDocument(falseIcDoc);
  assert('Phrase réglementaire RE2020 ne crée pas de faux IC énergie',!falseIc.some(o=>o.field==='ic_energy'),JSON.stringify(falseIc.filter(o=>o.field==='ic_energy')));

  const shabFallbackText=`Bâtiment : Bâtiment A
Résultats sorties détaillées
SHAB ou SURT : 1 138,5 m²`;
  const shabFallbackDoc=mk(shabFallbackText,DOC_TYPES.RSET_RE2020);
  const shabFallback=parseDocument(shabFallbackDoc);
  assert('SHAB explicite de secours récupérée hors tableau Chapitre 2',shabFallback.some(o=>o.field==='shab'&&Math.abs(o.value-1138.5)<.001),String(shabFallback.find(o=>o.field==='shab')?.value));
  const surfaceSref=parseDocument(mk('Bâtiment : Bâtiment A\nSRef / usage principal 1 323,3 m2 / Logement collectif',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment depuis SRef / usage principal',surfaceSref.some(o=>o.field==='shab'&&Math.abs(o.value-1323.3)<.001),String(surfaceSref.find(o=>o.field==='shab')?.value));
  const surfaceInline=parseDocument(mk('Type de travaux : Bâtiment neuf Sref : 330,8 m²',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment depuis Sref inline',surfaceInline.some(o=>o.field==='shab'&&Math.abs(o.value-330.8)<.001),String(surfaceInline.find(o=>o.field==='shab')?.value));
  const surfaceBuilding=parseDocument(mk('Surface du bâtiment : 330,80 m²',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment depuis libellé Surface du bâtiment',surfaceBuilding.some(o=>o.field==='shab'&&Math.abs(o.value-330.8)<.001),String(surfaceBuilding.find(o=>o.field==='shab')?.value));
  const surfaceHab=parseDocument(mk('Surface habitable 5 110,25 m²',DOC_TYPES.THERMAL));
  assert('Surface bâtiment depuis Surface habitable',surfaceHab.some(o=>o.field==='shab'&&Math.abs(o.value-5110.25)<.001),String(surfaceHab.find(o=>o.field==='shab')?.value));
  const surfaceShabSu=parseDocument(mk('Bâtiment 1 - SHAB/SU : 5110 m² - Année 1983',DOC_TYPES.THERMAL));
  assert('Surface bâtiment depuis SHAB/SU inline',surfaceShabSu.some(o=>o.field==='shab'&&Math.abs(o.value-5110)<.001),String(surfaceShabSu.find(o=>o.field==='shab')?.value));
  const surfaceNoFalse=parseDocument(mk('La surface de façade est inférieure à la moitié de la surface habitable du bâtiment. Éclairage naturel 1/6 SHAB',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment : aucune valeur tirée des règles 1/6 ou surfaces de façade',!surfaceNoFalse.some(o=>o.field==='shab'),String(surfaceNoFalse.find(o=>o.field==='shab')?.value));
  const surfaceSplitSref=parseDocument(mk('Bâtiment : Bâtiment A\nSRef / usage principal\n1 518,3 m² / Logement collectif',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment depuis Sref scindée sur 2 lignes',surfaceSplitSref.some(o=>o.field==='shab'&&Math.abs(o.value-1518.3)<.001),String(surfaceSplitSref.find(o=>o.field==='shab')?.value));
  const surfaceShabUnitFirst=parseDocument(mk('Bâtiment : Bâtiment A\nShab m² 5 110,25',DOC_TYPES.THERMAL));
  assert('Surface bâtiment depuis ligne Shab m² valeur',surfaceShabUnitFirst.some(o=>o.field==='shab'&&Math.abs(o.value-5110.25)<.001),String(surfaceShabUnitFirst.find(o=>o.field==='shab')?.value));
  const surfaceSplitSrt=parseDocument(mk('Bâtiment : Bat 100\nSRT 2\n947,3 m',DOC_TYPES.RT2012));
  assert('Surface bâtiment secours depuis SRT scindée',surfaceSplitSrt.some(o=>o.field==='shab'&&Math.abs(o.value-947.3)<.001),String(surfaceSplitSrt.find(o=>o.field==='shab')?.value));
  const searchSurface=freeSearch([mk('Bâtiment A\nSRef / usage principal 1 323,3 m2 / Logement collectif',DOC_TYPES.RSET_RE2020)],'surface bâtiment');
  assert('Recherche libre surface reconnaît SRef',searchSurface.some(x=>Math.abs((x.numericValue??0)-1323.3)<.001),JSON.stringify(searchSurface.slice(0,2)));
  const searchNoRe=freeSearch([mk('IC énergie conforme à la RE2020',DOC_TYPES.RSET_RE2020)],'IC énergie');
  assert('Recherche libre ne propose jamais 2020 depuis RE2020',!searchNoRe.some(x=>x.numericValue===2020),JSON.stringify(searchNoRe));

  const wrappedCarbonText=`Bâtiment A
1-VRD
Total : 1 2 3 4 25,58 0 0 25,58
10-Réseaux d’énergie
Total : 1 2 3 4 98,00 0 0 98,00
11-Réseaux de
communication (courant faible)
Total : 1 0 0,9964836 0 2,00 0 0 2,00
12-Appareils élévateurs et
autres équipements de transport intérieur
Total : 0 0 0 0 0 0 0 0
13-Equipements de
production locale d’électricité
Total : 0 0 0 0 0 0 0 0
Total Lot : 279,3 48,24 208,2 33,44 547,3 0 0 547,3`;
  const wrappedCarbonDoc=mk(wrappedCarbonText,DOC_TYPES.RSET_RE2020);
  const wrappedCarbon=parseDocument(wrappedCarbonDoc);
  const wc=f=>wrappedCarbon.find(o=>o.field===f&&String(o.method||'').startsWith('rset:carbon'))?.value;
  assert('IC lot 11 récupéré malgré intitulé sur plusieurs lignes',wc('ic_lot_11')===2,String(wc('ic_lot_11')));
  assert('IC lot 13 à zéro conservé',wc('ic_lot_13')===0,String(wc('ic_lot_13')));

  const searchSurfaceNoise=freeSearch([mk('Article 22 : coefficient 0,50 W/(m2 SRef.K)\nSurface de façade : 1062 m2\nSRef / usage principal 1 323,3 m2 / Logement collectif',DOC_TYPES.RSET_RE2020)],'surface bâtiment');
  assert('Recherche libre surface privilégie la surface bâtiment et ignore ratios/parois',searchSurfaceNoise[0]?.numericValue===1323.3,JSON.stringify(searchSurfaceNoise.slice(0,3)));
  const searchIcEnergyRows=freeSearch([mk('17.1.2.1.2. ENERGIE (CE)\nML23015163\nChauffage\nTotal : 0 0 0 0 28,12 0 0 28,12',DOC_TYPES.RSET_RE2020)],'IC énergie');
  assert('Recherche libre IC énergie ignore les identifiants de section voisins',!searchIcEnergyRows.some(x=>x.numericValue===2)&&searchIcEnergyRows.some(x=>Math.abs((x.numericValue??0)-28.12)<.001),JSON.stringify(searchIcEnergyRows));

  const criticalCepText=`Résultats détaillés des consommations annuelles par poste pour le bâtiment
Consommations annuelles par poste en énergie finale
CH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements`;
  const richItems=Array.from({length:80},(_,i)=>({str:i%2?'texte':'123'}));
  assert('OCR auto renforcé sur tableau Cep critique incomplet',shouldOcrPdfPage(criticalCepText,richItems,'auto')===true);
  const criticalCarbonText=`Détail des émissions de gaz à effet de serre ICcomposant
1-VRD
Total Lot : 547,3`;
  assert('OCR auto renforcé sur tableau IC critique mal reconstruit',shouldOcrPdfPage(criticalCarbonText,richItems,'auto')===true);

  // Contrat de schéma v1.1.1 : 167 colonnes exactes, chacune avec des tags reconnus.
  assert('Schéma métier = 167 colonnes',FIELD_DEFS.length===167,String(FIELD_DEFS.length));
  assert('Chaque colonne possède au moins un tag',FIELD_DEFS.every(f=>Array.isArray(FIELD_TAGS[f.key])&&FIELD_TAGS[f.key].length>0),FIELD_DEFS.filter(f=>!FIELD_TAGS[f.key]?.length).map(f=>f.label).join(', '));
  assert('Tous les intitulés exacts sont reconnus comme en-têtes',FIELD_DEFS.every(f=>matchFieldByHeader(f.label)?.key===f.key),FIELD_DEFS.filter(f=>matchFieldByHeader(f.label)?.key!==f.key).map(f=>f.label).join(', '));
  const contractTagged=parseDocument(mk('Code interne : OPE-009999\nNom opération : Résidence Test',DOC_TYPES.CONTRACT));
  assert('Tags contrat -> Code interne',contractTagged.some(o=>o.field==='internal_code'&&o.value==='OPE-009999'));
  assert('Tags contrat -> Nom opération',contractTagged.some(o=>o.field==='operation_name'&&o.value==='Résidence Test'));
  const sourceOrderOccurrences=routeAndDeduplicate([
    {field:'reference_name',value:'Contrat prioritaire',building:'Bâtiment unique',docId:'c',fileName:'contrat.pdf',docType:DOC_TYPES.CONTRACT,page:1,excerpt:'Référentiel',confidence:.90,method:'test'},
    {field:'reference_name',value:'Livret plus confiant',building:'Bâtiment unique',docId:'l',fileName:'livret.pdf',docType:DOC_TYPES.OPERATION_BOOKLET,page:1,excerpt:'Référentiel',confidence:.99,method:'test'}
  ], DEFAULT_SOURCE_RULES);
  const sourceOrderResult=consolidate([], sourceOrderOccurrences, DEFAULT_SOURCE_RULES, 'Test sources');
  assert('Ordre des sources prime sur la confiance',sourceOrderResult.rows[0]?.reference_name==='Contrat prioritaire',String(sourceOrderResult.rows[0]?.reference_name));
  const rseeVsRset=consolidate([],routeAndDeduplicate([
    {field:'housing_total',value:24,building:'Bâtiment unique',docId:'rsee',fileName:'RSEE.pdf',docType:DOC_TYPES.RSEE_RE2020,page:1,excerpt:'24 logements',confidence:.90,method:'test'},
    {field:'housing_total',value:25,building:'Bâtiment unique',docId:'rset',fileName:'RSET.pdf',docType:DOC_TYPES.RSET_RE2020,page:1,excerpt:'25 logements',confidence:.99,method:'test'}
  ],DEFAULT_SOURCE_RULES),DEFAULT_SOURCE_RULES,'Test ordre RSEE RSET');
  assert('Bloc programme : RSEE peut primer sur RSET selon la hiérarchie',rseeVsRset.rows[0]?.housing_total===24,String(rseeVsRset.rows[0]?.housing_total));

  // v1.1.4 : le vitrage doit ressortir sous forme de composition technique lorsqu'elle existe.
  assert('Vitrage 4/16/4 Argon normalisé',normalizeGlazingType('4/16/4 Argon')==='4.16.4 Ar',String(normalizeGlazingType('4/16/4 Argon')));
  assert('Vitrage 4-16Ar-4 normalisé',normalizeGlazingType('4-16Ar-4')==='4.16.4 Ar',String(normalizeGlazingType('4-16Ar-4')));
  const glazingDoc=mk('Menuiseries extérieures : châssis aluminium, double vitrage 4/16/4 gaz argon, volets roulants',DOC_TYPES.CCTP);
  const glazingParsed=parseDocument(glazingDoc);
  assert('Parseur menuiseries privilégie la composition vitrage',glazingParsed.some(o=>o.field==='window_glazing'&&o.value==='4.16.4 Ar'),JSON.stringify(glazingParsed.filter(o=>o.field==='window_glazing')));

  // v1.1.8 : rapport Bao Evolution / rénovation.
  const baoClass=classifyDocument('Rapport Bao Evolution SED.pdf','ETAT INITIAL : CALCUL du COEFFICIENT UBAT\nEtat après travaux');
  assert('Bao Evolution classé en étude thermique',baoClass.type===DOC_TYPES.THERMAL,baoClass.type);
  const baoBefore=parseDocument(mk('Bao Evolution\nETAT INITIAL : CALCUL du COEFFICIENT UBAT\nTempérature intérieure : 20 °C\nCOEFFICIENT UBAT = 0,428',DOC_TYPES.THERMAL));
  assert('Bao Ubat état initial',baoBefore.some(o=>o.field==='ubat_before'&&Math.abs(o.value-.428)<1e-9),JSON.stringify(baoBefore.filter(o=>/ubat/.test(o.field))));
  assert('Bao Ubat état initial utilise le parseur dédié',baoBefore.some(o=>o.field==='ubat_before'&&o.method==='bao:ubat-before-explicit'),JSON.stringify(baoBefore.filter(o=>/ubat/.test(o.field))));
  assert('Température intérieure Bao jamais confondue avec Tic',!baoBefore.some(o=>o.field==='tic'),JSON.stringify(baoBefore.filter(o=>o.field==='tic')));
  const baoAfter=parseDocument(mk('Bao Evolution\nModification n° 1 : CALCUL du COEFFICIENT UBAT\nEtat après travaux\nCOEFFICIENT UBAT = 0,526',DOC_TYPES.THERMAL));
  assert('Bao Ubat état après travaux',baoAfter.some(o=>o.field==='ubat_after'&&Math.abs(o.value-.526)<1e-9),JSON.stringify(baoAfter.filter(o=>/ubat/.test(o.field))));
  assert('Bao Ubat après travaux utilise le parseur dédié',baoAfter.some(o=>o.field==='ubat_after'&&o.method==='bao:ubat-after-explicit'),JSON.stringify(baoAfter.filter(o=>/ubat/.test(o.field))));
  assert('Bao vitrage Double +15mm normalisé sans invention',normalizeGlazingType('Double +15mm')==='Double vitrage — lame 15 mm',String(normalizeGlazingType('Double +15mm')));


  // v1.1.10 : Bao Evolution — bilan énergétique par poste, GES et garde-fous contextuels.
  const baoEnergyBeforeText=`Bao Evolution
ETAT INITIAL
Système de refroidissement : Sans système de refroidissement
Détails des consommations Energie finale Energie primaire Dépense
CHAUFFAGE
Electricité 2682,51 26,99 0,00
REFROIDISSEMENT 0,00
ECS
Electricité 3979,14 40,04 0,00
ECLAIRAGE 1466,61 14,76 0,00
AUXILIAIRES 168,06 1,69 0,00
VENTILATEURS 1243,92 12,52 0,00
AUTRES USAGES
Electrique 4899,79 49,30
TOTAL 14 440,0 145,3 0,0
Bilan Energétique Bilan CO2
TOTAL MWhEP/an : 37,26 TOTAL (tonnes) : ,953
TOTAL kWhEP/m².an : 145,3 TOTAL (kg/m²) : 3,72`;
  const baoEnergyBefore=parseDocument(mk(baoEnergyBeforeText,DOC_TYPES.THERMAL));
  const baoBeforeCep=baoEnergyBefore.find(o=>o.field==='cep_before'&&o.method==='bao:primary-energy-total-before');
  assert('Bao Cep avant depuis bilan énergie primaire',Math.abs((baoBeforeCep?.value??0)-145.3)<.001,String(baoBeforeCep?.value));
  assert('Bao chauffage/ECS/autres conservés dans le bilan par poste',Math.abs((baoBeforeCep?.baoBreakdown?.heating??0)-26.99)<.001&&Math.abs((baoBeforeCep?.baoBreakdown?.ecs??0)-40.04)<.001&&Math.abs((baoBeforeCep?.baoBreakdown?.other??0)-49.3)<.001,JSON.stringify(baoBeforeCep?.baoBreakdown));
  assert('Bao GES surfacique conservé sans faux mapping DPE/IC',Math.abs((baoBeforeCep?.baoGes?.kgM2??0)-3.72)<.001&&!baoEnergyBefore.some(o=>/^dpe_|^ic_/.test(o.field)),JSON.stringify(baoBeforeCep?.baoGes));
  assert('Bao contrôle somme des postes = total',baoBeforeCep?.baoChecks?.crossOk===true,JSON.stringify(baoBeforeCep?.baoChecks));

  const baoEnergyAfterText=`Bao Evolution
Etat après travaux
Système de refroidissement : Sans système de refroidissement
Détails des consommations Energie finale Energie primaire Dépense
CHAUFFAGE
Electricité 3670,89 36,94 0,00
REFROIDISSEMENT 0,00
ECS
Electricité 3979,14 40,04 0,00
ECLAIRAGE 1466,61 14,76 0,00
AUXILIAIRES 96,75 0,97 0,00
VENTILATEURS 1243,92 12,52 0,00
AUTRES USAGES
Electrique 4899,79 49,30
TOTAL 15 357,1 154,53 0,0
Bilan Energétique Bilan CO2
TOTAL MWhEP/an : 39,62 TOTAL (tonnes) : 1,128
TOTAL kWhEP/m².an : 154,53 TOTAL (kg/m²) : 4,4`;
  const baoEnergyAfter=parseDocument(mk(baoEnergyAfterText,DOC_TYPES.THERMAL));
  const baoAfterCep=baoEnergyAfter.find(o=>o.field==='cep_after_final'&&o.method==='bao:primary-energy-total-after');
  assert('Bao Cep final depuis bilan énergie primaire',Math.abs((baoAfterCep?.value??0)-154.53)<.001,String(baoAfterCep?.value));
  assert('Bao Cep détaillé éclairage/auxiliaires/ventilateurs',baoEnergyAfter.some(o=>o.field==='cep_lighting'&&Math.abs(o.value-14.76)<.001)&&baoEnergyAfter.some(o=>o.field==='cep_aux_dist'&&Math.abs(o.value-.97)<.001)&&baoEnergyAfter.some(o=>o.field==='cep_aux_vent'&&Math.abs(o.value-12.52)<.001),JSON.stringify(baoEnergyAfter.filter(o=>o.method?.startsWith('bao:primary-energy-post'))));
  assert('Bao Cep électricité agrégé quand le bilan est mono-énergie',baoEnergyAfter.some(o=>o.field==='cep_electricity'&&Math.abs(o.value-154.53)<.001),JSON.stringify(baoEnergyAfter.filter(o=>o.field==='cep_electricity')));

  const baoGlazing=parseDocument(mk(`Bao Evolution
Etat après travaux
Modification n° 1 : CATALOGUE DES VITRAGES
FE1 Menuiserie 0.9x1.8 0,90 1,80 Volet Roulant Alu
+15mm
Double`,DOC_TYPES.THERMAL));
  assert('Bao vitrage scindé Double + 15 mm reconstitué',baoGlazing.some(o=>o.field==='window_glazing'&&o.value==='Double vitrage — lame 15 mm'),JSON.stringify(baoGlazing.filter(o=>o.field==='window_glazing')));
  assert('Alu du volet Bao jamais pris pour matériau de menuiserie',!baoGlazing.some(o=>o.field==='window_material'&&o.value==='Aluminium'),JSON.stringify(baoGlazing.filter(o=>o.field==='window_material')));
  const baoOptionList=parseDocument(mk(`Bao Evolution
Etat après travaux
Type de chauffage : Autre (Thermodynamique, Gaz, Fioul, Bois, Réseau,...)`,DOC_TYPES.THERMAL));
  assert('Liste d’exemples Bao jamais interprétée comme vecteur chauffage',!baoOptionList.some(o=>o.field==='heating_vector_after'),JSON.stringify(baoOptionList.filter(o=>o.field==='heating_vector_after')));
  const baoYearRange=parseDocument(mk(`Bao Evolution
Année de construction : Entre 1948 et 1974`,DOC_TYPES.THERMAL));
  assert('Période de construction Bao jamais convertie en année exacte',!baoYearRange.some(o=>o.field==='construction_year'),JSON.stringify(baoYearRange.filter(o=>o.field==='construction_year')));
  const baoCritical=`Détails des consommations Energie finale Energie primaire Dépense\nCHAUFFAGE\nECS\nTOTAL`;
  assert('OCR ciblé sur tableau Bao énergie primaire incomplet',shouldOcrPdfPage(baoCritical,richItems,'auto')===true);
  assert('OCR ciblé sur page Ubat Bao sans valeur reconstruite',shouldOcrPdfPage('Modification n° 1 : CALCUL du COEFFICIENT UBAT\nEtat après travaux',richItems,'auto')===true);
  const baoCollective=parseDocument(mk(`Bao Evolution\nEtude thermique 4 logements Romorantin\nDONNEES TECHNIQUES\nType de bâtiment : Logements collectifs\nBATIMENT : Bâtiment n°1`,DOC_TYPES.THERMAL));
  assert('Bao bâtiment collectif unique -> 1 bâtiment collectif',baoCollective.some(o=>o.field==='housing_collective_buildings'&&o.value===1),JSON.stringify(baoCollective.filter(o=>o.field==='housing_collective_buildings')));
  // v1.1.13 - bibliothèque documentaire stricte / anti-faux-positifs.
  const rtNarrative=mk("Article 7 Respect des exigences\nl - 2° Le Coefficient Bbio du bâtiment est inférieur ou égal au coefficient maximal Bbiomax Conforme\nCoefficient Bbio 53,6 72 25,6\nl - 3° la température Tic est inférieure ou égale à Ticréf Conforme\nZone : Z / Groupe : G 673,8 26 30,8 -4,8 Conforme",DOC_TYPES.RT2012);
  const rtNarrativeParsed=parseDocument(rtNarrative);
  assert('RT2012 : numéro d’article jamais pris pour Bbio',!rtNarrativeParsed.some(o=>o.field==='bbio'&&o.value===2),JSON.stringify(rtNarrativeParsed.filter(o=>o.field==='bbio')));
  assert('RT2012 : tableau Bbio explicite conservé',rtNarrativeParsed.some(o=>o.field==='bbio'&&o.value===53.6),JSON.stringify(rtNarrativeParsed.filter(o=>o.field==='bbio')));
  const dpeRecommendations=mk("DPE NEUF diagnostic de performance énergétique\nProduction d’énergies renouvelables\nD'autres solutions d'énergies renouvelables existent : pompe à chaleur chauffe eau thermodynamique panneaux solaires thermiques chauffage au bois réseau de chaleur vertueux géothermie\nSi climatisation, température recommandée en été -> 28°C",DOC_TYPES.DPE);
  const dpeNoiseParsed=parseDocument(dpeRecommendations);
  assert('DPE : recommandations ENR jamais prises pour installation réelle',!dpeNoiseParsed.some(o=>o.field==='enr'||o.field==='enr_type'),JSON.stringify(dpeNoiseParsed.filter(o=>/^enr/.test(o.field))));
  assert('DPE : recommandation climatisation jamais prise pour refroidissement',!dpeNoiseParsed.some(o=>o.field==='cooling'),JSON.stringify(dpeNoiseParsed.filter(o=>o.field==='cooling')));
  const carbonHeading=mk("Indicateurs principaux, à l'échelle du bâtiment, contribution Composant, par lot\nLOT : 08 - CVC\nIndicateur CO Dynamique kg CO2 39,09",DOC_TYPES.CARBON);
  const carbonHeadingParsed=parseDocument(carbonHeading);
  assert('Carbone : titre LOT 08 jamais pris pour IC lot 8',!carbonHeadingParsed.some(o=>o.field==='ic_lot_8'),JSON.stringify(carbonHeadingParsed.filter(o=>o.field==='ic_lot_8')));
  const carbonExplicit=mk("IC composants lot 8 = 39,09 kg eq.CO2/m²",DOC_TYPES.CARBON);
  assert('Carbone : libellé IC lot explicite accepté',parseDocument(carbonExplicit).some(o=>o.field==='ic_lot_8'&&Math.abs(o.value-39.09)<.001));
  const unroutedDoc={id:'unrouted-test',name:'DPE.pdf',type:DOC_TYPES.DPE,read:{pages:[],text:''},buildings:{names:['Bâtiment A']}};
  const unroutedResult=analyzeDocuments([unroutedDoc],structuredClone(DEFAULT_SOURCE_RULES),'Strict',{},[{field:'cep',value:777,building:'Bâtiment A',docId:'unrouted-test',fileName:'DPE.pdf',docType:DOC_TYPES.DPE,page:1,excerpt:'Cep 777',confidence:.99,method:'test'}]);
  assert('Source non routée : jamais injectée au résultat final',unroutedResult.rows[0]?.cep===undefined,String(unroutedResult.rows[0]?.cep));
  assert('Source non routée : candidate conservée À vérifier',unroutedResult.uncertain.some(o=>o.field==='cep'&&o.value===777),JSON.stringify(unroutedResult.uncertain));


  return {tests,passed:tests.filter(t=>t.ok).length,total:tests.length,ok:tests.every(t=>t.ok)};
}
