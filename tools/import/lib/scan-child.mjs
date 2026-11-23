// v3.3.0 — parcours d'UN dossier d'opération dans un processus à part. Box Drive peut figer un listage de dossier
// indéfiniment : dans le processus principal, 4 dossiers figés occupaient tous les fils de lecture de Node et l'analyse
// entière s'arrêtait (20/11/2026 : 2 jours perdus). Ici le processus parent peut tuer ce parcours s'il ne donne plus signe de vie.
// Entrée : argv = <dossier opération> <fichier config> <0|1 tous sous-dossiers>. Sortie : signe de vie « . » sur stderr à chaque
// dossier listé, résultat JSON sur stdout.
import fs from 'fs';
import {scanOperation} from './scan.mjs';
const [opDir,cfgPath,all]=process.argv.slice(2);
const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));
// Tests seulement : simule un dossier que Box ne liste plus (le processus reste muet).
if(process.env.EXTRACTERRE_TEST_FIGE&&opDir.includes(process.env.EXTRACTERRE_TEST_FIGE)&&(!process.env.EXTRACTERRE_TEST_FIGE_TANT_QUE||fs.existsSync(process.env.EXTRACTERRE_TEST_FIGE_TANT_QUE))) await new Promise(()=>setInterval(()=>{},1e6));
const res=await scanOperation(opDir,cfg,{allSubfolders:all==='1',onDir:()=>process.stderr.write('.')});
process.stdout.write(JSON.stringify(res));
