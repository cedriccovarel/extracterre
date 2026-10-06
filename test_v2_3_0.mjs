// ExtracTerre v2.3.0 — tests de non-régression sur documents FICTIFS.
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES,DEFAULT_SOURCE_RULES,FIELD_MAP} from './js/config.js';
import {readXmlText,groupItemsIntoLines,mergePdfAndOcrLines,ocrBlocksToLines} from './js/readers.js';
import {classifyDocument} from './js/classifier.js';
import {detectBuildings} from './js/buildings.js';
import {parseDocument,resolveDocumentFamilies,FAMILY_ALLOWED_FIELDS,FAMILY_EXPECTED_FIELDS,documentExpectedFields} from './js/parsers.js';
import {analyzeDocuments,routeAndDeduplicate,consolidate,familyMismatchAlerts,runSelfTests} from './js/engine.js';
import {runLlmAssist,verifyLlmProposal,parseLlmJson,LLM_MAX_CONFIDENCE,setLlmDirectKey,providerResponseText,setLlmConsent,llmConsentGiven,saveLlmConfig,getLlmConfig} from './js/llm-assist.js';
import {page,textDoc,fictitiousRe2020Xml} from './test_fixtures_v2_3.mjs';

let n=0; const ok=(c,m)=>{ assert.ok(c,m); n++; };
const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
const near=(a,b,m,t=0.01)=>{ assert.ok(a!=null&&Math.abs(a-b)<=t,`${m} : ${a} ≠ ${b}`); n++; };
const rules=structuredClone(DEFAULT_SOURCE_RULES);
const prep=d=>{ const c=classifyDocument(d.name,d.read.text,{kind:d.read.kind,re2020:d.read.re2020||null}); d.classification={...c,automaticType:c.type}; d.type=d.type||c.type; d.buildings=detectBuildings(d); d.status='ready'; return d; };

eq(APP_VERSION,'2.3.6','version');
eq(runSelfTests().passed,runSelfTests().total,'auto-tests moteur historiques');

// ---------- 1. XML RE2020 fictif, 2 bâtiments ----------
const {xml,A,B}=fictitiousRe2020Xml();
const read=readXmlText(xml);
eq(read.xmlFormat,'re2020','XML reconnu comme RE2020');
eq(read.re2020.buildings.length,2,'2 bâtiments');
ok(read.text.length<6000,'texte de synthèse compact');
const xdoc=prep({id:'x1',name:'Tilleuls_RSEE.xml',read});
eq(xdoc.type,DOC_TYPES.RSEE_RE2020,'type RSEE par balises');
eq(xdoc.buildings.names,['Bâtiment A - COLLECTIF','Bâtiment B - MAISONS'],'noms bâtiments canoniques');
const xo=parseDocument(xdoc);
const xv=(f,b)=>xo.find(o=>o.field===f&&o.building===b)?.value;
const bA='Bâtiment A - COLLECTIF', bB='Bâtiment B - MAISONS';
eq(xv('bbio',bA),60.2,'Bbio A'); eq(xv('bbio_max',bA),72,'Bbio max A');
eq(xv('cep',bA),57.3,'Cep A'); eq(xv('cepnr',bA),55,'Cep,nr A'); eq(xv('cepnr_max',bB),60,'Cep,nr max B');
eq(xv('dh',bA),620.4,'DH = groupe le plus défavorable'); eq(xv('dh_max',bA),1250,'DH max même groupe');
eq(xv('housing_count',bA),24,'logements A'); eq(xv('shab',bB),380,'SHAB B');
near(xv('bbio_gain',bA),16.4,'gain Bbio calculé',0.05);
eq(xv('cross_ventilated',bA),'Oui','traversant A'); eq(xv('non_cross_ventilated',bB),'Oui','non traversant B');
eq(xv('cooling',bA),'Aucun','aucun groupe climatisé');
eq(xv('heating_vector_after',bA),'Gaz','vecteur chauffage majoritaire A'); eq(xv('heating_vector_after',bB),'Électricité','vecteur chauffage B');
near(xv('cep_lighting',bA),4.6,'Cep éclairage A = 2 × 2,3'); near(xv('cep_gas',bA),35,'Cep gaz A');
eq(xv('cep_lighting',bB),undefined,'Cep par poste non émis si Σ vecteurs ≠ Cep (garde-fou)');
eq(xv('ic_components',bA),687,'IC composants A'); eq(xv('ic_site',bA),5,'IC chantier'); eq(xv('ic_energy',bB),60,'IC énergie B');
eq(xv('ic_lot_2',bA),120,'lot 2 A'); eq(xv('ic_lot_13',bB),0,'lot 13 à zéro conservé');
eq(xv('ic_energy_heating',bA),150,'IC énergie chauffage (sous-contrib. 1)'); eq(xv('ic_energy_ecs',bA),110,'IC énergie ECS (sous-contrib. 2)'); eq(xv('ic_energy_cooling',bA),2,'IC énergie froid (sous-contrib. 3)'); eq(xv('ic_energy_mobility',bA),8,'déplacements (7)');
eq(xv('stock_c_per_m2',bB),12.4,'Stock C B');
eq(xv('window_glazing',bA),'4.16.4 Ar','vitrage majoritaire normalisé');
ok(xo.some(o=>o.field==='wall_insulation'&&o.building===bA),'isolant mur A depuis le libellé de paroi');
eq(xv('roof_insulation_r',bB),10,'R combles B explicite');
ok(xo.filter(o=>/^xml:re2020:/.test(o.method)).every(o=>o.hierarchyRank<=5),'rang hiérarchique XML prioritaire');
const xr=analyzeDocuments([xdoc],rules,'');
const rowA=xr.rows.find(r=>r.building===bA);
eq(rowA.cep,57.3,'consolidation Cep A'); eq(rowA.ic_lot_8,140,'consolidation lot 8 A');
ok(xr.coherence.some(c=>c.building===bA&&c.check.startsWith('Σ lots')&&c.status==='ok'),'cohérence Σ lots OK sur XML');
// famille manuelle restreinte sur XML : thermique seul
const xdoc2=prep({id:'x2',name:'Tilleuls.xml',read,familyMode:'manual',families:['rset']});
ok(!parseDocument(xdoc2).some(o=>o.field.startsWith('ic_')),'XML filtré si famille thermique imposée');

// ---------- 2. DPE ----------
const fields=(o)=>o.map(x=>`${x.field}=${x.value}`).sort();
const dpe=prep(textDoc('d1','Audit.pdf',DOC_TYPES.DPE,'État initial du projet\nClasse énergie : E\nClasse GES : F\nScénario après travaux\nClasse énergie : B\nClasse GES : A'));
eq(fields(parseDocument(dpe)),['dpe_energy_after=B','dpe_energy_before=E','dpe_ges_after=A','dpe_ges_before=F'],'DPE avant/après sans inversion');
const dpeSplit=prep(textDoc('d2','DPE_logement.pdf',DOC_TYPES.DPE,'Avant travaux\nÉtiquette énergie\nD\nÉtiquette climat\nC'));
eq(fields(parseDocument(dpeSplit)),['dpe_energy_before=D','dpe_ges_before=C'],'DPE mise en page éclatée');
const dpeNarr=prep(textDoc('d3','DPE.pdf',DOC_TYPES.DPE,'Avant travaux\nLes logements doivent atteindre au moins la classe E : objectif\nClasse énergie : G'));
eq(fields(parseDocument(dpeNarr)),['dpe_energy_before=G'],'phrase réglementaire ignorée');
const dpeNeuf=prep(textDoc('d4','DPE_neuf.pdf',DOC_TYPES.DPE,'Logement neuf\nClasse énergie : A\nClasse GES : A'));
eq(fields(parseDocument(dpeNeuf)),['dpe_energy_after=A','dpe_ges_after=A'],'DPE neuf → après');
ok(parseDocument(dpe).every(o=>!/E/.test(o.field==='dpe_ges_after'?o.value:'')),'aucune classe énergie prise pour GES');

// ---------- 3. 3CL : recommandations exclues, état existant conservé ----------
const cl=prep(textDoc('c1','Audit_3CL.pdf',DOC_TYPES.DPE,'Descriptif des équipements\nChauffage : chaudière gaz individuelle\nRecommandations de travaux\nInstallation d\'une pompe à chaleur air/eau pour le chauffage\nRemplacement par chaudière gaz à condensation'));
cl.familyMode='manual'; cl.families=['dpe']; // famille « DPE / 3CL » choisie dans la liste
const clo=parseDocument(cl);
ok(!clo.some(o=>o.field==='heating_mode_after'),'aucun équipement après issu des recommandations');
eq(clo.find(o=>o.field==='heating_vector_before')?.value,'Gaz','vecteur existant conservé');

// ---------- 4. Familles ----------
const rsetCarbon=prep(textDoc('r1','Projet_RSET.pdf',DOC_TYPES.RSET_RE2020,'Récapitulatif standardisé d’étude thermique RE2020\nBbio : 45,2\nIc composants : 650,2 kgCO2/m²'));
eq(resolveDocumentFamilies(rsetCarbon),['rset','carbone'],'RSET avec ACV → thermique + carbone');
const ro=parseDocument(rsetCarbon);
ok(ro.some(o=>o.field==='bbio')&&ro.some(o=>o.field==='ic_components'),'un seul dépôt : thermique ET carbone');
for(const [f,list] of Object.entries(FAMILY_EXPECTED_FIELDS)) for(const e of list.flat()) ok(f==='annex'||FAMILY_ALLOWED_FIELDS[f].has(e),`attendu ${e} autorisé pour ${f}`);
eq(resolveDocumentFamilies({specializedFamily:'acv'}),['carbone'],'alias acv'); eq(resolveDocumentFamilies({specializedFamily:'3cl'}),['dpe'],'alias 3cl'); eq(resolveDocumentFamilies({specializedFamily:'manual'}),['annex'],'alias manuel');
const appSrc=(await import('node:fs')).readFileSync('./js/app.js','utf8');
ok(/const mismatch=d\.familyMode==='manual'&&!\(d\.families\|\|\[\]\)\.includes\('annex'\)/.test(appSrc),'badge ⚠ jamais affiché en analyse manuelle');
const wrong=prep(textDoc('w1','RSET_RT2012.pdf',undefined,'Récapitulatif standardisé d’étude thermique\nRéglementation thermique 2012\nBbio : 50\nTic : 27'));
wrong.familyMode='manual'; wrong.families=['rset'];
ok(familyMismatchAlerts([wrong]).length===1,'alerte famille choisie ≠ détection');
eq(documentExpectedFields({familyMode:'manual',families:['dpe']}).length,2,'complétude DPE : énergie + GES (avant ou après)');

// Analyse manuelle = moteur libre, sans liste blanche (famille « annex » imposée)
const mixed=prep(textDoc('m1','Etude_libre.pdf',DOC_TYPES.RSET_RE2020,'Récapitulatif standardisé d’étude thermique RE2020\nBbio : 45,2\nIc composants : 650,2 kgCO2/m²'));
mixed.familyMode='manual'; mixed.families=['rset'];
ok(!parseDocument(mixed).some(o=>o.field==='ic_components'),'famille RSET imposée : IC hors liste blanche ignoré');
mixed.families=['annex'];
ok(resolveDocumentFamilies(mixed).join()==='annex','analyse manuelle → famille annex');
ok(parseDocument(mixed).some(o=>o.field==='ic_components')&&parseDocument(mixed).some(o=>o.field==='bbio'),'analyse manuelle : aucun filtre, Bbio ET IC extraits');
ok(familyMismatchAlerts([mixed]).length===0,'analyse manuelle : jamais d’alerte de famille');

// ---------- 5. Consolidation multi-bâtiments ----------
const o=(field,value,building,docType,extra={})=>({field,value,building,docId:extra.docId||'doc',docType,confidence:0.97,page:1,excerpt:`${field} ${value} ${building}`,method:extra.method||'test',...extra});
const docs=[{id:'doc',name:'RSET_fictif.pdf',buildings:{names:['Bât A','Bât B']}}];
const occ=[o('dh',450,'Bât A',DOC_TYPES.RSET_RE2020),o('dh',900,'Bâtiment unique',DOC_TYPES.RSET_RE2020,{docId:'x'}),
  o('wall_insulation','Laine de verre','Bâtiment unique',DOC_TYPES.CCTP,{docId:'cctp'}),o('wall_insulation','Laine de roche','Bât A',DOC_TYPES.CCTP,{docId:'cctp2'})];
const c=consolidate(docs,routeAndDeduplicate(occ,rules),rules,'');
const rA=c.rows.find(r=>r.building==='Bât A'), rB=c.rows.find(r=>r.building==='Bât B');
eq(rA.dh,450,'DH A'); eq(rB.dh,undefined,'DH non attribué non recopié sur B');
eq(rA.wall_insulation,'Laine de roche','valeur attribuée au bâtiment prioritaire'); eq(rB.wall_insulation,'Laine de verre','descriptif global toujours applicable');
ok(c.detailed.some(d=>d.unattributedScoped&&d.field==='dh'),'DH non attribué envoyé en vérification');

// ---------- 6. Apprentissage plafonné ----------
const learned=routeAndDeduplicate([{...o('cep',70,'Bât A',DOC_TYPES.RSET_RE2020),confidence:0.86,learningBoost:0.06}],rules)[0];
ok(learned.confidence<0.9&&learned.learningCappedForReview,'l’apprentissage seul ne franchit pas 90 %');

// ---------- 7. Cohérence ----------
const pdfLots=Array.from({length:13},(_,i)=>o(`ic_lot_${i+1}`,10,'Bâtiment unique',DOC_TYPES.RSENV,{method:'carbon:explicit-label'}));
const cr=analyzeDocuments([],rules,'',{},[...pdfLots,o('ic_components',700,'Bâtiment unique',DOC_TYPES.RSENV,{method:'carbon:explicit-label'}),o('cep',60,'Bâtiment unique',DOC_TYPES.RSET_RE2020),o('cepnr',75,'Bâtiment unique',DOC_TYPES.RSET_RE2020),o('bbio',50,'Bâtiment unique',DOC_TYPES.RSET_RE2020),o('bbio_max',80,'Bâtiment unique',DOC_TYPES.RSET_RE2020)]);
const row=cr.rows[0];
eq(row.ic_components,undefined,'IC composants incohérent (Σ lots 130 ≠ 700) retiré du tableau');
ok(cr.uncertain.some(u=>u.field==='ic_components'&&u.coherenceReason),'… et proposé en vérification avec la raison');
eq(row.cepnr,undefined,'Cep,nr > Cep retiré'); near(row.bbio_gain,37.5,'gain Bbio calculé par cohérence');
ok(cr.alerts.some(a=>/Cohérence/.test(a.message)),'alertes de cohérence');
// valeur structurée XML : jamais retirée
const xmlBad=analyzeDocuments([],rules,'',{},[o('ic_components',50,'Bâtiment unique',DOC_TYPES.RSEE_RE2020,{method:'xml:re2020:rsenv-ic',structuredXml:true})]);
eq(xmlBad.rows[0].ic_components,50,'valeur XML conservée'); ok(xmlBad.alerts.some(a=>a.level==='error'&&/Plage plausible/.test(a.message)),'… mais signalée en erreur');

// ---------- 8. Lecture PDF / OCR ----------
const items=[{str:'B',transform:[1,0,0,10,50,100.4],width:5},{str:'A',transform:[1,0,0,10,10,100],width:5},{str:'C',transform:[1,0,0,10,90,99.7],width:5},{str:'Z',transform:[1,0,0,10,10,80],width:5}];
const gl=groupItemsIntoLines(items);
eq(gl.map(l=>l.text),['A B C','Z'],'regroupement stable (tri transitif)');
const ocrL=ocrBlocksToLines([{paragraphs:[{lines:[{text:'Ligne OCR milieu',bbox:{y0:190,y1:210},words:[{text:'Ligne',bbox:{x0:20}}]}]}]}],{scale:2,baseHeight:200});
near(ocrL[0].y,100,'OCR reprojeté en coordonnées PDF');
const merged=mergePdfAndOcrLines([{index:0,y:150,text:'Haut'},{index:1,y:50,text:'Bas'}],ocrL,{score:.8},{score:.7});
eq(merged.lines.map(l=>l.text),['Haut','Ligne OCR milieu','Bas'],'ligne OCR insérée à sa position');

// ---------- 9. Assistance IA (réponses simulées) ----------
const llmDoc=prep(textDoc('l1','Notice_Tilleuls.pdf',DOC_TYPES.NOTICE,'Notice descriptive\nLe programme comprend 18 logements collectifs.\nSurface habitable totale : 1 234,5 m²\fAnnexe\nVentilation : VMC simple flux hygroréglable type B'));
const mock=JSON.stringify({proposals:[
  {field:'housing_count',value:18,page:1,quote:'Le programme comprend 18 logements collectifs.'},
  {field:'shab',value:1234.5,page:1,quote:'Surface habitable totale : 1 234,5 m²'},
  {field:'shab',value:1500,page:1,quote:'Surface habitable totale : 1 500 m²'},
  {field:'ventilation',value:'VMC double flux',page:2,quote:'Ventilation : VMC simple flux hygroréglable type B'},
  {field:'cep',value:55,page:1,quote:'Cep projet 55'},
  {field:'champ_invente',value:1,page:1,quote:'Notice descriptive'}]});
const res=await runLlmAssist(llmDoc,{config:{mode:'edge',provider:'openai',model:'test',maxPages:4},invokeFunction:async(name,req)=>{ eq(name,'extracterre-llm-extract','Edge Function appelée'); ok(req.messages[0].content.includes('18 logements'),'pages pertinentes envoyées'); return {text:'```json\n'+mock+'\n```'}; }});
eq(res.accepted.map(a=>`${a.field}=${a.value}`).sort(),['housing_count=18','shab=1234.5'],'seules les citations exactes contenant la valeur sont acceptées');
ok(res.accepted.every(a=>a.confidence===LLM_MAX_CONFIDENCE&&a.confidence<0.9),'confiance IA plafonnée sous le seuil');
ok(res.rejected.some(r=>/introuvable/.test(r.reason)),'citation inventée rejetée');
ok(res.rejected.some(r=>/n’apparaît pas/.test(r.reason)),'valeur absente de la citation rejetée');
ok(res.rejected.some(r=>/inconnu/.test(r.reason)),'champ inventé rejeté');
eq(parseLlmJson('Voici : {"proposals":[]} fin').length,0,'JSON tolérant au texte parasite');
globalThis.sessionStorage={_s:{},getItem(k){return this._s[k]??null},setItem(k,v){this._s[k]=String(v)},removeItem(k){delete this._s[k]}};
// ChatGPT (OpenAI) — format Chat Completions
setLlmDirectKey('sk-openai-test','openai');
let call=null;
const resO=await runLlmAssist(llmDoc,{config:{mode:'direct',provider:'openai',model:'gpt-test',maxPages:4},fetchImpl:async(url,init)=>{ call={url,init}; return {ok:true,json:async()=>({choices:[{message:{content:mock}}],usage:{total_tokens:10}})}; }});
eq(call.url,'https://api.openai.com/v1/chat/completions','OpenAI : endpoint Chat Completions');
eq(call.init.headers.authorization,'Bearer sk-openai-test','OpenAI : clé de session en Bearer');
const bodyO=JSON.parse(call.init.body); eq(bodyO.model,'gpt-test','OpenAI : modèle choisi'); eq(bodyO.response_format.type,'json_object','OpenAI : sortie JSON forcée'); eq(bodyO.messages[0].role,'system','OpenAI : consignes en message système');
eq(resO.accepted.length,2,'OpenAI : mêmes vérifications littérales');
// Gemini (Google) — format generateContent
setLlmDirectKey('AIza-test','gemini');
const resG=await runLlmAssist(llmDoc,{config:{mode:'direct',provider:'gemini',model:'gemini-test',maxPages:4},fetchImpl:async(url,init)=>{ call={url,init}; return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:mock}]}}]})}; }});
eq(call.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent','Gemini : endpoint generateContent');
eq(call.init.headers['x-goog-api-key'],'AIza-test','Gemini : clé dans l’en-tête x-goog-api-key');
const bodyG=JSON.parse(call.init.body); eq(bodyG.generationConfig.responseMimeType,'application/json','Gemini : sortie JSON forcée'); ok(!!bodyG.systemInstruction?.parts?.[0]?.text,'Gemini : consignes système');
eq(resG.accepted.length,2,'Gemini : mêmes vérifications littérales');
// Erreur fournisseur remontée proprement ; clés isolées par fournisseur
await assert.rejects(runLlmAssist(llmDoc,{config:{mode:'direct',provider:'openai',model:'x',maxPages:4},fetchImpl:async()=>({ok:false,status:401,json:async()=>({error:{message:'Incorrect API key'}})})}),/Incorrect API key/); n++;
await assert.rejects(runLlmAssist(llmDoc,{config:{mode:'direct',provider:'anthropic',model:'x',maxPages:4},fetchImpl:async()=>({ok:true,json:async()=>({})})}),/Aucune clé/); n++;
// Mode serveur : le fournisseur est transmis à l'Edge Function
let edgeReq=null; await runLlmAssist(llmDoc,{config:{mode:'edge',provider:'gemini',model:'gemini-test',maxPages:4},invokeFunction:async(nm,r)=>{ edgeReq=r; return {text:mock}; }});
eq(edgeReq.provider,'gemini','Edge Function : fournisseur transmis');
globalThis.localStorage={_s:{},getItem(k){return this._s[k]??null},setItem(k,v){this._s[k]=String(v)},removeItem(k){delete this._s[k]}};
setLlmConsent(true); ok(llmConsentGiven(),'consentement mémorisé'); setLlmConsent(false); ok(!llmConsentGiven(),'consentement retiré');
saveLlmConfig({mode:'direct',provider:'gemini',model:'gemini-x'}); eq(getLlmConfig().provider,'gemini','fournisseur mémorisé'); eq(getLlmConfig().mode,'direct','mode mémorisé');
saveLlmConfig({provider:'inconnu'}); eq(getLlmConfig().provider,'openai','fournisseur inconnu → ChatGPT par défaut');
eq(providerResponseText('openai',{choices:[{message:{content:'{}'}}]}).text,'{}','lecture réponse OpenAI');

console.log(`v2.3.3 — ${n} vérifications OK (documents fictifs)`);
