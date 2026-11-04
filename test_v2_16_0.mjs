// ExtracTerre v2.16.0 — étude RE2020 de BE (« Synthèse thermique & carbone », « Mode constructif ») classée Étude thermique et lue. Données FICTIVES.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {classifyDocument} from './js/classifier.js';
import {parseDocument} from './js/parsers.js';
import {normalizeText} from './js/utils.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.18.2','version');

const pagesTxt=[
  ['Etude RE2020 Projet 99999 FICTIVILLE _V2','DOSSIER THERMIQUE ET ENVIRONNEMENTAL','SYNTHESE THERMIQUE & CARBONE','COMPOSITION DU PROJET','Surface Habitable Usage au sens de Typologies *','[m²] la RE2020 T1 T2 T3 T4 T5','Batiment A','1234,5 Immeuble collectif 2 5 6 3 -'],
  ['RESULTATS','Bbio = 55,2','Performance du Bati 12%','BioMax = 62,7','Cep = 60,1','CepMax = 80,0','Ic Energie = 210','Ic Energie [kgCO2 eqv] 16% Seuil 2025','Ic Energie max = 260','Ic Construction = 590','Ic Construction [kgCO2 eqv] 2% Seuil 2025','Ic Construction max = 610',
   'Rappel: le DPE est effectue en fin de chantier par un diagnostiqueur independant du BE Thermique.'],
  ['MODE CONSTRUCTIF 1','> LES PLANCHERS BAS 1','Dallage Terre-Plein Structure Dalle beton - -','Isolation Polyurethane','Suivant Reperage Parois joint au dossier 90 4,10','surdalle λ=0,022',
   '> LES PAROIS VERTICALES 1','Paroi exterieure "Beton banche" Structure Voile Beton** 180 -','Isolation','Suivant Reperage Parois joint au dossier PSE TH32 140+13 4,40','Interieure',
   'Paroi interieure donnant','sur un Local Non Chauffe Structure Voile Beton** - -','Isolation','Suivant Reperage Parois joint au dossier PSE TH32 60+13 1,90','Interieure',
   '> LES PLANCHERS HAUTS 1','Toiture terrasse Lourde Structure Dalle Beton 200 -','Isolationexterieure Polyurethane','Suivant Reperage Parois joint au dossier 180 8,10','> TRAITEMENT DES PONTS THERMIQUES 1','Batiment A Rupteur thermique 120 m 300 m ≤ 0,26']
];
const pages=pagesTxt.map((ls,p)=>{ const lines=ls.map((t,i)=>({index:i,text:normalizeText(t),y:800-i*12})); return {page:p+1,text:lines.map(l=>l.text).join('\n'),lines}; });
const read={kind:'pdf',pages,pageCount:pages.length,text:pages.map(p=>p.text).join('\n\f\n')};
const name='Etude RE2020 Projet 99999 FICTIVILLE _V2.pdf';
eq(classifyDocument(name,read.text,{kind:'pdf'}).type,DOC_TYPES.THERMAL,'« le DPE est effectué en fin de chantier » ne fait pas un DPE');
const occ=parseDocument({id:'t',name,type:DOC_TYPES.THERMAL,familyMode:'auto',read,buildings:{names:['Bâtiment unique']}});
const vals=f=>[...new Set(occ.filter(o=>o?.field===f).map(o=>o.value))];
const mc=f=>[...new Set(occ.filter(o=>o?.field===f&&o.method==='thermal:construction-mode').map(o=>o.value))];
eq([vals('bbio'),vals('bbio_max'),vals('cep'),vals('cep_max')],[[55.2],[62.7],[60.1],[80]],'indicateurs énergie (BioMax = Bbio max)');
eq([vals('ic_energy'),vals('ic_energy_max'),vals('ic_construction'),vals('ic_construction_max')],[[210],[260],[590],[610]],'Ic : le max n’est pas pris pour la valeur');
eq(vals('shab'),[1234.5],'SHAB du tableau « Composition du projet »');
eq([mc('floor_structure'),mc('floor_insulation'),mc('floor_insulation_thickness'),mc('floor_insulation_r')],[['Béton armé'],['PUR'],[90],[4.1]],'plancher bas');
eq([mc('wall_structure'),mc('wall_insulation'),mc('wall_insulation_thickness'),mc('wall_insulation_r'),mc('wall_iti_thickness')],[['Béton armé'],['PSE'],[140],[4.4],[140]],'paroi extérieure seule (paroi sur local non chauffé écartée), ITI');
eq([mc('roof_structure'),mc('roof_insulation'),mc('roof_insulation_thickness'),mc('roof_insulation_r')],[['Béton armé'],['PUR'],[180],[8.1]],'plancher haut ; ponts thermiques hors section');

// Favoris des tuiles d'accueil : sauvegardés avec l'opération, étoile sur chaque tuile, tuile « ★ Favoris ».
const {serializeProjectFull:serializeProject}=await import('./js/persistence.js');
eq([serializeProject({id:'a',favorite:true,docs:[]}).favorite,serializeProject({id:'b',docs:[]}).favorite],[true,false],'favori sauvegardé');
const app=fs.readFileSync('./js/app.js','utf8');
eq([/data-tile-fav=/.test(app),/FAV_GROUP='★ Favoris'/.test(app),/favorite:!!op\.favorite/.test(app)],[true,true,true],'étoile, groupe Favoris, import de session');
const {HVAC}=await import('./js/config.js'); const {findFirstMatch}=await import('./js/utils.js');
eq(['Reference : PAC APTAE 40 (2 unites) + Chaudiere gaz VARFREE EVO 120 (2 unites)','Pompe à chaleur hybride','Chaudière gaz à condensation','PAC air/eau'].map(t=>findFirstMatch(t,HVAC.heating)),['Hybride (PAC + gaz)','Hybride (PAC + gaz)','Chaudière condensation','PAC air/eau'],'chauffage hybride PAC + gaz');
eq(/partial=xs\.filter\(x=>x\.pct>10&&x\.pct<100\)/.test(app)&&/dossier\(s\) partiellement complété\(s\)/.test(app),true,'v2.18.2 — dossiers partiellement complétés (> 10 %) sur les tuiles de maître d’ouvrage');
// v2.17.0 — tri des tuiles par état du dossier (fonctions extraites de app.js).
const sortSrc=app.slice(app.indexOf('const TILE_SORTS='),app.indexOf('function renderTiles('));
const sortTileItems=new Function(sortSrc+';return sortTileItems;')();
const its=[5,100,40,0,100,12].map((pct,i)=>({pct,p:{id:'p'+i}}));
eq(sortTileItems(its,'complete').map(x=>x.pct),[100,100,40,12,5,0],'complets d’abord');
eq(sortTileItems(its,'partial').map(x=>x.pct),[12,40,100,100,0,5],'partiellement complétés d’abord');
eq(sortTileItems(its,'incomplete').map(x=>x.pct),[0,5,12,40,100,100],'incomplets d’abord');
eq(sortTileItems(its,''),its,'ordre par défaut inchangé');
console.log(`v2.16.0 — ${n} vérifications OK (données fictives)`);
