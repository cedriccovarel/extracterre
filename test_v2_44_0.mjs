// ExtracTerre v3.0.3 — statuts de confrontation Salesforce (prompt maître §2.2). Données fictives.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
import {sfConfront,sfCheckCounts} from './js/confrontation.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'3.0.3','version');
const differs=(f,a,b)=>{ const x=Number(String(a).replace(',','.')),y=Number(String(b).replace(',','.')); return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)>0.051:String(a)!==String(b); };
const rules={bbio:{main:['RSET'],secondary:['Étude thermique'],forbidden:[]},heating_system:{main:['CCTP'],secondary:[],forbidden:[]},tic:{main:['RSET'],secondary:[],forbidden:[]},ic_energy:{main:['RSEE'],secondary:[],forbidden:[]}};
const det=[{building:'Bâtiment A',field:'bbio',value:52.1,fileName:'RSET v2.pdf',page:3,status:'retenu',confidence:.95},{building:'Bâtiment A',field:'bbio',value:49.9,fileName:'RSET v1.pdf',status:'rejeté',confidence:.95},
  {building:'Bâtiment B',field:'bbio',value:61,fileName:'RSET.pdf',status:'retenu'},{building:'Bâtiment A',field:'heating_system',value:'PAC air/eau',fileName:'CCTP.pdf',status:'retenu'},
  {building:'Bâtiment B',field:'bbio',value:60,method:'manual:free-paste',sourceTier:'manual'}];
const docs=[{type:'RSET',status:'ready'},{type:'CCTP',status:'ready'},{type:'RSEE',status:'reading'}];
const c=sfConfront({sf:[{building:'Bâtiment A',field:'bbio',value:49.9},{building:'Bâtiment B',field:'bbio',value:58},{building:'Bâtiment A',field:'heating_system',value:42},{building:'Bâtiment A',field:'tic',value:27},{building:'Bâtiment A',field:'ic_energy',value:120},{building:'Bâtiment A',field:'shab',value:900}],detailed:det,docs,rules,differs});
eq(c['Bâtiment A|bbio'].status,'CONFIRMEE','une version du document confirme Salesforce');
eq([c['Bâtiment B|bbio'].status,c['Bâtiment B|bbio'].docValue],['DIVERGENCE_DOCUMENTAIRE',61],'divergence : valeur du document retenu (la valeur manuelle n’est pas un document)');
eq(c['Bâtiment A|heating_system'].status,'NON_COMPARABLE','texte ↔ nombre : non comparable');
eq(c['Bâtiment A|tic'].status,'NON_RETROUVEE','RSET lu, Tic absent');
eq(c['Bâtiment A|ic_energy'].status,'NON_VERIFIEE','RSEE pas encore lu');
eq(c['Bâtiment A|shab'].status,'VERIFICATION_IMPOSSIBLE','aucune source définie / aucun document pertinent');
eq(sfCheckCounts(c).CONFIRMEE,1,'comptes');
eq(sfConfront({sf:[{building:'Bâtiment A',field:'bbio',value:52}],detailed:[{building:'Bâtiment A',field:'bbio',value:52.3}],docs,rules,differs})['Bâtiment A|bbio'].status,'CONFIRMEE','arrondi Salesforce : 52 ↔ 52,3 confirmée');
eq(sfConfront({sf:[{building:'Bâtiment A',field:'bbio',value:52}],detailed:[{building:'Bâtiment A',field:'bbio',value:52.6}],docs,rules,differs})['Bâtiment A|bbio'].status,'DIVERGENCE_DOCUMENTAIRE','52 ↔ 52,6 : divergence');
const app=fs.readFileSync('js/app.js','utf8'), bb=fs.readFileSync('build_bundle.py','utf8');
eq(/result\.sfChecks=sfConfront\(/.test(app)&&/o\.sfCheck=result\.sfChecks/.test(app),true,'confrontation calculée à chaque consolidation');
eq(/sfCheckChip\(activeProject\(\)\)/.test(app)&&/sfCheckTip\(o\)/.test(app),true,'statut visible (info-bulle + résumé)');
eq(/'confrontation\.js'/.test(bb),true,'module dans le bundle');
eq(/row\[field\]=value;/.test(app),true,'Salesforce reste la valeur affichée');
console.log(`v3.0.3 — ${n} vérifications OK (données fictives)`);
