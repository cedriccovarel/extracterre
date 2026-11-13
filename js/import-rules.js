// ExtracTerre — règles de l'import massif (contrats, sous-dossiers, fichiers, versions, classement).
// Fonctions pures : aucune lecture de fichier, aucun accès réseau. Utilisées par le script
// tools/import (Node) et, plus tard, par la vue « Suivi des sources » de l'appli.
// Toutes les listes viennent de la configuration (tools/import/import.config.json).

// Minuscules, sans accents, apostrophes et espaces uniformisés.
export function ir_norm(s=''){
  return String(s??'').replace(/œ/g,'oe').replace(/Œ/g,'OE').replace(/æ/g,'ae').replace(/Æ/g,'AE').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’‘`]/g,"'").replace(/ /g,' ').toLowerCase().replace(/\s+/g,' ').trim();
}

// ---------- Numéros de contrat ----------

// « 0000-5361 », « 5361 », « 00005361 » → « 00005361 ». Vide si ce n'est pas un numéro.
export function irContractKey(raw,width=8){
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
    if(!irContractKey(head[col],width)) start=lines.indexOf(first)+1; // ligne d'en-tête
  }
  lines.forEach((line,i)=>{
    if(i<start||!line.trim()) return;
    const raw=(isCsv?ir_csvSplit(line,sep[0])[col]:line)?.trim()||'';
    if(!raw||raw.startsWith('#')) return;
    const k=irContractKey(raw,width);
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
    const k=irContractKey(run,width); if(k&&!contracts.includes(k)) contracts.push(k);
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
// v2.36.0 — dossier de fichiers périmés, jamais lu : « OLD », « RENO 6 LGTS old », « Ancien », « Anciennes versions »,
// « Archives », « Obsolète », « Périmé », « Caduc », « Version précédente », « Ne pas utiliser »…
// « Ancien(ne) » suivi d'un autre mot (« 2. Ancienne Mairie », nom de bâtiment) reste lu.
const IR_OBSOLETE_WORDS=new Set(['old','obsolete','perime','perimee','caduc','caduque','archive','archivee','archivage','superseded','outdated','deprecated','remplace','remplacee']);
const IR_ANCIEN_GENERIC=new Set(['version','indice','ind','fichier','document','doc','dossier','etude','piece','cctp','rset','rsee','plan','note','envoi','v']);
export function isObsoleteFolder(name){
  const t=folderTokens(name);
  if(t.some(x=>IR_OBSOLETE_WORDS.has(x))) return true;
  const i=t.findIndex(x=>x==='ancien'||x==='ancienne'||x==='anc');
  if(i>=0&&t.slice(i+1).every(x=>IR_ANCIEN_GENERIC.has(x)||/^\d+$/.test(x))&&t.slice(0,i).every(x=>IR_ANCIEN_GENERIC.has(x)||/^\d+$/.test(x))) return true;
  const s=t.join(' ');
  return /\bversion (?:precedente|anterieure|obsolete)\b|\bne pas utiliser\b|\bnon valide\b|\ba (?:supprimer|jeter)\b/.test(s);
}
// Premier dossier périmé d'un chemin relatif au dossier de l'opération, ou null.
export function obsoleteFolderOf(relDir){ return String(relDir??'').split('/').filter(Boolean).find(isObsoleteFolder)||null; }
export function isArchiveFolder(name,cfg={}){
  const tokens=folderTokens(name);
  return (cfg.archiveFolders||[]).some(x=>ir_hasSeq(tokens,folderTokens(x)));
}

// ---------- Fichiers ----------

export function fileExtension(name){ const m=String(name).toLowerCase().match(/\.([a-z0-9]{1,6})$/); return m?m[1]:''; }
// Motif d'exclusion d'un fichier, ou null s'il est à garder.
// v2.32.2 — fiches FDES (fiches produit INIES) : jamais lues, elles ne décrivent pas le projet. Mot « FDES » dans le nom du fichier.
export function isFdesName(name){ return /(^|[^a-z0-9])fdes([^a-z]|$)/.test(ir_norm(String(name??'').replace(/\.[a-z0-9]{1,6}$/i,'')).replace(/_/g,' ')); }
export function fileIgnoreReason(name,cfg={}){
  const base=String(name??'');
  if(isFdesName(base)) return 'fiche FDES (non lue)';
  if((cfg.ignoreFileNames||[]).some(x=>ir_norm(x)===ir_norm(base))) return 'fichier système';
  if((cfg.ignoreFilePrefixes||[]).some(p=>base.startsWith(p))) return 'fichier temporaire';
  const ext=fileExtension(base);
  if(!ext) return 'sans extension';
  if((cfg.ignoreExtensions||[]).includes(ext)) return `extension ignorée (.${ext})`;
  if(!(cfg.readableExtensions||[]).includes(ext)) return `format non lu par ExtracTerre (.${ext})`;
  // v2.25.0 — pièces de correspondance ou annexes reconnues à leur nom (mails, courriers, retours de NC, PV, catalogues…).
  const plain=ir_norm(base.replace(/\.[a-z0-9]{1,6}$/i,'')).replace(/[_.]+/g,' ');
  for(const src of cfg.ignoreNamePatterns||[]){ try{ if(new RegExp(src,'i').test(plain)) return 'correspondance ou pièce annexe (nom du fichier)'; }catch{} }
  return null;
}

// v2.29.0 — lots de CCTP : un fichier dont le nom désigne un lot n'est lu que si ce lot est utile aux Recherches (wanted).
// Un CCTP sans lot identifiable (« CCTP.pdf », « CCTP compilé ») est toujours lu.
const IR_LOT_WORDS=['gros oeuvre','maconnerie','demolition','desamiantage','terrassement','fondation','charpente','couverture','zinguerie','etancheite','bardage','facade','ravalement','isolation thermique','ite','menuiserie','serrurerie','metallerie','platrerie','cloison','doublage','faux plafond','plafond','peinture','revetement','sols','carrelage','faience','parquet','electricite','courants faibles','cvc','chauffage','ventilation','vmc','plomberie','sanitaire','climatisation','ascenseur','vrd','espaces verts','espaces exterieurs','amenagements exterieurs','cloture','portail','nettoyage','echafaudage','generalites','structure','ossature','beton','automatisme','controle d acces','interphonie','photovoltaique','ecs','equipements'];
export function cctpLotDecision(name,wanted=[]){
  const plain=' '+ir_norm(String(name).replace(/\.[a-z0-9]{1,6}$/i,'')).replace(/[_.\-–—()]+/g,' ').replace(/\s+/g,' ')+' ';
  const ABBR={'electricite':['elec','cfo','cfa','courants forts','courant fort','courant faible'],'plomberie':['plb','plomb'],'menuiserie':['mex','min','menuis'],'menuiseries exterieures':['mex'],'menuiseries interieures':['min'],
    'serrurerie':['serr'],'metallerie':['metal'],'gros oeuvre':['go'],'chauffage':['chauf'],'ventilation':['vent'],'climatisation':['clim'],'courants faibles':['cfa'],'vrd':['voirie']};
  const W=[...new Set((wanted||[]).flatMap(w=>{ const k=ir_norm(w).replace(/[_.\-–—()]+/g,' ').replace(/\s+/g,' ').trim(); return [k,...(ABBR[k]||[])]; }))].filter(Boolean).map(w=>' '+w+' ');
  if(!W.length) return {read:true,reason:''};
  const has=w=>plain.includes(w)||plain.includes(w.trimEnd()+'s ');
  if(W.some(has)) return {read:true,reason:'lot utile aux Recherches'};
  const lotWords=IR_LOT_WORDS.map(w=>' '+w+' ').filter(has);
  const isLot=lotWords.length||/ lot ?n?°? ?\d/.test(plain);
  if(!isLot) return {read:true,reason:''};
  return {read:false,reason:`lot CCTP hors thèmes des Recherches${lotWords.length?` (${lotWords.map(w=>w.trim()).slice(0,2).join(', ')})`:''}`};
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
      // v2.25.0 — indice d'un seul côté : la date de modification départage ; ambigu seulement si le fichier sans indice est plus récent.
      const lone=mixed&&(!!top.index)!==(!!second.index);
      const indexedNewer=lone&&((top.index?top:second).mtimeMs||0)>=((top.index?second:top).mtimeMs||0);
      if(lone&&indexedNewer){ const w=top.index?top:second; if(w!==top){ const i=list.indexOf(w); list.splice(i,1); list.unshift(w); } }
      else if(mixed){ ambiguous=true; reason=`ordre des versions ambigu : « ${top.name} » et « ${second.name} » n'ont pas le même type d'indice`; }
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
// v2.25.0 — appType : type donné par l'appli après lecture du document entier (même classement que le glisser-déposer).
// Vote des indices : sous-dossier + au moins un autre indice compatible (nom, 1re page, document entier) = accepté ;
// 1re page et document entier d'accord sur un autre type = accepté, avec une note « rangé dans … » ;
// « à vérifier » seulement si les indices se contredisent sans majorité, ou s'il n'y en a aucun.
export function classifyImportFile({family=null,name='',xml=null,text,appType=null,unknownType='Document inconnu'},classify,cfg={}){
  const fam=(cfg.families||[]).find(f=>f.id===family)||null;
  const compatible=t=>!!t&&(!fam||(fam.compatibleTypes||[]).includes(t));
  const ext=fileExtension(name);
  const known=t=>t&&t!==unknownType?t:null;
  const A=known(appType);
  const steps=[];
  if(fam) steps.push(`a:${fam.presumedType}`);
  if(ext==='xml'){
    if(xml?.re2020){ const t=xml.re2020==='RSEE'?cfg.types?.rsee:cfg.types?.rset; steps.push(`b:${t}`); return {type:t,method:'structure XML',status:'à traiter',doubt:'',note:'',steps}; }
    if(xml?.dpe){ steps.push(`b:${cfg.types?.dpe}`); return {type:cfg.types?.dpe,method:'structure XML',status:'à traiter',doubt:'',note:'',steps}; }
    if(xml?.other==='thcex') return {type:cfg.types?.rtex||'RT Existant',method:'structure XML (entrée ThCEx)',status:'à traiter',doubt:'',note:'',steps:[...steps,'b:thcex']};
    if(xml?.other==='controle') return {type:cfg.types?.thermal||'Étude thermique',method:'structure XML (dossier de contrôle)',status:'à traiter',doubt:'',note:'dossier de contrôle thermique (XML)',steps:[...steps,'b:controle']};
    if(xml?.other==='dce') return {type:A||unknownType,method:'structure XML (index de DCE)',status:'à traiter',doubt:'',note:'index de DCE : liste de documents, rien à lire',steps:[...steps,'b:dce']};
    // XML d'un autre logiciel (ThCEx, ClimaWin…) : la lecture complète de l'appli tranche.
    if(A&&compatible(A)) return {type:A,method:'lecture complète (appli)',status:'à traiter',doubt:'',note:'',steps:[...steps,`b:${A}`]};
    return {type:fam?.presumedType||unknownType,method:fam?'sous-dossier':'extension',status:'à vérifier',doubt:A?`XML lu comme ${A}, rangé dans ${fam?.label||family}`:'XML non reconnu (ni RSET/RSEE RE2020, ni DPE)',note:'',steps:[...steps,'b:inconnu']};
  }
  const byName=classify(name,'');
  let N=byName&&byName.confidence>=(cfg.nameMinConfidence??0.6)?known(byName.type):null;
  // v2.25.0 — indices de nom propres à la famille du dossier (ex. « LOT 11 - ÉLECTRICITÉ » dans CCTP).
  if(!(N&&compatible(N))&&fam){ const plain=ir_norm(name).replace(/[_.]+/g,' '); if((fam.nameHints||[]).some(src=>{ try{ return new RegExp(src,'i').test(plain); }catch{ return false; } })) N=fam.presumedType; }
  if(N) steps.push(`c:${N}`);
  if(text===''&&!A) return {type:(compatible(N)&&N)||fam?.presumedType||unknownType,method:compatible(N)?'nom du fichier':fam?'sous-dossier':'aucune',status:'à vérifier',doubt:'PDF sans texte (scan) : OCR nécessaire',note:'',steps:[...steps,'d:scan']};
  let T=null;
  if(typeof text==='string'&&text){ const byText=classify(`document.${ext||'pdf'}`,text); T=known(byText?.type); steps.push(`d:${T||'inconnu'}`); }
  if(A) steps.push(`e:${A}`);
  // 1. Le sous-dossier et au moins un autre indice sont d'accord.
  const ok=[[T,'contenu (1re page)'],[N,'nom du fichier'],[A,'lecture complète (appli)']].find(([t])=>compatible(t));
  if(ok&&fam) return {type:ok[0],method:ok[1],status:'à traiter',doubt:'',note:'',steps};
  if(!fam){ const any=[[T,'contenu (1re page)'],[N,'nom du fichier'],[A,'lecture complète (appli)']].find(([t])=>t); return any?{type:any[0],method:any[1],status:'à traiter',doubt:'',note:'',steps}:{type:unknownType,method:'aucune',status:'à vérifier',doubt:'aucun indice de type (nom ou contenu)',note:'',steps}; }
  // 2. Le contenu (1re page et document entier) désigne un autre type : document rangé ailleurs, accepté avec une note.
  const votes=[T,N,A].filter(Boolean), major=votes.find(t=>votes.filter(x=>x===t).length>=2);
  if(major) return {type:major,method:T===major?'contenu (1re page)':'lecture complète (appli)',status:'à traiter',doubt:'',note:`rangé dans « ${fam.label} » mais lu comme ${major}`,steps};
  // 3. Indices sans majorité.
  const seen=[T&&`1re page → ${T}`,A&&A!==T&&`document entier → ${A}`,N&&`nom → ${N}`].filter(Boolean);
  if(seen.length) return {type:T||A||N,method:T?'contenu (1re page)':A?'lecture complète (appli)':'nom du fichier',status:'à vérifier',doubt:`indices contradictoires : sous-dossier ${fam.label} → ${fam.presumedType}, ${seen.join(', ')}`,note:'',steps};
  // 4. Seul le sous-dossier parle : type présumé.
  return {type:fam.presumedType,method:'sous-dossier',status:'à traiter',doubt:'',note:'',steps};
}
