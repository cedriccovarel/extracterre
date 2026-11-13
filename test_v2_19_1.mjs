// ExtracTerre v2.19.0 — Recherches : statut « Partiel » du sas sécurisé (Vigik + visiophone, sans platine IK08). Données FICTIVES.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from './js/config.js';
import {SECURITY_GRID,runSearchGrid,searchCellValue,normalizeGrid} from './js/recherches.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.36.0','version');
const doc=text=>({id:'d1',name:'CCTP fictif.pdf',status:'ready',read:{pages:[{page:3,text}]}});
const run=(text,ov={})=>runSearchGrid(SECURITY_GRID,[doc(text)],ov);
const crit=SECURITY_GRID.criteria.find(c=>c.id==='hall_sas');
const SAS='Hall d\'entrée\nSas d\'entrée équipé d\'un lecteur Vigik\net d\'un visiophone sur platine de rue\nPorte intérieure à ventouse';
{ const r=run(SAS), x=r.criteria.hall_sas;
  eq([x.found,x.partial,x.contrary],[false,true,false],'Vigik + visiophone sans IK08 : partiel');
  eq(searchCellValue(crit,x),'Partiel (Vigik + visiophone, platine IK08 non trouvée)','libellé'); }
{ const x=run(SAS+'\nPlatine anti-vandale IK08').criteria.hall_sas; eq([x.found,!!x.partial],[true,false],'avec IK08 : trouvé'); }
{ const x=run('Sas d\'entrée avec lecteur de badge\nPorte à ventouse').criteria.hall_sas; eq([x.found,!!x.partial],[true,false],'sans visiophone : règle inchangée'); }
{ const x=run(SAS,{hall_sas:'Oui'}).criteria.hall_sas; eq([x.found,!!x.partial],[true,false],'décision manuelle Oui'); }
{ const x=run('Sas d\'entrée avec lecteur de badge',{hall_sas:'Partiel'}).criteria.hall_sas; eq([x.found,x.partial,searchCellValue(crit,x)],[false,true,'Partiel'],'décision manuelle Partiel'); }
// Partiel ne compte pas pour le thème.
eq(run(SAS).themes['Halls d’entrée'].found<run(SAS+'\nPlatine anti-vandale IK08').themes['Halls d’entrée'].found,true,'thème');
// Grille enregistrée avant v2.19.0 : la règle est rappelée.
eq(/Partiel/.test(normalizeGrid({...SECURITY_GRID,criteria:SECURITY_GRID.criteria.map(c=>c.id==='hall_sas'?{...c,description:''}:c)}).criteria.find(c=>c.id==='hall_sas').description),true,'migration');
const app=readFileSync('js/app.js','utf8'); eq(/SRCH_PARTIAL_IDS=new Set\(\['hall_sas'\]\)/.test(app)&&/partial:'◐'/.test(app),true,'interface');
// Observatoire des recherches : flux sans citations, dernier résultat gardé par projet, bilan à l'ouverture.
eq(/function feedSearch\(r\)/.test(app)&&!/function feedSearch\(r\)[^\n]*evidence/.test(app),true,'flux sans citations');
eq(/searchCache/.test(app)&&/searchCache:safeJsonClone\(project\.searchCache/.test(readFileSync('js/persistence.js','utf8')),true,'résultats gardés et sauvegardés');
eq(/opération\(s\) avec recherches sur/.test(app),true,'bilan (à l’export depuis v2.23.0)');
console.log(`test_v2_19_1 : ${n}/${n} OK`);
