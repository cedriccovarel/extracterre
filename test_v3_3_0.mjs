// v3.3.0 — import massif : un dossier Box figé ne bloque plus l'analyse (parcours dans un processus à part, relégué en fin),
// l'analyse démarre sans attendre la fin du parcours, parcours repris après relance. Données fictives.
import fs from 'fs'; import os from 'os'; import path from 'path'; import {spawn} from 'child_process';
const fail=(m,x)=>{ console.error('ÉCHEC',m,x??''); process.exit(1); };
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'et-v330-')), root=path.join(tmp,'box'), work=path.join(tmp,'work');
const ops={'00001001 - 75 - PARIS - Alpha':1,'00001002 - 69 - LYON - Beta fige':1,'00001003 - 13 - MARSEILLE - Gamma':1};
for(const o of Object.keys(ops)){ fs.mkdirSync(path.join(root,o,'CCTP'),{recursive:true}); fs.writeFileSync(path.join(root,o,'CCTP','CCTP Lot 1 fictif.txt'),'Lot 1 — texte fictif'); }
fs.mkdirSync(work,{recursive:true});
const cfg=JSON.parse(fs.readFileSync('tools/import/import.config.json','utf8'));
Object.assign(cfg,{racine:root,racinesSupplementaires:[],dossierTravail:work,boxSilenceSecondes:2,boxSilenceFinSecondes:2,relancerBoxSiBloque:false,ocr:false});
const cfgPath=path.join(tmp,'config.json'); fs.writeFileSync(cfgPath,JSON.stringify(cfg));
const list=path.join(tmp,'contrats.txt'); fs.writeFileSync(list,'1001\n1002\n1003\n');
const lock=path.join(tmp,'fige'); fs.writeFileSync(lock,'1');
const statut=path.join(tmp,'demande-test.statut.json');
const run=()=>new Promise(res=>{ const p=spawn(process.execPath,['tools/import/extracterre-import.mjs','--local','--config',cfgPath,'--contrats',list,'--statut',statut,'--dossier-travail',work],
  {env:{...process.env,EXTRACTERRE_TEST_FIGE:'Beta fige',EXTRACTERRE_TEST_FIGE_TANT_QUE:lock}}); let out=''; p.stdout.on('data',d=>out+=d); p.stderr.on('data',d=>out+=d); p.on('exit',c=>res({c,out})); });
const st=()=>{ try{ return JSON.parse(fs.readFileSync(statut,'utf8')); }catch{ return {}; } };

// 1. Beta reste figé : Alpha et Gamma sont analysés, Beta est relégué puis déclaré bloqué ; l'analyse se termine quand même.
let t0=Date.now(); const r1=await run();
if(r1.c!==0) fail('analyse 1 en échec',r1.out.slice(-800));
const s1=st();
if(s1.etat!=='terminé') fail('analyse 1 non terminée',s1.etat);
if(s1.parOp?.['00001002']?.r!=='bloque') fail('Beta devrait être « bloque »',s1.parOp);
for(const c of ['00001001','00001003']) if(!['ok','vide','erreurs'].includes(s1.parOp?.[c]?.r)) fail(`${c} non analysé`,s1.parOp);
if(!s1.correspondance?.bloques?.includes('00001002')) fail('correspondance sans le dossier bloqué',s1.correspondance);
if(!/relégué en fin de parcours/.test(r1.out)) fail('journal sans relégation',r1.out);
if(Date.now()-t0>60000) fail('trop long : le dossier figé a bloqué l’analyse');
// Pipeline : la 1re opération est analysée avant la fin du parcours (Alpha est traité avant la relégation finale de Beta).
const iA=r1.out.indexOf('Opérations'), iEnd=r1.out.indexOf('Dossiers relégués');
if(!(iA>=0&&iEnd>=0&&iA<iEnd)) fail('l’analyse aurait dû démarrer avant la fin du parcours',r1.out);
const pf=statut.replace(/\.statut\.json$/,'')+'.parcours.json';
const cache=JSON.parse(fs.readFileSync(pf,'utf8'));
if(Object.keys(cache.dossiers).length!==2||cache.dossiers['00001002 - 69 - LYON - Beta fige']) fail('parcours enregistrés incorrects',Object.keys(cache.dossiers));

// 2. Box débloqué : relance → Alpha et Gamma repris du parcours enregistré (pas relus), Beta enfin lu et analysé.
fs.unlinkSync(lock); fs.writeFileSync(statut,JSON.stringify({etat:'en attente'}));
const r2=await run(); const s2=st();
if(r2.c!==0||s2.etat!=='terminé') fail('analyse 2',r2.out.slice(-800));
if(!/parcours repris de la session précédente : 2 dossier/.test(r2.out)) fail('parcours non repris',r2.out);
if(['bloque','differe'].includes(s2.parOp?.['00001002']?.r)||!s2.parOp?.['00001002']) fail('Beta non analysé après déblocage',s2.parOp);
fs.rmSync(tmp,{recursive:true,force:true});
console.log('v3.3.0 — dossier Box figé relégué, analyse en flux, reprise du parcours : OK (données fictives)');
// Suivi dans l'appli : cases selon parOp seulement (ordre de traitement = ordre de lecture de Box), lecture en parallèle.
{ const {ssProgressModel,ssContractsToLoad,SS_TILE_LABEL}=await import('./js/suivi-sources.js');
  const m=ssProgressModel({etat:'en cours',etape:'extraction',pipeline:true,debut:'2026-11-23T08:00:00Z',debutExtraction:'2026-11-23T08:00:00Z',majA:'2026-11-23T08:10:00Z',
    lecture:{fait:3,total:5,differes:1,courant:'X'},operations:{fait:2,total:5,courante:''},contrats:['A','B','C','D','E'],parOp:{C:{r:'ok'},E:{r:'inchangé'},B:{r:'differe'}},deblocages:1,dernierDeblocage:{at:'2026-11-23T08:05:00Z',cause:'bouton Débloquer'}},Date.parse('2026-11-23T08:10:30Z'));
  const s=m.tiles.map(t=>t.state).join(',');
  if(s!=='attente,differe,ok,attente,inchangé') fail('cases en flux',s);
  if(m.scan?.fait!==3||m.scan.differes!==1||m.deblocages!==1) fail('lecture / déblocages',m);
  if(!SS_TILE_LABEL.bloque||!SS_TILE_LABEL.differe) fail('libellés');
  const l=ssContractsToLoad({etat:'terminé',contrats:['A','B','C'],parOp:{A:{r:'ok'},B:{r:'bloque'},C:{r:'vide'}}});
  if(l.join()!=='A') fail('chargement : un dossier bloqué ne se charge pas',l);
  const app=fs.readFileSync('js/app.js','utf8'); if(!/data-ss-unblock/.test(app)||!/ssUnblockRequest\(ss\.dir/.test(app)) fail('bouton Débloquer absent');
  console.log('v3.3.0 — suivi en flux, cases relégué / bloqué, bouton Débloquer : OK'); }
