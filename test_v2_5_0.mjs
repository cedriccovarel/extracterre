// ExtracTerre v2.5.0 — questionnaire financier Prestaterre → onglet Économie et 2e feuille Excel.
// Questionnaire FICTIF reproduisant la mise en page de la synthèse PDF V0.56 (colonnes par position, lettres espacées).
import assert from 'node:assert/strict';
import {APP_VERSION,DOC_TYPES} from './js/config.js';
import {attachFinancialCells,compactReadForRetention} from './js/readers.js';
import {normalizeText} from './js/utils.js';
import {classifyDocument} from './js/classifier.js';
import {parseDocument} from './js/parsers.js';
import {analyzeEconomicData,costPostIndex,ECONOMIC_FIELDS,isFinancialJson} from './js/economics.js';
import {readFile} from './js/readers.js';
import {exportProjectsExcel} from './js/exporter.js';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; }; const ok=(v,m)=>{ assert.ok(v,m); n++; };
eq(APP_VERSION, '2.10.0','version');
// Ligne PDF.js : segments [x, texte] ; mots collés (espace = fragment « espace » du PDF), comme l'édition réelle.
const L=(...segs)=>{ const items=[]; for(const [x,t] of segs){ let cx=x; t.split(' ').forEach((w,i)=>{ items.push({text:w,x:cx,w:w.length*4,sb:i>0}); cx+=w.length*4; }); } return {text:normalizeText(items.map(i=>i.text).join('')),items}; };
const page=(no,lines)=>{ const text=lines.map(l=>l.text).join('\n'); attachFinancialCells(lines,text); return {page:no,lines,text}; };
const H=['Questionnaire financier MOA V0.56'];
const pages=[
  page(1,[L([260,H[0]]),L([43,'OPE-009001 · Contrat 00009002 · Ville Fictive'],[327,'← Mes opérations']),L([44,'Lignes financières : 4 · PDF joints : 2 autorisé(s) · Excel joints : 0 autorisé(s)']),L([44,'Habilitation à transmettre : confirmée · Notice confidentialité : prise en compte · Confirmation : 01/02/2026'])]),
  page(2,[L([260,H[0]]),L([46,'Données financières validées']),L([38,'SOURCE'],[107,'LOT / POSTE'],[261,'CATÉGORIE FINANCIÈRE'],[373,'MONTANT HT'],[463,'COMMENTAIRE']),
    L([38,'PDF'],[107,'LOT 2 - GROS-ŒUVRE'],[261,'Travaux'],[421,'100 000 €']),
    L([38,'PDF'],[107,'Dépose de matériaux amiantés'],[261,'Travaux'],[425,'20 000 €']),
    L([38,'PDF'],[107,'RÉSEAU TNT +'],[261,'Travaux'],[429,'5 000 €']),L([107,'FIBRE FTTH']),
    L([38,'Manuel'],[107,'Diagnostic amiante | Diagnostic plomb'],[261,"Études / diagnostics"],[428,'2 000 €']),
    L([38,'Total opération'],[416,'127 000 €']),L([31,'Prestaterre Certifications · Observatoire du bâtiment durable'])]),
  page(3,[L([260,H[0]]),L([46,'Aides mobilisées']),L([38,'CATÉGORIE'],[118,'AIDE / PORTEUR'],[283,'CALCUL'],[378,'MONTANT'],[447,'STATUT'],[506,'COMMENTAIRE']),
    L([38,'Subvention'],[118,'Région'],[283,'5 % du montant travaux'],[406,'10 000 €'],[447,'Accordée']),L([118,'Région'],[283,'validé']),
    L([38,'Prêt aidé'],[118,'Prêt PLS – prêt locatif social'],[403,'30 000 €'],[447,'Demandée']),L([118,'Établissements financiers']),
    L([38,'Recette'],[118,'Marges locales bonifiées – majoration de loyer'],[283,'Majoration de loyer de 3 % ·'],[418,'200 €'],[447,'Accordée']),L([118,'Intercommunalité / commune'],[283,'Performance énergétique ·']),L([283,'Ville Fictive · 200 € / an']),
    L([55,'AIDES NON REMBOURSABLES'],[312,'PRÊTS AIDÉS'])]),
  page(4,[L([260,H[0]]),L([31,"NUMÉRO D'OPÉRATION SIAP (FACULTATIF)"]),L([44,"N° d'opération SIAP"]),L([44,'Proposé car l’opération mobilise des financements agréés dans SIAP :']),L([44,'Prêt PLS – prêt locatif social'])])
];
const read={kind:'pdf',pages,text:pages.map(p=>p.text).join('\n\f\n'),pageCount:pages.length};
const cl=classifyDocument('synthese.pdf',read.text,{kind:'pdf'});
eq(cl.type,DOC_TYPES.FINANCIAL,'questionnaire reconnu (texte sans espaces)');
ok(pages[1].lines[3].cells[1]==='LOT 2 - GROS-ŒUVRE','espaces et accents reconstruits dans les cellules');
const doc={id:'f1',name:'synthese.pdf',read,type:cl.type,classification:{...cl,automaticType:cl.type},buildings:{names:['Bâtiment unique']},status:'ready'};
eq(parseDocument(doc).map(o=>`${o.field}=${o.value}`).sort(),['contract_number=00009002','internal_code=OPE-009001'],'seuls code opération et contrat vont au tableau principal');
compactReadForRetention(read); // les cellules survivent au compactage (et à la sauvegarde)
const e=analyzeEconomicData([doc],'',{}); const v=e.values;
eq(e.costs.map(c=>c.label),['LOT 2 - GROS-ŒUVRE','Dépose de matériaux amiantés','RÉSEAU TNT + FIBRE FTTH','Diagnostic amiante | Diagnostic plomb'],'libellés sur plusieurs lignes rassemblés');
eq([v.fin_operation_code,v.fin_contract,v.fin_operation_label,v.fin_version,v.fin_confirmed_at,v.fin_lines_count],['OPE-009001','00009002','Ville Fictive','V0.56','01/02/2026',4],'identification');
eq(v.fin_siap,undefined,'N° SIAP vide (texte d’aide ignoré)'); eq(v.fin_siap_aids,'Prêt PLS – prêt locatif social','financements SIAP');
eq([v.cost_total,v.cost_travaux,v.cost_etudes,v.cost_travaux_pct],[127000,125000,2000,98.4],'coûts par catégorie');
eq([v.post_travaux_4,v.post_travaux_2,v.post_travaux_18,v.post_etudes_other],[100000,20000,5000,2000],'postes : gros œuvre, désamiantage, électricité, postes groupés');
eq([v.aid_capital,v.aid_loans,v.aid_tax_revenue,v.aid_mobilized,v.aid_to_secure],[10000,30000,200,40200,30000],'aides par nature');
eq([v.aid_capital_pct_total,v.aid_capital_pct_works,v.own_funds,v.aid_secured_pct],[7.9,8,87000,25.4],'parts et fonds propres');
eq([v.aid_region,v.aid_region_status,v.aid_pret_pls_status,v['aidlvl_etablissements_financiers']],[10000,'Accordée','Demandée',30000],'aides par dispositif et porteur');
eq([v.marge_pct,v.marge_motif,v.marge_territory,v.marge_revenue],[3,'Performance énergétique','Ville Fictive',200],'marge locale bonifiée');
eq([v.aid_first_level,v.aid_strategy],['Établissements financiers','prêts aidés'],'premier financeur et stratégie');
// Saisie de l'onglet Économie : prioritaire ; ancienne saisie « lot → montant » (≤ v2.4) devenue ligne travaux.
const m=analyzeEconomicData([doc],'',{fin_siap:'SIAP-1',cost_total:130000,'Lot peinture':3000});
eq([m.values.fin_siap,m.values.cost_total,m.values.post_travaux_25],['SIAP-1',130000,3000],'saisies manuelles');
eq(costPostIndex('travaux','2.5. Plomberie et Sanitaire'),19,'libellé exact de la nomenclature');
eq(costPostIndex('moe','BET Structure'),5,'poste de maîtrise d’œuvre');
// Export : 2e feuille « Données économiques », identifiant du projet en tête.
const sheets=[]; globalThis.XLSX={utils:{book_new:()=>({}),aoa_to_sheet:rows=>({rows,'!ref':'A1:A1'}),decode_range:()=>({s:{c:0,r:0},e:{c:0,r:0}}),encode_cell:()=>'A1',book_append_sheet:(wb,ws,name)=>sheets.push([name,ws.rows])},writeFile:()=>{}};
exportProjectsExcel([{docs:[doc],manualEconomics:{},operationName:'',result:{operation:'',rows:[{building:'Bâtiment unique',internal_code:'OPE-009001',operation_name:'Résidence Fictive'}],finals:[],detailed:[],buildingAliases:[]}}],{});
eq(sheets[1][0],'Données économiques','2e feuille');
eq(sheets[1][1][0].slice(0,3),['Code interne','Nom opération',ECONOMIC_FIELDS[0].label],'identifiant en premières colonnes');
eq(sheets[1][1][1].slice(0,2),['OPE-009001','Résidence Fictive'],'valeurs d’identifiant reprises du tableau principal');
eq(sheets[1][1][0].length,ECONOMIC_FIELDS.length+2,'toutes les colonnes de la nomenclature');
eq(sheets[2][0],'Lignes financières','détail des lignes'); eq(sheets[2][1].length,1+4+3,'4 coûts + 3 aides');
// —— Export JSON du questionnaire (fictif, structure V0.56) : prioritaire sur la synthèse PDF.
const J={operation:{contrat:'00009002',numeroOperation:'OPE-009001',commune:'Ville Fictive',numeroSIAP:''},
  financier:{typeMontant:'HT',montantTotalOperation:127000.5,lignesValidees:[
    {source:'PDF',lot:'LOT 2 - GROS-ŒUVRE',categorie:'Travaux',montant:100000.5,commentaire:'',fichier:'dpgf_go.pdf'},
    {source:'Manuel',lot:'Diagnostic amiante | Diagnostic plomb',categorie:"Études / diagnostics",montant:2000,commentaire:'forfait',fichier:''},
    {source:'Manuel',lot:'<img src=x onerror=alert(1)>',categorie:'Autres',montant:'25 000',fichier:''}],
    couverture:"Une partie seulement du coût de l'opération",postesManquantsConnus:'yes',postesManquants:'DO',commentaireControle:''},
  transmission:{fichiersPDFJoints:[{nom:'dpgf_go.pdf'}],fichiersExcelJoints:[]},
  complementaires:{coutFinal:130000,coutFinalIdentiqueMontantDetaille:false,commentaireAvantEnvoi:''},
  conformite:{versionNotice:'2026-10-05-v2',habilitationTransmission:true,priseConnaissanceConfidentialite:true,confirmeLe:'2026-02-01T10:00:00.000Z'},
  aides:{statut:'yes',nombreLogements:10,aidesNonRemboursablesParLogement:1000,referentielAides:'Catalogue Prestaterre V0.56',alertes:[],
    lignes:[{categorie:'sub',aideId:'region',dispositif:'Région',porteur:'Région',statut:'Accordée',montant:10000.25,saisieLibelle:'5 % du montant travaux validé'},
      {categorie:'pret',aideId:'pret_pls',dispositif:'Prêt PLS – prêt locatif social',porteur:'Établissements financiers',statut:'Demandée',montant:30000,numeroSIAP:'SIAP-77'},
      {categorie:'revenu',aideId:'marges_locales',dispositif:'Marges locales bonifiées – majoration de loyer',porteur:'Intercommunalité / commune',statut:'Accordée',montant:200}],
    margesLocales:[{tauxMajorationLoyer:3,motif:'Performance énergétique',territoire:'Ville Fictive',loyerAnnuelReference:6000,recetteAnnuelleEstimee:200}]}};
ok(isFinancialJson(J)&&!isFinancialJson({operation:{}}),'export JSON reconnu');
const jread=await readFile({name:'OPE-009001_questionnaire.json',size:2000,text:async()=>JSON.stringify(J)});
await assert.rejects(readFile({name:'autre.json',size:10,text:async()=>'{"a":1}'}),/non reconnu/); n++;
await assert.rejects(readFile({name:'casse.json',size:10,text:async()=>'{'}),/illisible/); n++;
const jcl=classifyDocument('OPE-009001_questionnaire.json',jread.text,{kind:'json'}); eq(jcl.type,DOC_TYPES.FINANCIAL,'JSON classé questionnaire financier');
const jdoc={id:'j1',name:'OPE-009001_questionnaire.json',read:jread,type:jcl.type,classification:{...jcl,automaticType:jcl.type},buildings:{names:['Bâtiment unique']},status:'ready'};
eq(parseDocument(jdoc).map(o=>`${o.field}=${o.value}`).sort(),['contract_number=00009002','internal_code=OPE-009001'],'JSON : code opération et contrat au tableau principal');
const je=analyzeEconomicData([doc,jdoc],'',{}); const jv=je.values;
eq(je.source,'Questionnaire financier (OPE-009001_questionnaire.json)','le JSON prime sur la synthèse PDF');
eq([jv.cost_total,jv.post_travaux_4,jv.post_etudes_other,jv.cost_autres,jv.fin_lines_count],[127000.5,100000.5,2000,25000,3],'coûts exacts (décimales, montant texte)');
eq(je.costs[2].label,'<img src=x onerror=alert(1)>','texte transmis gardé brut (échappé à l’affichage)');
eq([jv.fin_coverage,jv.fin_missing_known,jv.fin_missing,jv.fin_final_cost,jv.fin_final_same,jv.fin_dwellings,jv.aid_capital_per_dwelling],["Une partie seulement du coût de l'opération",'Oui','DO',130000,'Non',10,1000],'données absentes du PDF');
eq([jv.fin_version,jv.fin_confirmed_at,jv.fin_siap,jv.fin_siap_aids,jv.fin_pdf_count],['V0.56','01/02/2026','SIAP-77','Prêt PLS – prêt locatif social',1],'identification JSON');
eq([jv.aid_capital,jv.aid_region,jv.aid_pret_pls_status,jv.marge_pct,jv.marge_reference_rent,jv.marge_revenue],[10000.25,10000.25,'Demandée',3,6000,200],'aides et marge locale déclarées');
console.log(`v2.5.0 — ${n} vérifications OK (questionnaire fictif)`);
