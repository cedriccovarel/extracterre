// v2.7.0 — collage libre : texte « libellé = valeur » (ou « : », tabulation), regroupé par bâtiment (« Bâtiment G : »).
// Chaque libellé est rapproché d'une colonne ExtracTerre ; les libellés inconnus peuvent être rangés par l'IA, qui ne
// choisit qu'une colonne : la valeur reste celle écrite dans le texte collé (jamais inventée).
import {FIELD_DEFS,FIELD_MAP,matchFieldByHeaderDetailed} from './config.js';
import {normLower,parseFrNumber} from './utils.js';

const fp_BUILDING=/^\s*((?:b[âa]t(?:iment)?\.?|immeuble|cage|plot|lot)\s*[\w-]{1,20}(?:\s+[\w-]{1,20})?)\s*:?\s*$/i;
const fp_PAIR=/^\s*(.{2,120}?)\s*(?:=|:|\t)\s*(.+?)\s*$/;
// Libellé sans unité finale : « DH des zones traversantes (en °C.h) » → « DH des zones traversantes ».
const fp_clean=l=>String(l||'').replace(/\((?:en|unit[eé])\s[^)]*\)\s*$/i,'').replace(/\s*\[[^\]]*\]\s*$/,'').trim();
function fp_value(field,raw){
  const def=FIELD_MAP[field]; const s=String(raw||'').trim();
  if(def?.type!=='number') return s||null;
  const m=s.replace(/ /g,' ').match(/[-+]?\d+(?:[ .]\d{3})*(?:[.,]\d+)?/); if(!m) return null;
  return parseFrNumber(m[0]);
}
// DH par type de zone : la colonne DH garde la plus défavorable (comme la lecture des RSET) ; le type de zone est noté.
function fp_dhZone(label){ const l=normLower(label); if(!/\bdh\b|degres?[- ]heures?/.test(l)||!/travers/.test(l)) return null; return /non\s+travers/.test(l)?'non':'oui'; }

export function matchFreeLabel(label){
  const clean=fp_clean(label); const r=matchFieldByHeaderDetailed(clean)||matchFieldByHeaderDetailed(label);
  return r?.def?.key&&r.def.key!=='building'?r.def.key:null;
}
// → {buildings:[{name,items:[{line,label,raw,field,value,auto}]}],unmatched:[{building,line,label,raw}]}
export function parseFreePaste(text){
  const out=[]; let cur=null; const unmatched=[];
  const ensure=name=>{ cur=out.find(b=>b.name===name)||{name,items:[]}; if(!out.includes(cur)) out.push(cur); return cur; };
  for(const line of String(text||'').replace(/\r/g,'').split('\n')){
    if(!line.trim()) continue;
    const b=line.match(fp_BUILDING); if(b&&!fp_PAIR.test(line.replace(/:\s*$/,''))){ { const n=b[1].replace(/\s+/g,' ').trim(); const k=n.match(/^b[âa]t(?:iment)?\.?\s*(.+)$/i); ensure(k?`Bâtiment ${k[1]}`:n); } continue; }
    const m=line.match(fp_PAIR); if(!m) { unmatched.push({building:cur?.name||'',line:line.trim(),label:'',raw:''}); continue; }
    const label=m[1].trim(), raw=m[2].trim(); const bld=cur||ensure('');
    const dz=fp_dhZone(label);
    if(dz){ const v=fp_value('dh',raw); if(v!==null){ bld.items.push({line:line.trim(),label,raw,field:'dh',value:v,auto:true,dhZone:dz}); continue; } }
    const field=matchFreeLabel(label);
    if(field){ const v=fp_value(field,raw); if(v!==null){ bld.items.push({line:line.trim(),label,raw,field,value:v,auto:true}); continue; } }
    unmatched.push({building:bld.name,line:line.trim(),label,raw});
  }
  return {buildings:out.filter(b=>b.items.length||unmatched.some(u=>u.building===b.name)),unmatched};
}
// Valeurs finales par bâtiment : une valeur par colonne ; DH = zone la plus défavorable, types de zones « Oui ».
export function freePasteValues(parsed){
  const res=[];
  for(const b of parsed.buildings||[]){
    const vals={}, src={};
    for(const it of b.items){
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
