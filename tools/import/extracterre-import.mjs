#!/usr/bin/env node
// ExtracTerre — import massif et suivi incrémental des documents d'opérations (lecture seule sur les dossiers).
// Aide : node extracterre-import.mjs --aide
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {fileURLToPath} from 'url';
import {parseContractList,matchContracts,rankVersions,classifyImportFile,documentKey,fileExtension} from '../../js/import-rules.js';
import {listOperationFolders,scanOperation,ignoredDirLabel} from './lib/scan.mjs';
import {Registry,SupabaseStore,openKeys} from './lib/registry.mjs';
import {sha256File} from './lib/crypto.mjs';
import {writeCsv,Progress,stamp} from './lib/report.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const AIDE=`
ExtracTerre — import massif (lecture seule sur vos dossiers)

  node extracterre-import.mjs [options]

Sélection
  --contrats <fichier>     TXT (un numéro par ligne) ou CSV ; sans cette option : tout le dossier racine
  --colonne <nom|n°>       colonne du CSV qui contient les numéros (défaut : 1re)
  --operation <numéro>     un seul contrat (tests)
  --all-subfolders         ne pas filtrer les sous-dossiers (tous les fichiers lisibles)

Modes
  --check-only             rapport de correspondance seulement (dossiers, sous-dossiers), puis arrêt
  --dry-run                sélection + classement + versions, sans extraction ni écriture du registre
  --sans-contenu           (dry-run) ne pas lire la 1re page des PDF (plus rapide, classement par dossier et nom)
  (aucun)                  traitement réel : extraction des nouveaux fichiers / fichiers modifiés, reprise automatique

Options
  --with-ai                IA locale (Ollama) sur les documents incomplets ; propositions à valider dans l'appli
  --max-ia <n>             plafond d'appels IA (défaut : configuration)
  --parallelisme <n>       documents lus en même temps (défaut : configuration)
  --reextraire             relire même les fichiers déjà connus (après une mise à jour des parseurs)
  --local                  ne pas utiliser Supabase (registre local seulement)
  --racine <dossier>       dossier racine (défaut : configuration)
  --dossier-travail <dos.> rapports, résultats et registre local (défaut : ~/ExtracTerre-import)
  --config <fichier>       autre fichier de configuration
  --statut <fichier>       avancement en JSON (utilisé par le service et l'appli)
`;

function parseArgs(argv){
  const a={}; const flags=new Set(['check-only','dry-run','all-subfolders','with-ai','reextraire','local','sans-contenu','aide','help']);
  for(let i=0;i<argv.length;i++){
    const k=argv[i].replace(/^--/,'');
    if(!argv[i].startsWith('--')) throw new Error(`Argument inattendu : ${argv[i]}`);
    if(flags.has(k)) a[k]=true; else { const v=argv[++i]; if(v==null) throw new Error(`Valeur manquante pour --${k}`); a[k]=v; }
  }
  return a;
}
const home=p=>String(p||'').replace(/^~(?=\/|$)/,os.homedir());
function loadEnv(file){
  const env={}; if(!fs.existsSync(file)) return env;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){ const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2'); }
  return env;
}
async function askHidden(question){
  if(!process.stdin.isTTY) throw new Error('Phrase secrète introuvable : enregistrez-la dans le Trousseau (voir README, « Service automatique ») ou lancez le script dans Terminal.');
  process.stdout.write(question);
  return new Promise(resolve=>{
    const stdin=process.stdin; let s=''; stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const on=ch=>{
      if(ch==='\r'||ch==='\n'||ch==='\u0004'){ stdin.setRawMode(false); stdin.pause(); stdin.off('data',on); process.stdout.write('\n'); resolve(s); }
      else if(ch==='\u0003'){ process.stdout.write('\n'); process.exit(130); }
      else if(ch==='\u007f'){ s=s.slice(0,-1); }
      else s+=ch;
    };
    stdin.on('data',on);
  });
}
async function pool(items,n,fn){
  const out=new Array(items.length); let i=0;
  await Promise.all(Array.from({length:Math.max(1,Math.min(n,items.length))},async()=>{ while(i<items.length){ const k=i++; out[k]=await fn(items[k],k); } }));
  return out;
}
// --statut <fichier> : avancement lisible par l'appli (bouton « Coller une liste de contrats »).
let STATUS_FILE=null; const STATUS={etat:'en cours',etape:'démarrage',debut:new Date().toISOString()};
function status(patch={}){ Object.assign(STATUS,patch,{majA:new Date().toISOString()}); if(!STATUS_FILE) return; try{ const tmp=`${STATUS_FILE}.tmp`; fs.writeFileSync(tmp,JSON.stringify(STATUS,null,1)); fs.renameSync(tmp,STATUS_FILE); }catch{} }
// Phrase secrète : .env, sinon Trousseau macOS (service « extracterre-import », compte « registre »), sinon saisie masquée.
async function keychainPassphrase(){
  if(process.platform!=='darwin') return '';
  const {execFileSync}=await import('child_process');
  try{ return execFileSync('/usr/bin/security',['find-generic-password','-s','extracterre-import','-a','registre','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); }catch{ return ''; }
}
const FAMILY_LABEL=cfg=>Object.fromEntries((cfg.families||[]).map(f=>[f.id,f.label]));

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.statut) STATUS_FILE=path.resolve(home(args.statut));
  if(args.aide||args.help){ console.log(AIDE); return; }
  const cfgPath=path.resolve(args.config||path.join(HERE,'import.config.json'));
  const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));
  const root=home(args.racine||cfg.racine);
  const workDir=home(args['dossier-travail']||cfg.dossierTravail||'~/ExtracTerre-import');
  const parallel=Number(args.parallelisme||cfg.parallelisme||3);
  const mode=args['check-only']?'check-only':args['dry-run']?'dry-run':'traitement';
  const runDir=path.join(workDir,'rapports',`${stamp()}_${mode}`);
  if(!fs.existsSync(root)) throw new Error(`Dossier racine introuvable : ${root}`);
  console.log(`ExtracTerre — import massif · mode ${mode}\n  racine : ${root}\n  dossier de travail : ${workDir}`);

  // 1. Contrats demandés
  let wanted=null, listInfo=null;
  if(args.operation){ const k=parseContractList(String(args.operation),{width:cfg.contractWidth}); if(!k.keys.length) throw new Error(`Numéro de contrat illisible : ${args.operation}`); wanted=k.keys; }
  else if(args.contrats){
    listInfo=parseContractList(fs.readFileSync(home(args.contrats),'utf8'),{column:args.colonne??null,width:cfg.contractWidth});
    wanted=listInfo.keys;
    console.log(`  contrats demandés : ${wanted.length}${listInfo.invalid.length?` · ${listInfo.invalid.length} ligne(s) illisible(s)`:''}${listInfo.duplicates.length?` · ${listInfo.duplicates.length} doublon(s)`:''}`);
  }

  // 2. Correspondance contrats ↔ dossiers (un seul listage de la racine ; les autres dossiers ne sont pas ouverts)
  const folders=await listOperationFolders(root);
  const match=matchContracts(folders,wanted,cfg);
  console.log(`  dossiers dans la racine : ${folders.length} · trouvés : ${match.found.length} · sans dossier : ${match.missing.length} · plusieurs dossiers (à vérifier) : ${match.multiple.length}${match.onlyCancelled.length?` · seulement annulés : ${match.onlyCancelled.length}`:''}`);

  // 3. Sous-dossiers de chaque opération retenue (noms et tailles seulement)
  const scans=new Map();
  const uniqueFolders=[...new Set(match.found.map(f=>f.folder))];
  const pr=new Progress(uniqueFolders.length,'Parcours');
  await pool(uniqueFolders,4,async name=>{ scans.set(name,await scanOperation(path.join(root,name),cfg,{allSubfolders:!!args['all-subfolders']})); pr.tick(name); });
  pr.end();

  const famLabel=FAMILY_LABEL(cfg);
  const corr=[], ignored=new Map(), noFamily=[];
  for(const f of match.found){
    const s=scans.get(f.folder); const fams=s.retained.map(r=>`${r.relDir} → ${famLabel[r.family]||r.family}${r.container?' (fichiers directs)':''}`);
    const kept=s.files.filter(x=>!x.ignoreReason).length;
    if(!s.retained.length&&!args['all-subfolders']) noFamily.push(f.contract);
    corr.push([f.contract,'trouvé',f.folder,f.sharedWith.join(' + '),fams.join(' | '),kept,s.files.length-kept,!s.retained.length&&!args['all-subfolders']?'aucun sous-dossier de famille':'',s.errors.length?`${s.errors.length} dossier(s) illisible(s)`:'']);
    for(const n of s.ignoredDirs){ const k=ignoredDirLabel(n); const e=ignored.get(k)||{n:0,ops:new Set(),example:n}; e.n++; e.ops.add(f.contract); ignored.set(k,e); }
  }
  for(const m of match.multiple) corr.push([m.contract,'plusieurs dossiers — à vérifier (non traité)',m.folders.join(' | '),'','',0,0,'','']);
  for(const k of match.missing) corr.push([k,'aucun dossier','','','',0,0,'','']);
  for(const m of match.onlyCancelled) corr.push([m.contract,'seulement un dossier « Annulé » (non traité)',m.folders.join(' | '),'','',0,0,'','']);
  for(const x of listInfo?.invalid||[]) corr.push([x.value,`ligne ${x.line} du fichier de contrats illisible`,'','','',0,0,'','']);
  writeCsv(path.join(runDir,'correspondance.csv'),['contrat','statut','dossier','dossier commun avec','sous-dossiers retenus (famille)','fichiers lisibles','fichiers ignorés','alerte','erreurs'],corr);
  const ign=[...ignored].sort((a,b)=>b[1].n-a[1].n);
  writeCsv(path.join(runDir,'sous-dossiers-ignores.csv'),['nom (normalisé)','exemple de nom','occurrences','opérations'],ign.map(([k,e])=>[k,e.example,e.n,e.ops.size]));
  console.log(`\nCorrespondance\n  contrats sans sous-dossier de famille : ${noFamily.length}${noFamily.length?` (${noFamily.slice(0,10).join(', ')}${noFamily.length>10?'…':''})`:''}`);
  if(match.multiple.length) console.log(`  plusieurs dossiers : ${match.multiple.slice(0,10).map(m=>m.contract).join(', ')}`);
  if(match.missing.length) console.log(`  sans dossier : ${match.missing.slice(0,15).join(', ')}${match.missing.length>15?'…':''}`);
  console.log(`  sous-dossiers ignorés les plus fréquents : ${ign.slice(0,12).map(([k,e])=>`${k} (${e.n})`).join(' · ')||'aucun'}`);
  console.log(`  rapports : ${runDir}`);
  status({etape:'correspondance',correspondance:{demandes:wanted?.length??null,trouves:match.found.length,sansDossier:match.missing,plusieursDossiers:match.multiple.map(m=>m.contract),annules:match.onlyCancelled.map(m=>m.contract),illisibles:(listInfo?.invalid||[]).map(x=>x.value),sansSousDossier:noFamily},rapports:runDir});
  if(mode==='check-only'){ status({etat:'terminé',etape:'terminé'}); return; }

  // 4. Registre, décisions, phrase secrète
  const env={...loadEnv(path.join(HERE,'.env')),...process.env};
  let store=null,keys=null;
  const useSupabase=!args.local&&mode==='traitement'&&env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY;
  if(useSupabase){
    store=new SupabaseStore({url:env.SUPABASE_URL,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY});
    const pass=env.EXTRACTERRE_PASSPHRASE||await keychainPassphrase()||await askHidden('Phrase secrète du registre (non affichée) : ');
    const k=await openKeys(store,pass); keys=k.keys;
    console.log(k.created?'  registre Supabase créé (chiffré avec votre phrase secrète — conservez-la : elle n’est enregistrée nulle part).':'  registre Supabase ouvert (chiffré).');
  } else if(mode==='traitement') console.log('  Supabase non configuré (ou --local) : registre local seulement.');
  const reg=await new Registry({workDir,store,keys}).load();
  const decisionsFile=path.join(workDir,'decisions.json');
  const decisions=fs.existsSync(decisionsFile)?(JSON.parse(fs.readFileSync(decisionsFile,'utf8')).files||{}):{};

  let extract=null;
  const needsContent=mode==='traitement'||!args['sans-contenu'];
  if(needsContent) extract=await import('./lib/extract.mjs');
  const {classifyDocument}=await import('../../js/classifier.js');
  const {APP_VERSION}=await import('../../js/config.js');

  let stopping=false;
  process.on('SIGINT',()=>{ if(stopping) process.exit(130); stopping=true; console.log('\nArrêt demandé : fin du document en cours, registre enregistré, puis arrêt (relancer reprendra ici).'); });

  const totals={ops:0,opsSkipped:0,files:0,extracted:0,reused:0,ignored:0,review:0,errors:0,missing:0,ai:0,aiProposals:0};
  const inventory=[], finalRows=[];
  const aiMax=Number(args['max-ia']??cfg.ia?.maxAppels??30);
  const ops=match.found;
  const prOps=new Progress(ops.length,mode==='dry-run'?'Simulation':'Opérations');
  status({etape:'extraction',operations:{fait:0,total:ops.length,courante:''},contrats:ops.map(o=>o.contract)});

  for(const op of ops){
    if(stopping) break;
    const s=scans.get(op.folder); const contract=op.contract;
    const fp=crypto.createHash('sha256').update(JSON.stringify([APP_VERSION,s.files.map(f=>[f.relPath,f.size,f.mtimeMs]).sort(),Object.entries(decisions).filter(([k])=>k.startsWith(`${contract}|`)).sort()])).digest('hex');
    const prev=reg.operation(contract);
    if(mode==='traitement'&&!args.reextraire&&prev?.status==='complet'&&prev.fingerprint===fp){ totals.opsSkipped++; prOps.tick(`${contract} inchangé`); status({operations:{fait:STATUS.operations.fait+1,total:ops.length,courante:contract}}); finalRows.push([contract,op.folder,'inchangé (sauté)',0,0,0,0,0,0,0]); continue; }
    totals.ops++;
    status({operations:{fait:STATUS.operations.fait,total:ops.length,courante:`${contract} · ${op.folder}`}});
    const c={files:0,extracted:0,reused:0,ignored:0,review:0,errors:0,missing:0,ai:0};
    const kept=s.files.filter(f=>!f.ignoreReason);
    const ranks=rankVersions(kept.map(f=>({id:f.relPath,family:f.family,relDir:f.relDir,name:f.name,mtimeMs:f.mtimeMs})),cfg);
    // Choix de version imposé dans l'appli (« À vérifier »)
    for(const f of kept){ const dec=decisions[`${contract}|${f.relPath}`]; if(dec?.current){ const g=ranks.get(f.relPath).group; for(const [id,r] of ranks) if(r.group===g){ r.current=id===f.relPath; r.ambiguous=false; r.reason=''; } } }
    const now=new Date().toISOString();
    const seen=new Set();

    const handle=async f=>{
      if(stopping) return;
      seen.add(f.relPath); c.files++;
      const dec=decisions[`${contract}|${f.relPath}`]||{};
      const old=reg.file(contract,f.relPath);
      const base={contract,folder:op.folder,relPath:f.relPath,relDir:f.relDir,name:f.name,ext:fileExtension(f.name),family:f.family,size:f.size,mtimeMs:f.mtimeMs,
        firstSeenAt:old?.firstSeenAt||now,missing:false,missingSince:null,decision:Object.keys(dec).length?dec:null};
      if(f.ignoreReason||dec.ignore){
        c.ignored++;
        const e={...base,status:'ignoré',reason:dec.ignore?'ignoré dans l’appli':f.ignoreReason,isCurrent:false,sha256:old?.sha256||null,resultFile:null};
        if(mode==='dry-run') inventory.push(invRow(e,{})); else reg.putFile(e);
        return;
      }
      const r=ranks.get(f.relPath);
      const ver={docKey:documentKey(f.name,cfg),versionGroup:r.group,versionLabel:r.label,versionRank:r.rank,versionCount:r.count,isCurrent:r.current};
      if(!r.current){
        const e={...base,...ver,status:r.ambiguous?'à vérifier':'ignoré',reason:r.ambiguous?r.reason:'version antérieure (historique)',sha256:old?.sha256||null,docType:old?.docType||null,method:old?.method||null,resultFile:null};
        if(r.ambiguous) c.review++; else c.ignored++;
        if(mode==='dry-run') inventory.push(invRow(e,{})); else reg.putFile(e);
        return;
      }
      // Classement (règles a → e)
      const ext=fileExtension(f.name);
      let xml=null,text;
      try{
        if(ext==='xml'&&extract) xml=await extract.probeXml(f.abs);
        if(ext==='pdf'&&mode==='dry-run'&&extract) text=await extract.firstPageText(f.abs);
      }catch(err){ text=undefined; }
      if(mode==='dry-run'){
        const k=classifyImportFile({family:f.family,name:f.name,xml,text},classifyDocument,cfg);
        const known=old&&old.size===f.size&&old.mtimeMs===f.mtimeMs&&old.resultFile;
        const status=r.ambiguous?'à vérifier':k.status==='à vérifier'?'à vérifier':known?'traité (inchangé)':'à traiter';
        if(status.startsWith('à vérifier')) c.review++;
        inventory.push(invRow({...base,...ver,docType:k.type,method:k.method,status,reason:[r.reason,k.doubt].filter(Boolean).join(' ; ')},k));
        return;
      }
      // Traitement réel
      try{
        const unchanged=old&&old.size===f.size&&old.mtimeMs===f.mtimeMs&&old.sha256&&old.resultFile&&fs.existsSync(path.join(workDir,old.resultFile))&&!dec.reprocess&&!args.reextraire&&(old.decisionFamily||null)===(dec.family||null)&&(old.decisionAccept||false)===!!dec.accept;
        if(unchanged){ c.reused++; reg.putFile({...old,...base,...ver,status:old.status,reason:old.reason}); if(old.status==='à vérifier') c.review++; return; }
        const sha=await sha256File(f.abs);
        const twin=!args.reextraire&&!dec.reprocess&&!dec.family?reg.byHash(sha):null;
        if(twin&&fs.existsSync(path.join(workDir,twin.resultFile))){
          // Même contenu déjà extrait : résultat réutilisé, mais le classement dépend du sous-dossier et du nom de CE fichier.
          const res=extract.readResult(workDir,twin.resultFile);
          const ex={status:res.meta?.extractStatus||twin.status,reason:res.meta?.extractReason||'',scan:!!res.meta?.scan};
          const k=classifyImportFile({family:f.family,name:f.name,xml,text:ex.scan?'':firstPageOf(res.doc)},classifyDocument,cfg);
          const {status,reason}=combine(ex,k,r,dec);
          c.reused++; if(status==='à vérifier') c.review++;
          reg.putFile({...base,...ver,sha256:sha,docType:twin.docType,importType:k.type,method:k.method,status,reason,resultFile:twin.resultFile,processedAt:twin.processedAt,completeness:twin.completeness,pages:twin.pages,reusedFrom:twin.contract===contract?null:twin.contract,decisionAccept:!!dec.accept});
          return;
        }
        let x=await extract.extractFile(f,{familyOverride:dec.family||null,incompleteBelow:cfg.incompleteBelow??0.5});
        const k=dec.family?{type:x.d.type,method:'choix dans l’appli',status:'à traiter',doubt:''}:classifyImportFile({family:f.family,name:f.name,xml,text:x.d.read?.plan?undefined:x.scan?'':firstPageOf(x.d)},classifyDocument,cfg);
        // Type confirmé par le nom, le contenu ou la structure, mais détection automatique de l'appli différente (ex. CCTP pris
        // pour un RSET à égalité de points) : on impose la famille, comme le choix « Famille » d'un document dans l'appli.
        let forced=null;
        const famCfg=(cfg.families||[]).find(x=>x.id===f.family);
        if(!dec.family&&k.status==='à traiter'&&k.method!=='sous-dossier'&&!x.d.read?.plan&&famCfg&&!famCfg.compatibleTypes.includes(x.d.type)){
          const fam=extract.familyForType(k.type);
          if(fam&&!extract.autoAgrees(x.d.type,fam)){ forced={family:fam,auto:x.d.type}; x=await extract.extractFile(f,{familyOverride:fam,incompleteBelow:cfg.incompleteBelow??0.5}); }
        }
        let {status,reason}=combine(x,k,r,dec);
        if(forced) reason=[`famille imposée : ${k.type} (détection automatique : ${forced.auto})`,reason].filter(Boolean).join(' ; ');
        // IA locale sur les documents incomplets (jamais sur les scans ni les erreurs)
        if(args['with-ai']&&status==='à vérifier'&&!x.scan&&x.status==='à vérifier'&&totals.ai<aiMax){
          for(let attempt=1;attempt<=(cfg.ia?.essais||3);attempt++){
            totals.ai++; c.ai++;
            try{ const ai=await extract.askLocalAi(x.d,{model:cfg.ia?.modele}); x.d.llmProposals=ai.accepted; totals.aiProposals+=ai.accepted.length; if(ai.accepted.length) reason+=` ; IA : ${ai.accepted.length} proposition(s) à valider`; break; }
            catch(err){ if(attempt>=(cfg.ia?.essais||3)||totals.ai>=aiMax){ reason+=` ; IA indisponible (${err.message})`; break; } await new Promise(r=>setTimeout(r,(cfg.ia?.pauseMs||1500)*attempt)); }
          }
        }
        const meta={sha256:sha,contract,relPath:f.relPath,family:f.family,importType:k.type,method:k.method,status,reason,extractStatus:x.status,extractReason:x.reason,scan:x.scan,forcedFamily:forced?.family||null};
        const resultFile=extract.writeResult(workDir,sha,extract.serializeDoc(x.d,meta));
        c.extracted++; if(status==='à vérifier') c.review++; if(status==='erreur') c.errors++;
        reg.putFile({...base,...ver,sha256:sha,docType:x.d.type,importType:k.type,method:k.method,status,reason,resultFile,processedAt:new Date().toISOString(),completeness:x.completeness,pages:x.pages,fields:x.fields,forcedFamily:forced?.family||null,decisionFamily:dec.family||null,decisionAccept:!!dec.accept});
      }catch(err){
        c.errors++;
        reg.putFile({...base,...ver,status:'erreur',reason:`lecture impossible : ${err?.message||err}`,sha256:old?.sha256||null,resultFile:null});
      }
    };
    await pool(kept.concat(s.files.filter(f=>f.ignoreReason)),parallel,handle);

    if(mode==='traitement'){
      if(!stopping) for(const old of reg.filesOf(contract)) if(!seen.has(old.relPath)&&!old.missing){ c.missing++; reg.putFile({...old,missing:true,missingSince:now,isCurrent:false}); }
      reg.putOperation({contract,folder:op.folder,sharedWith:op.sharedWith,status:stopping?'interrompu':'complet',fingerprint:stopping?null:fp,lastRunAt:now,appVersion:APP_VERSION,counts:c,
        families:s.retained.map(x=>({relDir:x.relDir,family:x.family,container:x.container}))});
      await reg.flush();
    }
    for(const k of Object.keys(c)) totals[k]+=c[k];
    finalRows.push([contract,op.folder,stopping?'interrompu':mode==='dry-run'?'simulé':'traité',c.files,c.extracted,c.reused,c.ignored,c.review,c.errors,c.missing,c.ai]);
    prOps.tick(`${contract} · ${c.files} fichier(s)`); status({operations:{fait:STATUS.operations.fait+1,total:ops.length,courante:''},totaux:{...totals}});
  }
  prOps.end();

  if(mode==='dry-run') writeCsv(path.join(runDir,'simulation.csv'),['contrat','sous-dossier','famille','fichier','extension','taille (octets)','type détecté','méthode','clé de famille','version','rang','courante','statut prévu','motif'],inventory);
  writeCsv(path.join(runDir,'rapport-final.csv'),['contrat','dossier','résultat','fichiers','extraits','réutilisés','ignorés','à vérifier','erreurs','disparus','appels IA'],finalRows);
  console.log(`\nRésultat (${mode})\n  opérations : ${totals.ops}${totals.opsSkipped?` · inchangées sautées : ${totals.opsSkipped}`:''}\n  fichiers : ${totals.files} · extraits : ${totals.extracted} · réutilisés : ${totals.reused} · ignorés : ${totals.ignored} · à vérifier : ${totals.review} · erreurs : ${totals.errors}${totals.missing?` · disparus : ${totals.missing}`:''}${args['with-ai']?`\n  appels IA : ${totals.ai} · propositions : ${totals.aiProposals}`:''}\n  rapports : ${runDir}`);
  if(stopping) console.log('  Interrompu : relancez la même commande pour reprendre.');
  status({etat:stopping?'interrompu':'terminé',etape:'terminé',totaux:{...totals},finA:new Date().toISOString()});
}

function firstPageOf(d){ const p=d?.read?.pages?.[0]; return (p?.lines||[]).map(l=>l.text).join('\n')||String(p?.text||''); }
// Statut final : extraction (x), classement a → e (k), versions (r), choix de l'utilisateur (dec).
function combine(x,k,r,dec){
  let status=x.status, reason=x.reason||'';
  if(status==='traité'&&k.status==='à vérifier'&&!(x.scan&&/scan/.test(k.doubt))){ status='à vérifier'; reason=[reason,k.doubt].filter(Boolean).join(' ; '); }
  else if(k.doubt&&!reason.includes(k.doubt)&&!(x.scan&&/scan/.test(k.doubt))) reason=[reason,k.doubt].filter(Boolean).join(' ; ');
  if(r.ambiguous){ status=status==='erreur'?status:'à vérifier'; reason=[r.reason,reason].filter(Boolean).join(' ; '); }
  if(dec.accept&&status==='à vérifier') status='traité';
  return {status,reason};
}

function invRow(e,k){ return [e.contract,e.relDir,e.family,e.name,e.ext,e.size,e.docType||'',e.method||'',e.docKey||'',e.versionLabel||'',e.versionRank||'',e.isCurrent?'oui':'non',e.status,e.reason||'']; }

main().catch(err=>{ console.error(`\nErreur : ${err?.message||err}`); status({etat:'erreur',erreur:String(err?.message||err)}); process.exit(1); });
