import {APP_VERSION,DOC_TYPES,FIELD_DEFS,FIELD_MAP,FAMILIES,ANALYSIS_MODES,DEFAULT_ANALYSIS_MODE,MIN_REVIEW_CONFIDENCE,matchFieldByHeader,matchFieldByHeaderDetailed} from './config.js';
import {classifyDocument} from './classifier.js';
import {readFile,readSpreadsheet,makeDocumentRecord,compactReadForRetention,setOcrConcurrencyLimit,ocrPoolStatus} from './readers.js';
import {detectBuildings} from './buildings.js';
import {loadSourceRules,saveSourceRules,resetSourceRules} from './routing.js';
import {analyzeDocuments,freeSearch,runSelfTests,buildBuildingGrouping,applyComparisonBases} from './engine.js';
import {exportExcel,exportProjectsExcel} from './exporter.js';
import {escapeHtml,formatValue,parseFrNumber,normLower,normalizeGlazingType,downloadBlob} from './utils.js';
import {INSULATION_LIBRARY_VARIANT_COUNT,CORE_INSULATION_VARIANT_COUNT} from './insulation-library.js';
import {buildProjectTags,PROJECT_TAG_LIBRARY} from './tags.js';
import {parseFreePaste,freePasteValues,freePastePrompt,applyFreePasteAi,looksLikeFreeText} from './collage-libre.js';
import {canonicalBuilding} from './buildings.js';
import {analyzeEconomicData,ECONOMIC_FIELDS,ECONOMIC_FIELD_MAP,ECONOMIC_GROUPS,COST_CATEGORIES} from './economics.js';
import {parseDocument,DOCUMENT_FAMILIES,resolveDocumentFamilies,autoFamiliesForType,documentExpectedFields,normalizeFamilyKey} from './parsers.js';
import {getLlmConfig,saveLlmConfig,setLlmDirectKey,llmHasDirectKey,llmConsentGiven,setLlmConsent,runLlmAssist,checkOllama,llmComplete,LLM_MODES,LLM_PROVIDERS} from './llm-assist.js';
import {normalizeGrid,runSearchGrid,searchCellValue,SECURITY_GRID,SEARCH_KINDS,keywordPrompt,gridPrompt,parseLlmObject} from './recherches.js';
import {initializeImprovementPatches,getImprovementPatches,importImprovementPatchFile,removeLocalImprovementPatch} from './patches.js';
import {saveWorkspaceSnapshot,loadWorkspaceSnapshot,saveDocumentCheckpoint,deleteDocumentCheckpoint,clearWorkspaceSnapshot,getWorkspaceStorageInfo,requestPersistentStorage} from './persistence.js';
import {recordLearningEvent,flushLearningJournal,getLearningJournalOverview,getRemoteJournalConfig,saveRemoteJournalConfig,clearRemoteJournalConfig,testRemoteJournalConnection,downloadLearningImprovementPack,pullRemoteLearningMemoryEvents} from './journal.js';
import {initializeLearningMemory,reinforceLearningLocation,penalizeLearningLocation,importRemoteLearningEvents,listLearningProfiles,getLearningMemoryStats,setLearningProfileEnabled,clearLearningMemory} from './learning-memory.js';
import {CLOUD_MODES,getCloudConfig,saveCloudConfig,resetCloudConfig,cloudConfigured,getCloudSession,cloudSignIn,cloudSignOut,getExecutionMode,setExecutionMode,shouldUseCloudForFile,cloudReasonForFile,analyzePdfInCloud,invokeLlmCloudFunction} from './cloud.js';

function createProject(index=1){ return {id:`project-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label:`Projet ${index}`,customTitle:'',operationName:'',docs:[],result:null,buildingOverrides:{},deletedBuildings:[],manualTags:[],projectTags:[],manualValues:{},manualSources:{},manualPasteRaw:'',manualPasteRows:[],manualPasteColumns:[],retainedOccurrences:[],uncertainRejectedKeys:[],manualEconomics:{},economic:null,resultView:'review',profile:'',expanded:true}; }
const state={projects:[],activeProjectId:null,rules:loadSourceRules(),selfTests:runSelfTests(),activeTab:'summary',resultWorkspaceMode:'overview'};

// v2.3 — une seule dropzone : la famille documentaire est détectée à la lecture, modifiable par fichier.
// Options proposées dans la liste des fichiers (valeur = familles séparées par « + »).
const FAMILY_CHOICES=Object.freeze([
  ['rset','RSET RE2020 — thermique'],
  ['rset+carbone','RSEE RE2020 — thermique + carbone'],
  ['rt2012','RSET RT2012'],
  ['thcex','THCex / RT Existant'],
  ['carbone','Carbone — RSENV / ACV'],
  ['cctp','CCTP'],
  ['dpgf','DPGF'],
  ['dpe','DPE / 3CL'],
  ['annex','🛠 Moteur libre — sans liste blanche']
]);
function familiesLabel(list){ return (list||[]).map(f=>DOCUMENT_FAMILIES[f]?.short||f).join(' + '); }
function specializedConfig(family){ const k=normalizeFamilyKey(family)||'annex'; return {label:DOCUMENT_FAMILIES[k]?.label||'Annexe',type:DOCUMENT_FAMILIES[k]?.type||null}; }
function classifyForSelectedFamily(doc){
  const auto=classifyDocument(doc.name,doc.read?.text||'',{kind:doc.read?.kind,re2020:doc.read?.re2020||null});
  const families=resolveDocumentFamilies({...doc,classification:{...auto,automaticType:auto.type},type:auto.type});
  const forcedManual=doc.familyMode==='manual';
  // Le type affiché suit la famille choisie manuellement ; la détection automatique reste mémorisée pour le contrôle.
  const primary=families.find(f=>f!=='annex');
  const forcedType=forcedManual&&primary&&!autoFamiliesForType(auto.type).includes(primary)?DOCUMENT_FAMILIES[primary]?.type:null;
  return {...auto,automaticType:auto.type,type:forcedType||auto.type,families,familyMode:doc.familyMode||'auto',forcedByUser:!!forcedType};
}
function documentCompleteness(doc){
  if(!Array.isArray(doc.cachedOccurrences)) return null;
  const expected=documentExpectedFields(doc); if(!expected.length) return null;
  const found=new Set(doc.cachedOccurrences.map(o=>o?.field).filter(Boolean));
  const ok=e=>Array.isArray(e)?e.some(k=>found.has(k)):found.has(e);
  const name=e=>Array.isArray(e)?e.map(k=>FIELD_MAP[k]?.label||k).join(' ou '):(FIELD_MAP[e]?.label||e);
  const hits=expected.filter(ok), missing=expected.filter(e=>!ok(e));
  return {hits:hits.length,total:expected.length,missing:missing.map(name),missingKeys:missing.flatMap(e=>Array.isArray(e)?e:[e]),ratio:hits.length/expected.length};
}
function familySelectHtml(d){
  const detected=d.classification?autoFamiliesForType(d.classification.automaticType||d.classification.type):null;
  const current=d.familyMode==='manual'&&Array.isArray(d.families)?d.families.join('+'):'auto';
  const autoLabel=detected?`Auto · ${familiesLabel(d.read?.re2020?['rset','carbone']:resolveDocumentFamilies(d))}`:'Auto (détection à la lecture)';
  return `<select class="family-select" data-id="${d.id}" title="Famille documentaire : pilote les parseurs et la liste blanche de champs">${[['auto',autoLabel],...FAMILY_CHOICES].map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select>`;
}
async function changeDocumentFamily(id,value){
  const d=state.docs.find(x=>x.id===id); if(!d) return;
  if(value==='auto'){ d.familyMode='auto'; d.families=null; }
  else { d.familyMode='manual'; d.families=value.split('+').map(normalizeFamilyKey).filter(Boolean); }
  d.specializedFamily=null;
  // Invalidation : les occurrences en cache venaient de l'ancienne famille.
  d.cachedOccurrences=null; d.analysisCachedAt=null;
  if(d.status==='ready'&&d.read?.text){
    try{
      d.classification=classifyForSelectedFamily(d); d.type=d.classification.type; d.buildings=detectBuildings(d);
      d.cachedOccurrences=parseDocument(d); d.analysisCachedAt=Date.now();
      await checkpointDocument(activeProject(),d);
      learn('family_change',{docId:d.id,fileName:d.name,familyMode:d.familyMode,families:d.families||resolveDocumentFamilies(d),detectedType:d.classification.automaticType},activeProject());
      if(state.result) recomputeProject(`Famille modifiée pour ${d.name} : document réanalysé et consolidation recalculée.`);
      else { renderAll(); toast(`Famille modifiée pour ${d.name}.`,'success'); }
    }catch(err){ toast(`Réanalyse impossible : ${err?.message||err}`,'error'); }
  } else { renderFiles(); scheduleWorkspaceCheckpoint('famille documentaire',80); }
}


// v1.1.20 — contrôle coopératif de l'analyse + remplissage progressif
const analysisControl={running:false,paused:false,stopRequested:false,controllers:new Map(),pauseWaiters:[]};
function syncAnalysisControlUi(){
  const pause=$('#analysisPauseBtn'), stop=$('#analysisStopBtn');
  if(pause){ pause.hidden=!analysisControl.running; pause.textContent=analysisControl.paused?'▶':'⏸'; pause.title=analysisControl.paused?'Reprendre l’analyse':'Mettre l’analyse en pause'; pause.classList.toggle('active',analysisControl.paused); }
  if(stop){ stop.hidden=!analysisControl.running; stop.disabled=!analysisControl.running; }
}
function resolveAnalysisPause(){ const waits=analysisControl.pauseWaiters.splice(0); for(const r of waits) try{r();}catch{} }
async function waitForAnalysisGate(){
  while(analysisControl.running&&analysisControl.paused&&!analysisControl.stopRequested){
    setStatus('Analyse en pause — résultats déjà trouvés conservés');
    await new Promise(resolve=>analysisControl.pauseWaiters.push(resolve));
  }
  return !analysisControl.stopRequested;
}
function toggleAnalysisPause(){
  if(!analysisControl.running) return;
  analysisControl.paused=!analysisControl.paused;
  if(!analysisControl.paused){ resolveAnalysisPause(); toast('Analyse reprise.','info'); }
  else toast('Pause demandée : les étapes en cours se figent au prochain point sûr.','info');
  syncAnalysisControlUi();
}
function stopAnalysis(){
  if(!analysisControl.running) return;
  analysisControl.stopRequested=true; analysisControl.paused=false; resolveAnalysisPause();
  for(const c of analysisControl.controllers.values()) try{c.abort('analysis-stop');}catch{}
  setStatus('Arrêt demandé — conservation des résultats déjà trouvés'); syncAnalysisControlUi();
}

state.projects.push(createProject(1)); state.activeProjectId=state.projects[0].id;
function activeProject(){ return state.projects.find(p=>p.id===state.activeProjectId)||state.projects[0]; }
for(const key of ['docs','result','buildingOverrides','deletedBuildings','manualTags','projectTags','manualValues','manualSources','manualPasteRaw','manualPasteRows','manualPasteColumns','retainedOccurrences','uncertainRejectedKeys','manualEconomics','economic']) Object.defineProperty(state,key,{get(){return activeProject()[key]},set(v){activeProject()[key]=v}});
function projectTitle(p){ return (p.customTitle||p.operationName||p.result?.operation||p.label||'Projet').trim(); }
function applyDeletedBuildings(project=activeProject()){
  const r=project?.result, deleted=new Set(project?.deletedBuildings||[]); if(!r||!deleted.size) return;
  const isDeleted=o=>deleted.has(o?.building)||deleted.has(o?.originalBuilding);
  if(Array.isArray(r.rows)) r.rows=r.rows.filter(x=>!deleted.has(x?.building));
  if(Array.isArray(r.finals)) r.finals=r.finals.filter(o=>!isDeleted(o));
  if(Array.isArray(r.detailed)) r.detailed=r.detailed.filter(o=>!isDeleted(o));
  if(Array.isArray(r.uncertain)) r.uncertain=r.uncertain.filter(o=>!isDeleted(o));
  if(Array.isArray(r.buildings)) r.buildings=r.buildings.filter(b=>!deleted.has(typeof b==='string'?b:(b?.building||b?.name)));
  if(Array.isArray(r.authoritativeBuildings)) r.authoritativeBuildings=r.authoritativeBuildings.filter(b=>!deleted.has(b));
  if(Array.isArray(r.buildingAliases)) r.buildingAliases=r.buildingAliases.filter(a=>!deleted.has(a?.source)&&!deleted.has(a?.target));
  if(Array.isArray(r.buildingSuggestions)) r.buildingSuggestions=r.buildingSuggestions.filter(x=>!deleted.has(x?.a)&&!deleted.has(x?.b));
  if(Array.isArray(r.alerts)) r.alerts=r.alerts.filter(a=>!deleted.has(a?.building));
}
let pendingBuildingDeletion=null;
function showBuildingDeletionUndo(names,previousDeleted){
  if(pendingBuildingDeletion?.timer) clearTimeout(pendingBuildingDeletion.timer);
  const el=document.createElement('div'); el.className='toast success building-undo-toast';
  el.innerHTML=`<span>${names.length} bâtiment${names.length>1?'s':''} supprimé${names.length>1?'s':''} de l’analyse.</span><button type="button">Annuler</button>`;
  $('#toasts').appendChild(el);
  const timer=setTimeout(()=>{el.remove(); if(pendingBuildingDeletion?.el===el) pendingBuildingDeletion=null;},8000);
  pendingBuildingDeletion={el,timer,projectId:activeProject().id,names:[...names],previousDeleted:[...previousDeleted]};
  el.querySelector('button').onclick=()=>{
    const info=pendingBuildingDeletion; if(!info) return; clearTimeout(info.timer); el.remove(); pendingBuildingDeletion=null;
    const project=state.projects.find(p=>p.id===info.projectId); if(!project) return;
    project.deletedBuildings=[...info.previousDeleted];
    if(project.id===state.activeProjectId) rerunWithBuildingLinks('Suppression annulée : bâtiments restaurés.');
    else { rebuildProjectFromCheckpoints(project); renderAll(); scheduleWorkspaceCheckpoint('annulation suppression bâtiments',50); }
  };
}
function deleteSelectedBuildings(names){
  names=[...new Set((names||[]).filter(Boolean))]; if(!names.length){ toast('Sélectionnez au moins un bâtiment.','warn'); return; }
  if(!confirm(`Supprimer ${names.length} bâtiment${names.length>1?'s':''} de l’analyse ?

Les fichiers sources resteront chargés.`)) return;
  const project=activeProject(), previous=[...(project.deletedBuildings||[])];
  project.deletedBuildings=[...new Set([...previous,...names])]; applyDeletedBuildings(project); renderAll(); scheduleWorkspaceCheckpoint('suppression bâtiments',40); showBuildingDeletionUndo(names,previous);
}

function syncProjectInput(){ const p=activeProject(); const el=$('#operationName'); if(el) el.value=p.operationName||p.result?.operation||''; }

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const RESULT_VIEWS = Object.freeze({
  review:{label:'Revue',groups:[]},
  generic:{label:'Données générales',groups:[
    {title:'Administration',families:['Administration']},
    {title:'Projet & programme',families:['Programme']},
    {title:'Référentiel & contexte',keys:['reference_name','reference_version','mentions','performance','selected_profile','built_before_1948','built_after_1948','renovation','anru_zone','no_mention','environmental_performance','specific_profile']},
    {title:'Mentions, labels & dérogations',keys:['mention_building_performance','mention_bee_plus','mention_tfpb','mention_ec','derogation_ec','mention_bbca','derogation_bbca','mention_neutrality_contribution','mention_effinergie','effinergie_energy_carbon_level','mention_biosourced_building','derogation_biosourced','mention_habitat_quality','mention_charge_assessment','mention_buildability_bonus','mention_air_quality','mention_acoustic','mention_circular_economy','mention_eu_taxonomy','mention_zero_carbon','mention_biodiversity']},
    {title:'Niveaux de certification',keys:['dpe_ges_label','energy_level','passive_level','cep_level','cepnr_level','bbio_level','ic_construction_level','ic_energy_level','enhanced_performance','biosourced_2013']}
  ]},
  thermal:{label:'Thermique',groups:[
    {title:'Confort d’été',keys:['dh','dh_max','tic','tic_ref','cross_ventilated','non_cross_ventilated','fan_count','fan_type']},
    {title:'Systèmes & énergies',keys:['heating_vector_before','heating_vector_after','heating_mode_after','ecs_vector_before','ecs_vector_after','ecs','cooling','ventilation_before','ventilation','enr','enr_type']},
    {title:'Performance réglementaire',keys:['bbio','bbio_max','bbio_gain','cep','cep_max','cep_gain','cepnr','cepnr_max','cepnr_gain']},
    {title:'Rénovation — avant / après',keys:['ubat_before','ubat_after','cep_before','cep_after_final','dpe_energy_before','dpe_ges_before','dpe_energy_after','dpe_ges_after']},
    {title:'Consommations par poste / énergie',keys:['cep_cooling','cep_lighting','cep_aux_vent','cep_aux_dist','cep_mobility','cep_electricity','cep_gas','cep_district','cep_biomass']}
  ]},
  carbon:{label:'Carbone',groups:[
    {title:'IC composants & chantier',keys:['ic_components','ic_site','stock_c_per_m2','ic_lot_1','ic_lot_2','ic_lot_3','ic_lot_4','ic_lot_5','ic_lot_6','ic_lot_7','ic_lot_8','ic_lot_9','ic_lot_10','ic_lot_11','ic_lot_12','ic_lot_13']},
    {title:'IC construction & seuils',keys:['ic_construction','ic_construction_max','ic_construction_max_2028','ic_energy','ic_energy_max','ic_energy_max_2028']},
    {title:'Eges (E+C- / BBCA Rénovation)',keys:['eges_pce','eges_pcena','eges_energy','eges_site','eges_water','eges_total','eges_pce_max','eges_pcena_max','eges_energy_max','eges_site_max','eges_water_max','eges_total_max']},
    {title:'IC énergie — postes',keys:['ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility']}
  ]},
  economics:{label:'Économie',groups:[]},
  searches:{label:'Recherches',groups:[]},
  envelope:{label:'Structure & enveloppe',groups:[
    {title:'Structure & isolation',keys:['structure','roof_structure','roof_insulation','roof_insulation_thickness','roof_insulation_r','wall_structure','wall_insulation','wall_insulation_thickness','wall_insulation_r','floor_structure','floor_insulation','floor_insulation_thickness','floor_insulation_r']},
    {title:'Menuiseries',keys:['window_material','window_glazing','window_shading']}
  ]}
});
const RESULT_VIEW_ALIASES=Object.freeze({thermalNew:'thermal',thermalReno:'thermal',carbonNew:'carbon',carbonReno:'carbon'});
function normalizedResultViewKey(key){ return RESULT_VIEW_ALIASES[key]||key||'review'; }
function currentResultView(){ const p=activeProject(); const key=normalizedResultViewKey(p.resultView); if(p.resultView!==key) p.resultView=key; return RESULT_VIEWS[key]||RESULT_VIEWS.generic; }
function fieldsForResultGroup(group){
  const prof=projectProfile();
  if(group.keys) return group.keys.map(k=>FIELD_MAP[k]).filter(f=>f&&fieldInProfile(f.key,prof));
  const families=new Set(group.families||[]); return FIELD_DEFS.filter(f=>f.key!=='building'&&families.has(f.family)&&fieldInProfile(f.key,prof));
}
function fieldsForCurrentResultView(){ return [...new Map(currentResultView().groups.flatMap(fieldsForResultGroup).map(f=>[f.key,f])).values()]; }
function syncResultTabs(){ const key=normalizedResultViewKey(activeProject().resultView); $$('.result-tab').forEach(b=>b.classList.toggle('active',b.dataset.resultView===key)); }
function syncStickyResultTabs(){ const key=normalizedResultViewKey(activeProject().resultView); $$('.sticky-result-tab').forEach(b=>b.classList.toggle('active',b.dataset.stickyResultView===key)); const ov=$('#stickyOverviewBtn'); if(ov) ov.classList.toggle('active',state.resultWorkspaceMode==='overview'); }
function projectResultStats(p){ const r=p?.result; return {docs:(p?.docs||[]).length,buildings:r?.rows?.length||0,values:r?.finals?.length||0,candidates:(r?.uncertain||[]).filter(o=>!Object.prototype.hasOwnProperty.call(p.manualValues||{},`${o.building}|${o.field}`)&&!(p.uncertainRejectedKeys||[]).includes(uncertainKey(o))).length,alerts:r?.alerts?.length||0}; }
function renderResultNavigator(){
  const nav=$('#resultNavigator'); if(!nav) return;
  const hasAny=state.projects.some(p=>(p.docs||[]).length||p.result); nav.hidden=!hasAny;
  if(!hasAny){ nav.innerHTML=''; return; }
  nav.innerHTML=`<div class="result-nav-head"><strong>Projets</strong><span class="result-nav-count">${state.projects.length}</span></div><div class="result-quick-drop" id="resultQuickDrop"><small>Déposer d’autres pièces</small><div class="result-quick-actions"><label for="fileInput">＋ Fichiers</label><label for="folderInput">▱ Dossier</label></div></div><div class="result-project-list">${state.projects.map(p=>{const st=projectResultStats(p);return `<div class="result-project-row"><button class="result-project-item ${p.id===state.activeProjectId&&state.resultWorkspaceMode==='detail'?'active':''}" data-result-project="${p.id}" type="button" title="${escapeHtml(projectTitle(p))}"><strong>${escapeHtml(projectTitle(p))}</strong><small>${st.docs} doc · ${st.buildings} bât. · ${st.values} valeurs</small><span class="nav-alert ${st.alerts?'':'ok'}">${st.alerts||'✓'}</span></button><button class="result-project-delete" data-result-project-delete="${p.id}" type="button" title="Supprimer le projet" aria-label="Supprimer le projet ${escapeHtml(projectTitle(p))}">×</button></div>`;}).join('')}</div>`;
  $$('#resultNavigator [data-result-project]').forEach(b=>b.onclick=()=>activateProject(b.dataset.resultProject));
  $$('#resultNavigator [data-result-project-delete]').forEach(b=>b.onclick=e=>{e.stopPropagation();deleteProject(b.dataset.resultProjectDelete);});
  const q=$('#resultQuickDrop'); if(q){ for(const ev of ['dragenter','dragover']) q.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();q.classList.add('drag');}); q.addEventListener('dragleave',e=>{e.preventDefault();e.stopPropagation();if(!q.contains(e.relatedTarget)) q.classList.remove('drag');}); q.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();q.classList.remove('drag');try{const fs=await filesFromDrop(e.dataTransfer);if(fs?.length)addFiles(fs);}catch(err){toast(`Import impossible : ${err?.message||err}`,'error');}}); }
}
function renderResultWorkspaceControls(){
  const sel=$('#stickyProjectSelect'); if(sel){ sel.innerHTML=state.projects.map(p=>`<option value="${p.id}" ${p.id===state.activeProjectId?'selected':''}>${escapeHtml(projectTitle(p))}</option>`).join(''); }
  const i=Math.max(0,state.projects.findIndex(p=>p.id===state.activeProjectId)); const prev=$('#stickyPrevProject'),next=$('#stickyNextProject'); if(prev) prev.disabled=i<=0; if(next) next.disabled=i>=state.projects.length-1;
  const sticky=$('#resultStickyBar'); if(sticky) sticky.hidden=!state.projects.some(p=>(p.docs||[]).length||p.result);
  syncStickyResultTabs(); renderResultNavigator();
}
// v2.6.0 — page principale en tuiles : une tuile par opération (n° de contrat a minima), regroupées en macro-tuiles par
// maître d'ouvrage dès qu'un maître d'ouvrage est connu (import Excel / copier-coller, contrat, livret…).
const NO_OWNER='Maître d’ouvrage non renseigné';
function projectIdentity(p){
  const rows=p?.result?.rows||[], paste=(p?.manualPasteRows||[]).map(r=>r.values||{}), ev=p?.economic?.values||{};
  const pick=(...keys)=>{ for(const k of keys) for(const r of [...paste,...rows]){ const v=r?.[k]; if(v!==undefined&&v!==null&&String(v).trim()&&v!=='non précisé') return String(v).trim(); } return ''; };
  return {contract:pick('contract_number')||ev.fin_contract||'',code:pick('internal_code')||ev.fin_operation_code||'',name:pick('operation_name')||p?.operationName||'',owner:String(p?.ownerName||pick('owner_company','owner_main_company')||'').trim()};
}
function projectCompletion(p){
  const rows=p?.result?.rows||[]; if(!rows.length) return 0; const prof=projectProfile(p);
  const defs=REVIEW_GROUPS.filter(g=>!g.admin&&g.optional!==prof).flatMap(g=>reviewFields(g,prof)); if(!defs.length) return 0;
  const ratios=rows.map(r=>defs.filter(d=>!isBlank(r[d.key])).length/defs.length);
  return Math.round(ratios.reduce((a,b)=>a+b,0)/ratios.length*100);
}
const tileTone=pct=>pct>=90?'high':pct>=50?'mid':'low';
const projectIsEmpty=p=>!(p.docs||[]).length&&!p.result&&!(p.manualPasteRows||[]).length&&!(p.freePasteRows||[]).length;
function renderTiles(wrap,{home=false}={}){
  const rerender=()=>home?renderHome():renderSummary();
  const items=state.projects.filter(p=>!home||!projectIsEmpty(p)).map(p=>({p,id:projectIdentity(p),pct:projectCompletion(p),st:projectResultStats(p)}));
  const grouped=items.some(x=>x.id.owner); const ownerOf=x=>x.id.owner||NO_OWNER;
  if(state.overviewOwner&&!items.some(x=>ownerOf(x)===state.overviewOwner)) state.overviewOwner='';
  const bar=pct=>`<div class="op-progress ${tileTone(pct)}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`;
  let body='',title='Synthèse des opérations',sub=`${items.length} opération(s)`,shown=items.length;
  if(grouped&&!state.overviewOwner){
    const owners=[...new Set(items.map(ownerOf))].sort((a,b)=>a===NO_OWNER?1:b===NO_OWNER?-1:a.localeCompare(b,'fr'));
    sub=`${owners.length} maître(s) d’ouvrage · ${items.length} opération(s)`;
    body=owners.map(o=>{ const xs=items.filter(x=>ownerOf(x)===o); const avg=Math.round(xs.reduce((a,x)=>a+x.pct,0)/xs.length); const done=xs.filter(x=>x.pct>=100).length;
      return `<button type="button" class="op-tile macro" data-tile-owner="${escapeHtml(o)}"><span class="op-tile-k">Maître d’ouvrage</span><strong>${escapeHtml(o)}</strong><span class="op-tile-meta">${xs.length} opération(s) · ${done} dossier(s) complet(s)</span>${bar(avg)}<span class="op-pct">${avg} % complété en moyenne</span></button>`; }).join('');
  } else {
    const xs=grouped?items.filter(x=>ownerOf(x)===state.overviewOwner):items;
    if(grouped){ title=state.overviewOwner; sub=`${xs.length} opération(s)`; shown=xs.length; }
    body=xs.map(({p,id,pct,st})=>`<article class="op-tile ${p.id===state.activeProjectId?'current':''}"><button type="button" class="op-tile-main" data-tile-open="${p.id}"><span class="op-tile-k">Contrat</span><strong>${escapeHtml(id.contract||'non renseigné')}</strong>
      <span class="op-tile-name">${escapeHtml(id.name||projectTitle(p))}</span><span class="op-tile-meta">${escapeHtml([id.code,grouped?'':id.owner].filter(Boolean).join(' · ')||'—')}</span>${bar(pct)}<span class="op-pct">${pct} % complété</span>
      <span class="op-tile-foot">${st.docs} doc. · ${st.buildings} bât. · ${st.values} valeurs${st.alerts?` · <b>${st.alerts} alerte(s)</b>`:''}</span></button>
      <button type="button" class="op-tile-del" data-tile-delete="${p.id}" title="Supprimer l’opération" aria-label="Supprimer l’opération ${escapeHtml(id.contract||projectTitle(p))}">×</button></article>`).join('');
  }
  // Accueil : tuiles d'action (créer une opération, coller ou importer un tableau d'opérations).
  const actions=home&&!(grouped&&state.overviewOwner)?`<button type="button" class="op-tile action" data-home-act="new"><span class="op-tile-plus" aria-hidden="true">＋</span><strong>Nouvelle opération</strong><span class="op-tile-meta">Déposer les documents d’une opération</span></button>
    <button type="button" class="op-tile action" data-home-act="paste"><span class="op-tile-plus" aria-hidden="true">⌨</span><strong>Coller un tableau</strong><span class="op-tile-meta">Zone Excel copiée avec ses en-têtes (contrat, n° d’opération, maître d’ouvrage…)</span></button>
    <label class="op-tile action" for="homeImport"><span class="op-tile-plus" aria-hidden="true">⇪</span><strong>Importer un Excel</strong><span class="op-tile-meta">Classeur listant plusieurs opérations</span></label>`:'';
  if(home&&!items.length) sub='Aucune opération pour le moment';
  wrap.innerHTML=`<div class="result-overview"><div class="result-overview-intro"><div>${grouped&&state.overviewOwner?'<button type="button" class="op-back" data-tile-back>← Tous les maîtres d’ouvrage</button>':''}<h3>${escapeHtml(home&&!(grouped&&state.overviewOwner)?'Opérations':title)}</h3><p>${escapeHtml(sub)}${items.length?' · cliquez sur une tuile pour l’ouvrir':''}</p></div>${shown?`<span class="badge doc">${shown} opération(s)</span>`:''}</div><div class="op-tiles">${body}${actions}</div></div>`;
  wrap.querySelectorAll('[data-tile-owner]').forEach(b=>b.onclick=()=>{ state.overviewOwner=b.dataset.tileOwner; rerender(); });
  wrap.querySelector('[data-tile-back]')?.addEventListener('click',()=>{ state.overviewOwner=''; rerender(); });
  wrap.querySelectorAll('[data-home-act]').forEach(b=>b.onclick=()=>{ if(b.dataset.homeAct==='paste') openManualDataDialog(); else { const cur=activeProject(); if(projectIsEmpty(cur)){ setHomeMode(false); syncProjectInput(); renderAll(); } else addNewProject(); } });
  wrap.querySelectorAll('[data-tile-open]').forEach(b=>b.onclick=()=>activateProject(b.dataset.tileOpen));
  wrap.querySelectorAll('[data-tile-delete]').forEach(b=>b.onclick=()=>deleteProject(b.dataset.tileDelete));
}
// v2.6.1 — écran d'accueil : uniquement les tuiles ; une opération ouverte affiche l'espace d'analyse habituel.
function setHomeMode(on){ state.homeView=!!on; document.body.classList.toggle('home-mode',state.homeView); const h=$('#homeView'); if(h) h.hidden=!state.homeView; $$('.tab').forEach(b=>b.classList.toggle('active',state.homeView?b.dataset.tab==='summary':b.dataset.tab===state.activeTab)); if(state.homeView){ renderHome(); window.scrollTo?.(0,0); } }
function renderHome(){ const h=$('#homeView'); if(h&&state.homeView) renderTiles(h,{home:true}); }
// Tableau d'opérations (Excel importé ou collé) : une opération par n° de contrat / code interne / nom d'opération.
function operationKey(v={}){ return String(v.contract_number||v.internal_code||v.operation_name||'').trim(); }
function computeProjectResult(p){ const valid=(p.docs||[]).filter(d=>d.status==='ready'); p.result=analyzeDocuments(valid,state.rules,p.operationName||'',p.buildingOverrides||{},manualPasteOccurrences(p)); applyDeletedBuildings(p); p.result.documentsCount=valid.length; applyManualValuesToProject(p); }
function importOperationRows(rows,{columns=[],source='copier-coller'}={}){
  const groups=new Map(); for(const r of rows||[]){ const k=operationKey(r.values); if(!k) continue; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r); }
  if(groups.size<2) return false;
  let created=0,updated=0;
  for(const [k,rs] of groups){
    let p=state.projects.find(x=>{ const id=projectIdentity(x); return id.contract===k||id.code===k||(!id.contract&&!id.code&&id.name===k); });
    if(p) updated++; else { p=state.projects.find(x=>!(x.docs||[]).length&&!x.result&&!(x.manualPasteRows||[]).length); if(!p){ p=createProject(state.projects.length+1); state.projects.push(p); } created++; }
    const v=rs[0].values||{}; p.manualPasteRows=rs; p.manualPasteColumns=columns; p.manualPasteRaw='';
    if(!p.operationName) p.operationName=String(v.operation_name||k); const owner=String(v.owner_company||v.owner_main_company||'').trim(); if(owner) p.ownerName=owner;
    computeProjectResult(p);
  }
  state.resultWorkspaceMode='overview'; state.overviewOwner=''; syncProjectInput(); switchTab('summary'); setHomeMode(true); renderAll(); scheduleWorkspaceCheckpoint('import opérations',80);
  learn('manual_paste',{rows:rows.length,operations:groups.size,created,updated,source,split:true},activeProject());
  toast(`${groups.size} opérations importées (${source}) : ${created} créée(s), ${updated} mise(s) à jour.`,'success'); return true;
}
// Classeur Excel : s'il liste plusieurs opérations (contrat / code interne), il est réparti en opérations au lieu d'être lu comme un document.
async function addSpreadsheetOrOperations(file,specializedFamily,opts){
  try{
    const read=await readSpreadsheet(file);
    for(const page of read.pages||[]){
      const tsv=(page.lines||[]).map(l=>(Array.isArray(l.cells)?l.cells:[l.text]).map(c=>String(c??'').replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n');
      const parsed=parseManualClipboard(tsv); const keys=new Set(parsed.rows.map(r=>operationKey(r.values)).filter(Boolean));
      if(keys.size>=2&&parsed.columns.some(c=>['contract_number','internal_code'].includes(c.def?.key))&&importOperationRows(parsed.rows,{columns:parsed.columns.map(c=>({header:c.header,key:c.def?.key||null,matchMode:c.matchMode||''})),source:file.name})) return;
    }
  }catch{}
  addFiles([file],specializedFamily,{...opts,skipOperationCheck:true});
}
function showProjectsOverview(){ state.resultWorkspaceMode='overview'; switchTab('summary'); setHomeMode(true); renderSummary(); renderResultWorkspaceControls(); scheduleWorkspaceCheckpoint('vue synthèse'); }
function moveProject(delta){ const i=state.projects.findIndex(p=>p.id===state.activeProjectId),p=state.projects[i+delta]; if(p) activateProject(p.id); }


let persistenceReady=false,restoringWorkspace=false,workspaceSaveChain=Promise.resolve(),workspaceSaveTimer=null,lastLocalSaveAt=null;
let lastJournalSyncAt=null,journalUiTimer=null;
function learningPayloadBase(project=activeProject()){ return {operation:project?.operationName||project?.result?.operation||'',projectLabel:projectTitle(project)}; }
function learn(type,payload={},project=activeProject()){
  recordLearningEvent(type,{...learningPayloadBase(project),...payload},project).then(()=>scheduleJournalUiRefresh()).catch(err=>console.warn('Learning journal event failed',err));
}
function scheduleJournalUiRefresh(delay=250){ if(journalUiTimer) clearTimeout(journalUiTimer); journalUiTimer=setTimeout(()=>{journalUiTimer=null;refreshJournalUi();},delay); }
function accessRole(){ try{return globalThis.__extracterreGetAccessContext?.()?.role||'';}catch{return '';} }
function ownerBetaEnabled(){ return accessRole()==='owner'; }
function betaSourceFor(building,field){ const r=state.result; if(!r) return null; return r.finals.find(x=>x.field===field&&(x.building===building||x.building==='Bâtiment unique'))||null; }
function betaResultContext(building,field){ const row=state.result?.rows?.find(r=>r.building===building); return {row,source:betaSourceFor(building,field),value:row?.[field]}; }
async function refreshJournalUi(){
  try{
    const stats=await getLearningJournalOverview(),status=$('#journalRemoteStatus'),count=$('#journalEventCount'),syncTime=$('#journalSyncTime');
    if(count) count.textContent=String(stats.total||0);
    if(status){ status.textContent=stats.remoteConfigured?(stats.unsynced?`Partagé · ${stats.unsynced} à synchroniser`:'Partagé · à jour'):'Local uniquement'; status.className=stats.remoteConfigured?'ok':'warn'; }
    if(syncTime) syncTime.textContent=lastJournalSyncAt?new Date(lastJournalSyncAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—';
    const betaStat=$('#betaJournalStat'),betaCount=$('#betaErrorCount');
    if(betaStat) betaStat.hidden=!ownerBetaEnabled();
    if(betaCount) betaCount.textContent=String(stats.byType?.beta_result_error||0);
  }catch(err){ const status=$('#journalRemoteStatus'); if(status){status.textContent='Journal indisponible';status.className='warn';} }
}
async function renderLearningMemoryUi(){
  const stats=getLearningMemoryStats(),count=$('#learningMemoryProfiles'),strong=$('#learningMemoryStrong'),signals=$('#learningMemorySignals'),body=$('#learningMemoryRows');
  if(count) count.textContent=String(stats.activeProfiles||0); if(strong) strong.textContent=String(stats.strongProfiles||0); if(signals) signals.textContent=String(stats.signals||0);
  if(!body) return;
  const profiles=listLearningProfiles().slice(0,120);
  body.innerHTML=profiles.length?profiles.map(p=>`<tr><td>${escapeHtml(FIELD_MAP[p.field]?.label||p.field)}</td><td>${escapeHtml(p.docType||'')}</td><td>${p.confirmations}</td><td>${p.rejections}</td><td>${Math.round((p.reliability||0)*100)} %</td><td>${Math.round((p.boost||0)*1000)/10} pt</td><td><button class="btn light learning-toggle" data-learning-key="${escapeHtml(p.key)}">${p.disabled?'Réactiver':'Désactiver'}</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty-small">La mémoire se remplira à mesure que vous corrigerez ou renseignerez des données par surlignage.</td></tr>';
  [...body.querySelectorAll('.learning-toggle')].forEach(btn=>btn.onclick=async()=>{const p=listLearningProfiles().find(x=>x.key===btn.dataset.learningKey);if(!p)return;await setLearningProfileEnabled(p.key,p.disabled);renderLearningMemoryUi();});
}
async function syncLearningMemoryFromRemote(showToast=false){
  const cfg=getRemoteJournalConfig(); if(!cfg.configured){await renderLearningMemoryUi();return {added:0};}
  const remote=await pullRemoteLearningMemoryEvents();
  if(remote.unsupported){ if(showToast) toast('La mémoire locale fonctionne. Pour le partage multi-ordinateurs, appliquez la migration Supabase v1.1.23.','info'); await renderLearningMemoryUi(); return {added:0,unsupported:true}; }
  const added=await importRemoteLearningEvents(remote.events||[]); if(showToast&&added) toast(`${added} apprentissage(s) distant(s) intégrés à la mémoire.`, 'success'); await renderLearningMemoryUi(); return {added};
}
async function syncLearningJournalNow(showToast=true){
  const cfg=getRemoteJournalConfig(); if(!cfg.configured){ if(showToast) toast('Journal partagé non configuré. Le journal local continue à être conservé.','info'); await refreshJournalUi(); return; }
  const btn=$('#journalSyncBtn'); if(btn) btn.disabled=true;
  try{ const result=await flushLearningJournal(); lastJournalSyncAt=Date.now(); await syncLearningMemoryFromRemote(false); if(showToast) toast(`${result?.sent||0} observation(s) synchronisée(s) avec le journal partagé.`, 'success'); }
  catch(err){ if(showToast) toast(`Synchronisation du journal impossible : ${err?.message||err}`,'warn'); }
  finally{ if(btn) btn.disabled=false; await refreshJournalUi(); }
}

function openJournalConfigDialog(){
  const dlg=$('#journalConfigDialog'); if(!dlg) return;
  const cfg=getRemoteJournalConfig();
  $('#journalSupabaseUrl').value=cfg.supabaseUrl||''; $('#journalSupabaseKey').value=cfg.supabaseAnonKey||'';
  const fb=$('#journalConfigFeedback'); if(fb){fb.textContent=cfg.configured?'Configuration détectée. Utilisez « Tester » pour vérifier la connexion.':'Aucune base partagée configurée : le journal reste actuellement limité à ce navigateur.';fb.className='journal-config-feedback';}
  dlg.showModal();
}
async function saveJournalConfigFromDialog(){
  const cfg=saveRemoteJournalConfig({supabaseUrl:$('#journalSupabaseUrl')?.value||'',supabaseAnonKey:$('#journalSupabaseKey')?.value||''});
  const fb=$('#journalConfigFeedback'); if(!cfg.configured){ if(fb){fb.textContent='Configuration incomplète.';fb.className='journal-config-feedback error';} return; }
  if(fb){fb.textContent='Configuration enregistrée sur cet ordinateur. Test de connexion…';fb.className='journal-config-feedback';}
  try{ await testRemoteJournalConnection(); if(fb){fb.textContent='Connexion réussie. Le journal peut maintenant être synchronisé.';fb.className='journal-config-feedback ok';} await syncLearningJournalNow(false); toast('Journal partagé configuré et synchronisé.','success'); }
  catch(err){ if(fb){fb.textContent=`Configuration enregistrée, mais le test a échoué : ${err?.message||err}`;fb.className='journal-config-feedback error';} toast('La configuration a été conservée pour correction.','warn'); }
  await refreshJournalUi();
}
async function testJournalConfigFromDialog(){
  saveRemoteJournalConfig({supabaseUrl:$('#journalSupabaseUrl')?.value||'',supabaseAnonKey:$('#journalSupabaseKey')?.value||''});
  const fb=$('#journalConfigFeedback'); if(fb){fb.textContent='Test de connexion…';fb.className='journal-config-feedback';}
  try{ const result=await testRemoteJournalConnection(); if(fb){fb.textContent=`Connexion réussie${result?.events!==undefined?` · ${result.events} événement(s) distant(s)`:''}.`;fb.className='journal-config-feedback ok';} }
  catch(err){ if(fb){fb.textContent=`Échec : ${err?.message||err}`;fb.className='journal-config-feedback error';} }
}
async function performJournalPackDownload(packProof=''){
  const btn=$('#journalPackBtn'); if(btn) btn.disabled=true;
  try{
    const cfg=getRemoteJournalConfig();
    if(cfg.configured) await syncLearningJournalNow(false);
    const result=await downloadLearningImprovementPack({packProof});
    toast(`Pack d’amélioration généré · ${result?.manifest?.events||0} observation(s).`,'success');
  }catch(err){
    const cfg=getRemoteJournalConfig();
    if(cfg.configured&&confirm(`Le journal partagé n’est pas joignable ou refuse l’export. Télécharger uniquement le journal présent sur cet ordinateur ?\n\n${err?.message||err}`)){
      try{ const result=await downloadLearningImprovementPack({packProof,skipRemote:true}); toast(`Pack local généré · ${result?.manifest?.events||0} observation(s).`,'warn'); }
      catch(localErr){toast(`Pack impossible : ${localErr?.message||localErr}`,'error');}
    }else toast(`Pack impossible : ${err?.message||err}`,'error');
  }finally{ if(btn) btn.disabled=false; await refreshJournalUi(); }
}
async function requestJournalPackDownload(){
  const role=accessRole();
  if(role==='owner'){ await performJournalPackDownload(''); return; }
  if(role!=='team'){ toast('Profil d’accès introuvable. Verrouillez puis reconnectez-vous.','error'); return; }
  const dlg=$('#journalPackPasswordDialog'); if(!dlg) return;
  $('#journalPackPassword').value=''; $('#journalPackPasswordError').textContent=''; dlg.showModal(); setTimeout(()=>$('#journalPackPassword')?.focus(),50);
}
async function submitJournalPackPassword(){
  const input=$('#journalPackPassword'),error=$('#journalPackPasswordError'),button=$('#journalPackPasswordSubmit'); if(!input||!button) return;
  const candidate=input.value; if(!candidate) return;
  button.disabled=true; error.textContent='Vérification…';
  try{
    const result=await globalThis.__extracterreVerifyPackPassword?.(candidate);
    input.value='';
    if(!result?.ok){error.textContent='Clé incorrecte.';return;}
    error.textContent=''; $('#journalPackPasswordDialog')?.close(); await performJournalPackDownload(result.proof||'');
  }catch(err){error.textContent=err?.message||'Vérification impossible.';}
  finally{button.disabled=false;}
}

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
function workspacePayload(){ return {projects:state.projects,activeProjectId:state.activeProjectId,activeTab:state.activeTab,resultWorkspaceMode:state.resultWorkspaceMode}; }
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

let previewObjectUrl=null;
function closeFilePreview(){
  const frame=$('#filePreviewFrame');
  if(frame) frame.src='about:blank';
  if(previewObjectUrl){ try{URL.revokeObjectURL(previewObjectUrl);}catch{} previewObjectUrl=null; }
  const body=$('#filePreviewBody'); if(body) body.innerHTML='';
}
function previewFileMeta(doc){
  const bits=[`${(Number(doc.size||0)/1024/1024).toFixed(2)} Mo`];
  if(doc.type&&doc.type!=='En attente') bits.push(doc.type);
  if(doc.read?.pageCount) bits.push(`${doc.read.pageCount} page${doc.read.pageCount>1?'s':''}`);
  return bits.join(' · ');
}
function renderSpreadsheetPreview(workbook,sheetName){
  const body=$('#filePreviewBody'); if(!body||!workbook) return;
  const names=workbook.SheetNames||[]; const selected=names.includes(sheetName)?sheetName:names[0];
  const ws=workbook.Sheets?.[selected];
  if(!ws){ body.innerHTML='<div class="file-preview-empty">Aucune feuille lisible dans ce classeur.</div>'; return; }
  const rows=globalThis.XLSX.utils.sheet_to_json(ws,{header:1,defval:'',blankrows:false,raw:false}).slice(0,100).map(r=>r.slice(0,40));
  const maxCols=Math.min(40,Math.max(0,...rows.map(r=>r.length)));
  const table=rows.length?`<div class="file-preview-sheet-scroll"><table class="file-preview-sheet"><tbody>${rows.map((row,ri)=>`<tr>${Array.from({length:maxCols},(_,ci)=>`<${ri===0?'th':'td'}>${escapeHtml(row[ci]??'')}</${ri===0?'th':'td'}>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="file-preview-empty">Cette feuille est vide.</div>';
  body.innerHTML=`${names.length>1?`<div class="file-preview-sheetbar"><label>Feuille <select id="filePreviewSheetSelect">${names.map(n=>`<option value="${escapeHtml(n)}" ${n===selected?'selected':''}>${escapeHtml(n)}</option>`).join('')}</select></label><small>Aperçu limité aux 100 premières lignes et 40 colonnes.</small></div>`:`<div class="file-preview-sheetbar"><strong>${escapeHtml(selected||'Feuille')}</strong><small>Aperçu limité aux 100 premières lignes et 40 colonnes.</small></div>`}${table}`;
  const select=$('#filePreviewSheetSelect'); if(select) select.onchange=()=>renderSpreadsheetPreview(workbook,select.value);
}
async function openFilePreview(id){
  const doc=state.docs.find(x=>x.id===id); if(!doc) return;
  if(!doc.file){ toast('Ce fichier a été restauré depuis la sauvegarde locale. Redéposez-le pour afficher son aperçu.','info'); return; }
  const dlg=$('#filePreviewDialog'),body=$('#filePreviewBody'),title=$('#filePreviewTitle'),meta=$('#filePreviewMeta');
  if(!dlg||!body) return;
  closeFilePreview();
  if(title) title.textContent=doc.name; if(meta) meta.textContent=previewFileMeta(doc);
  body.innerHTML='<div class="file-preview-loading"><span class="spinner"></span>Préparation de l’aperçu…</div>';
  if(!dlg.open) dlg.showModal();
  try{
    if(/\.pdf$/i.test(doc.name)){
      previewObjectUrl=URL.createObjectURL(doc.file);
      body.innerHTML='<iframe id="filePreviewFrame" class="file-preview-frame" title="Aperçu PDF"></iframe>';
      $('#filePreviewFrame').src=`${previewObjectUrl}#toolbar=1&navpanes=0&view=FitH`;
      return;
    }
    if(/\.xml$/i.test(doc.name)){
      const raw=await doc.file.text(),limit=500000,truncated=raw.length>limit;
      let shown=raw.slice(0,limit);
      try{ const parsed=new DOMParser().parseFromString(shown,'application/xml'); if(!parsed.querySelector('parsererror')) shown=new XMLSerializer().serializeToString(parsed); }catch{}
      body.innerHTML=`${truncated?'<div class="file-preview-notice">Aperçu limité aux 500 000 premiers caractères pour préserver la mémoire.</div>':''}<pre class="file-preview-text">${escapeHtml(shown)}</pre>`;
      return;
    }
    if(/\.xlsx?$/i.test(doc.name)||/\.xls$/i.test(doc.name)){
      if(!globalThis.XLSX) throw new Error('SheetJS n’est pas disponible. Rechargez la page avec une connexion internet.');
      const data=await doc.file.arrayBuffer();
      const workbook=globalThis.XLSX.read(data,{type:'array',dense:true,cellFormula:false,cellHTML:false,cellStyles:false});
      renderSpreadsheetPreview(workbook,workbook.SheetNames?.[0]);
      return;
    }
    body.innerHTML='<div class="file-preview-empty">Aperçu non disponible pour ce format.</div>';
  }catch(err){ console.error('File preview error',err); body.innerHTML=`<div class="file-preview-empty error">Aperçu impossible : ${escapeHtml(err?.message||String(err))}</div>`; }
}

function renderFiles(){
  const box=$('#fileList'); if(!state.docs.length){ box.innerHTML='<div class="empty-small">Aucun fichier ajouté.</div>'; return; }
  box.innerHTML=state.docs.map(d=>{
    const isPdf=/\.pdf$/i.test(d.name); const targetedRunning=d.targetedStatus==='running'; const showTarget=d.status==='ready'&&isPdf; const canTarget=showTarget&&!!d.file&&!!state.result; const canPreview=!!d.file;
    const targetedMeta=d.targetedLastAt?` · crible fin${Number.isFinite(d.targetedLastProposals)?` ${d.targetedLastProposals} proposition(s)`:''}`:'';
    const unloaded=d.status==='ready'&&!d.file?' · restauré localement — redéposez le fichier seulement pour une nouvelle lecture/OCR':d.status==='missing'?' · fichier à redéposer':'';
    const cloudMeta=d.remoteAnalysis?.status==='completed'?' · ☁ distant':d.cloudFallback?' · ☁ indisponible → local':String(d.liveStage||'').startsWith('cloud-')?' · ☁ traitement distant':'';
    const isManualFree=d.familyMode==='manual'&&(d.families||[]).includes('annex'); const spec=(d.read?.re2020?'<span class="file-specialized-badge xml">XML structuré</span>':'')+(isManualFree?'<span class="file-specialized-badge manual" title="Moteur libre : tous les parseurs pertinents, sans liste blanche de champs">🛠 Moteur libre</span>':''); const completeness=documentCompleteness(d); const comp=completeness?`<span class="file-completeness ${completeness.ratio>=.75?'ok':'warn'}" title="Manquants : ${escapeHtml(completeness.missing.join(', ')||'aucun')}">${completeness.hits}/${completeness.total} attendus</span>`:''; const famSel=familySelectHtml(d); const mismatch=d.familyMode==='manual'&&!(d.families||[]).includes('annex')&&d.classification&&!(autoFamiliesForType(d.classification.automaticType).includes('annex'))&&(Number(d.classification.confidence)||0)>=.75&&!autoFamiliesForType(d.classification.automaticType).some(f=>(d.families||[]).includes(f))?`<span class="file-family-warning" title="Type détecté : ${escapeHtml(d.classification.automaticType||'')}">⚠ ≠ détection</span>`:''; const canLlm=d.status==='ready'&&!!d.read?.pages?.length&&!d.read?.re2020&&!!state.result; const llmBtn=d.status==='ready'&&!d.read?.re2020?`<button class="btn light llm-file" data-id="${d.id}" ${canLlm&&d.llmStatus!=='running'?'':'disabled'} title="Proposer les champs manquants avec l’IA ; chaque proposition est vérifiée mot pour mot puis soumise à ✓ / ✕">${d.llmStatus==='running'?'IA…':'🤖 IA'}</button>`:'';
    const liveLabel=d.status==='reading'&&String(d.liveStage||'').startsWith('cloud-')?'Cloud…':d.status==='reading'?'Lecture parallèle…':null;
    return `<div class="file-row"><div class="file-icon">${d.name.split('.').pop().toUpperCase().slice(0,4)}</div><div class="file-main"><div class="file-name" title="${escapeHtml(d.relativePath||d.name)}">${escapeHtml(d.name)}</div><div class="file-meta">${(d.size/1024/1024).toFixed(2)} Mo · ${escapeHtml(d.status==='ready'?d.type:d.status==='missing'?'À redéposer':d.status==='error'?'Erreur':d.status==='timeout'?'À relancer · délai dépassé':liveLabel||'En attente')}${d.status==='ready'&&d.buildings?` · ${d.buildings.expectedCount?`${d.buildings.names.length}/${d.buildings.expectedCount}`:d.buildings.names.length} bâtiment(s)`:''}${d.read?.ocr?.used?` · OCR ${d.read.ocr.pages.length} p.`:''}${Array.isArray(d.cachedOccurrences)?' · analysé':''}${escapeHtml(cloudMeta)}${escapeHtml(targetedMeta)}${escapeHtml(unloaded)}</div></div><div class="file-tags">${d.classification?`<span class="badge doc">${escapeHtml(d.type)}</span>`:''}${spec}${famSel}${mismatch}${comp}</div><div class="file-actions"><button class="btn light preview-file" data-id="${d.id}" ${canPreview?'':'disabled'} title="${canPreview?'Afficher ce fichier dans ExtracTerre sans ouvrir de nouvel onglet':'Redéposez ce fichier pour afficher son aperçu'}">👁 Aperçu</button>${llmBtn}${showTarget||targetedRunning?`<button class="btn light targeted-file" data-id="${d.id}" ${targetedRunning||!canTarget?'disabled':''} title="${!d.file?'Redéposez ce PDF pour réactiver le crible fin ; les résultats déjà sauvegardés seront conservés.':!state.result?'Terminez d’abord la première consolidation du projet.':'Repasser ce PDF au crible fin avec OCR maximal, sans retraiter les autres documents'}">${targetedRunning?'Crible fin…':'🔎 Crible fin'}</button>`:''}${d.status==='timeout'?`<button class="btn light retry-file" data-id="${d.id}">↻ Relancer sans limite</button>`:''}<button class="icon-btn remove-file" data-id="${d.id}" aria-label="Supprimer">×</button></div></div>`;
  }).join('');
  $$('.remove-file').forEach(b=>b.onclick=async()=>{
    // v2.3.7 — retirer un document ne supprime plus les données qu'il a déjà fournies : elles restent dans la consolidation.
    const id=b.dataset.id; const doc=state.docs.find(d=>d.id===id); const kept=retainRemovedDocument(activeProject(),doc);
    state.docs=state.docs.filter(d=>d.id!==id); try{await deleteDocumentCheckpoint(id);}catch{}
    if(state.result&&(state.docs.some(d=>d.status==='ready')||hasRetainedData()||state.manualPasteRows.length)) recomputeProject(kept?`${doc?.name||'Document'} retiré de la liste : ${kept} valeur(s) extraite(s) conservée(s).`:'Document retiré de la liste.');
    else { renderAll(); if(kept) toast(`${doc?.name||'Document'} retiré : ${kept} valeur(s) extraite(s) conservée(s) pour la prochaine consolidation.`,'success'); }
    scheduleWorkspaceCheckpoint('suppression document',50); });
  $$('.retry-file').forEach(b=>b.onclick=()=>retryTimedOutDocument(b.dataset.id));
  $$('.targeted-file').forEach(b=>b.onclick=()=>targetedReanalysis(b.dataset.id));
  $$('.family-select').forEach(sel=>{ sel.onchange=()=>changeDocumentFamily(sel.dataset.id,sel.value); sel.onclick=e=>e.stopPropagation(); });
  $$('.llm-file').forEach(b=>b.onclick=()=>llmAssistDocument(b.dataset.id));
  $$('.preview-file').forEach(b=>b.onclick=()=>openFilePreview(b.dataset.id));
}

// v2.5.0 — paquet complet du questionnaire financier (.zip) : seul l'export « _questionnaire.json » est importé (il reprend
// la synthèse PDF et les montants des DPGF joints, qui feraient doublon).
async function addQuestionnaireZip(file,specializedFamily,opts){
  try{
    if(!globalThis.JSZip) throw new Error('JSZip non chargé');
    const zip=await globalThis.JSZip.loadAsync(file);
    const entries=Object.values(zip.files).filter(f=>!f.dir&&/_questionnaire\.json$/i.test(f.name));
    if(!entries.length){ toast(`Aucun export « _questionnaire.json » dans ${file.name}.`,'warn'); return; }
    const files=await Promise.all(entries.map(async f=>new File([await f.async('blob')],f.name.split('/').pop(),{type:'application/json'})));
    addFiles(files,specializedFamily,opts);
  }catch(err){ toast(`Paquet illisible : ${file.name} (${err?.message||err})`,'error'); }
}
function addFiles(fileList,specializedFamily=null,opts={}){
  const allowed=/\.(pdf|xml|xlsx?|xls|json)$/i; let added=0,rehydrated=0;
  for(const file of fileList){
    if(/\.zip$/i.test(file.name)){ addQuestionnaireZip(file,specializedFamily,opts); continue; }
    if(/\.xlsx?$/i.test(file.name)&&!opts.skipOperationCheck){ addSpreadsheetOrOperations(file,specializedFamily,opts); continue; }
    if(!allowed.test(file.name)){ toast(`Format ignoré : ${file.name}`,'warn'); continue; }
    const rel=file._relativePath||file.webkitRelativePath||file.name;
    const existing=state.docs.find(d=>(d.relativePath||d.name)===rel&&d.size===file.size);
    if(existing){
      if(!existing.file){ existing.file=file; existing.relativePath=rel; if(['missing','error'].includes(existing.status)) existing.status='pending'; rehydrated++; continue; }
      toast(`Déjà ajouté : ${rel}`,'warn'); continue;
    }
    // Fichier redéposé : ses valeurs conservées sont remplacées par la nouvelle lecture.
    if(hasRetainedData()) activeProject().retainedOccurrences=retainedOccurrences().filter(o=>o.fileName!==file.name);
    const rec=makeDocumentRecord(file); rec.relativePath=rel; rec.familyMode='auto'; rec.families=null; rec.specializedFamily=null;
    const forced=normalizeFamilyKey(specializedFamily); if(forced&&forced!=='annex'){ rec.familyMode='manual'; rec.families=[forced]; }
    // v2.3.2 — Analyse manuelle : moteur libre (famille « annex » imposée), sans liste blanche de champs.
    if(opts.manualAnalysis){ rec.familyMode='manual'; rec.families=['annex']; }
    state.docs.push(rec); added++; if(state.homeView) setHomeMode(false);
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
  const p=createProject(state.projects.length+1); state.projects.push(p); state.activeProjectId=p.id; setHomeMode(false); syncProjectInput(); renderAll(); switchTab('summary'); toast(`${projectTitle(current)} conservé. Nouveau projet prêt à recevoir ses documents.`,'success'); scheduleWorkspaceCheckpoint('nouveau projet',80);
}
function activateProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; setHomeMode(false); window.scrollTo?.(0,0); activeProject().operationName=$('#operationName').value.trim(); state.activeProjectId=id; state.resultWorkspaceMode='detail'; if(!p.result) rebuildProjectFromCheckpoints(p); p.expanded=true; syncProjectInput(); switchTab('summary'); renderAll(); scheduleWorkspaceCheckpoint('projet actif'); }
function toggleProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; p.expanded=!p.expanded; renderSummary(); scheduleWorkspaceCheckpoint('affichage projet'); }
async function deleteProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; const title=projectTitle(p); const docs=(p.docs||[]).length;
  if(!confirm(`Supprimer le projet « ${title} » de la liste ?${docs?`\n${docs} document(s) et leurs analyses seront retirés de la session.`:''}\nLe journal d’amélioration et les règles de sources sont conservés.`)) return;
  for(const d of p.docs||[]){ try{await deleteDocumentCheckpoint(d.id);}catch{} }
  const i=state.projects.findIndex(x=>x.id===id); state.projects.splice(i,1);
  if(!state.projects.length) state.projects.push(createProject(1));
  if(state.activeProjectId===id){ state.activeProjectId=(state.projects[Math.min(i,state.projects.length-1)]||state.projects[0]).id; if(state.projects.length>1) state.resultWorkspaceMode='overview'; const np=activeProject(); if(!np.result) rebuildProjectFromCheckpoints(np); syncProjectInput(); }
  renderAll(); toast(`Projet « ${title} » supprimé.`,'success'); scheduleWorkspaceCheckpoint('suppression projet',80); }
function renameProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; const current=projectTitle(p); const raw=prompt('Renommer le projet',current); if(raw===null)return; const name=raw.trim(); if(!name){ toast('Le nom du projet ne peut pas être vide.','warn'); return; } p.customTitle=name; renderSummary(); toast(`Projet renommé : ${name}`,'success'); scheduleWorkspaceCheckpoint('renommage projet'); }


function parseManualClipboard(raw=''){
  const lines=String(raw||'').replace(/\r/g,'').split('\n').filter(line=>line.trim().length);
  if(!lines.length) return {rows:[],columns:[],unrecognized:[],recognized:0};
  const split=line=>line.includes('\t')?line.split('\t'):(line.includes(';')?line.split(';'):[line]);
  let best={index:-1,count:0,cells:[],defs:[]};
  for(let i=0;i<Math.min(lines.length,8);i++){
    const cells=split(lines[i]); const matches=cells.map(c=>matchFieldByHeaderDetailed(c)); const defs=matches.map(m=>m?.def||null); const count=defs.filter(Boolean).length;
    if(count>best.count) best={index:i,count,cells,defs,matches};
  }
  if(best.index<0||best.count===0) return {rows:[],columns:[],unrecognized:best.cells||[],recognized:0};
  const columns=best.cells.map((header,i)=>({header:String(header||'').trim(),def:best.defs[i]||null,index:i,matchMode:best.matches?.[i]?.mode||'',matchScore:best.matches?.[i]?.score||0}));
  const rows=[];
  for(let i=best.index+1;i<lines.length;i++){
    const cells=split(lines[i]); const values={}; let nonEmpty=0;
    for(const col of columns){ if(!col.def) continue; const rawValue=String(cells[col.index]??'').trim(); if(!rawValue) continue; nonEmpty++; let value=rawValue; if(col.def.type==='number'){ const n=parseFrNumber(rawValue); if(n===null) continue; value=n; } if(col.def.key==='window_glazing') value=normalizeGlazingType(value)||value; values[col.def.key]=value; }
    if(nonEmpty&&Object.keys(values).length) rows.push({sourceRow:i+1,values});
  }
  return {rows,columns,unrecognized:columns.filter(c=>!c.def&&c.header).map(c=>c.header),recognized:columns.filter(c=>c.def).length};
}
// v2.3.7 — valeurs extraites des documents retirés de la liste : conservées dans le projet et réinjectées
// dans chaque consolidation (traçabilité intacte, mention « document retiré »).
function retainedOccurrences(project=activeProject()){ return Array.isArray(project.retainedOccurrences)?project.retainedOccurrences:[]; }
function hasRetainedData(project=activeProject()){ return retainedOccurrences(project).length>0; }
function retainRemovedDocument(project,doc){
  if(!doc||!Array.isArray(doc.cachedOccurrences)||!doc.cachedOccurrences.length) return 0;
  const kept=doc.cachedOccurrences.filter(Boolean).map(o=>({...o,docId:o.docId||doc.id,fileName:o.fileName||doc.name,removedDocument:true,provenanceNote:[o.provenanceNote,'Document retiré de la liste : valeur extraite conservée.'].filter(Boolean).join(' ')}));
  project.retainedOccurrences=[...retainedOccurrences(project).filter(o=>o.docId!==doc.id),...kept];
  return kept.length;
}
function manualPasteOccurrences(project=activeProject()){
  const out=[...retainedOccurrences(project)]; let n=0;
  for(const r of project.freePasteRows||[]) for(const [field,value] of Object.entries(r.values||{})) if(FIELD_MAP[field]) out.push({field,value,building:r.building?canonicalBuilding(r.building):'Bâtiment unique',docId:`free-paste-${project.id}`,fileName:'Collage libre',docType:DOC_TYPES.MANUAL,page:'',excerpt:String(r.sources?.[field]||'').slice(0,420),confidence:.995,method:'manual:free-paste',unit:'',origin:'Entrée manuelle — collage libre',provenanceNote:'Donnée collée : prioritaire sur les documents.'});
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
  state.result=analyzeDocuments(valid,state.rules,operation,state.buildingOverrides,manualPasteOccurrences()); applyDeletedBuildings(activeProject());
  state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags); state.selfTests=runSelfTests(); renderAll(); scheduleWorkspaceCheckpoint('consolidation',80); if(message) toast(message,'success');
}
function openManualDataDialog(){
  const dlg=$('#manualDataDialog'); if(!dlg) return;
  $('#manualDataPaste').value=state.manualPasteRaw||''; onManualPasteInput(); dlg.showModal();
}
function renderManualPastePreview(parsed){
  const box=$('#manualDataPreview'); if(!box) return;
  if(!parsed.recognized){ box.innerHTML='<div class="empty-small">Collez au minimum une ligne d’en-têtes puis une ligne de données.</div>'; return; }
  const recognized=parsed.columns.filter(c=>c.def).map(c=>({label:c.def.label,mode:c.matchMode||'exact'}));
  const flexible=recognized.filter(x=>x.mode!=='exact').length;
  box.innerHTML=`<div class="manual-preview-stats"><span><b>${parsed.recognized}</b> colonne(s) reconnue(s)</span>${flexible?`<span><b>${flexible}</b> rapprochement(s) souple(s)</span>`:''}<span><b>${parsed.rows.length}</b> ligne(s) de données</span>${parsed.unrecognized.length?`<span class="warn"><b>${parsed.unrecognized.length}</b> en-tête(s) non reconnu(s)</span>`:''}</div><div class="manual-chip-wrap">${recognized.slice(0,28).map(x=>`<span title="${x.mode==='exact'?'Intitulé exact':'Intitulé rapproché automatiquement'}">${escapeHtml(x.label)}${x.mode==='exact'?'':' ≈'}</span>`).join('')}${recognized.length>28?`<span>+${recognized.length-28}</span>`:''}</div>${parsed.unrecognized.length?`<small>Non reconnus (aucun équivalent existant suffisamment fiable) : ${escapeHtml(parsed.unrecognized.join(' · '))}</small>`:''}`;
}
// v2.7.0 — collage libre (« Bâtiment G : / Cep = 37,7 … ») : chaque ligne est rangée dans une colonne ; les valeurs
// appliquées priment sur toutes les données extraites des documents (comme une correction manuelle).
let freePaste=null;
function onManualPasteInput(){ const raw=$('#manualDataPaste')?.value||''; if(raw.trim()&&looksLikeFreeText(raw)){ freePaste=parseFreePaste(raw); renderFreePastePreview(); } else { freePaste=null; renderManualPastePreview(parseManualClipboard(raw)); } }
function freeFieldSelect(cur,attrs){ return `<select ${attrs}><option value="">— ignorer</option>${FIELD_DEFS.filter(f=>f.key!=='building').map(f=>`<option value="${f.key}" ${f.key===cur?'selected':''}>${escapeHtml(f.label)}</option>`).join('')}</select>`; }
function renderFreePastePreview(){
  const box=$('#manualDataPreview'); if(!box||!freePaste) return; const fp=freePaste;
  const rows=fp.buildings.flatMap((b,bi)=>b.items.map((it,ii)=>({b,bi,it,ii}))); const n=rows.filter(r=>r.it.field).length;
  box.innerHTML=`<div class="manual-preview-stats"><span><b>Collage libre</b></span><span><b>${fp.buildings.filter(b=>b.items.length&&b.name!=='*').length||1}</b> bâtiment(s)</span>${fp.buildings.some(b=>b.name==='*')?`<span><b>${fp.buildings.find(b=>b.name==='*').items.length}</b> valeur(s) pour toute l’opération</span>`:''}<span><b>${n}</b> valeur(s) rangée(s)</span>${fp.unmatched.length?`<span class="warn"><b>${fp.unmatched.length}</b> ligne(s) non reconnue(s)</span>`:''}</div>
  <p class="manual-free-note">Ces valeurs <b>priment sur les documents</b>. Vérifiez la colonne de chaque ligne ; « — ignorer » écarte une ligne.${rows.some(r=>r.it.dhZone)?' DH : la zone la plus défavorable est retenue, les types de zones sont notés.':''}</p>
  <div class="table-scroll"><table class="free-paste-table"><thead><tr><th>Bâtiment</th><th>Ligne collée</th><th>Colonne ExtracTerre</th><th>Valeur</th></tr></thead><tbody>
  ${rows.map(({b,bi,it,ii})=>`<tr class="${it.ai?'ai':''}"><td>${b.name==='*'?'<i>Toute l’opération</i>':escapeHtml(b.name||'—')}</td><td>${escapeHtml(it.line)}</td><td>${freeFieldSelect(it.field,`data-fp-b="${bi}" data-fp-i="${ii}"`)}${it.ai?' <small>✨ IA</small>':''}</td><td><b>${escapeHtml(formatValue(it.value))}</b></td></tr>`).join('')}
  ${fp.unmatched.map((u,ui)=>`<tr class="unmatched"><td>${escapeHtml(u.building||'—')}</td><td>${escapeHtml(u.line)}</td><td>${freeFieldSelect('',`data-fp-u="${ui}"`)}</td><td><small>non reconnue</small></td></tr>`).join('')}
  </tbody></table></div>${freePasteTargetsHtml(fp)}${fp.unmatched.length?`<button type="button" class="btn secondary" id="freePasteAi">✨ Ranger les ${fp.unmatched.length} ligne(s) non reconnue(s) avec l’IA</button><small class="llm-hint"> Seules les lignes collées sont envoyées (Ollama en local si activé dans 🤖 IA) ; la valeur reste celle de la ligne.</small>`:''}`;
  box.querySelectorAll('[data-fp-b]').forEach(sel=>sel.onchange=()=>{ const it=fp.buildings[Number(sel.dataset.fpB)].items[Number(sel.dataset.fpI)]; it.field=sel.value||null; it.dhZone=null; if(it.field){ const tmp={buildings:[],unmatched:[{building:'_',line:it.line,label:it.label,raw:it.raw}]}; applyFreePasteAi(tmp,{lines:[{n:1,field:it.field,value:it.raw}]}); const v=tmp.buildings[0]?.items[0]?.value; if(v===undefined){ toast('Aucune valeur exploitable dans cette ligne pour cette colonne.','warn'); it.field=null; } else it.value=v; } renderFreePastePreview(); });
  box.querySelectorAll('[data-fp-u]').forEach(sel=>sel.onchange=()=>{ if(!sel.value) return; const u=fp.unmatched[Number(sel.dataset.fpU)]; const tmp={buildings:fp.buildings,unmatched:[u]}; if(!applyFreePasteAi(tmp,{lines:[{n:1,field:sel.value,value:u.raw||u.line}]})) toast('Aucune valeur exploitable dans cette ligne pour cette colonne.','warn'); else { fp.unmatched=fp.unmatched.filter(x=>x!==u); const last=fp.buildings.find(x=>x.name===u.building)?.items.slice(-1)[0]; if(last) last.ai=false; } renderFreePastePreview(); });
  box.querySelectorAll('[data-fp-target]').forEach(sel=>sel.onchange=()=>{ fp.targets=fp.targets||{}; fp.targets[sel.dataset.fpTarget]=sel.value; });
  $('#freePasteAi')?.addEventListener('click',async e=>{ const btn=e.currentTarget; btn.disabled=true; btn.textContent='IA en cours…';
    try{ const pr=freePastePrompt(fp.unmatched); const added=applyFreePasteAi(fp,parseLlmObject(await llmComplete({system:pr.system,user:pr.user,maxTokens:1500},{invokeFunction:invokeLlmCloudFunction}))); toast(added?`${added} ligne(s) rangée(s) par l’IA : vérifiez les colonnes.`:'L’IA n’a trouvé aucune colonne adaptée.',added?'success':'warn'); learn('free_paste_ai',{lines:pr.user.split('\n').length,added},activeProject()); }
    catch(err){ toast(`IA indisponible : ${err?.message||err}`,'error'); }
    renderFreePastePreview(); });
}
// Bâtiment de l'analyse qui reçoit chaque section collée : correspondance automatique, modifiable dans l'aperçu.
function freePasteAutoTarget(name){ const rows=state.result?.rows||[]; const aliases=state.result?.buildingAliases||[]; if(!name) return rows.length===1?rows[0].building:'Bâtiment unique'; const c=canonicalBuilding(name);
  return aliases.find(a=>a.source===name||a.source===c)?.target||rows.find(r=>r.building===name||r.building===c||normLower(r.building)===normLower(c))?.building||''; }
function freePasteTargetsHtml(fp){
  const named=fp.buildings.filter(b=>b.name!=='*'); const rows=(state.result?.rows||[]).map(r=>r.building); if(!named.length&&!rows.length) return '';
  fp.targets=fp.targets||{};
  return `<div class="free-paste-targets"><strong>Bâtiments de l’analyse</strong>${(named.length?named:[{name:''}]).map(b=>{ const auto=fp.targets[b.name]??freePasteAutoTarget(b.name); fp.targets[b.name]=auto;
    return `<label><span>${escapeHtml(b.name||'Texte sans bâtiment')} →</span><select data-fp-target="${escapeHtml(b.name)}">${rows.map(r=>`<option value="${escapeHtml(r)}" ${r===auto?'selected':''}>${escapeHtml(r)}</option>`).join('')}<option value="" ${auto?'':'selected'}>Nouveau bâtiment « ${escapeHtml(b.name?canonicalBuilding(b.name):'Bâtiment unique')} »</option></select></label>`; }).join('')}</div>`;
}
function applyFreePaste(){
  const p=activeProject(); const vals=freePasteValues(freePaste).filter(v=>Object.keys(v.values).length);
  if(!vals.length){ toast('Aucune valeur rangée dans une colonne.','warn'); return; }
  // Lignes conservées (bâtiments créés si besoin) puis appliquées comme corrections manuelles, prioritaires.
  const chosen=freePaste.targets||{}; for(const v of vals){ const t=chosen[v.building]; if(t) v.building=t; }
  const prev=p.freePasteRows||[]; p.freePasteRows=[...prev.filter(r=>!vals.some(v=>v.building===r.building)),...vals];
  recomputeProject('');
  const rows=state.result?.rows||[]; const aliases=state.result?.buildingAliases||[];
  const target=name=>{ if(!name) return rows.length===1?rows[0].building:'Bâtiment unique'; const c=canonicalBuilding(name); return aliases.find(a=>a.source===name||a.source===c)?.target||rows.find(r=>r.building===name||r.building===c||normLower(r.building)===normLower(c))?.building||c; };
  let n=0; for(const v of vals){ const b=target(v.building); for(const [field,value] of Object.entries(v.values)){ const key=`${b}|${field}`; state.manualValues[key]=value; state.manualSources[key]={docId:'',fileName:'Collage libre',page:'',excerpt:v.sources[field]||'',method:'manual:free-paste',provenanceNote:'Données collées : prioritaires sur les documents'}; n++; } }
  applyManualValues(); $('#manualDataDialog')?.close(); freePaste=null; renderAll(); scheduleWorkspaceCheckpoint('collage libre',80);
  learn('manual_paste',{mode:'free',buildings:vals.length,values:n},p); toast(`${n} valeur(s) appliquée(s) sur ${vals.length} bâtiment(s) — prioritaires sur les documents.`,'success');
}
function applyManualPaste(){
  if(freePaste){ applyFreePaste(); return; }
  const raw=$('#manualDataPaste')?.value||''; const parsed=parseManualClipboard(raw);
  if(!parsed.recognized||!parsed.rows.length){ toast('Aucune ligne de données exploitable. Vérifiez les en-têtes et collez au moins une ligne de valeurs.','warn'); renderManualPastePreview(parsed); return; }
  if(importOperationRows(parsed.rows,{columns:parsed.columns.map(c=>({header:c.header,key:c.def?.key||null,matchMode:c.matchMode||''})),source:'copier-coller'})){ $('#manualDataDialog')?.close(); return; }
  state.manualPasteRaw=raw; state.manualPasteRows=parsed.rows; state.manualPasteColumns=parsed.columns.map(c=>({header:c.header,key:c.def?.key||null,matchMode:c.matchMode||''}));
  // Si le nom de l'opération est fourni manuellement et que le champ Projet actuel est vide, on le reprend comme titre de travail.
  const first=parsed.rows[0]?.values||{}; if(!$('#operationName').value.trim()&&(first.operation_name||first.operation)){ const op=String(first.operation_name||first.operation); $('#operationName').value=op; activeProject().operationName=op; }
  $('#manualDataDialog')?.close();
  learn('manual_paste',{rows:parsed.rows.length,recognizedColumns:parsed.columns.filter(c=>c.def).map(c=>({header:c.header,field:c.def.key,label:c.def.label,matchMode:c.matchMode||'exact',matchScore:c.matchScore||1})),unrecognizedHeaders:parsed.unrecognized||[]},activeProject());
  recomputeProject(`${parsed.rows.length} ligne(s) manuelle(s) intégrée(s) · ${parsed.recognized} colonne(s) reconnue(s).`);
}
function clearManualPaste(){
  state.manualPasteRaw=''; state.manualPasteRows=[]; state.manualPasteColumns=[]; activeProject().freePasteRows=[]; freePaste=null; const ta=$('#manualDataPaste'); if(ta) ta.value=''; renderManualPastePreview({rows:[],columns:[],unrecognized:[],recognized:0}); if(state.result) recomputeProject('Données manuelles copiées-collées supprimées.');
}
function uncertainKey(o){ return [o.building,o.field,String(o.value),o.docId,o.page].join('|'); }
function visibleUncertain(){ const rejected=new Set(state.uncertainRejectedKeys||[]); return (state.result?.uncertain||[]).filter(o=>!rejected.has(uncertainKey(o))&&!Object.prototype.hasOwnProperty.call(state.manualValues||{},`${o.building}|${o.field}`)); }
function showUncertainReview(){
  const dlg=$('#uncertainReviewDialog'),list=$('#uncertainReviewList'),apply=$('#uncertainReviewApply'); if(!dlg||!list||!apply) return;
  const candidates=visibleUncertain(), decisions=new Map();
  const groupKey=c=>`${c.building}|${c.field}`;
  const visibleIndexes=()=>candidates.map((c,i)=>({c,i})).filter(({c,i})=>{ const accepted=[...decisions.entries()].find(([j,d])=>d==='accept'&&groupKey(candidates[j])===groupKey(c)); return !accepted||accepted[0]===i; });
  const render=()=>{
    const shown=visibleIndexes();
    list.innerHTML=shown.length?shown.map(({c,i})=>{const d=decisions.get(i)||''; return `<article class="targeted-proposal ${d?`decision-${d}`:''}"><div class="targeted-proposal-main"><div class="targeted-field"><span>${escapeHtml(c.building)}</span><strong>${escapeHtml(FIELD_MAP[c.field]?.label||c.field)}</strong></div><div class="targeted-new-value">${escapeHtml(formatValue(c.value))}</div><div class="targeted-source">${escapeHtml(c.fileName)} · p.${c.page} · ${Math.round(c.confidence*100)} %</div><div class="targeted-excerpt">${escapeHtml(c.excerpt||'')}</div></div><div class="targeted-actions"><button data-u-accept="${i}" class="targeted-accept">✓</button><button data-u-reject="${i}" class="targeted-reject">✕</button></div></article>`;}).join(''):'<div class="empty-small">Aucun candidat entre 65 et 89 % à vérifier.</div>';
    const a=[...decisions.values()].filter(x=>x==='accept').length,r=[...decisions.values()].filter(x=>x==='reject').length; $('#uncertainReviewCount').textContent=`${a} acceptée(s) · ${r} refusée(s) · ${shown.filter(({i})=>!decisions.has(i)).length} à décider`; apply.disabled=a+r===0;
    $$('#uncertainReviewList [data-u-accept]').forEach(b=>b.onclick=()=>{ const i=Number(b.dataset.uAccept),g=groupKey(candidates[i]); for(const [j,d] of [...decisions]) if(j!==i&&d==='accept'&&groupKey(candidates[j])===g) decisions.delete(j); decisions.set(i,'accept'); render(); });
    $$('#uncertainReviewList [data-u-reject]').forEach(b=>b.onclick=()=>{decisions.set(Number(b.dataset.uReject),'reject');render();});
  };
  apply.onclick=()=>{
    let accepted=0;
    for(const [i,d] of decisions){
      const c=candidates[i]; if(!c) continue;
      learn('uncertain_decision',{decision:d,building:c.building,field:c.field,label:FIELD_MAP[c.field]?.label||c.field,value:c.value,confidence:c.confidence,source:{fileName:c.fileName,docType:c.docType||'',page:c.page,method:c.method||'',excerpt:c.excerpt||''}},activeProject());
      if(d==='reject'){ state.uncertainRejectedKeys=[...new Set([...(state.uncertainRejectedKeys||[]),uncertainKey(c)])]; continue; }
      if(d==='accept'){
        const key=`${c.building}|${c.field}`; state.manualValues[key]=c.value;
        state.manualSources[key]={docId:c.docId,fileName:c.fileName,page:c.page,excerpt:c.excerpt,method:'manual:uncertain-candidate-validated',provenanceNote:`Candidat ${Math.round(c.confidence*100)} % explicitement validé par l’utilisateur.`}; accepted++;
      }
    }
    applyManualValues(); dlg.close(); renderSummary(); renderOccurrences(); updateUxMirrors(); scheduleWorkspaceCheckpoint('validation candidats',80); toast(`${accepted} candidat(s) validé(s). Les candidats concurrents du même champ sont maintenant masqués.`,'success');
  };
  $('#uncertainReviewClose').onclick=()=>dlg.close(); render(); dlg.showModal();
}

function getAnalysisProfile(){
  const key=$('#analysisMode')?.value||DEFAULT_ANALYSIS_MODE;
  return ANALYSIS_MODES[key]||ANALYSIS_MODES[DEFAULT_ANALYSIS_MODE];
}

function executionModeFromUi(){
  const value=$('#executionMode')?.value||getExecutionMode();
  return CLOUD_MODES[value]?value:'auto';
}
function syncCloudModeUi(){
  const mode=executionModeFromUi(), cfg=CLOUD_MODES[mode]||CLOUD_MODES.auto;
  const detail=$('#cloudModeDetail'); if(detail) detail.textContent=mode==='auto'?'Calcul hybride automatique':mode==='remote'?'Calcul PDF sur serveur':'Calcul local uniquement';
  const status=$('#cloudExecutionStatus'); if(status) status.textContent=cfg.label;
}
async function refreshCloudUi(showError=false){
  const status=$('#cloudConnectionStatus'),detail=$('#cloudConnectionDetail'),btn=$('#cloudConnectionBtn');
  try{
    const session=await getCloudSession();
    if(status){ status.textContent=!session.configured?'Non configuré':session.connected?'Connecté':'Déconnecté'; status.classList.toggle('cloud-ok',!!session.connected); }
    if(detail){ detail.textContent=session.connected?`${session.user?.email||'Utilisateur Cloud'} · PDF temporaires supprimés après récupération.`:session.error?`Cloud indisponible : ${session.error}`:'Connectez un compte Supabase autorisé pour activer le traitement distant.'; }
    if(btn) btn.textContent=session.connected?'☁ Cloud connecté':'☁ Connexion Cloud';
    const signOut=$('#cloudSignOutBtn'),signIn=$('#cloudSignInBtn'); if(signOut) signOut.hidden=!session.connected; if(signIn) signIn.textContent=session.connected?'Reconnecter':'Se connecter';
    return session;
  }catch(err){
    if(status) status.textContent='Indisponible'; if(detail) detail.textContent=err?.message||String(err); if(showError) toast(`Cloud : ${err?.message||err}`,'warn');
    return {configured:cloudConfigured(),connected:false,user:null,error:err?.message||String(err)};
  }finally{ syncCloudModeUi(); }
}
async function openCloudDialog(){
  const dlg=$('#cloudDialog'); if(!dlg) return;
  const cfg=getCloudConfig(); $('#cloudSupabaseUrl').value=cfg.supabaseUrl||''; $('#cloudSupabaseKey').value=cfg.supabasePublishableKey||''; $('#cloudPassword').value=''; $('#cloudDialogFeedback').textContent='';
  const session=await refreshCloudUi(false); if(session?.user?.email&&!$('#cloudEmail').value) $('#cloudEmail').value=session.user.email;
  dlg.showModal();
}
async function signInCloudFromDialog(){
  const fb=$('#cloudDialogFeedback'); if(fb) fb.textContent='Connexion…';
  try{
    const email=$('#cloudEmail').value.trim(),password=$('#cloudPassword').value;
    if(!email||!password) throw new Error('Renseignez votre e-mail et votre mot de passe Cloud.');
    await cloudSignIn(email,password); $('#cloudPassword').value=''; if(fb){fb.textContent='Connexion Cloud réussie.';fb.className='journal-config-feedback success';} await refreshCloudUi(); toast('Cloud ExtracTerre connecté.','success');
  }catch(err){ if(fb){fb.textContent=err?.message||String(err);fb.className='journal-config-feedback error';} }
}
async function signOutCloudFromDialog(){
  try{ await cloudSignOut(); $('#cloudPassword').value=''; const fb=$('#cloudDialogFeedback'); if(fb){fb.textContent='Session Cloud fermée.';fb.className='journal-config-feedback';} await refreshCloudUi(); toast('Cloud ExtracTerre déconnecté.','info'); }
  catch(err){ toast(`Déconnexion Cloud impossible : ${err?.message||err}`,'error'); }
}
function saveCloudConfigFromDialog(){
  const cfg=saveCloudConfig({supabaseUrl:$('#cloudSupabaseUrl').value,supabasePublishableKey:$('#cloudSupabaseKey').value});
  const fb=$('#cloudDialogFeedback'); if(fb){fb.textContent=cfg.supabaseUrl&&cfg.supabasePublishableKey?'Configuration Cloud enregistrée.':'Configuration Cloud incomplète.';fb.className='journal-config-feedback';} refreshCloudUi();
}
function resetCloudConfigFromDialog(){
  const cfg=resetCloudConfig(); $('#cloudSupabaseUrl').value=cfg.supabaseUrl||''; $('#cloudSupabaseKey').value=cfg.supabasePublishableKey||''; const fb=$('#cloudDialogFeedback'); if(fb){fb.textContent='Configuration Cloud par défaut restaurée.';fb.className='journal-config-feedback';} refreshCloudUi();
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
async function yieldToBrowser(){
  if(globalThis.scheduler?.yield){ try{ await globalThis.scheduler.yield(); return; }catch{} }
  await new Promise(resolve=>setTimeout(resolve,0));
}

async function refreshProgressiveResults(reason='progression'){
  const valid=state.docs.filter(d=>d.status==='ready'&&Array.isArray(d.cachedOccurrences));
  if(!valid.length) return;
  const operation=$('#operationName')?.value?.trim?.()||activeProject().operationName||'';
  activeProject().operationName=operation;
  state.result=analyzeDocuments(valid,state.rules,operation,state.buildingOverrides,manualPasteOccurrences());
  applyDeletedBuildings(activeProject());
  state.result.documentsCount=valid.length;
  applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags);
  renderSummary(); renderResultWorkspaceControls(); updateUxMirrors();
  scheduleWorkspaceCheckpoint(`résultats progressifs · ${reason}`,350);
  await yieldToBrowser();
}

async function analyze(onlyIds=null,manualUnlimited=false){
  if(!state.docs.length&&!state.manualPasteRows.length&&!hasRetainedData()){ toast('Ajoutez au moins un document ou collez des données manuelles.','warn'); return; }
  $('#analyzeBtn').disabled=true;
  analysisControl.running=true; analysisControl.paused=false; analysisControl.stopRequested=false; analysisControl.controllers.clear(); resolveAnalysisPause(); syncAnalysisControlUi();
  const previouslyAnalyzed=state.docs.filter(d=>Array.isArray(d.cachedOccurrences)).length;
  const pendingDocs=state.docs.filter(d=>!!d.file&&d.status!=='ready'&&d.status!=='timeout'&&(!onlyIds||onlyIds.includes(d.id)));
  const alreadyReady=state.docs.length-pendingDocs.length;
  const ocrMode=$('#ocrMode')?.value||'auto';
  const executionMode=executionModeFromUi();
  const profile=getAnalysisProfile();
  const documentConcurrency=Math.max(1,Math.min(profile.documents,pendingDocs.length||1));
  let cloudFallbackWarned=false;
  syncCloudModeUi();
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
    const stage=meta?.stage==='ocr'?'OCR':meta?.stage==='ocr-wait'?'attente OCR':meta?.stage==='ocr-init'?'initialisation OCR':meta?.stage==='cloud-wait'?'Cloud · attente':meta?.stage==='cloud-create'?'Cloud · préparation':meta?.stage==='cloud-upload'?'Cloud · envoi':meta?.stage==='cloud-queue'||meta?.stage==='cloud-queued'?'Cloud · file GitHub':meta?.stage==='cloud-processing'?'Cloud · PDF/OCR':meta?.stage==='cloud-download'?'Cloud · récupération':meta?.stage==='cloud-done'?'Cloud · terminé':meta?.stage==='classification'?'classification':meta?.stage==='parsing'?'extraction métier':meta?.stage==='checkpoint'?'sauvegarde':'lecture';
    const latest=doc?` · ${doc.name} · ${stage}${page}`:'';
    setStatus(`${done}/${pendingDocs.length} terminés · ${activeIds.size} actifs · OCR ${pool.active}/${pool.max}${pool.waiting?` (+${pool.waiting} en file)`:''}${latest}`,Math.round(Math.max(0,Math.min(1,overall))*62));
    const eta=etaTracker.snapshot(forceEta);
    if(eta) updateEtaUi(eta,done,pendingDocs.length,activeIds.size,profile);
  };

  const processDocument=async d=>{
    activeIds.add(d.id); d.status='reading'; d.error=null; renderFiles(); updateParallelStatus(d,null,true);
    const controller=new AbortController(); analysisControl.controllers.set(d.id,controller);
    const noLimit=manualUnlimited||d.retryUnlimited===true; let timeoutTriggered=false, timeoutId=null;
    const started=performance.now();
    try{
      const remotePlanned=shouldUseCloudForFile(d.file,executionMode,ocrMode);
      d.remotePlanned=remotePlanned;
      d.processingLocation=null;
      d.cloudFallback=null;
      d.remoteAnalysis=null;
      const progress=(p,meta)=>{
        progressByDoc.set(d.id,Math.max(0,Math.min(1,p||0)));
        d.liveStage=meta?.stage||'reading'; updateParallelStatus(d,meta,false);
      };
      const readPromise=(async()=>{
        if(remotePlanned){
          const session=await getCloudSession();
          if(session.connected){
            try{
              d.processingLocation='remote';
              const remote=await analyzePdfInCloud(d.file,{ocrMode,onProgress:progress,signal:controller.signal});
              d.remoteAnalysis=remote.cloud;
              return remote.read;
            }catch(cloudErr){
              if(executionMode==='remote') throw cloudErr;
              d.cloudFallback=cloudErr?.message||String(cloudErr);
              d.processingLocation='local-fallback';
              if(!cloudFallbackWarned){ cloudFallbackWarned=true; toast(`Cloud indisponible : bascule locale automatique (${d.cloudFallback}).`,'warn'); }
              progress(.02,{stage:'reading',message:'Cloud indisponible · bascule locale'});
            }
          } else if(executionMode==='remote') {
            throw new Error('Mode Serveur sélectionné mais aucun compte Cloud n’est connecté.');
          } else {
            d.cloudFallback=session.error||'Compte Cloud non connecté';
            d.processingLocation='local-fallback';
          }
        }
        d.processingLocation=d.processingLocation||'local';
        return readFile(d.file,progress,{mode:ocrMode,lang:'fra+eng',signal:controller.signal});
      })();
      const timeoutMinutes=remotePlanned?30:5; d.analysisTimeoutMinutes=timeoutMinutes;
      if(noLimit) d.read=await readPromise;
      else d.read=await Promise.race([readPromise,new Promise((_,reject)=>{ timeoutId=setTimeout(()=>{ timeoutTriggered=true; controller.abort('analysis-timeout'); const e=new Error(`Analyse interrompue après ${timeoutMinutes} minutes.`); e.name='TimeoutError'; reject(e); },timeoutMinutes*60*1000); })]);
      progressByDoc.set(d.id,Math.max(progressByDoc.get(d.id)||0,.86));
      if(!(await waitForAnalysisGate())){ const e=new Error('Analyse arrêtée par l’utilisateur.'); e.name='AnalysisStopped'; throw e; }
      d.liveStage='classification'; updateParallelStatus(d,{stage:'classification'},true); await yieldToBrowser();
      d.classification=classifyForSelectedFamily(d);
      d.type=d.classification.type;
      d.buildings=detectBuildings(d);
      await yieldToBrowser();
      if(!(await waitForAnalysisGate())){ const e=new Error('Analyse arrêtée par l’utilisateur.'); e.name='AnalysisStopped'; throw e; }
      d.status='ready'; d.retryUnlimited=false;
      if(d.read?.ocr?.warnings?.length) d.ocrWarnings=d.read.ocr.warnings;
      try{
        progressByDoc.set(d.id,Math.max(progressByDoc.get(d.id)||0,.91));
        d.liveStage='parsing'; updateParallelStatus(d,{stage:'parsing'},true); await yieldToBrowser();
        d.cachedOccurrences=parseDocument(d); d.analysisCachedAt=Date.now();
        await yieldToBrowser();
        d.read=compactReadForRetention(d.read);
      }catch(parseErr){ console.warn('Pré-extraction checkpoint impossible',parseErr); d.cachedOccurrences=null; }
      d.analysisDurationMs=Math.round(performance.now()-started);
      progressByDoc.set(d.id,Math.max(progressByDoc.get(d.id)||0,.97));
      d.liveStage='checkpoint'; updateParallelStatus(d,{stage:'checkpoint'},true); await yieldToBrowser();
      await checkpointDocument(activeProject(),d);
      const extractedFields=[...new Set((d.cachedOccurrences||[]).map(o=>o.field).filter(Boolean))];
      const structuredThermalEvidence=(d.cachedOccurrences||[]).filter(o=>o.baoBreakdown||o.baoGes).map(o=>({field:o.field,value:o.value,page:o.page,breakdown:o.baoBreakdown||null,ges:o.baoGes||null,checks:o.baoChecks||null})).slice(0,12);
      learn('analysis_document',{docId:d.id,fileName:d.name,relativePath:d.relativePath||d.name,docType:d.type,sizeBytes:d.size,pageCount:d.read?.pageCount||0,durationMs:d.analysisDurationMs,ocrMode,executionMode,processingLocation:d.processingLocation||'local',cloudJobId:d.remoteAnalysis?.jobId||null,cloudWorkerVersion:d.remoteAnalysis?.workerVersion||null,cloudFallback:d.cloudFallback||null,ocrUsed:!!d.read?.ocr?.used,ocrPages:d.read?.ocr?.pages?.length||0,fieldsFound:extractedFields,fieldCount:extractedFields.length,occurrences:(d.cachedOccurrences||[]).length,...(structuredThermalEvidence.length?{structuredThermalEvidence}: {})},activeProject());
      // Les champs de ce document sont visibles immédiatement pendant que les autres continuent.
      await refreshProgressiveResults(d.name);
    }catch(e){
      const stopped=e?.name==='AnalysisStopped'||controller.signal.reason==='analysis-stop'||analysisControl.stopRequested;
      const timedOut=!stopped&&(timeoutTriggered||(controller.signal.aborted&&controller.signal.reason==='analysis-timeout'));
      if(stopped){ d.status=Array.isArray(d.cachedOccurrences)?'ready':'pending'; d.error=null; }
      else if(timedOut){ d.status='timeout'; d.error=`Analyse interrompue après ${d.analysisTimeoutMinutes||5} minutes. Relance manuelle disponible sans limite de temps.`; d.retryUnlimited=false; }
      else { d.status='error'; d.error=e?.message||String(e); }
      learn('analysis_error',{docId:d.id,fileName:d.name,relativePath:d.relativePath||d.name,status:d.status,error:d.error||e?.message||String(e),ocrMode,elapsedMs:Math.round(performance.now()-started)},activeProject());
    }finally{
      if(timeoutId) clearTimeout(timeoutId);
      analysisControl.controllers.delete(d.id);
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
          if(!(await waitForAnalysisGate())) return;
          const i=cursor++;
          if(i>=pendingDocs.length||analysisControl.stopRequested) return;
          await processDocument(pendingDocs[i]);
        }
      };
      await Promise.all(Array.from({length:documentConcurrency},()=>worker()));
      if(!analysisControl.stopRequested) etaTracker.persist(pendingDocs.length);
    }
    const valid=state.docs.filter(d=>d.status==='ready');
    if(!valid.length && !state.result) throw new Error('Aucun document n’a pu être lu.');
    if(valid.length){
      const eta=$('#analysisEtaDetail'); if(eta) eta.textContent='Lecture terminée · consolidation des données…';
      setStatus('Extraction métier et consolidation…',72); await yieldToBrowser();
      const operation=$('#operationName').value.trim(); activeProject().operationName=operation; state.result=analyzeDocuments(valid,state.rules,operation,state.buildingOverrides,manualPasteOccurrences()); state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags);
      setStatus('Contrôles de cohérence…',92); await yieldToBrowser();
    }
    renderAll();
    if(analysisControl.stopRequested){ await checkpointWorkspace('analyse arrêtée',true); setStatus('Analyse arrêtée — résultats trouvés conservés'); }
    else { await checkpointWorkspace('analyse terminée',true); setStatus('Analyse terminée',100); }
    const elapsed=(performance.now()-etaTracker.startedAt)/1000;
    const completeness=state.result?.completeness||null;
    const missingFields=[...new Set((completeness?.checks||[]).flatMap(c=>c.missing||[]))];
    learn('analysis_batch',{documents:state.docs.length,readyDocuments:state.docs.filter(d=>d.status==='ready').length,newDocuments:pendingDocs.length,durationMs:Math.round(elapsed*1000),analysisMode:profile.key,analysisProfile:profile.description,executionMode,remoteDocuments:pendingDocs.filter(d=>d.processingLocation==='remote').length,localFallbackDocuments:pendingDocs.filter(d=>d.processingLocation==='local-fallback').length,ocrMode,completeness:completeness?{percent:completeness.percent,found:completeness.found,expected:completeness.expected}:null,missingFields,missingLabels:missingFields.map(k=>FIELD_MAP[k]?.label||k),alerts:state.result?.alerts?.map(a=>({level:a.level,message:a.message,fileName:a.fileName||''})).slice(0,100)||[]},activeProject());
    const eta=$('#analysisEtaDetail'); if(eta) eta.textContent=analysisControl.stopRequested?`Analyse arrêtée après ${formatAnalysisDuration(elapsed)} · résultats partiels conservés`:`Analyse terminée en ${formatAnalysisDuration(elapsed)}`;
    if(!analysisControl.stopRequested) setTimeout(()=>$('#progress').hidden=true,900);
    const timedOut=state.docs.filter(d=>d.status==='timeout').length;
    toast(`${state.result?.newlyParsedCount||0} nouveau${state.result?.newlyParsedCount===1?'':'x'} document${state.result?.newlyParsedCount===1?'':'s'} analysé${state.result?.newlyParsedCount===1?'':'s'} ; ${state.result?.reusedParsedCount||previouslyAnalyzed} document(s) réutilisé(s)${timedOut?` ; ${timedOut} fichier(s) mis de côté après 5 min`:''}.`,timedOut?'warn':'success');
  }catch(e){ toast(e.message||String(e),'error'); setStatus('Analyse interrompue'); const eta=$('#analysisEtaDetail'); if(eta) eta.textContent='Estimation interrompue'; }
  finally{ analysisControl.running=false; analysisControl.paused=false; resolveAnalysisPause(); analysisControl.controllers.clear(); syncAnalysisControlUi(); $('#analyzeBtn').disabled=false; }
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

function showTargetedReview(doc,candidates,ocrMeta,opts={}){
  const dlg=$('#targetedReviewDialog'), list=$('#targetedReviewList'), title=$('#targetedReviewTitle'), sub=$('#targetedReviewSub'), apply=$('#targetedReviewApply'), close=$('#targetedReviewClose');
  if(!dlg||!list) return;
  const decisions=new Map(),logged=new Set();
  title.textContent=opts.title||`Crible fin — ${doc.name}`;
  sub.textContent=opts.sub||`${candidates.length} information(s) nouvelle(s) trouvée(s). OCR maximal sur ${ocrMeta?.pages?.length||0} page(s). Aucune valeur existante n’est remplacée automatiquement : chaque proposition reste soumise à ✓ / ✕.`;
  const render=()=>{
    list.innerHTML=candidates.map((c,i)=>{ const decision=decisions.get(i)||''; const def=FIELD_MAP[c.field]; return `<article class="targeted-proposal ${decision?`decision-${decision}`:''}" data-targeted-index="${i}"><div class="targeted-proposal-main"><div class="targeted-field"><span>${escapeHtml(c.building)}</span><strong>${escapeHtml(def?.label||c.field)}</strong></div><div class="targeted-new-value">${escapeHtml(formatValue(c.value))}${c.unit?` <small>${escapeHtml(c.unit)}</small>`:''}</div><div class="targeted-source">p.${c.page} · confiance moteur ${Math.round((c.confidence||0)*100)} % · ${escapeHtml(c.method||'OCR')}</div><div class="targeted-excerpt">${escapeHtml(c.excerpt||'')}</div></div><div class="targeted-actions"><button class="targeted-accept" data-targeted-accept="${i}" title="Accepter">✓</button><button class="targeted-reject" data-targeted-reject="${i}" title="Refuser">✕</button></div></article>`; }).join('');
    const accepted=[...decisions.values()].filter(x=>x==='accept').length, rejected=[...decisions.values()].filter(x=>x==='reject').length;
    $('#targetedReviewCount').textContent=`${accepted} acceptée(s) · ${rejected} refusée(s) · ${candidates.length-accepted-rejected} à décider`;
    apply.disabled=accepted===0; apply.textContent=accepted?`Appliquer ${accepted} valeur${accepted>1?'s':''} acceptée${accepted>1?'s':''}`:'Appliquer les valeurs acceptées';
    $$('#targetedReviewList [data-targeted-accept]').forEach(b=>b.onclick=()=>{ decisions.set(Number(b.dataset.targetedAccept),'accept'); render(); });
    $$('#targetedReviewList [data-targeted-reject]').forEach(b=>b.onclick=()=>{ decisions.set(Number(b.dataset.targetedReject),'reject'); render(); });
  };
  const logDecision=(c,decision)=>{
    const key=`${targetedCandidateKey(c)}|${decision}`; if(logged.has(key)) return; logged.add(key);
    learn('targeted_decision',{decision,docId:doc.id,fileName:doc.name,docType:doc.type,building:c.building,field:c.field,label:FIELD_MAP[c.field]?.label||c.field,value:c.value,confidence:c.confidence,page:c.page,method:c.method||'',excerpt:c.excerpt||'',ocrPages:ocrMeta?.pages?.length||0},activeProject());
  };
  const persistRejected=()=>{
    const rejected=candidates.filter((_,i)=>decisions.get(i)==='reject');
    if(rejected.length){ doc.targetedRejectedKeys=[...new Set([...(doc.targetedRejectedKeys||[]),...rejected.map(targetedCandidateKey)])]; rejected.forEach(c=>logDecision(c,'reject')); }
  };
  render();
  close.onclick=()=>{ persistRejected(); scheduleWorkspaceCheckpoint('refus réanalyse ciblée',80); dlg.close(); };
  dlg.oncancel=()=>{ persistRejected(); scheduleWorkspaceCheckpoint('refus réanalyse ciblée',80); };
  apply.onclick=async()=>{
    const accepted=candidates.filter((_,i)=>decisions.get(i)==='accept');
    persistRejected(); accepted.forEach(c=>logDecision(c,'accept'));
    if(accepted.length){
      const existing=Array.isArray(doc.cachedOccurrences)?doc.cachedOccurrences:[];
      const additions=accepted.map(c=>({...c,docId:doc.id,fileName:doc.name,docType:doc.type,confidence:1,method:`targeted-ocr:max:user-validated:${c.method||'parser'}`,userValidated:true,targetedOcr:true,origin:`${doc.type} — OCR maximal validé`,provenanceNote:'Valeur issue d’une réanalyse OCR maximale et explicitement acceptée par l’utilisateur.'}));
      const seen=new Set(existing.map(x=>[x.field,x.building,String(x.value),x.page,x.method].join('|')));
      for(const a of additions){ const k=[a.field,a.building,String(a.value),a.page,a.method].join('|'); if(!seen.has(k)){ existing.push(a); seen.add(k); } }
      doc.cachedOccurrences=existing;
      const valid=state.docs.filter(x=>x.status==='ready');
      state.result=analyzeDocuments(valid,state.rules,$('#operationName').value.trim(),state.buildingOverrides,manualPasteOccurrences()); applyDeletedBuildings(activeProject()); state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags); state.selfTests=runSelfTests();
      toast(`${accepted.length} nouvelle${accepted.length>1?'s':''} valeur${accepted.length>1?'s':''} validée${accepted.length>1?'s':''} et ajoutée${accepted.length>1?'s':''} au tableau.`,'success');
      renderAll(); await checkpointDocument(activeProject(),doc);
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
    const classification=classifyForSelectedFamily({...doc,read:highRead});
    const tempDoc={...doc,read:highRead,classification,type:classification.type,cachedOccurrences:null}; tempDoc.buildings=detectBuildings(tempDoc);
    const parsed=parseDocument(tempDoc);
    const candidates=buildTargetedCandidates(doc,tempDoc,parsed);
    doc.targetedLastAt=Date.now(); doc.targetedLastProposals=candidates.length; doc.targetedLastOcrPages=highRead.ocr?.pages?.length||0;
    learn('targeted_scan',{docId:doc.id,fileName:doc.name,docType:doc.type,ocrPages:doc.targetedLastOcrPages,proposals:candidates.length,candidateFields:candidates.map(c=>c.field)},activeProject());
    setStatus(`Crible fin terminé — ${candidates.length} proposition(s)`,100); setTimeout(()=>$('#progress').hidden=true,900);
    await checkpointWorkspace('réanalyse ciblée',true);
    if(!candidates.length){ toast('Aucune nouvelle valeur exploitable trouvée pour les champs actuellement vides.','info'); }
    else showTargetedReview(doc,candidates,highRead.ocr);
  }catch(e){ console.error('Fine scan OCR error',e); learn('analysis_error',{scope:'targeted_scan',docId:doc.id,fileName:doc.name,docType:doc.type,error:e?.message||String(e)},activeProject()); toast(`Crible fin impossible : ${e?.message||e}`,'error'); setStatus('Crible fin interrompu'); }
  finally{ doc.targetedStatus=null; renderFiles(); }
}

function projectSectionHeader(p,isActive=false){
  const r=p.result; const title=escapeHtml(projectTitle(p)); const docs=(p.docs||[]).length, bats=r?.rows?.length||0;
  return `<div class="project-section-head"><button class="project-toggle" data-project-toggle="${p.id}" title="Réduire/agrandir">${p.expanded?'▾':'▸'}</button><div class="project-section-title"><strong>${title}</strong><small>${docs} document(s) · ${bats} bâtiment(s)${isActive?' · projet actif':''}</small></div><button class="icon-btn project-rename" data-project-rename="${p.id}" title="Renommer le projet" aria-label="Renommer le projet">✎</button><button class="icon-btn project-delete" data-project-delete="${p.id}" title="Supprimer le projet" aria-label="Supprimer le projet">🗑</button>${isActive?'<span class="badge ok">Actif</span>':`<button class="btn light project-activate" data-project-activate="${p.id}">Ouvrir / modifier</button>`}</div>`;
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
  $$('#summaryView [data-project-delete]').forEach(b=>b.onclick=e=>{e.stopPropagation();deleteProject(b.dataset.projectDelete);});
  $$('#summaryView [data-project-activate]').forEach(b=>b.onclick=()=>activateProject(b.dataset.projectActivate));
}



function renderSummary(){
  const r=state.result; const wrap=$('#summaryView'); const view=currentResultView(); const groups=view.groups.map(g=>({...g,fields:fieldsForResultGroup(g)})).filter(g=>g.fields.length); const fields=fieldsForCurrentResultView(); syncResultTabs(); syncStickyResultTabs();
  if(state.resultWorkspaceMode==='overview'){ renderTiles(wrap); renderResultWorkspaceControls(); return; }
  if(r&&normalizedResultViewKey(activeProject().resultView)==='review'){ renderProfileSwitch(); renderReview(); return; }
  if(normalizedResultViewKey(activeProject().resultView)==='economics'){ renderEconomic(wrap); renderResultWorkspaceControls(); return; }
  if(normalizedResultViewKey(activeProject().resultView)==='searches'){ renderSearches(wrap); renderResultWorkspaceControls(); return; }
  if(!r){ wrap.innerHTML='<div class="empty-state"><div class="empty-ico">⌁</div><h3>Nouveau projet prêt à analyser</h3><p>Ajoutez vos PDF, XML ou tableaux Excel, ou collez directement une ligne Excel dans Données manuelles.</p></div>'; renderResultWorkspaceControls(); return; }
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
  wrap.innerHTML=`<div class="project-detail-banner"><div><h3>${escapeHtml(projectTitle(activeProject()))}</h3><small>${(activeProject().docs||[]).length} document(s) · ${r.rows?.length||0} bâtiment(s)</small></div><button id="detailBackOverview" type="button">← Synthèse projets</button></div><div class="kpis"><div class="kpi"><b>${r.documentsCount}</b><span>documents lus</span></div><div class="kpi"><b>${r.buildings.length}</b><span>bâtiments consolidés</span></div><div class="kpi"><b>${r.finals.length}</b><span>valeurs retenues</span></div><div class="kpi ${r.alerts.length?'alert':''}"><b>${r.alerts.length}</b><span>alertes</span></div></div><div class="completeness-strip"><div><span>Analyse technique terminée</span><strong>Complétude : ${escapeHtml(compText)}</strong></div>${uncertainCount?`<button class="btn secondary" id="reviewUncertainBtn">✓/✕ Vérifier ${uncertainCount} candidat${uncertainCount>1?'s':''} (65–89 %)</button>`:'<span class="badge ok">Aucun candidat incertain</span>'}</div>${tagPanel}<div class="edit-hint"><b>Seuil automatique : 90 %.</b> Les candidats de ${Math.round(MIN_REVIEW_CONFIDENCE*100)} à 89 % sont conservés pour validation ✓/✕. L’ordre des sources est appliqué avant le score de confiance.${ownerBetaEnabled()?' <span class="beta-owner-hint">Mode bêta propriétaire : utilisez ✕ pour signaler un résultat erroné.</span>':''}</div><div class="building-merge-bar"><div><button class="btn secondary" id="mergeBuildingsBtn" disabled>⇄ Fusionner les bâtiments sélectionnés</button><button class="btn danger-light" id="deleteBuildingsBtn" disabled>⌫ Supprimer les bâtiments sélectionnés</button><button class="btn light" id="resetBuildingLinksBtn" ${hasManual?'':'disabled'}>Réinitialiser les fusions manuelles</button></div><small>Ex. « Bât A », « Bâtiment A » et « BAT A » sont fusionnés automatiquement. « B » et « B1 » nécessitent une validation manuelle.</small></div>${groupingInfo}${suggestionInfo}${groups.map((group,groupIndex)=>`<section class="result-data-group"><div class="result-data-group-head"><h3>${escapeHtml(group.title)}</h3><span>${group.fields.length} donnée${group.fields.length>1?'s':''}</span></div><div class="table-scroll"><table><thead><tr><th class="sticky building-head">${groupIndex===0?'<label><input type="checkbox" id="selectAllBuildings"> Bâtiment</label>':'Bâtiment'}</th>${group.fields.map(f=>`<th title="${escapeHtml(f.family)}">${escapeHtml(f.label)}</th>`).join('')}</tr></thead><tbody>${r.rows.map(row=>`<tr><td class="sticky strong building-cell">${groupIndex===0?`<label><input type="checkbox" class="building-select" value="${escapeHtml(row.building)}"> <span>${escapeHtml(row.building)}</span></label>`:escapeHtml(row.building)}</td>${group.fields.map(f=>{const v=row[f.key]; const o=r.finals.find(x=>x.field===f.key&&(x.building===row.building||x.building==='Bâtiment unique')); const title=o?`${o.fileName} · p.${o.page} · confiance ${Math.round(o.confidence*100)}%${o.originalBuilding&&o.originalBuilding!==o.building?' · source : '+o.originalBuilding:''}${o.provenanceNote?' · '+o.provenanceNote:''}`:'Double-cliquez pour corriger'; return `<td class="summary-value ${v===undefined?'missing':''} ${o?.libraryDerived?'from-library':''}" data-building="${escapeHtml(row.building)}" data-field="${f.key}" title="${escapeHtml(title)}">${escapeHtml(formatValue(v))}<button class="cell-edit summary-edit" data-building="${escapeHtml(row.building)}" data-field="${f.key}" title="Modifier manuellement">✎</button>${ownerBetaEnabled()?`<button class="cell-beta-error ${v===undefined?'cell-beta-missing':''}" data-building="${escapeHtml(row.building)}" data-field="${f.key}" title="${v===undefined?'Renseigner cette donnée depuis un document':'Corriger cette donnée depuis un document'}" aria-label="${v===undefined?'Renseigner une donnée manquante':'Signaler une erreur'}">${v===undefined?'＋':'✕'}</button>`:''}${o?`<span class="mini-conf ${o.confidence>=.9?'high':o.confidence>=.7?'mid':'low'}">${Math.round(o.confidence*100)}%</span>`:''}${o?.libraryDerived?'<span class="library-tag">bibliothèque</span>':''}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('')}${libraryNotes.length?`<div class="library-notes"><b>Valeurs complétées depuis la bibliothèque isolants</b>${libraryNotes.map(o=>`<div><strong>${escapeHtml(o.building)} — ${escapeHtml(FIELD_MAP[o.field]?.label||o.field)} :</strong> ${escapeHtml(o.provenanceNote)}</div>`).join('')}</div>`:''}`;

  $$('#summaryView .summary-value').forEach(td=>td.ondblclick=()=>manualOverride(td.dataset.building,td.dataset.field)); $$('#summaryView .summary-edit').forEach(b=>b.onclick=e=>{e.stopPropagation();manualOverride(b.dataset.building,b.dataset.field)});
  $$('#summaryView .cell-beta-error').forEach(b=>b.onclick=e=>{e.stopPropagation();openBetaErrorDialog(b.dataset.building,b.dataset.field)});
  const selected=()=>$$('#summaryView .building-select:checked').map(x=>x.value);
  const refreshBuildingActionButtons=()=>{ const n=selected().length, merge=$('#mergeBuildingsBtn'), del=$('#deleteBuildingsBtn'); if(merge) merge.disabled=n<2; if(del) del.disabled=n<1; };
  $$('#summaryView .building-select').forEach(cb=>cb.onchange=refreshBuildingActionButtons);
  const all=$('#selectAllBuildings'); if(all) all.onchange=()=>{ $$('#summaryView .building-select').forEach(cb=>cb.checked=all.checked); refreshBuildingActionButtons(); };
  const merge=$('#mergeBuildingsBtn'); if(merge) merge.onclick=()=>mergeSelectedBuildings(selected());
  const del=$('#deleteBuildingsBtn'); if(del) del.onclick=()=>deleteSelectedBuildings(selected());
  const reset=$('#resetBuildingLinksBtn'); if(reset) reset.onclick=resetBuildingLinks;
  $$('#summaryView .building-suggestion').forEach(b=>b.onclick=()=>mergeSelectedBuildings([b.dataset.a,b.dataset.b]));
  const addTag=()=>{ const inp=$('#projectTagInput'); const label=(inp?.value||'').trim(); if(!label) return; if(!state.manualTags.some(x=>x.toLowerCase()===label.toLowerCase())) state.manualTags.push(label); if(inp) inp.value=''; state.projectTags=buildProjectTags(state.docs.filter(d=>d.status==='ready'),state.result,state.manualTags); renderSummary(); scheduleWorkspaceCheckpoint('tag manuel'); };
  const addTagBtn=$('#addProjectTagBtn'); if(addTagBtn) addTagBtn.onclick=addTag;
  const tagInp=$('#projectTagInput'); if(tagInp) tagInp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addTag();}});
  $$('#summaryView .remove-project-tag').forEach(b=>b.onclick=()=>{ const t=state.projectTags[Number(b.dataset.tagIndex)]; if(t?.manual) state.manualTags=state.manualTags.filter(x=>x!==t.label); state.projectTags=buildProjectTags(state.docs.filter(d=>d.status==='ready'),state.result,state.manualTags); renderSummary(); scheduleWorkspaceCheckpoint('suppression tag'); }); const reviewBtn=$('#reviewUncertainBtn'); if(reviewBtn) reviewBtn.onclick=showUncertainReview; const back=$('#detailBackOverview'); if(back) back.onclick=showProjectsOverview; renderResultWorkspaceControls();
}


// v2.4.0 — Profil d'opération (construction neuve / rénovation) et vue « Revue » : une fiche par bâtiment, lisible champ par
// champ (valeur, état, source), filtrable (à compléter / à vérifier / renseigné), corrigeable sur place, avec les candidats
// proposés et l'accès direct au document. Le profil masque les champs qui n'ont pas de sens pour l'opération ; l'export
// Excel reste complet.
const PROFILE_NEW_ONLY=new Set(['bbio','bbio_max','bbio_gain','cepnr','cepnr_max','cepnr_gain','dh','dh_max','fan_count','fan_type','cep_mobility','ic_components','ic_site','stock_c_per_m2',
  ...Array.from({length:13},(_,i)=>`ic_lot_${i+1}`),'ic_energy','ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility','ic_construction','ic_construction_max','ic_construction_max_2028','ic_energy_max','ic_energy_max_2028',
  'bbio_level','cepnr_level','ic_construction_level','ic_energy_level','biosourced_2013','mention_ec','derogation_ec','effinergie_energy_carbon_level']);
const PROFILE_RENO_ONLY=new Set(['ubat_before','ubat_after','cep_before','cep_after_final','dpe_energy_before','dpe_ges_before','dpe_energy_after','dpe_ges_after','heating_vector_before','ecs_vector_before','ventilation_before','ges_before','built_before_1948','built_after_1948','renovation']);
const RENO_DOC_TYPES=new Set([DOC_TYPES.RT_EXISTING,DOC_TYPES.DPE,DOC_TYPES.DIAGNOSTIC]);
const NEW_DOC_TYPES=new Set([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSENV]);
function autoProfile(p=activeProject()){
  const types=(p?.docs||[]).map(d=>d.type); const reno=types.filter(t=>RENO_DOC_TYPES.has(t)).length, neuf=types.filter(t=>NEW_DOC_TYPES.has(t)).length;
  if(reno||neuf) return reno>=neuf?'reno':'neuf';
  const rows=p?.result?.rows||[]; return rows.some(r=>['ubat_before','cep_before','dpe_energy_before'].some(k=>r[k]!==undefined))?'reno':'neuf';
}
function projectProfile(p=activeProject()){ return p?.profile==='neuf'||p?.profile==='reno'?p.profile:autoProfile(p); }
function fieldInProfile(key,profile=projectProfile()){ return profile==='reno'?!PROFILE_NEW_ONLY.has(key):!PROFILE_RENO_ONLY.has(key); }
function setProjectProfile(value){ const p=activeProject(); p.profile=value==='auto'?'':value; renderSummary(); renderProfileSwitch(); scheduleWorkspaceCheckpoint('profil opération',80); }
function renderProfileSwitch(){ const box=$('#profileSwitch'); if(!box) return; const p=activeProject(), cur=projectProfile(p), auto=!p.profile;
  box.innerHTML=`<span class="profile-switch-label">Opération</span>${[['neuf','Neuf'],['reno','Rénovation']].map(([k,l])=>`<button type="button" class="profile-opt ${cur===k?'active':''}" data-profile="${k}" aria-pressed="${cur===k}">${l}</button>`).join('')}<button type="button" class="profile-auto ${auto?'active':''}" data-profile="auto" title="Détecté d’après les documents">${auto?'auto':'auto ↺'}</button>`;
  box.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>setProjectProfile(b.dataset.profile)); }

// Groupes de la revue, dans l'ordre d'usage : technique d'abord, données administratives en fin de fiche.
const REVIEW_GROUPS=Object.freeze([
  {title:'Programme',keys:['housing_count','shab','housing_typologies','construction_year','built_before_1948','built_after_1948','department','structure']},
  {title:'Performance énergétique',keys:['cep_before','cep_after_final','cep','cep_max','cep_gain','ubat_before','ubat_after','ubat_ref','ubat_gain','ges_before','ges','ges_ref','ges_gain','bbio','bbio_max','bbio_gain','cepnr','cepnr_max','cepnr_gain']},
  {title:'Étiquettes DPE',keys:['dpe_energy_before','dpe_ges_before','dpe_energy_after','dpe_ges_after']},
  {title:'Confort d’été',keys:['tic','tic_ref','dh','dh_max','cross_ventilated','non_cross_ventilated','fan_count','fan_type']},
  {title:'Systèmes',keys:['heating_vector_before','heating_vector_after','heating_mode_after','ecs_vector_before','ecs_vector_after','ecs','cooling','ventilation_before','ventilation','enr','enr_type']},
  {title:'Enveloppe',keys:['wall_structure','wall_insulation','wall_insulation_thickness','wall_insulation_r','roof_structure','roof_insulation','roof_insulation_thickness','roof_insulation_r','floor_structure','floor_insulation','floor_insulation_thickness','floor_insulation_r','window_material','window_glazing','window_shading']},
  {title:'Consommations par poste',keys:['cep_cooling','cep_lighting','cep_aux_vent','cep_aux_dist','cep_mobility','cep_electricity','cep_gas','cep_district','cep_biomass']},
  {title:'Carbone',optional:'reno',keys:['ic_construction','ic_construction_max','ic_construction_max_2028','ic_energy','ic_energy_max','ic_energy_max_2028','ic_components','ic_site','stock_c_per_m2','eges_total','eges_pce','eges_pcena','eges_energy','eges_site','eges_water','eges_total_max']},
  {title:'Données administratives',admin:true,families:['Administration'],keys:['reference_name','reference_version','mentions','performance','selected_profile','specific_profile','renovation','mention_effinergie','mention_bbca','mention_biosourced_building']}
]);
let reviewState={building:'',filter:'todo',query:'',editing:'',openAdmin:false};
const isBlank=v=>v===undefined||v===null||v===''||v==='non précisé';
function reviewFields(group,profile){ const keys=[...(group.keys||[]),...(group.families?FIELD_DEFS.filter(f=>group.families.includes(f.family)).map(f=>f.key):[])]; return [...new Set(keys)].map(k=>FIELD_MAP[k]).filter(f=>f&&fieldInProfile(f.key,profile)); }
function reviewEntry(building,def){
  const r=state.result, row=r?.rows?.find(x=>x.building===building); const v=row?.[def.key];
  const src=r?.finals?.find(o=>o.field===def.key&&o.building===building)||r?.finals?.find(o=>o.field===def.key&&o.building==='Bâtiment unique');
  const manual=Object.prototype.hasOwnProperty.call(state.manualValues||{},`${building}|${def.key}`);
  const cands=visibleUncertain().filter(o=>o.field===def.key&&(o.building===building||o.building==='Bâtiment unique')).sort((a,b)=>b.confidence-a.confidence);
  if(isBlank(v)&&!(reviewState.dismissed||[]).includes(`${building}|${def.key}`)){ const d=derivedProposal(row,def.key); if(d) cands.unshift({...d,building}); }
  const status=!isBlank(v)?(manual?'manual':'ok'):cands.length?'review':'missing';
  return {def,v,src,manual,cands,status};
}
// Propositions calculées depuis d'autres champs du même bâtiment (jamais retenues sans validation).
function derivedProposal(row,key){
  if(!row) return null; const y=Number(row.construction_year); const mk=(value,why)=>({synthetic:true,field:key,value,fileName:why,page:'',confidence:1,docId:'',excerpt:why});
  if(key==='built_before_1948'&&y>1000) return mk(y<1948?'Oui':'Non',`Déduit de l’année de construction (${y})`);
  if(key==='built_after_1948'&&y>1000) return mk(y>=1948?'Oui':'Non',`Déduit de l’année de construction (${y})`);
  if(key==='cep_gain'&&Number(row.cep_max)>0&&Number.isFinite(Number(row.cep))) return mk(Math.round((row.cep_max-row.cep)/row.cep_max*1000)/10,`(Cep Ref − Cep) / Cep Ref = (${row.cep_max} − ${row.cep}) / ${row.cep_max}`);
  if(key==='renovation'&&(row.cep_before!==undefined||row.ubat_before!==undefined)) return mk('Oui','Étude avec état initial (Cep / Ubat avant travaux)');
  return null;
}
function reviewBuildings(){ return (state.result?.rows||[]).map(r=>r.building); }
function reviewCompletion(building,profile){ const defs=REVIEW_GROUPS.filter(g=>!g.admin&&g.optional!==profile).flatMap(g=>reviewFields(g,profile)); const filled=defs.filter(d=>!isBlank(state.result?.rows?.find(x=>x.building===building)?.[d.key])).length; return {filled,total:defs.length,pct:defs.length?Math.round(filled/defs.length*100):0}; }
function setManualValue(building,field,raw,meta=null){
  const def=FIELD_MAP[field]; if(!def) return false; let value=String(raw??'').trim();
  if(def.type==='number'){ if(value===''){ return false; } const n=parseFrNumber(value); if(n===null){ toast(`« ${value} » n’est pas un nombre valable pour ${def.label}.`,'error'); return false; } value=n; }
  else if(field==='window_glazing') value=normalizeGlazingType(value)||value;
  if(value==='') return false;
  const key=`${building}|${field}`, previous=state.result?.rows?.find(r=>r.building===building)?.[field];
  state.manualValues[key]=value; if(meta) state.manualSources[key]=meta; else delete state.manualSources[key];
  learn('manual_override',{building,field,label:def.label,previousValue:previous??null,newValue:value,source:meta?.method||'review_inline_edit'},activeProject());
  applyManualValues(); return true;
}
function acceptCandidate(c){ if(c.synthetic){ setManualValue(c.building==='Bâtiment unique'?reviewState.building:(c.building||reviewState.building),c.field,c.value,{docId:'',fileName:'Valeur déduite',page:'',excerpt:c.excerpt,method:'manual:derived-validated',provenanceNote:c.excerpt}); return; } const key=`${c.building==='Bâtiment unique'?reviewState.building:c.building}|${c.field}`; state.manualValues[key]=c.value;
  state.manualSources[key]={docId:c.docId,fileName:c.fileName,page:c.page,excerpt:c.excerpt,method:'manual:uncertain-candidate-validated',provenanceNote:`Candidat ${Math.round(c.confidence*100)} % validé dans la revue.`};
  learn('uncertain_decision',{decision:'accept',building:c.building,field:c.field,label:FIELD_MAP[c.field]?.label||c.field,value:c.value,confidence:c.confidence,source:{fileName:c.fileName,page:c.page,method:c.method||'',excerpt:c.excerpt||''}},activeProject());
  applyManualValues(); }
function rejectCandidate(c){ if(c.synthetic){ reviewState.dismissed=[...new Set([...(reviewState.dismissed||[]),`${reviewState.building}|${c.field}`])]; return; } state.uncertainRejectedKeys=[...new Set([...(state.uncertainRejectedKeys||[]),uncertainKey(c)])]; learn('uncertain_decision',{decision:'reject',building:c.building,field:c.field,value:c.value,confidence:c.confidence,source:{fileName:c.fileName,page:c.page}},activeProject()); }
function copyToOtherBuildings(building,field){
  const row=state.result?.rows?.find(r=>r.building===building); const v=row?.[field]; if(isBlank(v)) return 0; let n=0;
  for(const b of reviewBuildings()) if(b!==building&&isBlank(state.result.rows.find(r=>r.building===b)?.[field])){ state.manualValues[`${b}|${field}`]=v; state.manualSources[`${b}|${field}`]={docId:'',fileName:'Copie entre bâtiments',page:'',excerpt:`Valeur reprise de ${building}`,method:'manual:copy-building',provenanceNote:`Copié depuis ${building}.`}; n++; }
  if(n){ learn('manual_copy_between_buildings',{field,from:building,count:n,value:v},activeProject()); applyManualValues(); } return n; }
function reviewAfterChange(msg){ renderReview(); renderOccurrences(); updateUxMirrors(); scheduleWorkspaceCheckpoint('revue',80); if(msg) toast(msg,'success'); }

function renderReview(){
  const wrap=$('#summaryView'); const r=state.result; if(!wrap||!r) return;
  const profile=projectProfile(); const buildings=reviewBuildings();
  if(!buildings.includes(reviewState.building)) reviewState.building=buildings[0]||'';
  const B=reviewState.building; const q=normLower(reviewState.query||'');
  const groups=REVIEW_GROUPS.map(g=>({...g,entries:reviewFields(g,profile).map(d=>reviewEntry(B,d))})).filter(g=>g.entries.length);
  const all=groups.filter(g=>!g.admin&&g.optional!==profile).flatMap(g=>g.entries); const count=s=>all.filter(e=>s.includes(e.status)).length;
  const pass=e=>(reviewState.filter==='all'||(reviewState.filter==='todo'&&['missing','review'].includes(e.status))||(reviewState.filter==='review'&&e.status==='review')||(reviewState.filter==='done'&&['ok','manual'].includes(e.status)))&&(!q||normLower(e.def.label).includes(q)||normLower(formatValue(e.v)).includes(q));
  const pill={ok:'Retenu',manual:'Saisi',review:'À vérifier',missing:'À compléter'};
  const srcText=e=>e.manual?(state.manualSources?.[`${B}|${e.def.key}`]?.fileName||'Saisie manuelle'):e.src?`${e.src.fileName}${e.src.page?` · p. ${e.src.page}`:''}`:'';
  const conf=e=>e.src&&!e.manual&&Number.isFinite(e.src.confidence)?`<span class="rv-conf ${e.src.confidence>=.9?'high':'mid'}" title="Confiance">${Math.round(e.src.confidence*100)} %</span>`:'';
  const unit=d=>d.unit||(/thickness/.test(d.key)?'mm':/_r$/.test(d.key)?'m².K/W':/^ubat/.test(d.key)?'W/m².K':/^cep(?!_gain)/.test(d.key)?'kWhEP/m².an':/gain/.test(d.key)?'%':/^tic/.test(d.key)?'°C':d.key==='shab'?'m²':'');
  const rowHtml=e=>{ const k=e.def.key, editing=reviewState.editing===k; const u=unit(e.def);
    const value=editing?`<input class="rv-input" data-rv-input="${k}" value="${escapeHtml(isBlank(e.v)?'':String(e.v))}" placeholder="${escapeHtml(e.def.label)}" aria-label="Nouvelle valeur pour ${escapeHtml(e.def.label)}">`:(isBlank(e.v)?`<span class="rv-empty">${e.status==='review'?'Valeur proposée ci-dessous':'—'}</span>`:`<span class="rv-val">${escapeHtml(e.def.key==='construction_year'?String(e.v):formatValue(e.v))}</span>${u?`<span class="rv-unit">${escapeHtml(u)}</span>`:''}`);
    const cands=e.status==='review'||(!editing&&e.cands.length&&e.status!=='ok'&&e.status!=='manual')?e.cands.slice(0,3).map((c,i)=>`<div class="rv-cand"><span class="rv-cand-val">${escapeHtml(k==='construction_year'?String(c.value):formatValue(c.value))}</span><span class="rv-cand-src">${escapeHtml(c.synthetic?c.fileName:`${c.fileName} · p. ${c.page} · ${Math.round(c.confidence*100)} %`)}</span><button type="button" class="rv-btn rv-accept" data-rv-accept="${k}" data-i="${i}">Valider</button><button type="button" class="rv-btn rv-ghost" data-rv-reject="${k}" data-i="${i}">Écarter</button>${c.synthetic?'':`<button type="button" class="rv-btn rv-ghost" data-rv-goto="${k}" data-i="${i}" title="Ouvrir la page du document">Voir</button>`}</div>`).join(''):'';
    return `<div class="rv-row st-${e.status}" tabindex="0" data-rv-field="${k}"><div class="rv-label">${escapeHtml(e.def.label)}</div><div class="rv-value">${value}</div><div class="rv-meta"><span class="rv-pill p-${e.status}">${pill[e.status]}</span>${conf(e)}<span class="rv-src" title="${escapeHtml(e.src?.provenanceNote||e.src?.excerpt||'')}">${escapeHtml(srcText(e))}</span></div>
      <div class="rv-actions">${editing?`<button type="button" class="rv-btn rv-accept" data-rv-save="${k}">Enregistrer</button><button type="button" class="rv-btn rv-ghost" data-rv-cancel="${k}">Annuler</button>`:`<button type="button" class="rv-btn" data-rv-edit="${k}" title="Saisir ou corriger (Entrée)">${isBlank(e.v)?'Saisir':'Modifier'}</button><button type="button" class="rv-btn rv-ghost" data-rv-doc="${k}" title="Surligner la valeur dans un document (D)">Dans le document</button>${!isBlank(e.v)&&buildings.length>1?`<button type="button" class="rv-btn rv-ghost" data-rv-copy="${k}" title="Recopier cette valeur dans les bâtiments où elle manque">Copier aux autres</button>`:''}`}</div>${cands?`<div class="rv-cands">${cands}</div>`:''}</div>`; };
  const tabs=buildings.map(b=>{ const c=reviewCompletion(b,profile); return `<button type="button" class="rv-bld ${b===B?'active':''}" data-rv-building="${escapeHtml(b)}"><span>${escapeHtml(b.replace(/^Bâtiment\s+/,''))}</span><span class="rv-bld-bar" style="--p:${c.pct}%"></span><small>${c.filled}/${c.total}</small></button>`; }).join('');
  const comp=reviewCompletion(B,profile);
  const groupHtml=groups.map(g=>{ const shown=g.entries.filter(pass); if(!shown.length) return ''; const filled=g.entries.filter(e=>['ok','manual'].includes(e.status)).length;
    const body=shown.map(rowHtml).join(''); return g.admin||g.optional===profile?`<details class="rv-group rv-admin" data-rv-group="${escapeHtml(g.title)}" ${(reviewState.open||{})[g.title]||q?'open':''}><summary><h4>${g.title}</h4><span>${filled}/${g.entries.length}</span></summary>${body}</details>`:`<section class="rv-group"><header><h4>${g.title}</h4><span>${filled}/${g.entries.length}</span></header>${body}</section>`; }).join('');
  wrap.innerHTML=`<div class="rv">
    <div class="project-detail-banner"><div><h3>${escapeHtml(projectTitle(activeProject()))}</h3><small>${(activeProject().docs||[]).length} document(s) · ${buildings.length} bâtiment(s) · profil ${profile==='reno'?'rénovation':'construction neuve'}</small></div><button id="detailBackOverview" type="button">← Synthèse projets</button></div>
    <div class="rv-buildings" role="tablist" aria-label="Bâtiments">${tabs}</div>
    <div class="rv-toolbar">
      <div class="rv-summary"><strong>${escapeHtml(B)}</strong><span>${comp.filled} champ${comp.filled>1?'s':''} renseigné${comp.filled>1?'s':''} sur ${comp.total}</span></div>
      <div class="rv-filters" role="group" aria-label="Filtrer les champs">${[['todo',`À compléter · ${count(['missing','review'])}`],['review',`À vérifier · ${count(['review'])}`],['done',`Renseignés · ${count(['ok','manual'])}`],['all','Tout']].map(([k,l])=>`<button type="button" class="rv-filter ${reviewState.filter===k?'active':''}" data-rv-filter="${k}">${l}</button>`).join('')}</div>
      <input id="rvSearch" class="rv-search" type="search" placeholder="Chercher un champ ou une valeur" value="${escapeHtml(reviewState.query||'')}" aria-label="Chercher un champ">
      <button type="button" class="btn secondary rv-manual" id="rvManualBtn" title="Ouvrir le document et renseigner les champs manquants un par un">Compléter depuis les documents</button>
    </div>
    <div class="rv-groups">${groupHtml||`<div class="rv-done"><strong>${reviewState.filter==='todo'?'Tout est renseigné pour ce bâtiment.':'Aucun champ ne correspond.'}</strong><span>${reviewState.filter==='todo'?'Passez au bâtiment suivant ou affichez « Tout » pour relire.':'Changez de filtre ou de recherche.'}</span></div>`}</div>
    <p class="rv-keys">Clavier : ↑ ↓ pour changer de champ · Entrée pour saisir · D pour le document · V pour valider la proposition · Échap pour annuler.</p>
  </div>`;
  const find=k=>all.concat(groups.filter(g=>g.admin).flatMap(g=>g.entries)).find(e=>e.def.key===k);
  $$('#summaryView [data-rv-building]').forEach(b=>b.onclick=()=>{ reviewState.building=b.dataset.rvBuilding; reviewState.editing=''; renderReview(); });
  $$('#summaryView [data-rv-filter]').forEach(b=>b.onclick=()=>{ reviewState.filter=b.dataset.rvFilter; renderReview(); });
  const s=$('#rvSearch'); if(s){ s.oninput=()=>{ reviewState.query=s.value; const pos=s.selectionStart; renderReview(); const n=$('#rvSearch'); n.focus(); n.setSelectionRange(pos,pos); }; }
  $('#rvManualBtn').onclick=()=>openManualAnalysisFor(B,'');
  $$('#summaryView [data-rv-edit]').forEach(b=>b.onclick=()=>{ reviewState.editing=b.dataset.rvEdit; renderReview(); setTimeout(()=>{ const i=$(`#summaryView [data-rv-input="${reviewState.editing}"]`); i?.focus(); i?.select(); },0); });
  $$('#summaryView [data-rv-cancel]').forEach(b=>b.onclick=()=>{ reviewState.editing=''; renderReview(); });
  const save=k=>{ const i=$(`#summaryView [data-rv-input="${k}"]`); if(!i) return; if(setManualValue(B,k,i.value,{docId:'',fileName:'Saisie manuelle',page:'',excerpt:i.value,method:'manual:review-entry',provenanceNote:'Saisi dans la revue'})){ reviewState.editing=''; reviewAfterChange(`${FIELD_MAP[k].label} enregistré pour ${B}.`); focusReviewRow(k,1); } };
  $$('#summaryView [data-rv-save]').forEach(b=>b.onclick=()=>save(b.dataset.rvSave));
  $$('#summaryView [data-rv-input]').forEach(i=>i.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); save(i.dataset.rvInput); } else if(e.key==='Escape'){ e.preventDefault(); reviewState.editing=''; renderReview(); focusReviewRow(i.dataset.rvInput,0); } });
  $$('#summaryView [data-rv-doc]').forEach(b=>b.onclick=()=>{ const e=find(b.dataset.rvDoc); openManualAnalysisFor(B,b.dataset.rvDoc,e?.src?.docId||e?.cands?.[0]?.docId||'',e?.src?.page||e?.cands?.[0]?.page||null); });
  $$('#summaryView [data-rv-copy]').forEach(b=>b.onclick=()=>{ const n=copyToOtherBuildings(B,b.dataset.rvCopy); if(n) reviewAfterChange(`${FIELD_MAP[b.dataset.rvCopy].label} recopié dans ${n} bâtiment${n>1?'s':''}.`); else toast('Les autres bâtiments ont déjà une valeur pour ce champ.','info'); });
  $$('#summaryView [data-rv-accept]').forEach(b=>b.onclick=()=>{ const c=find(b.dataset.rvAccept)?.cands?.[Number(b.dataset.i)]; if(c){ acceptCandidate({...c,building:c.building==='Bâtiment unique'?B:c.building}); reviewAfterChange(`${FIELD_MAP[c.field].label} validé : ${formatValue(c.value)}.`); focusReviewRow(c.field,1); } });
  $$('#summaryView [data-rv-reject]').forEach(b=>b.onclick=()=>{ const c=find(b.dataset.rvReject)?.cands?.[Number(b.dataset.i)]; if(c){ rejectCandidate(c); reviewAfterChange('Proposition écartée.'); focusReviewRow(c.field,0); } });
  $$('#summaryView [data-rv-goto]').forEach(b=>b.onclick=()=>{ const c=find(b.dataset.rvGoto)?.cands?.[Number(b.dataset.i)]; if(c) openManualAnalysisFor(B,c.field,c.docId,c.page); });
  $$('#summaryView .rv-admin').forEach(d=>d.ontoggle=()=>{ reviewState.open={...(reviewState.open||{}),[d.dataset.rvGroup]:d.open}; });
  $$('#summaryView .rv-row').forEach(row=>row.onkeydown=e=>{ if(e.target!==row) return; const k=row.dataset.rvField;
    if(e.key==='ArrowDown'||e.key==='j'){ e.preventDefault(); focusReviewRow(k,1); } else if(e.key==='ArrowUp'||e.key==='k'){ e.preventDefault(); focusReviewRow(k,-1); }
    else if(e.key==='Enter'){ e.preventDefault(); row.querySelector('[data-rv-edit]')?.click(); } else if(e.key==='d'||e.key==='D'){ e.preventDefault(); row.querySelector('[data-rv-doc]')?.click(); }
    else if(e.key==='v'||e.key==='V'){ e.preventDefault(); row.querySelector('[data-rv-accept]')?.click(); } });
  const back=$('#detailBackOverview'); if(back) back.onclick=showProjectsOverview; renderResultWorkspaceControls();
}
function focusReviewRow(field,delta){ setTimeout(()=>{ const rows=$$('#summaryView .rv-row'); let i=rows.findIndex(r=>r.dataset.rvField===field); if(i<0) i=delta>0?-1:0; const t=rows[Math.max(0,Math.min(rows.length-1,i+delta))]; t?.focus(); },0); }
// Analyse manuelle ciblée : bâtiment et champ présélectionnés, document et page de la source (ou du candidat) ouverts.
function openManualAnalysisFor(building,field,docId='',page=null){
  openManualAnalysisDialog(); if(!$('#betaErrorDialog')?.open) return;
  manualAnalysisState.building=building||manualAnalysisState.building; manualAnalysisState.filter='todo';
  if(field){ const sec=Object.entries(MANUAL_ANALYSIS_SECTIONS).find(([,c])=>c.families.has(FIELD_MAP[field]?.family))?.[0]; if(sec) manualAnalysisState.section=sec; manualAnalysisState.field=field; }
  else { const next=manualAnalysisNextField(''); if(next){ manualAnalysisState.section=next.section; manualAnalysisState.field=next.field; } }
  renderManualAnalysisSidebar(); if(docId) syncBetaLearningDocument(docId,page); }

let betaLearningSelection=null;
const betaPdfPreviewState={docId:'',pdf:null,loadingTask:null,renderTask:null,pageNo:1,mode:'native',renderToken:0,ocrWorker:null,ocrWords:[],viewport:null};

const MANUAL_ANALYSIS_SECTIONS={
  general:{label:'Généralités',families:new Set(['Administration','Programme','Certification & exigences'])},
  thermal:{label:'Thermique',families:new Set(['Performance énergétique','Confort d’été','Systèmes','DPE','ENR'])},
  carbon:{label:'Carbone',families:new Set(['Carbone'])},
  envelope:{label:'Enveloppe',families:new Set(['Enveloppe'])}
};
let manualAnalysisState={building:'',section:'general',field:'',filter:'todo',chain:true,query:''};
function manualAnalysisMode(){ return $('#betaErrorDialog')?.dataset.mode==='manual'; }
function manualAnalysisBuildings(){
  const fromResult=(state.result?.rows||[]).map(r=>r.building).filter(Boolean);
  if(fromResult.length)return unique(fromResult);
  const fromDocs=state.docs.flatMap(d=>d.buildings?.names||[]).filter(Boolean);
  return unique(fromDocs.length?fromDocs:['Bâtiment unique']);
}
function manualAnalysisSectionOf(field){ const fam=FIELD_MAP[field]?.family; return Object.keys(MANUAL_ANALYSIS_SECTIONS).find(k=>MANUAL_ANALYSIS_SECTIONS[k].families.has(fam)); }
function manualAnalysisFields(section=manualAnalysisState.section,{all=false,search=!all}={}){
  const cfg=MANUAL_ANALYSIS_SECTIONS[section]||MANUAL_ANALYSIS_SECTIONS.general; const prof=projectProfile();
  // v2.4.1 — recherche : toutes les familles, libellé ou synonymes contenant le texte saisi (casse et accents ignorés).
  const q=search?normLower(manualAnalysisState.query||''):'';
  const defs=FIELD_DEFS.filter(f=>f.key!=='building'&&(q?manualAnalysisSectionOf(f.key):cfg.families.has(f.family))&&fieldInProfile(f.key,prof)&&(!q||normLower([f.label,...(f.tags||[])].join(' | ')).includes(q)));
  // v2.4.0 — « À compléter » : champs vides ou dont la valeur est seulement proposée (à vérifier), le champ actif restant visible.
  if(all||manualAnalysisState.filter==='all') return defs;
  return defs.filter(f=>f.key===manualAnalysisState.field||manualAnalysisNeeds(manualAnalysisState.building,f.key));
}
function manualAnalysisNeeds(building,field){ return isBlank(manualAnalysisCurrentValue(building,field)); }
function manualAnalysisCandidates(building,field){ return visibleUncertain().filter(o=>o.field===field&&(o.building===building||o.building==='Bâtiment unique')).sort((a,b)=>b.confidence-a.confidence); }
// Champ suivant à compléter (même bâtiment), en parcourant les familles dans l'ordre d'affichage : thermique et enveloppe d'abord.
function manualAnalysisNextField(current=manualAnalysisState.field){
  if(manualAnalysisState.query.trim()){ const list=manualAnalysisFields(manualAnalysisState.section,{all:true,search:true}); const f=list.slice(list.findIndex(x=>x.key===current)+1).find(x=>manualAnalysisNeeds(manualAnalysisState.building,x.key)); return f?{section:manualAnalysisSectionOf(f.key),field:f.key}:null; }
  const order=['thermal','envelope','general','carbon']; const start=Math.max(0,order.indexOf(manualAnalysisState.section)); const seq=[...order.slice(start),...order.slice(0,start)];
  let passed=!current;
  for(const sec of seq){ for(const f of manualAnalysisFields(sec,{all:true})){ if(f.key===current){ passed=true; continue; } if(passed&&manualAnalysisNeeds(manualAnalysisState.building,f.key)) return {section:sec,field:f.key}; } }
  return null;
}
function manualAnalysisCurrentValue(building,field){
  const key=`${building}|${field}`;
  if(Object.prototype.hasOwnProperty.call(state.manualValues||{},key))return state.manualValues[key];
  const row=state.result?.rows?.find(r=>r.building===building);
  return row?.[field];
}
function renderManualAnalysisSidebar(){
  const side=$('#manualAnalysisSidebar'); if(!side)return;
  const buildings=manualAnalysisBuildings();
  if(!buildings.includes(manualAnalysisState.building))manualAnalysisState.building=buildings[0]||'Bâtiment unique';
  if(!MANUAL_ANALYSIS_SECTIONS[manualAnalysisState.section])manualAnalysisState.section='general';
  const fields=manualAnalysisFields();
  if(manualAnalysisState.field&&!fields.some(f=>f.key===manualAnalysisState.field))manualAnalysisState.field='';
  const bt=$('#manualBuildingTabs'),st=$('#manualSectionTabs'),fb=$('#manualFieldButtons'),target=$('#manualSelectedTarget');
  const buildingCount=$('#manualBuildingCount'),direct=$('#manualDirectValue'),directApply=$('#manualDirectApply');
  if(buildingCount)buildingCount.textContent=`${buildings.length} bâtiment${buildings.length>1?'s':''}`;
  if(bt)bt.innerHTML=buildings.map((b,i)=>`<button type="button" class="manual-building-tab ${b===manualAnalysisState.building?'active':''}" data-building="${escapeHtml(b)}" title="${escapeHtml(b)}">${escapeHtml(b||`Bâtiment ${i+1}`)}</button>`).join('');
  if(st)st.innerHTML=Object.entries(MANUAL_ANALYSIS_SECTIONS).map(([key,cfg])=>`<button type="button" class="manual-section-tab ${key===manualAnalysisState.section?'active':''}" data-section="${key}">${escapeHtml(cfg.label)}</button>`).join('');
  if(fb)fb.innerHTML=fields.map(f=>{const v=manualAnalysisCurrentValue(manualAnalysisState.building,f.key),filled=!isBlank(v),cand=!filled&&manualAnalysisCandidates(manualAnalysisState.building,f.key)[0];return `<button type="button" class="manual-field-btn ${manualAnalysisState.field===f.key?'active':''} ${filled?'filled':''} ${cand?'has-cand':''}" data-field="${f.key}"><span>${escapeHtml(f.label)}</span><strong>${filled?escapeHtml(formatValue(v)):cand?`proposé : ${escapeHtml(formatValue(cand.value))}`:'À renseigner'}</strong></button>`;}).join('')||`<div class="empty-small">${manualAnalysisState.query.trim()?`Aucun champ ${manualAnalysisState.filter==='todo'?'à compléter ':''}ne contient « ${escapeHtml(manualAnalysisState.query.trim())} ».`:manualAnalysisState.filter==='todo'?'Tout est renseigné dans cette famille.':'Aucun champ dans cette famille.'}</div>`;
  const bar=$('#manualFilterBar'); if(bar){ const todo=manualAnalysisFields(manualAnalysisState.section,{all:true,search:true}).filter(f=>manualAnalysisNeeds(manualAnalysisState.building,f.key)).length;
    bar.innerHTML=`<div class="manual-filter-chips" role="group" aria-label="Champs affichés"><button type="button" class="manual-filter ${manualAnalysisState.filter==='todo'?'active':''}" data-mfilter="todo">À compléter ${manualAnalysisState.query.trim()?'· recherche':'dans cette famille'} · ${todo}</button><button type="button" class="manual-filter ${manualAnalysisState.filter==='all'?'active':''}" data-mfilter="all">Tous les champs</button></div><label class="manual-chain"><input type="checkbox" id="manualChain" ${manualAnalysisState.chain?'checked':''}> Passer au champ suivant après chaque saisie</label>`;
    bar.querySelectorAll('[data-mfilter]').forEach(b=>b.onclick=()=>{ manualAnalysisState.filter=b.dataset.mfilter; renderManualAnalysisSidebar(); }); const ch=$('#manualChain'); if(ch) ch.onchange=()=>{ manualAnalysisState.chain=ch.checked; }; }
  const cbox=$('#manualCandidates'); if(cbox){ const cs=manualAnalysisState.field&&isBlank(manualAnalysisCurrentValue(manualAnalysisState.building,manualAnalysisState.field))?manualAnalysisCandidates(manualAnalysisState.building,manualAnalysisState.field).slice(0,3):[];
    cbox.hidden=!cs.length; cbox.innerHTML=cs.length?`<span class="manual-cand-title">Proposé par l’analyse</span>${cs.map((c,i)=>`<div class="manual-cand"><strong>${escapeHtml(formatValue(c.value))}</strong><small>${escapeHtml(c.fileName)} · p. ${c.page} · ${Math.round(c.confidence*100)} %</small><button type="button" class="btn light" data-mcand-use="${i}">Utiliser</button><button type="button" class="btn light" data-mcand-go="${i}">Voir la page</button></div>`).join('')}`:'';
    cbox.querySelectorAll('[data-mcand-use]').forEach(b=>b.onclick=()=>{ const c=cs[Number(b.dataset.mcandUse)]; if(!c) return; acceptCandidate({...c,building:manualAnalysisState.building}); renderSummary(); manualAnalysisAdvance(`✓ ${FIELD_MAP[c.field]?.label} = ${formatValue(c.value)}`); });
    cbox.querySelectorAll('[data-mcand-go]').forEach(b=>b.onclick=()=>{ const c=cs[Number(b.dataset.mcandGo)]; if(c) syncBetaLearningDocument(c.docId,c.page); }); }
  const def=FIELD_MAP[manualAnalysisState.field];
  if(target)target.innerHTML=def?`<span>Cible active</span><strong>${escapeHtml(manualAnalysisState.building)} · ${escapeHtml(def.label)}</strong><small>Surlignez la valeur à gauche, cliquez une cellule Excel ou saisissez-la manuellement ci-dessous.</small>`:'<span>Cible active</span><strong>Sélectionnez une donnée à renseigner</strong><small>Puis utilisez le document ou la saisie manuelle.</small>';
  if(direct){
    direct.disabled=!def;
    direct.placeholder=def?`Saisir la valeur exacte pour « ${def.label} »`:'Choisissez d’abord un champ';
    if(def&&document.activeElement!==direct){const current=manualAnalysisCurrentValue(manualAnalysisState.building,manualAnalysisState.field);direct.value=(current!==undefined&&current!==null)?String(current):'';}
    if(!def)direct.value='';
  }
  if(directApply)directApply.disabled=!def;
  bt?.querySelectorAll('.manual-building-tab').forEach(b=>b.onclick=()=>{manualAnalysisState.building=b.dataset.building||'Bâtiment unique';manualAnalysisState.field='';renderManualAnalysisSidebar();});
  st?.querySelectorAll('.manual-section-tab').forEach(b=>b.onclick=()=>{manualAnalysisState.section=b.dataset.section||'thermal';manualAnalysisState.field='';renderManualAnalysisSidebar();});
  // ↑ ↓ : champ précédent / suivant de la liste.
  fb?.querySelectorAll('.manual-field-btn').forEach((b,i,all)=>b.onkeydown=e=>{ if(e.key!=='ArrowDown'&&e.key!=='ArrowUp') return; e.preventDefault(); const t=all[i+(e.key==='ArrowDown'?1:-1)]; if(t){ t.click(); setTimeout(()=>$(`#manualFieldButtons [data-field="${t.dataset.field}"]`)?.focus(),0); } });
  fb?.querySelectorAll('.manual-field-btn').forEach(b=>b.onclick=()=>{manualAnalysisState.field=b.dataset.field||'';manualAnalysisState.section=manualAnalysisSectionOf(manualAnalysisState.field)||manualAnalysisState.section;renderManualAnalysisSidebar();const feedback=$('#manualAnalysisFeedback');if(feedback){const d=FIELD_MAP[manualAnalysisState.field];feedback.textContent=d?`Prêt : surlignez « ${d.label} » dans le document ou saisissez directement la bonne valeur.`:'';feedback.className='manual-analysis-feedback';}setTimeout(()=>$('#manualDirectValue')?.select?.(),0);});
}
function manualAnalysisStoreValue(raw,{location=null,manualEntry=false}={}){
  if(!manualAnalysisMode())return false;
  const feedback=$('#manualAnalysisFeedback'),building=manualAnalysisState.building,field=manualAnalysisState.field,def=FIELD_MAP[field];
  if(!def){if(feedback){feedback.textContent='Choisissez d’abord une donnée à renseigner dans le panneau de droite.';feedback.className='manual-analysis-feedback warn';}return false;}
  const exact=String(raw??'').replace(/\s+/g,' ').trim();
  if(!exact){if(feedback){feedback.textContent='Saisissez ou sélectionnez une valeur avant de l’appliquer.';feedback.className='manual-analysis-feedback warn';}return false;}
  let value=exact;
  if(def.type==='number'){const n=betaParseCorrectedNumber(exact);if(n===null){if(feedback){feedback.textContent=`La valeur « ${exact} » ne contient pas de nombre exploitable pour ${def.label}.`;feedback.className='manual-analysis-feedback error';}return false;}value=n;}
  else if(field==='window_glazing')value=normalizeGlazingType(exact)||exact;
  const key=`${building}|${field}`,previous=manualAnalysisCurrentValue(building,field),loc=location?{...location}:null,doc=betaLearningDoc();
  state.manualValues[key]=value;
  state.manualSources[key]=manualEntry
    ? {docId:'',fileName:'Saisie manuelle',page:'',excerpt:exact,method:'manual:direct-entry',provenanceNote:'Analyse manuelle — valeur saisie directement'}
    : {docId:loc?.docId||doc?.id||'',fileName:loc?.document||doc?.name||'Analyse manuelle',page:loc?.page||Number($('#betaLearningPage')?.value)||1,excerpt:loc?.lineText||loc?.selectedText||exact,method:`manual:${loc?.selectionMode||'document-analysis'}`,provenanceNote:'Analyse manuelle par sélection documentaire'};
  applyManualValues();
  learn('manual_override',{building,field,label:def.label,previousValue:previous,newValue:value,source:manualEntry?'manual_direct_entry':'manual_document_analysis',highlight:loc},activeProject());
  // V2.2.8 — l'analyse manuelle alimente aussi la mémoire d'apprentissage.
  // Une saisie directe est journalisée comme correction fiable, mais n'enseigne pas
  // de position documentaire puisqu'aucune zone du document n'a été désignée.
  if(manualEntry){
    learn('manual_analysis_direct_value',{building,field,fieldLabel:def.label,previousValue:previous,newValue:value,enteredText:exact},activeProject());
  }else if(loc?.docType){
    const learnPayload={
      field,fieldLabel:def.label||field,building,
      docType:loc.docType,document:loc.document||doc?.name||'',page:loc.page||Number($('#betaLearningPage')?.value)||1,
      pageRatio:loc.pageRatio,lineIndex:loc.lineIndex,endLineIndex:loc.endLineIndex,lineRatio:loc.lineRatio,
      lineText:loc.lineText||'',beforeLine:loc.beforeLine||'',afterLine:loc.afterLine||'',selectedText:loc.selectedText||exact,
      selectionMode:loc.selectionMode||'manual-analysis',normalizedRects:loc.normalizedRects||[],bboxNormalized:loc.bboxNormalized||null,
      correctedValue:value,operation:learningPayloadBase(activeProject()).operation,source:'manual_analysis'
    };
    recordLearningEvent('parser_location_learning',learnPayload,activeProject())
      .then(async evt=>{
        await reinforceLearningLocation(learnPayload,{eventId:evt.id,createdAt:evt.createdAt,field,docType:loc.docType,building});
        scheduleJournalUiRefresh();
        renderLearningMemoryUi();
      })
      .catch(err=>console.warn('Manual analysis location learning failed',err));
  }
  scheduleWorkspaceCheckpoint(manualEntry?'analyse manuelle saisie directe':'analyse manuelle documentaire',80);
  renderManualAnalysisSidebar();
  renderSummary(); renderOccurrences();
  manualAnalysisAdvance(`✓ ${def.label} = ${formatValue(value)} · ${building}${manualEntry?' · saisie manuelle':''}`);
  return true;
}
function manualAnalysisAdvance(message){
  const feedback=$('#manualAnalysisFeedback'); let extra='';
  if(manualAnalysisState.chain){ const next=manualAnalysisNextField(); if(next){ manualAnalysisState.section=next.section; manualAnalysisState.field=next.field; extra=` · suivant : ${FIELD_MAP[next.field]?.label}`; } else extra=' · tous les champs de ce bâtiment sont renseignés'; }
  renderManualAnalysisSidebar(); if(feedback){ feedback.textContent=message+extra; feedback.className='manual-analysis-feedback ok'; }
  setTimeout(()=>{ const d=$('#manualDirectValue'); if(d&&!d.disabled){ d.focus(); d.select?.(); } },0);
}
function manualAnalysisAssignSelection(selectedText=betaLearningSelection?.selectedText||''){
  return manualAnalysisStoreValue(selectedText,{location:betaLearningSelection,manualEntry:false});
}
function manualAnalysisApplyDirectValue(){
  const input=$('#manualDirectValue');
  const ok=manualAnalysisStoreValue(input?.value||'',{manualEntry:true});
  if(ok)setTimeout(()=>input?.select?.(),0);
  return ok;
}
function openManualAnalysisDialog(){
  const docs=betaLearningDocs(),dlg=$('#betaErrorDialog');
  if(!dlg)return;
  if(!docs.length){toast('Ajoutez et lisez au moins un PDF ou tableur avant l’analyse manuelle.','warn');return;}
  dlg.dataset.mode='manual'; dlg.dataset.field=''; dlg.dataset.building='';
  $('#betaErrorTitle').textContent='Analyse manuelle du projet';
  $('#betaErrorIntro').textContent='Choisissez un bâtiment et un champ à droite, puis surlignez la valeur dans le PDF ou cliquez une cellule du tableur. La donnée est affectée immédiatement.';
  const correction=$('#betaCorrectionSidebar'),manual=$('#manualAnalysisSidebar'),submit=$('#betaErrorSubmit'),cancel=$('#betaErrorCancel');
  if(correction)correction.hidden=true;if(manual)manual.hidden=false;if(submit)submit.hidden=true;if(cancel)cancel.textContent='Terminer l’analyse manuelle';
  manualAnalysisState={building:manualAnalysisBuildings()[0]||'Bâtiment unique',section:'thermal',field:'',filter:manualAnalysisState.filter||'todo',chain:manualAnalysisState.chain!==false,query:''};
  const search=$('#manualFieldSearch');if(search){search.value='';search.oninput=()=>{manualAnalysisState.query=search.value;renderManualAnalysisSidebar();};search.onkeydown=e=>{if(e.key==='Escape'&&search.value){e.preventDefault();e.stopPropagation();search.value='';search.oninput();}else if(e.key==='Enter'){e.preventDefault();$('#manualFieldButtons .manual-field-btn')?.click();}};}
  const feedback=$('#manualAnalysisFeedback');if(feedback){feedback.textContent='Sélectionnez un champ à droite pour commencer.';feedback.className='manual-analysis-feedback';}
  const direct=$('#manualDirectValue'),directApply=$('#manualDirectApply');
  if(direct){direct.value='';direct.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();manualAnalysisApplyDirectValue();}};}
  if(directApply)directApply.onclick=manualAnalysisApplyDirectValue;
  betaLearningSelection=null;dlg.showModal();renderManualAnalysisSidebar();syncBetaLearningDocument(docs[0]?.id||'',null);
}
function setCorrectionDialogMode(){
  const dlg=$('#betaErrorDialog'),correction=$('#betaCorrectionSidebar'),manual=$('#manualAnalysisSidebar'),submit=$('#betaErrorSubmit'),cancel=$('#betaErrorCancel');
  if(dlg)dlg.dataset.mode='correction';if(correction)correction.hidden=false;if(manual)manual.hidden=true;if(submit)submit.hidden=false;if(cancel)cancel.textContent='Annuler';
}

function betaLearningDocs(){ return (activeProject()?.docs||[]).filter(d=>d.status==='ready'&&d.read?.pages?.length); }
function betaLearningDoc(){ const id=$('#betaLearningDocument')?.value||''; return betaLearningDocs().find(d=>d.id===id)||null; }
function betaLearningIsPdf(doc){ return !!doc&&/\.pdf$/i.test(doc.name||''); }
function betaLearningIsSpreadsheet(doc){ return !!doc&&(doc.read?.kind==='spreadsheet'||/\.(xlsx?|xls)$/i.test(doc.name||'')); }
function betaExcelColumnLabel(index){ let n=Number(index)||0,out=''; do{out=String.fromCharCode(65+(n%26))+out;n=Math.floor(n/26)-1;}while(n>=0);return out; }
function betaSpreadsheetCellRef(rowIndex,colIndex){ return `${betaExcelColumnLabel(colIndex)}${Number(rowIndex)+1}`; }
function betaPdfStatus(message='',kind=''){ const el=$('#betaPdfStatus'); if(!el)return; el.textContent=message; el.className=`beta-pdf-status${kind?` ${kind}`:''}`; }
async function disposeBetaPdfPreview({keepOcr=false}={}){
  betaPdfPreviewState.renderToken++;
  try{betaPdfPreviewState.renderTask?.cancel?.();}catch{}
  betaPdfPreviewState.renderTask=null;
  if(betaPdfPreviewState.pdf){try{betaPdfPreviewState.pdf.cleanup?.();}catch{}try{await betaPdfPreviewState.pdf.destroy?.();}catch{}}
  else if(betaPdfPreviewState.loadingTask){try{await betaPdfPreviewState.loadingTask.destroy?.();}catch{}}
  betaPdfPreviewState.pdf=null; betaPdfPreviewState.loadingTask=null; betaPdfPreviewState.docId=''; betaPdfPreviewState.viewport=null; betaPdfPreviewState.ocrWords=[]; betaPdfPreviewState.mode='native';
  if(!keepOcr&&betaPdfPreviewState.ocrWorker){try{await betaPdfPreviewState.ocrWorker.terminate?.();}catch{} betaPdfPreviewState.ocrWorker=null;}
}
function betaPageLines(doc,pageNo){ const page=doc?.read?.pages?.find(p=>Number(p.page)===Number(pageNo)); return (page?.lines||[]).filter(l=>String(l.text||'').trim()); }
function betaSelectionContext(doc,pageNo,selectedText){
  const lines=betaPageLines(doc,pageNo),needle=normLower(selectedText).replace(/\s+/g,' ').trim();
  let pos=needle?lines.findIndex(l=>normLower(l.text||'').includes(needle)):-1;
  if(pos<0&&needle){const token=needle.split(/\s+/).find(t=>t.length>=3); if(token)pos=lines.findIndex(l=>normLower(l.text||'').includes(token));}
  const line=pos>=0?lines[pos]:null;
  return {lineIndex:line&&Number.isFinite(line.index)?line.index:(pos>=0?pos:null),lineCount:lines.length,lineText:line?.text||selectedText,beforeLine:pos>0?lines[pos-1]?.text||'':'',afterLine:pos>=0&&pos<lines.length-1?lines[pos+1]?.text||'':'',lineRatio:lines.length&&pos>=0?Math.round(((pos+1)/lines.length)*1000)/1000:null};
}
function betaClearSavedHighlight(){ const layer=$('#betaPdfHighlightLayer'); if(layer)layer.innerHTML=''; }
function betaDrawSavedHighlight(rects=[]){
  const layer=$('#betaPdfHighlightLayer'); if(!layer)return; layer.innerHTML='';
  for(const r of rects||[]){const el=document.createElement('div');el.className='beta-pdf-saved-highlight';el.style.left=`${r.x*100}%`;el.style.top=`${r.y*100}%`;el.style.width=`${r.w*100}%`;el.style.height=`${r.h*100}%`;layer.appendChild(el);}
}
function betaSetTextSpanGeometry(span,{left,top,width,height,angle=0}){
  span.style.left=`${left}px`; span.style.top=`${top}px`; span.style.height=`${Math.max(1,height)}px`; span.style.fontSize=`${Math.max(1,height)}px`; span.style.lineHeight='1'; span.style.transformOrigin='0 0';
  span.style.transform=`rotate(${angle}rad)`; span.style.width='auto';
  requestAnimationFrame(()=>{ if(!span.isConnected)return; const measured=Math.max(1,span.getBoundingClientRect().width); const sx=Math.max(.08,Math.min(12,width/measured)); span.style.transform=`rotate(${angle}rad) scaleX(${sx})`; });
}
function betaRenderNativeTextLayer(content,viewport){
  const layer=$('#betaPdfTextLayer'); if(!layer)return; layer.innerHTML=''; layer.dataset.mode='native';
  const styles=content?.styles||{};
  for(let i=0;i<(content?.items||[]).length;i++){
    const item=content.items[i]; if(!item?.str)continue;
    const tx=globalThis.pdfjsLib?.Util?.transform?globalThis.pdfjsLib.Util.transform(viewport.transform,item.transform):null; if(!tx)continue;
    const height=Math.max(1,Math.hypot(tx[2],tx[3])); const angle=Math.atan2(tx[1],tx[0]); const left=tx[4],top=tx[5]-height; const width=Math.max(1,Number(item.width||0)*viewport.scale);
    const span=document.createElement('span'); span.className='beta-pdf-text-item'; span.textContent=item.str; span.dataset.itemIndex=String(i); span.dataset.source='pdf';
    const font=styles[item.fontName]?.fontFamily; if(font)span.style.fontFamily=font;
    layer.appendChild(span); betaSetTextSpanGeometry(span,{left,top,width,height,angle});
  }
}
function flattenOcrWords(blocks=[]){
  const out=[];
  for(const block of blocks||[])for(const paragraph of block?.paragraphs||[])for(const line of paragraph?.lines||[])for(const word of line?.words||[]){if(String(word?.text||'').trim()&&word?.bbox)out.push(word);}
  return out;
}
function betaRenderOcrTextLayer(words,sourceWidth,sourceHeight,viewport){
  const layer=$('#betaPdfTextLayer'); if(!layer)return; layer.innerHTML=''; layer.dataset.mode='ocr';
  for(let i=0;i<(words||[]).length;i++){
    const word=words[i],b=word?.bbox; if(!b)continue; const text=String(word.text||'').trim(); if(!text)continue;
    const left=(b.x0/sourceWidth)*viewport.width,top=(b.y0/sourceHeight)*viewport.height,width=((b.x1-b.x0)/sourceWidth)*viewport.width,height=((b.y1-b.y0)/sourceHeight)*viewport.height;
    const span=document.createElement('span');span.className='beta-pdf-text-item beta-pdf-ocr-item';span.textContent=text;span.dataset.itemIndex=String(i);span.dataset.source='ocr';span.dataset.confidence=String(Number(word.confidence)||0);layer.appendChild(span);betaSetTextSpanGeometry(span,{left,top,width:Math.max(2,width),height:Math.max(4,height)});
  }
}
async function betaEnsurePdf(doc){
  if(!doc?.file) throw new Error('Le PDF doit être redéposé pour permettre le surlignage visuel.');
  if(!globalThis.pdfjsLib) throw new Error('PDF.js n’est pas chargé.');
  if(betaPdfPreviewState.pdf&&betaPdfPreviewState.docId===doc.id)return betaPdfPreviewState.pdf;
  await disposeBetaPdfPreview({keepOcr:true});
  const data=await doc.file.arrayBuffer(); const task=globalThis.pdfjsLib.getDocument({data}); betaPdfPreviewState.loadingTask=task; const pdf=await task.promise; betaPdfPreviewState.pdf=pdf; betaPdfPreviewState.loadingTask=null; betaPdfPreviewState.docId=doc.id; return pdf;
}
async function renderBetaPdfPage({forceMode='native'}={}){
  const doc=betaLearningDoc(),pageNo=Number($('#betaLearningPage')?.value)||1,stage=$('#betaPdfViewport'),pageWrap=$('#betaPdfPage'),canvas=$('#betaPdfCanvas'),textLayer=$('#betaPdfTextLayer'),fallback=$('#betaLearningText');
  betaLearningSelection=null; betaClearSavedHighlight(); const out=$('#betaLearningSelection'); if(out)out.textContent='Aucun surlignage sélectionné.';
  if(!doc||!stage||!pageWrap||!canvas||!textLayer||!fallback)return;
  fallback.hidden=true; fallback.classList.toggle('beta-spreadsheet-mode',betaLearningIsSpreadsheet(doc)); stage.hidden=false; textLayer.innerHTML=''; betaPdfStatus('Préparation de la page…');
  if(!betaLearningIsPdf(doc)){
    stage.hidden=true; fallback.hidden=false; renderBetaLearningTextFallback(doc,pageNo); betaPdfStatus(betaLearningIsSpreadsheet(doc)?'Mode tableur : cliquez une cellule ou sélectionnez son contenu.':'Mode texte : ce document n’est pas un PDF.','ok'); return;
  }
  if(!doc.file){ stage.hidden=true; fallback.hidden=false; fallback.innerHTML='<div class="empty-small">Le PDF a été restauré depuis une session précédente. Redéposez le fichier pour surligner directement dans la page.</div>'; betaPdfStatus('PDF à redéposer','warn'); return; }
  try{
    try{betaPdfPreviewState.renderTask?.cancel?.();}catch{} betaPdfPreviewState.renderTask=null;
    const pdf=await betaEnsurePdf(doc); const token=++betaPdfPreviewState.renderToken; const p=Math.min(Math.max(1,pageNo),pdf.numPages); betaPdfPreviewState.pageNo=p;
    const page=await pdf.getPage(p); const base=page.getViewport({scale:1}); const available=Math.max(520,Math.min(1500,(stage.clientWidth||1200)-28)); const scale=Math.max(.72,Math.min(2.15,available/base.width)); const viewport=page.getViewport({scale}); betaPdfPreviewState.viewport=viewport;
    const dpr=Math.min(2,globalThis.devicePixelRatio||1); canvas.width=Math.max(1,Math.round(viewport.width*dpr));canvas.height=Math.max(1,Math.round(viewport.height*dpr));canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;pageWrap.style.width=`${viewport.width}px`;pageWrap.style.height=`${viewport.height}px`;textLayer.style.width=`${viewport.width}px`;textLayer.style.height=`${viewport.height}px`;const hl=$('#betaPdfHighlightLayer');if(hl){hl.style.width=`${viewport.width}px`;hl.style.height=`${viewport.height}px`;}
    const ctx=canvas.getContext('2d',{alpha:false});ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);const renderViewport=page.getViewport({scale:scale*dpr}); betaPdfPreviewState.renderTask=page.render({canvasContext:ctx,viewport:renderViewport,background:'white'});await betaPdfPreviewState.renderTask.promise;betaPdfPreviewState.renderTask=null;
    if(forceMode==='ocr'&&betaPdfPreviewState.ocrWords.length&&betaPdfPreviewState.mode==='ocr'){
      const dims=betaPdfPreviewState.ocrSourceDims||{width:canvas.width,height:canvas.height}; betaRenderOcrTextLayer(betaPdfPreviewState.ocrWords,dims.width,dims.height,viewport); betaPdfStatus(`OCR actif · ${betaPdfPreviewState.ocrWords.length} mots sélectionnables`,'ok');
    }else{
      const content=await page.getTextContent({includeMarkedContent:true}); betaRenderNativeTextLayer(content,viewport); betaPdfPreviewState.mode='native'; betaPdfPreviewState.ocrWords=[]; betaPdfStatus(`${content.items?.length||0} blocs texte PDF · surlignez directement dans la page`,'ok');
    }
    try{page.cleanup?.();}catch{}
  }catch(err){ if(err?.name==='RenderingCancelledException')return; console.error('Correction PDF preview',err); stage.hidden=true;fallback.hidden=false;renderBetaLearningTextFallback(doc,pageNo);betaPdfStatus(`Aperçu PDF impossible : ${err?.message||err}`,'error'); }
}
function betaSelectSpreadsheetCell(cell){
  if(!cell)return;
  const doc=betaLearningDoc(),pageNo=Number($('#betaLearningPage')?.value)||1,page=doc?.read?.pages?.find(p=>Number(p.page)===Number(pageNo))||doc?.read?.pages?.[0];
  const selectedText=String(cell.dataset.value??cell.textContent??'').trim(); if(!selectedText)return;
  const rowIndex=Number(cell.dataset.rowIndex),colIndex=Number(cell.dataset.colIndex),lineIndex=Number(cell.dataset.lineIndex); const lines=page?.lines||[]; const pos=lines.findIndex(l=>Number(l.index)===lineIndex); const line=pos>=0?lines[pos]:null; const cellRef=cell.dataset.cellRef||betaSpreadsheetCellRef(rowIndex,colIndex);
  $('#betaLearningText')?.querySelectorAll('.beta-spreadsheet-cell-selected').forEach(el=>el.classList.remove('beta-spreadsheet-cell-selected')); cell.classList.add('beta-spreadsheet-cell-selected');
  betaLearningSelection={docId:doc?.id||'',document:doc?.name||'',docType:doc?.type||'',page:pageNo,pageCount:doc?.read?.pages?.length||0,lineIndex:Number.isFinite(lineIndex)?lineIndex:null,endLineIndex:Number.isFinite(lineIndex)?lineIndex:null,lineCount:lines.length,selectedText,lineText:line?.text||selectedText,beforeLine:pos>0?lines[pos-1]?.text||'':'',afterLine:pos>=0&&pos<lines.length-1?lines[pos+1]?.text||'':'',pageRatio:(doc?.read?.pages?.length?Math.round((pageNo/doc.read.pages.length)*1000)/1000:null),lineRatio:lines.length&&pos>=0?Math.round(((pos+1)/lines.length)*1000)/1000:null,selectionMode:'spreadsheet-cell',cellRef,cellRow:Number.isFinite(rowIndex)?rowIndex+1:null,cellColumn:Number.isFinite(colIndex)?betaExcelColumnLabel(colIndex):'',normalizedRects:[],bboxNormalized:null};
  $('#betaLearningSelection').textContent=`Cellule ${cellRef} : « ${selectedText} » · ${doc?.name||''}${page?.sheet?` · ${page.sheet}`:''}`; betaSetExactValueFromSelection(selectedText); $('#betaErrorFeedback').textContent=''; manualAnalysisAssignSelection(selectedText);
}
function renderBetaSpreadsheetPreview(doc,pageNo){
  const box=$('#betaLearningText'); if(!box)return; const page=doc?.read?.pages?.find(p=>Number(p.page)===Number(pageNo))||doc?.read?.pages?.[0]; if(!page){box.innerHTML='<div class="empty-small">Aucune feuille exploitable.</div>';return;}
  const lines=(page.lines||[]).filter(l=>Array.isArray(l.cells)); if(!lines.length){renderBetaLearningTextFallback(doc,pageNo,true);return;}
  const maxCols=Math.min(120,Math.max(1,...lines.map(l=>Math.max(0,(l.cells||[]).length)))); const maxRows=1500; const shown=lines.slice(0,maxRows);
  const head=Array.from({length:maxCols},(_,c)=>`<th class="beta-sheet-col-head">${betaExcelColumnLabel(c)}</th>`).join('');
  const body=shown.map((line,visibleIndex)=>{const rowIndex=Number.isFinite(Number(line.index))?Number(line.index):visibleIndex; const cells=Array.from({length:maxCols},(_,c)=>{const raw=(line.cells||[])[c]??''; const value=String(raw); const ref=betaSpreadsheetCellRef(rowIndex,c); return `<td class="beta-spreadsheet-cell${value.trim()?'':' is-empty'}" data-row-index="${rowIndex}" data-col-index="${c}" data-line-index="${rowIndex}" data-cell-ref="${ref}" data-value="${escapeHtml(value)}" title="${escapeHtml(ref+(value?` · ${value}`:''))}">${escapeHtml(value)}</td>`;}).join(''); return `<tr><th class="beta-sheet-row-head">${rowIndex+1}</th>${cells}</tr>`;}).join('');
  const truncated=lines.length>maxRows||Math.max(...lines.map(l=>(l.cells||[]).length))>maxCols; box.innerHTML=`<div class="beta-spreadsheet-toolbar"><strong>${escapeHtml(page.sheet||`Feuille ${pageNo}`)}</strong><span>${shown.length} ligne${shown.length>1?'s':''} · ${maxCols} colonne${maxCols>1?'s':''}${truncated?' · aperçu limité':''}</span><small>Cliquez une cellule pour reprendre sa valeur exacte. Vous pouvez aussi sélectionner une partie du texte puis utiliser « Utiliser la sélection ».</small></div><div class="beta-spreadsheet-scroll"><table class="beta-spreadsheet-grid"><thead><tr><th class="beta-sheet-corner"></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  box.querySelectorAll('.beta-spreadsheet-cell').forEach(cell=>cell.addEventListener('click',e=>{if(globalThis.getSelection?.()?.toString().trim())return;betaSelectSpreadsheetCell(cell);}));
}
function renderBetaLearningTextFallback(doc,pageNo,forceText=false){
  const textBox=$('#betaLearningText'); if(!textBox)return; if(!forceText&&betaLearningIsSpreadsheet(doc)){renderBetaSpreadsheetPreview(doc,pageNo);return;} const page=doc?.read?.pages?.find(p=>Number(p.page)===Number(pageNo))||doc?.read?.pages?.[0]; if(!page){textBox.innerHTML='<div class="empty-small">Aucun texte exploitable.</div>';return;}
  const lines=(page.lines||String(page.text||'').split(/\r?\n/).map((t,index)=>({text:t,index}))).filter(l=>String(l.text||'').trim()); textBox.innerHTML=lines.map((l,i)=>`<div class="beta-learning-line" data-line-index="${Number.isFinite(l.index)?l.index:i}">${escapeHtml(l.text||'')}</div>`).join('')||'<div class="empty-small">Aucun texte exploitable sur cette page.</div>';
}
function updateBetaPageNavState(){
  const select=$('#betaLearningPage'),prev=$('#betaPrevPage'),next=$('#betaNextPage');
  if(!select){if(prev)prev.disabled=true;if(next)next.disabled=true;return;}
  const idx=Math.max(0,select.selectedIndex);
  if(prev)prev.disabled=!select.options.length||idx<=0;
  if(next)next.disabled=!select.options.length||idx>=select.options.length-1;
}
async function changeBetaLearningPage(delta){
  const select=$('#betaLearningPage'); if(!select||!select.options.length)return;
  const idx=Math.max(0,select.selectedIndex),target=Math.min(select.options.length-1,Math.max(0,idx+delta));
  if(target===idx){updateBetaPageNavState();return;}
  select.selectedIndex=target;
  await renderBetaLearningPage();
  const stage=$('#betaPdfViewport'),fallback=$('#betaLearningText'); if(stage&&!stage.hidden)stage.scrollTop=0;if(fallback&&!fallback.hidden)fallback.scrollTop=0;
}
async function renderBetaLearningPage(){
  const doc=betaLearningDoc(),pageSelect=$('#betaLearningPage'),meta=$('#betaLearningMeta'),pdfTools=$('.beta-pdf-tools'); if(!doc||!pageSelect)return; const pages=doc.read?.pages||[]; const wanted=Number(pageSelect.value)||Number(pages[0]?.page)||1;
  pageSelect.innerHTML=pages.map(p=>`<option value="${Number(p.page)||1}" ${Number(p.page)===wanted?'selected':''}>${betaLearningIsSpreadsheet(doc)?'Feuille':'Page'} ${Number(p.page)||1}${p.sheet?` · ${escapeHtml(p.sheet)}`:''}</option>`).join(''); if([...pageSelect.options].some(o=>Number(o.value)===wanted))pageSelect.value=String(wanted);
  updateBetaPageNavState(); if(pdfTools)pdfTools.hidden=!betaLearningIsPdf(doc);
  const pageNo=Number(pageSelect.value)||1,page=pages.find(p=>Number(p.page)===pageNo)||pages[0]; if(meta)meta.textContent=betaLearningIsSpreadsheet(doc)?`${doc.name} · ${doc.type||'Tableur'} · feuille ${page?.sheet||pageNo} (${pageNo}/${pages.length})`:`${doc.name} · ${doc.type||'Document'} · page ${pageNo} / ${pages.length}`; betaPdfPreviewState.mode='native';betaPdfPreviewState.ocrWords=[];await renderBetaPdfPage({forceMode:'native'});
}
function syncBetaLearningDocument(preferredDocId='',preferredPage=null){
  const sel=$('#betaLearningDocument'); if(!sel)return; const docs=betaLearningDocs(); sel.innerHTML=docs.map(d=>`<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)} · ${escapeHtml(d.type||'Document')}</option>`).join(''); if(preferredDocId&&docs.some(d=>d.id===preferredDocId))sel.value=preferredDocId;else if(docs.length)sel.value=docs[0].id; const page=$('#betaLearningPage'); if(page&&preferredPage)page.value=String(preferredPage); renderBetaLearningPage();
}
function betaRangeRects(range,pageWrap){
  const pageRect=pageWrap.getBoundingClientRect(); if(!pageRect.width||!pageRect.height)return []; const rects=[];
  for(const r of range.getClientRects()){ if(r.width<1||r.height<1)continue; const x=Math.max(0,(r.left-pageRect.left)/pageRect.width),y=Math.max(0,(r.top-pageRect.top)/pageRect.height),w=Math.min(1-x,r.width/pageRect.width),h=Math.min(1-y,r.height/pageRect.height); if(w>0&&h>0)rects.push({x:Math.round(x*10000)/10000,y:Math.round(y*10000)/10000,w:Math.round(w*10000)/10000,h:Math.round(h*10000)/10000}); }
  return rects.slice(0,24);
}
function betaExactValueFromHighlight(selectedText,def){
  const exact=String(selectedText??'').replace(/\s+/g,' ').trim();
  if(!exact)return '';
  // « Valeur exacte » doit refléter le surlignage tel quel. La conversion métier
  // d'un champ numérique se fait seulement à la validation.
  return exact;
}
function betaParseCorrectedNumber(raw){
  const direct=parseFrNumber(raw); if(direct!==null)return direct;
  const txt=String(raw??'').replace(/\u00a0/g,' ');
  // Les unités (m², W/m².K, etc.) peuvent contenir d'autres chiffres : on prend
  // le premier nombre réellement surligné au lieu de concaténer tous les chiffres.
  const m=txt.match(/[+\-−]?\s*\d+(?:[\s\u00a0]\d{3})*(?:[.,]\d+)?/);
  if(!m)return null;
  return parseFrNumber(m[0].replace('−','-'));
}
function betaSetExactValueFromSelection(selectedText){
  const input=$('#betaErrorCorrectValue'),hint=$('#betaExactValueHint'),def=FIELD_MAP[$('#betaErrorDialog')?.dataset.field||''];
  if(!input)return;
  const exact=betaExactValueFromHighlight(selectedText,def);
  input.value=exact;
  input.classList.toggle('beta-value-from-highlight',!!exact);
  input.dataset.fromHighlight=exact?'1':'0';
  if(hint){hint.textContent=exact?`Valeur reprise du surlignage : « ${exact} »`:'Aucune valeur sélectionnée.';hint.classList.toggle('ok',!!exact);}
}
function captureBetaLearningSelection(){
  const doc=betaLearningDoc(),pageNo=Number($('#betaLearningPage')?.value)||1,selection=globalThis.getSelection?.(),pdfLayer=$('#betaPdfTextLayer'),fallback=$('#betaLearningText'),pageWrap=$('#betaPdfPage');
  if(!selection||selection.rangeCount<1||selection.isCollapsed){if(betaLearningIsSpreadsheet(doc)&&betaLearningSelection?.selectionMode==='spreadsheet-cell'){betaSetExactValueFromSelection(betaLearningSelection.selectedText);manualAnalysisAssignSelection(betaLearningSelection.selectedText);return;}$('#betaErrorFeedback').textContent=betaLearningIsSpreadsheet(doc)?'Cliquez une cellule ou sélectionnez la donnée correcte dans le tableur.':'Surlignez d’abord la donnée correcte directement dans la page PDF.';return;}
  const range=selection.getRangeAt(0),insidePdf=pdfLayer&&!pdfLayer.hidden&&pdfLayer.contains(range.commonAncestorContainer),insideFallback=fallback&&!fallback.hidden&&fallback.contains(range.commonAncestorContainer); if(!insidePdf&&!insideFallback){$('#betaErrorFeedback').textContent='Le surlignage doit être fait dans l’aperçu du document.';return;}
  const selectedText=selection.toString().replace(/\s+/g,' ').trim(); if(!selectedText){$('#betaErrorFeedback').textContent='Le surlignage est vide.';return;} const ctx=betaSelectionContext(doc,pageNo,selectedText); let rects=[];
  if(insidePdf&&pageWrap)rects=betaRangeRects(range,pageWrap);
  const bbox=rects.length?{x:Math.min(...rects.map(r=>r.x)),y:Math.min(...rects.map(r=>r.y)),x2:Math.max(...rects.map(r=>r.x+r.w)),y2:Math.max(...rects.map(r=>r.y+r.h))}:null;
  betaLearningSelection={docId:doc?.id||'',document:doc?.name||'',docType:doc?.type||'',page:pageNo,pageCount:doc?.read?.pages?.length||0,lineIndex:ctx.lineIndex,endLineIndex:ctx.lineIndex,lineCount:ctx.lineCount,selectedText,lineText:ctx.lineText,beforeLine:ctx.beforeLine,afterLine:ctx.afterLine,pageRatio:(doc?.read?.pages?.length?Math.round((pageNo/doc.read.pages.length)*1000)/1000:null),lineRatio:ctx.lineRatio,selectionMode:insidePdf?(betaPdfPreviewState.mode==='ocr'?'ocr':'pdf-text'):(betaLearningIsSpreadsheet(doc)?'spreadsheet-text':'text-fallback'),normalizedRects:rects,bboxNormalized:bbox?{x:bbox.x,y:bbox.y,w:Math.max(0,bbox.x2-bbox.x),h:Math.max(0,bbox.y2-bbox.y)}:null};
  if(rects.length)betaDrawSavedHighlight(rects);
  $('#betaLearningSelection').textContent=`Surligné : « ${selectedText} » · ${doc?.name||''} · p.${pageNo}${insidePdf?` · ${betaLearningSelection.selectionMode==='ocr'?'OCR':'texte PDF'}`:''}`;
  betaSetExactValueFromSelection(selectedText);
  manualAnalysisAssignSelection(selectedText);
  $('#betaErrorFeedback').textContent='';
}
async function betaEnsureOcrWorker(){
  if(betaPdfPreviewState.ocrWorker)return betaPdfPreviewState.ocrWorker; if(!globalThis.Tesseract?.createWorker)throw new Error('Tesseract.js n’est pas chargé.'); betaPdfStatus('Initialisation OCR…'); betaPdfPreviewState.ocrWorker=await globalThis.Tesseract.createWorker('fra+eng',1,{logger:m=>{if(m?.status==='recognizing text'&&Number.isFinite(m.progress))betaPdfStatus(`OCR de la page · ${Math.round(m.progress*100)} %`);}}); return betaPdfPreviewState.ocrWorker;
}
async function runBetaPageOcr(){
  const doc=betaLearningDoc(),pageNo=Number($('#betaLearningPage')?.value)||1;if(!doc||!betaLearningIsPdf(doc)){betaPdfStatus('OCR disponible uniquement pour les PDF.','warn');return;} const btn=$('#betaRunPageOcr');if(btn){btn.disabled=true;btn.textContent='OCR en cours…';}
  try{
    const pdf=await betaEnsurePdf(doc),page=await pdf.getPage(pageNo),base=page.getViewport({scale:1}),maxPixels=6500000,scale=Math.min(2.15,Math.sqrt(maxPixels/Math.max(1,base.width*base.height))),vp=page.getViewport({scale:Math.max(1.45,scale)}),ocrCanvas=document.createElement('canvas');ocrCanvas.width=Math.max(1,Math.round(vp.width));ocrCanvas.height=Math.max(1,Math.round(vp.height));const ctx=ocrCanvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,ocrCanvas.width,ocrCanvas.height);await page.render({canvasContext:ctx,viewport:vp,background:'white'}).promise; const worker=await betaEnsureOcrWorker(); betaPdfStatus('OCR de la page…'); const ret=await worker.recognize(ocrCanvas,{}, {text:true,blocks:true}); const words=flattenOcrWords(ret?.data?.blocks||[]); if(!words.length)throw new Error('Aucun mot exploitable détecté par OCR sur cette page.'); betaPdfPreviewState.mode='ocr';betaPdfPreviewState.ocrWords=words;betaPdfPreviewState.ocrSourceDims={width:ocrCanvas.width,height:ocrCanvas.height}; const viewport=betaPdfPreviewState.viewport; if(viewport)betaRenderOcrTextLayer(words,ocrCanvas.width,ocrCanvas.height,viewport);betaPdfStatus(`OCR actif · ${words.length} mots sélectionnables`,'ok');betaLearningSelection=null;betaClearSavedHighlight();$('#betaLearningSelection').textContent='Aucun surlignage sélectionné.';ocrCanvas.width=1;ocrCanvas.height=1;try{page.cleanup?.();}catch{}
  }catch(err){console.error('OCR correction page',err);betaPdfStatus(`OCR impossible : ${err?.message||err}`,'error');}
  finally{if(btn){btn.disabled=false;btn.textContent='OCR cette page';}}
}
async function restoreBetaNativeText(){ betaPdfPreviewState.mode='native';betaPdfPreviewState.ocrWords=[];await renderBetaPdfPage({forceMode:'native'}); }
function openBetaErrorDialog(building,field){
  setCorrectionDialogMode();
  if(!ownerBetaEnabled()||!state.result)return; const def=FIELD_MAP[field],ctx=betaResultContext(building,field),dlg=$('#betaErrorDialog'); if(!def||!ctx.row||!dlg)return; const src=ctx.source||{},missing=ctx.value===undefined||ctx.value===null||ctx.value===''; $('#betaErrorTitle').textContent=missing?'Renseigner une donnée manquante':'Corriger une donnée'; $('#betaErrorIntro').textContent=missing?'Choisissez la pièce puis surlignez directement la donnée correcte dans la page PDF. Utilisez l’OCR uniquement si la couche texte du PDF est mauvaise.':'Choisissez la pièce puis surlignez directement la bonne donnée dans la page PDF. ExtracTerre mémorisera le texte et sa position exacte.'; $('#betaErrorField').textContent=def.label||field;$('#betaErrorBuilding').textContent=building||'Bâtiment unique';$('#betaErrorDetected').textContent=missing?'Donnée vide':formatValue(ctx.value);$('#betaErrorSource').textContent=src.fileName?`${src.fileName}${src.page?` · p.${src.page}`:''}${Number.isFinite(src.confidence)?` · ${Math.round(src.confidence*100)} %`:''}`:'Aucune source retenue';$('#betaErrorExcerpt').textContent=src.excerpt||'Aucun extrait source disponible.';betaSetExactValueFromSelection('');$('#betaErrorReason').value=missing?'missing_data':'wrong_value';$('#betaErrorComment').value='';$('#betaApplyCorrection').checked=true;$('#betaErrorFeedback').textContent='';dlg.dataset.building=building;dlg.dataset.field=field;dlg.dataset.wasMissing=missing?'1':'0';betaLearningSelection=null;dlg.showModal();syncBetaLearningDocument(src.docId||'',src.page||null);
}
function closeBetaErrorDialog(){ const dlg=$('#betaErrorDialog');if(dlg?.open)dlg.close();betaLearningSelection=null;disposeBetaPdfPreview();setCorrectionDialogMode(); }
async function submitBetaError(){
  if(!ownerBetaEnabled())return; const dlg=$('#betaErrorDialog'),building=dlg?.dataset.building||'',field=dlg?.dataset.field||'',def=FIELD_MAP[field],ctx=betaResultContext(building,field);if(!dlg||!def||!ctx.row)return; const raw=($('#betaErrorCorrectValue')?.value||'').trim();let correctedValue=null,hasCorrection=!!raw;if(hasCorrection){if(def.type==='number'){const n=betaParseCorrectedNumber(raw);if(n===null){$('#betaErrorFeedback').textContent='La bonne valeur doit être numérique pour ce champ.';return;}correctedValue=n;}else correctedValue=field==='window_glazing'?(normalizeGlazingType(raw)||raw):raw;}if(!hasCorrection&&dlg.dataset.wasMissing==='1'){ $('#betaErrorFeedback').textContent='Pour renseigner une donnée vide, surlignez ou saisissez la bonne valeur.';return;} const src=ctx.source||{},chosenDoc=betaLearningDoc(),reason=$('#betaErrorReason')?.value||'other',comment=($('#betaErrorComment')?.value||'').trim(),loc=betaLearningSelection?{...betaLearningSelection}:null;
  const payload={beta:true,learningLocation:true,field,fieldLabel:def.label||field,building,wasMissing:dlg.dataset.wasMissing==='1',detectedValue:ctx.value??null,correctedValue:hasCorrection?correctedValue:null,hasCorrectedValue:hasCorrection,reason,comment,sourceDocument:src.fileName||'',sourceDocId:src.docId||'',sourcePage:src.page||null,sourceConfidence:Number.isFinite(src.confidence)?src.confidence:null,sourceMethod:src.method||'',sourceExcerpt:src.excerpt||'',sourceBuilding:src.originalBuilding||src.building||'',selectedSourceDocument:loc?.document||chosenDoc?.name||'',selectedSourceDocId:loc?.docId||chosenDoc?.id||'',selectedSourceDocType:loc?.docType||chosenDoc?.type||'',selectedSourcePage:loc?.page||Number($('#betaLearningPage')?.value)||null,highlight:loc,operation:activeProject()?.operationName||state.result?.operation||'',resultView:activeProject()?.resultView||'generic'};
  try{
    await recordLearningEvent(dlg.dataset.wasMissing==='1'?'beta_missing_data_location':'beta_result_error',payload,activeProject());
    if(loc){const learnPayload={field,fieldLabel:def.label||field,building,docType:loc.docType,document:loc.document,page:loc.page,pageRatio:loc.pageRatio,lineIndex:loc.lineIndex,lineRatio:loc.lineRatio,lineText:loc.lineText,beforeLine:loc.beforeLine,afterLine:loc.afterLine,selectedText:loc.selectedText,selectionMode:loc.selectionMode,normalizedRects:loc.normalizedRects,bboxNormalized:loc.bboxNormalized,correctedValue:hasCorrection?correctedValue:null,operation:payload.operation};const evt=await recordLearningEvent('parser_location_learning',learnPayload,activeProject());await reinforceLearningLocation(learnPayload,{eventId:evt.id,createdAt:evt.createdAt,field,docType:loc.docType,building});}
    const negativeReasons=new Set(['wrong_source','wrong_building','false_positive']),srcDoc=state.docs.find(d=>d.id===src.docId);if(dlg.dataset.wasMissing!=='1'&&negativeReasons.has(reason)&&src.docId&&srcDoc?.type){const rejectPayload={field,fieldLabel:def.label||field,building,docType:srcDoc.type,document:src.fileName||srcDoc.name,page:src.page||null,lineText:src.excerpt||'',selectedText:String(ctx.value??''),reason,operation:payload.operation};const evt=await recordLearningEvent('parser_location_rejection',rejectPayload,activeProject());await penalizeLearningLocation(rejectPayload,{eventId:evt.id,createdAt:evt.createdAt,field,docType:srcDoc.type,building});}
    if(hasCorrection&&$('#betaApplyCorrection')?.checked){const key=`${building}|${field}`,previous=ctx.value;state.manualValues[key]=correctedValue;state.manualSources[key]={docId:loc?.docId||chosenDoc?.id||src.docId||'',fileName:loc?.document||chosenDoc?.name||src.fileName||'Correction bêta',page:loc?.page||Number($('#betaLearningPage')?.value)||src.page||1,excerpt:loc?.lineText||loc?.selectedText||src.excerpt||'',method:`manual:${loc?.selectionMode||'highlight-learning'}`,provenanceNote:`Correction propriétaire par sélection documentaire — ${reason}`};applyManualValues();learn('manual_override',{building,field,previousValue:previous,newValue:correctedValue,source:betaLearningIsSpreadsheet(chosenDoc)?'spreadsheet_selection_learning':'pdf_highlight_learning',reason,highlight:loc},activeProject());refreshEconomic();scheduleWorkspaceCheckpoint('correction par sélection documentaire',80);}
    closeBetaErrorDialog();renderSummary();scheduleJournalUiRefresh();renderLearningMemoryUi();toast(dlg.dataset.wasMissing==='1'?'Donnée ajoutée et emplacement mémorisé.':'Correction appliquée et emplacement mémorisé.','success');
  }catch(err){$('#betaErrorFeedback').textContent=`Enregistrement impossible : ${err?.message||err}`;}
}

function rerunWithBuildingLinks(message='Regroupement des bâtiments mis à jour.'){
  const valid=state.docs.filter(d=>d.status==='ready'); if((!valid.length&&!state.manualPasteRows.length&&!hasRetainedData())||!state.result) return;
  state.result=analyzeDocuments(valid,state.rules,$('#operationName').value.trim(),state.buildingOverrides,manualPasteOccurrences()); applyDeletedBuildings(activeProject()); state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags); state.selfTests=runSelfTests(); renderAll(); scheduleWorkspaceCheckpoint('regroupement bâtiments',80); toast(message,'success');
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
  if(!state.result) return;
  const def=FIELD_MAP[field],row=state.result.rows.find(r=>r.building===building); if(!row||!def) return;
  const current=row[field]??'', prior=state.result.finals.find(o=>o.field===field&&(o.building===building||o.building==='Bâtiment unique'));
  const raw=prompt(`Corriger ${def.label} — ${building}`,String(current)); if(raw===null) return;
  let value=raw.trim(); if(def.type==='number'){ const n=parseFrNumber(value); if(n===null){ toast('Valeur numérique invalide.','error'); return; } value=n; }
  if(field==='window_glazing') value=normalizeGlazingType(value)||value; if(!value&&def.type!=='number') value='non précisé';
  state.manualValues[`${building}|${field}`]=value; delete state.manualSources[`${building}|${field}`];
  learn('manual_override',{building,field,label:def.label,previousValue:current,newValue:value,source:prior?{fileName:prior.fileName||'',docType:prior.docType||'',page:prior.page||'',confidence:prior.confidence,method:prior.method||'',excerpt:prior.excerpt||''}:null},activeProject());
  applyManualValues(); state.projectTags=buildProjectTags(state.docs.filter(d=>d.status==='ready'),state.result,state.manualTags); toast(`${def.label} corrigé pour ${building}. La correction sera conservée lors des compléments d’analyse.`,'success'); renderSummary(); renderOccurrences(); scheduleWorkspaceCheckpoint('correction manuelle',80);
}


function applyManualValuesToProject(project){
  const result=project?.result; if(!result) return;
  for(const [key,value] of Object.entries(project.manualValues||{})){
    const sep=key.indexOf('|'); if(sep<0) continue; const building=key.slice(0,sep), field=key.slice(sep+1); const row=result.rows.find(r=>r.building===building); if(!row) continue;
    row[field]=value; result.finals=result.finals.filter(o=>!(o.field===field&&o.building===building));
    result.detailed=result.detailed.filter(o=>!(o.field===field&&o.building===building&&String(o.method||'').startsWith('manual:')));
    const meta=project.manualSources?.[key]||{}; const manual={field,value,building,docId:meta.docId||'manual',fileName:meta.fileName||'Correction utilisateur',docType:'Correction manuelle',page:meta.page||'',excerpt:meta.excerpt||'Valeur corrigée manuellement dans la synthèse',confidence:1,method:meta.method||'manual:override',unit:meta.unit||'',sourceTier:'manual',status:'retenu',operation:result.operation,provenanceNote:meta.provenanceNote||''}; result.finals.push(manual); result.detailed.push(manual);
  }
  applyComparisonBases(result);
}
function applyManualValues(){ applyManualValuesToProject(activeProject()); }
function rebuildProjectFromCheckpoints(project){
  const valid=(project.docs||[]).filter(d=>d.status==='ready'&&Array.isArray(d.cachedOccurrences));
  if(!valid.length&&!(project.manualPasteRows||[]).length&&!(project.freePasteRows||[]).length&&!hasRetainedData(project)){ project.result=null; return; }
  project.result=analyzeDocuments(valid,state.rules,project.operationName||'',project.buildingOverrides||{},manualPasteOccurrences(project));
  applyDeletedBuildings(project); project.result.documentsCount=valid.length; applyManualValuesToProject(project);
  // Tags et économie calculés précédemment restent sauvegardés ; ils seront recalculés
  // automatiquement dès qu'un document est relu ou qu'une donnée est modifiée.
}
function refreshEconomic(project=activeProject()){ project.economic=analyzeEconomicData(project.docs,project.result?.operation||project.operationName||'',project.manualEconomics); return project.economic; }
// v2.5.0 — onglet Économie : nomenclature du questionnaire financier (2e feuille de l'export), modifiable champ par champ.
let economicShowAll=false;
function economicIdentity(project=activeProject()){
  const rows=project.result?.rows||[], v=project.economic?.values||{}; const first=k=>rows.map(r=>r[k]).find(x=>!isBlank(x));
  return {code:first('internal_code')??v.fin_operation_code??'',name:first('operation_name')??(project.operationName||project.result?.operation||v.fin_operation_label||'')};
}
function economicInput(f,v,manual){
  const shown=v===undefined||v===null?'':f.type==='number'?formatValue(v):String(v);
  return `<input class="eco-input ${manual?'manual':''}" data-eco-key="${f.key}" value="${escapeHtml(shown)}" placeholder="—" aria-label="${escapeHtml(f.label)}"${f.type==='number'?' inputmode="decimal"':''}>`;
}
function renderEconomic(wrap=$('#summaryView')){
  if(!wrap) return; const p=activeProject(); const e=refreshEconomic(p); const v=e.values||{}; const manual=new Set(e.manualKeys||[]); const id=economicIdentity(p);
  const filled=ECONOMIC_FIELDS.filter(f=>!isBlank(v[f.key])).length;
  const groups=ECONOMIC_GROUPS.map(g=>({...g,fields:ECONOMIC_FIELDS.filter(f=>f.group===g.id&&(economicShowAll||!isBlank(v[f.key])))})).filter(g=>g.fields.length);
  const lines=(rows,cols)=>`<div class="table-scroll"><table><thead><tr>${cols.map(c=>`<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${escapeHtml(formatValue(c[1](r)??''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  wrap.innerHTML=`<div class="project-detail-banner"><div><h3>${escapeHtml(projectTitle(p))}</h3><small>Données économiques · ${e.source?escapeHtml(e.source):'aucune source économique'}</small></div><button id="detailBackOverview" type="button">← Synthèse projets</button></div>
  <section class="eco-head"><div class="eco-ident"><span>Code interne</span><strong>${escapeHtml(id.code||'—')}</strong></div><div class="eco-ident"><span>Nom opération</span><strong>${escapeHtml(id.name||'—')}</strong></div>
  <div class="manual-filter-chips" role="group" aria-label="Colonnes affichées"><button type="button" class="manual-filter ${economicShowAll?'':'active'}" data-eco-all="0">Colonnes renseignées · ${filled}</button><button type="button" class="manual-filter ${economicShowAll?'active':''}" data-eco-all="1">Toutes les colonnes · ${ECONOMIC_FIELDS.length}</button></div></section>
  ${e.source?'':`<div class="empty-state"><h3>Aucune donnée économique</h3><p>Ajoutez la synthèse PDF du questionnaire financier Prestaterre (ou un DPGF), lancez l’analyse, ou saisissez les valeurs dans « Toutes les colonnes ».</p></div>`}
  ${groups.map(g=>`<section class="eco-group"><h4>${escapeHtml(g.label)}</h4><div class="eco-grid">${g.fields.map(f=>`<label class="eco-field"><span>${escapeHtml(f.label)}</span>${economicInput(f,v[f.key],manual.has(f.key))}</label>`).join('')}</div></section>`).join('')}
  ${e.costs?.length?`<details class="eco-group"><summary>Lignes de coûts lues · ${e.costs.length}</summary>${lines(e.costs,[['Source',r=>r.source],['Lot / poste',r=>r.label],['Catégorie',r=>COST_CATEGORIES.find(c=>c.id===r.category)?.label],['Montant HT',r=>r.amount],['Document',r=>r.document],['Page',r=>r.page]])}</details>`:''}
  ${e.aids?.length?`<details class="eco-group"><summary>Aides lues · ${e.aids.length}</summary>${lines(e.aids,[['Aide',r=>r.label],['Porteur',r=>r.level],['Calcul',r=>r.calc],['Montant',r=>r.amount],['Statut',r=>r.status],['Page',r=>r.page]])}</details>`:''}`;
  $('#detailBackOverview')?.addEventListener('click',showProjectsOverview);
  wrap.querySelectorAll('[data-eco-all]').forEach(b=>b.onclick=()=>{ economicShowAll=b.dataset.ecoAll==='1'; renderEconomic(wrap); });
  // Saisie : valeur vide = retour à la valeur lue ; nombres au format français.
  wrap.querySelectorAll('[data-eco-key]').forEach(i=>i.onchange=()=>{ const k=i.dataset.ecoKey, f=ECONOMIC_FIELD_MAP[k], raw=i.value.trim(); p.manualEconomics=p.manualEconomics||{};
    if(!raw) delete p.manualEconomics[k];
    else if(f.type==='number'){ const n=parseFrNumber(raw); if(n===null){ toast(`${f.label} : nombre invalide.`,'error'); i.value=''; return; } p.manualEconomics[k]=n; }
    else p.manualEconomics[k]=raw;
    renderEconomic(wrap); scheduleWorkspaceCheckpoint('donnée économique'); });
}

// v2.6.0 — onglet Recherches : grilles de critères modifiables (stockées sur ce poste), appliquées au projet actif.
const GRIDS_KEY='extracterre.searchGrids.v1', GRID_ACTIVE_KEY='extracterre.searchGrid.active';
let searchUi={editing:false,busy:''};
function loadGrids(){ let g=[]; try{ g=JSON.parse(localStorage.getItem(GRIDS_KEY)||'[]'); }catch{} g=Array.isArray(g)?g.map(normalizeGrid):[]; return g.length?g:[normalizeGrid(SECURITY_GRID)]; }
function saveGrids(gs){ try{ localStorage.setItem(GRIDS_KEY,JSON.stringify(gs)); }catch{ toast('Grilles non enregistrées : stockage local plein.','warn'); } }
function activeGrid(gs=loadGrids()){ let id=''; try{ id=localStorage.getItem(GRID_ACTIVE_KEY)||''; }catch{} return gs.find(g=>g.id===id)||gs[0]; }
function setActiveGrid(id){ try{ localStorage.setItem(GRID_ACTIVE_KEY,id); }catch{} }
function storeGrid(grid){ const gs=loadGrids(); const g=normalizeGrid(grid); const i=gs.findIndex(x=>x.id===g.id); if(i>=0) gs[i]=g; else gs.push(g); saveGrids(gs); setActiveGrid(g.id); return g; }
const searchCell=searchCellValue;
function renderSearchEditor(g){
  const crits=g.criteria, themes=g.themes, opt=(v,cur)=>`<option value="${escapeHtml(v)}" ${v===cur?'selected':''}>`;
  return `<section class="eco-group srch-editor"><h4>Paramétrage de la grille</h4>
  <div class="srch-grid-meta"><label>Nom<input data-g="name" value="${escapeHtml(g.name)}"></label><label>Limiter aux documents dont le nom ou le type contient <small>(virgules ; vide = tous)</small><input data-g="docFilter" value="${escapeHtml(g.docFilter)}" placeholder="ex. CCTP, menuiserie"></label>
  <label class="wide">Description<textarea data-g="description" rows="2">${escapeHtml(g.description)}</textarea></label></div>
  <h5>Thèmes</h5><div class="table-scroll"><table class="srch-table"><thead><tr><th>Thème</th><th>Critères à trouver (minimum)</th><th>Applicable seulement si</th></tr></thead><tbody>${themes.map((t,i)=>`<tr data-theme-row="${i}"><td><input data-t="name" value="${escapeHtml(t.name)}"></td><td><input data-t="min" type="number" min="0" value="${t.min}"></td><td><select data-t="applicableIf">${opt('',t.applicableIf)}toujours</option>${crits.map(c=>`${opt(c.id,t.applicableIf)}${escapeHtml(c.label.slice(0,70))}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
  <h5>Critères <small>mots-clés séparés par des virgules ; sans accents ni majuscules obligatoires ; « re: » = expression régulière</small></h5>
  <div class="srch-crits">${crits.map((c,i)=>`<div class="srch-crit" data-crit-row="${i}"><div class="srch-crit-head"><input data-c="theme" list="srchThemes" value="${escapeHtml(c.theme)}" placeholder="Thème"><input data-c="label" value="${escapeHtml(c.label)}" placeholder="Critère"><select data-c="kind">${Object.entries(SEARCH_KINDS).map(([k,l])=>`${opt(k,c.kind)}${l}</option>`).join('')}</select>
    <button type="button" class="btn light" data-srch-ai="${i}" title="Proposer des mots-clés, du contexte et des exclusions avec l’IA">${searchUi.busy===`c${i}`?'…':'✨ Mots-clés IA'}</button><button type="button" class="icon-btn" data-srch-del="${i}" title="Supprimer le critère" aria-label="Supprimer le critère">×</button></div>
    <div class="srch-crit-body"><label>Mots-clés / synonymes<textarea data-c="keywords" rows="2">${escapeHtml(c.keywords.join(', '))}</textarea></label><label>Contexte à proximité <small>(au moins un)</small><textarea data-c="context" rows="2">${escapeHtml(c.context.join(', '))}</textarea></label><label>Exclure si la ligne contient<textarea data-c="exclude" rows="2">${escapeHtml(c.exclude.join(', '))}</textarea></label>
    <div class="srch-crit-opts"><label>Fenêtre (lignes)<input data-c="window" type="number" min="0" max="15" value="${c.window}"></label>${c.kind==='number'?`<label>Unité<input data-c="unit" value="${escapeHtml(c.unit)}" placeholder="m, m2, lux"></label><label>Min<input data-c="min" value="${c.min??''}"></label><label>Max<input data-c="max" value="${c.max??''}"></label>`:''}<label class="chk"><input type="checkbox" data-c="required" ${themes.find(t=>t.name===c.theme)?.required.includes(c.id)?'checked':''}> Obligatoire dans le thème</label><label class="chk"><input type="checkbox" data-c="inverse" ${c.inverse?'checked':''}> Trouvé = indice contraire</label></div>
    <label>Précisions pour l’IA<input data-c="description" value="${escapeHtml(c.description)}" placeholder="ce que le critère doit couvrir, ce qu’il ne doit pas confondre"></label></div></div>`).join('')}</div>
  <datalist id="srchThemes">${themes.map(t=>`<option value="${escapeHtml(t.name)}">`).join('')}</datalist>
  <div class="srch-actions"><button type="button" class="btn secondary" data-srch="add-crit">+ Critère</button></div>
  <h5>Créer une nouvelle grille avec l’IA</h5><div class="srch-ai-grid"><textarea id="srchAiDesc" rows="3" placeholder="Décrivez la recherche, ex. « surface habitable de chaque logement dans les tableaux de surfaces, en m², avec le type T1 à T5 »"></textarea><button type="button" class="btn primary" data-srch="ai-grid">${searchUi.busy==='grid'?'Création…':'✨ Créer la grille'}</button></div>
  <small class="llm-hint">L’IA (Ollama en local si activé dans 🤖 IA) ne reçoit que la description des critères, jamais le contenu des documents. Vérifiez toujours les mots-clés proposés.</small></section>`;
}
function collectGridFromEditor(root,g){
  const val=(el,k)=>el.querySelector(`[data-${k}]`);
  const next={...g,name:root.querySelector('[data-g="name"]').value,docFilter:root.querySelector('[data-g="docFilter"]').value,description:root.querySelector('[data-g="description"]').value};
  const themes=[...root.querySelectorAll('[data-theme-row]')].map(r=>({name:r.querySelector('[data-t="name"]').value.trim(),min:r.querySelector('[data-t="min"]').value,applicableIf:r.querySelector('[data-t="applicableIf"]').value,required:[]}));
  // Renommage d'un thème : les critères suivent.
  g.themes.forEach((t,i)=>{ if(themes[i]&&themes[i].name&&themes[i].name!==t.name) for(const c of g.criteria) if(c.theme===t.name) c.theme=themes[i].name; });
  const crits=[...root.querySelectorAll('[data-crit-row]')].map(r=>{ const i=Number(r.dataset.critRow), c=g.criteria[i], f=k=>r.querySelector(`[data-c="${k}"]`);
    return {...c,theme:f('theme').value.trim()||c.theme,label:f('label').value,kind:f('kind').value,keywords:f('keywords').value,context:f('context').value,exclude:f('exclude').value,window:f('window').value,unit:f('unit')?.value??c.unit,min:f('min')?f('min').value:c.min,max:f('max')?f('max').value:c.max,inverse:f('inverse').checked,description:f('description').value,_req:f('required').checked}; });
  for(const t of themes) t.required=crits.filter(c=>c._req&&c.theme===t.name).map(c=>c.id);
  return normalizeGrid({...next,themes,criteria:crits});
}
async function searchAiKeywords(i,wrap){
  const g=activeGrid(); const c=g.criteria[i]; if(!c) return; searchUi.busy=`c${i}`; renderSearches(wrap);
  try{ const pr=keywordPrompt(c,g); const o=parseLlmObject(await llmComplete({system:pr.system,user:pr.user,maxTokens:800},{invokeFunction:invokeLlmCloudFunction}));
    const merge=(a,b)=>[...new Set([...a,...(Array.isArray(b)?b:[]).map(x=>String(x).trim()).filter(Boolean)])];
    const before=c.keywords.length+c.context.length+c.exclude.length;
    c.keywords=merge(c.keywords,o.keywords); c.context=merge(c.context,o.context); c.exclude=merge(c.exclude,o.exclude); storeGrid(g);
    toast(`${c.keywords.length+c.context.length+c.exclude.length-before} terme(s) proposé(s) pour « ${c.label} » : vérifiez-les avant d’analyser.`,'success'); learn('search_grid_ai',{grid:g.name,criterion:c.label},activeProject());
  }catch(err){ toast(`IA indisponible : ${err?.message||err}`,'error'); }
  finally{ searchUi.busy=''; renderSearches(wrap); }
}
async function searchAiGrid(desc,wrap){
  if(!desc.trim()){ toast('Décrivez d’abord la recherche à créer.','warn'); return; }
  searchUi.busy='grid'; renderSearches(wrap);
  try{ const pr=gridPrompt(desc.trim()); const o=parseLlmObject(await llmComplete({system:pr.system,user:pr.user,maxTokens:2500},{invokeFunction:invokeLlmCloudFunction}));
    const g=storeGrid({...o,id:`g${Date.now().toString(36)}`,description:desc.trim()}); if(!g.criteria.length) throw new Error('aucun critère proposé');
    searchUi.editing=true; toast(`Grille « ${g.name} » créée (${g.criteria.length} critère(s)) : relisez les mots-clés.`,'success'); learn('search_grid_ai',{grid:g.name,criteria:g.criteria.length},activeProject());
  }catch(err){ toast(`Création impossible : ${err?.message||err}`,'error'); }
  finally{ searchUi.busy=''; renderSearches(wrap); }
}
function renderSearches(wrap=$('#summaryView')){
  if(!wrap) return; const p=activeProject(); const gs=loadGrids(); const g=activeGrid(gs);
  const ov=(p.searchOverrides||{})[g.id]||{}; const r=runSearchGrid(g,p.docs||[],ov);
  const themeHtml=t=>{ const s=r.themes[t.name]||{}; const crits=g.criteria.filter(c=>c.theme===t.name);
    const verdict=s.applicable===false?'<span class="badge muted">Non applicable</span>':s.ok?'<span class="badge ok">Indices suffisants</span>':'<span class="badge warn">Indices insuffisants</span>';
    return `<section class="eco-group srch-theme"><h4>${escapeHtml(t.name)} <small>${s.found??0} / ${t.min} minimum${s.required?` · obligatoire${s.required>1?'s':''} : ${s.requiredOk?'trouvé':'non trouvé'}`:''}</small> ${verdict}</h4>
    ${crits.map(c=>{ const x=r.criteria[c.id]; const cls=x.manual?'manual':x.found?'ok':x.contrary?'contrary':'none'; const ic={ok:'✓',contrary:'✗',none:'·',manual:'✎'}[cls];
      return `<div class="srch-row ${cls}"><span class="srch-ic" aria-hidden="true">${ic}</span><div class="srch-main"><strong>${escapeHtml(c.label)}${t.required.includes(c.id)?' <em>(obligatoire)</em>':''}</strong>${searchCell(c,x)&&searchCell(c,x)!=='Oui'?`<span class="srch-val">${escapeHtml(searchCell(c,x))}</span>`:''}${c.description?`<small>${escapeHtml(c.description)}</small>`:''}
      ${x.evidence.length?`<details><summary>${x.evidence.length} citation(s)</summary><ul>${x.evidence.map(e=>`<li><b>${escapeHtml(e.doc)}</b> · p. ${e.page}${c.kind==='number'?` · ${escapeHtml(e.values.join(' ; '))}${e.ok?'':' (hors seuil)'}`:''}<br>${escapeHtml(e.line)}<small>${escapeHtml(e.context)}</small></li>`).join('')}</ul></details>`:''}</div>
      <select data-srch-ov="${c.id}" aria-label="Décision pour ${escapeHtml(c.label)}"><option value="">Auto</option>${['Oui','Non','Sans objet'].map(o=>`<option ${x.manual===o?'selected':''}>${o}</option>`).join('')}</select></div>`; }).join('')}</section>`; };
  wrap.innerHTML=`<div class="project-detail-banner"><div><h3>${escapeHtml(projectTitle(p))}</h3><small>Recherches personnalisées · ${r.documents.length} document(s) lu(s)${g.docFilter?` (filtre : ${escapeHtml(g.docFilter)})`:''}</small></div><button id="detailBackOverview" type="button">← Synthèse projets</button></div>
  <section class="srch-bar"><label>Grille <select id="srchGrid">${gs.map(x=>`<option value="${escapeHtml(x.id)}" ${x.id===g.id?'selected':''}>${escapeHtml(x.name)}</option>`).join('')}</select></label>
    <button type="button" class="btn ${searchUi.editing?'primary':'secondary'}" data-srch="edit">${searchUi.editing?'Fermer le paramétrage':'⚙ Paramétrer'}</button><button type="button" class="btn light" data-srch="new">+ Nouvelle</button><button type="button" class="btn light" data-srch="dup">Dupliquer</button>
    <button type="button" class="btn light" data-srch="export">Exporter (.json)</button><label class="btn light" for="srchImport">Importer</label><input id="srchImport" type="file" accept=".json,application/json" hidden><button type="button" class="btn light danger" data-srch="delete">Supprimer</button></section>
  ${g.description?`<p class="srch-desc">${escapeHtml(g.description)}</p>`:''}
  ${searchUi.editing?renderSearchEditor(g):''}
  ${!r.documents.length?`<div class="empty-state"><h3>Aucun document à lire</h3><p>Ajoutez et analysez des documents (CCTP, tableaux de surfaces…) dans ce projet${g.docFilter?`, dont le nom ou le type contient « ${escapeHtml(g.docFilter)} »`:''}.</p></div>`:''}
  ${g.themes.map(themeHtml).join('')}
  <small class="llm-hint">Chaque résultat cite le document, la page et la ligne. Les indices relevés ne valent pas conformité : vérifiez les citations ; « Auto » peut être remplacé par votre décision.</small>`;
  $('#detailBackOverview')?.addEventListener('click',showProjectsOverview);
  $('#srchGrid').onchange=e=>{ setActiveGrid(e.target.value); renderSearches(wrap); };
  wrap.querySelectorAll('[data-srch-ov]').forEach(sel=>sel.onchange=()=>{ p.searchOverrides=p.searchOverrides||{}; const o=p.searchOverrides[g.id]=p.searchOverrides[g.id]||{}; if(sel.value) o[sel.dataset.srchOv]=sel.value; else delete o[sel.dataset.srchOv]; renderSearches(wrap); scheduleWorkspaceCheckpoint('décision recherche'); });
  const act={edit:()=>{ searchUi.editing=!searchUi.editing; },
    new:()=>{ storeGrid({id:`g${Date.now().toString(36)}`,name:'Nouvelle recherche',themes:[{name:'Critères',min:1}],criteria:[{theme:'Critères',label:'Nouveau critère',keywords:[]}]}); searchUi.editing=true; },
    dup:()=>{ storeGrid({...g,id:`g${Date.now().toString(36)}`,name:`${g.name} (copie)`}); },
    export:()=>{ downloadBlob(new Blob([JSON.stringify(g,null,2)],{type:'application/json'}),`ExtracTerre_recherche_${g.name.replace(/[^\w-]+/g,'_')}.json`); },
    delete:()=>{ if(!confirm(`Supprimer la grille « ${g.name} » de ce poste ?`)) return; saveGrids(gs.filter(x=>x.id!==g.id)); },
    'add-crit':()=>{ const n=collectGridFromEditor(wrap,g); n.criteria.push({id:`c${Date.now().toString(36)}`,theme:n.themes[0]?.name||'Critères',label:'Nouveau critère',kind:'presence',keywords:[],context:[],exclude:[],window:4}); storeGrid(n); },
    'ai-grid':()=>{ searchAiGrid($('#srchAiDesc')?.value||'',wrap); return 'async'; }};
  wrap.querySelectorAll('[data-srch]').forEach(b=>b.onclick=()=>{ if(act[b.dataset.srch]?.()!=='async') renderSearches(wrap); });
  wrap.querySelectorAll('[data-srch-ai]').forEach(b=>b.onclick=()=>{ storeGrid(collectGridFromEditor(wrap,g)); searchAiKeywords(Number(b.dataset.srchAi),wrap); });
  wrap.querySelectorAll('[data-srch-del]').forEach(b=>b.onclick=()=>{ const n=collectGridFromEditor(wrap,g); n.criteria.splice(Number(b.dataset.srchDel),1); storeGrid(n); renderSearches(wrap); });
  const ed=wrap.querySelector('.srch-editor'); if(ed) ed.addEventListener('change',e=>{ if(e.target.id==='srchAiDesc') return; storeGrid(collectGridFromEditor(wrap,g)); renderSearches(wrap); });
  $('#srchImport').onchange=async e=>{ const f=e.target.files?.[0]; if(!f) return; try{ if(f.size>2*1024*1024) throw new Error('fichier trop volumineux'); const o=JSON.parse(await f.text()); const gg=normalizeGrid(o); if(!gg.criteria.length) throw new Error('aucun critère'); if(gs.some(x=>x.id===gg.id)) gg.id=`g${Date.now().toString(36)}`; storeGrid(gg); toast(`Grille « ${gg.name} » importée.`,'success'); }catch(err){ toast(`Grille illisible : ${err?.message||err}`,'error'); } renderSearches(wrap); };
}

// v2.7.0 — export JSON de la session (opérations, valeurs retenues et leurs sources, saisies, économie, recherches) ;
// le contenu des documents n'y figure pas. Version allégée (identité + recherches) pour l'observatoire des recherches.
function compactSearch(r){ return {criteria:Object.fromEntries(r.grid.criteria.map(c=>{ const x=r.criteria[c.id]; return [c.id,{found:x.found,contrary:!!x.contrary,manual:x.manual||'',value:searchCellValue(c,x),values:x.values,evidence:x.evidence.slice(0,5).map(e=>({doc:e.doc,page:e.page,line:e.line}))}]; })),themes:r.themes,documents:r.documents}; }
function sessionSnapshot({details=true}={}){
  const grids=loadGrids();
  return {format:'extracterre-session',schema:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),grids,
    operations:state.projects.filter(p=>!projectIsEmpty(p)).map(p=>{ const id=projectIdentity(p);
      const base={id:p.id,title:projectTitle(p),identity:id,completion:projectCompletion(p),profile:projectProfile(p),documents:(p.docs||[]).map(d=>({name:d.name,type:d.type,size:d.size,status:d.status})),
        searches:Object.fromEntries(grids.map(g=>[g.id,runSearchGrid(g,p.docs||[],p.searchOverrides?.[g.id]||{})]).filter(([,r])=>r.documents.length||Object.keys(p.searchOverrides?.[r.grid.id]||{}).length).map(([k,r])=>[k,compactSearch(r)]))}; // opérations sans document lu : pas de résultat de recherche
      if(!details) return base;
      return {...base,rows:p.result?.rows||[],finals:(p.result?.finals||[]).map(o=>({building:o.building,field:o.field,value:o.value,fileName:o.fileName,docType:o.docType,page:o.page,confidence:o.confidence,method:o.method,excerpt:o.excerpt})),
        manualValues:p.manualValues||{},manualPasteRows:p.manualPasteRows||[],freePasteRows:p.freePasteRows||[],economic:p.economic?.values||null,searchOverrides:p.searchOverrides||{}}; })};
}
function exportSessionJson(){
  const snap=sessionSnapshot(); if(!snap.operations.length){ toast('Aucune opération à exporter.','warn'); return; }
  downloadBlob(new Blob([JSON.stringify(snap,null,1)],{type:'application/json'}),`ExtracTerre_session_${new Date().toISOString().slice(0,10)}.json`);
  toast(`Session exportée : ${snap.operations.length} opération(s).`,'success');
}
// Observatoire des recherches (page à part, même origine) : on lui transmet la version allégée par le stockage local.
function openSearchObservatory(){
  try{ localStorage.setItem('extracterre.observatoire.feed',JSON.stringify(sessionSnapshot({details:false}))); }catch{ toast('Session trop volumineuse pour l’observatoire : exportez-la en JSON puis importez-la dans l’observatoire.','warn'); }
  window.open('observatoire.html','extracterre-observatoire');
}

// v2.6.0 — export Excel : opérations choisies une à une, par maître d'ouvrage, ou l'ensemble d'ExtracTerre.
function openExportDialog(){
  let dlg=$('#exportDialog'); if(!dlg){ dlg=document.createElement('dialog'); dlg.id='exportDialog'; dlg.className='llm-dialog export-dialog'; document.body.appendChild(dlg); }
  const items=state.projects.map(p=>({p,id:projectIdentity(p),pct:projectCompletion(p)})); const ownerOf=x=>x.id.owner||NO_OWNER;
  const owners=[...new Set(items.map(ownerOf))].sort((a,b)=>a===NO_OWNER?1:b===NO_OWNER?-1:a.localeCompare(b,'fr'));
  dlg.innerHTML=`<form method="dialog" class="llm-form"><header class="llm-head"><h2>⇩ Exporter vers Excel</h2><button value="cancel" class="icon-btn" type="submit" aria-label="Fermer">×</button></header>
  <div class="llm-body"><label class="exp-all"><input type="checkbox" id="expAll"> <strong>Tout ExtracTerre</strong> <small>${items.length} opération(s)</small></label>
  ${owners.map((o,gi)=>`<fieldset class="exp-group"><legend><label><input type="checkbox" data-exp-owner="${gi}"> ${escapeHtml(o)}</label></legend>${items.filter(x=>ownerOf(x)===o).map(x=>`<label class="exp-op ${x.p.result?'':'off'}"><input type="checkbox" data-exp-p="${x.p.id}" data-exp-g="${gi}" ${x.p.result?'':'disabled'} ${x.p.id===state.activeProjectId&&x.p.result?'checked':''}> <span><b>${escapeHtml(x.id.contract||'Contrat non renseigné')}</b> · ${escapeHtml(x.id.name||projectTitle(x.p))}</span><small>${x.p.result?`${x.pct} %`:'non analysée'}</small></label>`).join('')}</fieldset>`).join('')}</div>
  <footer class="llm-foot"><button value="cancel" class="btn light" type="submit">Annuler</button><button id="expGo" class="btn primary" type="button">Exporter</button></footer></form>`;
  const boxes=()=>[...dlg.querySelectorAll('[data-exp-p]:not(:disabled)')];
  const sync=()=>{ const sel=boxes().filter(b=>b.checked); dlg.querySelectorAll('[data-exp-owner]').forEach(g=>{ const bs=boxes().filter(b=>b.dataset.expG===g.dataset.expOwner); g.checked=bs.length>0&&bs.every(b=>b.checked); g.indeterminate=!g.checked&&bs.some(b=>b.checked); });
    const all=$('#expAll'); all.checked=boxes().length>0&&sel.length===boxes().length; all.indeterminate=!all.checked&&sel.length>0; $('#expGo').textContent=`Exporter ${sel.length} opération(s)`; $('#expGo').disabled=!sel.length; };
  $('#expAll').onchange=e=>{ boxes().forEach(b=>b.checked=e.target.checked); sync(); };
  dlg.querySelectorAll('[data-exp-owner]').forEach(g=>g.onchange=()=>{ boxes().filter(b=>b.dataset.expG===g.dataset.expOwner).forEach(b=>b.checked=g.checked); sync(); });
  boxes().forEach(b=>b.onchange=sync);
  $('#expGo').onclick=()=>{ const ids=new Set(boxes().filter(b=>b.checked).map(b=>b.dataset.expP)); try{ exportProjectsExcel(state.projects.filter(p=>ids.has(p.id)),state.rules,{grids:loadGrids(),identity:projectIdentity}); dlg.close(); }catch(e){ toast(e.message,'error'); } };
  sync(); dlg.showModal();
}

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
  learn('free_search_validation',{decision:'accept',building,field,label:def.label,value,source:{fileName:result.document,page:result.page,confidence:result.confidence,excerpt:result.excerpt||''}},activeProject());
  applyManualValues(); state.projectTags=buildProjectTags(state.docs.filter(d=>d.status==='ready'),state.result,state.manualTags); renderSummary(); renderOccurrences(); updateUxMirrors();
  if(dlg?.open) dlg.close(); scheduleWorkspaceCheckpoint('intégration recherche',80); toast(`${def.label} intégré au résultat pour ${building}.`,'success');
}
function renderSearchResults(){
  const q=$('#freeSearchInput').value.trim(), wrap=$('#searchResults'); if(!q){wrap.innerHTML='<div class="empty-small">Saisissez une donnée à rechercher.</div>';return;}
  const res=freeSearch(state.docs.filter(d=>d.status==='ready'),q); window.__freeSearchResults=res;
  wrap.innerHTML=res.length?`<div class="search-help-note">Les valeurs proposées ne sont jamais injectées automatiquement. Utilisez <b>Intégrer au résultat</b> pour choisir le champ et le bâtiment, puis validez.</div><div class="table-scroll"><table><thead><tr><th>Valeur probable</th><th>Document</th><th>Page</th><th>Bâtiment</th><th>Extrait</th><th>Confiance</th><th></th></tr></thead><tbody>${res.map((x,i)=>`<tr><td class="strong">${escapeHtml(x.value)}</td><td>${escapeHtml(x.document)}</td><td>${x.page}</td><td>${escapeHtml(x.building)}</td><td class="excerpt">${escapeHtml(x.excerpt)}</td><td>${Math.round(x.confidence*100)}%</td><td><button class="btn secondary search-integrate" data-search-index="${i}" type="button">＋ Intégrer au résultat</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-small">Aucun passage suffisamment pertinent.</div>';
  $$('#searchResults .search-integrate').forEach(b=>b.onclick=()=>{ const x=res[Number(b.dataset.searchIndex)]; if(x) openSearchIntegration(x,q); });
}


function updateUxMirrors(){ const manualCount=$('#manualDataCount'); if(manualCount){ const free=(activeProject().freePasteRows||[]).length; manualCount.textContent=`${state.manualPasteRows.length} ligne(s) de tableau${free?` · ${free} bâtiment(s) en collage libre`:''}`; } const docs=$('#projectMirrorDocs'); if(docs) docs.textContent=String(state.docs.length); const r=state.result; const values=$('#projectMirrorValues'); if(values) values.textContent=String(r?.finals?.length||0); const buildings=$('#projectMirrorBuildings'); if(buildings) buildings.textContent=String(r?.buildings?.length||r?.rows?.length||0); const alerts=$('#projectMirrorAlerts'); if(alerts) alerts.textContent=String(r?.alerts?.length||0); const status=$('#projectMirrorStatus'); if(status) status.textContent=$('#statusText')?.textContent||'Prêt'; }
function renderAll(){ renderFiles(); renderSummary(); renderHome(); renderResultWorkspaceControls(); renderOccurrences(); renderDiagnostics(); if(state.activeTab==='rules') renderRules(); $('#exportBtn').disabled=!state.projects.some(p=>p.result); const pending=state.docs.filter(d=>!!d.file&&!Array.isArray(d.cachedOccurrences)&&!['error','timeout'].includes(d.status)).length; const missing=state.docs.filter(d=>!d.file&&!Array.isArray(d.cachedOccurrences)&&d.status==='missing').length; const manualRows=state.manualPasteRows.length; const timedOut=state.docs.filter(d=>d.status==='timeout').length; $('#analyzeBtn').textContent=state.result?(pending?`▶ Analyser ${pending} nouveau${pending>1?'x':''} document${pending>1?'s':''} et compléter`:'↻ Recalculer la consolidation'):(manualRows?'▶ Consolider les données manuelles':missing&&!pending?`＋ Redéposer ${missing} fichier${missing>1?'s':''}`:'▶ Lancer l’analyse'); if(timedOut&&!pending&&state.result) $('#analyzeBtn').textContent='↻ Recalculer la consolidation'; $('#analyzeBtn').disabled=!state.result&&!pending&&!manualRows&&missing>0; updateUxMirrors(); }
function switchTab(name){ state.activeTab=name; if(name!=='summary'&&state.homeView) setHomeMode(false); $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); $$('.view').forEach(v=>v.hidden=v.id!==`${name}Panel`); const resultTabs=$('#resultTabsWrap'); if(resultTabs) resultTabs.hidden=name!=='summary'; const rulesWrap=$('#rulesActionWrap'); if(rulesWrap) rulesWrap.hidden=name!=='rules'; if(name==='rules') renderRules(); scheduleWorkspaceCheckpoint('onglet actif'); }

function renderPatchUi(){
  const list=$('#patchList'), status=$('#patchStatus'); if(!list) return;
  const patches=getImprovementPatches();
  if(status) status.textContent=`${patches.length} patch${patches.length>1?'s':''} actif${patches.length>1?'s':''}`;
  list.innerHTML=patches.length?patches.map(p=>`<div class="patch-row"><div><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.version)} · ${p.origin==='local'?'chargé localement':'fourni par le site'}</small></div>${p.origin==='local'?`<button class="btn light patch-remove" data-patch-id="${escapeHtml(p.id)}" type="button">Retirer</button>`:''}</div>`).join(''):'<div class="patch-empty">Aucun patch actif.</div>';
  list.querySelectorAll('.patch-remove').forEach(b=>b.onclick=()=>{removeLocalImprovementPatch(b.dataset.patchId);renderPatchUi();toast('Patch local retiré.','info');});
}
async function reapplyPatchesToReadyDocuments(){
  const project=activeProject();
  const ready=(project.docs||[]).filter(d=>d.status==='ready'&&d.read?.text);
  if(!ready.length) return 0;
  let count=0;
  for(const d of ready){
    try{
      d.classification=classifyForSelectedFamily(d);
      d.type=d.classification.type;
      d.buildings=detectBuildings(d);
      d.cachedOccurrences=parseDocument(d);
      d.analysisCachedAt=Date.now();
      await checkpointDocument(project,d);
      count++;
      await yieldToBrowser();
    }catch(err){ console.warn('Réapplication patch impossible',d?.name,err); }
  }
  if(count){
    const valid=(project.docs||[]).filter(d=>d.status==='ready');
    const operation=$('#operationName')?.value?.trim?.()||project.operationName||'';
    project.operationName=operation;
    project.result=analyzeDocuments(valid,state.rules,operation,project.buildingOverrides,manualPasteOccurrences(project));
    applyDeletedBuildings(project);
    project.result.documentsCount=valid.length;
    applyManualValues(); refreshEconomic(); project.projectTags=buildProjectTags(valid,project.result,project.manualTags);
    renderAll();
    await checkpointWorkspace('réapplication patch',true);
  }
  return count;
}
async function handlePatchFile(file){
  if(!file) return;
  try{
    const p=await importImprovementPatchFile(file);
    renderPatchUi();
    const reapplied=await reapplyPatchesToReadyDocuments();
    toast(reapplied?`Patch « ${p.title||p.id} » chargé et appliqué immédiatement à ${reapplied} document(s) déjà analysé(s).`:`Patch « ${p.title||p.id} » chargé. Il sera utilisé à la prochaine analyse.`,'success');
  }catch(err){toast(`Patch refusé : ${err.message||err}`,'error');}
}

// ---------------------------------------------------------------------------
// v2.3 — assistance IA (point 9 de l'audit) : secours sur les champs manquants d'un document.
// Les propositions sont vérifiées mot pour mot (llm-assist.js) puis présentées dans la même
// fenêtre ✓ / ✕ que le Crible fin ; rien n'entre dans le tableau sans validation humaine.
// ---------------------------------------------------------------------------
function ensureLlmDialog(){
  let dlg=$('#llmSettingsDialog'); if(dlg) return dlg;
  dlg=document.createElement('dialog'); dlg.id='llmSettingsDialog'; dlg.className='llm-dialog';
  document.body.appendChild(dlg); return dlg;
}
function openLlmSettings(onReady=null){
  const dlg=ensureLlmDialog(); const cfg=getLlmConfig();
  // v2.3.2 — structure en trois blocs : en-tête fixe, corps défilant, pied fixe (Enregistrer toujours visible).
  dlg.innerHTML=`<form method="dialog" class="llm-form">
  <header class="llm-head"><h2>🤖 Assistance IA — réglages</h2><button value="cancel" class="icon-btn llm-close" type="submit" aria-label="Fermer">×</button></header>
  <div class="llm-body">
    <p class="llm-warning" id="llmWarnCloud"><strong>Confidentialité :</strong> les pages du document qui mentionnent les champs manquants (texte uniquement, ${cfg.maxPages} pages max.) sont envoyées au modèle. N’activez pas cette fonction pour des pièces que le client n’autorise pas à transmettre à un service tiers.</p>
    <p class="llm-warning llm-local-ok" id="llmWarnLocal"><strong>IA locale :</strong> gratuite et sans clé ; le texte des pages est traité par Ollama sur cet ordinateur et n’est envoyé à aucun service extérieur. Plus lente qu’une IA en ligne sans carte graphique.</p>
    <div class="llm-grid">
      <label>Mode<select id="llmMode">${Object.entries(LLM_MODES).map(([k,l])=>`<option value="${k}" ${k===cfg.mode?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select></label>
      <label id="llmProviderWrap">Fournisseur<select id="llmProvider">${Object.entries(LLM_PROVIDERS).filter(([,p])=>!p.local).map(([k,p])=>`<option value="${k}" ${k===cfg.provider?'selected':''}>${escapeHtml(p.label)}</option>`).join('')}</select></label>
      <label>Modèle<input id="llmModel" value="${escapeHtml(cfg.model)}" spellcheck="false"></label>
      <label>Pages max. envoyées<input id="llmMaxPages" type="number" min="1" max="12" value="${cfg.maxPages}"></label>
    </div>
    <small class="llm-hint">Le modèle est modifiable : saisissez l’identifiant exact proposé par le fournisseur.</small>
    <div id="llmLocalWrap" class="llm-local">
      <div class="llm-local-row"><button id="llmOllamaTest" class="btn light" type="button">Tester la connexion</button><span id="llmOllamaState" class="llm-hint" aria-live="polite"></span></div>
      <details><summary>Installer Ollama (une seule fois)</summary><ol>
        <li>Télécharger et installer Ollama : <a href="https://ollama.com/download" target="_blank" rel="noopener">ollama.com/download</a>.</li>
        <li>Dans le Terminal (Mac) ou l’Invite de commandes (Windows), télécharger le modèle (≈ 5 Go) : <code>ollama pull qwen2.5:7b</code></li>
        <li>Autoriser ExtracTerre à interroger Ollama, puis quitter et relancer Ollama :<br>Mac : <code>launchctl setenv OLLAMA_ORIGINS "*"</code><br>Windows : <code>setx OLLAMA_ORIGINS "*"</code></li>
        <li>Cliquer « Tester la connexion ». Un autre modèle installé (mistral, llama3.1…) peut être saisi dans « Modèle ».</li>
      </ol></details>
    </div>
    <label id="llmKeyWrap"><span>Clé API <span id="llmKeyProvider"></span> — conservée pour cette session seulement</span><input id="llmKey" type="password" autocomplete="off"><small id="llmKeyState" class="llm-hint"></small></label>
    <label class="llm-consent"><input id="llmConsent" type="checkbox" ${llmConsentGiven()?'checked':''}> <span>J’ai compris que le texte des pages sélectionnées est transmis au modèle et que chaque proposition devra être validée.</span></label>
  </div>
  <footer class="llm-foot"><button value="cancel" class="btn light" type="submit">Annuler</button><button id="llmSave" value="default" class="btn primary" type="submit">Enregistrer</button></footer></form>`;
  let lastProvider=cfg.provider;
  const sync=()=>{ const local=$('#llmMode').value==='local', prov=local?'ollama':$('#llmProvider').value, p=LLM_PROVIDERS[prov];
    $('#llmKeyWrap').hidden=$('#llmMode').value!=='direct'; $('#llmProviderWrap').hidden=local; $('#llmLocalWrap').hidden=!local;
    $('#llmWarnCloud').hidden=local; $('#llmWarnLocal').hidden=!local;
    $('#llmKeyProvider').textContent=p.label; $('#llmKey').placeholder=p.keyHint;
    $('#llmKeyState').textContent=llmHasDirectKey(prov)?'Une clé est déjà enregistrée pour cette session (laisser vide pour la conserver).':'Aucune clé enregistrée pour cette session.';
    // Changement de fournisseur : on propose son modèle par défaut si l'utilisateur n'a pas personnalisé le champ.
    if(prov!==lastProvider){ const cur=$('#llmModel').value.trim(); if(!cur||cur===LLM_PROVIDERS[lastProvider]?.defaultModel) $('#llmModel').value=p.defaultModel; lastProvider=prov; } };
  $('#llmMode').onchange=sync; $('#llmProvider').onchange=sync; sync();
  $('#llmOllamaTest').onclick=async()=>{ const st=$('#llmOllamaState'), model=$('#llmModel').value.trim()||LLM_PROVIDERS.ollama.defaultModel; st.textContent='Test en cours…';
    const r=await checkOllama(model); st.textContent=!r.ok?r.error:r.hasModel?`✓ Ollama répond, modèle « ${model} » installé.`:`Ollama répond, mais « ${model} » n’est pas installé : ollama pull ${model}${r.models.length?` (installés : ${r.models.join(', ')})`:''}`; };
  $('#llmSave').onclick=e=>{ e.preventDefault(); const mode=$('#llmMode').value; const consent=$('#llmConsent').checked;
    if(mode!=='off'&&!consent){ toast('Cochez la case de consentement pour activer l’assistance IA.','warn'); return; }
    const provider=mode==='local'?'ollama':$('#llmProvider').value;
    saveLlmConfig({mode,provider,model:$('#llmModel').value.trim()||LLM_PROVIDERS[provider].defaultModel,maxPages:Number($('#llmMaxPages').value)||6}); setLlmConsent(consent);
    const key=$('#llmKey')?.value; if(key) setLlmDirectKey(key,provider);
    learn('llm_settings',{mode,provider,model:$('#llmModel').value.trim()},activeProject());
    dlg.close(); toast(mode==='off'?'Assistance IA désactivée.':`Assistance IA activée · ${LLM_PROVIDERS[provider].label}.`,'success'); if(mode!=='off'&&typeof onReady==='function') onReady(); };
  dlg.showModal();
}
async function llmAssistDocument(id){
  const doc=state.docs.find(x=>x.id===id); if(!doc||doc.status!=='ready') return;
  const cfg=getLlmConfig();
  if(cfg.mode==='off'||!llmConsentGiven()){ openLlmSettings(()=>llmAssistDocument(id)); return; }
  if(!state.result){ toast('Lancez d’abord l’analyse du projet.','warn'); return; }
  const docRows=state.result.rows||[];
  const missing=[...new Set(Object.keys(FIELD_MAP).filter(k=>docRows.some(r=>isMissingTableValue(r[k])&&!Object.prototype.hasOwnProperty.call(state.manualValues||{},`${r.building}|${k}`))))];
  doc.llmStatus='running'; renderFiles(); setStatus(`Assistance IA — ${doc.name}`,20);
  try{
    const res=await runLlmAssist(doc,{missingFields:missing,config:cfg,invokeFunction:invokeLlmCloudFunction});
    const candidates=buildTargetedCandidates(doc,doc,res.accepted);
    learn('llm_assist',{docId:doc.id,fileName:doc.name,docType:doc.type,provider:cfg.provider,model:cfg.model,mode:cfg.mode,fields:res.fields?.length||0,pages:res.pages||[],accepted:res.accepted.length,rejected:res.rejected.map(r=>({field:r.proposal?.field,value:r.proposal?.value,page:r.proposal?.page,reason:r.reason})),usage:res.usage||null},activeProject());
    setStatus(`Assistance IA terminée — ${candidates.length} proposition(s) vérifiée(s)`,100); setTimeout(()=>{ const p=$('#progress'); if(p) p.hidden=true; },900);
    if(res.note&&!res.accepted.length&&!res.rejected.length){ toast(res.note,'info'); return; }
    if(!candidates.length){ toast(`Aucune proposition exploitable${res.rejected.length?` (${res.rejected.length} rejetée(s) par la vérification littérale)`:''}.`,'info'); return; }
    showTargetedReview(doc,candidates,{pages:[]},{title:`Assistance IA (${LLM_PROVIDERS[cfg.provider]?.label||cfg.provider}) — ${doc.name}`,sub:`${candidates.length} proposition(s) dont la citation a été retrouvée mot pour mot dans le document${res.rejected.length?` · ${res.rejected.length} rejetée(s) automatiquement (citation introuvable ou valeur absente)`:''}. Confiance plafonnée à 85 % : chaque valeur doit être validée ✓ / ✕.`});
  }catch(err){ learn('analysis_error',{scope:'llm_assist',docId:doc.id,fileName:doc.name,error:err?.message||String(err)},activeProject()); toast(`Assistance IA impossible : ${err?.message||err}`,'error'); setStatus('Assistance IA interrompue'); }
  finally{ doc.llmStatus=null; renderFiles(); }
}

function wire(){
  const dz=$('#dropzone'), fi=$('#fileInput'), folderInput=$('#folderInput');
  $('#llmSettingsBtn')?.addEventListener('click',()=>openLlmSettings());
  // Les labels ouvrent nativement les sélecteurs Finder. Le clic sur le fond de la dropzone
  // ouvre aussi les fichiers, mais on ignore impérativement les inputs/labels : sinon input.click()
  // reboucle sur le gestionnaire parent et le sélecteur peut ne plus s'ouvrir.
  dz.addEventListener('click',e=>{
    if(e.target.closest('.drop-actions,input,button,label,select,a')) return;
    fi.click();
  });
  fi.addEventListener('click',e=>e.stopPropagation());
  folderInput?.addEventListener('click',e=>e.stopPropagation());
  for(const ev of ['dragenter','dragover']) dz.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';dz.classList.add('drag');});
  dz.addEventListener('dragleave',e=>{e.preventDefault();e.stopPropagation();if(!dz.contains(e.relatedTarget))dz.classList.remove('drag');});
  dz.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();dz.classList.remove('drag');try{const fs=await filesFromDrop(e.dataTransfer);if(fs?.length)addFiles(fs);}catch(err){toast(`Import impossible : ${err?.message||err}`,'error');}});
  dz.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fi.click(); } });
  fi.addEventListener('change',e=>{ addFiles(e.target.files||[]); fi.value=''; });
  const manualInput=$('#manualFileInput'); if(manualInput){ manualInput.addEventListener('click',e=>e.stopPropagation()); manualInput.addEventListener('change',e=>{ addFiles(e.target.files||[],null,{manualAnalysis:true}); manualInput.value=''; }); }
  if(folderInput) folderInput.addEventListener('change',e=>{ addFiles(e.target.files||[]); folderInput.value=''; });
  // v2.3 — une seule zone de dépôt ; la famille est détectée puis modifiable fichier par fichier.
  // Empêche le navigateur d'ouvrir un PDF/XML si un fichier est lâché hors de la zone.
  window.addEventListener('dragover',e=>{ if(e.dataTransfer?.types?.includes?.('Files')) e.preventDefault(); },true);
  window.addEventListener('drop',e=>{ if(!dz.contains(e.target)&&e.dataTransfer?.files?.length) e.preventDefault(); },true);
  $('#analyzeBtn').onclick=()=>analyze(); const manualAnalysisBtn=$('#manualAnalysisBtn'); if(manualAnalysisBtn) manualAnalysisBtn.onclick=openManualAnalysisDialog; const manualOpen=$('#manualDataBtn'); if(manualOpen) manualOpen.onclick=openManualDataDialog; const manualPaste=$('#manualDataPaste'); if(manualPaste) manualPaste.oninput=onManualPasteInput; const manualApply=$('#manualDataApply'); if(manualApply) manualApply.onclick=applyManualPaste; const manualClear=$('#manualDataClear'); if(manualClear) manualClear.onclick=clearManualPaste; const manualClose=$('#manualDataClose'); if(manualClose) manualClose.onclick=()=>$('#manualDataDialog')?.close(); const previewDlg=$('#filePreviewDialog'); const previewClose=$('#filePreviewClose'); if(previewClose) previewClose.onclick=()=>previewDlg?.close(); if(previewDlg){ previewDlg.addEventListener('close',closeFilePreview); previewDlg.addEventListener('cancel',()=>setTimeout(closeFilePreview,0)); } $('#newProjectBtn').onclick=addNewProject; const lockBtn=$('#lockBtn'); if(lockBtn) lockBtn.onclick=async()=>{ try{await checkpointWorkspace('verrouillage',true);await syncLearningJournalNow(false);}catch{} globalThis.__lockExtracterre?.(); }; $('#clearBtn').onclick=async()=>{ if(!confirm('Effacer la session locale ExtracTerre ? Les résultats et checkpoints du projet seront supprimés. Le journal d’amélioration et les règles de sources seront conservés.')) return; try{await clearWorkspaceSnapshot();}catch(err){toast(`Impossible d’effacer complètement la sauvegarde locale : ${err?.message||err}`,'warn');} state.projects=[createProject(1)];state.activeProjectId=state.projects[0].id;syncProjectInput();renderAll();lastLocalSaveAt=null;setLocalSaveUi('Session vide',null);await refreshJournalUi();toast('Session locale effacée. Le journal d’amélioration est conservé.','success');};
  const journalSync=$('#journalSyncBtn'); if(journalSync) journalSync.onclick=()=>syncLearningJournalNow(true);
  const learningRefresh=$('#learningMemoryRefresh'); if(learningRefresh) learningRefresh.onclick=()=>syncLearningMemoryFromRemote(true);
  const learningClear=$('#learningMemoryClear'); if(learningClear) learningClear.onclick=async()=>{ if(!confirm('Effacer toute la mémoire d’apprentissage locale de ce navigateur ? Le journal d’amélioration restera intact.')) return; await clearLearningMemory(); await renderLearningMemoryUi(); toast('Mémoire d’apprentissage locale effacée.','success'); };
  const journalPack=$('#journalPackBtn'); if(journalPack) journalPack.onclick=()=>requestJournalPackDownload();
  const journalConfig=$('#journalConfigBtn'); if(journalConfig) journalConfig.onclick=openJournalConfigDialog;
  const journalConfigClose=$('#journalConfigClose'); if(journalConfigClose) journalConfigClose.onclick=()=>$('#journalConfigDialog')?.close();
  const journalConfigSave=$('#journalConfigSave'); if(journalConfigSave) journalConfigSave.onclick=()=>saveJournalConfigFromDialog();
  const journalConfigTest=$('#journalConfigTest'); if(journalConfigTest) journalConfigTest.onclick=()=>testJournalConfigFromDialog();
  const journalConfigClear=$('#journalConfigClear'); if(journalConfigClear) journalConfigClear.onclick=()=>{ clearRemoteJournalConfig(); const cfg=getRemoteJournalConfig(); $('#journalSupabaseUrl').value=cfg.supabaseUrl||''; $('#journalSupabaseKey').value=cfg.supabaseAnonKey||''; const fb=$('#journalConfigFeedback'); if(fb){fb.textContent=cfg.configured?'Configuration du site restaurée.':'Configuration locale supprimée. Aucun journal partagé configuré dans le site.';fb.className='journal-config-feedback';} refreshJournalUi(); };
  const packClose=$('#journalPackPasswordClose'); if(packClose) packClose.onclick=()=>$('#journalPackPasswordDialog')?.close();
  const packSubmit=$('#journalPackPasswordSubmit'); if(packSubmit) packSubmit.onclick=()=>submitJournalPackPassword();
  const betaClose=$('#betaErrorClose'); if(betaClose) betaClose.onclick=closeBetaErrorDialog; const betaCancel=$('#betaErrorCancel'); if(betaCancel) betaCancel.onclick=closeBetaErrorDialog; const betaSubmit=$('#betaErrorSubmit'); if(betaSubmit) betaSubmit.onclick=submitBetaError; const betaDoc=$('#betaLearningDocument'); if(betaDoc) betaDoc.onchange=renderBetaLearningPage; const betaPage=$('#betaLearningPage'); if(betaPage) betaPage.onchange=renderBetaLearningPage; const betaPrev=$('#betaPrevPage'); if(betaPrev) betaPrev.onclick=()=>changeBetaLearningPage(-1); const betaNext=$('#betaNextPage'); if(betaNext) betaNext.onclick=()=>changeBetaLearningPage(1); const betaHighlight=$('#betaUseHighlight'); if(betaHighlight) betaHighlight.onclick=captureBetaLearningSelection; const betaOcr=$('#betaRunPageOcr'); if(betaOcr) betaOcr.onclick=runBetaPageOcr; const betaNative=$('#betaUseNativeText'); if(betaNative) betaNative.onclick=restoreBetaNativeText; const betaLayer=$('#betaPdfTextLayer'); if(betaLayer) betaLayer.addEventListener('mouseup',()=>{const sel=globalThis.getSelection?.(); if(sel&&!sel.isCollapsed&&betaLayer.contains(sel.anchorNode)) captureBetaLearningSelection();}); const betaFallback=$('#betaLearningText'); if(betaFallback) betaFallback.addEventListener('mouseup',()=>{const sel=globalThis.getSelection?.(); if(sel&&!sel.isCollapsed&&betaFallback.contains(sel.anchorNode)) captureBetaLearningSelection();}); const betaExact=$('#betaErrorCorrectValue'); if(betaExact) betaExact.addEventListener('input',()=>{betaExact.classList.remove('beta-value-from-highlight');betaExact.dataset.fromHighlight='0';const hint=$('#betaExactValueHint');if(hint){hint.textContent='Valeur modifiée manuellement.';hint.classList.remove('ok');}}); const betaDlg=$('#betaErrorDialog'); if(betaDlg) betaDlg.addEventListener('click',e=>{if(e.target===betaDlg) closeBetaErrorDialog();});
  const packInput=$('#journalPackPassword'); if(packInput) packInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitJournalPackPassword();}});
  window.addEventListener('extracterre-journal-sync',e=>{ lastJournalSyncAt=Date.now(); refreshJournalUi(); });
  $('#exportBtn').onclick=openExportDialog; $('#exportSessionBtn')?.addEventListener('click',exportSessionJson); $('#observatoryBtn')?.addEventListener('click',openSearchObservatory);
  $$('.tab').forEach(b=>b.onclick=()=>{ switchTab(b.dataset.tab); if(b.dataset.tab==='summary'){ state.overviewOwner=''; setHomeMode(true); } });
  const homeImport=$('#homeImport'); if(homeImport) homeImport.onchange=()=>{ addFiles([...homeImport.files]); homeImport.value=''; }; $$('.result-tab').forEach(b=>b.onclick=()=>{ state.resultWorkspaceMode='detail'; activeProject().resultView=b.dataset.resultView||'generic'; syncResultTabs(); renderSummary(); scheduleWorkspaceCheckpoint('onglet résultat'); }); $$('.sticky-result-tab').forEach(b=>b.onclick=()=>{state.resultWorkspaceMode='detail';activeProject().resultView=b.dataset.stickyResultView||'generic';switchTab('summary');renderSummary();scheduleWorkspaceCheckpoint('onglet résultat sticky');}); const stickyOverview=$('#stickyOverviewBtn'); if(stickyOverview) stickyOverview.onclick=showProjectsOverview; const stickySelect=$('#stickyProjectSelect'); if(stickySelect) stickySelect.onchange=()=>activateProject(stickySelect.value); const stickyPrev=$('#stickyPrevProject'); if(stickyPrev) stickyPrev.onclick=()=>moveProject(-1); const stickyNext=$('#stickyNextProject'); if(stickyNext) stickyNext.onclick=()=>moveProject(1); const stickyAnalyze=$('#stickyAnalyzeBtn'); if(stickyAnalyze) stickyAnalyze.onclick=()=>$('#analyzeBtn')?.click();
  $('#operationName').oninput=e=>{activeProject().operationName=e.target.value; scheduleWorkspaceCheckpoint('nom opération');};
  $('#occSearch').oninput=renderOccurrences; $('#occStatus').onchange=renderOccurrences; $('#freeSearchBtn').onclick=renderSearchResults; $('#freeSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')renderSearchResults();});
  const searchApply=$('#searchIntegrateApply'); if(searchApply) searchApply.onclick=applySearchIntegration; const searchClose=$('#searchIntegrateClose'); if(searchClose) searchClose.onclick=()=>$('#searchIntegrateDialog')?.close();
  $('#saveRules').onclick=()=>{ $$('#rulesView input[data-rule]').forEach(inp=>{ const k=inp.dataset.rule,p=inp.dataset.part; state.rules[k][p]=inp.value.split(';').map(s=>s.trim()).filter(Boolean); }); saveSourceRules(state.rules); toast('Règles de sources enregistrées.','success'); if(state.result){ const valid=state.docs.filter(d=>d.status==='ready'); state.result=analyzeDocuments(valid,state.rules,$('#operationName').value.trim(),state.buildingOverrides,manualPasteOccurrences()); applyDeletedBuildings(activeProject()); state.result.documentsCount=valid.length; applyManualValues(); refreshEconomic(); state.projectTags=buildProjectTags(valid,state.result,state.manualTags); } renderAll(); scheduleWorkspaceCheckpoint('règles de sources',80); };
  $('#resetRules').onclick=()=>{state.rules=resetSourceRules();renderRules();scheduleWorkspaceCheckpoint('règles par défaut',80);toast('Règles par défaut restaurées.','success');};
  const ocrMode=$('#ocrMode'); if(ocrMode){ const saved=localStorage.getItem('prestaterre-ocr-mode'); if(['auto','always','off'].includes(saved)) ocrMode.value=saved; ocrMode.onchange=()=>{localStorage.setItem('prestaterre-ocr-mode',ocrMode.value); const msg=ocrMode.value==='always'?'OCR renforcé : toutes les pages PDF seront vérifiées par Tesseract (plus lent).':ocrMode.value==='off'?'OCR désactivé pour les prochains documents.':'OCR automatique : Tesseract intervient seulement sur les pages difficiles.'; toast(msg,'info');}; }
  const analysisMode=$('#analysisMode'); if(analysisMode){
    const saved=localStorage.getItem('extracterre-analysis-mode'); if(ANALYSIS_MODES[saved]) analysisMode.value=saved; else analysisMode.value=DEFAULT_ANALYSIS_MODE;
    const syncModeInfo=()=>{ const p=ANALYSIS_MODES[analysisMode.value]||ANALYSIS_MODES[DEFAULT_ANALYSIS_MODE]; const detail=$('#analysisModeDetail'); if(detail) detail.textContent=`Mode ${p.label.toLowerCase()} · ${p.description}`; };
    analysisMode.onchange=()=>{ localStorage.setItem('extracterre-analysis-mode',analysisMode.value); syncModeInfo(); const p=ANALYSIS_MODES[analysisMode.value]; toast(p.key==='fast'?`Mode rapide : ${p.description}. Consommation mémoire plus élevée.`:`Mode ${p.label.toLowerCase()} : ${p.description}.`,'info'); };
    syncModeInfo();
  }
  const executionMode=$('#executionMode'); if(executionMode){
    executionMode.value=getExecutionMode();
    executionMode.onchange=()=>{ const mode=setExecutionMode(executionMode.value); executionMode.value=mode; syncCloudModeUi(); const cfg=CLOUD_MODES[mode]; toast(`Calcul ${cfg.label.toLowerCase()} : ${cfg.description}.`,'info'); };
    syncCloudModeUi();
  }
  const cloudBtn=$('#cloudConnectionBtn'); if(cloudBtn) cloudBtn.onclick=openCloudDialog;
  const cloudClose=$('#cloudDialogClose'); if(cloudClose) cloudClose.onclick=()=>$('#cloudDialog')?.close();
  const cloudLogin=$('#cloudSignInBtn'); if(cloudLogin) cloudLogin.onclick=signInCloudFromDialog;
  const cloudLogout=$('#cloudSignOutBtn'); if(cloudLogout) cloudLogout.onclick=signOutCloudFromDialog;
  const cloudSave=$('#cloudConfigSave'); if(cloudSave) cloudSave.onclick=saveCloudConfigFromDialog;
  const cloudReset=$('#cloudConfigReset'); if(cloudReset) cloudReset.onclick=resetCloudConfigFromDialog;
  const cloudPassword=$('#cloudPassword'); if(cloudPassword) cloudPassword.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();signInCloudFromDialog();}});
  const patchBtn=$('#patchLoadBtn'), patchInput=$('#patchFileInput'); if(patchBtn&&patchInput){patchBtn.onclick=()=>patchInput.click();patchInput.onchange=async()=>{await handlePatchFile(patchInput.files?.[0]);patchInput.value='';};}
  renderPatchUi();
  $('#version').textContent=`v${APP_VERSION}`; syncProjectInput(); libraryCheck();
}

async function initializeApp(){
  if(!globalThis.__extracterreAccessPromise) throw new Error('Le contrôle d’accès ExtracTerre n’a pas été initialisé.');
  await globalThis.__extracterreAccessPromise;
  try{await initializeLearningMemory();}catch(err){console.warn('Learning memory init failed',err);}
  await initializeImprovementPatches();
  wire(); setLocalSaveUi('Recherche de session…');
  try{
    const restored=await loadWorkspaceSnapshot();
    if(restored?.projects?.length&&meaningfulWorkspace(restored.projects)){
      restoringWorkspace=true;
      state.projects=restored.projects;
      state.activeProjectId=state.projects.some(p=>p.id===restored.activeProjectId)?restored.activeProjectId:state.projects[0].id; state.resultWorkspaceMode=restored.resultWorkspaceMode||'overview';
      // v2.5.0 — l'ancien onglet latéral « Données économiques » est devenu l'onglet de résultats « Économie ».
      state.activeTab=restored.activeTab==='economics'?'summary':(restored.activeTab||'summary');
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
  syncProjectInput(); renderAll(); switchTab(state.activeTab||'summary'); setHomeMode(true); refreshLocalStorageInfo(); await refreshCloudUi(false); await refreshJournalUi(); await renderLearningMemoryUi(); if(getRemoteJournalConfig().configured) syncLearningJournalNow(false); window.__prestaterreExtractReady=true;
}
initializeApp();
