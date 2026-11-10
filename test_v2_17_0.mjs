// ExtracTerre v2.17.0 — tri des tuiles (remplissage, alphabétique) ; recherche Sécurité : A2P et BP ensemble, hall vitré et
// accès du hall mesurés dans Ashton ; valeurs étranges surlignées. Données FICTIVES.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION} from './js/config.js';
import {SECURITY_GRID,runSearchGrid,searchCellValue,srchPlanFacts} from './js/recherches.js';
import {oddValue} from './js/sanity.js';
import {correspondence} from './ashton/measure.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.23.0','version');

// Tri des tuiles.
const app=fs.readFileSync('js/app.js','utf8');
const sortTileItems=new Function(app.slice(app.indexOf('const TILE_SORTS='),app.indexOf('function renderTiles('))+';return sortTileItems;')();
const its=[['Les Tilleuls',40],['avenue Fictive',100],['',5],['Opération 10',0],['Opération 9',70]].map(([name,pct],i)=>({pct,id:{name,contract:name?'':'00009999'},p:{id:'p'+i}}));
eq(sortTileItems(its,'pctDesc').map(x=>x.pct),[100,70,40,5,0],'remplissage décroissant');
eq(sortTileItems(its,'pctAsc').map(x=>x.pct),[0,5,40,70,100],'remplissage croissant');
eq(sortTileItems(its,'alpha').map(x=>x.id.name||x.id.contract),['00009999','avenue Fictive','Les Tilleuls','Opération 9','Opération 10'],'alphabétique, sans casse, numéros dans l’ordre');

// A2P et BP ensemble.
const run=(txt,plans={})=>{ const d=textDoc('c1','CCTP FICTIF.pdf',null,txt); d.status='ready'; const r=runSearchGrid(SECURITY_GRID,[d],{},plans); return id=>searchCellValue(SECURITY_GRID.criteria.find(c=>c.id===id),r.criteria[id]); };
eq(run('Portes palières\nSerrure 3 points A2P* à cylindre européen')('porte_a2p'),'Non conforme','A2P* sans BP : non conforme');
eq(run('Portes palières\nBloc-porte BP1 anti-effraction\n- Serrure : crémone 3 points A2P*')('porte_a2p'),'Oui','BP1 et serrure A2P* du même bloc : conforme');
eq(run('Portes palières\nBloc porte A2P BP1 avec serrure 3 points')('porte_a2p'),'Oui','A2P BP1 : conforme');
eq(run('Portes palières\nBloc porte BP1')('porte_a2p'),'Non conforme','BP1 seul : non conforme');

// Hall vitré et accès (tables Ashton reçues par ExtracTerre).
const table=(rows)=>({p1:{docName:'Plan RDC.pdf',building:'Bâtiment A',refs:{},rows}});
const hall=(surf,widths,access)=>table([{key:'surface|hall',kind:'surface',ref:'Hall',n:1,pages:[1],min:surf,avg:surf,max:surf},
  ...(widths.length?[{key:'largeur|menuiserie hall',kind:'largeur',ref:'Menuiserie hall',n:widths.length,pages:[1],min:Math.min(...widths),avg:widths.reduce((a,b)=>a+b,0)/widths.length,max:Math.max(...widths)}]:[]),
  ...(access?[{key:'quantite|acces hall',kind:'quantite',ref:'Accès hall',field:'',n:1,pages:[1],total:access}]:[])]);
eq(run('Hall d’entrée\nVitrage feuilleté 44.2',hall(20,[2.4,0.8],1))('hall_vitrage'),'Oui (vitrage 35 % de la surface du hall (Ashton))','3,20 m × 2,20 m / 20 m² = 35 % et 44.2');
eq(run('Hall d’entrée\nVitrage feuilleté 44.2',hall(20,[2],1))('hall_vitrage'),'Non conforme (vitrage 22 % de la surface du hall (Ashton))','22 % < 30 %');
eq(run('Hall d’entrée\nVitrage clair',hall(20,[3.2],1))('hall_vitrage'),'À vérifier : vitrage 35 % de la surface du hall (Ashton), 44.2 non trouvé dans les documents','ratio atteint, 44.2 absent');
eq(srchPlanFacts(hall(20,[],1)).hall_vitrage,undefined,'pas de largeur de menuiserie : pas de ratio');
eq(run('Hall',hall(20,[],1))('hall_traversant'),'Oui (1 accès compté(s) dans Ashton)','un seul accès : non traversant');
eq(run('Hall',hall(20,[],2))('hall_traversant'),'Non conforme (2 accès compté(s) dans Ashton)','deux accès : traversant');
eq(run('Le hall traversant dessert les deux cours')('hall_traversant'),'Non conforme','« hall traversant » dans un CCTP : indice contraire');
eq(run('Hall non traversant, accès unique sur rue')('hall_traversant'),'Oui','« non traversant » : conforme');
// Ashton : l'outil Accès produit un comptage « Accès hall » relu par ExtracTerre.
const corr=correspondence([{id:1,type:'count',page:1,pts:[{x:0,y:0}],cat:'Accès hall',ref:'Accès hall'}],()=>0.01);
eq([corr[0].kind,corr[0].ref,corr[0].total],['quantite','Accès hall',1],'comptage Accès hall');

// Valeurs étranges.
eq([oddValue('tic',21.5)!=='',oddValue('tic','27,4'),oddValue('dh',3)!=='',oddValue('dh_znt',1400)!=='',oddValue('dh_zt',600)],[true,'',true,true,''],'Tic et DH');
eq([oddValue('cep',450)!=='',oddValue('cep',72),oddValue('cep_before',650),oddValue('cep_before',900)!==''],[true,'','',true],'Cep');
eq([oddValue('heating_vector_after','Fioul domestique')!=='',oddValue('ecs_vector_after','Gaz naturel'),oddValue('heating_vector_before','Fioul')],[true,'',''],'fioul après travaux seulement');
eq([oddValue('tic',''),oddValue('shab',3)],['',''],'vide et champ sans règle');
console.log(`v2.23.0 — ${n} vérifications OK (données fictives)`);
