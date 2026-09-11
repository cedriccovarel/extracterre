import {APP_VERSION,FIELD_MAP} from './config.js';
import {appendLearningEvent,listLearningEvents,getLearningJournalStats,markLearningEventsSynced,markLearningEventsSyncError} from './persistence.js';

const REMOTE_OVERRIDE_KEY='extracterre-journal-remote-config-v1';
const INSTANCE_KEY='extracterre-learning-instance-v1';
let syncTimer=null,syncInFlight=null;

function safeClone(value,fallback={}){ try{return JSON.parse(JSON.stringify(value));}catch{return fallback;} }
function getInstanceId(){
  try{
    let id=localStorage.getItem(INSTANCE_KEY);
    if(!id){ id=globalThis.crypto?.randomUUID?.()||`browser-${Date.now()}-${Math.random().toString(36).slice(2,10)}`; localStorage.setItem(INSTANCE_KEY,id); }
    return id;
  }catch{return `browser-${Math.random().toString(36).slice(2,10)}`;}
}
function cleanSupabaseUrl(url=''){ return String(url||'').trim().replace(/\/+$/,''); }
export function getRemoteJournalConfig(){
  const base=globalThis.EXTRACTERRE_JOURNAL_CONFIG||{};
  let local={};
  try{ local=JSON.parse(localStorage.getItem(REMOTE_OVERRIDE_KEY)||'{}')||{}; }catch{}
  const supabaseUrl=cleanSupabaseUrl(local.supabaseUrl||base.supabaseUrl||'');
  const supabaseAnonKey=String(local.supabaseAnonKey||base.supabaseAnonKey||'').trim();
  return {supabaseUrl,supabaseAnonKey,configured:!!(supabaseUrl&&supabaseAnonKey)};
}
export function saveRemoteJournalConfig(config={}){
  const record={supabaseUrl:cleanSupabaseUrl(config.supabaseUrl),supabaseAnonKey:String(config.supabaseAnonKey||'').trim()};
  localStorage.setItem(REMOTE_OVERRIDE_KEY,JSON.stringify(record));
  return getRemoteJournalConfig();
}
export function clearRemoteJournalConfig(){ localStorage.removeItem(REMOTE_OVERRIDE_KEY); return getRemoteJournalConfig(); }
function accessContext(){ return globalThis.__extracterreGetAccessContext?.()||null; }
async function remoteRpc(functionName,args){
  const cfg=getRemoteJournalConfig();
  if(!cfg.configured) throw new Error('Journal partagé non configuré.');
  const response=await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${functionName}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':cfg.supabaseAnonKey},
    body:JSON.stringify(args||{})
  });
  const text=await response.text();
  let data=null; try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!response.ok) throw new Error(typeof data==='object'?(data?.message||data?.error||JSON.stringify(data)):String(data||`HTTP ${response.status}`));
  return data;
}
function projectRef(project){ return String(project?.id||''); }
export async function recordLearningEvent(eventType,payload={},project=null,{sync=true}={}){
  const ctx=accessContext();
  const record=await appendLearningEvent({
    eventType, payload:safeClone(payload,{}), projectRef:projectRef(project), instanceId:getInstanceId(), accessRole:ctx?.role||''
  });
  if(sync) scheduleJournalSync();
  return record;
}
export function scheduleJournalSync(delay=1300){
  if(!getRemoteJournalConfig().configured) return;
  if(syncTimer) clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{syncTimer=null;flushLearningJournal().catch(()=>{});},Math.max(100,delay));
}
export async function flushLearningJournal(){
  if(syncInFlight) return syncInFlight;
  const cfg=getRemoteJournalConfig(),ctx=accessContext();
  if(!cfg.configured) return {configured:false,sent:0};
  if(!ctx?.journalProof) return {configured:true,sent:0,error:'Contexte d’accès indisponible'};
  syncInFlight=(async()=>{
    let sent=0;
    while(true){
      const pending=(await listLearningEvents({unsyncedOnly:true,limit:100})).slice(0,100);
      if(!pending.length) break;
      try{
        const payload=pending.map(({id,schema,appVersion,createdAt,eventType,projectRef,instanceId,accessRole,payload})=>({id,schema,appVersion,createdAt,eventType,projectRef,instanceId,accessRole,payload}));
        await remoteRpc('extracterre_journal_append',{p_proof:ctx.journalProof,p_events:payload});
        await markLearningEventsSynced(pending.map(x=>x.id),Date.now()); sent+=pending.length;
      }catch(err){ await markLearningEventsSyncError(pending.map(x=>x.id),err?.message||String(err)); throw err; }
    }
    const result={configured:true,sent};
    try{globalThis.dispatchEvent?.(new CustomEvent('extracterre-journal-sync',{detail:result}));}catch{}
    return result;
  })();
  try{return await syncInFlight;}finally{syncInFlight=null;}
}
export async function testRemoteJournalConnection(){
  const ctx=accessContext(); if(!ctx?.journalProof) throw new Error('Session d’accès introuvable.');
  const data=await remoteRpc('extracterre_journal_status',{p_proof:ctx.journalProof});
  return data||{ok:true};
}
export async function getLearningJournalOverview(){
  const local=await getLearningJournalStats(); const cfg=getRemoteJournalConfig();
  return {...local,remoteConfigured:cfg.configured};
}
async function exportRemoteJournal(packProof=''){
  const cfg=getRemoteJournalConfig(),ctx=accessContext();
  if(!cfg.configured||!ctx?.journalProof) return [];
  const data=await remoteRpc('extracterre_journal_export',{p_proof:ctx.journalProof,p_pack_proof:String(packProof||'')});
  if(Array.isArray(data)) return data;
  if(Array.isArray(data?.events)) return data.events;
  return [];
}
function eventSummary(events=[]){
  const byType={},byVersion={},fieldCorrections={}; let accepted=0,rejected=0,errors=0,totalAnalysisMs=0,analysisDocs=0;
  for(const e of events){
    byType[e.eventType]=(byType[e.eventType]||0)+1; byVersion[e.appVersion]=(byVersion[e.appVersion]||0)+1;
    const p=e.payload||{};
    if(e.eventType==='manual_override'&&p.field) fieldCorrections[p.field]=(fieldCorrections[p.field]||0)+1;
    if(/decision|validation/.test(e.eventType)){ if(p.decision==='accept'||p.accepted===true) accepted++; if(p.decision==='reject'||p.accepted===false) rejected++; }
    if(e.eventType==='analysis_error') errors++;
    if(e.eventType==='analysis_document'&&Number.isFinite(Number(p.durationMs))){totalAnalysisMs+=Number(p.durationMs);analysisDocs++;}
  }
  const mostCorrected=Object.entries(fieldCorrections).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([field,count])=>({field,label:FIELD_MAP[field]?.label||field,count}));
  return {events:events.length,byType,byVersion,accepted,rejected,errors,analysisDocs,meanAnalysisDurationMs:analysisDocs?Math.round(totalAnalysisMs/analysisDocs):null,mostCorrectedFields:mostCorrected};
}
function pretty(value){ return JSON.stringify(value,null,2); }
function improvementPrompt(summary){
return `# PROMPT — Amélioration continue d’ExtracTerre\n\nJe joins à ce nouveau chat :\n1. le dernier ZIP complet d’ExtracTerre ;\n2. ce pack de journal d’amélioration généré par l’application.\n\n## Mission\n\nAnalyse d’abord le code de la dernière version d’ExtracTerre puis l’intégralité du journal. Utilise les validations, rejets, corrections manuelles, champs manquants, Cribles fins, erreurs et mesures de performance pour produire une nouvelle version réellement meilleure.\n\nLes objectifs sont, dans cet ordre :\n- augmenter la fiabilité des extractions et réduire les faux positifs ;\n- récupérer davantage de données réellement présentes dans les documents sans inventer ;\n- améliorer les parseurs spécialisés, les tags, les normalisations et la hiérarchie de sources à partir des cas observés ;\n- réduire le recours à l’OCR intégral et privilégier lecture structurée puis OCR ciblé ;\n- améliorer la rapidité globale, la consommation mémoire et la stabilité sur de gros lots ;\n- exploiter les corrections récurrentes comme cas de régression permanents ;\n- conserver les comportements qui fonctionnent déjà.\n\n## Contraintes à ne pas casser\n\n- Conserver exactement le schéma métier actuel de 167 colonnes et leur ordre dans l’export Excel, sauf demande explicite contraire de ma part.\n- Ne jamais fabriquer une valeur absente des sources : tolérance d’hallucination = 0.\n- Respecter les priorités de sources configurées par champ.\n- Conserver le système de confiance, les candidats à vérifier et le Crible fin.\n- Conserver le checkpoint IndexedDB, le pool d’analyse borné, la libération mémoire et le journal d’amélioration.\n- Ne jamais mettre les mots de passe en clair dans les fichiers livrés.\n- L’Excel doit continuer à exporter l’ensemble du tableau, même si l’interface répartit les résultats en onglets métier.\n\n## Méthode attendue\n\n1. Établis les statistiques du journal : corrections les plus fréquentes, champs souvent absents, sources/types de documents responsables, faux positifs, validations et temps d’analyse.\n2. Regroupe les problèmes par cause racine plutôt que d’ajouter des rustines document par document.\n3. Modifie les parseurs/dictionnaires/règles nécessaires dans le code de la dernière version jointe.\n4. Pour chaque motif récurrent corrigé, ajoute un test de régression.\n5. Vérifie les tests historiques et les nouveaux tests. Une amélioration ne doit pas faire régresser un cas déjà validé.\n6. Vérifie particulièrement les performances : parsing parallèle borné, OCR ciblé, destruction des ressources PDF/canvas, absence de duplication massive en mémoire.\n7. Mets à jour VERSION, CHANGELOG, README et TESTS.\n8. Livre le ZIP complet de la nouvelle version, pas seulement des fichiers de patch.\n\n## Informations synthétiques du pack\n\n${pretty(summary)}\n\nCommence par analyser les causes récurrentes visibles dans le journal et applique directement les améliorations les plus rentables en efficacité, fiabilité et rapidité.\n`;
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function downloadLearningImprovementPack({packProof='',skipRemote=false}={}){
  if(!globalThis.JSZip) throw new Error('JSZip indisponible : impossible de construire le pack d’amélioration.');
  const ctx=accessContext();
  if(ctx?.role==='team'&&!(await globalThis.__extracterreAuthorizePackProof?.(packProof))) throw new Error('Autorisation pack requise.');
  let remote=[]; let remoteError='';
  if(!skipRemote){ try{remote=await exportRemoteJournal(packProof);}catch(err){remoteError=err?.message||String(err); throw err;} }
  const local=await listLearningEvents({limit:50000});
  const merged=new Map(); for(const e of remote) if(e?.id) merged.set(e.id,e); for(const e of local) if(e?.id) merged.set(e.id,e);
  const events=[...merged.values()].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const summary=eventSummary(events);
  const now=new Date();
  const manifest={packSchema:1,generatedAt:now.toISOString(),appVersion:APP_VERSION,events:events.length,localEvents:local.length,remoteEvents:remote.length,remoteConfigured:getRemoteJournalConfig().configured,remoteError:remoteError||null,summary};
  const corrections=events.filter(e=>e.eventType==='manual_override');
  const decisions=events.filter(e=>['uncertain_decision','targeted_decision','free_search_validation'].includes(e.eventType));
  const performance=events.filter(e=>['analysis_document','analysis_batch','analysis_error'].includes(e.eventType));
  const missing=events.filter(e=>e.eventType==='analysis_batch'&&(e.payload?.missingFields?.length||e.payload?.completeness));
  const errors=events.filter(e=>e.eventType==='analysis_error');
  const zip=new JSZip();
  zip.file('PROMPT_NOUVEAU_CHAT.md',improvementPrompt(summary));
  zip.file('manifest.json',pretty(manifest));
  zip.file('journal_complet.json',pretty(events));
  zip.file('corrections_manuelles.json',pretty(corrections));
  zip.file('validations_rejets.json',pretty(decisions));
  zip.file('performances.json',pretty(performance));
  zip.file('donnees_manquantes.json',pretty(missing));
  zip.file('erreurs.json',pretty(errors));
  zip.file('README_PACK.md',`# Pack d’amélioration ExtracTerre\n\nCe pack est généré automatiquement depuis le journal d’apprentissage local et, lorsqu’il est configuré, le journal partagé multi-ordinateurs.\n\nIl ne contient pas les PDF originaux. Il contient les événements utiles à l’amélioration du moteur : corrections, validations/rejets, résultats de Crible fin, champs manquants, temps d’analyse et erreurs techniques.\n\nPour une nouvelle itération, joignez ce pack et le dernier ZIP complet d’ExtracTerre dans un nouveau chat. Le fichier PROMPT_NOUVEAU_CHAT.md indique la mission à exécuter.\n`);
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  const stamp=now.toISOString().slice(0,10).replaceAll('-','');
  const name=`ExtracTerre_Journal_Amelioration_${stamp}.zip`; downloadBlob(blob,name);
  return {name,manifest};
}
