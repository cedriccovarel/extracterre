// v2.7.0 — collage libre : texte « libellé = valeur » (ou « : », tabulation), regroupé par bâtiment (« Bâtiment G : »).
// Chaque libellé est rapproché d'une colonne ExtracTerre ; les libellés inconnus peuvent être rangés par l'IA, qui ne
// choisit qu'une colonne : la valeur reste celle écrite dans le texte collé (jamais inventée).
import {FIELD_DEFS,FIELD_MAP,matchFieldByHeaderDetailed,DOC_TYPES,STRUCTURES,SHADINGS} from './config.js';
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
// → {buildings:[{name,items:[{line,label,raw,field,value,auto}]}],unmatched:[{building,line,label,raw}],descriptive:[lignes de texte]}
export function parseFreePaste(text){
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
    const descLine=!m||/^\s*[-–>*]/.test(line)||/\s[-–]\s/.test(m[1])||/[ée]paisseur|performances/i.test(m[1]);
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
  const desc=descriptiveItems(descriptive);
  if(desc.length) out.push({name:'*',items:desc});
  return {buildings:out.filter(b=>b.items.length||unmatched.some(u=>u.building===b.name)),unmatched,descriptive};
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
