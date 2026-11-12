// ExtracTerre — règles de l'import massif (contrats, sous-dossiers, fichiers, versions, classement).
// Fonctions pures : aucune lecture de fichier, aucun accès réseau. Utilisées par le script
// tools/import (Node) et, plus tard, par la vue « Suivi des sources » de l'appli.
// Toutes les listes viennent de la configuration (tools/import/import.config.json).

// Minuscules, sans accents, apostrophes et espaces uniformisés.
export function ir_norm(s=''){
  return String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’‘`]/g,"'").replace(/ /g,' ').toLowerCase().replace(/\s+/g,' ').trim();
}

// ---------- Numéros de contrat ----------

// « 0000-5361 », « 5361 », « 00005361 » → « 00005361 ». Vide si ce n'est pas un numéro.
export function contractKey(raw,width=8){
  const s=String(raw??'').replace(/[\s._-]+/g,'');
  if(!/^\d+$/.test(s)) return '';
  const v=s.replace(/^0+/,'');
  if(!v||v.length>width) return '';
  return v.padStart(width,'0');
}

function ir_csvSplit(line,sep){
  const out=[]; let cur='',q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){ if(c==='"'&&line[i+1]==='"'){ cur+='"'; i++; } else if(c==='"') q=false; else cur+=c; }
    else if(c==='"') q=true; else if(c===sep){ out.push(cur); cur=''; } else cur+=c;
  }
  out.push(cur); return out;
}

// Fichier de contrats : TXT (un numéro par ligne) ou CSV (colonne choisie par nom ou par numéro, 1 = première).
export function parseContractList(text,{column=null,width=8}={}){
  const lines=String(text??'').replace(/^﻿/,'').split(/\r?\n/);
  const keys=[],invalid=[],duplicates=[]; const seen=new Set();
  const first=lines.find(l=>l.trim())||'';
  const sep=[';',',','\t'].map(s=>[s,first.split(s).length]).sort((a,b)=>b[1]-a[1])[0];
  const isCsv=column!=null||sep[1]>1;
  let col=0,start=0;
  if(isCsv){
    const head=ir_csvSplit(first,sep[0]).map(x=>x.trim());
    if(column!=null&&/^\d+$/.test(String(column))) col=Number(column)-1;
    else if(column!=null){ col=head.findIndex(h=>ir_norm(h)===ir_norm(column)); if(col<0) throw new Error(`Colonne « ${column} » absente du fichier de contrats (colonnes : ${head.join(', ')}).`); }
    if(!contractKey(head[col],width)) start=lines.indexOf(first)+1; // ligne d'en-tête
  }
  lines.forEach((line,i)=>{
    if(i<start||!line.trim()) return;
    const raw=(isCsv?ir_csvSplit(line,sep[0])[col]:line)?.trim()||'';
    if(!raw||raw.startsWith('#')) return;
    const k=contractKey(raw,width);
    if(!k){ invalid.push({line:i+1,value:raw}); return; }
    if(seen.has(k)){ duplicates.push(k); return; }
    seen.add(k); keys.push(k);
  });
  return {keys,invalid,duplicates};
}

// Contrats portés par un nom de dossier d'opération.
// Seule la tête du nom compte (avant le premier mot) : « 00001629 ET 00001630 - 59 - … »,
// « 00001807, 1808, 1806 - 93 - … », « 95-3991 - … ». Les numéros de 2 chiffres (départements) sont écartés.
// Comparaison par valeur : « 0153 » ≠ « 01534 ».
export function folderContracts(name,cfg={}){
  const width=cfg.contractWidth||8, minDigits=cfg.minContractDigits||3;
  let s=String(name??'').normalize('NFC');
  let cancelled=false;
  const cancel=new RegExp(`^\\s*(?:${(cfg.cancelledPrefixes||['annule','annulee','annulé','annulée']).map(x=>ir_norm(x).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b\\s*[-–:]?\\s*`,'i');
  const n=ir_norm(s);
  const m=n.match(cancel); if(m){ cancelled=true; s=n.slice(m[0].length); } else s=n;
  // « 07-011 - 0386 - CP Annule - … », « 13-009 - 2117 - Annulée - … » : mention d'annulation ailleurs dans le nom.
  if(!cancelled&&/(?:^|[^a-z])annul(?:e|ee|es|ees)?(?![a-z])/.test(n)) cancelled=true;
  const head=(s.match(/^[\d\s,;+&\/._–-]*(?:(?:et|and)\b[\d\s,;+&\/._–-]*)*/)||[''])[0];
  const contracts=[];
  for(const run of head.match(/\d+/g)||[]){
    // « 76-008 - 1480 - … » : « 008 » (code commune) n'est pas un contrat — au moins minDigits chiffres significatifs.
    if(run.replace(/^0+/,'').length<minDigits) continue;
    const k=contractKey(run,width); if(k&&!contracts.includes(k)) contracts.push(k);
  }
  return {contracts,cancelled};
}

// Rapprochement liste de contrats ↔ dossiers. folders = [noms]. Sans liste : tous les contrats trouvés.
export function matchContracts(folders,wanted=null,cfg={}){
  const byKey=new Map(), cancelledByKey=new Map(), shared=[];
  for(const name of folders){
    const {contracts,cancelled}=folderContracts(String(name).split('/').pop(),cfg);
    if(!contracts.length) continue;
    const target=cancelled?cancelledByKey:byKey;
    for(const k of contracts){ if(!target.has(k)) target.set(k,[]); target.get(k).push(name); }
    if(!cancelled&&contracts.length>1) shared.push({folder:name,contracts});
  }
  const keys=wanted||[...byKey.keys()].sort();
  const found=[],missing=[],multiple=[],onlyCancelled=[];
  for(const k of keys){
    let hits=byKey.get(k)||[];
    // Même contrat à la racine et dans un dossier d'archive (« 00 - Certifications réalisées - Archivage/… ») : la racine prime.
    if(hits.length>1){ const top=hits.filter(h=>!String(h).includes('/')); if(top.length===1) hits=top; }
    if(hits.length===1) found.push({contract:k,folder:hits[0],sharedWith:(folderContracts(String(hits[0]).split('/').pop(),cfg).contracts).filter(x=>x!==k)});
    else if(hits.length>1) multiple.push({contract:k,folders:hits});
    else if(cancelledByKey.has(k)) onlyCancelled.push({contract:k,folders:cancelledByKey.get(k)});
    else missing.push(k);
  }
  return {found,missing,multiple,onlyCancelled,shared:shared.filter(s=>s.contracts.some(k=>keys.includes(k)))};
}

// ---------- Sous-dossiers ----------

// « 03 - Études Thermiques » → ['etude','thermique'] (numérotation retirée, pluriels ramenés au singulier).
export function folderTokens(name){
  const n=ir_norm(name).replace(/^[\d\s._)(\]–-]+(?=[a-z])/,'');
  return n.split(/[^a-z0-9]+/).filter(Boolean).map(t=>t.length>3&&/[^s]s$/.test(t)?t.slice(0,-1):t);
}
function ir_hasSeq(tokens,seq){
  if(!seq.length) return false;
  for(let i=0;i+seq.length<=tokens.length;i++) if(seq.every((t,j)=>tokens[i+j]===t)) return true;
  return false;
}
// Famille d'un sous-dossier (id de cfg.families) ou null. Les noms de cfg.notFamily (ex. « Évaluation thermique »,
// dossier qui contient CCTP, plans, DQE…) ne valent pas famille : on descend dedans pour chercher.
export function subfolderFamily(name,cfg={}){
  const m=folderFamilyMatch(name,cfg);
  return m.container?null:m.family;
}
// {family, container} : un dossier « conteneur » (cfg.notFamily) donne sa famille à ses fichiers directs seulement.
export function folderFamilyMatch(name,cfg={}){
  const tokens=folderTokens(name);
  const container=(cfg.notFamily||[]).some(x=>ir_hasSeq(tokens,folderTokens(x)));
  let family=null;
  for(const fam of cfg.families||[]) if((fam.synonyms||[]).some(x=>ir_hasSeq(tokens,folderTokens(x)))){ family=fam.id; break; }
  return {family,container};
}
export function isSkippedFolder(name,cfg={}){
  const n=ir_norm(name);
  if(n.startsWith('.')) return true;
  const tokens=folderTokens(name);
  return (cfg.skipFolders||[]).some(x=>ir_hasSeq(tokens,folderTokens(x)));
}
export function isArchiveFolder(name,cfg={}){
  const tokens=folderTokens(name);
  return (cfg.archiveFolders||[]).some(x=>ir_hasSeq(tokens,folderTokens(x)));
}

// ---------- Fichiers ----------

export function fileExtension(name){ const m=String(name).toLowerCase().match(/\.([a-z0-9]{1,6})$/); return m?m[1]:''; }
// Motif d'exclusion d'un fichier, ou null s'il est à garder.
export function fileIgnoreReason(name,cfg={}){
  const base=String(name??'');
  if((cfg.ignoreFileNames||[]).some(x=>ir_norm(x)===ir_norm(base))) return 'fichier système';
  if((cfg.ignoreFilePrefixes||[]).some(p=>base.startsWith(p))) return 'fichier temporaire';
  const ext=fileExtension(base);
  if(!ext) return 'sans extension';
  if((cfg.ignoreExtensions||[]).includes(ext)) return `extension ignorée (.${ext})`;
  if(!(cfg.readableExtensions||[]).includes(ext)) return `format non lu par ExtracTerre (.${ext})`;
  return null;
}

// ---------- Versions ----------

const IR_MONTH_OK=(y,m,d)=>y>=2000&&y<=2099&&m>=1&&m<=12&&d>=1&&d<=31;
function ir_iso(y,m,d){ return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

// Date la plus récente lue dans un texte (nom ou chemin) : AAAA-MM-JJ, AAAAMMJJ, JJ-MM-AAAA, JJ MM AAAA.
export function dateIn(text){
  const n=ir_norm(text); let best=null;
  const take=(y,m,d)=>{ y=+y;m=+m;d=+d; if(IR_MONTH_OK(y,m,d)){ const v=ir_iso(y,m,d); if(!best||v>best) best=v; } };
  for(const m of n.matchAll(/(?<!\d)(20\d\d)[-_. ]?(\d\d)[-_. ]?(\d\d)(?!\d)/g)) take(m[1],m[2],m[3]);
  for(const m of n.matchAll(/(?<!\d)(\d\d)[-_. ](\d\d)[-_. ](20\d\d)(?!\d)/g)) take(m[3],m[2],m[1]);
  for(const seg of n.split('/')){
    // Dossier daté « 14 11 25 » (JJ MM AA, le nom entier est une date).
    const a=seg.trim().match(/^(\d\d)[-_. ](\d\d)[-_. ](\d\d)$/); if(a) take(`20${a[3]}`,a[2],a[1]);
    // Préfixe « 251111 - Note… » (AAMMJJ en tête du nom).
    const b=seg.trim().match(/^(\d\d)(\d\d)(\d\d)(?=\s*[-_ ])/); if(b) take(`20${b[1]}`,b[2],b[3]);
  }
  return best;
}

// Indice / numéro de version lu dans un nom de fichier (sans extension).
// scheme 'lettre' (ind A, indB, ind_C, CCTP-C) ou 'numero' (v2, V3, rev1, version 4, ind 2).
export function versionIndex(name,cfg={}){
  const raw=String(name??'').replace(/\.[a-z0-9]{1,6}$/i,'');
  const n=ir_norm(raw);
  const pats=cfg.versionPatterns||{};
  const tryList=(list,scheme)=>{
    for(const src of list||[]){
      const re=new RegExp(src,'i'); const m=(scheme==='lettre-fin'?raw:n).match(re);
      if(m&&m[1]) return m;
    }
    return null;
  };
  let m=tryList(pats.letter,'lettre'); if(m) return {scheme:'lettre',rank:m[1].toLowerCase().charCodeAt(0)-96,label:`ind ${m[1].toUpperCase()}`};
  m=tryList(pats.number,'numero'); if(m) return {scheme:'numero',rank:Number(m[1]),label:m[0].trim()};
  m=tryList(pats.letterSuffix,'lettre-fin'); if(m) return {scheme:'lettre',rank:m[1].toLowerCase().charCodeAt(0)-96,label:`ind ${m[1].toUpperCase()}`};
  return null;
}

// Clé de « famille » d'un document : nom sans version, date, mots de travail (final, def, copie…).
export function documentKey(name,cfg={}){
  let n=ir_norm(String(name??'').replace(/\.[a-z0-9]{1,6}$/i,''));
  const pats=cfg.versionPatterns||{};
  for(const src of [...(pats.letter||[]),...(pats.number||[])]) n=n.replace(new RegExp(src,'gi'),' ');
  n=n.replace(/(?<!\d)20\d\d[-_. ]?\d\d[-_. ]?\d\d(?!\d)/g,' ').replace(/(?<!\d)\d\d[-_. ]\d\d[-_. ]20\d\d(?!\d)/g,' ');
  n=n.replace(/\(\d+\)/g,' ');
  const words=(cfg.versionWords||[]).map(ir_norm);
  n=n.split(/[^a-z0-9]+/).filter(t=>t&&!words.includes(t)).join(' ');
  // « CCTP-C » : la lettre finale est un indice (déjà lue par versionIndex) — on la retire de la clé.
  const raw=String(name??'').replace(/\.[a-z0-9]{1,6}$/i,'');
  if((pats.letterSuffix||[]).some(src=>new RegExp(src).test(raw))) n=n.replace(/ [a-z]$/,'');
  return n.trim();
}

// Chemin du dossier, sans les dossiers datés ni d'archive : deux versions rangées dans « 12 11 2025 » et à la racine
// de « Étude thermique » restent comparables, « Bât A/CCTP » et « Bât B/CCTP » non.
export function versionFolderKey(relDir,cfg={}){
  return String(relDir??'').split('/').filter(Boolean)
    .filter(p=>!isArchiveFolder(p,cfg)&&!(dateIn(p)&&!folderTokens(p).some(t=>/[a-z]{3,}/.test(t)&&!/^\d+$/.test(t))))
    .map(p=>folderTokens(p).join(' ')).join('/');
}

// files : [{id, family, relDir, name, mtimeMs}] → Map id → {group, rank, current, ambiguous, label, reason}
export function rankVersions(files,cfg={}){
  const groups=new Map();
  for(const f of files){
    const info={...f,
      archived:String(f.relDir||'').split('/').some(p=>isArchiveFolder(p,cfg)),
      index:versionIndex(f.name,cfg),
      date:dateIn(f.name)||dateIn(f.relDir||''),
      key:`${f.family||''}|${versionFolderKey(f.relDir,cfg)}|${documentKey(f.name,cfg)}|${fileExtension(f.name)}`};
    if(!groups.has(info.key)) groups.set(info.key,[]);
    groups.get(info.key).push(info);
  }
  const out=new Map();
  for(const [key,list] of groups){
    const cmp=(a,b)=>{
      if(a.archived!==b.archived) return a.archived?1:-1;
      if(a.index&&b.index&&a.index.scheme===b.index.scheme&&a.index.rank!==b.index.rank) return b.index.rank-a.index.rank;
      if(a.date&&b.date&&a.date!==b.date) return a.date<b.date?1:-1;
      return (b.mtimeMs||0)-(a.mtimeMs||0);
    };
    list.sort(cmp);
    const [top,second]=list;
    let ambiguous=false,reason='';
    if(second&&top.archived===second.archived){
      const mixed=(!!top.index)!==(!!second.index)||(top.index&&second.index&&top.index.scheme!==second.index.scheme);
      const tied=!(top.index&&second.index&&top.index.rank!==second.index.rank)&&!(top.date&&second.date&&top.date!==second.date)&&Math.abs((top.mtimeMs||0)-(second.mtimeMs||0))<1000;
      if(mixed){ ambiguous=true; reason=`ordre des versions ambigu : « ${top.name} » et « ${second.name} » n'ont pas le même type d'indice`; }
      else if(tied){ ambiguous=true; reason=`ordre des versions ambigu : « ${top.name} » et « ${second.name} » sont indiscernables`; }
    }
    list.forEach((f,i)=>out.set(f.id,{group:key,rank:i+1,count:list.length,current:i===0,ambiguous:ambiguous&&i<2,reason:ambiguous&&i<2?reason:'',
      label:[f.index?.label,f.date,f.archived?'archive':''].filter(Boolean).join(' · ')}));
  }
  return out;
}

// ---------- Classement ----------

// Règles a → e. classify(fileName, text) = classifyDocument de l'appli (injecté pour garder ce module pur).
// xml : {re2020:'RSET'|'RSEE'|null, dpe:bool} si le fichier est un XML lu. text : texte de la 1re page (PDF) ;
// text === '' pour un PDF lu sans texte ; undefined si le contenu n'a pas été lu.
export function classifyImportFile({family=null,name='',xml=null,text,unknownType='Document inconnu'},classify,cfg={}){
  const fam=(cfg.families||[]).find(f=>f.id===family)||null;
  const compatible=t=>!fam||(fam.compatibleTypes||[]).includes(t);
  const ext=fileExtension(name);
  const steps=[];
  let type=fam?.presumedType||null, method=fam?'sous-dossier':'', doubt='';
  if(fam) steps.push(`a:${fam.presumedType}`);
  if(ext==='xml'){
    if(xml?.re2020){ const t=xml.re2020==='RSEE'?cfg.types?.rsee:cfg.types?.rset; steps.push(`b:${t}`); return {type:t,method:'structure XML',status:'à traiter',doubt:'',steps}; }
    if(xml?.dpe){ steps.push(`b:${cfg.types?.dpe}`); return {type:cfg.types?.dpe,method:'structure XML',status:'à traiter',doubt:'',steps}; }
    return {type:type||unknownType,method:method||'extension',status:'à vérifier',doubt:'XML non reconnu (ni RSET/RSEE RE2020, ni DPE)',steps:[...steps,'b:inconnu']};
  }
  const byName=classify(name,'');
  const nameType=byName&&byName.type!==unknownType&&byName.confidence>=(cfg.nameMinConfidence??0.6)?byName.type:null;
  if(nameType){ steps.push(`c:${nameType}`); if(compatible(nameType)){ type=nameType; method='nom du fichier'; } }
  if(text===''){ return {type:type||unknownType,method:method||'aucune',status:'à vérifier',doubt:'PDF sans texte (scan) : OCR nécessaire',steps:[...steps,'d:scan']}; }
  if(typeof text==='string'){
    const byText=classify(`document.${ext||'pdf'}`,text); // contenu seul : le nom est jugé à part (règle c)
    const textType=byText&&byText.type!==unknownType?byText.type:null;
    steps.push(`d:${textType||'inconnu'}`);
    if(textType&&compatible(textType)){ type=textType; method='contenu (1re page)'; }
    else if(textType&&!compatible(textType)){
      if(nameType&&compatible(nameType)) doubt=`indices contradictoires : nom → ${nameType}, contenu → ${textType}`;
      else doubt=`indices contradictoires : sous-dossier ${fam?.label||family} → ${fam?.presumedType}, contenu → ${textType}`;
      type=textType; method='contenu (1re page)';
    }
  } else if(nameType&&!compatible(nameType)){
    doubt=`indices contradictoires : sous-dossier ${fam?.label||family} → ${fam?.presumedType}, nom → ${nameType}`;
  }
  if(!type) return {type:unknownType,method:'aucune',status:'à vérifier',doubt:'aucun indice de type (sous-dossier, nom ou contenu)',steps};
  return {type,method,status:doubt?'à vérifier':'à traiter',doubt,steps};
}
