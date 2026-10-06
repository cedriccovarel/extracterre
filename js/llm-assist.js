// ExtracTerre v2.3 — assistance IA en secours, avec vérification littérale.
// Règles non négociables :
//  1. le modèle ne propose que des champs autorisés pour la famille du document et absents du tableau ;
//  2. chaque proposition doit citer un extrait qui figure MOT POUR MOT dans la page indiquée ;
//  3. la valeur doit apparaître dans cet extrait ;
//  4. une proposition acceptée plafonne à 85 % : elle ne remplit jamais le tableau seule et passe
//     obligatoirement par la validation ✓ / ✕ (même fenêtre que le Crible fin).
import {FIELD_MAP} from './config.js';
import {normalizeText,normLower,parseFrNumber,numbersIn} from './utils.js';
import {canonicalBuilding} from './buildings.js';
import {resolveDocumentFamilies,FAMILY_ALLOWED_FIELDS} from './parsers.js';

const LLM_CONFIG_KEY='extracterre.llm.v1';
const LLM_DIRECT_KEY_PREFIX='extracterre.llm.directKey.';
const LLM_CONSENT_KEY='extracterre.llm.consent.v1';
export const LLM_PROVIDERS=Object.freeze({
  openai:{label:'ChatGPT (OpenAI)',defaultModel:'gpt-5.4-mini',keyHint:'sk-…',endpoint:'https://api.openai.com/v1/chat/completions'},
  gemini:{label:'Gemini (Google)',defaultModel:'gemini-3.5-flash',keyHint:'AIza…',endpoint:'https://generativelanguage.googleapis.com/v1beta/models'},
  anthropic:{label:'Claude (Anthropic)',defaultModel:'claude-sonnet-5-5',keyHint:'sk-ant-…',endpoint:'https://api.anthropic.com/v1/messages'}
});
export const LLM_DEFAULT_PROVIDER='openai';
export const LLM_MAX_CONFIDENCE=0.85;
export const LLM_DEFAULT_MODEL=LLM_PROVIDERS[LLM_DEFAULT_PROVIDER].defaultModel;
export const LLM_MODES=Object.freeze({off:'Désactivée',edge:'Serveur ExtracTerre (Edge Function Supabase)',direct:'Clé API personnelle (cette session uniquement)'});

export function getLlmConfig(){
  let c={}; try{ c=JSON.parse(localStorage.getItem(LLM_CONFIG_KEY)||'{}')||{}; }catch{}
  const provider=LLM_PROVIDERS[c.provider]?c.provider:LLM_DEFAULT_PROVIDER;
  return {mode:LLM_MODES[c.mode]?c.mode:'off',provider,model:String(c.model||LLM_PROVIDERS[provider].defaultModel),maxPages:Math.max(1,Math.min(12,Number(c.maxPages)||6))};
}
export function saveLlmConfig(cfg={}){ const cur=getLlmConfig(); const next={...cur,...cfg}; if(!LLM_PROVIDERS[next.provider]) next.provider=LLM_DEFAULT_PROVIDER; try{ localStorage.setItem(LLM_CONFIG_KEY,JSON.stringify({mode:next.mode,provider:next.provider,model:next.model,maxPages:next.maxPages})); }catch{} return getLlmConfig(); }
// Une clé par fournisseur, en sessionStorage uniquement (effacée à la fermeture de l'onglet).
export function setLlmDirectKey(key,provider=getLlmConfig().provider){ try{ const k=LLM_DIRECT_KEY_PREFIX+provider; if(key) sessionStorage.setItem(k,String(key).trim()); else sessionStorage.removeItem(k); }catch{} }
export function llmHasDirectKey(provider=getLlmConfig().provider){ return !!llmDirectKey(provider); }
function llmDirectKey(provider){ try{ return sessionStorage.getItem(LLM_DIRECT_KEY_PREFIX+provider)||''; }catch{ return ''; } }
export function llmConsentGiven(){ try{ return localStorage.getItem(LLM_CONSENT_KEY)==='1'; }catch{ return false; } }
export function setLlmConsent(v){ try{ if(v) localStorage.setItem(LLM_CONSENT_KEY,'1'); else localStorage.removeItem(LLM_CONSENT_KEY); }catch{} }

// Champs que l'IA peut chercher pour ce document : autorisés par sa/ses famille(s) et encore vides.
export function llmCandidateFields(doc,missingFields=null){
  const fams=resolveDocumentFamilies(doc);
  let allowed=fams.includes('annex')?Object.keys(FIELD_MAP):[...new Set(fams.flatMap(f=>[...(FAMILY_ALLOWED_FIELDS[f]||[])]))];
  allowed=allowed.filter(k=>FIELD_MAP[k]&&!['project','operation','building'].includes(k));
  if(Array.isArray(missingFields)) allowed=allowed.filter(k=>missingFields.includes(k));
  return allowed;
}

function llmPageScore(page,fields){
  const low=normLower(page.text||(page.lines||[]).map(l=>l.text).join(' '));
  let score=0;
  for(const k of fields){
    for(const tag of (FIELD_MAP[k]?.tags||[]).slice(0,6)){ const t=normLower(tag); if(t.length>=3&&low.includes(t)) score+=t.length>6?2:1; }
    // Mots significatifs du libellé (≥ 6 lettres) : « construction », « ventilation », « isolant »…
    for(const w of normLower(FIELD_MAP[k]?.label||'').split(/[^a-z0-9]+/)) if(w.length>=6&&low.includes(w)) score+=0.5;
  }
  return score;
}
export function selectPagesForLlm(doc,fields,maxPages=6,maxChars=6000){
  const pages=(doc.read?.pages||[]).map(p=>({page:p.page,text:p.text||(p.lines||[]).map(l=>l.text).join('\n')})).filter(p=>p.text.trim());
  let scored=pages.map(p=>({...p,score:llmPageScore(p,fields)})).filter(p=>p.score>0);
  // Petit document sans correspondance de vocabulaire : on envoie ses premières pages plutôt que rien.
  if(!scored.length&&pages.length<=maxPages) scored=pages.map(p=>({...p,score:0}));
  return scored.sort((a,b)=>b.score-a.score||a.page-b.page).slice(0,maxPages).sort((a,b)=>a.page-b.page).map(p=>({page:p.page,text:p.text.slice(0,maxChars)}));
}

export function buildLlmRequest(doc,fields,pages,{model=LLM_DEFAULT_MODEL,provider=LLM_DEFAULT_PROVIDER}={}){
  const fieldList=fields.map(k=>{ const f=FIELD_MAP[k]; return `- ${k} : ${f.label}${f.unit?` [${f.unit}]`:''} (${f.type}) — synonymes : ${(f.tags||[]).slice(0,5).join(' ; ')}`; }).join('\n');
  const buildings=(doc.buildings?.names||[]).filter(b=>b!=='Bâtiment unique');
  const system=`Tu es un extracteur de données pour des documents techniques du bâtiment (France : RE2020, RT2012, DPE, ACV, CCTP).
Règles strictes :
- Ne propose une valeur QUE si elle est écrite explicitement dans le texte fourni. N'infère rien, ne calcule rien, ne complète rien.
- Pour chaque proposition, "quote" doit être une copie EXACTE, caractère pour caractère, d'un passage court (moins de 200 caractères) de la page indiquée, contenant le libellé et la valeur.
- Ignore les recommandations, exemples, scénarios non retenus, valeurs réglementaires génériques et seuils.
- Si plusieurs bâtiments existent, indique le bâtiment dans "building" uniquement s'il est explicite dans le texte ; sinon laisse "".
- Réponds UNIQUEMENT par un objet JSON, sans texte autour ni balises Markdown : {"proposals":[{"field":"<clé>","value":<nombre ou texte>,"unit":"","building":"","page":<numéro>,"quote":"<extrait exact>"}]}
- Si rien n'est trouvé : {"proposals":[]}`;
  const user=`Document : ${doc.name} (type détecté : ${doc.type||'inconnu'})
${buildings.length?`Bâtiments connus : ${buildings.join(' ; ')}\n`:''}Champs recherchés (clé : libellé) :
${fieldList}

Texte extrait du document, page par page :
${pages.map(p=>`<page numero="${p.page}">\n${p.text}\n</page>`).join('\n')}`;
  // Format neutre : le relais (serveur ou navigateur) le traduit pour chaque fournisseur.
  return {provider,model,max_tokens:2000,system,messages:[{role:'user',content:user}]};
}

export function parseLlmJson(text){
  const clean=String(text||'').replace(/```json|```/g,'').trim();
  const start=clean.indexOf('{'), end=clean.lastIndexOf('}');
  if(start<0||end<=start) throw new Error('Réponse IA non JSON.');
  const obj=JSON.parse(clean.slice(start,end+1));
  return Array.isArray(obj?.proposals)?obj.proposals:[];
}

function llmLoose(s){ return normLower(String(s||'')).replace(/[«»"“”]/g,'"').replace(/\s*([:;,=|/()])\s*/g,'$1').replace(/\s+/g,' ').trim(); }
function llmTextValueInQuote(value,quote){ const v=llmLoose(value); return !!v&&llmLoose(quote).includes(v); }
function llmNumberInQuote(value,quote){
  const target=typeof value==='number'?value:parseFrNumber(String(value));
  if(target===null||!Number.isFinite(target)) return false;
  const nums=numbersIn(normalizeText(quote)); const loose=String(quote).match(/[-+]?\d+(?:[\s\u00a0.]\d{3})*(?:[,.]\d+)?/g)||[];
  const all=[...nums,...loose.map(x=>parseFrNumber(x)).filter(x=>x!==null)];
  return all.some(n=>Math.abs(n-target)<=Math.max(1e-9,Math.abs(target)*1e-6));
}

// Vérification d'une proposition : renvoie {ok, reason, occurrence}.
export function verifyLlmProposal(doc,p,allowedFields,{model=''}={}){
  const field=String(p?.field||'').trim(); const def=FIELD_MAP[field];
  if(!def) return {ok:false,reason:`Champ inconnu « ${field} »`};
  if(!allowedFields.includes(field)) return {ok:false,reason:`Champ « ${def.label} » non autorisé ou déjà renseigné`};
  const pageNo=Number(p.page); const page=(doc.read?.pages||[]).find(x=>x.page===pageNo);
  if(!page) return {ok:false,reason:`Page ${p.page} inexistante`};
  const quote=String(p.quote||'').trim();
  if(quote.length<4) return {ok:false,reason:'Citation absente ou trop courte'};
  if(quote.length>400) return {ok:false,reason:'Citation trop longue'};
  const pageText=page.text||(page.lines||[]).map(l=>l.text).join('\n');
  if(!llmLoose(pageText).includes(llmLoose(quote))) return {ok:false,reason:'Citation introuvable mot pour mot dans la page indiquée (hallucination probable)'};
  let value=p.value;
  if(def.type==='number'){
    const n=typeof value==='number'?value:parseFrNumber(String(value??''));
    if(n===null||!Number.isFinite(n)) return {ok:false,reason:'Valeur numérique illisible'};
    if(!llmNumberInQuote(n,quote)) return {ok:false,reason:`La valeur ${n} n’apparaît pas dans la citation`};
    value=n;
  } else {
    value=String(value??'').trim();
    if(!value) return {ok:false,reason:'Valeur vide'};
    if(!llmTextValueInQuote(value,quote)) return {ok:false,reason:`La valeur « ${value} » n’apparaît pas dans la citation`};
  }
  const names=doc.buildings?.names||['Bâtiment unique'];
  let building=names.length===1?names[0]:'Bâtiment unique';
  if(p.building){ const cb=canonicalBuilding(p.building); const hit=names.find(n=>n===cb||normLower(n)===normLower(cb)); if(hit) building=hit; }
  const line=(page.lines||[]).find(l=>llmLoose(l.text).includes(llmLoose(quote).slice(0,40)))||{index:0};
  return {ok:true,occurrence:{field,value,building,docId:doc.id,fileName:doc.name,docType:doc.type,page:pageNo,lineIndex:line.index,excerpt:quote.slice(0,420),confidence:LLM_MAX_CONFIDENCE,method:'llm:verified-quote',unit:p.unit||'',origin:`Assistance IA${model?` (${model})`:''} — citation vérifiée`,provenanceNote:'Proposition d’un modèle de langage. La citation a été retrouvée mot pour mot dans la page et contient la valeur ; validation humaine obligatoire.',llmAssisted:true}};
}

// Traduction du format neutre vers chaque API (utilisée aussi par l'Edge Function, même logique).
export function providerHttpRequest(request,key){
  const p=request.provider||LLM_DEFAULT_PROVIDER, user=request.messages?.[0]?.content||'';
  if(p==='openai') return {url:LLM_PROVIDERS.openai.endpoint,init:{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${key}`},body:JSON.stringify({model:request.model,max_completion_tokens:request.max_tokens||2000,response_format:{type:'json_object'},messages:[{role:'system',content:request.system},{role:'user',content:user}]})}};
  if(p==='gemini') return {url:`${LLM_PROVIDERS.gemini.endpoint}/${encodeURIComponent(request.model)}:generateContent`,init:{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:request.system}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:request.max_tokens||2000,temperature:0}})}};
  if(p==='anthropic') return {url:LLM_PROVIDERS.anthropic.endpoint,init:{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:request.model,max_tokens:request.max_tokens||2000,system:request.system,messages:request.messages})}};
  throw new Error(`Fournisseur IA inconnu : ${p}`);
}
export function providerResponseText(provider,data){
  if(provider==='openai') return {text:String(data?.choices?.[0]?.message?.content||''),usage:data?.usage||null};
  if(provider==='gemini') return {text:(data?.candidates?.[0]?.content?.parts||[]).map(x=>x?.text||'').join('\n'),usage:data?.usageMetadata||null};
  return {text:(data?.content||[]).map(c=>c.type==='text'?c.text:'').join('\n'),usage:data?.usage||null};
}
function providerError(data,status){ return data?.error?.message||(typeof data?.error==='string'?data.error:'')||`Erreur API ${status}`; }

async function llmTransport(request,cfg,{fetchImpl,invokeFunction}={}){
  if(cfg.mode==='edge'){
    if(typeof invokeFunction!=='function') throw new Error('Edge Function indisponible.');
    const data=await invokeFunction('extracterre-llm-extract',request);
    return {text:String(data?.text||''),usage:data?.usage||null};
  }
  if(cfg.mode==='direct'){
    const provider=request.provider||cfg.provider; const key=llmDirectKey(provider);
    if(!key) throw new Error(`Aucune clé ${LLM_PROVIDERS[provider]?.label||provider} saisie pour cette session.`);
    const {url,init}=providerHttpRequest({...request,provider},key);
    const res=await (fetchImpl||globalThis.fetch)(url,init);
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(providerError(data,res.status));
    return providerResponseText(provider,data);
  }
  throw new Error('Assistance IA désactivée.');
}

// Point d'entrée : renvoie les occurrences vérifiées (pour la fenêtre ✓ / ✕) et les rejets motivés.
export async function runLlmAssist(doc,{missingFields=null,config=null,fetchImpl=null,invokeFunction=null}={}){
  const cfg=config||getLlmConfig();
  if(cfg.mode==='off') throw new Error('Assistance IA désactivée dans les réglages.');
  const fields=llmCandidateFields(doc,missingFields);
  if(!fields.length) return {accepted:[],rejected:[],fields:[],pages:[],note:'Aucun champ manquant autorisé pour ce document.'};
  const pages=selectPagesForLlm(doc,fields,cfg.maxPages);
  if(!pages.length) return {accepted:[],rejected:[],fields,pages:[],note:'Aucune page ne mentionne les champs manquants.'};
  const request=buildLlmRequest(doc,fields,pages,{model:cfg.model,provider:cfg.provider});
  const {text,usage}=await llmTransport(request,cfg,{fetchImpl,invokeFunction});
  const proposals=parseLlmJson(text);
  const accepted=[],rejected=[]; const seen=new Set();
  for(const p of proposals){
    const r=verifyLlmProposal(doc,p,fields,{model:cfg.model});
    if(!r.ok){ rejected.push({proposal:p,reason:r.reason}); continue; }
    const k=`${r.occurrence.building}|${r.occurrence.field}|${r.occurrence.value}`; if(seen.has(k)) continue; seen.add(k);
    accepted.push(r.occurrence);
  }
  return {accepted,rejected,fields,pages:pages.map(p=>p.page),usage};
}
