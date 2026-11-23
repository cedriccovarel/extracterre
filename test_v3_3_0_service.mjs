// v3.3.0 — service : bouton « Débloquer » (<id>.debloquer) → analyse arrêtée, Box relancé (simulé), reprise jusqu'au bout.
import fs from 'fs'; import os from 'os'; import path from 'path'; import {spawn} from 'child_process';
const fail=(m,x)=>{ console.error('ÉCHEC',m,x??''); process.exit(1); };
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'et-v330s-')), root=path.join(tmp,'box'), work=path.join(tmp,'work'), dem=path.join(work,'demandes');
for(const o of ['00002001 - 75 - PARIS - Un','00002002 - 69 - LYON - Deux fige']){ fs.mkdirSync(path.join(root,o,'CCTP'),{recursive:true}); fs.writeFileSync(path.join(root,o,'CCTP','CCTP fictif.txt'),'texte fictif'); }
fs.mkdirSync(dem,{recursive:true});
const lock=path.join(tmp,'fige'); fs.writeFileSync(lock,'1');
const id='demande-20990101-000000';
fs.writeFileSync(path.join(dem,`${id}.json`),JSON.stringify({format:'extracterre-import-request',contrats:['2001','2002'],ocr:false}));
const svc=spawn(process.execPath,['tools/import/watch.mjs'],{env:{...process.env,EXTRACTERRE_WORKDIR:work,EXTRACTERRE_SERVICE_ARGS:`--local --racine ${root}`,EXTRACTERRE_TEST_FIGE:'Deux fige',EXTRACTERRE_TEST_FIGE_TANT_QUE:lock,EXTRACTERRE_TEST_SANS_BOX:'1'},stdio:['ignore','pipe','pipe']});
let log=''; svc.stdout.on('data',d=>log+=d); svc.stderr.on('data',d=>log+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const st=()=>{ try{ return JSON.parse(fs.readFileSync(path.join(dem,`${id}.statut.json`),'utf8')); }catch{ return null; } };
try{
  // Analyse lancée : « Un » traité pendant que « Deux » reste figé.
  let ok=false; for(let i=0;i<60;i++){ await sleep(500); const s=st(); if(s?.parOp?.['00002001']?.r){ ok=true; break; } } if(!ok) fail('« Un » non analysé pendant que « Deux » est figé',st());
  if(st().etat!=='en cours') fail('analyse devrait être en cours (Deux figé)',st());
  // Box « débloqué » puis bouton Débloquer.
  fs.unlinkSync(lock); fs.writeFileSync(path.join(dem,`${id}.debloquer`),'{}');
  let s=null; for(let i=0;i<120;i++){ await sleep(500); s=st(); if(s?.etat==='terminé') break; }
  if(s?.etat!=='terminé') fail('analyse non terminée après déblocage',{s,log:log.slice(-1500)});
  if(s.deblocages!==1||s.dernierDeblocage?.cause!=='bouton Débloquer') fail('déblocage non noté',s);
  if(!['ok','vide','erreurs'].includes(s.parOp?.['00002002']?.r)) fail('« Deux » non analysé après déblocage',s.parOp);
  if(fs.existsSync(path.join(dem,`${id}.debloquer`))) fail('fichier .debloquer non retiré');
  if(!/déblocage 1 \(bouton Débloquer\)/.test(log)) fail('journal du service',log);
  console.log('v3.3.0 — service : bouton Débloquer → arrêt, relance de Box, reprise jusqu’au bout : OK (données fictives)');
} finally { svc.kill('SIGKILL'); fs.rmSync(tmp,{recursive:true,force:true}); }
