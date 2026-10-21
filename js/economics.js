// v2.5.0 — Données économiques : nomenclature Excel du questionnaire financier MOA Prestaterre (V0.56).
// Source principale : la synthèse PDF « Questionnaire financier d'opération » (lignes de coûts validées, aides mobilisées).
// Repli : DPGF (prix HT par lot), quand aucun questionnaire n'est fourni. Les totaux, parts et le plan de financement sont
// recalculés à partir des lignes (mêmes règles que le questionnaire) ; aucune valeur n'est inventée.
import {DOC_TYPES} from './config.js';
import {normalizeText,normLower,parseFrNumber} from './utils.js';

// —— Nomenclature du questionnaire (catégories de coûts, postes, dispositifs d'aide)
export const COST_CATEGORIES=[
  {id:'travaux',label:'Travaux',posts:['0. Travaux préparatoires (global)','0.1. Curage et démolition','0.2. Désamiantage et déplombage','0.3. Installation de chantier','1. Le Gros Œuvre (global)','1.1. Terrassement','1.2. Fondations et soubassement','1.3. Assainissement','1.4. Maçonnerie et élévation','1.5. Charpente','1.6. Couverture et Zinguerie','1.7. Étanchéité (Toits-terrasses, fondations)','1.8. Menuiseries extérieures','1.9. Façade / Enduits extérieurs','2. Le Second Œuvre (global)','2.1. Plâtrerie / Cloisons / Faux-plafonds','2.2. Isolation (Thermique et Phonique)','2.3. Menuiseries intérieures','2.4. Électricité, Domotique et Sécurité','2.5. Plomberie et Sanitaire','2.6. Chauffage, Climatisation et Ventilation (CVC)','2.7. Énergies Renouvelables (ENR)','2.8. Appareils élévateurs','2.9. Chapes','2.10. Revêtements de sols','2.11. Revêtements muraux et Peinture','2.12. Agencement sur mesure','3. Les Aménagements extérieurs (global)','3.1. VRD (Voirie et Réseaux Divers)','3.2. Menuiseries extérieures d’aménagement (portails, portes de garage)','3.3. Serrurerie / Ferronnerie extérieure','3.4. Paysagisme (espaces verts, terrasses)']},
  {id:'moe',label:'Maîtrise d’œuvre',posts:['Architecte','Maîtrise d’œuvre de conception','Maîtrise d’œuvre d’exécution / DET','OPC','Économiste de la construction','BET Structure','BET Fluides / CVC / Plomberie','BET Électricité','BET Thermique / Énergie','BET Acoustique','BET Environnement / Carbone','BIM / Synthèse','Paysagiste','Coordination SSI','Visa / suivi architectural']},
  {id:'etudes',label:'Études / diagnostics',posts:['Étude de faisabilité / programmation','Relevés / géomètre','Étude géotechnique','Diagnostic amiante','Diagnostic plomb','Diagnostic termites / parasitaire','Audit énergétique','DPE / 3CL','Étude thermique réglementaire','Étude ACV / carbone','Étude acoustique','Étude structure','Étude de sol / pollution','Diagnostic PEMD / déchets','Étude hydraulique / assainissement','Étude environnementale / biodiversité','Tests / mesures / infiltrométrie','CSPS','Contrôle technique','AMO / conseil']},
  {id:'foncier',label:'Foncier',posts:['Prix du terrain','Charges foncières','Frais de notaire liés au foncier','Frais d’agence / intermédiaire foncier','Géomètre / bornage foncier','Servitudes / droits de passage','Évictions / libération foncière','Dépollution / remise en état foncière','Participation foncière / soulte','Portage foncier']},
  {id:'acquisition',label:'Acquisition',posts:['Prix d’acquisition de l’immeuble / bâtiment','Frais de notaire acquisition','Droits de mutation','Frais d’agence acquisition','Frais d’acte / formalités','Audit / due diligence acquisition','Indemnités / éviction liées à l’acquisition','Frais de copropriété liés à l’acquisition']},
  {id:'assurances',label:'Assurances / garanties',posts:['Dommages-ouvrage (DO)','Tous Risques Chantier (TRC)','Constructeur Non Réalisateur (CNR)','Responsabilité civile maître d’ouvrage','Garantie financière d’achèvement','Garantie de paiement','Assurance chantier','Assurance décennale spécifique','Frais de caution / garanties']},
  {id:'taxes',label:'Taxes / raccordements',posts:['Taxe d’aménagement','PFAC / participation assainissement','Raccordement eau','Raccordement électricité','Raccordement gaz','Raccordement télécom / fibre','Raccordement réseau de chaleur','Voirie / concessionnaires','Redevances / participations','Taxes locales / urbanisme','Frais ENEDIS / GRDF / opérateurs']},
  {id:'financement',label:'Financement',posts:['Intérêts intercalaires','Frais de dossier bancaire','Frais de garantie / caution bancaire','Commissions bancaires','Frais de montage financier','Frais de trésorerie','Coût du crédit','Frais de couverture / swap','Frais liés aux prêts / subventions']},
  {id:'commercialisation',label:'Commercialisation',posts:['Honoraires de commercialisation','Commission de vente','Marketing / communication','Publicité / supports','Bureau / bulle de vente','Appartement témoin','Frais de vente','Frais de lancement','Portails / annonces','Gestion des réservations']},
  {id:'moa',label:'Maîtrise d’ouvrage / gestion',posts:['Honoraires de maîtrise d’ouvrage','AMO','Gestion de projet','Frais administratifs','Frais juridiques','Comptabilité / gestion','Frais de syndic / copropriété','Permis / autorisations','Consultations / appels d’offres','Gestion chantier / coordination interne']},
  {id:'relogement',label:'Relogement / accompagnement',posts:['Relogement temporaire','Déménagement','Garde-meubles','Indemnités aux occupants','Accompagnement social','Communication locataires','Permanence / médiation','Hébergement temporaire','Aides aux occupants','Remise en état après relogement']},
  {id:'autres',label:'Autres',posts:['Honoraires divers','Frais divers','Provision / aléas','Imprévus','Frais de livraison','Mobilier / équipements non travaux','Autre poste']}
];
// Lots de DPGF / libellés libres → poste travaux du questionnaire (premier motif trouvé ; ordre = du plus précis au plus large).
const TRAVAUX_KEYWORDS=[
  [2,/amiant|desamiant|deplomb/],[29,/portail|porte de garage|motoris/],[17,/menuiseries? interieure/],[3,/installation de chantier|base vie/],
  [1,/curage|demoli|mise a nu/],[5,/terrassement/],[6,/fondation|soubassement|pieux/],[7,/assainissement/],[9,/charpente/],[10,/couverture|zinguerie/],
  [11,/etanche/],[13,/facade|ravalement|enduit/],[15,/platrerie|cloison|faux[- ]?plafond|doublage/],[16,/isolation|isolant/],
  [18,/electricit|courants? (?:forts|faibles)|teledistribution|fibre|tnt\b|alarme|interphon|domotique/],[19,/plomberie|sanitaire/],
  [20,/chauffage|ventilation|\bcvc\b|climatisation|\bvmc\b|genie climatique/],[21,/photovolta|solaire|geotherm|\benr\b/],[22,/ascenseur|monte[- ]?charge|elevateur/],
  [23,/\bchapes?\b/],[24,/\bsols?\b|carrelage|faience|parquet/],[25,/peinture|revetements? muraux/],[26,/agencement/],[28,/\bvrd\b|voirie|reseaux divers/],
  [30,/serrurerie|metallerie|ferronnerie/],[31,/paysag|espaces? verts?|plantation/],[12,/menuiserie|fenetre/],[4,/gros[^a-z]*(?:oe|œ)uvre/],[8,/maconnerie|elevation/]
];
export const AID_CATEGORIES=[
  {id:'sub',label:'Subventions',short:'Subvention',kind:'capital'},{id:'cee',label:'Primes énergie (CEE)',short:'Prime CEE',kind:'capital'},
  {id:'pret',label:'Prêts aidés et bonifiés',short:'Prêt aidé',kind:'pret'},{id:'fisc',label:'Avantages fiscaux',short:'Avantage fiscal',kind:'fisc'},
  {id:'contrat',label:'Contrats de performance et tiers-financement',short:'Tiers-financement',kind:'contrat'},{id:'revenu',label:'Recettes et valorisation',short:'Recette',kind:'revenu'},
  {id:'autre',label:'Autre aide',short:'Autre',kind:'capital'}
];
export const AID_LEVELS=['Europe','État','Opérateurs nationaux','Région','Département','Intercommunalité / commune','Organismes sociaux','Établissements financiers','Acteurs privés'];
const AID_CATALOG=[
  ['feder','sub','FEDER – Fonds européen de développement régional'],['ftj','sub','FTJ – Fonds pour une transition juste'],['feader','sub','FEADER – développement rural (LEADER)'],
  ['elena','sub','ELENA – assistance technique (BEI)'],['life','sub','Programme LIFE (transition énergétique propre)'],['europe_autre','sub','Autre fonds européen (Interreg, FSE+…)'],
  ['ap_plai','sub','Aides à la pierre – subvention PLAI'],['ap_plai_adapte','sub','Aides à la pierre – prime PLAI adapté'],['ap_plus','sub','Aides à la pierre – subvention PLUS (délégataire)'],
  ['ap_bonus','sub','Aides à la pierre – bonus (petits logements, recyclage foncier, transformation de bureaux…)'],['ap_surcharge','sub','Aides à la pierre – subvention pour surcharge foncière'],
  ['ap_palulos','sub','Aides à la pierre – Palulos / rénovation énergétique'],['fonds_vert','sub','Fonds vert'],['anah','sub','Anah (MaPrimeRénov’ Copropriété…)'],
  ['anru','sub','ANRU – renouvellement urbain (NPNRU)'],['fonds_chaleur','sub','Fonds Chaleur (ADEME)'],['agence_eau','sub','Agence de l’eau'],['region','sub','Région'],
  ['departement','sub','Département'],['epci','sub','Métropole / EPCI / commune'],['action_logement_sub','sub','Action Logement – subvention'],
  ['cee','cee','Certificats d’économies d’énergie (CEE, Coup de pouce…)'],
  ['eco_pls','pret','Éco-prêt logement social'],['adapteo','pret','Prêt Adaptéo (chauffage décarboné)'],['pret_plai','pret','Prêt PLAI – prêt locatif aidé d’intégration (dont PLAI adapté, PLAI RO ANRU)'],
  ['pret_plus','pret','Prêt PLUS – prêt locatif à usage social (dont PLUS Constructions vertes)'],['pret_pls','pret','Prêt PLS – prêt locatif social'],['pret_psla','pret','Prêt PSLA – location-accession'],
  ['pret_pli','pret','Prêt PLI – logement intermédiaire'],['pret_brs','pret','Prêt Gaïa / BRS – foncier en bail réel solidaire'],['prets_bdt','pret','Autres prêts Banque des Territoires (PAM, PHB 2.0, Intracting…)'],
  ['pret_vert','pret','Prêt vert bancaire (banques, Bpifrance)'],['action_logement_pret','pret','Action Logement – prêt'],
  ['tfpb','fisc','Exonération ou abattement de TFPB'],['tva_reduite','fisc','TVA à taux réduit (5,5 % ou 10 %)'],
  ['cpe','contrat','Contrat de performance énergétique (CPE)'],['tiers_financement','contrat','Tiers-financement (CPE tiers-financé, société de tiers-financement)'],
  ['marges_locales','revenu','Marges locales bonifiées – majoration de loyer'],['lbc','revenu','Label bas-carbone – crédits carbone'],['pv_revente','revenu','Photovoltaïque – revente ou autoconsommation'],
  ['autre','autre','Autre dispositif (préciser)']
].map(([id,cat,label])=>({id,cat,label}));
const AID_SECURED=new Set(['Versée','Accordée']);
const MARGE_MOTIFS=['Performance énergétique','Certification / label','Qualité d’usage / confort','Autre critère local'];

// —— Colonnes exportées (ordre = ordre Excel, après « Code interne » et « Nom opération »)
const F=(key,label,group,type='number')=>({key,label,group,type});
export const ECONOMIC_GROUPS=[
  {id:'ident',label:'Questionnaire & opération'},{id:'synthese',label:'Synthèse financière'},{id:'couts',label:'Coûts par catégorie'},
  ...COST_CATEGORIES.map(c=>({id:`postes_${c.id}`,label:`${c.label} — postes`})),
  {id:'aides_cat',label:'Aides par catégorie'},{id:'aides_porteur',label:'Aides par porteur'},{id:'aides',label:'Aides par dispositif'}
];
export const ECONOMIC_FIELDS=[
  F('fin_operation_code','N° opération (questionnaire)','ident','text'),F('fin_contract','N° contrat (questionnaire)','ident','text'),
  F('fin_operation_label','Libellé opération (questionnaire)','ident','text'),F('fin_siap','N° opération SIAP','ident','text'),
  F('fin_siap_aids','Financements agréés SIAP','ident','text'),F('fin_version','Version du questionnaire','ident','text'),
  F('fin_confirmed_at','Date de confirmation','ident','text'),F('fin_authorization','Habilitation à transmettre','ident','text'),
  F('fin_privacy','Notice confidentialité','ident','text'),F('fin_sources','Sources utilisées','ident','text'),
  F('fin_lines_count','Lignes financières','ident'),F('fin_pdf_count','PDF joints autorisés','ident'),F('fin_excel_count','Excel joints autorisés','ident'),
  F('fin_coverage','Couverture du coût de l’opération','ident','text'),F('fin_missing_known','Postes manquants signalés','ident','text'),
  F('fin_missing','Postes manquants','ident','text'),F('fin_control_comment','Commentaire de contrôle','ident','text'),
  F('fin_final_cost','Coût final déclaré (€)','ident'),F('fin_final_same','Coût final identique au montant détaillé','ident','text'),
  F('fin_final_comment','Commentaire avant envoi','ident','text'),F('fin_aids_status','Aides mobilisées (réponse)','ident','text'),
  F('fin_aids_comment','Commentaire sur les aides','ident','text'),F('fin_dwellings','Nombre de logements (aides)','ident'),
  F('fin_notice_version','Version de la notice de confidentialité','ident','text'),F('fin_aid_catalog','Référentiel des aides','ident','text'),
  F('fin_alerts','Alertes du questionnaire','ident','text'),
  F('cost_total','Coût total opération HT (€)','synthese'),F('aid_capital','Aides non remboursables (€)','synthese'),
  F('aid_capital_pct_total','Aides non remboursables / coût total (%)','synthese'),F('aid_capital_pct_works','Aides non remboursables / travaux (%)','synthese'),
  F('aid_loans','Prêts aidés (€)','synthese'),F('aid_loans_pct_total','Prêts aidés / coût total (%)','synthese'),
  F('aid_tax_revenue','Avantages fiscaux et recettes (€)','synthese'),F('aid_third_party','Tiers-financement (€)','synthese'),
  F('own_funds','Fonds propres / emprunts classiques (€)','synthese'),F('own_funds_pct','Fonds propres / emprunts classiques (%)','synthese'),
  F('aid_mobilized','Montants mobilisés (€)','synthese'),F('aid_secured_pct','Montants sécurisés (%)','synthese'),F('aid_to_secure','Reste à sécuriser (€)','synthese'),
  F('aid_count','Nombre de dispositifs','synthese'),F('aid_levels_count','Nombre de niveaux de financeurs','synthese'),
  F('aid_first_level','Premier financeur','synthese','text'),F('aid_first_level_pct','Part du premier financeur (%)','synthese'),
  F('aid_strategy','Stratégie dominante','synthese','text'),F('aid_strategy_pct','Part de la stratégie dominante (%)','synthese'),
  F('marge_pct','Marge locale : majoration de loyer (%)','synthese'),F('marge_motif','Marge locale : motif','synthese','text'),
  F('marge_territory','Marge locale : territoire','synthese','text'),F('marge_revenue','Marge locale : recette annuelle (€)','synthese'),
  F('marge_reference_rent','Marge locale : loyer annuel de référence (€)','synthese'),F('aid_capital_per_dwelling','Aides non remboursables par logement (€)','synthese'),
  ...COST_CATEGORIES.flatMap(c=>[F(`cost_${c.id}`,`${c.label} (€ HT)`,'couts'),F(`cost_${c.id}_pct`,`${c.label} (% du coût total)`,'couts')]),
  ...COST_CATEGORIES.flatMap(c=>[...c.posts.map((p,i)=>F(`post_${c.id}_${i}`,`${c.label} — ${p} (€ HT)`,`postes_${c.id}`)),F(`post_${c.id}_other`,`${c.label} — non ventilé / postes groupés (€ HT)`,`postes_${c.id}`)]),
  ...AID_CATEGORIES.map(c=>F(`aidcat_${c.id}`,`${c.label} (€)`,'aides_cat')),
  ...AID_LEVELS.map(l=>F(`aidlvl_${normLower(l).replace(/[^a-z0-9]+/g,'_')}`,`Porteur — ${l} (€)`,'aides_porteur')),
  ...AID_CATALOG.flatMap(a=>[F(`aid_${a.id}`,`${a.label} (€)`,'aides'),F(`aid_${a.id}_status`,`${a.label} — statut`,'aides','text')])
];
export const ECONOMIC_FIELD_MAP=Object.fromEntries(ECONOMIC_FIELDS.map(f=>[f.key,f]));

// —— Lecture
const key=s=>normLower(s).replace(/[’']/g,"'").replace(/[^a-z0-9œ]+/g,' ').trim();
function moneyValue(v){
  const s=String(v??'').replace(/ /g,' ').trim();
  if(!s) return null;
  const n=parseFrNumber(s.replace(/€/g,'').replace(/\s/g,'')); return n!==null&&n>=0?n:null;
}
const round1=x=>Math.round(x*10)/10;
const pct=(a,b)=>b>0?round1(a/b*100):null;
const catById=id=>COST_CATEGORIES.find(c=>c.id===id);
function costCategory(label){ const k=key(label); return COST_CATEGORIES.find(c=>key(c.label)===k)?.id||(/travaux/.test(k)?'travaux':'autres'); }
// Poste d'une ligne : libellé exact de la nomenclature, sinon (travaux) mot-clé ; plusieurs postes « a | b » → non ventilé.
export function costPostIndex(catId,label){
  const cat=catById(catId); if(!cat) return null;
  const parts=String(label||'').split('|').map(s=>s.trim()).filter(Boolean);
  if(parts.length!==1) return null;
  const k=key(parts[0]).replace(/^(?:lot\s*)?(?:n\s*)?\d+[a-z]?\s*/,'').trim();
  const exact=cat.posts.findIndex(p=>key(p)===key(parts[0])||key(p).replace(/^\d+(?: \d+)? /,'')===k);
  if(exact>=0) return exact;
  if(catId!=='travaux') return null;
  const hit=TRAVAUX_KEYWORDS.find(([,re])=>re.test(normLower(parts[0])));
  return hit?hit[0]:null;
}
function aidFromLabel(label){
  const k=key(label);
  return AID_CATALOG.find(a=>key(a.label)===k)||AID_CATALOG.find(a=>a.id!=='autre'&&(k.startsWith(key(a.label))||key(a.label).startsWith(k)))||AID_CATALOG.find(a=>a.id==='autre');
}

// Pages de la synthèse PDF du questionnaire (cellules reconstruites à la lecture, voir readers.js).
export function isFinancialQuestionnaire(doc){
  if(doc?.read?.financialQuestionnaire) return true;
  const t=normLower(String(doc?.read?.text||'').slice(0,60000)).replace(/\s+/g,'');
  return /questionnairefinancier/.test(t)&&/donneesfinancieresvalidees|aidesmobilisees/.test(t);
}
const cellText=l=>(Array.isArray(l.cells)?l.cells.filter(Boolean).join(' · '):String(l.text||''));
// Tableaux « Données financières validées » et « Aides mobilisées » : une ligne commence quand la 1re colonne est remplie,
// les lignes suivantes sans 1re colonne la complètent (libellés sur plusieurs lignes).
function readTables(doc){
  const costs=[],aids=[]; let total=null;
  for(const page of doc.read?.pages||[]){
    let cols=null,kind=null,row=null;
    for(const line of page.lines||[]){
      const c=line.cells; const flat=key(cellText(line));
      if(Array.isArray(c)&&c.length>=4&&/montant/.test(flat)&&(/lot poste/.test(flat)||/statut/.test(flat))){
        kind=/statut/.test(flat)?'aid':'cost'; cols=c.map(key); row=null; continue;
      }
      if(!cols) continue;
      if(!Array.isArray(c)||/^(?:aides non remboursables|prestaterre certifications|https?)/.test(flat)){ cols=null; continue; }
      const at=re=>cols.findIndex(x=>re.test(x));
      if(kind==='cost'&&/^total operation/.test(key(c[0]||''))){ total=moneyValue(c[at(/montant/)]); cols=null; continue; }
      if(String(c[0]||'').trim()){ row={cols,parts:c.map(v=>v?[v]:[]),page:page.page,excerpt:cellText(line)}; (kind==='cost'?costs:aids).push(row); }
      else if(row) c.forEach((v,i)=>{ if(v) row.parts[i]?.push(v); });
    }
  }
  return {costs,aids,total};
}
function costLine(r,doc){
  const col=re=>{ const i=(r.cols||[]).findIndex(x=>re.test(x)); return i>=0?r.parts[i]||[]:[]; };
  const label=col(/lot poste/).join(' ').replace(/\s+/g,' ').trim(), category=costCategory(col(/categorie/).join(' '));
  return {source:col(/source/).join(' '),label,category,amount:moneyValue(col(/montant/).join(' ')),comment:col(/commentaire/).join(' '),document:doc.name,docId:doc.id,page:r.page,excerpt:r.excerpt};
}
function aidLine(r,doc){
  const col=re=>{ const i=(r.cols||[]).findIndex(x=>re.test(x)); return i>=0?r.parts[i]||[]:[]; };
  const who=[...col(/aide porteur/)]; const level=AID_LEVELS.find(l=>key(l)===key(who[who.length-1]||''))||''; if(level) who.pop();
  const label=who.join(' ').replace(/\s+/g,' ').trim(); const aid=aidFromLabel(label);
  const status=col(/statut/).join(' ').trim(); const calc=col(/calcul/).join(' ').replace(/\s+/g,' ').trim();
  return {category:col(/categorie/).join(' '),label,aid:aid.id,aidCategory:aid.cat,level,calc,amount:moneyValue(col(/montant/).join(' ')),status,comment:col(/commentaire/).join(' '),document:doc.name,docId:doc.id,page:r.page,excerpt:r.excerpt};
}
function readIdentity(doc){
  const v={}; const pages=doc.read?.pages||[];
  const all=pages.flatMap(p=>(p.lines||[]).map(cellText));
  for(const t of all){
    let m;
    if(!v.fin_operation_code&&(m=t.match(/\b(OPE-\d{3,})\s*·\s*Contrat\s*(\d+)\s*·\s*([^·←]+?)\s*(?:·|$)/))){ v.fin_operation_code=m[1]; v.fin_contract=m[2]; v.fin_operation_label=m[3].trim(); }
    if(!v.fin_version&&(m=t.match(/Questionnaire\s*financier\s*MOA\s*V\s*(\d+[.,]\d+)/i))) v.fin_version=`V${m[1]}`;
    if((m=t.match(/Lignes\s*financi[eè]res\s*:\s*(\d+)/i))) v.fin_lines_count=Number(m[1]);
    if((m=t.match(/PDF\s*joints\s*:\s*(\d+)/i))) v.fin_pdf_count=Number(m[1]);
    if((m=t.match(/Excel\s*joints\s*:\s*(\d+)/i))) v.fin_excel_count=Number(m[1]);
    if((m=t.match(/Habilitation\s*à\s*transmettre\s*:\s*([^·]+)/i))) v.fin_authorization=m[1].trim();
    if((m=t.match(/Notice\s*confidentialit[ée]\s*:\s*([^·]+)/i))) v.fin_privacy=m[1].trim();
    if((m=t.match(/Confirmation\s*:\s*(\d{2}\/\d{2}\/\d{4})/i))) v.fin_confirmed_at=m[1];
  }
  // N° SIAP : la ligne suivant le titre ; le texte d'aide « N° d'opération SIAP » signifie champ vide.
  for(const p of pages){ const L=(p.lines||[]).map(cellText); const i=L.findIndex(t=>/NUM[ÉE]RO\s*D.OP[ÉE]RATION\s*SIAP/i.test(t));
    if(i<0) continue; const n=(L[i+1]||'').trim(); if(n&&!/^N°\s*d.op[ée]ration\s*SIAP$/i.test(n)) v.fin_siap=n;
    const j=L.findIndex(t=>/financements\s*agr[ée]{2}s\s*dans\s*SIAP/i.test(t)); const tail=j<0?[]:L.slice(j+1).filter(t=>!/^https?:|^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(t.trim())); if(tail.length) v.fin_siap_aids=tail.join(' ; ').replace(/\s+/g,' ').trim(); }
  return v;
}
export function parseFinancialQuestionnaire(doc){
  if(doc?.read?.financialQuestionnaire) return parseFinancialJson(doc.read.financialQuestionnaire,doc);
  const {costs,aids,total}=readTables(doc);
  return {identity:readIdentity(doc),costs:costs.map(r=>costLine(r,doc)).filter(l=>l.label&&l.amount!==null),aids:aids.map(r=>aidLine(r,doc)).filter(l=>l.amount!==null),total};
}

// —— Export JSON du questionnaire (« _questionnaire.json », seul ou dans le paquet .zip) : source prioritaire, sans
// reconstruction de mise en page. Fichier transmis par un tiers : seuls les champs attendus sont lus, typés un par un.
const ecoTxt=v=>v===undefined||v===null?'':String(v).replace(/\s+/g,' ').trim();
const ecoNum=v=>{ const n=typeof v==='number'?v:parseFrNumber(String(v??'')); return Number.isFinite(n)?n:null; };
const ecoYesNo=v=>v===true||v==='yes'?'Oui':v===false||v==='no'?'Non':v==='pending'?'En cours':ecoTxt(v);
const ecoArr=v=>Array.isArray(v)?v:[];
export function isFinancialJson(data){ return !!(data&&typeof data==='object'&&data.operation&&typeof data.operation==='object'&&Array.isArray(data.financier?.lignesValidees)); }
const SIAP_AIDS=new Set(['ap_plai','ap_plai_adapte','ap_plus','ap_bonus','ap_surcharge','ap_palulos','pret_plai','pret_plus','pret_pls','pret_psla']);
export function parseFinancialJson(d,doc={}){
  const op=d.operation||{}, fi=d.financier||{}, tr=d.transmission||{}, co=d.complementaires||{}, cf=d.conformite||{}, ai=d.aides||{};
  const costs=ecoArr(fi.lignesValidees).map(l=>({source:ecoTxt(l.source),label:ecoTxt(l.lot),category:costCategory(ecoTxt(l.categorie)),amount:ecoNum(l.montant),comment:ecoTxt(l.commentaire),document:ecoTxt(l.fichier)||doc.name||'',docId:doc.id,page:''})).filter(l=>l.label&&l.amount!==null);
  const aids=ecoArr(ai.lignes).map(a=>{ const known=AID_CATALOG.find(x=>x.id===ecoTxt(a.aideId)); const cat=AID_CATEGORIES.find(c=>c.id===ecoTxt(a.categorie))?.id||known?.cat||'autre';
    return {category:ecoTxt(a.nature),label:ecoTxt(a.dispositif)||known?.label||'',aid:known?.id||'autre',aidCategory:cat,level:AID_LEVELS.find(l=>l===ecoTxt(a.porteur))||ecoTxt(a.porteur),calc:ecoTxt(a.saisieLibelle),amount:ecoNum(a.montant),status:ecoTxt(a.statut),comment:ecoTxt(a.commentaire),siapNumber:ecoTxt(a.numeroSIAP),document:doc.name||'',docId:doc.id,page:''}; }).filter(a=>a.amount!==null);
  const confirmed=Date.parse(cf.confirmeLe||''); const version=ecoTxt(ai.referentielAides).match(/V\s*(\d+[.,]\d+)/i);
  const identity={fin_operation_code:ecoTxt(op.numeroOperation),fin_contract:ecoTxt(op.contrat),fin_operation_label:ecoTxt(op.commune),
    fin_siap:ecoTxt(op.numeroSIAP)||aids.map(a=>a.siapNumber).find(Boolean)||'',fin_siap_aids:[...new Set(aids.filter(a=>SIAP_AIDS.has(a.aid)).map(a=>a.label))].join(' ; '),
    fin_version:version?`V${version[1]}`:'',fin_confirmed_at:Number.isFinite(confirmed)?new Date(confirmed).toLocaleDateString('fr-FR'):'',
    fin_authorization:cf.habilitationTransmission===true?'confirmée':cf.habilitationTransmission===false?'non confirmée':'',
    fin_privacy:cf.priseConnaissanceConfidentialite===true?'prise en compte':cf.priseConnaissanceConfidentialite===false?'non prise en compte':'',
    fin_lines_count:costs.length,fin_pdf_count:Array.isArray(tr.fichiersPDFJoints)?tr.fichiersPDFJoints.length:null,fin_excel_count:Array.isArray(tr.fichiersExcelJoints)?tr.fichiersExcelJoints.length:null,
    fin_coverage:ecoTxt(fi.couverture),fin_missing_known:ecoYesNo(fi.postesManquantsConnus),fin_missing:ecoTxt(fi.postesManquants),fin_control_comment:ecoTxt(fi.commentaireControle),
    fin_final_cost:ecoNum(co.coutFinal),fin_final_same:co.coutFinalIdentiqueMontantDetaille===undefined?'':ecoYesNo(co.coutFinalIdentiqueMontantDetaille),fin_final_comment:ecoTxt(co.commentaireAvantEnvoi),
    fin_aids_status:ecoYesNo(ai.statut),fin_aids_comment:ecoTxt(ai.commentaire),fin_dwellings:ecoNum(ai.nombreLogements),aid_capital_per_dwelling:ecoNum(ai.aidesNonRemboursablesParLogement),
    fin_notice_version:ecoTxt(cf.versionNotice),fin_aid_catalog:ecoTxt(ai.referentielAides),fin_alerts:ecoArr(ai.alertes).map(a=>ecoTxt(typeof a==='object'?(a.message||a.texte||a.label):a)).filter(Boolean).join(' ; ')};
  const marge=ecoArr(ai.margesLocales)[0];
  if(marge) Object.assign(identity,{marge_pct:ecoNum(marge.tauxMajorationLoyer),marge_motif:ecoTxt(marge.motif),marge_territory:ecoTxt(marge.territoire),marge_reference_rent:ecoNum(marge.loyerAnnuelReference),marge_revenue:ecoNum(marge.recetteAnnuelleEstimee)});
  for(const k of Object.keys(identity)) if(identity[k]===''||identity[k]===null) delete identity[k];
  return {identity,costs,aids,total:ecoNum(fi.montantTotalOperation),json:true};
}
// Page de texte lisible pour la recherche libre, l'assistance IA et le classement du document.
export function financialJsonRead(d){
  const p=parseFinancialJson(d); const id=p.identity; const eur=n=>`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n)} €`;
  const lines=[`Questionnaire financier Prestaterre — export JSON ${id.fin_version||''}`.trim(),[id.fin_operation_code,id.fin_contract&&`Contrat ${id.fin_contract}`,id.fin_operation_label].filter(Boolean).join(' · '),
    p.total!==null?`Total opération ${eur(p.total)}`:'','Données financières validées',...p.costs.map(l=>[l.source,l.label,COST_CATEGORIES.find(c=>c.id===l.category)?.label,eur(l.amount)].join(' · ')),
    'Aides mobilisées',...p.aids.map(a=>[a.label,a.level,a.calc,eur(a.amount),a.status].filter(Boolean).join(' · '))].filter(Boolean);
  const text=lines.join('\n');
  return {kind:'json',pages:[{page:1,text,lines:lines.map((t,index)=>({index,text:normalizeText(t),items:[]}))}],text,pageCount:1,financialQuestionnaire:d};
}

// —— DPGF (repli) : prix HT par lot
function cleanLotLabel(s){ return normalizeText(String(s||'')).replace(/^total\s+/i,'').replace(/\s*[:|].*$/,'').replace(/\s{2,}/g,' ').trim(); }
function canonicalLotKey(label){ return normLower(label).replace(/\bn[°o]\b/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function candidateFromCells(cells,sheet=''){
  const vals=(cells||[]).map(v=>String(v??'').trim()); const joined=normalizeText(vals.join(' | ')); const low=normLower(joined);
  if(!/\blot\b/.test(low)||/sous[- ]?total|total\s+g[eé]n[eé]ral|tva|ttc/.test(low)) return null;
  const labelCell=vals.find(v=>/\blot\b/i.test(v))||'';
  const label=cleanLotLabel(labelCell || joined.split('|')[0]);
  const nums=[]; vals.forEach((v,idx)=>{ const n=moneyValue(v); if(n!==null) nums.push({n,idx,raw:v}); });
  if(!nums.length) return null;
  // Dans un DPGF, le montant HT de ligne/lot est généralement la dernière valeur monétaire de la ligne.
  const amount=nums[nums.length-1].n;
  if(!label||amount<=0) return null;
  const score=/total\s+lot/i.test(joined)?.99:(/montant\s*ht|prix\s*ht|total\s*ht/i.test(joined)?.97:.91);
  return {label,amount,confidence:score,sheet,excerpt:joined};
}
function parseDpgfDocument(doc){
  const out=[];
  for(const page of doc.read?.pages||[]){
    const lines=page.lines||[];
    for(const line of lines){
      let c=null;
      if(Array.isArray(line.cells)) c=candidateFromCells(line.cells,page.sheet||'');
      if(!c){
        const raw=normalizeText(line.text||''); const low=normLower(raw);
        if(/\blot\b/.test(low)&&!/tva|ttc|total\s+g[eé]n[eé]ral/.test(low)){
          const m=raw.match(/((?:lot|LOT)\s*(?:n?[°o]?\s*)?[0-9A-Z.-]{0,8}\s*[-–:]?\s*[^|€]{2,80}?)(?:\||\s{2,})([^|]*?(?:€|eur|ht)?\s*)$/i);
          const nums=[...raw.matchAll(/(?:^|\s|\|)(-?[\d\s]+(?:[.,]\d{1,2})?)\s*(?:€|eur)?(?=\s|\||$)/gi)].map(x=>moneyValue(x[1])).filter(x=>x!==null);
          if(nums.length){ const label=cleanLotLabel(m?.[1]||raw.split('|')[0]); const amount=nums[nums.length-1]; if(label&&amount>0) c={label,amount,confidence:/total\s+lot/i.test(raw)?.99:.91,sheet:page.sheet||'',excerpt:raw}; }
        }
      }
      if(c) out.push({...c,document:doc.name,page:page.page,docId:doc.id});
    }
    // Feuille dédiée à un lot : accepter un total HT explicite même si la ligne ne répète pas le mot LOT.
    if(page.sheet&&/\blot\b/i.test(page.sheet)){
      const totals=lines.filter(l=>/total\s*(?:du\s*)?(?:lot)?\s*ht|montant\s*ht|total\s*ht/i.test(l.text||''));
      for(const line of totals){ const nums=(line.cells||[]).map(moneyValue).filter(x=>x!==null); if(nums.length){ out.push({label:cleanLotLabel(page.sheet),amount:nums[nums.length-1],confidence:.98,sheet:page.sheet,excerpt:normalizeText(line.text),document:doc.name,page:page.page,docId:doc.id}); break; } }
    }
  }
  return out;
}
function dpgfLines(docs){
  const best=new Map();
  for(const c of docs.filter(d=>d.type===DOC_TYPES.DPGF).flatMap(parseDpgfDocument)){ const k=canonicalLotKey(c.label); const prev=best.get(k); if(!prev||c.confidence>=prev.confidence) best.set(k,c); }
  return [...best.values()].sort((a,b)=>a.label.localeCompare(b.label,'fr',{numeric:true})).map(c=>({source:'DPGF',label:c.label,category:'travaux',amount:c.amount,comment:'',document:c.document,docId:c.docId,page:c.page,excerpt:c.excerpt}));
}

// —— Agrégation : une ligne de valeurs par opération (clé = colonne de la nomenclature)
function aggregate(costs,aids,pdfTotal){
  const v={}; const add=(k,x)=>{ v[k]=(v[k]||0)+x; };
  for(const l of costs){ add(`cost_${l.category}`,l.amount); const i=costPostIndex(l.category,l.label); add(i===null?`post_${l.category}_other`:`post_${l.category}_${i}`,l.amount); }
  const sum=costs.reduce((s,l)=>s+l.amount,0);
  if(costs.length||pdfTotal) v.cost_total=pdfTotal??sum;
  for(const c of COST_CATEGORIES) if(v[`cost_${c.id}`]) v[`cost_${c.id}_pct`]=pct(v[`cost_${c.id}`],v.cost_total);
  if(costs.length) v.fin_sources=[...new Set(costs.map(l=>l.source).filter(Boolean))].join(' + ');
  if(aids.length){
    const kind=id=>AID_CATEGORIES.find(c=>c.id===id)?.kind;
    const by=k=>aids.filter(a=>kind(a.aidCategory)===k).reduce((s,a)=>s+a.amount,0);
    v.aid_capital=by('capital'); v.aid_loans=by('pret'); v.aid_tax_revenue=by('fisc')+by('revenu'); v.aid_third_party=by('contrat');
    v.aid_mobilized=aids.reduce((s,a)=>s+a.amount,0);
    const secured=aids.filter(a=>AID_SECURED.has(a.status)).reduce((s,a)=>s+a.amount,0);
    v.aid_secured_pct=pct(secured,v.aid_mobilized); v.aid_to_secure=v.aid_mobilized-secured;
    v.aid_count=aids.length; v.aid_levels_count=new Set(aids.map(a=>a.level).filter(Boolean)).size;
    if(v.cost_total){ v.aid_capital_pct_total=pct(v.aid_capital,v.cost_total); v.aid_loans_pct_total=pct(v.aid_loans,v.cost_total); v.own_funds=v.cost_total-v.aid_capital-v.aid_loans; v.own_funds_pct=pct(v.own_funds,v.cost_total); }
    if(v.cost_travaux) v.aid_capital_pct_works=pct(v.aid_capital,v.cost_travaux);
    for(const c of AID_CATEGORIES){ const s=aids.filter(a=>a.aidCategory===c.id).reduce((t,a)=>t+a.amount,0); if(s) v[`aidcat_${c.id}`]=s; }
    const levels=new Map(); for(const a of aids) if(a.level) levels.set(a.level,(levels.get(a.level)||0)+a.amount);
    for(const [l,s] of levels) v[`aidlvl_${normLower(l).replace(/[^a-z0-9]+/g,'_')}`]=s;
    const first=[...levels].sort((a,b)=>b[1]-a[1])[0]; if(first){ v.aid_first_level=first[0]; v.aid_first_level_pct=pct(first[1],v.aid_mobilized); }
    const strat=[['subventions et primes',v.aid_capital],['prêts aidés',v.aid_loans],['avantages fiscaux et recettes',v.aid_tax_revenue],['tiers-financement',v.aid_third_party]].sort((a,b)=>b[1]-a[1])[0];
    if(strat[1]>0){ v.aid_strategy=strat[0]; v.aid_strategy_pct=pct(strat[1],v.aid_mobilized); }
    for(const a of aids){ add(`aid_${a.aid}`,a.amount); const k=`aid_${a.aid}_status`; v[k]=[...new Set([...(v[k]?String(v[k]).split(' ; '):[]),a.status].filter(Boolean))].join(' ; '); }
    const marge=aids.find(a=>a.aid==='marges_locales');
    if(marge){ const m=marge.calc.match(/(\d+(?:[.,]\d+)?)\s*%/); if(m) v.marge_pct=parseFrNumber(m[1]); v.marge_motif=MARGE_MOTIFS.find(x=>key(marge.calc).includes(key(x)))||'';
      const parts=marge.calc.split('·').map(s=>s.trim()); const terr=parts.find(p=>p&&!/%|€/.test(p)&&!MARGE_MOTIFS.some(x=>key(x)===key(p))); if(terr) v.marge_territory=terr; v.marge_revenue=marge.amount; }
  }
  for(const k of Object.keys(v)) if(v[k]===''||v[k]===null) delete v[k];
  return v;
}

// Point d'entrée : {operation, values, costs, aids, documents, source} ; `manual` = saisies de l'onglet Économie
// ({clé de colonne: valeur}) ; une ancienne saisie « libellé de lot → montant » (≤ v2.4) devient une ligne travaux.
export function analyzeEconomicData(docs,operation='',manual={}){
  const ready=(docs||[]).filter(d=>d.status==='ready');
  // shortcut: un seul questionnaire par opération (le premier lu) ; à fusionner si plusieurs versions sont jointes.
  // L'export JSON prime sur la synthèse PDF (mêmes données, sans reconstruction de mise en page).
  const qDoc=ready.find(d=>d.read?.financialQuestionnaire)||ready.find(d=>d.type===DOC_TYPES.FINANCIAL||isFinancialQuestionnaire(d));
  const q=qDoc?parseFinancialQuestionnaire(qDoc):null;
  // Le questionnaire reprend déjà les DPGF joints : les lire aussi compterait les lots deux fois.
  const costs=q?q.costs:dpgfLines(ready), aids=q?q.aids:[];
  const legacy={};
  for(const [k,val] of Object.entries(manual||{})){ if(!ECONOMIC_FIELD_MAP[k]&&Number.isFinite(Number(val))) costs.push({source:'Manuel',label:k,category:'travaux',amount:Number(val),comment:'Saisie manuelle',document:'Correction utilisateur',page:''}); else legacy[k]=val; }
  // Valeurs déclarées par le questionnaire (JSON : marge locale, couverture…) prioritaires sur les valeurs recalculées.
  const values=q?.json?{...aggregate(costs,aids,q.total??null),...q.identity}:{...(q?.identity||{}),...aggregate(costs,aids,q?.total??null)};
  const manualKeys=[];
  for(const [k,val] of Object.entries(legacy)){ if(val===''||val===null||val===undefined) continue; values[k]=val; manualKeys.push(k); }
  return {operation,values,manualKeys,costs,aids,source:qDoc?`Questionnaire financier (${qDoc.name})`:costs.length?'DPGF':'',documents:qDoc?[qDoc.name]:ready.filter(d=>d.type===DOC_TYPES.DPGF).map(d=>d.name),total:values.cost_total??0};
}
