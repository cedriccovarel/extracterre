import {APP_VERSION,DOC_TYPES,FIELD_DEFS,FIELD_MAP,FAMILIES,ANALYSIS_MODES,DEFAULT_ANALYSIS_MODE,MIN_REVIEW_CONFIDENCE,matchFieldByHeader} from './config.js';
import {classifyDocument} from './classifier.js';
import {readFile,makeDocumentRecord,compactReadForRetention,setOcrConcurrencyLimit,ocrPoolStatus} from './readers.js';
import {detectBuildings} from './buildings.js';
import {loadSourceRules,saveSourceRules,resetSourceRules} from './routing.js';
import {analyzeDocuments,freeSearch,runSelfTests,buildBuildingGrouping} from './engine.js';
import {exportExcel,exportProjectsExcel} from './exporter.js';
import {escapeHtml,formatValue,parseFrNumber,normLower,normalizeGlazingType} from './utils.js';
import {INSULATION_LIBRARY_VARIANT_COUNT,CORE_INSULATION_VARIANT_COUNT} from './insulation-library.js';
import {buildProjectTags,PROJECT_TAG_LIBRARY} from './tags.js';
import {analyzeEconomicData} from './economics.js';
import {parseDocument} from './parsers.js';
import {saveWorkspaceSnapshot,loadWorkspaceSnapshot,saveDocumentCheckpoint,deleteDocumentCheckpoint,clearWorkspaceSnapshot,getWorkspaceStorageInfo,requestPersistentStorage} from './persistence.js';

function createProject(index=1){ return {id:`project-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label:`Projet ${index}`,customTitle:'',operationName:'',docs:[],result:null,buildingOverrides:{},manualTags:[],projectTags:[],manualValues:{},manualSources:{},manualPasteRaw:'',manualPasteRows:[],manualPasteColumns:[],uncertainRejectedKeys:[],manualEconomics:{},economic:null,resultView:'generic',expanded:true}; }
const state={projects:[],activeProjectId:null,rules:loadSourceRules(),selfTests:runSelfTests(),activeTab:'summary'};
state.projects.push(createProject(1)); state.activeProjectId=state.projects[0].id;
function activeProject(){ return state.projects.find(p=>p.id===state.activeProjectId)||state.projects[0]; }
for(const key of ['docs','result','buildingOverrides','manualTags','projectTags','manualValues','manualSources','manualPasteRaw','manualPasteRows','manualPasteColumns','uncertainRejectedKeys','manualEconomics','economic']) Object.defineProperty(state,key,{get(){return activeProject()[key]},set(v){activeProject()[key]=v}});
function projectTitle(p){ return (p.customTitle||p.operationName||p.result?.operation||p.label||'Projet').trim(); }
function syncProjectInput(){ const p=activeProject(); const el=$('#operationName'); if(el) el.value=p.operationName||p.result?.operation||''; }

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const RESULT_VIEWS = Object.freeze({
  generic:{label:'Données générales',groups:[
    {title:'Administration',families:['Administration']},
    {title:'Projet & programme',families:['Programme']},
    {title:'Référentiel & contexte',keys:['reference_name','reference_version','mentions','performance','selected_profile','built_before_1948','built_after_1948','renovation','anru_zone','no_mention','environmental_performance','specific_profile']},
    {title:'Mentions, labels & dérogations',keys:['mention_building_performance','mention_bee_plus','mention_tfpb','mention_ec','derogation_ec','mention_bbca','derogation_bbca','mention_neutrality_contribution','mention_effinergie','effinergie_energy_carbon_level','mention_biosourced_building','derogation_biosourced','mention_habitat_quality','mention_charge_assessment','mention_buildability_bonus','mention_air_quality','mention_acoustic','mention_circular_economy','mention_eu_taxonomy','mention_zero_carbon','mention_biodiversity']},
    {title:'Niveaux & performances de certification',keys:['dpe_ges_label','energy_level','passive_level','cep_level','cepnr_level','bbio_level','ic_construction_level','ic_energy_level','enhanced_performance','biosourced_2013']}
  ]},
  thermalNew:{label:'Thermique neuf',groups:[
    {title:"Confort d’été",families:["Confort d’été"]},
    {title:'Systèmes',keys:['heating_vector_after','heating_mode_after','ecs_vector_after','ecs','cooling','ventilation']},
    {title:'Performance énergétique',keys:['bbio','bbio_max','bbio_gain','cep','cep_max','cep_gain','cepnr','cepnr_max','cepnr_gain','cep_cooling','cep_lighting','cep_aux_vent','cep_aux_dist','cep_mobility','cep_electricity','cep_gas','cep_district','cep_biomass']},
    {title:'DPE & ENR',keys:['dpe_energy_after','dpe_ges_after','enr','enr_type']}
  ]},
  thermalReno:{label:'Thermique réno',groups:[
    {title:'Avant / après travaux',keys:['heating_vector_before','heating_vector_after','heating_mode_after','ecs_vector_before','ecs_vector_after','ecs','cooling','ventilation','ubat_before','ubat_after','cep_before','cep_after_final']},
    {title:'Performance réglementaire après travaux',keys:['bbio','bbio_max','bbio_gain','cep','cep_max','cep_gain','cepnr','cepnr_max','cepnr_gain','cep_cooling','cep_lighting','cep_aux_vent','cep_aux_dist','cep_mobility','cep_electricity','cep_gas','cep_district','cep_biomass']},
    {title:"Confort d’été",families:["Confort d’été"]},
    {title:'DPE & ENR',keys:['dpe_energy_before','dpe_ges_before','dpe_energy_after','dpe_ges_after','enr','enr_type']}
  ]},
  carbonNew:{label:'Carbone neuf',groups:[
    {title:'IC composants & chantier',keys:['ic_components','ic_site','ic_lot_1','ic_lot_2','ic_lot_3','ic_lot_4','ic_lot_5','ic_lot_6','ic_lot_7','ic_lot_8','ic_lot_9','ic_lot_10','ic_lot_11','ic_lot_12','ic_lot_13']},
    {title:'IC énergie',keys:['ic_energy','ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility']}
  ]},
  carbonReno:{label:'Carbone réno',groups:[
    {title:'IC composants & chantier — rénovation',keys:['ic_components','ic_site','ic_lot_1','ic_lot_2','ic_lot_3','ic_lot_4','ic_lot_5','ic_lot_6','ic_lot_7','ic_lot_8','ic_lot_9','ic_lot_10','ic_lot_11','ic_lot_12','ic_lot_13']},
    {title:'IC énergie — rénovation',keys:['ic_energy','ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility']}
  ]},
  envelope:{label:'Structure & enveloppe',groups:[
    {title:'Structure & isolation',keys:['structure','roof_structure','roof_insulation','roof_insulation_thickness','roof_insulation_r','wall_structure','wall_insulation','wall_insulation_thickness','wall_insulation_r','floor_structure','floor_insulation','floor_insulation_thickness','floor_insulation_r']},
    {title:'Menuiseries',keys:['window_material','window_glazing','window_shading']}
  ]}
});
function currentResultView(){ const p=activeProject(); return RESULT_VIEWS[p.resultView]||RESULT_VIEWS.generic; }
function fieldsForResultGroup(group){
  if(group.keys) return group.keys.map(k=>FIELD_MAP[k]).filter(Boolean);
  const families=new Set(group.families||[]); return FIELD_DEFS.filter(f=>f.key!=='building'&&families.has(f.family));
}
function fieldsForCurrentResultView(){ return [...new Map(currentResultView().groups.flatMap(fieldsForResultGroup).map(f=>[f.key,f])).values()]; }
function syncResultTabs(){ const key=activeProject().resultView||'generic'; $$('.result-tab').forEach(b=>b.classList.toggle('active',b.dataset.resultView===key)); }

let persistenceReady=false,restoringWorkspace=false,workspaceSaveChain=Promise.resolve(),workspaceSaveTimer=null,lastLocalSaveAt=null;
function meaningfulWorkspace(projects=[]){ return projects.some(p=>(p.docs||[]).length||p.result||(p.manualPasteRows||[]).length||Object.keys(p.manualValues||{}).length||String(p.operationName||p.customTitle||'').trim())||projects.length>1; }
function formatBytes(bytes=0){ const n=Number(bytes)||0; if(n<1024*1024) return `${Math.round(n/1024)} Ko`; if(n<1024*1024*1024) return `${(n/1024/1024).toFixed(1).replace('.',',')} Mo`; return `${(n/1024/1024/1024).toFixed(2).replace('.',',')} Go`; }
function setLocalSaveUi(status,time=lastLocalSaveAt,detail=''){
  const st=$('#localSaveStatus'),tm=$('#localSaveTime'),dt=$('#localSaveDetail');
  if(st) st.textContent=status;
  if(tm) tm.textContent=time?new Date(time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
  if(dt&&detail) dt.textContent=detail;
}
async function refreshLocalStorageInfo(){
  try{ const info=await getWorkspaceStorageInfo(); const detail=$('#localSaveDetail'); if(detail){ detail.textContent=info.supported?(info.quota?`${formatBytes(info.usage)} utilisés · ${formatBytes(info.quota)} disponibles${info.persisted?' · stockage persistant':''}`:'Stockage local du navigateur actif'):'IndexedDB indisponible'; } }catch{}
}
function workspacePayload(){ return {projects:state.projects,activeProjectId:state.activeProjectId,activeTab:state.activeTab}; }
function checkpointWorkspace(reason='mise à jour',silent=true){
  if(!persistenceReady||restoringWorkspace) return Promise.resolve(null);
  const payload=workspacePayload(); setLocalSaveUi('Sauvegarde…');
  workspaceSaveChain=workspaceSaveChain.catch(()=>null).then(()=>saveWorkspaceSnapshot(payload)).then(info=>{ lastLocalSaveAt=info?.savedAt||Date.now(); setLocalSaveUi('Sauvegardé',lastLocalSaveAt); refreshLocalStorageInfo(); return info; }).catch(err=>{ console.warn('IndexedDB workspace save failed',err); setLocalSaveUi('Sauvegarde indisponible'); if(!silent) toast(`Sauvegarde locale impossible : ${err?.message||err}`,'warn'); return null; });
  return workspaceSaveChain;
}
function scheduleWorkspaceCheckpoint(reason='mise à jour',delay=650){
  if(!persistenceReady||restoringWorkspace) return;
  if(workspaceSaveTimer) clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer=setTimeout(()=>{ workspaceSaveTimer=null; checkpointWorkspace(reason,true); },delay);
}
async function checkpointDocument(project,doc){
  if(!persistenceReady||!project||!doc) return null;
  try{
    setLocalSaveUi('Sauvegarde document…');
    const info=await saveDocumentCheckpoint(project.id,doc); doc.persistenceMode=info?.mode||null;
    await checkpointWorkspace(`document ${doc.name}`,true);
    if(info?.mode==='compact') toast(`${doc.name} sauvegardé en mode compact (quota local).`,'warn');
    if(info?.mode==='results-only') toast(`${doc.name} : résultats sauvegardés, mais l’index texte est trop volumineux pour le quota local.`,'warn');
    return info;
  }catch(err){ console.warn('IndexedDB document checkpoint failed',err); setLocalSaveUi('Sauvegarde partielle'); toast(`Checkpoint local impossible pour ${doc.name} : ${err?.message||err}`,'warn'); return null; }
}

function setStatus(text,pct=null){ const status=$('#statusText'); if(status){status.textContent=text;status.title=text;} const mirrorStatus=$('#projectMirrorStatus'); if(mirrorStatus){mirrorStatus.textContent=text;mirrorStatus.title=text;} if(pct!==null){ const safe=Math.max(0,Math.min(100,pct)); $('#progress').hidden=false; $('#progressBar').style.width=`${safe}%`; const pctEl=$('#projectMirrorPct'); if(pctEl) pctEl.textContent=`${Math.round(safe)}%`; const ring=$('#projectMirrorRing'); if(ring) ring.style.setProperty('--pct',`${safe*3.6}deg`); } }
function toast(msg,type='info'){ const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg; $('#toasts').appendChild(el); setTimeout(()=>el.remove(),4200); }
function libraryCheck(){ const issues=[]; if(!globalThis.pdfjsLib) issues.push('PDF.js'); if(!globalThis.XLSX) issues.push('SheetJS'); const ocrMissing=!globalThis.Tesseract; if(issues.length){ $('#libWarning').hidden=false; $('#libWarning').innerHTML=`<strong>Bibliothèque non chargée :</strong> ${issues.join(', ')}. Rechargez la page avec une connexion internet.`; } else if(ocrMissing){ $('#libWarning').hidden=false; $('#libWarning').innerHTML="<strong>OCR indisponible :</strong> Tesseract.js n'a pas pu être chargé. La lecture PDF classique reste disponible, mais les pages scannées ne bénéficieront pas du secours OCR."; } else $('#libWarning').hidden=true; }

function renderFiles(){
  const box=$('#fileList'); if(!state.docs.length){ box.innerHTML='<div class="empty-small">Aucun fichier ajouté.</div>'; return; }
  box.innerHTML=state.docs.map(d=>{
    const isPdf=/\.pdf$/i.test(d.name); const targetedRunning=d.targetedStatus==='running'; const showTarget=d.status==='ready'&&isPdf; const canTarget=showTarget&&!!d.file&&!!state.result;
    const targetedMeta=d.targetedLastAt?` · crible fin${Number.isFinite(d.targetedLastProposals)?` ${d.targetedLastProposals} proposition(s)`:''}`:'';
    const unloaded=d.status==='ready'&&!d.file?' · restauré localement — redéposez le fichier seulement pour une nouvelle lecture/OCR':d.status==='missing'?' · fichier à redéposer':'';
    return `<div class="file-row"><div class="file-icon">${d.name.split('.').pop().toUpperCase().slice(0,4)}</div><div class="file-main"><div class="file-name" title="${escapeHtml(d.relativePath||d.name)}">${escapeHtml(d.name)}</div><div class="file-meta">${(d.size/1024/1024).toFixed(2)} Mo · ${escapeHtml(d.status==='ready'?d.type:d.status==='missing'?'À redéposer':d.status==='error'?'Erreur':d.status==='timeout'?'À relancer · > 5 min':d.status==='reading'?'Lecture parallèle…':'En attente')}${d.status==='ready'&&d.buildings?` · ${d.buildings.expectedCount?`${d.buildings.names.length}/${d.buildings.expectedCount}`:d.buildings.names.length} bâtiment(s)`:''}${d.read?.ocr?.used?` · OCR ${d.read.ocr.pages.length} p.`:''}${Array.isArray(d.cachedOccurrences)?' · analysé':''}${escapeHtml(targetedMeta)}${escapeHtml(unloaded)}</div></div>${d.classification?`<span class="badge doc">${escapeHtml(d.type)}</span>`:''}${showTarget||targetedRunning?`<button class="btn light targeted-file" data-id="${d.id}" ${targetedRunning||!canTarget?'disabled':''} title="${!d.file?'Redéposez ce PDF pour réactiver le crible fin ; les résultats déjà sauvegardés seront conservés.':!state.result?'Terminez d’abord la première consolidation du projet.':'Repasser ce PDF au crible fin avec OCR maximal, sans retraiter les autres documents'}">${targetedRunning?'Crible fin…':'🔎 Crible fin'}</button>`:''}${d.status==='timeout'?`<button class="btn light retry-file" data-id="${d.id}">↻ Relancer sans limite</button>`:''}<button class="icon-btn remove-file" data-id="${d.id}" aria-label="Supprimer">×</button></div>`;
  }).join('');
  $$('.remove-file').forEach(b=>b.onclick=async()=>{ const id=b.dataset.id; state.docs=state.docs.filter(d=>d.id!==id); state.result=null; try{await deleteDocumentCheckpoint(id);}catch{} renderAll(); scheduleWorkspaceCheckpoint('suppression document',50); });
  $$('.retry-file').forEach(b=>b.onclick=()=>retryTimedOutDocument(b.dataset.id));
  $$('.targeted-file').forEach(b=>b.onclick=()=>targetedReanalysis(b.dataset.id));
}

function addFiles(fileList){
  const allowed=/\.(pdf|xml|xlsx?|xls)$/i; let added=0,rehydrated=0;
  for(const file of fileList){
    if(!allowed.test(file.name)){ toast(`Format ignoré : ${file.name}`,'warn'); continue; }
    const rel=file._relativePath||file.webkitRelativePath||file.name;
    const existing=state.docs.find(d=>(d.relativePath||d.name)===rel&&d.size===file.size);
    if(existing){
      if(!existing.file){ existing.file=file; existing.relativePath=rel; if(['missing','error'].includes(existing.status)) existing.status='pending'; rehydrated++; continue; }
      toast(`Déjà ajouté : ${rel}`,'warn'); continue;
    }
    const rec=makeDocumentRecord(file); rec.relativePath=rel; state.docs.push(rec); added++;
  }
  if(rehydrated) toast(`${rehydrated} fichier(s) rechargé(s) pour permettre une nouvelle analyse OCR.`,'success');
  if(added) toast(state.result?`${added} nouveau${added>1?'x':''} document${added>1?'s':''} ajouté${added>1?'s':''} — prêt${added>1?'s':''} à compléter l’analyse.`:`${added} fichier${added>1?'s':''} ajouté${added>1?'s':''}`,'success');
  renderAll(); scheduleWorkspaceCheckpoint('ajout fichiers');
}

function attachRelativePath(file,path){
  if(!file) return file;
  try{ Object.defineProperty(file,'_relativePath',{value:path||file.name,configurable:true}); }
  catch{ try{ file._relativePath=path||file.name; }catch{} }
  return file;
}
async function filesFromEntry(entry,prefix=''){
  if(!entry) return [];
  if(entry.isFile) return await new Promise(resolve=>entry.file(f=>resolve([attachRelativePath(f,`${prefix}${f.name}`)]),()=>resolve([])));
  if(!entry.isDirectory) return [];
  const reader=entry.createReader(); const children=[];
  while(true){ const batch=await new Promise(resolve=>reader.readEntries(resolve,()=>resolve([]))); if(!batch.length) break; children.push(...batch); }
  const nested=await Promise.all(children.map(ch=>filesFromEntry(ch,`${prefix}${entry.name}/`))); return nested.flat();
}
async function filesFromHandle(handle,prefix=''){
  if(!handle) return [];
  if(handle.kind==='file'){
    try{ const f=await handle.getFile(); return [attachRelativePath(f,`${prefix}${f.name}`)]; }catch{return [];}
  }
  if(handle.kind!=='directory') return [];
  const out=[]; const nextPrefix=`${prefix}${handle.name}/`;
  try{
    for await(const child of handle.values()) out.push(...await filesFromHandle(child,nextPrefix));
  }catch{}
  return out;
}
async function filesFromDrop(dt){
  const items=[...(dt?.items||[])].filter(i=>!i.kind||i.kind==='file');
  // API moderne (Chrome/Edge en contexte sécurisé), puis fallback Finder historique.
  if(items.some(i=>typeof i.getAsFileSystemHandle==='function')){
    try{
      const handles=(await Promise.all(items.map(i=>i.getAsFileSystemHandle?.().catch?.(()=>null) ?? null))).filter(Boolean);
      if(handles.length){ const nested=await Promise.all(handles.map(h=>filesFromHandle(h,''))); const out=nested.flat(); if(out.length) return out; }
    }catch{}
  }
  const entries=items.map(i=>i.webkitGetAsEntry?.()).filter(Boolean);
  if(entries.length){
    try{ const nested=await Promise.all(entries.map(e=>filesFromEntry(e,''))); const out=nested.flat(); if(out.length) return out; }catch{}
  }
  return [...(dt?.files||[])].map(f=>attachRelativePath(f,f.webkitRelativePath||f.name));
}
function unloadProjectFiles(p){
  for(const d of p.docs||[]){ if(['ready','error'].includes(d.status)){ d.file=null; } }
}
function addNewProject(){
  const current=activeProject(); current.operationName=$('#operationName').value.trim()||current.result?.operation||current.operationName||current.label; current.expanded=false; unloadProjectFiles(current);
  const p=createProject(state.projects.length+1); state.projects.push(p); state.activeProjectId=p.id; syncProjectInput(); renderAll(); switchTab('summary'); toast(`${projectTitle(current)} conservé. Nouveau projet prêt à recevoir ses documents.`,'success'); scheduleWorkspaceCheckpoint('nouveau projet',80);
}
function activateProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; activeProject().operationName=$('#operationName').value.trim(); state.activeProjectId=id; if(!p.result) rebuildProjectFromCheckpoints(p); p.expanded=true; syncProjectInput(); renderAll(); scheduleWorkspaceCheckpoint('projet actif'); }
function toggleProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; p.expanded=!p.expanded; renderSummary(); scheduleWorkspaceCheckpoint('affichage projet'); }
function renameProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; const current=projectTitle(p); const raw=prompt('Renommer le projet',current); if(raw===null)return; const name=raw.trim(); if(!name){ toast('Le nom du projet ne peut pas être vide.','warn'); return; } p.customTitle=name; renderSummary(); toast(`Projet renommé : ${name}`,'success'); scheduleWorkspaceCheckpoint('renommage projet'); }


function parseManualClipboard(raw=''){
  const lines=String(raw||'').replace(/\r/g,'').split('\n').filter(line=>line.trim().length);
  if(!lines.length) return {rows:[],columns:[],unrecognized:[],recognized:0};
  const split=line=>line.includes('\t')?line.split('\t'):(line.includes(';')?line.split(';'):[line]);
  let best={index:-1,count:0,cells:[],defs:[]};
  for(let i=0;i<Math.min(lines.length,8);i++){
    const cells=split(lines[i]); const defs=cells.map(c=>matchFieldByHeader(c)); const count=defs.filter(Boolean).length;
    if(count>best.count) best={index:i,count,cells,defs};
  }
  if(best.index<0||best.count===0) return {rows:[],columns:[],unrecognized:best.cells||[],recognized:0};
  const columns=best.cells.map((header,i)=>({header:String(header||'').trim(),def:best.defs[i]||null,index:i}));
  const rows=[];
  for(let i=best.index+1;i<lines.length;i++){
    const cells=split(lines[i]); const values={}; let nonEmpty=0;
    for(const col of columns){ if(!col.def) continue; const rawValue=String(cells[col.index]??'').trim(); if(!rawValue) continue; nonEmpty++; let value=rawValue; if(col.def.type==='number'){ const n=parseFrNumber(rawValue); if(n===null) continue; value=n; } if(col.def.key==='window_glazing') value=normalizeGlazingType(value)||value; values[col.def.key]=value; }
    if(nonEmpty&&Object.keys(values).length) rows.push({sourceRow:i+1,values});
  }
  return {rows,columns,unrecognized:columns.filter(c=>!c.def&&c.header).map(c=>c.header),recognized:columns.filter(c=>c.def).length};
}
function manualPasteOccurrences(project=activeProject()){
  const out=[]; let n=0;
  for(const row of project.manualPasteRows||[]){
    const building=String(row.values?.building||'Bâtiment unique').trim()||'Bâtiment unique';
    for(const [field,value] of Object.entries(row.values||{})){
      if(field==='building'||value===null||value===undefined||value==='') continue;
      const def=FIELD_MAP[field]; if(!def) continue;
      out.push({field,value,building,docId:`manual-paste-${project.id}`,fileName:'Données manuelles — copier-coller Excel',docType:DOC_TYPES.MANUAL,page:row.sourceRow||++n,excerpt:`${def.label} = ${String(value)}`.slice(0,420),confidence:.995,method:'manual:excel-paste',unit:'',origin:'Entrée manuelle — copier-coller Excel',provenanceNote:'Valeur fournie dans l’encart Données manuelles. Elle complète les sources documentaires selon l’ordre de priorité défini.'});
    }
  }
  return out;
}
function recomputeProject(message='Consolidation recalculée.'){
  const valid=state.docs.filter(d=>d.status==='ready');
  const operation=$('#operationName').value.trim(); activeProject().operationName=operation;
  state.result=analyzeDocuments(valid,state.rules,operation,state.buildingOverrides,manualPasteOccurrences());
  state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags); state.selfTests=runSelfTests(); renderAll(); scheduleWorkspaceCheckpoint('consolidation',80); if(message) toast(message,'success');
}
function openManualDataDialog(){
  const dlg=$('#manualDataDialog'); if(!dlg) return;
  $('#manualDataPaste').value=state.manualPasteRaw||''; renderManualPastePreview(parseManualClipboard(state.manualPasteRaw||'')); dlg.showModal();
}
function renderManualPastePreview(parsed){
  const box=$('#manualDataPreview'); if(!box) return;
  if(!parsed.recognized){ box.innerHTML='<div class="empty-small">Collez au minimum une ligne d’en-têtes puis une ligne de données.</div>'; return; }
  const recognized=parsed.columns.filter(c=>c.def).map(c=>c.def.label);
  box.innerHTML=`<div class="manual-preview-stats"><span><b>${parsed.recognized}</b> colonne(s) reconnue(s)</span><span><b>${parsed.rows.length}</b> ligne(s) de données</span>${parsed.unrecognized.length?`<span class="warn"><b>${parsed.unrecognized.length}</b> en-tête(s) non reconnu(s)</span>`:''}</div><div class="manual-chip-wrap">${recognized.slice(0,28).map(x=>`<span>${escapeHtml(x)}</span>`).join('')}${recognized.length>28?`<span>+${recognized.length-28}</span>`:''}</div>${parsed.unrecognized.length?`<small>Non reconnus : ${escapeHtml(parsed.unrecognized.join(' · '))}</small>`:''}`;
}
function applyManualPaste(){
  const raw=$('#manualDataPaste')?.value||''; const parsed=parseManualClipboard(raw);
  if(!parsed.recognized||!parsed.rows.length){ toast('Aucune ligne de données exploitable. Vérifiez les en-têtes et collez au moins une ligne de valeurs.','warn'); renderManualPastePreview(parsed); return; }
  state.manualPasteRaw=raw; state.manualPasteRows=parsed.rows; state.manualPasteColumns=parsed.columns.map(c=>({header:c.header,key:c.def?.key||null}));
  // Si le nom de l'opération est fourni manuellement et que le champ Projet actuel est vide, on le reprend comme titre de travail.
  const first=parsed.rows[0]?.values||{}; if(!$('#operationName').value.trim()&&(first.operation_name||first.operation)){ const op=String(first.operation_name||first.operation); $('#operationName').value=op; activeProject().operationName=op; }
  $('#manualDataDialog')?.close(); recomputeProject(`${parsed.rows.length} ligne(s) manuelle(s) intégrée(s) · ${parsed.recognized} colonne(s) reconnue(s).`);
}
function clearManualPaste(){
  state.manualPasteRaw=''; state.manualPasteRows=[]; state.manualPasteColumns=[]; const ta=$('#manualDataPaste'); if(ta) ta.value=''; renderManualPastePreview({rows:[],columns:[],unrecognized:[],recognized:0}); if(state.result) recomputeProject('Données manuelles copiées-collées supprimées.');
}
function uncertainKey(o){ return [o.building,o.field,String(o.value),o.docId,o.page].join('|'); }
function visibleUncertain(){ const rejected=new Set(state.uncertainRejectedKeys||[]); return (state.result?.uncertain||[]).filter(o=>!rejected.has(uncertainKey(o))&&!Object.prototype.hasOwnProperty.call(state.manualValues||{},`${o.building}|${o.field}`)); }
function showUncertainReview(){
  const dlg=$('#uncertainReviewDialog'),list=$('#uncertainReviewList'),apply=$('#uncertainReviewApply'); if(!dlg||!list||!apply) return;
  const candidates=visibleUncertain(), decisions=new Map();
  const render=()=>{
    list.innerHTML=candidates.length?candidates.map((c,i)=>{const d=decisions.get(i)||''; return `<article class="targeted-proposal ${d?`decision-${d}`:''}"><div class="targeted-proposal-main"><div class="targeted-field"><span>${escapeHtml(c.building)}</span><strong>${escapeHtml(FIELD_MAP[c.field]?.label||c.field)}</strong></div><div class="targeted-new-value">${escapeHtml(formatValue(c.value))}</div><div class="targeted-source">${escapeHtml(c.fileName)} · p.${c.page} · ${Math.round(c.confidence*100)} %</div><div class="targeted-excerpt">${escapeHtml(c.excerpt||'')}</div></div><div class="targeted-actions"><button data-u-accept="${i}" class="targeted-accept">✓</button><button data-u-reject="${i}" class="targeted-reject">✕</button></div></article>`;}).join(''):'<div class="empty-small">Aucun candidat entre 65 et 89 % à vérifier.</div>';
    const a=[...decisions.values()].filter(x=>x==='accept').length,r=[...decisions.values()].filter(x=>x==='reject').length; $('#uncertainReviewCount').textContent=`${a} acceptée(s) · ${r} refusée(s) · ${candidates.length-a-r} à décider`; apply.disabled=a+r===0;
    $$('#uncertainReviewList [data-u-accept]').forEach(b=>b.onclick=()=>{decisions.set(Number(b.dataset.uAccept),'accept');render();}); $$('#uncertainReviewList [data-u-reject]').forEach(b=>b.onclick=()=>{decisions.set(Number(b.dataset.uReject),'reject');render();});
  };
  apply.onclick=()=>{ let accepted=0; for(const [i,d] of decisions){ const c=candidates[i]; if(!c) continue; if(d==='reject'){ state.uncertainRejectedKeys=[...new Set([...(state.uncertainRejectedKeys||[]),uncertainKey(c)])]; continue; } if(d==='accept'){ const key=`${c.building}|${c.field}`; state.manualValues[key]=c.value; state.manualSources[key]={docId:c.docId,fileName:c.fileName,page:c.page,excerpt:c.excerpt,method:'manual:uncertain-candidate-validated',provenanceNote:`Candidat ${Math.round(c.confidence*100)} % explicitement validé par l’utilisateur.`}; accepted++; } } applyManualValues(); dlg.close(); renderSummary(); renderOccurrences(); updateUxMirrors(); scheduleWorkspaceCheckpoint('validation candidats',80); toast(`${accepted} candidat(s) validé(s).`,'success'); };
  $('#uncertainReviewClose').onclick=()=>dlg.close(); render(); dlg.showModal();
}

function getAnalysisProfile(){
  const key=$('#analysisMode')?.value||DEFAULT_ANALYSIS_MODE;
  return ANALYSIS_MODES[key]||ANALYSIS_MODES[DEFAULT_ANALYSIS_MODE];
}
function formatAnalysisDuration(seconds){
  const s=Math.max(0,Math.round(Number(seconds)||0));
  if(s<45) return `${Math.max(1,s)} s`;
  const minutes=Math.round(s/60);
  if(minutes<60) return `${minutes} min`;
  const hours=Math.floor(minutes/60), mins=minutes%60;
  return mins?`${hours} h ${String(mins).padStart(2,'0')}`:`${hours} h`;
}
function formatEtaClock(timestamp){
  try{return new Date(timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}catch{return '—';}
}
function createEtaTracker(totalDocs,progressByDoc,profileKey,ocrMode){
  const startedAt=performance.now();
  const storageKey='extracterre-analysis-history-v1';
  let smoothedTotalSeconds=null,lastUiAt=0;
  try{
    const history=JSON.parse(localStorage.getItem(storageKey)||'{}');
    const historic=Number(history?.[`${profileKey}|${ocrMode}`]);
    if(Number.isFinite(historic)&&historic>0&&totalDocs>0) smoothedTotalSeconds=historic*totalDocs;
  }catch{}
  const snapshot=(force=false)=>{
    const now=performance.now();
    if(!force&&now-lastUiAt<350) return null;
    lastUiAt=now;
    const elapsed=Math.max(.001,(now-startedAt)/1000);
    const work=[...progressByDoc.values()].reduce((a,v)=>a+Math.max(0,Math.min(1,Number(v)||0)),0);
    const fraction=totalDocs?Math.max(0,Math.min(1,work/totalDocs)):1;
    if(elapsed>=4&&work>=0.15){
      const rawTotal=elapsed/Math.max(.001,fraction);
      smoothedTotalSeconds=smoothedTotalSeconds==null?rawTotal:(smoothedTotalSeconds*.72+rawTotal*.28);
    }
    const total=smoothedTotalSeconds;
    const remaining=total==null?null:Math.max(0,total-elapsed);
    return {elapsed,fraction,total,remaining,finishAt:remaining==null?null:Date.now()+remaining*1000,learning:elapsed<4||work<0.15};
  };
  const persist=(completedDocs)=>{
    if(!completedDocs) return;
    const elapsed=Math.max(.001,(performance.now()-startedAt)/1000);
    const observedPerDoc=elapsed/completedDocs;
    try{
      const history=JSON.parse(localStorage.getItem(storageKey)||'{}');
      const key=`${profileKey}|${ocrMode}`,previous=Number(history[key]);
      history[key]=Number.isFinite(previous)&&previous>0?previous*.65+observedPerDoc*.35:observedPerDoc;
      localStorage.setItem(storageKey,JSON.stringify(history));
    }catch{}
  };
  return {startedAt,snapshot,persist};
}
function updateEtaUi(eta,done,total,active,profile){
  const el=$('#analysisEtaDetail');
  if(!el) return;
  if(!total){ el.textContent='Aucun document en attente'; return; }
  if(!eta||eta.total==null){ el.textContent=`Temps estimé : calcul en cours · ${done}/${total} terminé(s) · ${active} actif(s)`; return; }
  const remaining=eta.remaining<=3?'quelques secondes':formatAnalysisDuration(eta.remaining);
  el.textContent=`Temps total estimé ≈ ${formatAnalysisDuration(eta.total)} · restant ≈ ${remaining} · fin vers ${formatEtaClock(eta.finishAt)}`;
  el.title=`Estimation dynamique fondée sur la vitesse réellement observée. Profil ${profile.label} : ${profile.description}.`;
}
async function analyze(onlyIds=null,manualUnlimited=false){
  if(!state.docs.length&&!state.manualPasteRows.length){ toast('Ajoutez au moins un document ou collez des données manuelles.','warn'); return; }
  $('#analyzeBtn').disabled=true;
  const previouslyAnalyzed=state.docs.filter(d=>Array.isArray(d.cachedOccurrences)).length;
  const pendingDocs=state.docs.filter(d=>!!d.file&&d.status!=='ready'&&d.status!=='timeout'&&(!onlyIds||onlyIds.includes(d.id)));
  const alreadyReady=state.docs.length-pendingDocs.length;
  const ocrMode=$('#ocrMode')?.value||'auto';
  const profile=getAnalysisProfile();
  const documentConcurrency=Math.max(1,Math.min(profile.documents,pendingDocs.length||1));
  setOcrConcurrencyLimit(profile.ocr);
  const progressByDoc=new Map(pendingDocs.map(d=>[d.id,0]));
  const activeIds=new Set();
  const etaTracker=createEtaTracker(pendingDocs.length,progressByDoc,profile.key,ocrMode);
  let done=0,cursor=0;
  const analysisDetail=$('#analysisModeDetail');
  if(analysisDetail) analysisDetail.textContent=`Mode ${profile.label.toLowerCase()} · ${profile.description}`;
  updateEtaUi(etaTracker.snapshot(true),done,pendingDocs.length,0,profile);

  const updateParallelStatus=(doc=null,meta=null,forceEta=false)=>{
    const work=[...progressByDoc.values()].reduce((a,v)=>a+Math.max(0,Math.min(1,Number(v)||0)),0);
    const totalDocs=Math.max(1,state.docs.length);
    const overall=(alreadyReady+work)/totalDocs;
    const pool=ocrPoolStatus();
    const page=meta?.page?` · p.${meta.page}${meta.totalPages?`/${meta.totalPages}`:''}`:'';
    const stage=meta?.stage==='ocr'?'OCR':meta?.stage==='ocr-wait'?'attente OCR':meta?.stage==='ocr-init'?'initialisation OCR':'lecture';
    const latest=doc?` · ${doc.name} · ${stage}${page}`:'';
    setStatus(`${done}/${pendingDocs.length} terminés · ${activeIds.size} actifs · OCR ${pool.active}/${pool.max}${pool.waiting?` (+${pool.waiting} en file)`:''}${latest}`,Math.round(Math.max(0,Math.min(1,overall))*62));
    const eta=etaTracker.snapshot(forceEta);
    if(eta) updateEtaUi(eta,done,pendingDocs.length,activeIds.size,profile);
  };

  const processDocument=async d=>{
    activeIds.add(d.id); d.status='reading'; d.error=null; renderFiles(); updateParallelStatus(d,null,true);
    const controller=new AbortController();
    const noLimit=manualUnlimited||d.retryUnlimited===true; let timeoutTriggered=false, timeoutId=null;
    const started=performance.now();
    try{
      const readPromise=readFile(d.file,(p,meta)=>{
        progressByDoc.set(d.id,Math.max(0,Math.min(1,p||0)));
        d.liveStage=meta?.stage||'reading'; updateParallelStatus(d,meta,false);
      },{mode:ocrMode,lang:'fra+eng',signal:controller.signal});
      if(noLimit) d.read=await readPromise;
      else d.read=await Promise.race([readPromise,new Promise((_,reject)=>{ timeoutId=setTimeout(()=>{ timeoutTriggered=true; controller.abort('analysis-timeout'); const e=new Error('Analyse interrompue après 5 minutes.'); e.name='TimeoutError'; reject(e); },5*60*1000); })]);
      d.classification=classifyDocument(d.name,d.read.text,{kind:d.read.kind});
      d.type=d.classification.type; d.buildings=detectBuildings(d); d.status='ready'; d.retryUnlimited=false;
      if(d.read?.ocr?.warnings?.length) d.ocrWarnings=d.read.ocr.warnings;
      try{
        d.cachedOccurrences=parseDocument(d); d.analysisCachedAt=Date.now();
        d.read=compactReadForRetention(d.read);
      }catch(parseErr){ console.warn('Pré-extraction checkpoint impossible',parseErr); d.cachedOccurrences=null; }
      d.analysisDurationMs=Math.round(performance.now()-started);
      await checkpointDocument(activeProject(),d);
    }catch(e){
      const timedOut=timeoutTriggered||(controller.signal.aborted&&controller.signal.reason==='analysis-timeout');
      if(timedOut){ d.status='timeout'; d.error='Analyse interrompue après 5 minutes. Relance manuelle disponible sans limite de temps.'; d.retryUnlimited=false; }
      else { d.status='error'; d.error=e?.message||String(e); }
    }finally{
      if(timeoutId) clearTimeout(timeoutId);
      progressByDoc.set(d.id,1); delete d.liveStage; activeIds.delete(d.id); done++; renderFiles();
      if(d.status!=='ready') await checkpointWorkspace(`état ${d.name}`,true);
      updateParallelStatus(d,{stage:d.status==='ready'?'done':'error'},true);
      // Petit créneau pour permettre au navigateur de récupérer les canvases/ArrayBuffer détruits.
      await new Promise(r=>setTimeout(r,30));
    }
  };

  try{
    if(pendingDocs.length){
      // Pool borné : 1, 3 ou 5 documents selon le mode choisi. Contrairement à l'ancien
      // Promise.all global, seuls ces workers ouvrent simultanément des PDF.js/ArrayBuffer.
      const worker=async()=>{
        while(true){
          const i=cursor++;
          if(i>=pendingDocs.length) return;
          await processDocument(pendingDocs[i]);
        }
      };
      await Promise.all(Array.from({length:documentConcurrency},()=>worker()));
      etaTracker.persist(pendingDocs.length);
    }
    const valid=state.docs.filter(d=>d.status==='ready');
    if(!valid.length && !state.result) throw new Error('Aucun document n’a pu être lu.');
    if(valid.length){
      const eta=$('#analysisEtaDetail'); if(eta) eta.textContent='Lecture terminée · consolidation des données…';
      setStatus('Extraction métier et consolidation…',72); await new Promise(r=>setTimeout(r,25));
      const operation=$('#operationName').value.trim(); activeProject().operationName=operation; state.result=analyzeDocuments(valid,state.rules,operation,state.buildingOverrides,manualPasteOccurrences()); state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags);
      setStatus('Contrôles de cohérence…',92); await new Promise(r=>setTimeout(r,20));
    }
    renderAll(); await checkpointWorkspace('analyse terminée',true); setStatus('Analyse terminée',100);
    const elapsed=(performance.now()-etaTracker.startedAt)/1000;
    const eta=$('#analysisEtaDetail'); if(eta) eta.textContent=`Analyse terminée en ${formatAnalysisDuration(elapsed)}`;
    setTimeout(()=>$('#progress').hidden=true,900);
    const timedOut=state.docs.filter(d=>d.status==='timeout').length;
    toast(`${state.result?.newlyParsedCount||0} nouveau${state.result?.newlyParsedCount===1?'':'x'} document${state.result?.newlyParsedCount===1?'':'s'} analysé${state.result?.newlyParsedCount===1?'':'s'} ; ${state.result?.reusedParsedCount||previouslyAnalyzed} document(s) réutilisé(s)${timedOut?` ; ${timedOut} fichier(s) mis de côté après 5 min`:''}.`,timedOut?'warn':'success');
  }catch(e){ toast(e.message||String(e),'error'); setStatus('Analyse interrompue'); const eta=$('#analysisEtaDetail'); if(eta) eta.textContent='Estimation interrompue'; }
  finally{ $('#analyzeBtn').disabled=false; }
}

function retryTimedOutDocument(id){ const d=state.docs.find(x=>x.id===id); if(!d)return; d.status='pending'; d.error=null; d.retryUnlimited=true; toast(`Relance sans limite : ${d.name}`,'info'); analyze([id],true); }

function isMissingTableValue(v){
  if(v===undefined||v===null||v==='') return true;
  if(typeof v==='string'&&/^(?:non\s+precise|non\s+pr[eé]cis[eé]|non\s+renseigne|non\s+renseign[eé]|n\/a|nc)$/i.test(normForMissing(v))) return true;
  return false;
}
function normForMissing(v){ return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(); }
function targetedCandidateKey(c){ return [c.building,c.field,typeof c.value==='number'?c.value.toFixed(6):String(c.value),c.page].join('|'); }
function mapTargetedBuilding(raw,grouping,tempDoc){
  if(raw==='Bâtiment unique'){
    if(tempDoc?.buildings?.names?.length===1&&tempDoc.buildings.names[0]!=='Bâtiment unique') raw=tempDoc.buildings.names[0];
    else if(state.result?.rows?.length===1) return state.result.rows[0].building;
  }
  return grouping?.aliasMap?.[raw]||state.buildingOverrides?.[raw]||raw;
}
function buildTargetedCandidates(doc,tempDoc,parsed){
  if(!state.result) return [];
  const valid=state.docs.filter(x=>x.status==='ready');
  const docsForGrouping=valid.map(x=>x.id===doc.id?tempDoc:x);
  if(!docsForGrouping.some(x=>x.id===tempDoc.id)) docsForGrouping.push(tempDoc);
  const rawExisting=docsForGrouping.flatMap(x=>x.id===doc.id?[]:(Array.isArray(x.cachedOccurrences)?x.cachedOccurrences:[]));
  const grouping=buildBuildingGrouping(docsForGrouping,[...rawExisting,...parsed],state.buildingOverrides);
  const rejected=new Set(doc.targetedRejectedKeys||[]), best=new Map();
  for(const o of parsed){
    if(!FIELD_MAP[o.field]||o.confidence<0.72) continue;
    const building=mapTargetedBuilding(o.building,grouping,tempDoc);
    const row=state.result.rows.find(r=>r.building===building)||(state.result.rows.length===1?state.result.rows[0]:null);
    if(!row) continue;
    const manualKey=`${row.building}|${o.field}`;
    if(Object.prototype.hasOwnProperty.call(state.manualValues||{},manualKey)) continue;
    if(!isMissingTableValue(row[o.field])) continue;
    const candidate={...o,building:row.building,originalBuilding:o.building,ocrSource:true};
    if(rejected.has(targetedCandidateKey(candidate))) continue;
    const k=`${candidate.building}|${candidate.field}`; const prev=best.get(k);
    if(!prev||candidate.confidence>prev.confidence||(candidate.confidence===prev.confidence&&String(candidate.excerpt||'').length>String(prev.excerpt||'').length)) best.set(k,candidate);
  }
  return [...best.values()].sort((a,b)=>a.building.localeCompare(b.building,'fr')||String(FIELD_MAP[a.field]?.family||'').localeCompare(String(FIELD_MAP[b.field]?.family||''),'fr')||String(FIELD_MAP[a.field]?.label||a.field).localeCompare(String(FIELD_MAP[b.field]?.label||b.field),'fr'));
}

function showTargetedReview(doc,candidates,ocrMeta){
  const dlg=$('#targetedReviewDialog'), list=$('#targetedReviewList'), title=$('#targetedReviewTitle'), sub=$('#targetedReviewSub'), apply=$('#targetedReviewApply'), close=$('#targetedReviewClose');
  if(!dlg||!list) return;
  const decisions=new Map();
  title.textContent=`Crible fin — ${doc.name}`;
  sub.textContent=`${candidates.length} information(s) nouvelle(s) trouvée(s). OCR maximal sur ${ocrMeta?.pages?.length||0} page(s). Aucune valeur existante n’est remplacée automatiquement : chaque proposition reste soumise à ✓ / ✕.`;
  const render=()=>{
    list.innerHTML=candidates.map((c,i)=>{ const decision=decisions.get(i)||''; const def=FIELD_MAP[c.field]; return `<article class="targeted-proposal ${decision?`decision-${decision}`:''}" data-targeted-index="${i}"><div class="targeted-proposal-main"><div class="targeted-field"><span>${escapeHtml(c.building)}</span><strong>${escapeHtml(def?.label||c.field)}</strong></div><div class="targeted-new-value">${escapeHtml(formatValue(c.value))}${c.unit?` <small>${escapeHtml(c.unit)}</small>`:''}</div><div class="targeted-source">p.${c.page} · confiance moteur ${Math.round((c.confidence||0)*100)} % · ${escapeHtml(c.method||'OCR')}</div><div class="targeted-excerpt">${escapeHtml(c.excerpt||'')}</div></div><div class="targeted-actions"><button class="targeted-accept" data-targeted-accept="${i}" title="Accepter">✓</button><button class="targeted-reject" data-targeted-reject="${i}" title="Refuser">✕</button></div></article>`; }).join('');
    const accepted=[...decisions.values()].filter(x=>x==='accept').length, rejected=[...decisions.values()].filter(x=>x==='reject').length;
    $('#targetedReviewCount').textContent=`${accepted} acceptée(s) · ${rejected} refusée(s) · ${candidates.length-accepted-rejected} à décider`;
    apply.disabled=accepted===0; apply.textContent=accepted?`Appliquer ${accepted} valeur${accepted>1?'s':''} acceptée${accepted>1?'s':''}`:'Appliquer les valeurs acceptées';
    $$('#targetedReviewList [data-targeted-accept]').forEach(b=>b.onclick=()=>{ decisions.set(Number(b.dataset.targetedAccept),'accept'); render(); });
    $$('#targetedReviewList [data-targeted-reject]').forEach(b=>b.onclick=()=>{ decisions.set(Number(b.dataset.targetedReject),'reject'); render(); });
  };
  const persistRejected=()=>{
    const rejected=candidates.filter((_,i)=>decisions.get(i)==='reject');
    if(rejected.length) doc.targetedRejectedKeys=[...new Set([...(doc.targetedRejectedKeys||[]),...rejected.map(targetedCandidateKey)])];
  };
  render();
  close.onclick=()=>{ persistRejected(); scheduleWorkspaceCheckpoint('refus réanalyse ciblée',80); dlg.close(); };
  dlg.oncancel=()=>{ persistRejected(); scheduleWorkspaceCheckpoint('refus réanalyse ciblée',80); };
  apply.onclick=async()=>{
    const accepted=candidates.filter((_,i)=>decisions.get(i)==='accept');
    persistRejected();
    if(accepted.length){
      const existing=Array.isArray(doc.cachedOccurrences)?doc.cachedOccurrences:[];
      const additions=accepted.map(c=>({...c,docId:doc.id,fileName:doc.name,docType:doc.type,confidence:1,method:`targeted-ocr:max:user-validated:${c.method||'parser'}`,userValidated:true,targetedOcr:true,origin:`${doc.type} — OCR maximal validé`,provenanceNote:'Valeur issue d’une réanalyse OCR maximale et explicitement acceptée par l’utilisateur.'}));
      const seen=new Set(existing.map(x=>[x.field,x.building,String(x.value),x.page,x.method].join('|')));
      for(const a of additions){ const k=[a.field,a.building,String(a.value),a.page,a.method].join('|'); if(!seen.has(k)){ existing.push(a); seen.add(k); } }
      doc.cachedOccurrences=existing;
      const valid=state.docs.filter(x=>x.status==='ready');
      state.result=analyzeDocuments(valid,state.rules,$('#operationName').value.trim(),state.buildingOverrides,manualPasteOccurrences()); state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags); state.selfTests=runSelfTests();
      toast(`${accepted.length} nouvelle${accepted.length>1?'s':''} valeur${accepted.length>1?'s':''} validée${accepted.length>1?'s':''} et ajoutée${accepted.length>1?'s':''} au tableau.`,'success');
      renderAll();
      await checkpointDocument(activeProject(),doc);
    }else scheduleWorkspaceCheckpoint('décisions réanalyse ciblée',80);
    dlg.close();
  };
  dlg.showModal();
}

async function targetedReanalysis(id){
  const doc=state.docs.find(x=>x.id===id); if(!doc||doc.status!=='ready') return;
  if(!state.result){ toast('Le crible fin s’utilise après la première analyse du projet.','warn'); return; }
  if(!/\.pdf$/i.test(doc.name)){ toast('La réanalyse OCR maximale est disponible pour les PDF.','warn'); return; }
  if(!doc.file){ toast('Le fichier a été déchargé. Redéposez le même fichier pour le réactiver sans perdre les résultats existants.','warn'); return; }
  if(!globalThis.Tesseract?.createWorker){ toast('Tesseract.js n’est pas disponible. Rechargez la page avec une connexion internet.','error'); return; }
  doc.targetedStatus='running'; renderFiles(); setStatus(`Crible fin — ${doc.name}`,1);
  try{
    const highRead=await readFile(doc.file,(p,meta)=>{ const pct=Math.max(1,Math.min(96,Math.round((p||0)*96))); setStatus(`Crible fin — ${doc.name}${meta?.page?` · page ${meta.page}`:''}`,pct); },{mode:'max',lang:'fra+eng',scale:3.15,maxPixels:12000000});
    const classification=classifyDocument(doc.name,highRead.text,{kind:highRead.kind});
    const tempDoc={...doc,read:highRead,classification,type:classification.type,cachedOccurrences:null}; tempDoc.buildings=detectBuildings(tempDoc);
    const parsed=parseDocument(tempDoc);
    const candidates=buildTargetedCandidates(doc,tempDoc,parsed);
    doc.targetedLastAt=Date.now(); doc.targetedLastProposals=candidates.length; doc.targetedLastOcrPages=highRead.ocr?.pages?.length||0;
    setStatus(`Crible fin terminé — ${candidates.length} proposition(s)`,100); setTimeout(()=>$('#progress').hidden=true,900);
    await checkpointWorkspace('réanalyse ciblée',true);
    if(!candidates.length){ toast('Aucune nouvelle valeur exploitable trouvée pour les champs actuellement vides.','info'); }
    else showTargetedReview(doc,candidates,highRead.ocr);
  }catch(e){ console.error('Fine scan OCR error',e); toast(`Crible fin impossible : ${e?.message||e}`,'error'); setStatus('Crible fin interrompu'); }
  finally{ doc.targetedStatus=null; renderFiles(); }
}

function projectSectionHeader(p,isActive=false){
  const r=p.result; const title=escapeHtml(projectTitle(p)); const docs=(p.docs||[]).length, bats=r?.rows?.length||0;
  return `<div class="project-section-head"><button class="project-toggle" data-project-toggle="${p.id}" title="Réduire/agrandir">${p.expanded?'▾':'▸'}</button><div class="project-section-title"><strong>${title}</strong><small>${docs} document(s) · ${bats} bâtiment(s)${isActive?' · projet actif':''}</small></div><button class="icon-btn project-rename" data-project-rename="${p.id}" title="Renommer le projet" aria-label="Renommer le projet">✎</button>${isActive?'<span class="badge ok">Actif</span>':`<button class="btn light project-activate" data-project-activate="${p.id}">Ouvrir / modifier</button>`}</div>`;
}
function staticProjectBody(p,fields){
  const r=p.result;
  if(!r) return '<div class="empty-small project-empty">Projet sans analyse.</div>';
  return `<div class="table-scroll project-static-table"><table><thead><tr><th class="sticky building-head">Bâtiment</th>${fields.map(f=>`<th>${escapeHtml(f.label)}</th>`).join('')}</tr></thead><tbody>${r.rows.map(row=>`<tr><td class="sticky strong">${escapeHtml(row.building)}</td>${fields.map(f=>`<td class="${row[f.key]===undefined?'missing':''}">${escapeHtml(formatValue(row[f.key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function decorateProjectSections(wrap,fields){
  const active=activeProject();
  const existing=[...wrap.childNodes]; existing.forEach(n=>n.remove());
  const activeSection=document.createElement('section'); activeSection.className='project-section active-project-section'; activeSection.dataset.projectId=active.id;
  activeSection.innerHTML=projectSectionHeader(active,true)+`<div class="project-section-body" ${active.expanded?'':'hidden'}></div>`;
  const body=activeSection.querySelector('.project-section-body'); existing.forEach(n=>body.appendChild(n));
  for(const p of state.projects){
    if(p.id===active.id){ wrap.appendChild(activeSection); continue; }
    const section=document.createElement('section'); section.className='project-section archived-project-section'; section.dataset.projectId=p.id;
    section.innerHTML=projectSectionHeader(p,false)+`<div class="project-section-body" ${p.expanded?'':'hidden'}>${p.expanded?staticProjectBody(p,fields):''}</div>`; wrap.appendChild(section);
  }
  $$('#summaryView [data-project-toggle]').forEach(b=>b.onclick=()=>toggleProject(b.dataset.projectToggle));
  $$('#summaryView [data-project-rename]').forEach(b=>b.onclick=e=>{e.stopPropagation();renameProject(b.dataset.projectRename);});
  $$('#summaryView [data-project-activate]').forEach(b=>b.onclick=()=>activateProject(b.dataset.projectActivate));
}

function renderSummary(){
  const r=state.result; const wrap=$('#summaryView'); const view=currentResultView(); const groups=view.groups.map(g=>({...g,fields:fieldsForResultGroup(g)})).filter(g=>g.fields.length); const fields=fieldsForCurrentResultView(); syncResultTabs();
  if(!r){ wrap.innerHTML='<div class="empty-state"><div class="empty-ico">⌁</div><h3>Nouveau projet prêt à analyser</h3><p>Ajoutez vos PDF, XML ou tableaux Excel, ou collez directement une ligne Excel dans Données manuelles.</p></div>'; decorateProjectSections(wrap,fields); return; }
  const libraryNotes=r.finals.filter(o=>o.libraryDerived&&o.provenanceNote);
  const groupedAliases=(r.buildingAliases||[]).filter(a=>a.source!==a.target);
  const suggestions=(r.buildingSuggestions||[]).slice(0,8);
  const hasManual=Object.keys(state.buildingOverrides||{}).some(k=>state.buildingOverrides[k]&&state.buildingOverrides[k]!==k);
  const groupingInfo=groupedAliases.length?`<div class="building-alias-note"><b>${groupedAliases.length} variante(s) de nom déjà regroupée(s)</b>${groupedAliases.slice(0,10).map(a=>`<span>${escapeHtml(a.source)} → <strong>${escapeHtml(a.target)}</strong></span>`).join('')}${groupedAliases.length>10?`<span>+ ${groupedAliases.length-10} autre(s)</span>`:''}</div>`:'';
  const suggestionInfo=suggestions.length?`<div class="building-suggestions"><b>Rapprochements possibles à vérifier :</b>${suggestions.map(x=>`<button class="building-suggestion" data-a="${escapeHtml(x.a)}" data-b="${escapeHtml(x.b)}">${escapeHtml(x.a)} ↔ ${escapeHtml(x.b)} · ${Math.round(x.score*100)}%</button>`).join('')}</div>`:'';
  state.projectTags=buildProjectTags(state.docs.filter(d=>d.status==='ready'),r,state.manualTags);
  const tagChips=state.projectTags.map((t,i)=>`<span class="project-tag tag-${escapeHtml((t.category||'autre').toLowerCase().replace(/[^a-z0-9]+/g,'-'))}" title="${escapeHtml([t.category,t.building,t.document,t.page?`p.${t.page}`:'',t.excerpt].filter(Boolean).join(' · '))}">${escapeHtml(t.label)}${t.manual?`<button class="remove-project-tag" data-tag-index="${i}" aria-label="Supprimer">×</button>`:''}</span>`).join('');
  const tagPanel=`<section class="project-tags-card"><div class="project-tags-head"><div><h3>Tags projet</h3><p>Signaux descriptifs détectés dans les documents · <b>non exportés dans Excel</b></p></div><span class="badge doc">${state.projectTags.length} tag(s)</span></div><div class="project-tags-wrap">${tagChips||'<span class="empty-small">Aucun signal projet détecté pour le moment.</span>'}</div><div class="project-tag-add"><input id="projectTagInput" list="projectTagLibrary" placeholder="Ajouter un tag manuel…"><datalist id="projectTagLibrary">${PROJECT_TAG_LIBRARY.map(t=>`<option value="${escapeHtml(t.label)}"></option>`).join('')}</datalist><button id="addProjectTagBtn" class="btn light">+ Ajouter</button><small>Bibliothèque automatique : eau, biodiversité, usage, QAI, carbone, énergie, mobilité, labels et performances.</small></div></section>`;
  const uncertainCount=visibleUncertain().length; const comp=r.completeness; const compText=comp?.expected?`${comp.percent}% · ${comp.found}/${comp.expected} champs attendus`:'non calculable';
  wrap.innerHTML=`<div class="kpis"><div class="kpi"><b>${r.documentsCount}</b><span>documents lus</span></div><div class="kpi"><b>${r.buildings.length}</b><span>bâtiments consolidés</span></div><div class="kpi"><b>${r.finals.length}</b><span>valeurs retenues</span></div><div class="kpi ${r.alerts.length?'alert':''}"><b>${r.alerts.length}</b><span>alertes</span></div></div><div class="completeness-strip"><div><span>Analyse technique terminée</span><strong>Complétude : ${escapeHtml(compText)}</strong></div>${uncertainCount?`<button class="btn secondary" id="reviewUncertainBtn">✓/✕ Vérifier ${uncertainCount} candidat${uncertainCount>1?'s':''} (65–89 %)</button>`:'<span class="badge ok">Aucun candidat incertain</span>'}</div>${tagPanel}<div class="edit-hint"><b>Seuil automatique : 90 %.</b> Les candidats de ${Math.round(MIN_REVIEW_CONFIDENCE*100)} à 89 % sont conservés pour validation ✓/✕. L’ordre des sources est appliqué avant le score de confiance.</div><div class="building-merge-bar"><div><button class="btn secondary" id="mergeBuildingsBtn" disabled>⇄ Fusionner les bâtiments sélectionnés</button><button class="btn light" id="resetBuildingLinksBtn" ${hasManual?'':'disabled'}>Réinitialiser les fusions manuelles</button></div><small>Ex. « Bât A », « Bâtiment A » et « BAT A » sont fusionnés automatiquement. « B » et « B1 » nécessitent une validation manuelle.</small></div>${groupingInfo}${suggestionInfo}${groups.map((group,groupIndex)=>`<section class="result-data-group"><div class="result-data-group-head"><h3>${escapeHtml(group.title)}</h3><span>${group.fields.length} donnée${group.fields.length>1?'s':''}</span></div><div class="table-scroll"><table><thead><tr><th class="sticky building-head">${groupIndex===0?'<label><input type="checkbox" id="selectAllBuildings"> Bâtiment</label>':'Bâtiment'}</th>${group.fields.map(f=>`<th title="${escapeHtml(f.family)}">${escapeHtml(f.label)}</th>`).join('')}</tr></thead><tbody>${r.rows.map(row=>`<tr><td class="sticky strong building-cell">${groupIndex===0?`<label><input type="checkbox" class="building-select" value="${escapeHtml(row.building)}"> <span>${escapeHtml(row.building)}</span></label>`:escapeHtml(row.building)}</td>${group.fields.map(f=>{const v=row[f.key]; const o=r.finals.find(x=>x.field===f.key&&(x.building===row.building||x.building==='Bâtiment unique')); const title=o?`${o.fileName} · p.${o.page} · confiance ${Math.round(o.confidence*100)}%${o.originalBuilding&&o.originalBuilding!==o.building?' · source : '+o.originalBuilding:''}${o.provenanceNote?' · '+o.provenanceNote:''}`:'Double-cliquez pour corriger'; return `<td class="summary-value ${v===undefined?'missing':''} ${o?.libraryDerived?'from-library':''}" data-building="${escapeHtml(row.building)}" data-field="${f.key}" title="${escapeHtml(title)}">${escapeHtml(formatValue(v))}<button class="cell-edit summary-edit" data-building="${escapeHtml(row.building)}" data-field="${f.key}" title="Modifier manuellement">✎</button>${o?`<span class="mini-conf ${o.confidence>=.9?'high':o.confidence>=.7?'mid':'low'}">${Math.round(o.confidence*100)}%</span>`:''}${o?.libraryDerived?'<span class="library-tag">bibliothèque</span>':''}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('')}${libraryNotes.length?`<div class="library-notes"><b>Valeurs complétées depuis la bibliothèque isolants</b>${libraryNotes.map(o=>`<div><strong>${escapeHtml(o.building)} — ${escapeHtml(FIELD_MAP[o.field]?.label||o.field)} :</strong> ${escapeHtml(o.provenanceNote)}</div>`).join('')}</div>`:''}`;

  $$('#summaryView .summary-value').forEach(td=>td.ondblclick=()=>manualOverride(td.dataset.building,td.dataset.field)); $$('#summaryView .summary-edit').forEach(b=>b.onclick=e=>{e.stopPropagation();manualOverride(b.dataset.building,b.dataset.field)});
  const selected=()=>$$('#summaryView .building-select:checked').map(x=>x.value);
  const refreshMergeButton=()=>{ const b=$('#mergeBuildingsBtn'); if(b) b.disabled=selected().length<2; };
  $$('#summaryView .building-select').forEach(cb=>cb.onchange=refreshMergeButton);
  const all=$('#selectAllBuildings'); if(all) all.onchange=()=>{ $$('#summaryView .building-select').forEach(cb=>cb.checked=all.checked); refreshMergeButton(); };
  const merge=$('#mergeBuildingsBtn'); if(merge) merge.onclick=()=>mergeSelectedBuildings(selected());
  const reset=$('#resetBuildingLinksBtn'); if(reset) reset.onclick=resetBuildingLinks;
  $$('#summaryView .building-suggestion').forEach(b=>b.onclick=()=>mergeSelectedBuildings([b.dataset.a,b.dataset.b]));
  const addTag=()=>{ const inp=$('#projectTagInput'); const label=(inp?.value||'').trim(); if(!label) return; if(!state.manualTags.some(x=>x.toLowerCase()===label.toLowerCase())) state.manualTags.push(label); if(inp) inp.value=''; state.projectTags=buildProjectTags(state.docs.filter(d=>d.status==='ready'),state.result,state.manualTags); renderSummary(); scheduleWorkspaceCheckpoint('tag manuel'); };
  const addTagBtn=$('#addProjectTagBtn'); if(addTagBtn) addTagBtn.onclick=addTag;
  const tagInp=$('#projectTagInput'); if(tagInp) tagInp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addTag();}});
  $$('#summaryView .remove-project-tag').forEach(b=>b.onclick=()=>{ const t=state.projectTags[Number(b.dataset.tagIndex)]; if(t?.manual) state.manualTags=state.manualTags.filter(x=>x!==t.label); state.projectTags=buildProjectTags(state.docs.filter(d=>d.status==='ready'),state.result,state.manualTags); renderSummary(); scheduleWorkspaceCheckpoint('suppression tag'); }); const reviewBtn=$('#reviewUncertainBtn'); if(reviewBtn) reviewBtn.onclick=showUncertainReview; decorateProjectSections(wrap,fields);
}


function rerunWithBuildingLinks(message='Regroupement des bâtiments mis à jour.'){
  const valid=state.docs.filter(d=>d.status==='ready'); if((!valid.length&&!state.manualPasteRows.length)||!state.result) return;
  state.result=analyzeDocuments(valid,state.rules,$('#operationName').value.trim(),state.buildingOverrides,manualPasteOccurrences()); state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags); state.selfTests=runSelfTests(); renderAll(); scheduleWorkspaceCheckpoint('regroupement bâtiments',80); toast(message,'success');
}

function mergeSelectedBuildings(names){
  names=[...new Set((names||[]).filter(Boolean))]; if(names.length<2){ toast('Sélectionnez au moins deux lignes bâtiment.','warn'); return; }
  const authoritative=names.find(n=>(state.result?.authoritativeBuildings||[]).includes(n));
  const suggested=authoritative||names[0];
  const raw=prompt(`Fusionner ${names.length} lignes bâtiment en une seule.\nNom de la ligne finale :`,suggested); if(raw===null) return;
  const target=raw.trim(); if(!target){ toast('Le nom du bâtiment final ne peut pas être vide.','error'); return; }
  const authCount=names.filter(n=>(state.result?.authoritativeBuildings||[]).includes(n)).length;
  if(authCount>1 && !confirm('Attention : plusieurs identifiants proviennent directement d’un RSET. Confirmez-vous qu’ils représentent malgré tout le même bâtiment physique ?')) return;
  for(const name of names) state.buildingOverrides[name]=target;
  state.buildingOverrides[target]=target;
  rerunWithBuildingLinks(`${names.join(' + ')} → ${target}. Les données ont été reconsolidées.`);
}

function resetBuildingLinks(){
  state.buildingOverrides={}; rerunWithBuildingLinks('Fusions manuelles de bâtiments réinitialisées.');
}

function manualOverride(building,field){
  if(!state.result) return; const def=FIELD_MAP[field]; const row=state.result.rows.find(r=>r.building===building); if(!row||!def) return; const current=row[field]??''; const raw=prompt(`Corriger ${def.label} — ${building}`,String(current)); if(raw===null) return; let value=raw.trim(); if(def.type==='number'){ const n=parseFrNumber(value); if(n===null){ toast('Valeur numérique invalide.','error'); return; } value=n; } if(field==='window_glazing') value=normalizeGlazingType(value)||value; if(!value&&def.type!=='number') value='non précisé'; state.manualValues[`${building}|${field}`]=value; delete state.manualSources[`${building}|${field}`]; applyManualValues(); state.projectTags=buildProjectTags(state.docs.filter(d=>d.status==='ready'),state.result,state.manualTags); toast(`${def.label} corrigé pour ${building}. La correction sera conservée lors des compléments d’analyse.`,'success'); renderSummary(); renderOccurrences(); scheduleWorkspaceCheckpoint('correction manuelle',80);
}


function applyManualValuesToProject(project){
  const result=project?.result; if(!result) return;
  for(const [key,value] of Object.entries(project.manualValues||{})){
    const sep=key.indexOf('|'); if(sep<0) continue; const building=key.slice(0,sep), field=key.slice(sep+1); const row=result.rows.find(r=>r.building===building); if(!row) continue;
    row[field]=value; result.finals=result.finals.filter(o=>!(o.field===field&&o.building===building));
    result.detailed=result.detailed.filter(o=>!(o.field===field&&o.building===building&&String(o.method||'').startsWith('manual:')));
    const meta=project.manualSources?.[key]||{}; const manual={field,value,building,docId:meta.docId||'manual',fileName:meta.fileName||'Correction utilisateur',docType:'Correction manuelle',page:meta.page||'',excerpt:meta.excerpt||'Valeur corrigée manuellement dans la synthèse',confidence:1,method:meta.method||'manual:override',unit:meta.unit||'',sourceTier:'manual',status:'retenu',operation:result.operation,provenanceNote:meta.provenanceNote||''}; result.finals.push(manual); result.detailed.push(manual);
  }
}
function applyManualValues(){ applyManualValuesToProject(activeProject()); }
function rebuildProjectFromCheckpoints(project){
  const valid=(project.docs||[]).filter(d=>d.status==='ready'&&Array.isArray(d.cachedOccurrences));
  if(!valid.length&&!(project.manualPasteRows||[]).length){ project.result=null; return; }
  project.result=analyzeDocuments(valid,state.rules,project.operationName||'',project.buildingOverrides||{},manualPasteOccurrences(project));
  project.result.documentsCount=valid.length; applyManualValuesToProject(project);
  // Tags et économie calculés précédemment restent sauvegardés ; ils seront recalculés
  // automatiquement dès qu'un document est relu ou qu'une donnée est modifiée.
}
function refreshEconomic(){ state.economic=analyzeEconomicData(state.docs,state.result?.operation||$('#operationName').value.trim(),state.manualEconomics); }
function editEconomic(label){ const cur=state.economic?.lots?.find(x=>x.label===label)?.amount??''; const raw=prompt(`Prix HT — ${label}`,String(cur)); if(raw===null)return; const n=parseFrNumber(raw); if(n===null||n<0){toast('Montant HT invalide.','error');return;} state.manualEconomics[label]=n; refreshEconomic(); renderEconomic(); scheduleWorkspaceCheckpoint('donnée économique'); }
function addEconomicLot(){ const label=prompt('Nom du lot économique à ajouter :',''); if(label===null||!label.trim())return; const raw=prompt(`Prix HT — ${label.trim()}`,''); if(raw===null)return; const n=parseFrNumber(raw); if(n===null||n<0){toast('Montant HT invalide.','error');return;} state.manualEconomics[label.trim()]=n; refreshEconomic(); renderEconomic(); scheduleWorkspaceCheckpoint('lot économique'); }
function renderEconomic(){ const wrap=$('#economicView'); if(!wrap)return; refreshEconomic(); const e=state.economic; if(!e?.lots?.length){wrap.innerHTML='<div class="empty-state">Ajoutez un DPGF complété pour obtenir les prix HT par lot. Vous pouvez aussi ajouter un lot manuellement.</div><div class="economic-actions"><button class="btn secondary" id="addEconomicLotBtn">+ Ajouter un lot manuellement</button></div>'; $('#addEconomicLotBtn').onclick=addEconomicLot; return;} wrap.innerHTML=`<div class="economic-head"><div><h3>Données économiques</h3><p>Une ligne par opération, colonnes dynamiques par lot. Cette feuille sera exportée dans Excel.</p></div><button class="btn secondary" id="addEconomicLotBtn">+ Ajouter un lot</button></div><div class="table-scroll"><table><thead><tr><th>Opération</th>${e.lots.map(x=>`<th>${escapeHtml(x.label)}</th>`).join('')}<th>Total HT travaux</th></tr></thead><tbody><tr><td class="strong">${escapeHtml(e.operation||'Opération')}</td>${e.lots.map(x=>`<td class="economic-value" data-lot="${escapeHtml(x.label)}" title="${escapeHtml([x.document,x.page?`p.${x.page}`:'',x.manual?'manuel':''].filter(Boolean).join(' · '))}">${escapeHtml(formatValue(x.amount))} € <button class="cell-edit economic-edit" data-lot="${escapeHtml(x.label)}">✎</button></td>`).join('')}<td class="strong">${escapeHtml(formatValue(e.total))} €</td></tr></tbody></table></div><div class="footnote">Les montants sont lus uniquement dans les documents classés DPGF. Double-cliquez une valeur ou utilisez ✎ pour la corriger avant export.</div>`; $('#addEconomicLotBtn').onclick=addEconomicLot; $$('#economicView .economic-edit').forEach(b=>b.onclick=e=>{e.stopPropagation();editEconomic(b.dataset.lot)}); $$('#economicView .economic-value').forEach(td=>td.ondblclick=()=>editEconomic(td.dataset.lot)); }

function renderOccurrences(){
  const r=state.result, wrap=$('#occView'); if(!r){wrap.innerHTML='<div class="empty-state">Aucune analyse.</div>';return;} const q=($('#occSearch').value||'').toLowerCase(), status=$('#occStatus').value;
  const rows=r.detailed.filter(o=>(!q||`${FIELD_MAP[o.field]?.label} ${o.value} ${o.fileName} ${o.excerpt}`.toLowerCase().includes(q))&&(!status||o.status===status));
  wrap.innerHTML=`<div class="table-scroll"><table><thead><tr><th>Statut</th><th>Donnée</th><th>Valeur</th><th>Bâtiment consolidé</th><th>Nom source</th><th>Document</th><th>Page</th><th>Confiance</th><th>Routage</th><th>Origine</th><th>Extrait</th></tr></thead><tbody>${rows.slice(0,1000).map(o=>`<tr><td><span class="badge ${o.status==='retenu'?'ok':'muted'}">${o.status}</span></td><td>${escapeHtml(FIELD_MAP[o.field]?.label||o.field)}</td><td class="strong">${escapeHtml(formatValue(o.value))}</td><td>${escapeHtml(o.building)}</td><td>${escapeHtml(o.originalBuilding||o.building)}</td><td>${escapeHtml(o.fileName)}</td><td>${o.page}</td><td><span class="confidence ${o.confidence>=.9?'high':o.confidence>=.7?'mid':'low'}">${Math.round(o.confidence*100)}%</span></td><td>${escapeHtml(o.sourceTier)}${o.rejectionReason?`<small class="rejection-reason">${escapeHtml(o.rejectionReason)}</small>`:''}</td><td>${o.libraryDerived?'<span class="library-tag">bibliothèque</span>':'Document'}${o.provenanceNote?`<small class="rejection-reason">${escapeHtml(o.provenanceNote)}</small>`:''}</td><td class="excerpt">${escapeHtml(o.excerpt)}</td></tr>`).join('')}</tbody></table></div><div class="footnote">${rows.length>1000?`Affichage limité aux 1000 premières occurrences sur ${rows.length}.`: `${rows.length} occurrence(s).`}</div>`;
}

function renderDiagnostics(){ const r=state.result, wrap=$('#diagView'); const t=state.selfTests; const testHtml=`<section class="diag-card"><div class="diag-head"><h3>Auto-tests moteur</h3><span class="badge ${t.ok?'ok':'bad'}">${t.passed}/${t.total}</span></div>${t.tests.map(x=>`<div class="test-row"><span>${x.ok?'✓':'✕'}</span><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.details||'')}</small></div>`).join('')}</section>`; if(!r){wrap.innerHTML=testHtml;return;} const c=r.completeness; const compHtml=c?.expected?`<section class="diag-card"><div class="diag-head"><h3>Complétude structurée</h3><span class="badge ${c.percent>=90?'ok':'warn'}">${c.percent}%</span></div>${c.checks.map(x=>`<div class="test-row"><span>${x.found===x.expected?'✓':'!'}</span><b>${escapeHtml(x.fileName)} · ${escapeHtml(x.building)}</b><small>${x.found}/${x.expected}${x.missing.length?` · manquants : ${escapeHtml(x.missing.map(k=>FIELD_MAP[k]?.label||k).join(', '))}`:''}</small></div>`).join('')}</section>`:''; wrap.innerHTML=`${testHtml}${compHtml}<section class="diag-card"><div class="diag-head"><h3>Alertes analyse</h3><span class="badge ${r.alerts.length?'warn':'ok'}">${r.alerts.length}</span></div>${r.alerts.length?r.alerts.map(a=>`<div class="alert-row ${a.level}"><span>⚠</span><div><b>${escapeHtml(a.message)}</b><small>${escapeHtml(a.fileName||'')}</small></div></div>`).join(''):'<div class="success-box">Aucune alerte bloquante détectée.</div>'}</section>`; }

function renderRules(){ const wrap=$('#rulesView'); wrap.innerHTML=`<div class="rules-note">L’ordre saisi est un ordre de priorité réel : la 1re source principale prime sur la 2e, puis viennent les sources secondaires. Une source interdite est ignorée, même avec une confiance élevée.</div><div class="rules-list">${FIELD_DEFS.filter(f=>f.key!=='building').map(f=>{const r=state.rules[f.key]; return `<div class="rule-row"><div><b>${escapeHtml(f.label)}</b><small>${escapeHtml(f.family)}</small></div><label>Principales<input data-rule="${f.key}" data-part="main" value="${escapeHtml((r?.main||[]).join(' ; '))}"></label><label>Secondaires<input data-rule="${f.key}" data-part="secondary" value="${escapeHtml((r?.secondary||[]).join(' ; '))}"></label><label>Interdites<input data-rule="${f.key}" data-part="forbidden" value="${escapeHtml((r?.forbidden||[]).join(' ; '))}"></label></div>`;}).join('')}</div>`; }

function guessFieldFromSearch(query='',excerpt=''){
  const s=normLower(`${query} ${excerpt}`);
  const aliases=[
    ['shab',/\bshab\b|\bsref\b|\bsurt\b|\bsrt\b|surface\s+(?:habitable|utile|de\s+reference|de\s+référence|du\s+batiment|du\s+bâtiment)/],
    ['cepnr_max',/cep\s*,?\s*nr\s*max/],['cepnr',/cep\s*,?\s*nr/],['cep_max',/\bcep\s*max/],
    ['cep_cooling',/cep.*(?:refroid|clim|froid)/],['cep_lighting',/cep.*(?:eclairage|éclairage)/],['cep_aux_vent',/cep.*aux.*vent/],['cep_aux_dist',/cep.*aux.*dist/],['cep_mobility',/cep.*(?:deplacement|déplacement|ascenseur)/],['cep',/\bcep\b/],
    ['ic_components',/ic\s*composant/],['ic_site',/ic\s*chantier/],['ic_energy_heating',/ic\s*(?:energie|énergie).*chauffage/],['ic_energy_cooling',/ic\s*(?:energie|énergie).*(?:refroid|froid)/],['ic_energy_ecs',/ic\s*(?:energie|énergie).*(?:ecs|eau\s+chaude)/],['ic_energy_aux_vent',/ic\s*(?:energie|énergie).*aux.*vent/],['ic_energy_aux_dist',/ic\s*(?:energie|énergie).*aux.*dist/],['ic_energy_mobility',/ic\s*(?:energie|énergie).*(?:deplacement|déplacement|ascenseur)/],['ic_energy',/ic\s*(?:energie|énergie)/],
    ['bbio_max',/bbio\s*max/],['bbio',/\bbbio\b/],['dh_max',/\bdh\s*max/],['dh',/\bdh\b|degres?[- ]heures?/],['tic_ref',/tic\s*(?:ref|reference|référence)/],['tic',/\btic\b/],['housing_count',/nombre\s+de\s+logements?|logements?/]
  ];
  const lot=s.match(/(?:ic\s*composants?[^\n]{0,40})?\blot\s*(1[0-3]|[1-9])\b/); if(lot) return `ic_lot_${lot[1]}`;
  for(const [field,re] of aliases) if(re.test(s)) return field;
  return '';
}
function openSearchIntegration(result,query){
  if(!state.result?.rows?.length){ toast('Lancez d’abord une analyse afin de disposer d’un bâtiment de destination.','warn'); return; }
  const dlg=$('#searchIntegrateDialog'), fieldSel=$('#searchIntegrateField'), buildingSel=$('#searchIntegrateBuilding'), valueInp=$('#searchIntegrateValue'), source=$('#searchIntegrateSource');
  if(!dlg||!fieldSel||!buildingSel||!valueInp) return;
  fieldSel.innerHTML=FIELD_DEFS.filter(f=>f.key!=='building').map(f=>`<option value="${escapeHtml(f.key)}">${escapeHtml(f.family)} — ${escapeHtml(f.label)}</option>`).join('');
  buildingSel.innerHTML=state.result.rows.map(r=>`<option value="${escapeHtml(r.building)}">${escapeHtml(r.building)}</option>`).join('');
  const guessed=guessFieldFromSearch(query,result.excerpt); if(guessed&&FIELD_MAP[guessed]) fieldSel.value=guessed;
  if(result.building&&result.building!=='À vérifier'&&state.result.rows.some(r=>r.building===result.building)) buildingSel.value=result.building;
  valueInp.value=result.numericValue!==null&&result.numericValue!==undefined?String(result.numericValue):String(result.value==='—'?'':result.value);
  source.textContent=`${result.document} · p.${result.page} · ${result.excerpt}`;
  dlg._searchResult=result;
  if(typeof dlg.showModal==='function') dlg.showModal(); else dlg.setAttribute('open','');
}
function applySearchIntegration(){
  const dlg=$('#searchIntegrateDialog'), result=dlg?._searchResult, field=$('#searchIntegrateField')?.value, building=$('#searchIntegrateBuilding')?.value, raw=($('#searchIntegrateValue')?.value||'').trim();
  if(!result||!field||!building||!FIELD_MAP[field]) return;
  let value=raw; const def=FIELD_MAP[field];
  if(def.type==='number'){ const n=parseFrNumber(raw); if(n===null){ toast('La valeur choisie doit être numérique pour ce champ.','error'); return; } value=n; }
  else if(!value) value='non précisé';
  const key=`${building}|${field}`; state.manualValues[key]=value; state.manualSources[key]={docId:result.docId||'search',fileName:result.document,page:result.page,excerpt:result.excerpt,method:'manual:free-search-validated',provenanceNote:'Valeur intégrée manuellement depuis Recherche libre après validation utilisateur.'};
  applyManualValues(); state.projectTags=buildProjectTags(state.docs.filter(d=>d.status==='ready'),state.result,state.manualTags); renderSummary(); renderOccurrences(); updateUxMirrors();
  if(dlg?.open) dlg.close(); scheduleWorkspaceCheckpoint('intégration recherche',80); toast(`${def.label} intégré au résultat pour ${building}.`,'success');
}
function renderSearchResults(){
  const q=$('#freeSearchInput').value.trim(), wrap=$('#searchResults'); if(!q){wrap.innerHTML='<div class="empty-small">Saisissez une donnée à rechercher.</div>';return;}
  const res=freeSearch(state.docs.filter(d=>d.status==='ready'),q); window.__freeSearchResults=res;
  wrap.innerHTML=res.length?`<div class="search-help-note">Les valeurs proposées ne sont jamais injectées automatiquement. Utilisez <b>Intégrer au résultat</b> pour choisir le champ et le bâtiment, puis validez.</div><div class="table-scroll"><table><thead><tr><th>Valeur probable</th><th>Document</th><th>Page</th><th>Bâtiment</th><th>Extrait</th><th>Confiance</th><th></th></tr></thead><tbody>${res.map((x,i)=>`<tr><td class="strong">${escapeHtml(x.value)}</td><td>${escapeHtml(x.document)}</td><td>${x.page}</td><td>${escapeHtml(x.building)}</td><td class="excerpt">${escapeHtml(x.excerpt)}</td><td>${Math.round(x.confidence*100)}%</td><td><button class="btn secondary search-integrate" data-search-index="${i}" type="button">＋ Intégrer au résultat</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-small">Aucun passage suffisamment pertinent.</div>';
  $$('#searchResults .search-integrate').forEach(b=>b.onclick=()=>{ const x=res[Number(b.dataset.searchIndex)]; if(x) openSearchIntegration(x,q); });
}


function updateUxMirrors(){ const manualCount=$('#manualDataCount'); if(manualCount) manualCount.textContent=String(state.manualPasteRows.length); const docs=$('#projectMirrorDocs'); if(docs) docs.textContent=String(state.docs.length); const r=state.result; const values=$('#projectMirrorValues'); if(values) values.textContent=String(r?.finals?.length||0); const buildings=$('#projectMirrorBuildings'); if(buildings) buildings.textContent=String(r?.buildings?.length||r?.rows?.length||0); const alerts=$('#projectMirrorAlerts'); if(alerts) alerts.textContent=String(r?.alerts?.length||0); const status=$('#projectMirrorStatus'); if(status) status.textContent=$('#statusText')?.textContent||'Prêt'; }
function renderAll(){ renderFiles(); renderSummary(); renderOccurrences(); renderDiagnostics(); renderEconomic(); if(state.activeTab==='rules') renderRules(); $('#exportBtn').disabled=!state.projects.some(p=>p.result); const pending=state.docs.filter(d=>!!d.file&&!Array.isArray(d.cachedOccurrences)&&!['error','timeout'].includes(d.status)).length; const missing=state.docs.filter(d=>!d.file&&!Array.isArray(d.cachedOccurrences)&&d.status==='missing').length; const manualRows=state.manualPasteRows.length; const timedOut=state.docs.filter(d=>d.status==='timeout').length; $('#analyzeBtn').textContent=state.result?(pending?`▶ Analyser ${pending} nouveau${pending>1?'x':''} document${pending>1?'s':''} et compléter`:'↻ Recalculer la consolidation'):(manualRows?'▶ Consolider les données manuelles':missing&&!pending?`＋ Redéposer ${missing} fichier${missing>1?'s':''}`:'▶ Lancer l’analyse'); if(timedOut&&!pending&&state.result) $('#analyzeBtn').textContent='↻ Recalculer la consolidation'; $('#analyzeBtn').disabled=!state.result&&!pending&&!manualRows&&missing>0; updateUxMirrors(); }
function switchTab(name){ state.activeTab=name; $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); $$('.view').forEach(v=>v.hidden=v.id!==`${name}Panel`); const resultTabs=$('#resultTabsWrap'); if(resultTabs) resultTabs.hidden=name!=='summary'; const rulesWrap=$('#rulesActionWrap'); if(rulesWrap) rulesWrap.hidden=name!=='rules'; if(name==='rules') renderRules(); if(name==='economics') renderEconomic(); scheduleWorkspaceCheckpoint('onglet actif'); }

function wire(){
  const dz=$('#dropzone'), fi=$('#fileInput'), folderInput=$('#folderInput');
  // Les labels ouvrent nativement les sélecteurs Finder. Le clic sur le fond de la dropzone
  // ouvre aussi les fichiers, mais on ignore impérativement les inputs/labels : sinon input.click()
  // reboucle sur le gestionnaire parent et le sélecteur peut ne plus s'ouvrir.
  dz.addEventListener('click',e=>{
    if(e.target.closest('.drop-actions,input,button,label,select,a')) return;
    fi.click();
  });
  fi.addEventListener('click',e=>e.stopPropagation());
  folderInput?.addEventListener('click',e=>e.stopPropagation());
  fi.addEventListener('change',e=>{ addFiles(e.target.files||[]); fi.value=''; });
  if(folderInput) folderInput.addEventListener('change',e=>{ addFiles(e.target.files||[]); folderInput.value=''; });
  for(const ev of ['dragenter','dragover']) dz.addEventListener(ev,e=>{ e.preventDefault(); e.stopPropagation(); if(e.dataTransfer) e.dataTransfer.dropEffect='copy'; dz.classList.add('drag'); });
  dz.addEventListener('dragleave',e=>{ e.preventDefault(); e.stopPropagation(); if(!dz.contains(e.relatedTarget)) dz.classList.remove('drag'); });
  dz.addEventListener('drop',async e=>{
    e.preventDefault(); e.stopPropagation(); dz.classList.remove('drag');
    setStatus('Lecture du dépôt Finder…');
    try{
      const files=await filesFromDrop(e.dataTransfer);
      if(files?.length){
        const before=state.docs.length; addFiles(files); const added=state.docs.length-before;
        const roots=[...new Set(files.map(f=>(f._relativePath||f.webkitRelativePath||'').split('/')[0]).filter(Boolean))];
        if(added&&roots.some(r=>r&&r!==files[0]?.name)) toast(`Dossier${roots.length>1?'s':''} importé${roots.length>1?'s':''} : ${added} fichier(s) compatible(s).`,'success');
        setStatus(`${added||0} fichier${added===1?'':'s'} ajouté${added===1?'':'s'}`);
      } else { toast('Aucun fichier compatible détecté dans le dépôt.','warn'); setStatus('Prêt'); }
    }catch(err){ console.error('Drop import error',err); toast(`Import impossible : ${err?.message||'erreur Finder'}`,'error'); setStatus('Erreur d’import'); }
  });
  // Empêche le navigateur d'ouvrir un PDF/XML si un fichier est lâché hors de la zone.
  window.addEventListener('dragover',e=>{ if(e.dataTransfer?.types?.includes?.('Files')) e.preventDefault(); },true);
  window.addEventListener('drop',e=>{ if(!dz.contains(e.target)&&e.dataTransfer?.files?.length) e.preventDefault(); },true);
  $('#analyzeBtn').onclick=()=>analyze(); const manualOpen=$('#manualDataBtn'); if(manualOpen) manualOpen.onclick=openManualDataDialog; const manualPaste=$('#manualDataPaste'); if(manualPaste) manualPaste.oninput=()=>renderManualPastePreview(parseManualClipboard(manualPaste.value)); const manualApply=$('#manualDataApply'); if(manualApply) manualApply.onclick=applyManualPaste; const manualClear=$('#manualDataClear'); if(manualClear) manualClear.onclick=clearManualPaste; const manualClose=$('#manualDataClose'); if(manualClose) manualClose.onclick=()=>$('#manualDataDialog')?.close(); $('#newProjectBtn').onclick=addNewProject; $('#clearBtn').onclick=async()=>{ if(!confirm('Effacer la session locale ExtracTerre ? Les résultats sauvegardés dans ce navigateur seront supprimés. Les règles de sources resteront conservées.')) return; try{await clearWorkspaceSnapshot();}catch(err){toast(`Impossible d’effacer complètement la sauvegarde locale : ${err?.message||err}`,'warn');} state.projects=[createProject(1)];state.activeProjectId=state.projects[0].id;syncProjectInput();renderAll();lastLocalSaveAt=null;setLocalSaveUi('Session vide',null);toast('Session locale effacée.','success');};
  $('#exportBtn').onclick=()=>{try{exportProjectsExcel(state.projects,state.rules);}catch(e){toast(e.message,'error');}};
  $$('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab)); $$('.result-tab').forEach(b=>b.onclick=()=>{ activeProject().resultView=b.dataset.resultView||'generic'; syncResultTabs(); renderSummary(); scheduleWorkspaceCheckpoint('onglet résultat'); });
  $('#operationName').oninput=e=>{activeProject().operationName=e.target.value; scheduleWorkspaceCheckpoint('nom opération');};
  $('#occSearch').oninput=renderOccurrences; $('#occStatus').onchange=renderOccurrences; $('#freeSearchBtn').onclick=renderSearchResults; $('#freeSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')renderSearchResults();});
  const searchApply=$('#searchIntegrateApply'); if(searchApply) searchApply.onclick=applySearchIntegration; const searchClose=$('#searchIntegrateClose'); if(searchClose) searchClose.onclick=()=>$('#searchIntegrateDialog')?.close();
  $('#saveRules').onclick=()=>{ $$('#rulesView input[data-rule]').forEach(inp=>{ const k=inp.dataset.rule,p=inp.dataset.part; state.rules[k][p]=inp.value.split(';').map(s=>s.trim()).filter(Boolean); }); saveSourceRules(state.rules); toast('Règles de sources enregistrées.','success'); if(state.result){ const valid=state.docs.filter(d=>d.status==='ready'); state.result=analyzeDocuments(valid,state.rules,$('#operationName').value.trim(),state.buildingOverrides,manualPasteOccurrences()); state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags); } renderAll(); scheduleWorkspaceCheckpoint('règles de sources',80); };
  $('#resetRules').onclick=()=>{state.rules=resetSourceRules();renderRules();scheduleWorkspaceCheckpoint('règles par défaut',80);toast('Règles par défaut restaurées.','success');};
  const ocrMode=$('#ocrMode'); if(ocrMode){ const saved=localStorage.getItem('prestaterre-ocr-mode'); if(['auto','always','off'].includes(saved)) ocrMode.value=saved; ocrMode.onchange=()=>{localStorage.setItem('prestaterre-ocr-mode',ocrMode.value); const msg=ocrMode.value==='always'?'OCR renforcé : toutes les pages PDF seront vérifiées par Tesseract (plus lent).':ocrMode.value==='off'?'OCR désactivé pour les prochains documents.':'OCR automatique : Tesseract intervient seulement sur les pages difficiles.'; toast(msg,'info');}; }
  const analysisMode=$('#analysisMode'); if(analysisMode){
    const saved=localStorage.getItem('extracterre-analysis-mode'); if(ANALYSIS_MODES[saved]) analysisMode.value=saved; else analysisMode.value=DEFAULT_ANALYSIS_MODE;
    const syncModeInfo=()=>{ const p=ANALYSIS_MODES[analysisMode.value]||ANALYSIS_MODES[DEFAULT_ANALYSIS_MODE]; const detail=$('#analysisModeDetail'); if(detail) detail.textContent=`Mode ${p.label.toLowerCase()} · ${p.description}`; };
    analysisMode.onchange=()=>{ localStorage.setItem('extracterre-analysis-mode',analysisMode.value); syncModeInfo(); const p=ANALYSIS_MODES[analysisMode.value]; toast(p.key==='fast'?`Mode rapide : ${p.description}. Consommation mémoire plus élevée.`:`Mode ${p.label.toLowerCase()} : ${p.description}.`,'info'); };
    syncModeInfo();
  }
  $('#version').textContent=`v${APP_VERSION}`; syncProjectInput(); libraryCheck();
}

async function initializeApp(){
  wire(); setLocalSaveUi('Recherche de session…');
  try{
    const restored=await loadWorkspaceSnapshot();
    if(restored?.projects?.length&&meaningfulWorkspace(restored.projects)){
      restoringWorkspace=true;
      state.projects=restored.projects;
      state.activeProjectId=state.projects.some(p=>p.id===restored.activeProjectId)?restored.activeProjectId:state.projects[0].id;
      state.activeTab=restored.activeTab||'summary';
      lastLocalSaveAt=restored.savedAt||null;
      for(const project of state.projects) rebuildProjectFromCheckpoints(project);
      restoringWorkspace=false;
      const docs=state.projects.reduce((n,p)=>n+(p.docs||[]).filter(d=>Array.isArray(d.cachedOccurrences)).length,0);
      toast(`Session locale restaurée · ${state.projects.length} projet(s) · ${docs} document(s) déjà analysé(s).`,'success');
      setLocalSaveUi('Session restaurée',lastLocalSaveAt);
    }else setLocalSaveUi('Prêt',restored?.savedAt||null);
    persistenceReady=true;
    requestPersistentStorage().then(()=>refreshLocalStorageInfo());
  }catch(err){
    console.warn('IndexedDB restore failed',err); persistenceReady=false; setLocalSaveUi('Indisponible'); const detail=$('#localSaveDetail'); if(detail) detail.textContent='Le navigateur ne permet pas la restauration locale dans ce contexte.';
  }
  syncProjectInput(); renderAll(); switchTab(state.activeTab||'summary'); refreshLocalStorageInfo(); window.__prestaterreExtractReady=true;
}
initializeApp();
