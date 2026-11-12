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
const VERSION='1';
let busy=false;

const writeJson=(f,o)=>{ const tmp=`${f}.tmp`; fs.writeFileSync(tmp,JSON.stringify(o,null,1)); fs.renameSync(tmp,f); };
const readJson=f=>{ try{ return JSON.parse(fs.readFileSync(f,'utf8')); }catch{ return null; } };
const heartbeat=extra=>{ try{ fs.mkdirSync(dir,{recursive:true}); writeJson(path.join(dir,'service.json'),{format:'extracterre-import-service',version:VERSION,pid:process.pid,vu:new Date().toISOString(),occupe:busy,...extra}); }catch{} };

function pending(){
  let names=[]; try{ names=fs.readdirSync(dir); }catch{ return []; }
  return names.filter(n=>/^demande-[\w-]+\.json$/.test(n)).sort().map(n=>{
    const id=n.replace(/\.json$/,''); const st=readJson(path.join(dir,`${id}.statut.json`));
    return {id,file:path.join(dir,n),st};
  }).filter(x=>!x.st||x.st.etat==='en attente');
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
    writeJson(statut,{etat:'en cours',etape:'démarrage',debut:new Date().toISOString()});
    const log=fs.openSync(path.join(dir,`${req.id}.log`),'a');
    const child=spawn(process.execPath,args,{cwd:HERE,stdio:['ignore',log,log],env:{...process.env}});
    child.on('exit',code=>{ fs.closeSync(log); const st=readJson(statut)||{};
      if(code!==0&&st.etat==='en cours') writeJson(statut,{...st,etat:'erreur',erreur:st.erreur||`Arrêt inattendu (code ${code}) : voir ${req.id}.log`});
      resolve(); });
  });
}

async function tick(){
  heartbeat();
  if(busy) return;
  const next=pending()[0]; if(!next) return;
  busy=true; heartbeat({demande:next.id});
  try{ await run(next); } finally { busy=false; heartbeat(); }
}
console.log(`ExtracTerre — service d'import démarré · ${dir}`);
fs.mkdirSync(dir,{recursive:true});
tick(); setInterval(tick,5000);
