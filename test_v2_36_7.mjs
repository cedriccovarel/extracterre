// v2.36.7 — export Excel (données FICTIVES) : une feuille « Confort d'été » (une colonne par résultat) et une feuille par grille
// de recherche (« Sécurité des logements »), présente même sans résultat trouvé.
import assert from 'node:assert/strict';
import {APP_VERSION} from './js/config.js';
import {exportProjectsExcel} from './js/exporter.js';
import {SECURITY_GRID} from './js/recherches.js';
assert.equal(APP_VERSION,'2.39.0');
const sheets=[]; globalThis.XLSX={utils:{book_new:()=>({SheetNames:[]}),aoa_to_sheet:rows=>({rows,'!ref':'A1:A1'}),decode_range:()=>({s:{c:0,r:0},e:{c:0,r:0}}),encode_cell:()=>'A1',
  book_append_sheet:(wb,ws,name)=>{ wb.SheetNames.push(name); sheets.push([name,ws.rows]); }},writeFile:()=>{}};
const row={building:'Bâtiment A',internal_code:'OPE-000001',operation_name:'Résidence Fictive',dh_zt:412.5,dh_znt:820,cross_ventilated:'Oui',fan_presence:'Oui',fan_count:12,cooling:'Aucun',cooling_active:'Non'};
exportProjectsExcel([{docs:[],manualEconomics:{},operationName:'Résidence Fictive',result:{operation:'Résidence Fictive',rows:[row],finals:[],detailed:[],buildingAliases:[]}}],{},
  {grids:[SECURITY_GRID],identity:()=>({contract:'00009999'})});
const names=sheets.map(s=>s[0]);
assert.ok(names.includes('Confort d’été'),names.join(' | '));
assert.ok(names.includes('Sécurité des logements'),names.join(' | '));
const [head,line]=sheets.find(s=>s[0]==='Confort d’été')[1];
const at=l=>line[head.indexOf(l)];
assert.deepEqual(head.slice(0,4),['Code interne','Nom opération','Contrat','Bâtiment']);
assert.equal(at('Contrat'),'00009999'); assert.equal(at('Bâtiment'),'Bâtiment A');
assert.equal(head.length,22,head.join(' | '));
assert.deepEqual(head.slice(4,10),['Système constructif','Système constructif — précision','Parois verticales structure','ITE','ITI','Parois verticales type d’isolant']);
assert.equal(at('Système constructif'),''); assert.equal(at('Système constructif — précision'),''); // rien de lu : vide
{ const {constructiveSystem,SYSTEMS}=await import('./js/exporter.js');
  assert.equal(constructiveSystem({wall_structure:'Béton armé',wall_ite:'Oui'}).system,SYSTEMS.ite);
  assert.equal(constructiveSystem({wall_structure:'Ossature bois'}).system,SYSTEMS.bois);
  assert.equal(constructiveSystem({wall_structure:'Brique',wall_iti_insulation:'Laine de verre'}).system,SYSTEMS.iti);
  assert.equal(constructiveSystem({wall_structure:'Monomur'}).system,SYSTEMS.iti);
  assert.deepEqual(constructiveSystem({wall_structure:'Parpaing'}),{system:'',note:'isolation des murs non précisée'});
  assert.deepEqual(constructiveSystem({wall_structure:'Béton',wall_ite:'Oui',wall_iti:'Oui'}),{system:'',note:'ITE et ITI : à trancher'}); }
assert.deepEqual([at('DH Zone traversante (DH ZT)'),at('DH Zone non traversante (DH ZNT)'),at('Logement traversant'),at('Brasseur d’air'),at('Nombre de brasseurs d’air'),at('Refroidissement'),at('Climatisation active')],
  [412.5,820,'Oui','Oui',12,'Aucun','Non']);
// Valeur non lue : cellule vide, jamais de valeur par défaut.
assert.equal(at('Tic'),''); assert.equal(at('Logement non traversant'),'');
console.log('test_v2_36_7 OK');
