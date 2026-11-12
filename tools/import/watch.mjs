#!/usr/bin/env node
// ExtracTerre — service d'import : exécute les demandes déposées par l'appli (bouton « Coller une liste de contrats »)
// dans <dossier de travail>/demandes. Une demande à la fois ; avancement dans <id>.statut.json, journal dans <id>.log.
// Lancé à l'ouverture de session par installer-service.mjs (LaunchAgent). Lecture seule sur Box, comme le script.
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawn} from 'child_process';
import {fileURLToPath} from 'url';

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

const stopFile=id=>path.join(dir,`${id}.stop`);
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
    const args=[path.join(HERE,'extracterre-import.mjs'),'--contrats',list,'--statut',statut,'--dossier-travail',workDir];
    // Options supplémentaires (tests) : EXTRACTERRE_SERVICE_ARGS="--local --racine /chemin"
    if(process.env.EXTRACTERRE_SERVICE_ARGS) args.push(...process.env.EXTRACTERRE_SERVICE_ARGS.split(' ').filter(Boolean));
    if(r.mode==='check-only') args.push('--check-only');
    if(r.ocr===false) args.push('--sans-ocr');
    writeJson(statut,{etat:'en cours',etape:'démarrage',debut:new Date().toISOString()});
    const log=fs.openSync(path.join(dir,`${req.id}.log`),'a');
    const child=spawn(process.execPath,args,{cwd:HERE,stdio:['ignore',log,log],env:{...process.env}});
    current={id:req.id,child,stopAsked:0};
    child.on('exit',(code,signal)=>{ fs.closeSync(log); const st=readJson(statut)||{}; const stopped=current?.stopAsked; current=null;
      if(stopped&&st.etat!=='terminé') writeJson(statut,{...st,etat:'interrompu',etape:'arrêté à la demande',finA:new Date().toISOString()});
      else if(code!==0&&st.etat==='en cours') writeJson(statut,{...st,etat:'erreur',erreur:st.erreur||`Arrêt inattendu (code ${code}) : voir ${req.id}.log`});
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
async function tick(){
  heartbeat(); checkStop(); cancelPending();
  // Code mis à jour : le service s'arrête entre deux analyses et le lanceur macOS le relance avec le nouveau code.
  try{ if(!busy&&fs.statSync(SELF).mtimeMs!==CODE_MTIME){ console.log('Code du service mis à jour : redémarrage.'); process.exit(0); } }catch{}
  if(busy) return;
  const next=pending()[0]; if(!next) return;
  busy=true; heartbeat({demande:next.id});
  try{ await run(next); } finally { busy=false; heartbeat(); }
}
console.log(`ExtracTerre — service d'import démarré · ${dir}`);
fs.mkdirSync(dir,{recursive:true});
tick(); setInterval(tick,5000);
