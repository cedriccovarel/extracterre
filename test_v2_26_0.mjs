// ExtracTerre v2.26.0 — import d'un export Salesforce « Opérations (détails) » : une fiche par ligne, même décodeur que le favori.
// Données fictives.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
import {sfxParseHtmlTable,sfxColumns,sfxFiche} from './js/sf-export.js';
import {parseFreePaste,freePasteValues} from './js/collage-libre.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'2.33.0','version');
const html='<head><META http-equiv="Content-Type" content="text/html; charset=ISO-8859-1"></head><table><tr><th filter=all>Contrat: Num&eacute;ro du contrat</th><th>Code interne</th><th>&Eacute;valuation: Statut</th><th>&Eacute;valuation: Performance thermique</th><th>&Eacute;valuation: Parois verticales</th><th>&Eacute;valuation: Chauffage</th></tr>'
 +'<tr><td>4794</td><td>OPE-104794</td><td>Visite r&eacute;alis&eacute;e</td><td>* BAT A : 12x logements collectifs :<br>Bbio : 41,2 / 58,8 / -29,9 %<br>Cep : 59,9 / 75,6 / -20,8 %<br><br>* BAT B : 8x logements collectifs :<br>Bbio : 35,3 / 58,6 / -39,8 %</td><td>Murs sur ext&eacute;rieur :<br>140mm laine de roche R=3,85</td><td>chaudi&egrave;re gaz &agrave; condensation</td></tr>'
 +'<tr><td></td><td>OPE-100001</td><td></td><td></td><td></td><td></td></tr></table>';
const rows=sfxParseHtmlTable(html);
eq(rows.length,3,'tableau HTML lu (en-tête + 2 lignes)');
eq(rows[1][3].split('\n')[1],'Bbio : 41,2 / 58,8 / -29,9 %','<br> → retours à la ligne, entités décodées');
const cols=sfxColumns(rows[0]);
eq([cols.contract,cols.code,cols.evalStatus],[0,1,2],'colonnes contrat / code / statut');
eq(cols.sections.map(s=>s.title),['Performance thermique','Parois verticales','Chauffage'],'sections techniques reconnues');
const f=sfxFiche(rows[1],cols);
eq([f.contract,f.code,f.evaluationStatus,f.hasTechnical],['00004794','OPE-104794','Visite réalisée',true],'identifiants de la ligne');
eq(sfxFiche(rows[2],cols).hasTechnical,false,'ligne sans donnée technique');
const vals=freePasteValues(parseFreePaste(f.text));
const A=vals.find(v=>/A$/.test(v.building)), B=vals.find(v=>/B$/.test(v.building));
eq([A?.values.bbio,B?.values.bbio],[41.2,35.3],'même décodeur que le favori : un bloc par bâtiment');
eq(vals.some(v=>v.values.wall_insulation_r===3.85||Object.values(v.values).includes(3.85)),true,'paroi : R lu');
eq(vals.some(v=>Object.prototype.hasOwnProperty.call(v.values,'contract_status')),false,'aucun statut de contrat inventé');
const app=fs.readFileSync('js/app.js','utf8');
eq(/data-home-act="sfx"/.test(app)&&/function sfxImport/.test(app)&&/function sfxApplyToProject/.test(app),true,'tuile et import dans l’appli');
eq(/!SF_SRC\.test\(cur\?\.fileName\|\|''\)&&!replaceManual/.test(app),true,'saisies manuelles conservées sauf option');
eq(/p\.salesforceImports=\[\.\.\.\(p\.salesforceImports\|\|\[\]\),\{at:Date\.now\(\),values:applied\}\]/.test(app),true,'import Salesforce daté (compteur de l’accueil)');
console.log(`v2.31.0 — ${n} vérifications OK (données fictives)`);
