// v2.7.0 — collage libre : texte « libellé = valeur » (ou « : », tabulation), regroupé par bâtiment (« Bâtiment G : »).
// Chaque libellé est rapproché d'une colonne ExtracTerre ; les libellés inconnus peuvent être rangés par l'IA, qui ne
// choisit qu'une colonne : la valeur reste celle écrite dans le texte collé (jamais inventée).
import {FIELD_DEFS,FIELD_MAP,matchFieldByHeaderDetailed,DOC_TYPES,STRUCTURES,SHADINGS,MATERIALS,WINDOW_MATERIALS,GLAZINGS} from './config.js';
import {wallInsulationSide} from './engine.js';
import {normLower,parseFrNumber,normalizeText,findFirstMatch,normalizeGlazingType} from './utils.js';
import {parseDocument} from './parsers.js';

const fp_BUILDING=/^\s*((?:b[âa]t(?:iment)?\.?|immeuble|cage|plot|lot)\s*[\w-]{1,20}(?:\s+[\w-]{1,20})?)\s*:?\s*$/i;
const fp_PAIR=/^\s*(.{2,120}?)\s*(?:=|:|\t)\s*(.+?)\s*$/;
// Libellé sans unité finale : « DH des zones traversantes (en °C.h) » → « DH des zones traversantes ».
const fp_clean=l=>String(l||'').replace(/\((?:en|unit[eé])\s[^)]*\)\s*$/i,'').replace(/\s*\[[^\]]*\]\s*$/,'').trim();
function fp_value(field,raw){
  const def=FIELD_MAP[field]; const s=String(raw||'').trim();
  if(def?.type!=='number') return s||null;
  // nombre isolé : le « 4 » de « Q4 » ou de « R+4 » n'est pas une valeur
  const m=s.replace(/\u00a0/g,' ').match(/(?<![A-Za-z\d.,+])[-+]?\d+(?:[ .]\d{3})*(?:[.,]\d+)?/); if(!m) return null;
  return parseFrNumber(m[0]);
}
// DH par type de zone : la colonne DH garde la plus défavorable (comme la lecture des RSET) ; le type de zone est noté.
function fp_dhZone(label){ const l=normLower(label); if(!/\bdh\b|degres?[- ]heures?/.test(l)||!/travers/.test(l)) return null; return /non\s+travers/.test(l)?'non':'oui'; }

export function matchFreeLabel(label){
  const clean=fp_clean(label); const r=matchFieldByHeaderDetailed(clean)||matchFieldByHeaderDetailed(label);
  return r?.def?.key&&r.def.key!=='building'?r.def.key:null;
}
// En-tête de section : « Bâtiment G : », « Maison 1-01 : », « Maisons 1-03 1-04 : » — ligne terminée par « : » sans valeur,
// avec un mot de bâtiment ou suivie de lignes « libellé = valeur ».
const fp_HEADER=/^\s*([^=:]{2,80}?)\s*:\s*$/;
const fp_BUILDING_WORD=/\b(?:b[âa]t(?:iment)?s?|maisons?|immeubles?|cages?|plots?|lots?|villas?|pavillons?|r[ée]sidences?|blocs?|tranches?|logements?|ilots?|îlots?)\b/i;
function fp_buildingName(n){ const t=n.replace(/\s+/g,' ').trim(); const k=t.match(/^b[âa]t(?:iment)?\.?\s*(.+)$/i); return k?`Bâtiment ${k[1]}`:t; }
// v2.8.0 — fiche Salesforce (libellé sur une ligne, valeur sur la suivante) → « libellé = valeur ».
// Seuls les libellés reconnus exactement (ou par alias) ouvrent une paire : un rapprochement approximatif ne suffit pas.
function fp_strictLabel(l){ const t=String(l||'').replace(/^\*\s*/,'').replace(/\s*:\s*$/,'').trim(); if(!t||t.length>80||/[=\t]/.test(t)) return null;
  const r=matchFieldByHeaderDetailed(fp_clean(t)); return r&&r.mode!=='fuzzy'&&r.def.key!=='building'?r.def.key:null; }
// Textes d'aide de Salesforce (« Modifier Numéro de contrat », « Aide Société ») : sans valeur.
const fp_ASSIST=/^(?:modifier|aide|edit|help)\s+(.+)$/i;
export function unstackLabels(text){
  const all=String(text||'').replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(Boolean);
  if(all.filter(l=>/=/.test(l)).length>all.length*.2) return {text:String(text||''),pairs:0};
  const lines=all.filter(l=>{ const m=l.match(fp_ASSIST); return !(m&&fp_strictLabel(m[1])); });
  const out=[]; let pairs=0;
  for(let i=0;i<lines.length;i++){ const next=lines[i+1];
    if(fp_strictLabel(lines[i])&&next!==undefined&&!fp_strictLabel(next)&&next.length<=200&&!/=/.test(next)){ out.push(`${lines[i].replace(/^\*\s*/,'').replace(/\s*:\s*$/,'').replace(/\s*:\s*/g,' ')} = ${next}`); pairs++; i++; }
    else out.push(lines[i]); }
  return pairs?{text:out.join('\n'),pairs}:{text:String(text||''),pairs:0};
}
// → {buildings:[{name,items:[{line,label,raw,field,value,auto}]}],unmatched:[{building,line,label,raw}],descriptive:[lignes de texte]}
export function parseFreePaste(text){
  // v2.10.2 — fiche Évaluation Salesforce (favori) : d'abord réécrite en « libellé = valeur » par bâtiment.
  let sfNotes=null; if(looksLikeSalesforceEvaluation(text)){ const c=salesforceEvaluationToPaste(text); text=c.text; sfNotes=c.notes; }
  // Fiche Salesforce : le reste de la page (menus, listes associées) n'est pas lu comme un CCTP.
  const st=unstackLabels(text); text=st.text; const stacked=st.pairs>0;
  const out=[]; let cur=null; const unmatched=[], descriptive=[], descBld=[];
  const ensure=name=>{ cur=out.find(b=>b.name===name)||{name,items:[]}; if(!out.includes(cur)) out.push(cur); return cur; };
  const lines=String(text||'').replace(/\r/g,'').split('\n');
  for(let i=0;i<lines.length;i++){
    const line=lines[i]; if(!line.trim()) continue;
    const h=line.match(fp_HEADER);
    if(h){ const next=lines.slice(i+1).find(l=>l.trim())||''; if(fp_BUILDING.test(line)||fp_BUILDING_WORD.test(h[1])||/=/.test(next)){ ensure(fp_buildingName(h[1])); continue; } }
    const m=line.match(fp_PAIR);
    // « libellé = » sans valeur : rien à reporter.
    if(/=\s*$/.test(line)) continue;
    // Ligne de fiche (« Laine de verre … - Épaisseur : 380 mm - Performances : R= 10,85 », « - Uf = 1,80 ») : texte descriptif.
    const descLine=!m||/^\s*[-–>*]/.test(line)||/\s[-–]\s/.test(m[1])||/[ée]paisseur|performances/i.test(m[1])&&!fp_strictLabel(m[1]);
    if(descLine||!/=/.test(line)&&!/\t/.test(line)&&!fp_shortPair(line)){ descriptive.push(line.trim()); descBld.push(cur?.name||''); continue; }
    const label=m[1].trim(), raw=m[2].trim(); const bld=cur||ensure('');
    const dz=fp_dhZone(label);
    if(dz){ const v=fp_value('dh',raw); if(v!==null){ bld.items.push({line:line.trim(),label,raw,field:'dh',value:v,auto:true,dhZone:dz}); continue; } }
    const field=matchFreeLabel(label);
    if(field){ const v=fp_value(field,raw); if(v!==null){ bld.items.push({line:line.trim(),label,raw,field,value:v,auto:true}); continue; } }
    unmatched.push({building:bld.name,line:line.trim(),label,raw});
  }
  // Ligne isolée hors des sections d'une fiche, avec un chiffre (« Perméabilité mesurée Q4 0,6 ») : proposée à l'IA.
  let sec=null; descriptive.forEach((l,i)=>{ const low=normLower(l).replace(/[’']/g,' '); if(fp_SECTIONS.some(([,re])=>re.test(low))){ sec=true; return; } if(/-\s*notes$/.test(low)){ sec=null; return; }
    if(!sec&&/\d/.test(l)&&!/^\s*[>*-]|\bpage\s+\d/i.test(l)) unmatched.push({building:descBld[i],line:l,label:'',raw:l}); });
  const desc=stacked?[]:descriptiveItems(descriptive);
  if(desc.length) out.push({name:'*',items:desc});
  return {buildings:out.filter(b=>b.items.length||unmatched.some(u=>u.building===b.name)),unmatched,descriptive,stacked,...(sfNotes?{salesforce:true,notes:sfNotes,text}:{})};
}
// « Cep : 35,2 » (libellé court reconnu) est une paire ; « PRODUCTION : Pompe à chaleur… » reste du texte descriptif.
function fp_shortPair(line){ const m=line.match(fp_PAIR); return !!m&&!!matchFreeLabel(m[1]); }

// —— Texte descriptif (fiche de synthèse type CCTP : « Planchers hauts », « Parois verticales », « Chauffage »…) :
// lu par les parseurs documentaires d'ExtracTerre, complétés par des règles de section. Valeurs de toute l'opération.
const fp_SECTIONS=[['roof',/^planchers?\s+hauts?$|^toitures?$|^combles$/],['wall',/^parois?\s+verticales?$|^murs?(?:\s+exterieurs?)?$/],['floor',/^planchers?\s+bas$/],
  ['win',/^menuiseries?\s+exterieures?$/],['vent',/^renouvellement\s+d.air$|^ventilation$/],['enr',/^energies?\s+renouvelables?$/],['heat',/^chauffage$/],['ecs',/^eau\s+chaude\s+sanitaire$/],['other',/^ponts?\s+thermiques?$|^regulation/]];
const fp_ENTRY=/^(.+?)\s+-\s+[ÉE]paisseur\s*:\s*(\d+(?:[.,]\d+)?)\s*mm(?:.*?\bR\s*=\s*(\d+(?:[.,]\d+)?))?/i;
function sectionItems(lines){
  const out=[]; const put=(field,value,line)=>{ if(value!==null&&value!==undefined&&value!==''&&!out.some(x=>x.field===field)) out.push({field,value,line,label:'texte descriptif',raw:String(value),auto:true,descr:true}); };
  let sec=null;
  for(const line of lines){
    const low=normLower(line).replace(/[’']/g,' ');
    const hit=fp_SECTIONS.find(([,re])=>re.test(low)); if(hit){ sec=hit[0]; continue; }
    if(/-\s*notes$/.test(low)){ sec=null; continue; }
    if(!sec) continue;
    if(['roof','wall','floor'].includes(sec)){
      const e=line.match(fp_ENTRY); if(!e) continue; const name=e[1].replace(/^[-–\s]+/,'').trim(), th=parseFrNumber(e[2]), r=e[3]?parseFrNumber(e[3]):null;
      const pre={roof:'roof',wall:'wall',floor:'floor'}[sec];
      if(r!==null&&r>=0.5){ put(`${pre}_insulation`,name,line); put(`${pre}_insulation_thickness`,th,line); put(`${pre}_insulation_r`,r,line); }
      else put(`${pre}_structure`,findFirstMatch(normalizeText(name),STRUCTURES)||name,line);
    } else if(sec==='win'){
      const g=line.match(/\b(\d{1,2}\s*[+/]\s*\d{1,2}\s*[+/]\s*\d{1,2})\b/); if(g) put('window_glazing',normalizeGlazingType(`${/vir|faible\s+[eé]missivit/i.test(line)?'double vitrage VIR ':''}${g[1].replace(/\+/g,'/')}`)||g[1],line);
      const sh=findFirstMatch(normalizeText(line),SHADINGS); if(sh) put('window_shading',sh,line);
    } else if(sec==='vent'){
      if(/hygro/i.test(low)&&/\bbc\b|hygro[\s-]*b\b|type\s*b\b/.test(low)) put('ventilation','VMC Hygro B',line);
      else if(/hygro/i.test(low)&&/hygro[\s-]*a\b|type\s*a\b/.test(low)) put('ventilation','VMC Hygro A',line);
      else if(/double\s+flux/.test(low)) put('ventilation','VMC double flux',line);
      else if(/simple\s+flux|autoreglable/.test(low)) put('ventilation','VMC simple flux autoréglable',line);
    } else if(sec==='enr'){ if(/^(?:sans\s+objet|aucune?|neant|non)\.?$/.test(low.trim())) put('enr','Non',line); }
  }
  return out;
}
function descriptiveItems(lines){
  if(!lines.length) return [];
  const own=sectionItems(lines);
  // Parseurs documentaires (ceux des CCTP) sur le texte collé, présenté comme une pièce écrite d'une page.
  const L=lines.map((t,index)=>({index,text:normalizeText(t),items:[]}));
  const doc={id:'free-paste',name:'Collage libre',type:DOC_TYPES.CCTP,classification:{type:DOC_TYPES.CCTP,automaticType:DOC_TYPES.CCTP},familyMode:'auto',status:'ready',buildings:{names:['Bâtiment unique']},
    read:{kind:'text',pages:[{page:1,lines:L,text:L.map(l=>l.text).join('\n')}],text:L.map(l=>l.text).join('\n')}};
  let occ=[]; try{ occ=parseDocument(doc)||[]; }catch{ occ=[]; }
  const best={}; for(const o of occ){ if(!FIELD_MAP[o.field]||o.confidence<0.85) continue; if(!best[o.field]||o.confidence>best[o.field].confidence) best[o.field]=o; }
  const items=[...own];
  for(const o of Object.values(best)){
    // Les règles de section priment pour l'épaisseur / le R (ligne de l'isolant) ; le nom normalisé du parseur prime.
    const i=items.findIndex(x=>x.field===o.field);
    if(i>=0){ if(/_insulation$|_structure$|^structure$/.test(o.field)) items[i]={...items[i],value:o.value}; continue; }
    if(/_structure$/.test(o.field)&&items.some(x=>x.field===o.field.replace('_structure','_insulation'))&&/combles/i.test(String(o.value))) continue;
    // « Structure » (porteuse) n'est pas déduite d'un plancher bas en hourdis.
    if(o.field==='structure'&&items.some(x=>x.field==='floor_structure'&&x.value===o.value)) continue;
    items.push({field:o.field,value:o.value,line:String(o.excerpt||'').split(' | ').pop(),label:'texte descriptif',raw:String(o.value),auto:true,descr:true});
  }
  return items;
}
// Valeurs finales par bâtiment : une valeur par colonne ; DH = zone la plus défavorable, types de zones « Oui ».
export function freePasteValues(parsed){
  const res=[]; const all=(parsed.buildings||[]).find(b=>b.name==='*'); const named=(parsed.buildings||[]).filter(b=>b.name!=='*');
  for(const b of named.length?named:[{name:'',items:[]}]){
    const items=[...b.items,...(all?all.items.filter(it=>!b.items.some(x=>x.field===it.field)):[])];
    const vals={}, src={};
    for(const it of items){
      if(!it.field||it.value===null||it.value===undefined||it.value==='') continue;
      if(it.dhZone){ if(vals.dh===undefined||it.value>vals.dh){ vals.dh=it.value; src.dh=it.line; } const k=it.dhZone==='oui'?'cross_ventilated':'non_cross_ventilated'; vals[k]='Oui'; src[k]=it.line; continue; }
      vals[it.field]=it.value; src[it.field]=it.line;
    }
    res.push({building:b.name,values:vals,sources:src});
  }
  return res;
}
// —— IA : rangement des lignes non reconnues. Elle renvoie {line, field} ; la valeur est relue dans la ligne elle-même.
export function freePastePrompt(unmatched){
  const fields=FIELD_DEFS.filter(f=>f.key!=='building').map(f=>`${f.key} : ${f.label}${f.unit?` [${f.unit}]`:''}`).join('\n');
  return {system:`Tu ranges des lignes de données du bâtiment (France : RE2020, RT2012, RT existant, DPE, ACV) dans les colonnes d'un tableau. Pour chaque ligne fournie, choisis la clé de colonne qui correspond EXACTEMENT au libellé, ou null si aucune ne convient (ne force jamais). Réponds UNIQUEMENT par un objet JSON : {"lines":[{"n":<numéro de ligne>,"field":"<clé ou null>","value":"<la valeur telle qu'écrite dans la ligne>"}]}.\nColonnes disponibles (clé : libellé) :\n${fields}`,
    user:unmatched.map((u,i)=>`${i+1}. ${u.line}`).join('\n')};
}
export function applyFreePasteAi(parsed,answer){
  const lines=Array.isArray(answer?.lines)?answer.lines:[]; let added=0;
  for(const a of lines){
    const u=parsed.unmatched[Number(a?.n)-1]; const field=String(a?.field||''); if(!u||!FIELD_MAP[field]||field==='building') continue;
    // La valeur doit figurer dans la ligne collée ; sinon on prend la partie après le séparateur.
    const said=String(a?.value??'').trim(); const raw=said&&normLower(u.line).includes(normLower(said))?said:(u.raw||u.line);
    const v=fp_value(field,raw); if(v===null) continue;
    let b=parsed.buildings.find(x=>x.name===u.building); if(!b){ b={name:u.building,items:[]}; parsed.buildings.push(b); }
    b.items.push({line:u.line,label:u.label||u.line,raw,field,value:v,auto:false,ai:true}); u.done=true; added++;
  }
  parsed.unmatched=parsed.unmatched.filter(u=>!u.done);
  return added;
}
// Un tableau collé (tabulations / points-virgules sur plusieurs colonnes) relève du collage Excel, pas du collage libre.
export function looksLikeFreeText(text){
  const lines=String(text||'').split('\n').filter(l=>l.trim());
  const tabular=lines.filter(l=>(l.match(/\t/g)||[]).length>=2||(l.match(/;/g)||[]).length>=2).length;
  return lines.length>0&&tabular<lines.length/2;
}

// —— v2.10.2 — fiche Évaluation Salesforce envoyée par le favori : en-tête de l'opération, blocs « Maison 1 = » de la
// section « Performance thermique », sections d'enveloppe et de systèmes. Tout est relu dans le texte : rien n'est déduit,
// sauf le nombre de logements d'un bloc « Maisons 2/3 » (2) et le signe des gains (convention ExtracTerre : positif si
// la valeur est sous le maximum). Les sous-sections « - Notes » (écarts RSET / CCTP, « NC ») sont ignorées.
export function looksLikeSalesforceEvaluation(text){ const t=String(text||''); return /^\s*Performance thermique\s*$/m.test(t)&&(/\bOPE-\d{6}\b/.test(t)||/^\s*(?:Planchers hauts|Parois verticales|Planchers bas|Chauffage|Renouvellement d.air)\b/m.test(t)); }
const sf_ALIASES={bbio:'bbio',bbiomax:'bbio_max',gainbbio:'bbio_gain',cep:'cep',cepmax:'cep_max',cepref:'cep_max',gaincep:'cep_gain',cepnr:'cepnr',cepnrmax:'cepnr_max',gaincepnr:'cepnr_gain',
  dh:'dh',dhmax:'dh_max',shab:'shab',sref:'shab',srt:'shab',q4:'q4pa_surf',q4pasurf:'q4pa_surf',icconstruction:'ic_construction',icconstructionmax:'ic_construction_max',icconstructionmax2025:'ic_construction_max',icconstructionmax2028:'ic_construction_max_2028',icenergie:'ic_energy',icenergiemax:'ic_energy_max',icenergiemax2025:'ic_energy_max',icenergiemax2028:'ic_energy_max_2028',
  tic:'tic',ticref:'tic_ref',nombredelogements:'housing_count',logements:'housing_count'};
const sf_key=l=>normLower(l).replace(/[^a-z0-9]/g,'');
const sf_num=raw=>{ const m=String(raw).replace(/ /g,' ').match(/[-+]?\d+(?:[.,]\d+)?/); return m?parseFrNumber(m[0]):null; };
const sf_fmt=v=>String(Math.round(v*1000)/1000).replace('.',',');
const sf_SECTIONS=[['roof',/^planchers?\s+hauts?\b/],['wall',/^parois?\s+verticales?\b/],['floor',/^planchers?\s+bas\b/],['win',/^menuiseries?\s+exterieures?\b/],['bridge',/^ponts?\s+thermiques?\b/],
  ['heat',/^chauffage\b/],['ecs',/^eau\s+chaude\s+sanitaire\b/],['vent',/^renouvellement\s+d.air\b/],['reg',/^regulation\b/],['enr',/^energies?\s+renouvelables?\b/]];
const sf_section=line=>{ const low=normLower(line).replace(/[’']/g,' '); if(/-\s*notes\s*$/.test(low)) return ['notes','']; const h=sf_SECTIONS.find(([,re])=>re.test(low)); if(!h) return null;
  // « Planchers hauts: COMBLES : Laine de verre… » : le contenu suit l'en-tête sur la même ligne.
  const m=line.match(/^[^:]*:\s*(.*)$/); return [h[0],m?m[1].trim():'']; };
const sf_clean=l=>/^\s*>\s*lot\b|\bpage\s+\d+\s*(?:;|$)/i.test(l)?'':String(l).replace(/^[\s*+•>–-]+/,'').replace(/\s*§.*$/,'').replace(/\s+/g,' ').trim();
// Un libellé « Contrat: Numéro du contrat » serait coupé au premier « : » : on écrit sa forme courte, reconnue à l'identique.
const sf_label=key=>{ const l=FIELD_MAP[key].label; if(!l.includes(':')) return l; const short=l.slice(l.lastIndexOf(':')+1).trim(); return fp_strictLabel(short)===key?short:{contract_number:'Numéro du contrat',owner_company:'Maître d\'ouvrage',reference_name:'Référentiel'}[key]||short; };
export function salesforceEvaluationToPaste(text){
  const L=String(text||'').replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(Boolean);
  const common=[], blocks=[], notes=[]; const put=(arr,key,v)=>{ if(v===null||v===undefined||v==='') return; if(!arr.some(x=>x.key===key)) arr.push({key,v:typeof v==='number'?sf_fmt(v):String(v)}); };
  // En-tête : « OPE-004588 » / nom / voie / « 59174 LA SENTINELLE » (le premier « OPE-… » de la page est suivi de « Prévisualiser »).
  const o=L.findIndex((l,i)=>/^OPE-\d{6}$/.test(l)&&[i+2,i+3].some(k=>/^\d{5}\s+\S/.test(L[k]||'')));
  if(o>=0){ put(common,'internal_code',L[o]); if(L[o+1]) put(common,'operation_name',L[o+1]);
    const c=[o+2,o+3].find(i=>/^\d{5}\s+\S/.test(L[i]||'')); if(c!==undefined){ const [,cp,city]=L[c].match(/^(\d{5})\s+(.+)$/); if(c===o+3) put(common,'address',L[o+2]); put(common,'postcode',cp); put(common,'city',city);
      if(!cp.startsWith('20')) put(common,'department',cp.startsWith('97')?cp.slice(0,3):cp.slice(0,2)); } }
  else { const any=String(text).match(/\bOPE-\d{6}\b/); if(any) put(common,'internal_code',any[0]); }
  const contract=String(text).match(/Statut du contrat\s+(\d{8})\b/); if(contract) put(common,'contract_number',contract[1]);
  const ref=L.find(l=>/^R[ée]f[ée]rentiel\s+.+\s+-\s+Version\b/i.test(l)); if(ref) put(common,'reference_name',ref.replace(/^R[ée]f[ée]rentiel\s+/i,'').replace(/\s+-\s+Version\b.*$/i,''));
  const moa=L.find(l=>/^Ma[iî]tre d.ouvrage\s*:\s*\S/i.test(l)); if(moa) put(common,'owner_company',moa.replace(/^[^:]*:\s*/,''));
  const ouv=[...String(text).matchAll(/(\d+)\s+logement\(s\)\s*-\s*(\d+)\s+b[âa]timent\(s\)/gi)]; if(ouv.length){ put(common,'housing_total',ouv.reduce((a,m)=>a+Number(m[1]),0)); put(common,'building_total',ouv.reduce((a,m)=>a+Number(m[2]),0)); }
  // Listes « Mentions : » et « Performance : » : une valeur par ligne jusqu'au libellé suivant (« … : »).
  const listAfter=re=>{ const i=L.findIndex(l=>re.test(l)); if(i<0) return []; const out=[]; for(let j=i+1;j<L.length&&!/:\s*$/.test(L[j])&&!/^\.$/.test(L[j]);j++) out.push(L[j]); return out; };
  const mentions=listAfter(/^Mentions\s*:\s*$/i).filter(m=>!/^aucune?$/i.test(m));
  if(mentions.length){ put(common,'mentions',mentions.join(', ')); for(const m of mentions){ const k=fp_strictLabel(`Mention ${m}`); if(k&&k.startsWith('mention_')) put(common,k,'Oui'); } }
  const levels=FIELD_DEFS.filter(f=>/_level$/.test(f.key)).sort((a,b)=>b.label.length-a.label.length);
  for(const line of listAfter(/^Performance\s*:\s*$/i)){ const f=levels.find(d=>normLower(line).startsWith(normLower(d.label)+' ')); if(f) put(common,f.key,line.slice(f.label.length).trim()); }
  // Section « Performance thermique » : blocs par bâtiment jusqu'à la première section d'enveloppe.
  let i=L.findIndex(l=>/^Performance thermique$/i.test(l))+1, cur=null;
  const isField=l=>!!(sf_ALIASES[sf_key(l)]||fp_strictLabel(l)||fp_dhZone(l)||matchFreeLabel(l));
  // « Bbio : 84,4 / 91,8 / -8,1 % » = valeur / maximum / gain ; « ICconstruction : 767,85 / 780,02 » = valeur / maximum.
  const TRIPLES={bbio:['bbio_max','bbio_gain'],cep:['cep_max','cep_gain'],cepnr:['cepnr_max','cepnr_gain'],ic_construction:['ic_construction_max'],ic_energy:['ic_energy_max']};
  for(;i>0&&i<L.length&&!sf_section(L[i]);i++){
    // En-tête de bâtiment : « ILOT_1 : », « Maison 1 = », « ILOT_4 : (ilot 5 sur ACV) », « * BEG-1/2 : x2 lgts indiv : ».
    const t=L[i].replace(/^[*•]\s*/,''), h=t.match(/^(.{1,60}?)\s*[=:]\s*(.*?)\s*:?\s*$/);
    if(h&&!isField(h[1])&&(!h[2]||/^\(.*\)$/.test(h[2])||/^x?\s*\d+\s*(?:lgts?|logements?)\b/i.test(h[2])||/:\s*$/.test(t))){
      cur={name:h[1].trim(),items:[],raw:{},extra:[]}; blocks.push(cur);
      const nb=h[2].match(/^x?\s*(\d+)\s*(?:lgts?|logements?)\b/i); if(nb) cur.raw.housing_count=Number(nb[1]); else if(h[2]) notes.push(`${cur.name} : ${h[2].replace(/^\(|\)$/g,'').trim()} (remarque de la fiche).`); continue; }
    const m=L[i].match(/^(.{1,80}?)\s*[=:]\s*(.+)$/); if(!m) continue; const b=cur||{items:common,raw:{},extra:[]};
    if(fp_dhZone(m[1])){ if(cur) b.extra.push(`${m[1].trim()} = ${m[2].trim()}`); continue; }
    const key=sf_ALIASES[sf_key(m[1])]||fp_strictLabel(m[1]); if(!key||key in b.raw) continue;
    if(TRIPLES[key]&&m[2].includes('/')){ const parts=m[2].split('/').map(sf_num); if(parts[0]===null) continue; b.raw[key]=parts[0]; TRIPLES[key].forEach((k,j)=>{ if(parts[j+1]!=null&&!(k in b.raw)) b.raw[k]=parts[j+1]; }); if(!cur) TRIPLES[key].forEach(k=>k in b.raw&&put(common,k,b.raw[k])); if(!cur) put(common,key,parts[0]); continue; }
    // « DH : 713,9 et 625 » : deux zones sans type ; on retient la plus défavorable (comme la lecture des RSET).
    if(key==='dh'&&/\bet\b|\//.test(m[2])){ const vals=m[2].split(/\bet\b|\//).map(sf_num).filter(x=>x!==null); if(vals.length){ b.raw.dh=Math.max(...vals); if(!cur) put(common,'dh',b.raw.dh); } continue; }
    const v=FIELD_MAP[key].type==='number'?sf_num(m[2]):m[2]; if(v===null) continue; b.raw[key]=v; if(!cur) put(common,key,v); }
  for(const b of blocks){
    const n=b.name.match(/^(?:maisons?|villas?|pavillons?)\s+(.+)$/i); if(n&&b.raw.housing_count===undefined){ const parts=n[1].split(/\s*(?:[\/,&+]|\bet\b)\s*/).filter(Boolean); if(parts.length&&parts.every(x=>/^\d+[a-z]?$/i.test(x))) b.raw.housing_count=parts.length; }
    for(const [g,v,mx] of [['bbio_gain','bbio','bbio_max'],['cep_gain','cep','cep_max'],['cepnr_gain','cepnr','cepnr_max']]){
      const val=b.raw[v], max=b.raw[mx]; if(!(g in b.raw)||val==null||!max) continue;
      const calc=(max-val)/max*100; b.raw[g]=Math.abs(b.raw[g])*(calc<0?-1:1);
      if(Math.abs(Math.abs(calc)-Math.abs(b.raw[g]))>0.6) notes.push(`${b.name} : ${sf_label(g)} ${sf_fmt(b.raw[g])} % ne correspond pas à ${sf_label(v)} ${sf_fmt(val)} et ${sf_label(mx)} ${sf_fmt(max)} (gain calculé ${sf_fmt(Math.round(calc*10)/10)} %) : vérifiez la fiche.`); }
    for(const k of Object.keys(FIELD_MAP)) if(k in b.raw) put(b.items,k,b.raw[k]); }
  const blockLines=b=>[...b.items.map(x=>`${sf_label(x.key)} = ${x.v}`),...(b.extra||[])];
  // Enveloppe et systèmes : une section par en-tête, les sous-sections « - Notes » sont ignorées.
  const sec={}; let s=null;
  for(let j=Math.max(0,L.findIndex(l=>/^Performance thermique$/i.test(l)));j<L.length;j++){ if(/^Informations syst[eè]me/i.test(L[j])) break;
    const h=sf_section(L[j]); if(h){ s=h[0]==='notes'?null:h[0]; if(s&&h[1]) (sec[s]=sec[s]||[]).push(h[1]); continue; } if(s) (sec[s]=sec[s]||[]).push(L[j]); }
  const thick=l=>{ const m=l.match(/(?:\b[eé]p(?:aisseur)?\.?\s*:?\s*)?(\d+(?:[.,]\d+)?)(?:\s*\+\s*\d+(?:[.,]\d+)?)*\s*(mm|cm)\b/i); return m?parseFrNumber(m[1])*(m[2].toLowerCase()==='cm'?10:1):null; };
  const rval=l=>{ const m=l.match(/\bR\s*(?:=|≥|>=)\s*(\d+(?:[.,]\d+)?)/i); return m?parseFrNumber(m[1]):null; };
  const product=l=>{ const m=l.match(/\b(?:[Dd]oublage|[Ii]solant|[Ii]solation)\s+(?:IT[IE]\s+)?([A-Z][A-Z0-9-]{2,}(?:\s+[A-Z0-9][A-Z0-9-]+)?)/); return m?m[1]:null; };
  // Sous-titre « Murs de refend entre logements : » : parois intérieures, hors enveloppe.
  const INNER=/refend|entre\s+(?:logements|logts)|s[ée]parati|mitoyen/i;
  const outer=list=>{ let skip=false; return (list||[]).filter(raw=>{ if(/:\s*$/.test(raw)&&!/^\s*[-–•*+]/.test(raw)){ skip=INNER.test(raw); return false; } if(INNER.test(String(raw).split(':')[0])) return false; return !skip; }); };
  for(const part of ['roof','wall','floor']) for(const raw of outer(sec[part])){ const l=sf_clean(raw); if(!l) continue; const r=rval(l);
    const mat=findFirstMatch(l,MATERIALS)||product(l);
    // Une ligne avec R n'est un isolant que si elle le dit (matériau reconnu ou mot d'isolation) : « Brique … R=1,5 » est la structure.
    if(r!==null&&(mat||/isol|doublage|laine|ouate|polystyr|polyur|sous\s+chape|fibre/i.test(l))){ const side=part==='wall'?wallInsulationSide(l):null; const pre=part==='wall'&&side?`wall_${side}`:part; const keys=side?[`${pre}_insulation`,`${pre}_thickness`,`${pre}_r`]:[`${pre}_insulation`,`${pre}_insulation_thickness`,`${pre}_insulation_r`];
      put(common,keys[0],mat); put(common,keys[1],thick(l)); put(common,keys[2],r); }
    else { const st=findFirstMatch(l,STRUCTURES); if(st) put(common,`${part}_structure`,st); } }
  for(const raw of sec.win||[]){ const l=sf_clean(raw); if(!l||/^fen[eê]tres?\s+de\s+toit/i.test(l)) continue; put(common,'window_material',findFirstMatch(l,WINDOW_MATERIALS)); put(common,'window_glazing',findFirstMatch(l,GLAZINGS));
    put(common,'window_shading',findFirstMatch(l,SHADINGS)||(/^occultations?\s*:\s*\S/i.test(l)?l.replace(/^[^:]*:\s*/,''):null)); }
  const joined=k=>{ const out=[]; for(const raw of sec[k]||[]){ if(/^\s*(?:[ée]metteurs?|radiateurs?|r[ée]gulation)\b/i.test(raw)) break; if(/:\s*$/.test(raw)&&!/^\s*[*•+]/.test(raw)) continue; if(out.length&&/radiateurs?\b|s[eè]che[- ]serviettes?|[ée]metteurs?|plancher\s+chauffant|convecteurs?/i.test(raw)) continue; const x=sf_clean(raw).replace(/^(?:ecs|chauffage|ventilation)\s*:\s*/i,'').replace(/\s*[,;:]\s*$/,''); if(x&&!/^(?:ras|nc|so|aucun\w*)$/i.test(x)) out.push(x); } return out.slice(0,3).join(' + '); };
  put(common,'heating_mode_after',joined('heat')); put(common,'ecs',joined('ecs'));
  const vent=(sec.vent||[]).map(sf_clean).join(' ').toLowerCase();
  put(common,'ventilation',/double\s+flux/.test(vent)?'VMC double flux':/hygro/.test(vent)&&/hygro\s*-?\s*b\b|classe\s*b\b|type\s*b\b/.test(vent)?'VMC Hygro B':/hygro/.test(vent)&&/hygro\s*-?\s*a\b|classe\s*a\b|type\s*a\b/.test(vent)?'VMC Hygro A':/simple\s+flux|autor[ée]glable/.test(vent)?'VMC simple flux autoréglable':null);
  const enr=(sec.enr||[]).map(sf_clean).join(' '); if(/^(?:aucune?|non|n[ée]ant|sans objet|so)\.?$/i.test(enr)) put(common,'enr','Non');
  const line=x=>`${sf_label(x.key)} = ${x.v}`;
  return {text:[...common.map(line),...blocks.flatMap(b=>['',`${b.name} :`,...blockLines(b)])].join('\n'),notes};
}
