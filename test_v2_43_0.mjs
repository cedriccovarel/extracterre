// ExtracTerre v3.0.4 — bâtiments = Salesforce : « Total bâtiments », jamais plus de N, valeurs non rattachées gardées. Noms fictifs.
import fs from 'fs';
import {APP_VERSION} from './js/config.js';
import {sfPerimeter,sfCountNames,sfRankNames,sfIsList,sfSplitGroup} from './js/sf-perimeter.js';
import {sfxColumns,sfxFiche} from './js/sf-export.js';
let n=0; const eq=(a,b,l)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); if(A!==B){ console.error(`ÉCHEC ${l}\n  obtenu  : ${A}\n  attendu : ${B}`); process.exit(1); } n++; };
eq(APP_VERSION,'3.0.5','version');
const D=[{name:'Bâtiment A',results:8},{name:'BATIMENT A',results:2},{name:'Bâtiment 1',results:3},{name:'Bâtiment B',results:6},{name:'Bâtiment A et B',results:5},
  {name:'Bâtiment Zone 1',results:4},{name:'Bâtiment C',results:1},{name:'Bâtiment unique',results:9},{name:'Bâtiment Synthèse des résultats',results:7}];
eq(sfCountNames(2,D),['Bâtiment A','Bâtiment B'],'N=2 sans noms : les 2 noms les mieux renseignés, un par identifiant (A = BATIMENT A = 1)');
eq(sfCountNames(1,D),['Bâtiment unique'],'N=1, plusieurs noms lus : « Bâtiment unique »');
eq(sfCountNames(1,[{name:'Bât A',results:3},{name:'BATIMENT A',results:1}]),['Bâtiment A'],'N=1, un seul nom lu : ce nom');
eq(sfCountNames(0,D),['Bâtiment unique'],'0 = 1 bâtiment');
eq(sfRankNames(D).includes('Bâtiment Zone 1')||sfRankNames(D).includes('Bâtiment Synthèse des résultats'),false,'sous-ensembles et titres jamais bâtiments');
eq([sfIsList('Bâtiment A et B'),sfIsList('Bâtiment A Est')],[true,false],'liste ≠ bâtiment');
let m=sfPerimeter({total:2,detected:D});
eq([m.sf.length,m.map['Bâtiment 1'],m.map['Bâtiment Zone 1'],m.source],[2,'Bâtiment A',null,'nombre'],'N=2 : rattachements, le reste non rattaché');
m=sfPerimeter({total:1,detected:D}); eq(Object.values(m.map).every(x=>x==='Bâtiment unique'),true,'N=1 : tout se rattache au bâtiment unique');
m=sfPerimeter({total:1,detected:D,manual:{'Bâtiment C':''}}); eq(m.map['Bâtiment C'],null,'N=1 : la correction « non retenu » reste prioritaire');
m=sfPerimeter({names:['BAT A','BAT B','BAT C'],total:2,detected:[{name:'Bâtiment A',results:1}]}); eq([m.sf,m.sfExtra],[['Bâtiment A','Bâtiment B'],['Bâtiment C']],'noms SF > Total bâtiments : jamais plus de N');
m=sfPerimeter({names:['BAT A'],total:2,detected:[{name:'Bâtiment A',results:8},{name:'Bâtiment Zone 1',results:7},{name:'Bâtiment C',results:6},{name:'Bâtiment 2',results:3}]});
eq(m.sf,['Bâtiment A','Bâtiment C'],'noms SF < Total : complétés par le nom de document le mieux renseigné');
eq(sfPerimeter({names:[],total:null,detected:D}),null,'ni noms ni total : pas de périmètre (inchangé)');
const H=['Numéro du contrat','Opération: Code interne','Total logements','Total bâtiments'], c=sfxColumns(H);
eq(c.buildingTotal,3,'colonne « Total bâtiments » reconnue');
eq([sfxFiche(['123','','10','3'],c).buildingTotal,sfxFiche(['123','','10','0'],c).buildingTotal,sfxFiche(['123','','10',''],c).rawBuildingTotal],[3,1,null],'0/vide → 1 pour le périmètre, colonne seulement si écrit');
const app=fs.readFileSync('js/app.js','utf8'), per=fs.readFileSync('js/persistence.js','utf8');
eq(/sfBuildingTotal:project\.sfBuildingTotal\?\?null/.test(per),true,'total sauvegardé');
eq(/sfUnassigned:true/.test(app)&&/r\.uncertain=\[\.\.\.r\.uncertain\.filter\(keep\),\.\.\.added\.filter\(o=>o\.sfUnassigned\)\]/.test(app),true,'valeurs non rattachées → à vérifier, pas supprimées');
eq(/if\(b==='Bâtiment unique'\) return S\.length>1\?S:\[\]; const parts=sfSplitGroup\(b\)/.test(app),true,'valeur sans bâtiment ou d’un groupe → chaque bâtiment (si vide)');
eq([sfSplitGroup('Bât 2 & 3'),sfSplitGroup('Bâtiment AB'),sfSplitGroup('Bâtiment MOULIN')],[['Bâtiment 2','Bâtiment 3'],['Bâtiment AB'],['Bâtiment MOULIN']],'listes de la fiche Salesforce découpées ; « AB » = un bâtiment');
eq(sfPerimeter({names:['Bâtiment 2','Bâtiment 2 & 3','Bâtiment 3'],total:3,detected:[{name:'Bâtiment 4',results:3}]}).sf,['Bâtiment 2','Bâtiment 3','Bâtiment 4'],'groupe SF = ses bâtiments, complétés jusqu’à N');
console.log(`v3.0.4 — ${n} vérifications OK (données fictives)`);
// Exécution réelle des fonctions de l'application sur une opération fictive (extraites de js/app.js).
{
  const {canonicalBuilding}=await import('./js/buildings.js'); const SP=await import('./js/sf-perimeter.js');
  const grab=name=>{ const i=app.indexOf(name); let d=0,j=app.indexOf('{',i); for(;j<app.length;j++){ if(app[j]==='{')d++; else if(app[j]==='}'&&--d===0) break; } return app.slice(i,j+1); };
  const src=[ "const SF_RESULT_FIELDS="+app.slice(app.indexOf("const SF_RESULT_FIELDS=")+23,app.indexOf(";",app.indexOf("const SF_RESULT_FIELDS="))+1),
    grab('function sfDetectedNames('),grab('function sfDetected('),grab('function sfTotal('),grab('function sfPerimeterOn('),grab('function sfPerimeterOf('),grab('function applySfPerimeter(')].join('\n');
  const f=new Function('canonicalBuilding','sfPerimeter','sfPerimeterMap','sfSplitGroup','manualPasteOccurrences',src+'\nreturn {applySfPerimeter,sfPerimeterOf};');
  const A=f(canonicalBuilding,SP.sfPerimeter,SP.sfPerimeterMap,SP.sfSplitGroup,()=>[]);
  const occ=(b,field,value)=>({building:b,field,value});
  const mk=()=>({sfBuildingTotal:2,docs:[{cachedOccurrences:[occ('Bâtiment A','bbio',50),occ('Bâtiment A','cep',60),occ('Bâtiment B','bbio',40),occ('Bâtiment C','bbio',30),occ('Bâtiment A et B','tic',27)]}],
    result:{rows:[{building:'Bâtiment A',bbio:50,cep:60},{building:'Bâtiment B',bbio:40},{building:'Bâtiment C',bbio:30,dh:900},{building:'Bâtiment A et B',tic:27},{building:'Bâtiment unique',ubat_after:0.5}],
      finals:[{building:'Bâtiment A',field:'bbio',value:50},{building:'Bâtiment A',field:'cep',value:60},{building:'Bâtiment B',field:'bbio',value:40},{building:'Bâtiment C',field:'bbio',value:30},{building:'Bâtiment C',field:'dh',value:900},{building:'Bâtiment A et B',field:'tic',value:27},{building:'Bâtiment unique',field:'ubat_after',value:0.5}],
      detailed:[],uncertain:[],buildings:['Bâtiment A','Bâtiment B','Bâtiment C','Bâtiment A et B','Bâtiment unique']}});
  const p=mk(); A.applySfPerimeter(p); const r=p.result, row=b=>r.rows.find(x=>x.building===b);
  eq(r.rows.map(x=>x.building),['Bâtiment A','Bâtiment B'],'appli : N=2 → 2 bâtiments, jamais plus');
  eq([row('Bâtiment A').tic,row('Bâtiment B').tic,row('Bâtiment A').ubat_after,row('Bâtiment B').ubat_after],[27,27,0.5,0.5],'appli : valeur de « A et B » et valeur sans bâtiment → chaque bâtiment');
  eq(r.uncertain.filter(o=>o.sfUnassigned).map(o=>`${o.building}:${o.field}=${o.value}`).sort(),['Bâtiment A:bbio=30','Bâtiment A:dh=900','Bâtiment B:bbio=30','Bâtiment B:dh=900'],'appli : bâtiment C non rattaché → valeurs « non affectées » à vérifier, pas perdues');
  eq([row('Bâtiment A').bbio,r.sfUnassigned.length],[50,2],'appli : une valeur propre n’est jamais remplacée ; 2 valeurs non affectées comptées');
  const q=mk(); q.sfBuildingTotal=1; A.applySfPerimeter(q); eq(q.result.rows.length,1,'appli : N=1 → un seul bâtiment');
  const z=mk(); z.sfPerimeterOff=true; A.applySfPerimeter(z); eq(z.result.rows.length,5,'appli : périmètre désactivé → tout est gardé (retour arrière)');
  console.log('  (fonctions de l’application exécutées)');
}
// Règle C : valeurs manuelles / Salesforce différentes sur un même bâtiment (fusion).
{
  const grab=name=>{ const i=app.indexOf(name); let d=0,j=app.indexOf('{',i); for(;j<app.length;j++){ if(app[j]==='{')d++; else if(app[j]==='}'&&--d===0) break; } return app.slice(i,j+1); };
  const f=new Function('SF_SRC','sfDocDiffers',grab('function manualWinners(')+'\nreturn manualWinners;');
  const diff=(k,a,b)=>String(a)!==String(b), W=f(/salesforce/i,diff);
  const result={rows:[{building:'Bâtiment A'}]}, alias={'Bâtiment 1':'Bâtiment A','BAT A':'Bâtiment A'};
  const P=(mv,ms)=>({manualValues:mv,manualSources:ms});
  let w=W(P({'Bâtiment A|bbio':50,'Bâtiment 1|bbio':52},{'Bâtiment 1|bbio':{fileName:'Salesforce — export'}}),result,alias).get('Bâtiment A|bbio');
  eq([w.key,w.others],['Bâtiment 1|bbio',[{value:50,from:'Bâtiment A',sf:false}]],'C : la valeur Salesforce l’emporte, l’autre en info-bulle');
  w=W(P({'Bâtiment 1|bbio':52,'Bâtiment A|bbio':50},{}),result,alias).get('Bâtiment A|bbio');
  eq(w.key,'Bâtiment A|bbio','C : sans Salesforce, la valeur saisie sur le bâtiment lui-même (comme avant)');
  w=W(P({'Bâtiment 1|bbio':52,'BAT A|bbio':53},{}),result,alias).get('Bâtiment A|bbio');
  eq(w.key,'BAT A|bbio','C : sinon la dernière (comme avant)');
  w=W(P({'Bâtiment A|bbio':50,'Bâtiment 1|bbio':50},{'Bâtiment 1|bbio':{fileName:'Salesforce'}}),result,alias).get('Bâtiment A|bbio');
  eq(w.others,[],'C : mêmes valeurs → pas d’info-bulle');
  eq(/if\(win\?\.others\?\.length\) manual\.otherManual=win\.others;/.test(app)&&/autre\(s\) valeur\(s\)/.test(app),true,'C : info-bulle branchée');
  console.log('  règle C OK');
}
{ const A=(await import('./js/sf-export.js')).sfxColumns(['Numéro du contrat','Nombre de bâtiments']); eq(A.buildingTotal,1,'v3.0.4 : future colonne « Nombre de bâtiments » reconnue');
  eq(/Incohérence interne Salesforce/.test(app)&&/bâtiment\(s\) sans identité/.test(app),true,'v3.0.4 : incohérence Salesforce et identités manquantes signalées');
  const m=sfPerimeter({names:['BAT A','BAT B','BAT C'],total:2,detected:[]}); eq([m.named.length,m.total],[3,2],'v3.0.4 : noms SF comptés pour l’alerte'); }
