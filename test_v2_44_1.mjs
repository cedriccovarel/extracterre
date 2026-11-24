// ExtracTerre v3.0.4 — politiques d'absence par critère (onglet Recherches seulement). Documents fictifs.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
import {normalizeGrid,runSearchGrid,searchCellValue} from './js/recherches.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'3.5.1','version');
const doc=(id,name,type,lines)=>({id,name,type,status:'ready',read:{pages:[{page:1,text:lines.join('\n'),lines:lines.map(t=>({text:t}))}]}});
const cctp=doc('d1','CCTP lot 12 CVC.pdf','CCTP',['Ventilation simple flux hygro B','Chauffage par pompe à chaleur']);
const notice=doc('d2','Notice descriptive.pdf','Notice',['Logements sans climatisation','Volets roulants motorisés']);
const crit=(id,label,extra={})=>({id,theme:'Confort',label,kind:'presence',keywords:[label.toLowerCase()],...extra});
const g=normalizeGrid({id:'t',name:'Test',criteria:[crit('brasseur','Brasseur'),crit('brasseur_inf','Brasseur',{id:'brasseur_inf',absence:'inference',absenceDocs:['CCTP']}),
  crit('clim','Climatiseur',{negative:['sans climatisation']}),crit('pv','Photovoltaïque',{absence:'inference',absenceDocs:['RSET']}),crit('vmc','Ventilation'),
  {id:'nb',theme:'Confort',label:'Nombre de brasseurs',kind:'number',keywords:['brasseurs']}]});
const r=runSearchGrid(g,[cctp,notice]);
const st=id=>r.criteria[id].absence, cell=id=>searchCellValue(g.criteria.find(c=>c.id===id),r.criteria[id]);
eq([st('brasseur'),cell('brasseur')],['INDETERMINE',''],'défaut : rien trouvé = indéterminé, cellule vide (comme avant)');
eq([st('brasseur_inf'),cell('brasseur_inf')],['ABSENT_PAR_INFERENCE','Absent (par inférence)'],'inférence : CCTP lu, aucune mention → absent par inférence');
eq([st('clim'),cell('clim')],['ABSENT_EXPLICITE','Absent (mention explicite)'],'mention « sans climatisation » → absent explicite');
eq(st('pv'),'INDETERMINE','inférence demandée mais RSET absent → indéterminé');
eq([st('vmc'),cell('vmc')],['PRESENT_EXPLICITE','Oui'],'trouvé → présent');
eq(st('nb'),'NON_RENSEIGNE','donnée chiffrée absente → non renseigné (jamais 0)');
const r2=runSearchGrid(g,[cctp],{brasseur_inf:'Sans objet'}); eq(r2.criteria.brasseur_inf.absence,'NON_APPLICABLE','décision « Sans objet » → non applicable');
const app=fs.readFileSync('js/app.js','utf8');
eq(/data-c="absence"/.test(app)&&/data-c="negative"/.test(app)&&/absence:f\('absence'\)/.test(app),true,'politique réglable dans l’éditeur de grille');
eq(/absence:x\.absence\|\|''/.test(app),true,'statut exporté (observatoire / TotalRecoll)');
eq(normalizeGrid({criteria:[{label:'x'}]}).criteria[0].absence,'indetermine','grilles existantes : indéterminé par défaut (aucun changement)');
console.log(`v3.0.4 — ${n} vérifications OK (documents fictifs)`);
