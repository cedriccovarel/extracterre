// ExtracTerre v2.29.0 — Nouvelle analyse en 3 étapes (contrats → export Salesforce → documents) ; lots de CCTP limités aux
// thèmes des Recherches ; études thermiques toujours lues. Noms fictifs.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
import {cctpLotDecision,ir_norm} from './js/import-rules.js';
import {gridCctpLots,normalizeGrid,SECURITY_GRID} from './js/recherches.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'2.36.1','version');
const sec=gridCctpLots(SECURITY_GRID), fan=gridCctpLots(normalizeGrid({name:'Brasseurs',themes:[{name:"Brasseurs d'air / ventilateurs"},{name:'Climatisation'},{name:'Mode constructif principal'}]}));
eq(['menuiserie','serrurerie','electricite','vrd'].every(x=>sec.includes(x)),true,'sécurité → menuiseries, serrurerie, électricité, VRD');
eq(['electricite','cvc','gros oeuvre'].every(x=>fan.includes(x))&&!fan.includes('charpente'),true,'brasseurs / clim / mode constructif → électricité, CVC, gros œuvre');
eq(gridCctpLots(normalizeGrid({name:'X',themes:[{name:'Sécurité'}],cctpLots:['lot perso']})),['lot perso'],'lots saisis dans la grille prioritaires');
const L=[...new Set([...sec,...fan])], r=nm=>cctpLotDecision(nm,L).read;
eq(['LOT 05 MENUISERIES EXTERIEURES.pdf','EAJE-DCE-LOT08 ELEC-PV-CCTP.pdf','CCTP-LOTN° 02 - GROS ŒUVRE.pdf','CE_DCE_CCTP_LOT 03_MEX.pdf','LOT 1 - GO - DESCRIPTIF.pdf','Lot 09 CVC.pdf'].map(r),[true,true,true,true,true,true],'lots utiles lus (abréviations, ligature Œ)');
eq(['Lot 05 Charpente Couverture.pdf','LOT 04 ETANCHEITE.pdf','LOT 12 PEINTURE.pdf','LOT 06 PLATRERIE.pdf','CE_DCE_CCTP_LOT 09_PEINT.pdf'].map(r),[false,false,false,false,false],'lots hors thèmes écartés');
eq(['CCTP.pdf','CCTP compilé DCE.pdf','Descriptif général.pdf'].map(r),[true,true,true],'CCTP sans lot identifiable toujours lu');
eq(cctpLotDecision('LOT 12 PEINTURE.pdf',[]).read,true,'sans grille : tout est lu');
eq(ir_norm('GROS ŒUVRE'),'gros oeuvre','ligature Œ');
const cli=fs.readFileSync('tools/import/extracterre-import.mjs','utf8'), w=fs.readFileSync('tools/import/watch.mjs','utf8'), app=fs.readFileSync('js/app.js','utf8');
eq(/f\.family!=='cctp'\|\|f\.ignoreReason/.test(cli)&&/--lots-cctp/.test(w),true,'script : lots transmis par la demande, filtre limité au dossier CCTP');
eq(/data-ss-sfx/.test(app)&&/onlyContracts:new Set\(r\.contracts/.test(app)&&/cctpLots:ssCctpLots\(\)/.test(app),true,'appli : export Salesforce en étape 2, lots des Recherches dans la demande');
eq(/data-g="cctpLots"/.test(app),true,'lots modifiables dans l’éditeur de grille');
console.log(`v2.31.0 — ${n} vérifications OK (données fictives)`);
