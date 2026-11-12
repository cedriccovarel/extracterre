#!/usr/bin/env node
// Installe (ou retire avec --retirer) le service d'import : LaunchAgent macOS lancé à l'ouverture de session.
//   node installer-service.mjs            installe et démarre
//   node installer-service.mjs --retirer  arrête et retire
import fs from 'fs';
import os from 'os';
import path from 'path';
import {execFileSync} from 'child_process';
import {fileURLToPath} from 'url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const LABEL='com.prestaterre.extracterre-import';
const plist=path.join(os.homedir(),'Library','LaunchAgents',`${LABEL}.plist`);
const uid=process.getuid();
const lc=(...a)=>{ try{ execFileSync('/bin/launchctl',a,{stdio:'ignore'}); return true; }catch{ return false; } };
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

lc('bootout',`gui/${uid}/${LABEL}`);
if(process.argv.includes('--retirer')){ try{ fs.unlinkSync(plist); }catch{} console.log('Service d’import retiré.'); process.exit(0); }

const logDir=path.join(os.homedir(),'ExtracTerre-import'); fs.mkdirSync(logDir,{recursive:true});
fs.mkdirSync(path.dirname(plist),{recursive:true});
fs.writeFileSync(plist,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>${esc(process.execPath)}</string><string>${esc(path.join(HERE,'watch.mjs'))}</string></array>
  <key>WorkingDirectory</key><string>${esc(HERE)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${esc(path.join(logDir,'service.log'))}</string>
  <key>StandardErrorPath</key><string>${esc(path.join(logDir,'service.log'))}</string>
</dict></plist>
`);
if(!lc('bootstrap',`gui/${uid}`,plist)) lc('load','-w',plist);
console.log(`Service d’import installé et démarré (${LABEL}).\nIl démarre à chaque ouverture de session ; journal : ${path.join(logDir,'service.log')}`);
