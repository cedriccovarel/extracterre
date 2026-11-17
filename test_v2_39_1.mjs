// v2.39.1 — nettoyage des noms de bâtiments, recoupement par résultats (Tic / DH / Ic), bâtiments sans résultat écartés.
import assert from 'node:assert/strict';
import {repairBuildingName,detectBuildings} from './js/buildings.js';
import {buildingResultMerges,dropResultlessBuildings} from './js/engine.js';
const eq=(a,b,m)=>assert.deepStrictEqual(a,b,m);

// 1. Intitulés de RSET / RT lus comme des noms → faux bâtiment ('')
for(const n of ['Bâtiment A USAGE','Bâtiment REGLEMENTAIRE','Bâtiment ENTIEREMENT CHAUFFEE EXTERIEURE','Bâtiment SRTZ CONSOMMATIONS ET PRODUCTIONS ANNUELLES DU BATIMENT (PAR ZONES) PAR',
  'Bâtiment LIVRE SANS SYSTEME DE CHAUFFAGE','Bâtiment ZONES GROUPES','Bâtiment EN CAS DE MESURE GLOBALE','Bâtiment BATIMENT','Bâtiment 257 KW.','Bâtiment CONDITIONS DE BASE',
  'Bâtiment T1 T2 T3 T4 T5 TOTAL','Bâtiment (RESIDENCE','Bâtiment BKWH ENERGIE FINALE/M2 SREF']) eq(repairBuildingName(n),'',n);
// 2. Suffixes qui éclatent un même bâtiment
eq(repairBuildingName('Bâtiment Q CALICOTS - 08-02-2020'),'Bâtiment Q CALICOTS');
eq(repairBuildingName('Bâtiment Q CALICOTS - UBAT - 08-02-2020 - PAGE 116 / 135 -'),'Bâtiment Q CALICOTS');
eq(repairBuildingName('Bâtiment COLLECTIF - BATIMENT NEUF CONSOMMATIONS'),'Bâtiment COLLECTIF');
eq(repairBuildingName('Bâtiment B - RT2012'),'Bâtiment B');
eq(repairBuildingName('Bâtiment (BATIMENT AB'),'Bâtiment AB');
eq(repairBuildingName('Bâtiment CBATIMENT C'),'Bâtiment C');
eq(repairBuildingName('Bâtiment B...................................73'),'Bâtiment B');
eq(repairBuildingName('Bâtiment SUD REGLEMENTAIRE'),'Bâtiment SUD');
// 3. Vrais noms (Salesforce) intacts
for(const n of ['Bâtiment A','Bâtiment 1','Bâtiment COLLECTIF','Bâtiment SOCIAL','Bâtiment MAISONS 1 ET 3','Bâtiment M1 IDEM M2','Bâtiment MAISONS 1/2-5/6-16/17 (LE PLUS DEFAVORABLE)',
  'Bâtiment D (87 LOGEMENTS)','Bâtiment SUR RUE','Bâtiment G CAGE B (16 LGTS)','Bâtiment CATALPA']) eq(repairBuildingName(n),n,n);
// 4. Détection : un document dont le seul « bâtiment » est un intitulé redevient « Bâtiment unique »
{ const page={page:1,text:'Batiment a usage\nBatiment a usage',lines:[{index:0,text:'Batiment a usage'},{index:1,text:'Batiment a usage'}]};
  const r=detectBuildings({name:'rset.pdf',type:'RSET RE2020',read:{pages:[page],text:page.text}}); eq(r.names,['Bâtiment unique']); }

// 5. Recoupement : 2 résultats identiques (≠ 0) et aucun différent → un seul bâtiment ; un seul en commun → distincts
const F=(b,field,value)=>({building:b,field,value,status:'retenu'});
{ const c={finals:[F('Bâtiment 1','tic',27.4),F('Bâtiment 1','ic_construction',652.3),F('Bâtiment 1','bbio',40),F('Bâtiment A','tic',27.4),F('Bâtiment A','ic_construction',652.3),
    F('Bâtiment B','tic',27.4),F('Bâtiment B','ic_construction',610.1)]};
  eq(buildingResultMerges(c,{authoritative:['Bâtiment 1']}),{'Bâtiment A':'Bâtiment 1'}); }
{ const c={finals:[F('Bâtiment A','tic',27.4),F('Bâtiment A','dh',0),F('Bâtiment B','tic',27.4),F('Bâtiment B','dh',0)]};
  eq(buildingResultMerges(c,{}),{},'DH = 0 ne compte pas, un Tic seul ne suffit pas (jumeaux)'); }
{ const c={finals:[F('Bâtiment A','tic',27.4),F('Bâtiment A','ic_energy',150),F('Bâtiment B','tic',27.4),F('Bâtiment B','ic_energy',150)]};
  eq(buildingResultMerges(c,{},{'Bâtiment B':'Bâtiment B'}),null,'regroupement manuel : jamais touché'); }

// 5b. Doublon numéroté (RSEE) : tous ses résultats dans un seul autre bâtiment, à l'arrondi près → regroupé ; ambigu → distinct
{ const c={finals:[F('Bâtiment C-D - HIBISCUS','ic_energy',66.096),F('Bâtiment C-D - HIBISCUS','ic_construction',554.02),F('Bâtiment C-D - HIBISCUS','dh',1014.5),
    F('Bâtiment A - HIBISCUS','ic_energy',67.18),F('Bâtiment A - HIBISCUS','ic_construction',549.828),F('Bâtiment B - HIBISCUS','ic_energy',67.18),F('Bâtiment B - HIBISCUS','ic_construction',551.315),
    F('Bâtiment 2','ic_energy',66.1),F('Bâtiment 1','ic_energy',67.18)]};
  eq(buildingResultMerges(c,{}),{'Bâtiment 2':'Bâtiment C-D - HIBISCUS'},'« Bâtiment 1 » (67,18) a deux candidats : non regroupé'); }
// 5c. Salesforce fait foi : un bâtiment Salesforce (passé tel quel dans les correspondances) n'est jamais absorbé ni écarté
{ const c={finals:[F('Bâtiment A','tic',27.4),F('Bâtiment A','ic_energy',150),F('Bâtiment B','tic',27.4),F('Bâtiment B','ic_energy',150)]};
  eq(buildingResultMerges(c,{},{'Bâtiment A':'Bâtiment A','Bâtiment B':'Bâtiment B'}),null); }
{ const c={rows:[{building:'Bâtiment A'},{building:'Bâtiment B'}],finals:[F('Bâtiment A','cep',60)]}; eq(dropResultlessBuildings(c,{'Bâtiment B':'Bâtiment B'}),[]); }
// 6. Bâtiment sans aucun résultat écarté ; si aucun bâtiment n'a de résultat, rien n'est écarté
{ const c={rows:[{building:'Bâtiment A'},{building:'Bâtiment ZZ'}],buildings:['Bâtiment A','Bâtiment ZZ'],finals:[F('Bâtiment A','cep',60),F('Bâtiment ZZ','wall_insulation','Laine de verre')],detailed:[F('Bâtiment ZZ','wall_insulation','Laine de verre')]};
  eq(dropResultlessBuildings(c),['Bâtiment ZZ']); eq(c.rows.map(r=>r.building),['Bâtiment A']); eq(c.finals.length,1); eq(c.detailed[0].status,'rejeté'); }
{ const c={rows:[{building:'Bâtiment A'},{building:'Bâtiment B'}],finals:[F('Bâtiment A','wall_insulation','PSE')]}; eq(dropResultlessBuildings(c),[]); }
console.log('test_v2_39_1 OK');
// 7. Export de session par paquets de 300 opérations (plantage vers la 550e) ; import de plusieurs fichiers
{ const fs=await import('node:fs'); const app=fs.readFileSync('./js/app.js','utf8'), html=fs.readFileSync('./index.html','utf8');
  eq(/const SESSION_EXPORT_CHUNK=300;/.test(app)&&/showDirectoryPicker/.test(app)&&/p\.result=null; p\.pendingRebuild=true;/.test(app),true,'paquets, dossier, mémoire libérée');
  eq(/id="importSessionInput" type="file" accept="application\/json,\.json" multiple/.test(html),true,'import de plusieurs parties'); }
console.log('test_v2_39_1 export OK');
// 8. Export Excel par opération (647 opérations : plantage) — collecteur, sans « Occurrences » au-delà de 100 opérations
{ const fs=await import('node:fs'); const app=fs.readFileSync('./js/app.js','utf8');
  const {createExcelCollector,EXCEL_OCCURRENCES_MAX_PROJECTS}=await import('./js/exporter.js');
  eq(EXCEL_OCCURRENCES_MAX_PROJECTS,100); eq(typeof createExcelCollector,'function');
  eq(/async function exportExcelStreamed\(list\)/.test(app)&&!/async function openExportDialog\(\)\{\n  await ensureAllRebuilt\(\);/.test(app),true,'pas de recalcul global avant la fenêtre'); }
console.log('test_v2_39_1 excel OK');
// 9. Export de session document par document : même JSON qu'avant (relu par « Importer une session » et TotalRecoll)
{ const {serializeProjectFull,serializeProjectFullParts}=await import('./js/persistence.js');
  const p={id:'p1',label:'Projet',customTitle:'Résidence',operationName:'Op',manualValues:{'Bâtiment A|cep':60},docs:[
    {id:'d1',name:'rset.pdf',type:'RSET RE2020',status:'ready',size:10,analysisCachedAt:1,read:{kind:'pdf',pageCount:1,pages:[{page:1,text:'Cep 60',lines:[{index:0,text:'Cep 60'}]}],text:'Cep 60'},cachedOccurrences:[{field:'cep',value:60,building:'Bâtiment A'}]},
    {id:'d2',name:'cctp.pdf',type:'CCTP',status:'missing',size:5,read:null,cachedOccurrences:null}]};
  const seen=[]; const parts=[...serializeProjectFullParts(p,{before:d=>{seen.push('b'+d.id);},after:d=>seen.push('a'+d.id)})].join('');
  const noTime=t=>JSON.parse(t,(k,v)=>k==='savedAt'?0:v); // horodatage de sauvegarde : seule différence admise (milliseconde)
  eq(noTime(parts),noTime(JSON.stringify(serializeProjectFull(p))),'même contenu');
  eq(parts.includes('\n'),false,'une seule ligne'); eq(seen,['bd1','ad1','bd2','ad2'],'texte chargé puis libéré document par document'); }
console.log('test_v2_39_1 session par document OK');
// 10. Très gros fichiers (tableur ACV de 70 Mo, XML de 11 Mo) : texte brut ni chargé ni exporté, valeurs et lectures gardées
{ const {serializeProjectFullParts}=await import('./js/persistence.js');
  const big={id:'b',name:'EXPORT VIZCAB.xlsx',size:70e6,type:'Étude carbone / ACV',status:'ready',read:{kind:'spreadsheet',pages:[{page:1,text:'x',lines:[{index:0,text:'x'}]}]},cachedOccurrences:[{field:'ic_construction',value:600,building:'Bâtiment A'}]};
  const loaded=[]; let flagged=0;
  const out=JSON.parse([...serializeProjectFullParts({id:'p',docs:[big]},{before:d=>{loaded.push(d.id);},skipRead:d=>d.size>2e6,tooBig:(d,w)=>{ if(w==='skipped') flagged++; }})].join(''));
  eq(loaded,[],'texte jamais chargé'); eq(flagged,1); eq(out.docs[0].analysis.read,null); eq(out.docs[0].analysis.readOmitted,true);
  eq(out.docs[0].analysis.cachedOccurrences?.[0]?.value,600,'lectures gardées'); }
console.log('test_v2_39_1 gros fichiers OK');
