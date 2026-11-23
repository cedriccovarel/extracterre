#!/usr/bin/env node
// ExtracTerre — service d'import : exécute les demandes déposées par l'appli (bouton « Coller une liste de contrats »)
// dans <dossier de travail>/demandes. Une demande à la fois ; avancement dans <id>.statut.json, journal dans <id>.log.
// Lancé à l'ouverture de session par installer-service.mjs (LaunchAgent). Lecture seule sur Box, comme le script.
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawn} from 'child_process';
import {fileURLToPath} from 'url';
import {restartBox} from './lib/box.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const cfg=JSON.parse(fs.readFileSync(path.join(HERE,'import.config.json'),'utf8'));
const home=p=>String(p||'').replace(/^~(?=\/|$)/,os.homedir());
const workDir=home(process.env.EXTRACTERRE_WORKDIR||cfg.dossierTravail||'~/ExtracTerre-import');
const dir=path.join(workDir,'demandes');
const VERSION='2';
// v2.28.0 — arrêt / annulation : l'appli dépose <id>.stop ; le service arrête l'analyse en cours (fin du document en cours,
// registre enregistré) ou annule une demande en attente. Le service redémarre seul quand son code est mis à jour.
const SELF=fileURLToPath(import.meta.url), CODE_MTIME=fs.statSync(SELF).mtimeMs;
let current=null;
let busy=false;

const writeJson=(f,o)=>{ const tmp=`${f}.tmp`; fs.writeFileSync(tmp,JSON.stringify(o,null,1)); fs.renameSync(tmp,f); };
const readJson=f=>{ try{ return JSON.parse(fs.readFileSync(f,'utf8')); }catch{ return null; } };
const heartbeat=extra=>{ try{ fs.mkdirSync(dir,{recursive:true}); writeJson(path.join(dir,'service.json'),{format:'extracterre-import-service',version:VERSION,pid:process.pid,vu:new Date().toISOString(),occupe:busy,...extra}); }catch{} };

// v2.39.1 — champs de suivi des plantages gardés d'une relance à l'autre.
const KEEP=['tentatives','plantages','sansOcr','exclus','derniereErreur','debutDemande','deblocages','dernierDeblocage'];
const MAX_TENTATIVES=60;
function crashPlan(st,code,signal){
  const cause=signal?`signal ${signal}`:`code ${code}`;
  const n=(st.tentatives||0)+1, op=st.operations?.contratCourant||String(st.operations?.courante||'').split(' · ')[0]||'';
  const plantages={...(st.plantages||{})}; const sansOcr=[...(st.sansOcr||[])], exclus=[...(st.exclus||[])];
  let note='';
  if(op&&st.etape==='extraction'){ plantages[op]=(plantages[op]||0)+1;
    if(plantages[op]===2&&!sansOcr.includes(op)){ sansOcr.push(op); note=`${op} relancée sans OCR`; }
    else if(plantages[op]>=3&&!exclus.includes(op)){ exclus.push(op); note=`${op} mise de côté`; } }
  const next={tentatives:n,plantages,sansOcr,exclus,derniereErreur:st.erreur||cause,debutDemande:st.debutDemande||st.debut};
  // Plantage avant l'extraction (lecture Box, registre) : 3 relances au plus, comme avant.
  const retry=n<=MAX_TENTATIVES&&(st.etape==='extraction'||n<=3);
  return {retry,cause,note,next};
}

// v2.39.1 — fin d'analyse (ou plantage définitif) : rapport par iMessage au numéro de <dossier de travail>/notif/notif.json
// ({"imessage":"+33…"}), fichier local hors dépôt. Sans ce fichier : rien n'est envoyé.
function report(id,st){
  const t=st.totaux||{}, o=st.operations||{}, par=Object.values(st.parOp||{});
  const nb=r=>par.filter(x=>x.r===r).length;
  const min=st.debutDemande?Math.round((Date.now()-Date.parse(st.debutDemande))/60000):null;
  const dur=min==null?'':` en ${min>=60?`${Math.floor(min/60)} h ${String(min%60).padStart(2,'0')}`:`${min} min`}`;
  const head=st.etat==='terminé'?'✅ Analyse terminée':st.etat==='interrompu'?'⏸ Analyse arrêtée':'❌ Analyse en échec (plantage)';
  const L=[`ExtracTerre — ${head}${dur}`,`Opérations : ${o.fait??0}/${o.total??'?'} (traitées ${t.ops??0}, inchangées ${t.opsSkipped??0}, en erreur ${nb('erreurs')}, sans sous-dossier ${nb('vide')})`,
    `Fichiers : ${t.files??0} · extraits ${t.extracted??0} · réutilisés ${t.reused??0} · à vérifier ${t.review??0} · erreurs ${t.errors??0}`];
  if(st.tentatives) L.push(`Plantages rattrapés : ${st.tentatives}${st.sansOcr?.length?` · sans OCR : ${st.sansOcr.join(', ')}`:''}${st.exclus?.length?` · mis de côté : ${st.exclus.join(', ')}`:''}`);
  if(st.etat==='erreur') L.push(`Erreur : ${String(st.erreur||st.derniereErreur||'inconnue').slice(0,200)}`,`Arrêt sur : ${o.courante||st.etape||'?'}`);
  L.push(`Demande ${id}`);
  return L.join('\n');
}
function notify(id,st){
  const conf=readJson(path.join(workDir,'notif','notif.json'));
  const to=String(conf?.imessage||'').trim(); if(!to||process.platform!=='darwin') return;
  const msg=report(id,st);
  try{ const p=spawn('/usr/bin/osascript',['-e','on run argv','-e','with timeout of 60 seconds','-e','tell application "Messages" to send (item 1 of argv) to participant (item 2 of argv) of (1st account whose service type = iMessage)','-e','end timeout','-e','end run',msg,to],{stdio:'ignore'});
    p.on('exit',c=>console.log(`${id} : rapport iMessage ${c===0?'envoyé':`non envoyé (code ${c})`}.`)); }catch(err){ console.log(`${id} : rapport iMessage non envoyé (${err?.message||err}).`); }
}

function memoryMb(now=new Date()){
  const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).find(p=>p.type==='hour')?.value);
  return (h>=22||h<6)?Number(cfg.memoireNuitMo||10240):Number(cfg.memoireMo||8192);
}
const stopFile=id=>path.join(dir,`${id}.stop`);
// v3.3.0 — déblocage : bouton « Débloquer » de l'appli (<id>.debloquer) ou surveillance automatique (aucun avancement depuis
// blocageMinutes). Remède : arrêt de l'analyse figée, relance de Box Drive, reprise (opérations faites sautées, parcours repris).
const unblockFile=id=>path.join(dir,`${id}.debloquer`);
const BLOCAGE_MS=Number(cfg.blocageMinutes??30)*60000, MAX_AUTO=Number(cfg.deblocagesAutoMax??6);
let unblocking=null;
function pending(){
  let names=[]; try{ names=fs.readdirSync(dir); }catch{ return []; }
  return names.filter(n=>/^demande-[\w-]+\.json$/.test(n)).sort().map(n=>{
    const id=n.replace(/\.json$/,''); const st=readJson(path.join(dir,`${id}.statut.json`));
    return {id,file:path.join(dir,n),st};
  }).filter(x=>!x.st||x.st.etat==='en attente');
}
// Demande en attente arrêtée avant son lancement : annulée.
function cancelPending(){
  for(const req of pending()){ if(fs.existsSync(stopFile(req.id))){ writeJson(path.join(dir,`${req.id}.statut.json`),{etat:'annulé',etape:'annulé',finA:new Date().toISOString()}); try{ fs.unlinkSync(stopFile(req.id)); }catch{} } }
}

function run(req){
  return new Promise(resolve=>{
    const r=readJson(req.file);
    const statut=path.join(dir,`${req.id}.statut.json`);
    const contracts=Array.isArray(r?.contrats)?r.contrats.map(String).filter(c=>/^\d{1,8}$/.test(c)):[];
    if(r?.format!=='extracterre-import-request'||!contracts.length){ writeJson(statut,{etat:'erreur',erreur:'Demande illisible ou sans numéro de contrat.'}); return resolve(); }
    const list=path.join(dir,`${req.id}.contrats.txt`); fs.writeFileSync(list,contracts.join('\n')+'\n');
    // v2.39.1 — mémoire portée à 8 Go le jour, 10 Go la nuit (22 h → 6 h, heure de Paris) : des dossiers très lourds dépassaient
    // la limite par défaut de 4 Go. Choisie au lancement et à chaque relance ; configurable (memoireMo, memoireNuitMo).
    const args=[`--max-old-space-size=${memoryMb()}`,path.join(HERE,'extracterre-import.mjs'),'--contrats',list,'--statut',statut,'--dossier-travail',workDir];
    // Options supplémentaires (tests) : EXTRACTERRE_SERVICE_ARGS="--local --racine /chemin"
    if(process.env.EXTRACTERRE_SERVICE_ARGS) args.push(...process.env.EXTRACTERRE_SERVICE_ARGS.split(' ').filter(Boolean));
    if(r.mode==='check-only') args.push('--check-only');
    if(r.ocr===false) args.push('--sans-ocr');
    if(r.reextraire===true){ args.push('--reextraire'); if(r.creeA) args.push('--reextraire-depuis',String(r.creeA)); }
    // v3.0.6 — relecture ciblée par onglet.
    const L=x=>Array.isArray(x)?x.map(String).filter(Boolean):[];
    if(r.reextraire!==true&&L(r.relireOnglets).length){ args.push('--relire-onglets',L(r.relireOnglets).join(','));
      if(L(r.lotsRecherches).length) args.push('--lots-recherches',L(r.lotsRecherches).join(','));
      if(L(r.lotsEnveloppe).length) args.push('--lots-enveloppe',L(r.lotsEnveloppe).join(',')); }
    if(Array.isArray(r.cctpLots)&&r.cctpLots.length) args.push('--lots-cctp',r.cctpLots.map(String).join(','));
    const prev=readJson(statut)||{};
    if(prev.sansOcr?.length) args.push('--sans-ocr-contrats',prev.sansOcr.join(','));
    if(prev.exclus?.length) args.push('--exclure',prev.exclus.join(','));
    { const keep={}; for(const k of KEEP) if(prev[k]!=null) keep[k]=prev[k]; writeJson(statut,{etat:'en cours',etape:'démarrage',debut:new Date().toISOString(),debutDemande:prev.debutDemande||new Date().toISOString(),...keep}); }
    const log=fs.openSync(path.join(dir,`${req.id}.log`),'a');
    const child=spawn(process.execPath,args,{cwd:HERE,stdio:['ignore',log,log],env:{...process.env}});
    // v2.31.3 — Mac gardé éveillé pendant l'analyse (sinon la veille la met en pause la nuit) ; s'arrête avec elle.
    if(process.platform==='darwin'){ try{ spawn('/usr/bin/caffeinate',['-i','-s','-w',String(child.pid)],{stdio:'ignore',detached:true}).unref(); }catch{} }
    current={id:req.id,child,stopAsked:0,unblock:null};
    child.on('exit',async(code,signal)=>{ fs.closeSync(log); const st=readJson(statut)||{}; const stopped=current?.stopAsked, unb=current?.unblock; current=null;
      if(unb&&!stopped&&st.etat!=='terminé'){
        const n=(st.deblocages||0)+1, info={at:new Date().toISOString(),cause:unb.cause,etape:st.etape||'',sur:st.operations?.courante||st.lecture?.courant||''};
        console.log(`${req.id} : déblocage ${n} (${unb.cause}) — relance de Box puis reprise.`);
        writeJson(statut,{...st,etat:'en cours',etape:st.etape,deblocage:'relance de Box Drive…',majA:new Date().toISOString()});
        unblocking=req.id; await restartBox({log:t=>console.log(`${req.id} :${t}`)}); unblocking=null;
        const keep={}; for(const k of KEEP) if(st[k]!=null) keep[k]=st[k];
        writeJson(statut,{etat:'en attente',etape:'attente',reprise:true,...keep,deblocages:n,dernierDeblocage:info});
        try{ fs.unlinkSync(unblockFile(req.id)); }catch{}
        try{ fs.unlinkSync(stopFile(req.id)); }catch{}
        return resolve(); }
      if(stopped&&st.etat!=='terminé') writeJson(statut,{...st,etat:'interrompu',etape:'arrêté à la demande',finA:new Date().toISOString()});
      // v2.39.1 — arrêt inattendu (plantage du moteur natif de l'OCR, aléatoire) : relance tant que l'analyse avance.
      // L'opération en cours au plantage est notée : 2e plantage sur elle → relancée sans OCR ; 3e → mise de côté.
      else if(code!==0&&['en cours','erreur'].includes(st.etat)){
        const plan=crashPlan(st,code,signal);
        if(plan.retry){ console.log(`${req.id} : arrêt inattendu (${plan.cause}), relance automatique ${plan.next.tentatives}${plan.note?` — ${plan.note}`:''}.`);
          writeJson(statut,{etat:'en attente',etape:'attente',reprise:true,...plan.next}); }
        else { const fin={...st,...plan.next,etat:'erreur',erreur:st.erreur||`Arrêt inattendu (${plan.cause}) sans avancer : voir ${req.id}.log`,finA:new Date().toISOString()}; writeJson(statut,fin); notify(req.id,fin); }
      }
      else if(['terminé','interrompu','erreur'].includes(st.etat)) notify(req.id,readJson(statut)||st);
      try{ fs.unlinkSync(stopFile(req.id)); }catch{}
      resolve(); });
  });
}

// Arrêt de l'analyse en cours : 1re demande = arrêt propre (SIGINT : fin du document en cours, registre enregistré) ;
// « immédiat » ou toujours en cours 60 s après = arrêt forcé.
function checkStop(){
  if(!current) return;
  const f=stopFile(current.id); if(!fs.existsSync(f)) return;
  const req=readJson(f)||{};
  if(!current.stopAsked){ current.stopAsked=Date.now(); try{ current.child.kill('SIGINT'); }catch{} }
  else if(req.immediat||Date.now()-current.stopAsked>60000){ try{ current.child.kill('SIGKILL'); }catch{} }
}
// Demande de déblocage (bouton) ou analyse sans avancement depuis BLOCAGE_MS : arrêt forcé, puis relance de Box à la sortie.
function checkUnblock(){
  for(const n of (()=>{ try{ return fs.readdirSync(dir).filter(x=>/^demande-[\w-]+\.debloquer$/.test(x)); }catch{ return []; } })()){
    const id=n.replace(/\.debloquer$/,'');
    if(current?.id===id){ if(!current.unblock){ current.unblock={cause:'bouton Débloquer'}; try{ current.child.kill('SIGKILL'); }catch{} } continue; }
    // Pas d'analyse en cours pour cette demande : Box est relancé seul (une fois).
    if(!unblocking){ try{ fs.unlinkSync(path.join(dir,n)); }catch{} unblocking=id; console.log(`${id} : déblocage demandé hors analyse — relance de Box.`); restartBox().finally(()=>{ unblocking=null; }); }
  }
  if(!current||current.unblock||current.stopAsked) return;
  const st=readJson(path.join(dir,`${current.id}.statut.json`)); const t=Date.parse(st?.majA||st?.debut||'');
  if(st?.etat==='en cours'&&Number.isFinite(t)&&Date.now()-t>BLOCAGE_MS&&(st.deblocages||0)<MAX_AUTO){
    current.unblock={cause:`aucun avancement depuis ${Math.round((Date.now()-t)/60000)} min`}; try{ current.child.kill('SIGKILL'); }catch{} }
}
async function tick(){
  heartbeat({...(unblocking?{deblocage:unblocking}:{})}); checkStop(); cancelPending(); checkUnblock();
  // Code mis à jour : le service s'arrête entre deux analyses et le lanceur macOS le relance avec le nouveau code.
  try{ if(!busy&&fs.statSync(SELF).mtimeMs!==CODE_MTIME){ console.log('Code du service mis à jour : redémarrage.'); process.exit(0); } }catch{}
  if(busy||unblocking) return;
  const next=pending()[0]; if(!next) return;
  busy=true; heartbeat({demande:next.id});
  try{ await run(next); } finally { busy=false; heartbeat(); }
}
console.log(`ExtracTerre — service d'import démarré · ${dir}`);
fs.mkdirSync(dir,{recursive:true});
// v2.31.1 — reprise : une analyse marquée « en cours » au démarrage du service a été coupée (redémarrage, mise à jour, Mac
// éteint). Elle repasse en attente et sera relancée : les opérations déjà traitées et inchangées sont sautées.
function resumeOrphans(){
  let names=[]; try{ names=fs.readdirSync(dir); }catch{ return; }
  for(const n of names.filter(n=>/^demande-[\w-]+\.statut\.json$/.test(n))){
    const f=path.join(dir,n), st=readJson(f); if(st?.etat!=='en cours') continue;
    const id=n.replace(/\.statut\.json$/,'');
    if(fs.existsSync(stopFile(id))){ writeJson(f,{...st,etat:'interrompu',etape:'arrêté à la demande',finA:new Date().toISOString()}); try{ fs.unlinkSync(stopFile(id)); }catch{} continue; }
    writeJson(f,{etat:'en attente',etape:'attente',reprise:true,coupeeA:st.majA||null});
    console.log(`${id} : analyse coupée au redémarrage, remise en attente (reprise).`);
  }
}
resumeOrphans();
tick(); setInterval(tick,5000);
