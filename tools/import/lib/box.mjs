// v3.3.0 — relance de Box Drive (macOS) : arrête Box et son extension de fichiers, puis le rouvre. Remède au listage de dossier
// figé (le 20/11/2026, 4 dossiers figés ont bloqué l'analyse deux jours). Sans effet hors macOS ou si Box n'est pas installé.
import {spawn} from 'child_process';
import fs from 'fs';
const run=(cmd,args)=>new Promise(r=>{ try{ const p=spawn(cmd,args,{stdio:'ignore'}); p.on('exit',c=>r(c)); p.on('error',()=>r(-1)); }catch{ r(-1); } });
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function restartBox({log=console.log,settleMs=45000}={}){
  if(process.env.EXTRACTERRE_TEST_SANS_BOX){ log('  (test) relance de Box simulée'); return true; }
  if(process.platform!=='darwin'||!fs.existsSync('/Applications/Box.app')) return false;
  log('  Relance de Box Drive…');
  await run('/usr/bin/pkill',['-x','Box']); await run('/usr/bin/pkill',['-f','boxfileprovider']);
  await wait(5000);
  await run('/usr/bin/pkill',['-9','-f','boxfileprovider']);
  await run('/usr/bin/open',['-g','-a','Box']);
  await wait(settleMs);
  log('  Box Drive relancé.');
  return true;
}
