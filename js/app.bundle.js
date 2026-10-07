/* ExtracTerre bundled runtime v2.3.7 - compatible file:// and GitHub Pages */
(function(){
'use strict';

/* ---- config.js ---- */
const APP_VERSION = '2.3.7';
const MIN_RETAINED_CONFIDENCE = 0.90;
const MIN_REVIEW_CONFIDENCE = 0.65;
const ANALYSIS_MODES = Object.freeze({
  safe:Object.freeze({key:'safe',label:'Sécurisé',documents:1,ocr:1,description:'1 document / 1 OCR'}),
  balanced:Object.freeze({key:'balanced',label:'Équilibré',documents:3,ocr:1,description:'3 documents / 1 OCR'}),
  fast:Object.freeze({key:'fast',label:'Rapide',documents:5,ocr:2,description:'5 documents / 2 OCR'})
});
const DEFAULT_ANALYSIS_MODE = 'balanced';
// Compatibilité avec les modules/tests existants : ces constantes représentent le profil par défaut.
const MAX_OCR_WORKERS = ANALYSIS_MODES[DEFAULT_ANALYSIS_MODE].ocr;
const MAX_DOCUMENT_CONCURRENCY = ANALYSIS_MODES[DEFAULT_ANALYSIS_MODE].documents;

const DOC_TYPES = {
  RSET_RE2020: 'RSET RE2020',
  RSEE_RE2020: 'RSEE RE2020',
  RSENV: 'RSENV / RSNV',
  RT2012: 'RT2012',
  RT_EXISTING: 'RT Existant',
  THERMAL: 'Étude thermique',
  CONTRACT: 'Contrat',
  OPERATION_BOOKLET: "Livret d'opération",
  DESIGN_REPORT: 'CR de conception',
  ENV_REPORT: 'CR environnemental',
  REQUIREMENTS: 'Choix des exigences',
  PROJECT_DESCRIPTION: 'Descriptif du projet',
  CCTP: 'CCTP',
  DPGF: 'DPGF',
  PLAN: 'Plan architectural',
  SURFACE: 'Tableau de surfaces',
  NOTICE: 'Notice architecturale / pièce écrite architecte',
  PERMIT: 'Permis / pièce administrative',
  DIAGNOSTIC: 'Diagnostic',
  AIRTIGHTNESS: "Rapport d'imperméabilité",
  DPE: 'DPE',
  CARBON: 'Étude carbone / ACV',
  MANUAL: 'Entrée manuelle',
  UNKNOWN: 'Document inconnu'
};

const FIELD_DEFS = [
  {key:"internal_code",label:"Code interne",family:"Administration",type:"text",tags:["Code interne", "code opération", "code interne opération", "n° opération", "numero operation"] ,presence:false},
  {key:"operation_name",label:"Nom opération",family:"Administration",type:"text",tags:["Nom opération", "nom de l'opération", "nom de l operation", "opération interne"] ,presence:false},
  {key:"contract_status",label:"Contrat: Statut",family:"Administration",type:"text",tags:["Contrat: Statut", "Contrat Statut", "Statut Contrat", "état contrat"] ,presence:false},
  {key:"evaluation_status",label:"Évaluation: Statut",family:"Administration",type:"text",tags:["Évaluation: Statut", "Évaluation Statut", "Statut Évaluation", "état évaluation"] ,presence:false},
  {key:"case_stage",label:"Affaire: Étape",family:"Administration",type:"text",tags:["Affaire: Étape", "Affaire Étape", "Étape Affaire", "phase affaire"] ,presence:false},
  {key:"client_program_name",label:"Nom du programme (client)",family:"Administration",type:"text",tags:["Nom du programme (client)", "Nom du programme", "nom programme client", "programme client"] ,presence:false},
  {key:"owner_company",label:"Maître d'ouvrage: Nom de la société",family:"Administration",type:"text",tags:["Maître d'ouvrage: Nom de la société", "Maître d'ouvrage Nom de la société", "Nom de la société Maître d'ouvrage", "maître d'ouvrage", "maitre d ouvrage", "MOA", "client", "société maître d’ouvrage", "societe maitre d ouvrage"] ,presence:false},
  {key:"owner_main_company",label:"Maître d'ouvrage: Société principale: Nom de la société",family:"Administration",type:"text",tags:["Maître d'ouvrage: Société principale: Nom de la société", "Maître d'ouvrage Société principale: Nom de la société", "Société principale: Nom de la société Maître d'ouvrage", "société principale du maître d’ouvrage", "societe principale du maitre d ouvrage", "MOA société principale"] ,presence:false},
  {key:"owner_hierarchy",label:"Maître d'ouvrage: Hiérarchie",family:"Administration",type:"text",tags:["Maître d'ouvrage: Hiérarchie", "Maître d'ouvrage Hiérarchie", "Hiérarchie Maître d'ouvrage", "hiérarchie maître d’ouvrage", "hierarchie maitre d ouvrage", "hiérarchie MOA"] ,presence:false},
  {key:"stage",label:"Étape",family:"Administration",type:"text",tags:["Étape", "phase", "étape projet"] ,presence:false},
  {key:"creation_date",label:"Date de création",family:"Administration",type:"text",tags:["Date de création", "créé le", "date création"] ,presence:false},
  {key:"case_name",label:"Affaire: Nom de l'affaire",family:"Administration",type:"text",tags:["Affaire: Nom de l'affaire", "Affaire Nom de l'affaire", "Nom de l'affaire Affaire", "nom affaire", "affaire", "intitulé affaire"] ,presence:false},
  {key:"case_creation_date",label:"Affaire: Date de création",family:"Administration",type:"text",tags:["Affaire: Date de création", "Affaire Date de création", "Date de création Affaire", "date création affaire"] ,presence:false},
  {key:"case_accepted_date",label:"Affaire: Accepté le",family:"Administration",type:"text",tags:["Affaire: Accepté le", "Affaire Accepté le", "Accepté le Affaire", "date acceptation affaire", "affaire acceptée le"] ,presence:false},
  {key:"case_amount_ht",label:"Montant HT affaire",family:"Administration",type:"number",tags:["Montant HT affaire", "montant affaire HT", "montant HT de l’affaire", "montant HT de l affaire"] ,presence:false},
  {key:"contract_number",label:"Contrat: Numéro du contrat",family:"Administration",type:"text",tags:["Contrat: Numéro du contrat", "Contrat Numéro du contrat", "Numéro du contrat Contrat", "numéro contrat", "n° contrat", "référence contrat"] ,presence:false},
  {key:"contract_creation_date",label:"Contrat: Date de création",family:"Administration",type:"text",tags:["Contrat: Date de création", "Contrat Date de création", "Date de création Contrat", "date création contrat"] ,presence:false},
  {key:"contract_activation_date",label:"Contrat: Date d'activation",family:"Administration",type:"text",tags:["Contrat: Date d'activation", "Contrat Date d'activation", "Date d'activation Contrat", "date activation contrat", "contrat activé le"] ,presence:false},
  {key:"order_amount_ht",label:"Montant HT commande",family:"Administration",type:"number",tags:["Montant HT commande", "montant commande HT", "montant HT de la commande"] ,presence:false},
  {key:"evaluation_internal_code",label:"Évaluation: Code interne",family:"Administration",type:"text",tags:["Évaluation: Code interne", "Évaluation Code interne", "Code interne Évaluation", "code évaluation"] ,presence:false},
  {key:"evaluation_creation_date",label:"Évaluation: Date de création",family:"Administration",type:"text",tags:["Évaluation: Date de création", "Évaluation Date de création", "Date de création Évaluation", "date création évaluation"] ,presence:false},
  {key:"certification_ap_date",label:"Certification: Date de décision AP",family:"Administration",type:"text",tags:["Certification: Date de décision AP", "Certification Date de décision AP", "Date de décision AP Certification", "date décision AP", "décision AP"] ,presence:false},
  {key:"certification_cd_date",label:"Certification: Date de décision CD",family:"Administration",type:"text",tags:["Certification: Date de décision CD", "Certification Date de décision CD", "Date de décision CD Certification", "date décision CD", "décision CD"] ,presence:false},
  {key:"work_type",label:"Ouvrage",family:"Programme",type:"text",tags:["Ouvrage", "type ouvrage", "type d’ouvrage", "type d ouvrage", "usage ouvrage", "type de bâtiment"] ,presence:false},
  {key:"housing_individual_scattered",label:"Individuel diffus (maison individuelle)",family:"Programme",type:"number",tags:["Individuel diffus (maison individuelle)", "Individuel diffus", "maison individuelle", "maisons individuelles", "MI diffus"] ,presence:false},
  {key:"housing_grouped_units",label:"Individuel groupé - Nombre de logements",family:"Programme",type:"number",tags:["Individuel groupé - Nombre de logements", "logements individuels groupés", "nb logements individuel groupé", "nombre logements IG"] ,presence:false},
  {key:"housing_grouped_buildings",label:"Individuel groupé - Nombre de bâtiments",family:"Programme",type:"number",tags:["Individuel groupé - Nombre de bâtiments", "bâtiments individuels groupés", "nb bâtiments individuel groupé", "nombre bâtiments IG"] ,presence:false},
  {key:"housing_collective_units",label:"Logement collectif - Nombre de logements",family:"Programme",type:"number",tags:["Logement collectif - Nombre de logements", "nombre logements collectifs", "nb logements collectifs", "logements collectifs"] ,presence:false},
  {key:"housing_collective_buildings",label:"Logement collectif - Nombre de bâtiments",family:"Programme",type:"number",tags:["Logement collectif - Nombre de bâtiments", "nombre bâtiments collectifs", "nb bâtiments collectifs"] ,presence:false},
  {key:"housing_community_units",label:"Hab. communautaire - Nombre de logements",family:"Programme",type:"number",tags:["Hab. communautaire - Nombre de logements", "habitat communautaire logements", "nombre logements habitat communautaire", "résidence communautaire logements"] ,presence:false},
  {key:"housing_uncertified",label:"Logements non certifiés",family:"Programme",type:"number",tags:["Logements non certifiés", "nombre logements non certifiés", "logements hors certification"] ,presence:false},
  {key:"housing_total",label:"Total logements",family:"Programme",type:"number",tags:["Total logements", "nombre total de logements", "nb total logements", "total des logements"] ,presence:false},
  {key:"building_total",label:"Total bâtiments",family:"Programme",type:"number",tags:["Total bâtiments", "nombre total de bâtiments", "nb total bâtiments", "total des bâtiments"] ,presence:false},
  {key:"reference_name",label:"Référentiel: Nom du référentiel",family:"Certification & exigences",type:"text",tags:["Référentiel: Nom du référentiel", "Référentiel Nom du référentiel", "Nom du référentiel Référentiel", "nom du référentiel", "référentiel applicable", "référentiel"] ,presence:false},
  {key:"reference_version",label:"Version du référentiel applicable: Version",family:"Certification & exigences",type:"text",tags:["Version du référentiel applicable: Version", "Version du référentiel applicable Version", "Version Version du référentiel applicable", "version du référentiel", "version referentiel", "millésime référentiel", "version applicable"] ,presence:false},
  {key:"mentions",label:"Mentions",family:"Certification & exigences",type:"text",tags:["Mentions", "mentions retenues", "mentions choisies", "labels et mentions"] ,presence:false},
  {key:"performance",label:"Performance",family:"Certification & exigences",type:"text",tags:["Performance", "niveau de performance", "performances retenues", "performance retenue"] ,presence:false},
  {key:"selected_profile",label:"Profil choisi",family:"Certification & exigences",type:"text",tags:["Profil choisi", "profil", "profil retenu", "profil sélectionné"] ,presence:false},
  {key:"built_before_1948",label:"Bâtiment construit avant 1948",family:"Certification & exigences",type:"text",tags:["Bâtiment construit avant 1948", "avant 1948", "construction avant 1948"] ,presence:true},
  {key:"built_after_1948",label:"Bâtiment construit après 1948",family:"Certification & exigences",type:"text",tags:["Bâtiment construit après 1948", "après 1948", "construction après 1948"] ,presence:true},
  {key:"renovation",label:"Rénovation",family:"Certification & exigences",type:"text",tags:["Rénovation", "opération de rénovation", "rénovation bâtiment"] ,presence:true},
  {key:"anru_zone",label:"Zone ANRU",family:"Certification & exigences",type:"text",tags:["Zone ANRU", "ANRU", "zone de rénovation urbaine", "NPNRU"] ,presence:true},
  {key:"no_mention",label:"Sans mention",family:"Certification & exigences",type:"text",tags:["Sans mention", "aucune mention", "sans label", "aucun label"] ,presence:true},
  {key:"environmental_performance",label:"Performance environnementale",family:"Certification & exigences",type:"text",tags:["Performance environnementale", "performance env", "niveau environnemental"] ,presence:false},
  {key:"mention_building_performance",label:"Mention Bâtiment Performance",family:"Certification & exigences",type:"text",tags:["Mention Bâtiment Performance", "bâtiment performance"] ,presence:true},
  {key:"mention_bee_plus",label:"Mention BEE+",family:"Certification & exigences",type:"text",tags:["Mention BEE+", "BEE+", "BEE +"] ,presence:true},
  {key:"mention_tfpb",label:"Mention Option TFPB",family:"Certification & exigences",type:"text",tags:["Mention Option TFPB", "option TFPB", "TFPB"] ,presence:true},
  {key:"mention_ec",label:"Mention Label E+C-",family:"Certification & exigences",type:"text",tags:["Mention Label E+C-", "label E+C-", "E+C-", "E+C−", "énergie carbone"] ,presence:true},
  {key:"derogation_ec",label:"Dérogation E+C-",family:"Certification & exigences",type:"text",tags:["Dérogation E+C-", "dérogation label E+C-"] ,presence:true},
  {key:"mention_bbca",label:"Mention Label BBCA",family:"Certification & exigences",type:"text",tags:["Mention Label BBCA", "label BBCA", "BBCA"] ,presence:true},
  {key:"derogation_bbca",label:"Dérogation BBCA",family:"Certification & exigences",type:"text",tags:["Dérogation BBCA", "dérogation label BBCA"] ,presence:true},
  {key:"mention_neutrality_contribution",label:"Mention option Contribution Neutralité",family:"Certification & exigences",type:"text",tags:["Mention option Contribution Neutralité", "Contribution Neutralité", "option neutralité"] ,presence:true},
  {key:"mention_effinergie",label:"Mention Label Effinergie",family:"Certification & exigences",type:"text",tags:["Mention Label Effinergie", "label Effinergie", "Effinergie"] ,presence:true},
  {key:"effinergie_energy_carbon_level",label:"Niveau Énergie Carbone Effinergie 2017",family:"Certification & exigences",type:"text",tags:["Niveau Énergie Carbone Effinergie 2017", "Énergie Carbone Effinergie 2017", "niveau E+C Effinergie 2017"] ,presence:false},
  {key:"mention_biosourced_building",label:"Mention Label Bâtiment Biosourcé",family:"Certification & exigences",type:"text",tags:["Mention Label Bâtiment Biosourcé", "label bâtiment biosourcé", "bâtiment biosourcé"] ,presence:true},
  {key:"derogation_biosourced",label:"Dérogation Biosourcé",family:"Certification & exigences",type:"text",tags:["Dérogation Biosourcé", "dérogation bâtiment biosourcé"] ,presence:true},
  {key:"mention_habitat_quality",label:"Mention Habitat Qualité",family:"Certification & exigences",type:"text",tags:["Mention Habitat Qualité", "Habitat Qualité"] ,presence:true},
  {key:"mention_charge_assessment",label:"Mention Évaluation des charges",family:"Certification & exigences",type:"text",tags:["Mention Évaluation des charges", "Évaluation des charges"] ,presence:true},
  {key:"mention_buildability_bonus",label:"Mention Bonus de constructibilité",family:"Certification & exigences",type:"text",tags:["Mention Bonus de constructibilité", "Bonus de constructibilité"] ,presence:true},
  {key:"mention_air_quality",label:"Mention Qualité de l'air",family:"Certification & exigences",type:"text",tags:["Mention Qualité de l'air", "Qualité de l'air", "QAI"] ,presence:true},
  {key:"mention_acoustic",label:"Mention Acoustique renforcée",family:"Certification & exigences",type:"text",tags:["Mention Acoustique renforcée", "Acoustique renforcée"] ,presence:true},
  {key:"mention_circular_economy",label:"Mention Économie circulaire",family:"Certification & exigences",type:"text",tags:["Mention Économie circulaire", "Économie circulaire", "réemploi"] ,presence:true},
  {key:"mention_eu_taxonomy",label:"Mention Taxinomie européenne",family:"Certification & exigences",type:"text",tags:["Mention Taxinomie européenne", "Taxinomie européenne", "Taxonomie européenne"] ,presence:true},
  {key:"mention_zero_carbon",label:"Mention Horizon Zéro Carbone",family:"Certification & exigences",type:"text",tags:["Mention Horizon Zéro Carbone", "Horizon Zéro Carbone", "HZC"] ,presence:true},
  {key:"mention_biodiversity",label:"Mention Biodiversité",family:"Certification & exigences",type:"text",tags:["Mention Biodiversité", "Biodiversité"] ,presence:true},
  {key:"specific_profile",label:"Profil spécifique",family:"Certification & exigences",type:"text",tags:["Profil spécifique"] ,presence:false},
  {key:"dpe_ges_label",label:"Étiquette DPE & GES",family:"Certification & exigences",type:"text",tags:["Étiquette DPE & GES", "étiquette DPE", "classe DPE et GES", "classe énergie et GES"] ,presence:false},
  {key:"energy_level",label:"Niveau Énergie",family:"Certification & exigences",type:"text",tags:["Niveau Énergie", "niveau énergétique"] ,presence:false},
  {key:"passive_level",label:"Niveau Passif",family:"Certification & exigences",type:"text",tags:["Niveau Passif", "Passivhaus", "bâtiment passif"] ,presence:false},
  {key:"cep_level",label:"Niveau Cep",family:"Certification & exigences",type:"text",tags:["Niveau Cep", "Cep -5%", "Cep -10%", "Cep RE2020"] ,presence:false},
  {key:"cepnr_level",label:"Niveau Cep,nr",family:"Certification & exigences",type:"text",tags:["Niveau Cep,nr", "niveau Cepnr", "niveau Cep,nr", "Cepnr -5%", "Cepnr -10%"] ,presence:false},
  {key:"bbio_level",label:"Niveau Bbio",family:"Certification & exigences",type:"text",tags:["Niveau Bbio", "Bbio -10%", "Bbio -20%", "Bbio RE2020"] ,presence:false},
  {key:"ic_construction_level",label:"Niveau IC Construction",family:"Certification & exigences",type:"text",tags:["Niveau IC Construction", "IC Construction 2025", "IC Construction 2028", "IC Construction 2031"] ,presence:false},
  {key:"ic_energy_level",label:"Niveau IC Énergie",family:"Certification & exigences",type:"text",tags:["Niveau IC Énergie", "IC Énergie 2025", "IC Énergie 2028"] ,presence:false},
  {key:"enhanced_performance",label:"Performance renforcée",family:"Certification & exigences",type:"text",tags:["Performance renforcée"] ,presence:true},
  {key:"biosourced_2013",label:"Biosourcé 2013",family:"Certification & exigences",type:"text",tags:["Biosourcé 2013", "label biosourcé 2013", "niveau biosourcé 2013"] ,presence:true},
  {key:"department",label:"Département",family:"Programme",type:"text",tags:["Département", "dept", "code département", "numéro de département", "département sélectionné"] ,presence:false},
  {key:"progress_status",label:"Avancement",family:"Programme",type:"text",tags:["Avancement", "état d’avancement", "etat d avancement", "phase avancement"] ,presence:false},
  {key:"project",label:"Projet",family:"Programme",type:"text",tags:["Projet", "nom projet"] ,presence:false},
  {key:"operation",label:"Opération",family:"Programme",type:"text",tags:["Opération", "opération projet", "opération technique"] ,presence:false},
  {key:"building",label:"Bâtiment",family:"Programme",type:"text",tags:["Bâtiment", "nom bâtiment", "zone bâtiment"] ,presence:false},
  {key:"housing_count",label:"Nombre de logements",family:"Programme",type:"number",tags:["Nombre de logements", "nb logements", "nb de logements", "logements"] ,presence:false},
  {key:"shab",label:"Surface bâtiment (SHAB / Sref / SU / SURT / SRT)",family:"Programme",type:"number",tags:["Surface bâtiment (SHAB / Sref / SU / SURT / SRT)", "Surface bâtiment", "SHAB", "Sref", "S ref", "surface de référence", "surface habitable", "SU", "SURT", "SRT", "SHONRT"] ,presence:false},
  {key:"housing_typologies",label:"Typologies de logements",family:"Programme",type:"text",tags:["Typologies de logements", "typologie logements", "types de logements", "répartition typologique", "T1 T2 T3"] ,presence:false},
  {key:"construction_year",label:"Année de construction",family:"Programme",type:"number",tags:["Année de construction", "année construction"] ,presence:false},
  {key:"dh",label:"DH",family:"Confort d’été",type:"number",tags:["DH", "degrés-heures", "degrés heures", "DH bâtiment"] ,presence:false},
  {key:"dh_max",label:"DH Max",family:"Confort d’été",type:"number",tags:["DH Max", "DHmax", "seuil DH", "DH réglementaire"] ,presence:false},
  {key:"tic",label:"Tic",family:"Confort d’été",type:"number",tags:["Tic", "température intérieure conventionnelle"] ,presence:false},
  {key:"tic_ref",label:"Tic ref",family:"Confort d’été",type:"number",tags:["Tic ref", "Ticréf", "Tic référence"] ,presence:false},
  {key:"cross_ventilated",label:"Logement traversant",family:"Confort d’été",type:"text",tags:["Logement traversant", "logements traversants", "zone traversante"] ,presence:false},
  {key:"non_cross_ventilated",label:"Logement non traversant",family:"Confort d’été",type:"text",tags:["Logement non traversant", "logements non traversants"] ,presence:false},
  {key:"fan_count",label:"Nombre de brasseurs d’air",family:"Confort d’été",type:"number",tags:["Nombre de brasseurs d’air", "nombre de brasseurs d'air", "nb brasseurs air", "nombre ventilateurs plafond"] ,presence:false},
  {key:"fan_type",label:"Type de brasseurs d’air",family:"Confort d’été",type:"text",tags:["Type de brasseurs d’air", "type de brasseurs d'air", "brasseur air type", "HVLS", "ventilateur plafond"] ,presence:false},
  {key:"structure",label:"Structure",family:"Enveloppe",type:"text",tags:["Structure", "structure principale", "mode constructif", "système constructif"] ,presence:false},
  {key:"roof_structure",label:"Planchers hauts",family:"Enveloppe",type:"text",tags:["Planchers hauts", "plancher haut", "toiture structure", "toiture"] ,presence:false},
  {key:"roof_insulation",label:"Planchers hauts isolant",family:"Enveloppe",type:"text",tags:["Planchers hauts isolant", "isolant plancher haut", "isolation toiture", "isolant toiture"] ,presence:false},
  {key:"roof_insulation_thickness",label:"Planchers hauts épaisseur isolant",family:"Enveloppe",type:"number",tags:["Planchers hauts épaisseur isolant", "épaisseur isolant plancher haut", "épaisseur isolation toiture"] ,presence:false},
  {key:"roof_insulation_r",label:"Planchers hauts R isolant",family:"Enveloppe",type:"number",tags:["Planchers hauts R isolant", "R plancher haut", "résistance thermique toiture", "R toiture"] ,presence:false},
  {key:"wall_structure",label:"Parois verticales structure",family:"Enveloppe",type:"text",tags:["Parois verticales structure", "structure paroi verticale", "structure mur", "mur structure", "façade structure"] ,presence:false},
  {key:"wall_insulation",label:"Parois verticales type d’isolant",family:"Enveloppe",type:"text",tags:["Parois verticales type d’isolant", "isolant paroi verticale", "isolation mur", "isolant mur", "isolation façade"] ,presence:false},
  {key:"wall_insulation_thickness",label:"Parois verticales épaisseur isolant",family:"Enveloppe",type:"number",tags:["Parois verticales épaisseur isolant", "épaisseur isolant paroi verticale", "épaisseur isolation mur"] ,presence:false},
  {key:"wall_insulation_r",label:"Parois verticales R isolant",family:"Enveloppe",type:"number",tags:["Parois verticales R isolant", "R paroi verticale", "R mur", "R façade", "résistance thermique mur"] ,presence:false},
  {key:"floor_structure",label:"Planchers bas structure",family:"Enveloppe",type:"text",tags:["Planchers bas structure", "structure plancher bas", "plancher bas structure"] ,presence:false},
  {key:"floor_insulation",label:"Planchers bas isolant",family:"Enveloppe",type:"text",tags:["Planchers bas isolant", "isolant plancher bas", "isolation plancher bas", "isolant sol"] ,presence:false},
  {key:"floor_insulation_thickness",label:"Planchers bas épaisseur isolant",family:"Enveloppe",type:"number",tags:["Planchers bas épaisseur isolant", "épaisseur isolant plancher bas", "épaisseur isolation sol"] ,presence:false},
  {key:"floor_insulation_r",label:"Planchers bas R isolant",family:"Enveloppe",type:"number",tags:["Planchers bas R isolant", "R plancher bas", "R sol", "résistance thermique plancher bas"] ,presence:false},
  {key:"window_material",label:"Menuiseries matériau",family:"Enveloppe",type:"text",tags:["Menuiseries matériau", "matériau menuiseries", "menuiserie matériau", "châssis"] ,presence:false},
  {key:"window_glazing",label:"Menuiseries vitrage",family:"Enveloppe",type:"text",tags:["Menuiseries vitrage", "vitrage", "type vitrage", "composition vitrage", "composition du vitrage", "double vitrage", "triple vitrage", "4/16/4", "4.16.4", "argon", "lame argon", "Ug"] ,presence:false},
  {key:"window_shading",label:"Menuiseries occultations",family:"Enveloppe",type:"text",tags:["Menuiseries occultations", "occultations", "protections solaires", "volets", "stores", "brise soleil"] ,presence:false},
  {key:"heating_vector_before",label:"Vecteur chauffage avant travaux",family:"Systèmes",type:"text",tags:["Vecteur chauffage avant travaux", "énergie chauffage avant", "vecteur chauffage existant", "chauffage existant énergie"] ,presence:false},
  {key:"heating_vector_after",label:"Vecteur chauffage après travaux",family:"Systèmes",type:"text",tags:["Vecteur chauffage après travaux", "énergie chauffage après", "vecteur chauffage projet", "énergie chauffage projet"] ,presence:false},
  {key:"heating_mode_after",label:"Mode de chauffage après travaux",family:"Systèmes",type:"text",tags:["Mode de chauffage après travaux", "système chauffage après", "générateur chauffage projet", "mode chauffage projet", "type de générateur", "générateur après travaux"] ,presence:false},
  {key:"ecs_vector_before",label:"Vecteur ECS avant travaux",family:"Systèmes",type:"text",tags:["Vecteur ECS avant travaux", "énergie ECS avant", "vecteur ECS existant"] ,presence:false},
  {key:"ecs_vector_after",label:"Vecteur ECS après travaux",family:"Systèmes",type:"text",tags:["Vecteur ECS après travaux", "énergie ECS après", "vecteur ECS projet"] ,presence:false},
  {key:"ecs",label:"ECS",family:"Systèmes",type:"text",tags:["ECS", "eau chaude sanitaire", "production ECS", "système ECS", "type de stockage", "type d ECS"] ,presence:false},
  {key:"cooling",label:"Refroidissement",family:"Systèmes",type:"text",tags:["Refroidissement", "climatisation", "système de refroidissement"] ,presence:false},
  {key:"ventilation",label:"Ventilation",family:"Systèmes",type:"text",tags:["Ventilation", "VMC", "système ventilation", "système de ventilation", "etat de la ventilation"] ,presence:false},
  {key:"bbio",label:"Bbio",family:"Performance énergétique",type:"number",tags:["Bbio", "coefficient Bbio", "Bbio projet"] ,presence:false},
  {key:"bbio_max",label:"Bbio Max",family:"Performance énergétique",type:"number",tags:["Bbio Max", "Bbiomax", "Bbio maximal"] ,presence:false},
  {key:"bbio_gain",label:"Gain Bbio",family:"Performance énergétique",type:"number",tags:["Gain Bbio", "gain de Bbio", "réduction Bbio"] ,presence:false},
  {key:"cep",label:"Cep",family:"Performance énergétique",type:"number",tags:["Cep", "coefficient Cep", "Cep projet"] ,presence:false},
  {key:"cep_max",label:"Cep Max",family:"Performance énergétique",type:"number",tags:["Cep Max", "Cepmax", "Cep maximal", "Cep référence"] ,presence:false},
  {key:"cep_gain",label:"Gain Cep",family:"Performance énergétique",type:"number",tags:["Gain Cep", "gain de Cep", "réduction Cep"] ,presence:false},
  {key:"cepnr",label:"Cepnr",family:"Performance énergétique",type:"number",tags:["Cepnr", "Cep,nr", "Cep nr", "coefficient Cepnr"] ,presence:false},
  {key:"cepnr_max",label:"Cepnr Max",family:"Performance énergétique",type:"number",tags:["Cepnr Max", "Cep,nr max", "Cep nr max", "Cepnr maximal"] ,presence:false},
  {key:"cepnr_gain",label:"Gain Cepnr",family:"Performance énergétique",type:"number",tags:["Gain Cepnr", "gain Cep,nr", "réduction Cepnr"] ,presence:false},
  {key:"cep_cooling",label:"Cep refroidissement",family:"Performance énergétique",type:"number",tags:["Cep refroidissement", "Cep froid", "consommation refroidissement", "refroidissement énergie primaire", "refroidissement kWhEP/m²"] ,presence:false},
  {key:"cep_lighting",label:"Cep éclairage",family:"Performance énergétique",type:"number",tags:["Cep éclairage", "consommation éclairage", "éclairage énergie primaire", "eclairage kWhEP/m²"] ,presence:false},
  {key:"cep_aux_vent",label:"Cep auxiliaires ventilation",family:"Performance énergétique",type:"number",tags:["Cep auxiliaires ventilation", "Cep ventilateurs", "auxiliaires ventilation", "ventilateurs énergie primaire", "ventilateurs kWhEP/m²"] ,presence:false},
  {key:"cep_aux_dist",label:"Cep auxiliaires distribution",family:"Performance énergétique",type:"number",tags:["Cep auxiliaires distribution", "Cep pompes", "auxiliaires distribution", "auxiliaires énergie primaire", "auxiliaires kWhEP/m²"] ,presence:false},
  {key:"cep_mobility",label:"Cep déplacement occupants",family:"Performance énergétique",type:"number",tags:["Cep déplacement occupants", "Cep mobilité", "ascenseurs"] ,presence:false},
  {key:"cep_electricity",label:"Cep électricité",family:"Performance énergétique",type:"number",tags:["Cep électricité", "Cep électrique", "consommations par énergie électricité", "répartition des conso par énergie"] ,presence:false},
  {key:"cep_gas",label:"Cep gaz",family:"Performance énergétique",type:"number",tags:["Cep gaz", "consommation gaz Cep"] ,presence:false},
  {key:"cep_district",label:"Cep réseau de chaleur",family:"Performance énergétique",type:"number",tags:["Cep réseau de chaleur", "Cep RCU"] ,presence:false},
  {key:"cep_biomass",label:"Cep bois / biomasse",family:"Performance énergétique",type:"number",tags:["Cep bois / biomasse", "Cep bois", "Cep biomasse", "Cep bois biomasse"] ,presence:false},
  {key:"ubat_before",label:"Ubat avant travaux",family:"Performance énergétique",type:"number",tags:["Ubat avant travaux", "Ubat avant", "Ubat initial", "Ubat existant", "état initial calcul du coefficient Ubat", "coefficient Ubat état initial"] ,presence:false},
  {key:"ubat_after",label:"Ubat après travaux",family:"Performance énergétique",type:"number",tags:["Ubat après travaux", "Ubat après", "Ubat projet", "modification calcul du coefficient Ubat", "coefficient Ubat état après travaux"] ,presence:false},
  {key:"cep_before",label:"Cep avant travaux",family:"Performance énergétique",type:"number",tags:["Cep avant travaux", "Cep avant", "Cep initial", "Cep existant", "total kWhEP/m² état initial", "total EP état initial", "bilan énergétique état initial"] ,presence:false},
  {key:"cep_after_final",label:"Cep après travaux final",family:"Performance énergétique",type:"number",tags:["Cep après travaux final", "Cep après", "Cep final", "Cep projet final", "total kWhEP/m² état après travaux", "total EP état après travaux", "bilan énergétique après travaux"] ,presence:false},
  {key:"ic_components",label:"IC composants bâtiment",family:"Carbone",type:"number",tags:["IC composants bâtiment", "IC composants", "Iccomposant", "IC construction composants"] ,presence:false},
  {key:"ic_site",label:"IC chantier",family:"Carbone",type:"number",tags:["IC chantier"] ,presence:false},
  {key:"stock_c_per_m2",label:"Stock C/m²",family:"Carbone",type:"number",tags:["Stock C/m²", "Stockage carbone Stock,C (par m²)", "Stock,C (par m²)", "stockage carbone par m²", "stock carbone par m²"] ,presence:false},
  {key:"ic_lot_1",label:"IC composants lot 1",family:"Carbone",type:"number",tags:["IC composants lot 1", "IC lot 1", "lot 1 IC composants"] ,presence:false},
  {key:"ic_lot_2",label:"IC composants lot 2",family:"Carbone",type:"number",tags:["IC composants lot 2", "IC lot 2", "lot 2 IC composants"] ,presence:false},
  {key:"ic_lot_3",label:"IC composants lot 3",family:"Carbone",type:"number",tags:["IC composants lot 3", "IC lot 3", "lot 3 IC composants"] ,presence:false},
  {key:"ic_lot_4",label:"IC composants lot 4",family:"Carbone",type:"number",tags:["IC composants lot 4", "IC lot 4", "lot 4 IC composants"] ,presence:false},
  {key:"ic_lot_5",label:"IC composants lot 5",family:"Carbone",type:"number",tags:["IC composants lot 5", "IC lot 5", "lot 5 IC composants"] ,presence:false},
  {key:"ic_lot_6",label:"IC composants lot 6",family:"Carbone",type:"number",tags:["IC composants lot 6", "IC lot 6", "lot 6 IC composants"] ,presence:false},
  {key:"ic_lot_7",label:"IC composants lot 7",family:"Carbone",type:"number",tags:["IC composants lot 7", "IC lot 7", "lot 7 IC composants"] ,presence:false},
  {key:"ic_lot_8",label:"IC composants lot 8",family:"Carbone",type:"number",tags:["IC composants lot 8", "IC lot 8", "lot 8 IC composants"] ,presence:false},
  {key:"ic_lot_9",label:"IC composants lot 9",family:"Carbone",type:"number",tags:["IC composants lot 9", "IC lot 9", "lot 9 IC composants"] ,presence:false},
  {key:"ic_lot_10",label:"IC composants lot 10",family:"Carbone",type:"number",tags:["IC composants lot 10", "IC lot 10", "lot 10 IC composants"] ,presence:false},
  {key:"ic_lot_11",label:"IC composants lot 11",family:"Carbone",type:"number",tags:["IC composants lot 11", "IC lot 11", "lot 11 IC composants"] ,presence:false},
  {key:"ic_lot_12",label:"IC composants lot 12",family:"Carbone",type:"number",tags:["IC composants lot 12", "IC lot 12", "lot 12 IC composants"] ,presence:false},
  {key:"ic_lot_13",label:"IC composants lot 13",family:"Carbone",type:"number",tags:["IC composants lot 13", "IC lot 13", "lot 13 IC composants"] ,presence:false},
  {key:"ic_energy",label:"IC énergie bâtiment",family:"Carbone",type:"number",tags:["IC énergie bâtiment", "IC énergie", "Icenergie", "énergie CE"] ,presence:false},
  {key:"ic_energy_heating",label:"IC énergie chauffage",family:"Carbone",type:"number",tags:["IC énergie chauffage", "IC chauffage"] ,presence:false},
  {key:"ic_energy_cooling",label:"IC énergie refroidissement",family:"Carbone",type:"number",tags:["IC énergie refroidissement", "IC refroidissement"] ,presence:false},
  {key:"ic_energy_ecs",label:"IC énergie ECS",family:"Carbone",type:"number",tags:["IC énergie ECS", "IC ECS"] ,presence:false},
  {key:"ic_energy_aux_vent",label:"IC énergie auxiliaires ventilation",family:"Carbone",type:"number",tags:["IC énergie auxiliaires ventilation", "IC auxiliaires ventilation"] ,presence:false},
  {key:"ic_energy_aux_dist",label:"IC énergie auxiliaires distribution",family:"Carbone",type:"number",tags:["IC énergie auxiliaires distribution", "IC auxiliaires distribution"] ,presence:false},
  {key:"ic_energy_mobility",label:"IC énergie déplacements",family:"Carbone",type:"number",tags:["IC énergie déplacements", "IC déplacements"] ,presence:false},
  {key:"dpe_energy_before",label:"DPE Énergie avant travaux",family:"DPE",type:"text",tags:["DPE Énergie avant travaux", "DPE énergie avant", "classe énergie avant"] ,presence:false},
  {key:"dpe_ges_before",label:"DPE GES avant travaux",family:"DPE",type:"text",tags:["DPE GES avant travaux", "DPE GES avant", "classe GES avant", "GES avant travaux"] ,presence:false},
  {key:"dpe_energy_after",label:"DPE Énergie après travaux final",family:"DPE",type:"text",tags:["DPE Énergie après travaux final", "DPE énergie après", "classe énergie après"] ,presence:false},
  {key:"dpe_ges_after",label:"DPE GES après travaux final",family:"DPE",type:"text",tags:["DPE GES après travaux final", "DPE GES après", "classe GES après"] ,presence:false},
  {key:"enr",label:"ENR oui/non",family:"ENR",type:"text",tags:["ENR oui/non", "ENR", "énergie renouvelable", "présence ENR"] ,presence:true},
  {key:"enr_type",label:"ENR type",family:"ENR",type:"text",tags:["ENR type", "type ENR", "type d’énergie renouvelable", "type énergie renouvelable"] ,presence:false},
  {key:"ic_construction",label:"IC construction",family:"Carbone",type:"number",tags:["IC construction", "Ic construction", "Icconstruction", "Ic_construction", "contribution construction"] ,presence:false},
  {key:"ic_construction_max",label:"IC construction Max",family:"Carbone",type:"number",tags:["IC construction Max", "Ic construction max", "Icconstruction_max", "Ic_construction_max"] ,presence:false},
  {key:"ic_construction_max_2028",label:"IC construction Max 2028",family:"Carbone",type:"number",tags:["IC construction Max 2028", "Ic construction max 2028", "Icconstruction_max 2028", "seuil 2028 Ic construction"] ,presence:false},
  {key:"ic_energy_max",label:"IC énergie Max",family:"Carbone",type:"number",tags:["IC énergie Max", "Ic énergie max", "Icenergie_max", "Ic_energie_max"] ,presence:false},
  {key:"ic_energy_max_2028",label:"IC énergie Max 2028",family:"Carbone",type:"number",tags:["IC énergie Max 2028", "Ic énergie max 2028", "Icenergie_max 2028", "seuil 2028 Ic énergie"] ,presence:false}
];
const FIELD_MAP = Object.fromEntries(FIELD_DEFS.map(f=>[f.key,f]));
const FIELD_TAGS = Object.fromEntries(FIELD_DEFS.map(f=>[f.key,[...f.tags]]));
const FAMILIES = [...new Set(FIELD_DEFS.map(f=>f.family))];

function normalizeFieldHeader(value=''){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/[^a-zA-Z0-9+&/,.-]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
}
const HEADER_LOOKUP=new Map();
for(const f of FIELD_DEFS) for(const tag of f.tags){ const n=normalizeFieldHeader(tag); if(n&&!HEADER_LOOKUP.has(n)) HEADER_LOOKUP.set(n,f.key); }

// V2.2.9 — compatibilité souple des exports Excel successifs.
// On conserve les intitulés historiques mais on accepte aussi les nouveaux noms
// de colonnes CRM / OPERATIONS sans créer de nouveaux champs ExtracTerre.
const HEADER_ALIASES={
  'numero du contrat':'contract_number',
  'operation code interne':'internal_code',
  'statut':'contract_status',
  'operation etape':'stage',
  'opportunite accepte le':'case_accepted_date',
  'date de creation de l affaire':'case_creation_date',
  'date d activation':'contract_activation_date',
  'nom de la societe societe principale nom de la societe':'owner_main_company',
  'nom de la societe nom de la societe':'owner_company',
  'nom de la societe hierarchie':'owner_hierarchy',
  'opportunite nom de l affaire':'case_name',
  'nom de l operation':'operation_name',
  'departement de l operation':'department',
  'referentiel':'reference_name',
  'version':'reference_version',
  'opportunite montant ht':'case_amount_ht',
  'operation mentions':'mentions',
  'operation performance':'performance',
  'operation profil choisi':'selected_profile',
  'date de decision ap':'certification_ap_date',
  'date de decision de certification':'certification_cd_date',
  'operation evaluation code interne':'evaluation_internal_code',
  'operation evaluation statut':'evaluation_status',
  'operation avancement de l operation':'progress_status',
  'operation evaluation date de premiere reception du dossier':'evaluation_creation_date',
  'annee':'construction_year',
  'ecs apres travaux':'ecs',
  'refroidissement apres travaux':'cooling',
  'ventilation apres travaux':'ventilation',
  'mode constructif':'structure',
  'planchers hauts structure':'roof_structure',
  'planchers hauts type isolant':'roof_insulation',
  'parois verticales type d isolant':'wall_insulation',
  'planchers bas type isolant':'floor_insulation',
  'menuiseries exterieures materiau':'window_material',
  'menuiseries exterieures vitrage':'window_glazing',
  'menuiseries exterieures occultations':'window_shading',
  'dh projet':'dh',
  'tic projet':'tic',
  'bbio projet':'bbio',
  'cep projet':'cep',
  'cep nr projet':'cepnr',
  'cep,nr projet':'cepnr',
  'cep nr max':'cepnr_max',
  'cep,nr max':'cepnr_max',
  'ubat initial':'ubat_before',
  'ubat projet':'ubat_after',
  'cep initial':'cep_before',
  'ic composants batiment':'ic_components',
  'dpe energie avant travaux':'dpe_energy_before',
  'dpe energie apres travaux final':'dpe_energy_after',
  'dpe ges avant travaux':'dpe_ges_before',
  'dpe ges apres travaux final':'dpe_ges_after'
};
const NORMALIZED_HEADER_ALIASES=new Map(Object.entries(HEADER_ALIASES).map(([k,v])=>[normalizeFieldHeader(k),v]));

const HEADER_STOPWORDS=new Set(['de','du','des','la','le','les','l','d','un','une','pour','operation','opportunite','certification','evaluation','societe','nom']);
function headerTokens(value=''){
  return normalizeFieldHeader(value).replace(/[,:/.-]+/g,' ').split(/\s+/).filter(t=>t&&t.length>1&&!HEADER_STOPWORDS.has(t));
}
function headerVariants(value=''){
  const n=normalizeFieldHeader(value),out=new Set([n]);
  const prefixes=['operation ','opportunite ','certification ','evaluation ','operation evaluation ','nom de la societe ','maitre d ouvrage ','affaire ','contrat '];
  for(const p of prefixes) if(n.startsWith(p)) out.add(n.slice(p.length).trim());
  out.add(n.replace(/\bde l operation\b/g,'').replace(/\bde la societe\b/g,'').replace(/\s+/g,' ').trim());
  return [...out].filter(Boolean);
}
const HEADER_CANDIDATES=[];
for(const f of FIELD_DEFS){
  const seen=new Set();
  for(const label of [f.label,...f.tags]) for(const variant of headerVariants(label)) if(variant&&!seen.has(variant)){seen.add(variant);HEADER_CANDIDATES.push({key:f.key,text:variant,tokens:headerTokens(variant)});}
}
function fuzzyHeaderMatch(header=''){
  const src=headerTokens(header); if(src.length<2)return null;
  const srcSet=new Set(src); let best=null,second=0;
  // Ces qualificatifs changent le sens métier. Un en-tête « max », « seuil 2028 »,
  // « avant », etc. ne doit jamais être rapproché d'un champ qui ne porte pas
  // le même qualificatif uniquement parce que le reste du libellé se ressemble.
  const semanticQualifiers=new Set(['max','maximum','min','minimum','seuil','initial','avant','apres','final','projet','ref','reference','2025','2028','2031']);
  const srcQual=[...srcSet].filter(t=>semanticQualifiers.has(t));
  for(const c of HEADER_CANDIDATES){
    if(!c.tokens.length)continue; const cand=new Set(c.tokens);
    if(srcQual.some(q=>!cand.has(q)))continue;
    const inter=[...srcSet].filter(t=>cand.has(t)).length;
    if(!inter)continue;
    const union=new Set([...srcSet,...cand]).size;
    const jacc=inter/Math.max(1,union),coverage=inter/Math.max(1,Math.min(srcSet.size,cand.size));
    const score=.58*coverage+.42*jacc;
    if(!best||score>best.score){second=best?.score||0;best={key:c.key,score};} else if(score>second)second=score;
  }
  if(!best||best.score<.84||(best.score-second)<.08)return null;
  return best;
}
function matchFieldByHeaderDetailed(header=''){
  const normalized=normalizeFieldHeader(header);
  let key=HEADER_LOOKUP.get(normalized); if(key)return {def:FIELD_MAP[key],mode:'exact',score:1};
  key=NORMALIZED_HEADER_ALIASES.get(normalized); if(key)return {def:FIELD_MAP[key],mode:'alias',score:.99};
  for(const variant of headerVariants(header)){
    key=HEADER_LOOKUP.get(variant); if(key)return {def:FIELD_MAP[key],mode:'normalized',score:.97};
    key=NORMALIZED_HEADER_ALIASES.get(variant); if(key)return {def:FIELD_MAP[key],mode:'alias',score:.96};
  }
  const fuzzy=fuzzyHeaderMatch(header); return fuzzy?{def:FIELD_MAP[fuzzy.key],mode:'fuzzy',score:fuzzy.score}:null;
}
function matchFieldByHeader(header=''){ return matchFieldByHeaderDetailed(header)?.def||null; }

const SOURCE_ADMIN=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.DESIGN_REPORT,DOC_TYPES.MANUAL];
const SOURCE_CERT=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.REQUIREMENTS,DOC_TYPES.ENV_REPORT,DOC_TYPES.MANUAL];
const SOURCE_LEVELS=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.ENV_REPORT,DOC_TYPES.REQUIREMENTS,DOC_TYPES.MANUAL];
const SOURCE_PROGRAM=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.PROJECT_DESCRIPTION,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL];
const SOURCE_PROJECT_META=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.PLAN,DOC_TYPES.NOTICE,DOC_TYPES.MANUAL];
const SOURCE_ENVELOPE=[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.THERMAL,DOC_TYPES.CCTP,DOC_TYPES.DPGF,DOC_TYPES.MANUAL];
const SOURCE_SYSTEMS=[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.CCTP,DOC_TYPES.DPGF,DOC_TYPES.DIAGNOSTIC,DOC_TYPES.MANUAL];
const SOURCE_UBAT_CEP=[DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.MANUAL];
const SOURCE_ENR=[DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.MANUAL];
const ordered=(types,secondary=[])=>({main:[...types],secondary:[...secondary],forbidden:[]});
const DEFAULT_SOURCE_RULES={};
for(const key of ["internal_code", "operation_name", "contract_status", "evaluation_status", "case_stage", "client_program_name", "owner_company", "owner_main_company", "owner_hierarchy", "stage", "creation_date", "case_name", "case_creation_date", "case_accepted_date", "case_amount_ht", "contract_number", "contract_creation_date", "contract_activation_date", "order_amount_ht", "evaluation_internal_code", "evaluation_creation_date", "certification_ap_date", "certification_cd_date"]) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_ADMIN);
for(const key of ["work_type", "housing_individual_scattered", "housing_grouped_units", "housing_grouped_buildings", "housing_collective_units", "housing_collective_buildings", "housing_community_units", "housing_uncertified", "housing_total", "building_total"]) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_PROGRAM);
for(const key of ["reference_name", "reference_version", "mentions", "performance", "selected_profile", "built_before_1948", "built_after_1948", "renovation", "anru_zone", "no_mention", "environmental_performance", "mention_building_performance", "mention_bee_plus", "mention_tfpb", "mention_ec", "derogation_ec", "mention_bbca", "derogation_bbca", "mention_neutrality_contribution", "mention_effinergie", "effinergie_energy_carbon_level", "mention_biosourced_building", "derogation_biosourced", "mention_habitat_quality", "mention_charge_assessment", "mention_buildability_bonus", "mention_air_quality", "mention_acoustic", "mention_circular_economy", "mention_eu_taxonomy", "mention_zero_carbon", "mention_biodiversity", "specific_profile"]) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_CERT);
for(const key of ["dpe_ges_label", "energy_level", "passive_level", "cep_level", "cepnr_level", "bbio_level", "ic_construction_level", "ic_energy_level", "enhanced_performance", "biosourced_2013"]) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_LEVELS);
for(const key of ["department", "progress_status", "project", "operation", "building"]) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_PROJECT_META);
// Une étude thermique/Bao peut porter un département explicite fiable ; elle reste en secours derrière les sources projet validées.
DEFAULT_SOURCE_RULES.department=ordered(SOURCE_PROJECT_META,[DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.DIAGNOSTIC]);
for(const key of ["structure", "roof_structure", "roof_insulation", "roof_insulation_thickness", "roof_insulation_r", "wall_structure", "wall_insulation", "wall_insulation_thickness", "wall_insulation_r", "floor_structure", "floor_insulation", "floor_insulation_thickness", "floor_insulation_r", "window_material", "window_glazing", "window_shading"]) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_ENVELOPE);
for(const key of ["heating_vector_before", "heating_vector_after", "heating_mode_after", "ecs_vector_before", "ecs_vector_after", "ecs", "cooling", "ventilation"]) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_SYSTEMS);
for(const key of ["ubat_before", "ubat_after", "cep_before", "cep_after_final"]) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_UBAT_CEP);
for(const key of ["enr", "enr_type"]) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_ENR);
for(const key of ['housing_count']) DEFAULT_SOURCE_RULES[key]=ordered(SOURCE_PROGRAM);
DEFAULT_SOURCE_RULES.shab=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.SURFACE,DOC_TYPES.PLAN,DOC_TYPES.RSENV,DOC_TYPES.MANUAL],[DOC_TYPES.RT_EXISTING,DOC_TYPES.NOTICE,DOC_TYPES.PERMIT]);
DEFAULT_SOURCE_RULES.housing_typologies=ordered([DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.PROJECT_DESCRIPTION,DOC_TYPES.SURFACE,DOC_TYPES.PLAN,DOC_TYPES.NOTICE,DOC_TYPES.MANUAL]);
DEFAULT_SOURCE_RULES.construction_year=ordered([DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.PLAN,DOC_TYPES.NOTICE,DOC_TYPES.RT_EXISTING,DOC_TYPES.DIAGNOSTIC,DOC_TYPES.MANUAL]);
for(const key of ['dh','dh_max']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL],[DOC_TYPES.RSENV,DOC_TYPES.CARBON]);
for(const key of ['tic','tic_ref']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RT2012,DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL]);
for(const key of ['cross_ventilated','non_cross_ventilated','fan_count','fan_type']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.PLAN,DOC_TYPES.CCTP,DOC_TYPES.MANUAL],[DOC_TYPES.NOTICE]);
for(const key of ['bbio','bbio_max','bbio_gain','cep','cep_max','cep_gain','cepnr','cepnr_max','cepnr_gain']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL],[DOC_TYPES.RSENV,DOC_TYPES.RT_EXISTING,DOC_TYPES.CARBON,DOC_TYPES.DIAGNOSTIC]);
for(const key of ['cep_cooling','cep_lighting','cep_aux_vent','cep_aux_dist','cep_mobility','cep_electricity','cep_gas','cep_district','cep_biomass']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.MANUAL],[DOC_TYPES.DIAGNOSTIC]);
for(const key of ['ic_components','ic_site','ic_lot_1','ic_lot_2','ic_lot_3','ic_lot_4','ic_lot_5','ic_lot_6','ic_lot_7','ic_lot_8','ic_lot_9','ic_lot_10','ic_lot_11','ic_lot_12','ic_lot_13','ic_energy','ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.CARBON,DOC_TYPES.RSET_RE2020,DOC_TYPES.MANUAL],[DOC_TYPES.THERMAL]);
for(const key of ['ic_construction','ic_construction_max','ic_construction_max_2028']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.CARBON,DOC_TYPES.MANUAL]);
// Ic énergie max : également publié par les sorties thermiques RE2020 (RSET, synthèses logiciel).
for(const key of ['ic_energy_max','ic_energy_max_2028']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.CARBON,DOC_TYPES.RSET_RE2020,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL]);
DEFAULT_SOURCE_RULES.stock_c_per_m2=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.CARBON,DOC_TYPES.MANUAL]);
for(const key of ['dpe_energy_before','dpe_ges_before','dpe_energy_after','dpe_ges_after']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.DPE,DOC_TYPES.DIAGNOSTIC,DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL]);
const ALL=Object.values(DOC_TYPES).filter(x=>x!==DOC_TYPES.UNKNOWN);
for(const f of FIELD_DEFS) if(!DEFAULT_SOURCE_RULES[f.key]) DEFAULT_SOURCE_RULES[f.key]=ordered([...ALL.filter(x=>x!==DOC_TYPES.MANUAL),DOC_TYPES.MANUAL]);

const REQUIRED_RE2020_RSET_FIELDS = ['housing_count','shab','bbio','bbio_max','cep','cep_max','cepnr','cepnr_max','dh'];
const REQUIRED_RT2012_RSET_FIELDS = ['housing_count','shab','bbio','bbio_max','cep','cep_max','tic','tic_ref'];
const REQUIRED_RSET_FIELDS = REQUIRED_RE2020_RSET_FIELDS;

function normAlias(s){ return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function rxEscape(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'); }
function aliasRegex(aliases){ return new RegExp(`\\b(?:${aliases.map(a=>rxEscape(normAlias(a))).join('|')})\\b`,'i'); }
const pair=(canon,aliases)=>[canon,aliasRegex(aliases)];

const MATERIALS = [
  pair('PSE graphité',['pse graphité','pse graphite','polystyrène expansé graphité','polystyrene expanse graphite','neopor','gris graphite']),
  pair('Laine de roche',['laine de roche','ldr','rockwool','rockfacade','rockmur','rockplus','rocksol','rockfeu','alpharock','mb rock','redair','jetrock','rockair','ecorock']),
  pair('Laine de verre',['laine de verre','ldv','lv','l.v.','glass wool','gr 32','gr32','isoconfort','isomob','ibr','ursa glasswool','ki fit','ki-fit']),
  pair('Laine minérale',['laine minérale','laine minerale','mineral wool','laine minerale semi rigide','fibrexpan']),
  pair('PSE',['pse','polystyrène expansé','polystyrene expanse','eps','knauf therm','therm th','therm itex','webertherm pse','unicell','cellomur']),
  pair('XPS',['xps','polystyrène extrudé','polystyrene extrude','styrodur','jackodur','ursa xps','soprema xps']),
  pair('PIR',['pir','polyisocyanurate','eurothane','powerwall','powerdeck','eurosol','fitforall','efisol','kingspan kooltherm']),
  pair('PUR',['pur','polyuréthane','polyurethane','mousse polyurethane','mousse pu','projection polyurethane','tms','tms mf si','tms gf si','unilin utherm','utherm','efigreen','efigreen duo','efigreen duo +']),
  pair('Mousse phénolique',['mousse phénolique','mousse phenolique','phenolic foam','kooltherm']),
  pair('Mousse résolique',['mousse résolique','mousse resolique','résol','resol']),
  pair('Fibre de bois',['fibre de bois','laine de bois','wood fibre','steico','pavatex','isonat','flex 55','steicoflex','steico protect','steico therm','pavaflex']),
  pair('Ouate de cellulose',['ouate de cellulose','cellulose','isocell','igloo cellulose','ouate insufflée','ouate insufflee','ouate soufflée','ouate soufflee']),
  pair('Liège',['liège expansé','liege expanse','liège','liege','cork','amorim cork','icb']),
  pair('Chanvre',['chanvre','laine de chanvre','biofib chanvre','biofib trio','hemp']),
  pair('Lin',['laine de lin','fibre de lin','lin isolant']),
  pair('Coton recyclé',['coton recyclé','coton recycle','métisse','metisse','textile recyclé','textile recycle']),
  pair('Laine de mouton',['laine de mouton','wool insulation']),
  pair('Paille',['paille','bottes de paille','straw bale']),
  pair('Béton de chanvre',['béton de chanvre','beton de chanvre','hempcrete']),
  pair('Verre cellulaire',['verre cellulaire','foamglas','cellular glass']),
  pair('Perlite',['perlite','perlite expansée','perlite expansee']),
  pair('Vermiculite',['vermiculite','vermiculite expansée','vermiculite expansee']),
  pair('Aérogel',['aérogel','aerogel','spaceloft']),
  pair('Isolant sous vide',['panneau sous vide','isolant sous vide','vip','vacuum insulation','deck-vq'])
];

const STRUCTURES = [
  pair('Béton banché',['béton banché','beton banche','voile banché','voile banche','mur banché','mur banche']),
  pair('Béton armé',['béton armé','beton arme','voile béton','voile beton','mur béton','mur beton','dalle béton armé','dalle beton arme']),
  pair('Bloc béton / parpaing',['bloc béton','bloc beton','parpaing','agglo','aggloméré de béton','agglomere de beton','bloc creux béton','bloc creux beton','easytherm','easy therm','air bloc','air’bloc',"air'bloc",'technibloc']),
  pair('Brique terre cuite',['brique terre cuite','brique creuse','brique alvéolaire','brique alveolaire','porotherm','bio bric','monomur']),
  pair('Brique',['brique pleine','maçonnerie brique','maconnerie brique']),
  pair('Béton cellulaire',['béton cellulaire','beton cellulaire','siporex','ytong']),
  pair('Pierre de taille',['pierre de taille']),
  pair('Meulière',['meulière','meuliere']),
  pair('Pierre',['pierre dure','moellon','moellons','maçonnerie pierre','maconnerie pierre']),
  pair('Pans de bois',['pan de bois','pans de bois','colombage','torchis']),
  pair('Ossature bois',['ossature bois','mur ossature bois','mob','montants bois','structure bois']),
  pair('CLT',['clt','bois lamellé croisé','bois lamelle croise','cross laminated timber','panneau bois massif']),
  pair('Structure métallique',['ossature métallique','ossature metallique','structure métallique','structure metallique','structure acier','montants acier','profil acier']),
  pair('Façade légère',['façade légère','facade legere','mur rideau','façade rideau','facade rideau','curtain wall']),
  pair('Prédalle',['prédalle','predalle','prédalles','predalles']),
  pair('Poutrelles-hourdis',['poutrelles hourdis','poutrelle hourdis','hourdis','entrevous béton','entrevous beton','entrevous polystyrène','entrevous polystyrene']),
  pair('Plancher bois',['plancher bois','solivage bois','solives bois','dalle bois']),
  pair('Bac acier collaborant',['bac acier collaborant','plancher collaborant','bac collaborant']),
  pair('Éléments préfabriqués',['éléments préfabriqués','elements prefabriques','préfabrication béton','prefabrication beton'])
];

const HVAC = {
  vectors:[
    pair('Réseau de chaleur urbain',['rcu','réseau de chaleur','reseau de chaleur','chauffage urbain','sous-station','sous station']),
    pair('Bois / biomasse',['bois énergie','bois energie','biomasse','granulés','granules','pellets','plaquettes bois']),
    pair('Géothermie',['géothermie','geothermie','géothermique','geothermique']),
    pair('Fioul',['fioul','fuel domestique','mazout']),
    pair('Gaz',['gaz naturel','gaz de ville','gaz propane','propane','gaz']),
    pair('Électricité',['électricité','electricite','électrique','electrique','effet joule']),
    pair('Solaire',['solaire thermique','solaire']),
    pair('Hybride',['hybride','bi-énergie','bi energie','bivalent'])
  ],
  heating:[
    pair('PAC air/eau',['pac air/eau','pompe à chaleur air/eau','pompe a chaleur air/eau','pac aérothermique air eau','pac aerothermique air eau']),
    pair('PAC air/air',['pac air/air','pompe à chaleur air/air','pompe a chaleur air/air','split','multi-split','multisplit']),
    pair('PAC eau/eau',['pac eau/eau','pompe à chaleur eau/eau','pompe a chaleur eau/eau']),
    pair('PAC géothermique',['pac géothermique','pac geothermique','pompe à chaleur géothermique','pompe a chaleur geothermique','sondes géothermiques','sondes geothermiques']),
    pair('Chaudière condensation',['chaudière gaz condensation','chaudiere gaz condensation','chaudière gaz à condensation','chaudiere gaz a condensation','gaz condensation','chaudière à condensation','chaudiere a condensation','chaudière condensation','chaudiere condensation']),
    pair('Chaudière gaz',['chaudière gaz','chaudiere gaz','générateur gaz','generateur gaz']),
    pair('Chaudière biomasse',['chaudière biomasse','chaudiere biomasse','chaudière bois','chaudiere bois','chaudière granulés','chaudiere granules']),
    pair('Poêle',['poêle à bois','poele a bois','poêle à granulés','poele a granules','poêle','poele']),
    pair('Chauffage électrique direct',['convecteur électrique','convecteur electrique','radiateur électrique','radiateur electrique','panneau rayonnant','effet joule','plinthe électrique','plinthe electrique']),
    pair('Réseau de chaleur',['réseau de chaleur','reseau de chaleur','rcu','chauffage urbain','sous-station','sous station']),
    pair('DRV/VRV',['drv','vrv','débit de réfrigérant variable','debit de refrigerant variable']),
    pair('Plancher chauffant',['plancher chauffant','plancher basse température','plancher basse temperature']),
    pair('Radiateurs eau chaude',['radiateurs eau chaude','radiateur eau chaude','émetteurs eau chaude','emetteurs eau chaude']),
    pair('Ventilo-convecteurs',['ventilo-convecteur','ventilo convecteur','fan coil','fancoil'])
  ],
  ecs:[
    pair('Chauffe-eau thermodynamique',['cet','chauffe-eau thermodynamique','chauffe eau thermodynamique','ballon thermodynamique','chauffe-eau thermodynamique individuel']),
    pair('Ballon électrique',['ballon électrique','ballon electrique','chauffe-eau électrique','chauffe eau electrique','chauffe eau élec','chauffe-eau élec','chauffe eau elec','chauffe-eau elec','cumulus','préparateur électrique','preparateur electrique']),
    pair('Solaire thermique',['solaire thermique','ecs solaire','chauffe-eau solaire','chauffe eau solaire','cesi']),
    pair('Réseau de chaleur',['réseau de chaleur','reseau de chaleur','rcu','sous-station','sous station']),
    pair('Chaudière',['chaudière','chaudiere','préparateur gaz','preparateur gaz']),
    pair('PAC',['pac','pompe à chaleur','pompe a chaleur']),
    pair('ECS collective',['ecs collective','production collective ecs','eau chaude collective']),
    pair('ECS individuelle',['ecs individuelle','production individuelle ecs','eau chaude individuelle'])
  ],
  ventilation:[
    pair('VMC Hygro-Gaz',['hygro-gaz','hygro gaz','atlantic hygro-gaz','atlantic hygro gaz']),
    pair('VMC Hygro B',['vmc hygro b','hygro b','simple flux hygro b','hygroreglable type b','hygroréglable type b','hygroreglable b']),
    pair('VMC Hygro A',['vmc hygro a','hygro a','simple flux hygro a','hygroreglable type a','hygroréglable type a']),
    pair('VMC double flux',['vmc double flux','double flux','ventilation double flux','df haut rendement','double flux haut rendement']),
    pair('VMC simple flux autoréglable',['vmc simple flux autoréglable','vmc simple flux autoreglable','vmc sf auto','simple flux autoréglable','simple flux autoreglable','autoréglable','autoreglable']),
    pair('CTA',['cta double flux','cta simple flux','centrale de traitement d air','centrale de traitement air','cta']),
    pair('VMR',['vmr','ventilation mécanique répartie','ventilation mecanique repartie']),
    pair('VMI',['vmi','ventilation mécanique par insufflation','ventilation mecanique par insufflation']),
    pair('Ventilation naturelle',['ventilation naturelle','tirage naturel','grilles naturelles']),
    pair('Ventilation hybride',['ventilation hybride','vmc hybride'])
  ]
};

const COOLING = [
  pair('PAC réversible',['pac réversible','pac reversible','pompe à chaleur réversible','pompe a chaleur reversible']),
  pair('Split / multisplit',['split','multi-split','multisplit']),
  pair('DRV/VRV',['drv','vrv']),
  pair('Groupe froid',['groupe froid','chiller','production eau glacée','production eau glacee']),
  pair('Plancher rafraîchissant',['plancher rafraîchissant','plancher rafraichissant']),
  pair('Rafraîchissement adiabatique',['rafraîchissement adiabatique','rafraichissement adiabatique','adiabatique']),
  pair('Réseau de froid urbain',['réseau de froid','reseau de froid']),
  pair('Climatisation active',['climatisation','climatiseur'])
];

const WINDOW_MATERIALS = [
  pair('Bois/aluminium',['bois/aluminium','bois aluminium','bois-alu','bois alu','mixte bois alu']),
  pair('PVC',['pvc','menuiserie pvc','châssis pvc','chassis pvc']),
  pair('Aluminium',['aluminium','alu','menuiserie aluminium','châssis aluminium','chassis aluminium']),
  pair('Bois',['menuiserie bois','châssis bois','chassis bois','bois massif']),
  pair('Acier',['menuiserie acier','châssis acier','chassis acier'])
];
const GLAZINGS = [
  pair('Triple vitrage',['triple vitrage','3 vitrages','triple verre']),
  pair('Double vitrage VIR',['double vitrage vir','vitrage vir','faible émissivité','faible emissivite','low-e','vitrage peu émissif','vitrage peu emissif']),
  pair('Double vitrage',['double vitrage','2 vitrages','4/16/4','4-16-4','4/20/4']),
  pair('Simple vitrage',['simple vitrage','simple verre'])
];
const SHADINGS = [
  pair('Volet roulant',['volet roulant','volets roulants','vr motorisé','vr motorise']),
  pair('Volet battant',['volet battant','volets battants']),
  pair('BSO',['bso','brise-soleil orientable','brise soleil orientable']),
  pair('Store extérieur',['store extérieur','store exterieur','store banne']),
  pair('Persienne',['persienne','persiennes']),
  pair('Sans occultation',['sans occultation','sans protection mobile','aucune occultation','sans protection solaire'])
];
const ENR_TYPES = [
  pair('Photovoltaïque',['photovoltaïque','photovoltaique','panneaux photovoltaïques','panneaux photovoltaiques','modules pv','centrale pv']),
  pair('Solaire thermique',['solaire thermique','cesi','capteurs solaires thermiques']),
  pair('Biomasse',['biomasse','bois énergie','bois energie','granulés bois','granules bois','plaquettes bois']),
  pair('Géothermie',['géothermie','geothermie','sondes géothermiques','sondes geothermiques']),
  pair('Réseau de chaleur renouvelable',['réseau de chaleur renouvelable','reseau de chaleur renouvelable','rcu renouvelable','taux enr&r','taux enr']),
  pair('Récupération de chaleur',['récupération de chaleur','recuperation de chaleur','récupération sur air extrait','recuperation sur air extrait','récupération eaux grises','recuperation eaux grises'])
];
const FAN_TYPES = [
  pair('Brasseur d’air plafonnier',['brasseur d air','brasseur plafond','brasseur plafonnier','ventilateur de plafond']),
  pair('HVLS',['hvls','high volume low speed'])
];

const ELEMENT_PATTERNS = {
  wall:/\b(?:facade|mur(?:s)?\s+exterieur(?:s)?|paroi(?:s)?\s+verticale(?:s)?|doublage\s+mur|ite|iti|bardage|mur\s+peripherique)\b/i,
  roof:/\b(?:toiture|toiture[- ]terrasse|terrasse|plancher(?:s)?\s+haut(?:s)?|combles?|rampants?|sarking|sous[- ]face\s+toiture|plafond\s+haut)\b/i,
  floor:/\b(?:plancher(?:s)?\s+bas|dalle\s+basse|dalle\s+sur|terre[- ]?plein|vide\s+sanitaire|sous[- ]sol|parking|garage|local\s+non\s+chauffe)\b/i,
  window:/\b(?:menuiserie(?:s)?(?:\s+exterieure(?:s)?)?|fenetre(?:s)?|baie(?:s)?(?:\s+vitree(?:s)?)?|chassis|ouvrant(?:s)?|vitrage(?:s)?)\b/i
};

/* ---- utils.js ---- */
function normalizeText(s='') {
  return String(s).replace(/\u0000/g,'fi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
}
function normLower(s=''){ return normalizeText(s).toLowerCase(); }

function normalizeGlazingType(value='') {
  const raw=String(value??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/×/g,'x').replace(/\s+/g,' ').trim();
  if(!raw) return null;
  const gasFrom=(text='')=>{
    if(/\b(?:argon|gaz\s+argon)\b/i.test(text)||/\bAr\b/.test(text)) return 'Ar';
    if(/\b(?:krypton|gaz\s+krypton)\b/i.test(text)||/\bKr\b/.test(text)) return 'Kr';
    if(/\b(?:lame\s+d['’]?air|air)\b/i.test(text)) return 'Air';
    return '';
  };
  const n=v=>String(v).replace(',', '.').replace(/\.0+$/,'');
  const plausiblePane=x=>{ const raw=String(x).replace(',','.'); const v=Number(raw); if(!Number.isFinite(v)||v<=0) return false; if(v>=2&&v<=12) return true; /* verre feuilleté : 33.2, 44.2, 55.2, 66.2… */ return /^(?:22|33|44|55|66|77|88|99)\.[1-4]$/.test(raw); };
  const plausible=parts=>parts.every((x,i)=>i%2===1?(()=>{const v=Number(String(x).replace(',','.'));return Number.isFinite(v)&&v>=6&&v<=40;})():plausiblePane(x));
  // Composition avec gaz écrit entre parenthèses, fréquente dans Climawin : 8/16(argon)/44.2.
  let pg=raw.match(/(?<!\d)(\d{1,3}(?:[,.]\d)?)\s*(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)\s*\(\s*(argon|krypton|air)\s*\)\s*(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)(?!\d)/i);
  if(pg){ const parts=[pg[1],pg[2],pg[4]]; if(plausible(parts)){ const gas=gasFrom(pg[3]); return `${parts.map(n).join('.')}${gas?` ${gas}`:''}`; } }
  // Triple vitrage, ex. 4/12/4/12/4 Ar.
  let m=raw.match(/(?<!\d)(\d{1,3}(?:[,.]\d)?)\s*(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)\s*(?:(Ar(?:gon)?|Kr(?:ypton)?|air)\s*)?(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)\s*(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)\s*(?:(Ar(?:gon)?|Kr(?:ypton)?|air)\s*)?(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)(?!\d)/i);
  if(m){ const parts=[m[1],m[2],m[4],m[5],m[7]]; if(plausible(parts)){ const gas=gasFrom(`${m[3]||''} ${m[6]||''} ${raw}`); return `${parts.map(n).join('.')}${gas?` ${gas}`:''}`; } }
  // Double vitrage, ex. 4/16/4 Argon ou 4-16Ar-4.
  m=raw.match(/(?<!\d)(\d{1,3}(?:[,.]\d)?)\s*(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)\s*(?:(Ar(?:gon)?|Kr(?:ypton)?|air)\s*)?(?:\/|-|x)\s*(\d{1,3}(?:[,.]\d)?)(?!\d)/i);
  if(m){ const parts=[m[1],m[2],m[4]]; if(plausible(parts)){ const gas=gasFrom(m[3]||raw); return `${parts.map(n).join('.')}${gas?` ${gas}`:''}`; } }
  // Les RSET écrivent parfois directement « 4.16.4 Ar ».
  m=raw.match(/(?<!\d)(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})(?!\d)/);
  if(m&&plausible([m[1],m[2],m[3]])){ const gas=gasFrom(raw); return `${m[1]}.${m[2]}.${m[3]}${gas?` ${gas}`:''}`; }
  const low=normLower(raw);
  // Certains rapports Bao Evolution n'indiquent pas l'épaisseur des verres mais seulement
  // « Double +15mm ». On conserve l'information réellement présente sans inventer 4/15/4.
  m=raw.match(/\bdouble(?:\s+vitrage)?\s*(?:[-–—:]\s*)?lame\s*(?:de\s*)?(\d{1,2}(?:[,.]\d+)?)\s*mm\b/i)||raw.match(/\bdouble(?:\s+vitrage)?\s*\+?\s*(\d{1,2}(?:[,.]\d+)?)\s*mm\b/i);
  if(m) return `Double vitrage — lame ${n(m[1])} mm`;
  if(/triple\s+vitrage|3\s+vitrages|triple\s+verre/.test(low)) return 'Triple vitrage';
  if(/double\s+vitrage|2\s+vitrages|vitrage\s+vir|faible\s+emissiv|low-e|peu\s+emissif/.test(low)) return /vir|faible\s+emissiv|low-e|peu\s+emissif/.test(low)?'Double vitrage VIR':'Double vitrage';
  if(/simple\s+vitrage|simple\s+verre/.test(low)) return 'Simple vitrage';
  return null;
}
function parseFrNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v == null) return null;
  const s = String(v).replace(/\u00a0/g,' ').replace(/\s(?=\d{3}(?:\D|$))/g,'').replace(',', '.').replace(/[^0-9+\-.]/g,'');
  if (!s || !/[0-9]/.test(s)) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
function maskNonDataNumerics(text='') {
  // Les millésimes réglementaires et versions logicielles sont des identifiants, jamais des valeurs métier.
  // Ex. RE2020 / RE 2020 / RT2012 / RT 2012 ne doivent pas devenir 2020 / 2012 dans un champ IC/Cep.
  return String(text)
    .replace(/\b(?:RE|RT)\s*[-_ ]?\s*(?:2012|2020)\b/gi,m=>m.replace(/\d/g,'x'))
    .replace(/\bIC\s*(?:energie|énergie|construction)\s*(?:2025|2028|2031)\b/gi,m=>m.replace(/\d/g,'x'))
    .replace(/\b(?:version|v)\.?\s*\d+(?:[.,]\d+){1,5}\b/gi,m=>m.replace(/\d/g,'x'));
}
function numbersIn(text='') {
  // Ne jamais fusionner une suite de colonnes comme « 505 212 162 116 ».
  // On recolle uniquement les séparateurs de milliers non ambigus (ex. « 1 663,5 »).
  let s=maskNonDataNumerics(text).replace(/(?<![\d,.])(\d{1,2})[ \u00a0](\d{3})(?=[,.]\d+)/g,'$1$2');
  const out=[];
  // Interdit également de démarrer au milieu d'un identifiant alphanumérique (RE2020, BAT001, etc.).
  const re=/(?<![A-Za-z0-9])[-+]?\d+(?:[,.]\d+)?(?![A-Za-z0-9])/g;
  for (const m of s.matchAll(re)) { const n=parseFrNumber(m[0]); if(n!==null) out.push(n); }
  return out;
}
function clamp(v,min=0,max=1){ return Math.max(min,Math.min(max,v)); }
function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function uid(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
function excerpt(text, needle='', radius=120){
  const s=String(text||'').replace(/\s+/g,' ').trim(); if(!s) return '';
  const i=needle ? normLower(s).indexOf(normLower(needle)) : -1;
  if(i<0) return s.slice(0, radius*2);
  return `${i>radius?'…':''}${s.slice(Math.max(0,i-radius),Math.min(s.length,i+needle.length+radius))}${i+needle.length+radius<s.length?'…':''}`;
}
function unique(arr){ return [...new Set(arr.filter(v=>v!==null&&v!==undefined&&v!==''))]; }
function downloadBlob(blob, name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000); }
function tokenize(s=''){ return normLower(s).split(/[^a-z0-9]+/).filter(x=>x.length>1); }
function scoreTokens(query,text){ const q=tokenize(query), t=normLower(text); if(!q.length) return 0; return q.reduce((a,w)=>a+(t.includes(w)?1:0),0)/q.length; }
function findFirstMatch(text, pairs){ for(const [label,re] of pairs){ if(re.test(normalizeText(text))) return label; } return null; }
function formatValue(v){ if(v===null||v===undefined||v==='') return 'non précisé'; if(typeof v==='number') return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(v); return String(v); }

/* ---- insulation-library.js ---- */
/*
 * Bibliothèque isolants Prestaterre Extract v1.0.4
 * 173 variantes produit / épaisseur / R, dont 150 variantes cœur dans les familles demandées, issues de certificats fabricants/ACERMI.
 * Les performances de cette bibliothèque ne sont utilisées qu'en secours lorsque
 * le produit ET une épaisseur compatible sont identifiés dans le document.
 */

function libNorm(s=''){
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
}
function compact(s=''){ return libNorm(s).replace(/\s+/g,''); }
function levenshtein(a,b){
  a=String(a); b=String(b); const row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){ let prev=row[0]; row[0]=i; for(let j=1;j<=b.length;j++){ const old=row[j]; row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1)); prev=old; } }
  return row[b.length];
}
function approxContains(textCompact,aliasCompact){
  if(!aliasCompact||aliasCompact.length<5) return false;
  if(textCompact.includes(aliasCompact)) return true;
  const maxDist=aliasCompact.length>=11?2:1;
  for(let len=Math.max(4,aliasCompact.length-maxDist);len<=aliasCompact.length+maxDist;len++){
    for(let i=0;i+len<=textCompact.length;i++) if(levenshtein(textCompact.slice(i,i+len),aliasCompact)<=maxDist) return true;
  }
  return false;
}

const family=(brand,product,material,lambda,applications,aliases,variants,source)=>({brand,product,material,lambda,applications,aliases,variants:variants.map(([thickness,r])=>({thickness,r})),source});

const INSULATION_LIBRARY_VERSION='2026-09-07';
const INSULATION_FAMILIES=[
  family('Isover','GR 32 revêtu kraft','Laine de verre',0.032,['wall','roof'],['isover gr 32','gr 32 kraft','gr32 kraft','gr 32','gr32'],[[45,1.40],[60,1.85],[75,2.35],[85,2.65],[100,3.15],[120,3.75],[140,4.35],[160,5.00],[180,5.60]],'ACERMI / Isover GR 32'),
  family('Isover','GR 32 roulé','Laine de verre',0.032,['wall','roof'],['gr 32 roule','gr32 roule','gr 32 roule kraft','gr32 roule kraft'],[[60,1.85],[75,2.35],[85,2.65],[100,3.15],[120,3.75],[140,4.35],[160,5.00]],'ACERMI / Isover GR 32'),
  family('Isover','Isoconfort 32','Laine de verre',0.032,['wall','roof'],['isover isoconfort 32','isoconfort 32','isoconfort32','isomob 32r'],[[60,1.85],[80,2.50],[100,3.10],[120,3.75],[130,4.05],[140,4.35],[150,4.65],[160,5.00]],'ACERMI 08/018/540/19 et 05/018/384/16'),
  family('Isover','Isoconfort 35 Kraft','Laine de verre',0.035,['roof'],['isover isoconfort 35','isoconfort 35 kraft','isoconfort35 kraft','isoconfort 35'],[[160,4.55],[180,5.10],[200,5.70],[220,6.25],[240,6.85],[260,7.40],[280,8.00],[300,8.55]],'ACERMI / Isover Isoconfort 35'),
  family('URSA','Hometec 32','Laine de verre',0.032,['wall','roof','floor'],['ursa hometec 32','hometec 32','e hometec 32','f hometec 32','hometec32','ursa facade 32p','thermocoustic 32'],[[60,1.85],[80,2.50],[101,3.15],[120,3.75],[140,4.35],[160,5.00],[200,6.25]],'ACERMI 03/058/169/22 et 02/020/036/22'),
  family('Isover','GR 30','Laine de verre',0.030,['wall'],['isover gr 30','gr 30 kraft','gr30 kraft','gr 30','gr30'],[[90,3.00],[111,3.70],[130,4.30],[150,5.00]],'ACERMI / Isover GR 30'),

  family('Isonat','Flex 55','Fibre de bois',0.036,['wall','roof','floor'],['isonat flex 55','flex 55 plus h','flex55 plus h','isonat flex55','flex 55','flex55'],[[40,1.10],[45,1.25],[50,1.35],[60,1.65],[70,1.90],[80,2.20],[100,2.75],[120,3.30],[130,3.60],[140,3.85],[145,4.00],[160,4.40],[180,5.00],[200,5.55],[220,6.10],[240,6.65]],'ACERMI 15/018/984/11'),
  family('STEICO','STEICOflex 036','Fibre de bois',0.036,['wall','roof','floor'],['steicoflex 036','steico flex 036','steicoflex036','steicoflex','steico flex'],[[40,1.10],[50,1.35],[60,1.65],[80,2.20],[100,2.75],[120,3.30],[140,3.85],[145,4.00],[160,4.40],[180,5.00],[200,5.55],[220,6.10],[240,6.65]],'ACERMI / STEICOflex 036'),
  family('PAVATEX / SOPREMA','PAVAFLEX CONFORT','Fibre de bois',0.038,['wall','roof','floor'],['pavaflex confort','pavaflex comfort','pavaflex','pavatex pavaflex'],[[40,1.05],[45,1.15],[50,1.30],[60,1.55],[80,2.10],[100,2.60],[120,3.15],[140,3.65],[145,3.80],[160,4.20],[180,4.70],[200,5.25],[220,5.75],[240,6.30]],'ACERMI 17/006/1259/10'),

  family('Biofib','Biofib Trio','Biosourcé chanvre/lin/coton',0.038,['wall','roof','floor'],['biofib trio','biofib\'trio','bio fib trio','trio biofib'],[[45,1.15],[60,1.55],[80,2.10],[100,2.60],[120,3.15],[145,3.80],[160,4.20],[180,4.70],[200,5.25],[220,5.75]],'ACERMI 14/130/962/11'),
  family('Biofib','Biofib Chanvre','Chanvre',0.040,['wall','roof'],['biofib chanvre','biofib\'chanvre','bio fib chanvre','chanvre biofib'],[[80,2.00],[100,2.50],[120,3.00],[140,3.50],[160,4.00],[200,5.00]],'ACERMI / Biofib Chanvre'),
  family('Le Relais Métisse','Métisse RT / Coton Pro P/R','Coton recyclé',0.039,['wall','roof','floor'],['metisse rt','métisse rt','coton pro p r','coton pro pr','metisse coton pro','métisse coton pro'],[[45,1.15],[50,1.25],[60,1.50],[80,2.05],[100,2.55],[120,3.05],[145,3.70],[160,4.10],[180,4.60],[200,5.10]],'ACERMI 14/179/918/9'),

  family('Knauf','XTherm ITEx Sun+','PSE graphité',0.031,['wall'],['knauf xtherm itex sun','xtherm itex sun','xtherm sun','xtherm itex'],[[70,2.25],[80,2.55],[90,2.90],[100,3.20],[110,3.50],[120,3.85],[140,4.50]],'ACERMI 07/007/494/23'),
  family('Knauf','NEXTherm ITEx','PSE graphité',0.031,['wall'],['knauf nextherm itex','nextherm itex','next therm itex','nextherm'],[[60,1.90],[80,2.55],[100,3.20],[120,3.85],[140,4.50],[160,5.15],[200,6.45]],'ACERMI 20/007/1506/5'),
  family('Knauf','Therm Chape Th 38','PSE',0.038,['floor'],['knauf therm chape th 38','therm chape th38','therm chape th 38','knauf th38'],[[20,0.50],[25,0.65],[30,0.75],[35,0.90],[40,1.05],[45,1.15],[50,1.30],[55,1.40],[60,1.55],[65,1.70],[70,1.80],[75,1.95],[80,2.10],[85,2.20],[90,2.35],[95,2.50],[100,2.60],[105,2.75],[110,2.85],[115,3.00],[120,3.15],[125,3.25],[130,3.40],[140,3.65]],'ACERMI 03/007/172/16'),

  family('SOPREMA','TMS','PUR',0.022,['wall','roof','floor'],['soprema tms','tms mf si','tms gf si','tms isolant','tms'],[[25,1.00],[30,1.30],[40,1.85],[48,2.20],[52,2.40],[56,2.60],[61,2.80],[68,3.15],[75,3.45],[80,3.70],[87,4.00],[100,4.65],[110,5.10],[120,5.55],[130,6.00],[140,6.50],[160,7.40]],'ACERMI 08/006/481/32'),
  family('Unilin','Utherm Floor K','PUR/PIR',0.022,['floor'],['utherm floor k','floor pir k','floor k fra','unilin floor k','utherm floor'],[[40,1.85],[56,2.60],[80,3.70],[100,4.65],[120,5.55],[160,7.40]],'ACERMI 11/121/684/29')
];

const INSULATION_PRODUCT_VARIANTS=INSULATION_FAMILIES.flatMap(f=>f.variants.map(v=>({brand:f.brand,product:f.product,material:f.material,lambda:f.lambda,applications:f.applications,source:f.source,...v})));
const INSULATION_LIBRARY_VARIANT_COUNT=INSULATION_PRODUCT_VARIANTS.length;
const CORE_INSULATION_VARIANT_COUNT=INSULATION_PRODUCT_VARIANTS.filter(v=>!/^PUR(?:\/PIR)?$/.test(v.material)).length;

const INSULATION_ALIAS_CATALOG=[
  'Isover GR32','Isover GR 30','Isover Isoconfort 32','Isover Isoconfort 35','Isover Isomob 32R','Isover IBR',
  'URSA Hometec 32','URSA Façade 32P','URSA Thermocoustic 32','URSA MRK 40','URSA MNU 40','URSA PRK 32','URSA Cladursa 32',
  'Isonat Flex 55','Isonat Multisol','STEICOflex','STEICOprotect','STEICOtherm','STEICOuniversal','PAVAFLEX Confort','PAVAFLEX 36','PAVATHERM','PAVAWALL','ISOLAIR MULTI',
  'Biofib Trio','Biofib Chanvre','Biofib Ouate','Métisse RT','Coton Pro P/R','UniverCell','Pavafloc','Sopracell','Isocell',
  'Knauf XTherm ITEx Sun+','Knauf NEXTherm ITEx','Knauf Therm ITEx','Knauf Therm Chape Th38','Knauf Therm Sol','Knauf Therm Dallage',
  'Soprema TMS','TMS MF SI','TMS GF SI','SopraXPS','Unilin Utherm Floor','Unilin Utherm Wall','Unilin Utherm Roof','Unilin Utherm Sarking',
  'Recticel Eurothane Mur','Recticel Eurothane BR Bio','Recticel Powerwall','Kingspan Kooltherm','Kingspan Therma','Jackodur','Styrodur',
  'Rockwool Rockmur','Rockwool Rockplus','Rockwool Rocksol','Rockwool Rockcomble','Rockwool Rockciel','Rockwool MB Rock','Rockwool Alpharock'
];

const FAMILY_ALIAS_CACHE=new WeakMap();
function cachedAliases(f){
  let entries=FAMILY_ALIAS_CACHE.get(f);
  if(entries) return entries;
  entries=(f.aliases||[]).map(alias=>{ const norm=libNorm(alias), compactAlias=compact(alias); return {alias,norm,compact:compactAlias,tokens:norm.split(/\s+/).filter(Boolean)}; }).filter(x=>x.compact);
  FAMILY_ALIAS_CACHE.set(f,entries);
  return entries;
}
function approxAliasInTokens(textTokens,entry){
  if(!entry.compact||entry.compact.length<5||!textTokens.length) return false;
  const wanted=entry.tokens.length, maxDist=entry.compact.length>=11?2:1;
  const minWords=Math.max(1,wanted-1), maxWords=wanted+1;
  for(let i=0;i<textTokens.length;i++){
    // Préfiltre très bon marché : la première lettre doit rester cohérente pour une tolérance OCR de 1-2 caractères.
    if(entry.tokens[0]&&textTokens[i]&&entry.tokens[0][0]!==textTokens[i][0]) continue;
    for(let count=minWords;count<=maxWords&&i+count<=textTokens.length;count++){
      const candidate=textTokens.slice(i,i+count).join('');
      if(Math.abs(candidate.length-entry.compact.length)>maxDist) continue;
      if(levenshtein(candidate,entry.compact)<=maxDist) return true;
    }
  }
  return false;
}
function familyScorePrepared(n,c,tokens,f,target){
  if(target && !f.applications.includes(target)) return null;
  const aliases=cachedAliases(f); let best=0;
  // 1. Passage exact très rapide. Dans la grande majorité des CCTP/RSET, c'est suffisant.
  for(const a of aliases) if(n.includes(a.norm)||c.includes(a.compact)){ best=1; break; }
  // 2. Fuzzy seulement en secours, sur des fenêtres de mots et non sur chaque sous-chaîne caractère par caractère.
  if(best===0){ for(const a of aliases){ if(approxAliasInTokens(tokens,a)){ best=.96; break; } } }
  if(best===0) return null;
  const brand=compact(f.brand.split('/')[0]); if(brand.length>=4 && c.includes(brand)) best=Math.min(1,best+0.01);
  return best;
}
function thicknessCandidates(text){
  const n=libNorm(text); const values=[];
  for(const m of n.matchAll(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:mm|millimetres?|millimeters?)\b/g)) values.push(Number(m[1].replace(',','.')));
  if(!values.length) for(const m of n.matchAll(/\b(\d{2,3})\b/g)) values.push(Number(m[1]));
  return [...new Set(values.filter(v=>v>=20&&v<=500))];
}
function nearestVariant(f,thickness){
  if(thickness==null||!Number.isFinite(Number(thickness))) return null;
  const t=Number(thickness); const sorted=[...f.variants].sort((a,b)=>Math.abs(a.thickness-t)-Math.abs(b.thickness-t));
  return sorted.length&&Math.abs(sorted[0].thickness-t)<=1.5?sorted[0]:null;
}

function matchInsulationProduct(text,target=null,explicitThickness=null){
  const matches=[]; const n=libNorm(text), c=compact(text), tokens=n.split(/\s+/).filter(Boolean);
  for(const f of INSULATION_FAMILIES){ const score=familyScorePrepared(n,c,tokens,f,target); if(score!=null) matches.push({f,score}); }
  if(!matches.length) return null;
  matches.sort((a,b)=>b.score-a.score || Math.max(...b.f.aliases.map(x=>compact(x).length))-Math.max(...a.f.aliases.map(x=>compact(x).length)));
  const {f,score}=matches[0]; let variant=nearestVariant(f,explicitThickness), thicknessEvidence=variant?'explicit':null;
  if(!variant){ const candidates=thicknessCandidates(text).map(t=>({t,v:nearestVariant(f,t)})).filter(x=>x.v); const uniq=[]; const seen=new Set(); for(const x of candidates){ const k=x.v.thickness; if(!seen.has(k)){seen.add(k);uniq.push(x);} } if(uniq.length===1){ variant=uniq[0].v; thicknessEvidence='product-context'; } }
  return {brand:f.brand,product:f.product,material:f.material,lambda:f.lambda,applications:f.applications,source:f.source,score,variant,thicknessEvidence};
}

function libraryNote(match,kind){
  if(!match?.variant) return '';
  const base=`${match.brand} — ${match.product}, ${match.variant.thickness} mm, R ${String(match.variant.r).replace('.',',')} m².K/W ; source ${match.source}`;
  return kind==='r'
    ? `R issu de la bibliothèque isolants (${base}) car aucune résistance thermique directe exploitable n'a été trouvée dans le document. La valeur documentaire directe reste prioritaire.`
    : `Épaisseur issue de la bibliothèque isolants (${base}) à partir d'une gamme produit reconnue. La valeur documentaire directe reste prioritaire.`;
}

/* ---- buildings.js ---- */
function canonicalBuilding(raw){
  let s=normalizeText(raw).replace(/^['"“”]+|['"“”]+$/g,'').trim();
  s=s.replace(/^(?:identifiant\s+)?(?:batiment|bâtiment)\s*[:\-]?\s*/i,'').trim();
  s=s.replace(/^bat\.?\s+/i,'').trim();
  s=s.replace(/\s*\(\s*\d+\s+zones?\s*\)\s*$/i,'').trim();
  s=s.replace(/\s*-\s*zone\s*:?.*$/i,'').trim();
  if(!s) return 'Bâtiment unique';
  const up=s.toUpperCase().replace(/\s+/g,' ');
  if(/^(UNIQUE|PRINCIPAL|ENSEMBLE)$/.test(up)) return 'Bâtiment unique';
  return `Bâtiment ${up.replace(/^BATIMENT\s+/,'').replace(/^BÂTIMENT\s+/,'')}`;
}

// Clé de regroupement prudente : elle neutralise les variantes d'écriture évidentes
// (Bât A / Batiment A / BAT-A) sans fusionner automatiquement des identifiants différents
// comme B et B1. Les rapprochements ambigus restent disponibles pour une fusion manuelle.
function buildingMergeKey(raw){
  let s=normalizeText(raw).toLowerCase();
  if(!s) return '';
  s=s.replace(/["'“”]/g,' ')
    .replace(/\([^)]*zones?[^)]*\)/g,' ')
    .replace(/^\s*(?:identifiant\s+)?(?:batiment|bâtiment|bat|bât)\.?\s*[:\-]?\s*/i,'')
    .replace(/\s*-\s*zone\s*:?.*$/i,' ')
    .replace(/(?:batiment|bâtiment)/g,' ')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
  if(!s) return '';
  const tokens=s.split(/\s+/).filter(Boolean).map(t=>/^\d+$/.test(t)?String(parseInt(t,10)):t);
  return tokens.join(' ');
}

function buildingCoreId(raw){
  const key=buildingMergeKey(raw); if(!key) return '';
  // Codes bâtiment fréquents : A, B, B1, C02, 100, 200, FA, FB…
  const first=key.split(' ')[0];
  if(/^(?:[a-z]{1,3}\d{0,3}|\d{1,4})$/.test(first)) return first.replace(/^([a-z]+)0+(\d+)$/,'$1$2').replace(/^0+(\d+)$/,'$1');
  return key;
}

function buildingSimilarity(a,b){
  const ka=buildingMergeKey(a), kb=buildingMergeKey(b); if(!ka||!kb) return 0;
  if(ka===kb) return 1;
  const ca=buildingCoreId(a), cb=buildingCoreId(b);
  if(ca&&cb&&ca===cb) return .98;
  if(ca&&cb&&(ca.startsWith(cb)||cb.startsWith(ca))&&Math.abs(ca.length-cb.length)<=2) return .78;
  const A=new Set(ka.split(' ')), B=new Set(kb.split(' '));
  const inter=[...A].filter(x=>B.has(x)).length, union=new Set([...A,...B]).size;
  return union?inter/union:0;
}

function expectedBuildingCount(doc){
  for(const page of doc.read?.pages||[]){
    for(const line of page.lines||[]){
      const s=normalizeText(line.text);
      const m=s.match(/nombre\s+de\s+b[aâ]timents?\s*\/\s*zones?\s+du\s+projet\s*[:\-]?\s*(\d+)/i)
        ||s.match(/nombre\s+de\s+b[aâ]timents?\s+du\s+projet\s*[:\-]?\s*(\d+)/i);
      if(m) return parseInt(m[1],10);
    }
  }
  return null;
}

function cleanCandidate(raw){
  let s=normalizeText(raw).replace(/^['"“”]+|['"“”]+$/g,'').trim();
  s=s.replace(/\s*\(\s*\d+\s+zones?\s*\)\s*$/i,'').trim();
  s=s.replace(/\s*-\s*zone\s*:?.*$/i,'').trim();
  return s;
}

function looksLikeBuildingId(raw){
  const s=cleanCandidate(raw);
  if(!s||s.length>150) return false;
  if(/^(?:s|srt|sref|zone(?:s)?|usage|surface|ref|m2|projet)$/i.test(s)) return false;
  return /\d|[a-zà-ÿ]/i.test(s);
}

function detectBuildings(doc){
  // v2.3.3 — synthèse ClimaWin : les bâtiments sont les titres de section « N. Bâtiment X » (jamais les lignes de tableau).
  if(isClimaWinSynthesis(doc)){
    const secs=climaWinBuildingSections(doc);
    if(secs.length){ const names=[...new Set(secs.map(x=>x.name))]; return {names,expectedCount:names.length,source:'climawin-sections',hits:secs.map(x=>({page:x.page,line:x.line,building:x.name}))}; }
  }
  // v2.3.5 — sortie Pléiades : bâtiments = titres « 1.N <nom> » des résultats RE2020.
  if(isPleiadesThermalOutput(doc)){
    const names=pleiadesThermalBuildingNames(doc).map(canonicalBuilding);
    if(names.length) return {names:[...new Set(names)],expectedCount:names.length,source:'pleiades-sortie-sections',hits:[]};
  }
  // v2.3.7 — éditions Pléiades (rapport ACV, synthèse des prestations, déperditions) : titres explicites.
  if(isPleiadesAcvReport(doc)||isPleiadesServicesSummary(doc)||isHeatLossReport(doc)){
    const names=pleiadesReportBuildingNames(doc).map(canonicalBuilding);
    return names.length?{names:[...new Set(names)],expectedCount:new Set(names).size,source:'pleiades-rapport',hits:[]}:{names:['Bâtiment unique'],hits:[],expectedCount:0,complete:true,aliases:{},source:'pleiades-rapport'};
  }
  // v2.3.6 — notice carbone RE2020 : bâtiments = sections « EVALUATION DU BILAN CARBONE – BATIMENT X ».
  if(isCarbonNoticeRe2020(doc)){
    const names=carbonNoticeBuildingNames(doc).map(canonicalBuilding);
    if(names.length) return {names:[...new Set(names)],expectedCount:new Set(names).size,source:'notice-carbone-sections',hits:[]};
  }
  if(isThermalNoticeColumns(doc)){
    const names=thermalNoticeBuildingNames(doc).map(canonicalBuilding);
    if(names.length) return {names:[...new Set(names)],expectedCount:new Set(names).size,source:'notice-thermique-colonnes',hits:[]};
  }
  // Notice label biosourcé : tableaux FDES (identifiants numériques) — jamais de bâtiments détectés depuis ces lignes.
  if(isBiosourcedLabelNotice(doc)) return {names:['Bâtiment unique'],hits:[],expectedCount:0,complete:true,aliases:{},source:'notice-biosource'};
  // v2.3.5 — fiche RSET / RSEE CSTB : bâtiments = marqueurs « Bâtiment : X », « "X" », « Nom du bâtiment X ».
  if(isCstbRseeFiche(doc)){
    const names=cstbBuildingNames(doc).map(canonicalBuilding);
    if(names.length) return {names:[...new Set(names)],expectedCount:new Set(names).size,source:'cstb-rsee-sections',hits:[]};
  }
  // Rapport de saisie ClimaWin : données d'entrée, non exploitées (numérotation « Bâtiment 1/2/3 » ≠ synthèse A/B/C).
  if(isClimaWinInputReport(doc)) return {names:['Bâtiment unique'],hits:[],expectedCount:0,complete:true,aliases:{},source:'climawin-input-skipped'};
  // v2.3 — XML RE2020 : la liste des bâtiments est donnée par les balises Index/Name, sans heuristique.
  if(doc?.read?.re2020?.buildings?.length){
    const names=doc.read.re2020.buildings.map(b=>b.name);
    return {names,expectedCount:names.length,source:'xml-re2020',hits:[]};
  }
  const expectedCount=expectedBuildingCount(doc);
  const strong=[];
  let genericSingleHeadingSeen=false;

  const isGenericBuildingHeading=(raw='')=>{
    // Certains logiciels répètent des intitulés techniques comme
    // « Bâtiment : Bâtiment (RE2020) » ou « Bâtiment - bâtiment neuf Consommations ».
    // On retire tous les tokens « bâtiment » avant de décider s'il s'agit d'un vrai identifiant.
    const n=normLower(cleanCandidate(raw))
      .replace(/\b(?:batiment|bâtiment)\b/g,' ')
      .replace(/[()\[\]{}:;,_./\-–—]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    if(!n) return true;
    // Titres de logiciels/rapports qui décrivent la nature du calcul, pas un identifiant bâtiment.
    if(/^(?:re\s*2020|rt\s*2012|neuf|existant|projet|consommations?|resultats?|résultats?)$/.test(n)) return true;
    if(/^(?:neuf|existant|projet)\s+(?:consommations?|resultats?|résultats?)$/.test(n)) return true;
    if(/^(?:resultats?|résultats?)\s+(?:consommations?|enveloppe|energie|énergie|carbone)$/.test(n)) return true;
    return false;
  };

  // 1) Registre maître : les identifiants explicites du Chapitre 2 sont prioritaires.
  for(const page of doc.read?.pages||[]){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const text=normalizeText(lines[i].text);
      let raw=null, quality='heading';
      let m=text.match(/^identifiant\s+b[aâ]timent\s*[:\-]?\s*(.+)$/i);
      if(m){ raw=m[1]; quality='chapter2-id'; }
      // Les rapports logiciels utilisent souvent « 1.1. Bâtiment : BÂTIMENT A ».
      if(!raw){ m=text.match(/^(?:\d+(?:\.\d+)*\.?\s*)?(?:batiment|bâtiment)\s*:\s*(.+)$/i); if(m){raw=m[1];quality='building-heading';} }
      // Synthèses ACV (ClimaWin notamment) : « 1. Bâtiment A », « 2. Bâtiment B - 1 » sans deux-points.
      if(!raw && !/\bsommaire\b/i.test(page.text||'')){ m=text.match(/^(?:\d+(?:\.\d+)*\.?\s*)?(?:batiment|bâtiment)\s+([A-Z0-9][A-Z0-9 ._\/-]{0,80})$/i); if(m){raw=m[1];quality='building-heading';} }
      if(!raw) continue;
      raw=cleanCandidate(raw);
      if(isGenericBuildingHeading(raw)){ genericSingleHeadingSeen=true; continue; }
      if(!looksLikeBuildingId(raw)) continue;
      const building=canonicalBuilding(raw);
      if(building!=='Bâtiment unique') strong.push({building,page:page.page,line:lines[i].index,text:lines[i].text,quality});
    }
  }

  // Si on dispose d'identifiants Chapitre 2, ils définissent la liste canonique.
  let master=unique(strong.filter(h=>h.quality==='chapter2-id').map(h=>h.building));
  if(!master.length) master=unique(strong.map(h=>h.building));

  // Un rapport mono-bâtiment peut employer seulement « Bâtiment : Bâtiment (RE2020) »
  // ou « 1.1. Bâtiment : BÂTIMENT ». Dans ce cas, ne pas fabriquer de faux bâtiments
  // à partir d'intitulés de tableaux rencontrés plus loin dans le PDF.
  if(!master.length && genericSingleHeadingSeen && (!expectedCount || expectedCount===1))
    return {names:['Bâtiment unique'],hits:[],expectedCount,complete:!expectedCount||expectedCount===1,aliases:{}};

  // 2) Si nécessaire, détecter les en-têtes courts de type « Bat 100 (2 zones) ».
  if(!master.length || (expectedCount&&master.length<expectedCount)){
    const candidates=[];
    for(const page of doc.read?.pages||[]){ for(const line of page.lines||[]){
      const text=normalizeText(line.text);
      const m=text.match(/^bat(?:iment)?\s+([A-Z0-9][A-Z0-9 ._\/-]{0,80}?)(?:\s*\(\s*\d+\s+zones?\s*\))?$/i);
      if(m){ const building=canonicalBuilding(`Bat ${m[1]}`); if(building!=='Bâtiment unique') candidates.push({building,page:page.page,line:line.index,text:line.text,quality:'short-heading'}); }
    }}
    const counts=new Map(); for(const h of candidates) counts.set(h.building,(counts.get(h.building)||0)+1);
    const reliable=unique(candidates.filter(h=>(counts.get(h.building)||0)>=2).map(h=>h.building));
    master=unique([...master,...reliable]);
    strong.push(...candidates.filter(h=>master.includes(h.building)));
  }

  if(!master.length) return {names:['Bâtiment unique'],hits:[],expectedCount,complete:!expectedCount||expectedCount===1,aliases:{}};

  // 3) Construire les alias autorisés à partir du registre maître, puis repérer chaque changement de bâtiment
  // dans les chapitres 3/4, feuillets équipements/génération et sorties détaillées.
  const aliasMap=new Map();
  for(const b of master){
    const short=b.replace(/^Bâtiment\s+/i,'').trim();
    // Les identifiants courts A/B/1 ne doivent jamais être utilisés comme mots isolés :
    // cela créerait de faux changements de bâtiment sur les articles « a/à » du texte courant.
    const aliases=unique([`Bat ${short}`,`Batiment ${short}`,`Bâtiment ${short}`].map(normLower));
    aliasMap.set(b,{short:normLower(short),aliases});
  }
  const allHits=[...strong];
  const seen=new Set(allHits.map(h=>`${h.building}|${h.page}|${h.line}`));
  for(const page of doc.read?.pages||[]){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const text=normalizeText(lines[i].text), low=normLower(text);
      for(const [building,aliasDef] of aliasMap){
        const {short,aliases}=aliasDef;
        const matchedFull=aliases.some(a=>{
          if(!a) return false;
          const esc=a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
          if((short||'').length<=2){
            // A/B : accepter uniquement une vraie terminaison d'identifiant, jamais « bâtiment à usage ».
            return new RegExp(`(?:^|[^a-z0-9])${esc}(?=$|\\s*(?:\\(|s(?:ref|rt)?\\s*:|[-:])|[\\)\\]\"'])`,'i').test(low);
          }
          return new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`,'i').test(low);
        });
        const shortEsc=(short||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const matchedShort=!!shortEsc && (
          new RegExp(`\\(\\s*${shortEsc}\\s*\\)`,'i').test(low) ||
          new RegExp(`^\\s*${shortEsc}\\s+s(?:ref|rt)?\\s*:`,'i').test(low) ||
          low.trim()===short
        );
        if(!(matchedFull||matchedShort)) continue;
        const contextOK=/^(?:bat|b[aâ]timent|identifiant|g[eé]n[eé]ration|r[eé]sultats?\s+sorties?\s+d[eé]taill[eé]es?)/i.test(text)
          ||/chapitre\s+[234]|feuillets?\s+(?:equipements|équipements|generation|génération)|zone\s*:|b[aâ]timent\s*:/i.test(text)
          ||text.length<70;
        if(!contextOK) continue;
        const k=`${building}|${page.page}|${lines[i].index}`;
        if(!seen.has(k)){ seen.add(k); allHits.push({building,page:page.page,line:lines[i].index,text:lines[i].text,quality:'alias-heading'}); }
      }
    }
  }

  allHits.sort((a,b)=>(a.page-b.page)||((a.line??0)-(b.line??0)));
  // Dédupliquer les hits immédiatement répétés du même bâtiment ; ils sont inutiles pour l'ancrage.
  const hits=[];
  for(const h of allHits){ const p=hits[hits.length-1]; if(p&&p.building===h.building&&p.page===h.page&&Math.abs((p.line??0)-(h.line??0))<=1) continue; hits.push(h); }

  // v2.3.3 — une ligne de tableau (« Bâtiment A 19.00 7.20 1.90 … ») n'est jamais un bâtiment.
  const rowLike=n=>/(?:\s\d+[.,]\d+){3,}/.test(String(n))||/\s\d+[.,]\d+\s*%/.test(String(n));
  if(master.some(rowLike)){ const keep=master.filter(n=>!rowLike(n)); if(keep.length){ master.length=0; master.push(...keep); } for(let i=hits.length-1;i>=0;i--) if(rowLike(hits[i].building)) hits.splice(i,1); }
  return {names:master,hits,expectedCount,complete:!expectedCount||master.length===expectedCount,aliases:Object.fromEntries([...aliasMap].map(([k,v])=>[k,[...(v.aliases||[]),v.short].filter(Boolean)]))};
}

function buildingForPosition(doc,pageNo,lineIndex){
  const b=doc.buildings||detectBuildings(doc); if(b.names.length===1) return b.names[0];
  const candidates=(b.hits||[]).filter(h=>h.page<pageNo||(h.page===pageNo&&(h.line??0)<=lineIndex));
  if(!candidates.length) return b.names[0]||'Bâtiment unique';
  candidates.sort((a,b)=>(b.page-a.page)||((b.line??0)-(a.line??0)));
  return candidates[0].building;
}

function operationNameFromFiles(docs){
  if(!docs.length) return 'Opération';
  let s=docs[0].name.replace(/\.(pdf|xml|xlsx?|xls)$/i,'').replace(/\b(rset|rsee|rt2012|rsee?|dpgf|cctp|rapport|etude|étude)\b/ig,' ').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  return s||'Opération';
}

/* ---- climawin.js ---- */
// ExtracTerre v2.3.3 — synthèse d'étude ClimaWin 2020 (RE2020), PDF multi-bâtiments.
// Structure stable : « N. Bâtiment X » → N.1 Étude / N.2 Bâtiment / N.3 Enveloppe / N.4 Synthèse RE2020.
// Chaque indicateur est lu dans sa propre table, rattaché au bâtiment de sa section (jamais deviné par
// proximité de mots), et contrôlé par recoupement (Σ zones = Sref, gains recalculés, etc.).


const cw_NUM='-?\\d+(?:[.,]\\d+)?';
const cw_num=s=>{ const v=Number(String(s).replace(/\s+/g,'').replace(',','.')); return Number.isFinite(v)?v:null; };
const cw_round=(v,d=2)=>{ const f=10**d; return Math.round(v*f)/f; };

function isClimaWinSynthesis(doc){
  const t=String(doc?.read?.text||'').slice(0,400000);
  return /synthese\s+d['’]?etude\s+realisee\s+avec\s+climawin\s+2020/i.test(t)&&/calcul\s+bbio\s*:\s*resultats\s+par\s+zone|bbio\s*\(points\)/i.test(t);
}

// Rapport « Saisie détaillée » ClimaWin : paramètres d'entrée (parois, menuiseries, locaux). Volumineux (300 à 700 pages),
// numéroté « Bâtiment 1/2/3 » et sans résultat réglementaire : il n'est pas exploité par l'extraction automatique.
function isClimaWinInputReport(doc){
  const t=String(doc?.read?.text||'').slice(0,60000);
  return /climawin\s+2020/i.test(t)&&/rapport\s+detaille/i.test(t)&&/\b3\.\s*parois\b/i.test(t)&&!/synthese\s+d['’]?etude\s+realisee\s+avec\s+climawin/i.test(t);
}

// Sections « N. Bâtiment X » (hors sommaire : le vrai titre est suivi de « N.1. Étude »).
function climaWinBuildingSections(doc){
  const out=[];
  for(const page of doc?.read?.pages||[]){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const m=String(lines[i].text||'').match(/^\d+\.\s+(Batiment\s+.+)$/i);
      if(!m) continue;
      const next=String(lines[i+1]?.text||'');
      if(!/^\d+\.1\.\s+Etude\s*$/i.test(next)) continue;
      out.push({name:canonicalBuilding(m[1].trim()),page:page.page,line:lines[i].index});
    }
  }
  return out;
}

function cw_studyDateOf(lines){
  for(const l of lines){ const m=String(l.text).match(/^Date\s+(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/i); if(m) return `${m[3]}-${m[2]}-${m[1]}${m[4]?'T'+m[4]:''}`; }
  return null;
}

const cw_USAGE_FIELDS={fr:'cep_cooling',ecl:'cep_lighting',vent:'cep_aux_vent',dist:'cep_aux_dist',depl:'cep_mobility'};
const cw_VECTOR_LABEL={elec:'Électricité',gaz:'Gaz',fioul:'Fioul',bois:'Bois / biomasse',reseau:'Réseau de chaleur urbain'};
const cw_VECTOR_FIELD={elec:'cep_electricity',gaz:'cep_gas',reseau:'cep_district',bois:'cep_biomass'};

function parseClimaWinSynthesis(doc,occ){
  const sections=climaWinBuildingSections(doc); if(!sections.length) return [];
  const pages=doc.read.pages||[]; const out=[];
  // Lignes aplaties avec leur page, pour borner chaque section jusqu'au titre suivant.
  const flat=[]; for(const p of pages) for(const l of p.lines||[]) flat.push({page:p,line:l,text:String(l.text||'')});
  const posOf=(s)=>flat.findIndex(f=>f.page.page===s.page&&f.line.index===s.line);
  for(let si=0;si<sections.length;si++){
    const sec=sections[si]; const from=posOf(sec); const to=si+1<sections.length?posOf(sections[si+1]):flat.length;
    if(from<0) continue; const seg=flat.slice(from,to); const building=sec.name;
    const emit=(f,field,value,method,conf,unit='',extra={})=>{ if(value===null||value===undefined||(typeof value==='number'&&!Number.isFinite(value))) return;
      const o=occ(doc,f.page,f.line,field,value,`climawin:${method}`,conf,unit,{building,structuredPdf:true,studyDate:studyDate,origin:'ClimaWin 2020 — synthèse d\'étude RE2020',...extra}); if(o) out.push(o); };
    const studyDate=cw_studyDateOf(seg);
    const find=(re)=>{ for(const f of seg){ const m=f.text.match(re); if(m) return {f,m}; } return null; };
    const gain=(v,max)=>max?cw_round((max-v)/max*100,2):null;

    // ---- Indicateurs réglementaires (boîtes « VALEUR / EXIGENCE ») ----
    const rows=[['bbio',/^BBio \(points\)\s+(cw_NUM)\s+(cw_NUM)\s+-?\d+\s*%/,'bbio','bbio_max','bbio_gain','points'],
                ['cepnr',/^Cep,nr \(kWhep\/\(m².an\)\)\s+(cw_NUM)\s+(cw_NUM)\s+-?\d+\s*%/,'cepnr','cepnr_max','cepnr_gain','kWhEP/m².an'],
                ['cep',/^Cep \(kWhep\/\(m².an\)\)\s+(cw_NUM)\s+(cw_NUM)\s+-?\d+\s*%/,'cep','cep_max','cep_gain','kWhEP/m².an'],
                ['ic',/^Ic,energie\b.*?\s(cw_NUM)\s+(cw_NUM)\s+-?\d+\s*%/,'ic_energy',null,null,'kgCO2e/m²']];
    let cepVal=null;
    for(const [,reTpl,fv,fmax,fgain,unit] of rows){
      const re=new RegExp(reTpl.source.replace(/cw_NUM/g,cw_NUM),'i'); const hit=find(re); if(!hit) continue;
      const v=cw_num(hit.m[1]), mx=cw_num(hit.m[2]); if(fv==='cep') cepVal=v;
      emit(hit.f,fv,v,'indicator-box',0.995,unit,{excerpt:hit.f.text});
      if(fmax) emit(hit.f,fmax,mx,'indicator-box',0.995,unit,{excerpt:hit.f.text});
      if(fgain&&mx) emit(hit.f,fgain,gain(v,mx),'indicator-gain-calc',0.99,'%',{derivedFromDocument:true,excerpt:hit.f.text,provenanceNote:`Gain = (exigence − valeur) / exigence, calculé sur les deux valeurs de la même ligne ClimaWin (écart ClimaWin arrondi : ${hit.m[0].match(/-?\d+\s*%$/)?.[0]}).`});
    }
    // ---- Confort d'été : groupe le plus défavorable (DH le plus élevé), DH max du même groupe ----
    let worst=null;
    for(const f of seg){ const m=f.text.match(new RegExp(`^DH de Groupe d'usage.*?\\s(${cw_NUM})\\s+(${cw_NUM})\\s+-?\\d+\\s*%$`,'i')); if(!m) continue; const dh=cw_num(m[1]), mx=cw_num(m[2]); if(!worst||dh>worst.dh) worst={dh,mx,f,count:(worst?.count||0)+1}; else worst.count++; }
    if(worst){ emit(worst.f,'dh',worst.dh,'dh-worst-group',0.99,'°C.h',{excerpt:worst.f.text,provenanceNote:`Groupe le plus défavorable parmi ${worst.count} groupe(s) du bâtiment.`}); emit(worst.f,'dh_max',worst.mx,'dh-worst-group',0.99,'°C.h',{excerpt:worst.f.text}); }
    // ---- Surface : « Enveloppe : détails par entité » (ligne bâtiment) > Σ zones > « Surface totale » ----
    let sref=null, srefLine=null;
    const sameBuilding=(label)=>canonicalBuilding(String(label).trim())===building;
    for(const f of seg){ const m=f.text.match(new RegExp(`^(Batiment\\s+.+?)\\s(${cw_NUM})\\s+${cw_NUM}\\s+${cw_NUM}\\s+${cw_NUM}\\s+${cw_NUM}\\s+${cw_NUM}\\s*%\\s+${cw_NUM}`,'i')); if(m&&sameBuilding(m[1])){ sref=cw_num(m[2]); srefLine=f; break; } }
    // ---- Zones : logements, traversant ----
    let housing=0, zoneArea=0, zoneLine=null, trav=false, nonTrav=false, zoneHits=0;
    for(const f of seg){ const m=f.text.match(new RegExp(`\\(RE2020\\)\\s*-\\s*(${cw_NUM})\\s*m².*?-\\s*(\\d+)\\s+logements?\\b.*?-\\s*(Non traversante|Traversante)`,'i')); if(m){ housing+=Number(m[2]); zoneArea+=cw_num(m[1]); zoneLine=zoneLine||f; zoneHits++; if(/^non/i.test(m[3])) nonTrav=true; else trav=true; continue; }
      const mb=f.text.match(new RegExp(`\\(RE2020\\)\\s*-\\s*(${cw_NUM})\\s*m²`,'i')); if(mb&&/Bureaux|Commerce|Enseignement|Sante/i.test(f.text)) zoneArea+=cw_num(mb[1]); }
    if(sref!==null) emit(srefLine,'shab',sref,'entity-table-sref',0.995,'m²',{excerpt:srefLine.text,provenanceNote:'Sref du bâtiment (tableau « Enveloppe : détails par entité »).'});
    else if(zoneArea>0&&zoneLine) emit(zoneLine,'shab',cw_round(zoneArea,2),'zones-sum',0.97,'m²',{derivedFromDocument:true,excerpt:zoneLine.text});
    if(zoneHits){ emit(zoneLine,'housing_count',housing,'zones-sum',0.98,'',{derivedFromDocument:zoneHits>1,excerpt:zoneLine.text,provenanceNote:`Somme des logements des ${zoneHits} zone(s) d'usage résidentielles du bâtiment.`});
      if(trav) emit(zoneLine,'cross_ventilated','Oui','zone-type',0.98,'',{excerpt:zoneLine.text}); if(nonTrav) emit(zoneLine,'non_cross_ventilated','Oui','zone-type',0.98,'',{excerpt:zoneLine.text}); }
    // ---- Production locale d'électricité (10 valeurs sur la ligne du bâtiment) ----
    for(const f of seg){ const m=f.text.match(new RegExp(`^(Batiment\\s+.+?)\\s((?:${cw_NUM}\\s+){9}${cw_NUM})$`,'i')); if(!m||!sameBuilding(m[1])) continue; const v=m[2].split(/\s+/).map(cw_num); if(v.length!==10) continue; const efPv=v[4];
      if(efPv>0){ emit(f,'enr','Oui','pv-balance',0.97,'',{excerpt:f.text,provenanceNote:`Production PV ${efPv} kWhef/m².an (bilan de la production locale d'électricité).`}); emit(f,'enr_type','Photovoltaïque','pv-balance',0.97,'',{excerpt:f.text}); }
      else if(!(v[7]>0)) { emit(f,'enr','Non','pv-balance',0.96,'',{excerpt:f.text,provenanceNote:'Bilan de production locale d\'électricité nul pour ce bâtiment (PV = 0).'}); emit(f,'enr_type','Aucun','pv-balance',0.96,'',{excerpt:f.text}); }
      if(v[7]>0) emit(f,'enr_type','Cogénération','pv-balance',0.9,'',{excerpt:f.text}); break; }
    // ---- Consommations par usage et par vecteur (colonne « Tot EP ») ----
    const vecEP={}; const useEP={}; let sawVector=new Set(); let lastLine=null;
    for(const f of seg){ const m=f.text.match(new RegExp(`^Cef (elec|gaz|fioul|bois|reseau)-(ch|fr|ecs|ecl|vent|dist|depl|mobi)\\s+((?:${cw_NUM}\\s+){12})(${cw_NUM})(?:\\s+(${cw_NUM}))?$`,'i')); if(!m) continue;
      const vec=m[1].toLowerCase(), use=m[2].toLowerCase(); const ep=m[5]!==undefined?cw_num(m[5]):null; sawVector.add(vec); lastLine=f;
      if(ep===null) continue; (useEP[use]=useEP[use]||{})[vec]=ep; if(use!=='mobi') vecEP[vec]=(vecEP[vec]||0)+ep;
      if(vec==='elec'&&cw_USAGE_FIELDS[use]) emit(f,cw_USAGE_FIELDS[use],ep,'usage-ep',0.99,'kWhEP/m².an',{excerpt:f.text,provenanceNote:`Colonne « Tot EP » de la ligne « Cef ${vec}-${use} ».`}); }
    for(const [vec,total] of Object.entries(vecEP)){ const field=cw_VECTOR_FIELD[vec]; if(field&&lastLine) emit(lastLine,field,cw_round(total,1),'vector-ep-sum',0.95,'kWhEP/m².an',{derivedFromDocument:true,excerpt:lastLine.text,provenanceNote:`Somme des « Tot EP » du vecteur ${cw_VECTOR_LABEL[vec]} (hors mobilier).`}); }
    const dominant=(use)=>{ const row=useEP[use]; if(!row) return null; const e=Object.entries(row).sort((a,b)=>b[1]-a[1]); if(!e.length||e[0][1]<=0) return null; const tot=e.reduce((s,x)=>s+x[1],0); return e[0][1]/tot>=0.7?cw_VECTOR_LABEL[e[0][0]]:'Hybride'; };
    const hv=dominant('ch'), ev=dominant('ecs');
    if(hv&&lastLine) emit(lastLine,'heating_vector_after',hv,'vector-dominant',0.93,'',{derivedFromDocument:true,excerpt:lastLine.text,provenanceNote:'Vecteur énergétique majoritaire de la ligne « Cef …-ch » (consommations importées).'});
    if(ev&&lastLine) emit(lastLine,'ecs_vector_after',ev,'vector-dominant',0.93,'',{derivedFromDocument:true,excerpt:lastLine.text,provenanceNote:'Vecteur énergétique majoritaire de la ligne « Cef …-ecs ».'});
    void cepVal;
  }
  return out;
}

// Étude présente en plusieurs versions : on garde la date d'étude la plus récente par bâtiment.
function studyDateRank(o){ const d=Date.parse(o?.studyDate||''); return Number.isFinite(d)?d:0; }

// ---------------------------------------------------------------------------
// Enveloppe : les cellules d'un tableau ClimaWin sont éclatées sur plusieurs lignes PDF. Chaque ligne
// d'« ancre » (surface + type de paroi) est entourée de ses cellules : on rattache chaque ligne à
// l'ancre la plus proche verticalement, puis on retient la paroi dominante (surface) par catégorie.
// ---------------------------------------------------------------------------
const cw_ANCHOR=/(\d+(?:\.\d+)?)\s+(Mur exterieur|Mur sur LNC|Pl\. ?bas sur sol|Pl\. ?bas sur LNC|Pl\. haut sur LNC|Pl\. haut exter\.|Rampants?)(?=\s|$)/i;
const cw_CATEGORY=t=>/^mur exterieur/i.test(t)?'wall':/bas sur sol/i.test(t)?'floor':/^pl\. ?bas sur lnc/i.test(t)?'floor_lnc':/^(?:pl\. haut|rampant)/i.test(t)?'roof':null;
function cw_sanitizeCell(s){
  return String(s).replace(/\b\d+\.\d{2,3}(?:\/\d?\.?\d*)?\b/g,' ').replace(/\b\d+(?:\.\d+)?\s*%/g,' ')
    .replace(/\(\s*\d+(?:\.\d+)?\s*cm\s*\)/gi,' ').replace(/\(\s*\d+(?:\.\d+)?(?=\s|$)/g,' ').replace(/\bcm\)/gi,' ')
    .replace(/\bR\s*=\s*[\d,.]+/gi,' ').replace(/\b\d{3,4}\s*x\s*\d{3,4}(?:\s*x\s*\d+)?\b/gi,' ').replace(/\b\d+\s*mm\b/gi,' ').replace(/\s+/g,' ').trim();
}
// Les colonnes « Type » et « Nature » (Mur extérieur, Pl. haut sur LNC, ITI…) trompent le parseur d'enveloppe :
// on les retire pour les planchers et toitures, et le libellé de catégorie garde la main.
function cw_categoryClean(cat,text){
  let t=String(text);
  if(cat==='wall') return t;
  t=t.replace(/\bPl\. ?(?:bas|haut)[^\s]*\s+sur\s+\w+/gi,' ').replace(/\bMur\s+exterieur\b/gi,' ').replace(/\bRampants?\b/gi,'rampant').replace(/\bIT[IER]\b/g,' ').replace(/\bB[eé]ton\b|\bBeton\b/g,' ').replace(/\bParpaing\b/gi,' ');
  return t.replace(/\s+/g,' ').trim();
}
// Regroupe les lignes d'un tableau en « rangées » : l'interligne intra-cellule (~3-4 pt) est très inférieur
// à l'espace entre deux rangées (≥ 8 pt) dans les tableaux ClimaWin.
function cw_clusterRows(lines,gap=7.5){
  const sorted=[...lines].sort((a,b)=>(b.line.y??0)-(a.line.y??0)||a.line.index-b.line.index); const rows=[]; let cur=null,prevY=null;
  for(const f of sorted){ const y=f.line.y??0; if(!cur||prevY-y>gap){ cur=[]; rows.push(cur); } cur.push(f); prevY=y; }
  return rows;
}
function climaWinEnvelopeLines(doc){
  const sections=climaWinBuildingSections(doc); if(!sections.length) return [];
  const flat=[]; for(const p of doc.read.pages||[]) for(const l of p.lines||[]) flat.push({page:p.page,line:l,text:String(l.text||'')});
  const posOf=s=>flat.findIndex(f=>f.page===s.page&&f.line.index===s.line);
  const out=[];
  for(let si=0;si<sections.length;si++){
    const sec=sections[si]; const from=posOf(sec), to=si+1<sections.length?posOf(sections[si+1]):flat.length; if(from<0) continue;
    const seg=flat.slice(from,to); const building=sec.name;
    const byPage=new Map(); for(const f of seg){ if(!byPage.has(f.page)) byPage.set(f.page,[]); byPage.get(f.page).push(f); }
    const opaque=[], glazed=[];
    for(const [,lines] of byPage){
      let mode=null; const hasHeader=lines.some(x=>/Enveloppe du batiment\s*:/i.test(x.text)); const regO=[], regG=[];
      for(const f of lines){
        if(/Enveloppe du batiment\s*:\s*parois opaques/i.test(f.text)){ mode='o'; continue; }
        if(/Enveloppe du batiment\s*:\s*menuiseries/i.test(f.text)){ mode='g'; continue; }
        if(/Enveloppe du batiment\s*:\s*ponts thermiques|Enveloppe\s*:\s*details/i.test(f.text)){ mode=null; continue; }
        if(/^Construction de .* Page \d+|^ClimaWin 2020|^Surface Type |^m² (?:W|\()/i.test(f.text)) continue;
        // page de continuation sans titre : le type de tableau se déduit des ancres
        const m=mode||(!hasHeader?(cw_ANCHOR.test(f.text)?'o':(/Fenetre|Porte\s+Alu/i.test(f.text)?'g':null)):null);
        if(m==='o') regO.push(f); else if(m==='g') regG.push(f);
      }
      if(!hasHeader&&regO.length===0&&regG.length===0){ for(const f of lines) { if(/^Construction de|^ClimaWin/i.test(f.text)) continue; (lines.some(x=>cw_ANCHOR.test(x.text))?regO:regG).push(f); } }
      for(const r of cw_clusterRows(regO)) opaque.push(r); for(const r of cw_clusterRows(regG)) glazed.push(r);
    }
    const rows=[];
    for(const r of opaque){
      const blob=r.map(x=>x.text).join(' '); const anchor=r.find(x=>cw_ANCHOR.test(x.text)); if(!anchor) continue; const m=anchor.text.match(cw_ANCHOR); const cat=cw_CATEGORY(m[2]); if(!cat||/coffre/i.test(blob)) continue;
      const lam=(anchor.text.match(/\s(\d\.\d{3})(?:\/|\s)/)||[])[1];
      const cms=[...blob.matchAll(/\((\d+(?:\.\d+)?)(?!\d|\.\d|\s*\)|\s*(?:mm|m²))/g)].map(x=>Number(x[1]));
      rows.push({cat,surface:Number(m[1]),blob,lambda:lam?Number(lam):null,cms,anchor});
    }
    for(const cat of ['wall','floor','roof']){
      let cand=rows.filter(r=>r.cat===cat); if(cat==='floor'&&!cand.length) cand=rows.filter(r=>r.cat==='floor_lnc'); if(!cand.length) continue;
      const r=cand.sort((a,b)=>b.surface-a.surface)[0]; const single=r.cms.length===1; const e=single?Math.round(r.cms[0]*10):null; const R=e&&r.lambda?Math.round(e/1000/r.lambda*100)/100:null;
      const label={wall:'Mur extérieur isolation',floor:'Plancher bas isolation',roof:'Toiture combles isolation'}[cat];
      out.push({building,category:cat,anchor:r.anchor,surface:r.surface,thicknessMm:e,rValue:R,text:`${label} : ${cw_categoryClean(cat,cw_sanitizeCell(r.blob))}${e?` ${e} mm`:''}`});
    }
    // --- menuiseries : vitrage et protection majoritaires (en surface) ---
    const glaz=new Map(), prot=new Map(); const matCount=new Map(); let matLine=null;
    for(const r of glazed){
      const blob=r.map(x=>x.text).join(' '); const m=blob.match(/(\d+\.\d+)\s+(Fenetre|Porte)\s+(Alu\.|PVC|Bois|Mixte)/i); if(!m||/^porte/i.test(m[2])) continue;
      const surf=Number(m[1]); const g=blob.match(/\b(DV|TV|SV)\s*([\d/]+)\s*(Argon|Air|Krypton)?/i); const gk=g?`${g[1].toUpperCase()} ${g[2]}${g[3]?' '+g[3]:''}`:null;
      if(gk) glaz.set(gk,(glaz.get(gk)||0)+surf); const pk=/Volet moto/i.test(blob)?'volet roulant motorisé':/Volet/i.test(blob)?'volet roulant':null; if(pk) prot.set(pk,(prot.get(pk)||0)+surf);
      const mk={'alu.':'aluminium',pvc:'PVC',bois:'bois',mixte:'mixte bois-alu'}[m[3].toLowerCase()]; matCount.set(mk,(matCount.get(mk)||0)+surf); matLine=matLine||r[0];
    }
    const top=m=>[...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(matLine) out.push({building,category:'window',anchor:matLine,text:`Menuiseries ${top(matCount)||''} ${top(glaz)||''} ${top(prot)||''}`.replace(/\s+/g,' ').trim()});
  }
  return out;
}

// ---------------------------------------------------------------------------
// Récapitulatif thermique d'un BE (modèle « BE ACT — Préconisations et remarques Thermique »).
// Résultats du lot (bâtiment le plus défavorable) + descriptif des systèmes. Les valeurs de performance
// sont rattachées à « Bâtiment unique » : elles ne sont jamais recopiées sur chaque bâtiment d'un lot.
// ---------------------------------------------------------------------------
function isBeActRecap(doc){
  const t=String(doc?.read?.text||'').slice(0,200000);
  return /performance\s+du\s+batiment\s+selon\s+la\s+re\s*2020/i.test(t)&&/systemes\s+principaux\s+du\s+projet|gestionnaire\s+d['’]?energie|analyse\s+thermique\s+du\s+projet|respect\s+des\s+exigences\s+de\s+moyens/i.test(t);
}
function parseBeActRecap(doc,occ){
  const out=[]; const pages=doc.read.pages||[];
  const lotM=String(doc.read.text||'').match(/Etude realisee pour le (Lot\s*\w+)/i); const lot=lotM?lotM[1]:null;
  const base={structuredPdf:true,lotLevel:true,origin:`Récapitulatif thermique BE${lot?' — '+lot:''}`,};
  const emit=(page,line,field,value,method,conf,unit='',extra={})=>{ const o=occ(doc,page,line,field,value,`recap-be:${method}`,conf,unit,{...base,...extra}); if(o) out.push(o); };
  const cw_NUMC='[-+]?\\s*\\d+(?:[.,]\\d+)?';
  const perf=[[/^Bbio projet\s*=\s*(§)\s*points\s*Bbiomax\s*=\s*(§)\s*points\s*Gain\s*=\s*(§)\s*%/i,'bbio','bbio_max','bbio_gain','points'],
              [/^Cep nr projet\s*=\s*(§)\s*kWhep\/m².*?Cep nr max\s*=\s*(§)\s*kWhep\/m².*?Gain\s*=\s*(§)\s*%/i,'cepnr','cepnr_max','cepnr_gain','kWhEP/m².an'],
              [/^Cep projet\s*=\s*(§)\s*kWhep\/m².*?Cepmax\s*=\s*(§)\s*kWhep\/m².*?Gain\s*=\s*(§)\s*%/i,'cep','cep_max','cep_gain','kWhEP/m².an']];
  for(const page of pages) for(const line of page.lines||[]){
    const t=String(line.text||'');
    for(const [reTpl,fv,fmax,fgain,unit] of perf){ const m=t.match(new RegExp(reTpl.source.replace(/§/g,cw_NUMC),'i')); if(!m) continue;
      const ex={excerpt:t,provenanceNote:`Résultat du lot${lot?' ('+lot+')':''} sur le bâtiment le plus défavorable : à attribuer au bâtiment concerné.`};
      emit(page,line,fv,cw_num(m[1]),'performance',0.97,unit,ex); emit(page,line,fmax,cw_num(m[2]),'performance',0.97,unit,ex); emit(page,line,fgain,cw_num(m[3]),'performance',0.97,'%',ex); }
  }
  const all=[]; for(const p of pages) for(const l of p.lines||[]) all.push({p,l,t:String(l.text||'')});
  const findLine=(re)=>all.find(x=>re.test(x.t));
  const rev=findLine(/Reversible\s*:\s*OUI/i); if(rev) emit(rev.p,rev.l,'cooling','PAC réversible','systems',0.96,'',{excerpt:rev.t});
  const pac=findLine(/PAC\s+AIR\/EAU/i); if(pac){ emit(pac.p,pac.l,'heating_mode_after','PAC air/eau','systems',0.96,'',{excerpt:pac.t}); emit(pac.p,pac.l,'heating_vector_after','Électricité','systems-vector',0.92,'',{derivedFromDocument:true,excerpt:pac.t,provenanceNote:'Pompe à chaleur : vecteur électrique.'}); }
  const thermo=findLine(/Ballons?\s+thermo/i), elec=findLine(/Ballons?\s+electriques?|^electriques\s+\w+|T2 et moins\s*:\s*Ballons/i);
  if(thermo) emit(thermo.p,thermo.l,'ecs','Chauffe-eau thermodynamique','systems',0.94,'',{excerpt:thermo.t});
  if(elec) emit(elec.p,elec.l,'ecs','Ballon électrique','systems',0.92,'',{excerpt:elec.t});
  if(thermo||elec) emit((thermo||elec).p,(thermo||elec).l,'ecs_vector_after','Électricité','systems-vector',0.92,'',{derivedFromDocument:true,excerpt:(thermo||elec).t});
  const vent=findLine(/Hygroreglable\s+type\s+B/i); if(vent) emit(vent.p,vent.l,'ventilation','VMC Hygro B','systems',0.95,'',{excerpt:vent.t});
  const pv=findLine(/Nombre\s*:\s*(\d+)\s*panneaux/i); if(pv){ emit(pv.p,pv.l,'enr','Oui','systems',0.95,'',{excerpt:pv.t}); emit(pv.p,pv.l,'enr_type','Photovoltaïque','systems',0.95,'',{excerpt:pv.t}); }
  const vre=findLine(/Fenetre\s+ALU\s*\+\s*VRE/i); if(vre){ emit(vre.p,vre.l,'window_material','Aluminium','windows',0.95,'',{excerpt:vre.t}); emit(vre.p,vre.l,'window_shading','Volet roulant','windows',0.93,'',{excerpt:vre.t,provenanceNote:'VRE = volet roulant électrique (type de menuiserie majoritaire).'}); }
  const gl=all.map(x=>x.t.match(/\b(\d)\s*-\s*(\d{1,2})\s*-\s*(\d)\b/)).find(Boolean); if(gl&&vre) emit(vre.p,vre.l,'window_glazing',`${gl[1]}/${gl[2]}/${gl[3]}`,'windows',0.9,'',{excerpt:vre.t});
  return out;
}

/* ---- acv-ec.js ---- */
// v2.3.4 — Notice ACV E+C- (RSEnv Pléiades / « Récapitulatif Energie Environnement »).
// Format type : notice de BET (introduction, résultats globaux) + annexe RSEnv structurée :
// « Données générales <bâtiment> », « Niveaux ENERGIE-CARBONE » (BEPOS, Eges, Eges PCE, niveaux),
// quantitatifs par contributeur (« <bâtiment> - SRT : 713.30 m2 »).
// Les valeurs de l'annexe RSEnv (sortie logiciel) priment sur les valeurs arrondies du texte de la notice.
// Les graphiques par lot sont des images : aucune valeur de lot n'est inventée.

const ec_NUM='([-+]?\\d+(?:[.,]\\d+)?)';
const ec_lineText=l=>normalizeText(l?.text||'');

function isEcAcvNotice(doc){
  const t=String(doc?.read?.text||'').slice(0,600000);
  const ec=/niveaux?\s+energie\s*-\s*carbone/i.test(t)||/recapitulatif\s+energie\s+environnement/i.test(t);
  return ec&&/eges\s*,?\s*pce/i.test(t)&&/\beges\b/i.test(t);
}

function ec_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:ec_lineText(line)}));
  return out;
}
const ec_levelNumber=s=>{ const m=String(s||'').match(/niveau\s*(\d)/i); return m?Number(m[1]):null; };

// Libellés du tableau « Données générales » : sur une ligne (« Libellé valeur ») ou coupés
// autour de la valeur (« Energie principale pour le » / « Electricite » / « chauffage »).
const ec_GENERAL_LABELS={
  structureType:'type de structure principale',
  material:'materiau principal',
  infill:'materiaux de remplissage de facade',
  floor:'type de plancher',
  ventilation:'type de ventilation principale',
  heatingEnergy:'energie principale pour le chauffage',
  ecsEnergy:"energie principale pour l'ecs",
  coolingEnergy:'energie principale pour le froid',
  heatingGen:'generateur principal pour le chauffage',
  ecsGen:"generateur principal pour l'ecs"
};
function ec_readGeneralBlock(lines){
  const found={};
  const low=lines.map(x=>x.t.toLowerCase());
  for(const [key,label] of Object.entries(ec_GENERAL_LABELS)){
    for(let i=0;i<lines.length&&!found[key];i++){
      const l=low[i];
      if(l.startsWith(label+' ')){ const v=lines[i].t.slice(label.length).trim(); if(v) found[key]={value:v,at:lines[i]}; continue; }
      if(label.startsWith(l+' ')&&i+2<lines.length){
        const rest=label.slice(l.length+1);
        if(low[i+2]===rest||low[i+2].startsWith(rest)) { const v=lines[i+1].t.trim(); if(v) found[key]={value:v,at:lines[i+1],label:lines[i]}; }
      }
    }
  }
  return found;
}

function ec_heatingMode(gen=''){
  const s=gen.toLowerCase();
  if(/pac|pompe\s+a\s+chaleur/.test(s)){
    if(/nappe|eau\s*\/\s*eau|eau\s+glycolee|sol\s*\/\s*eau|geotherm|sonde/.test(s)) return /nappe/.test(s)?'PAC eau/eau (eau de nappe)':'PAC géothermique';
    if(/air\s*\/\s*eau/.test(s)) return 'PAC air/eau';
    if(/air\s*\/\s*air/.test(s)) return 'PAC air/air';
    return 'PAC';
  }
  if(/chaudiere.*gaz|gaz.*condensation/.test(s)) return 'Chaudière gaz';
  if(/bois|granul|biomasse/.test(s)) return 'Chaudière bois';
  if(/effet\s+joule|convecteur|radiateur\s+electrique|panneau\s+rayonnant/.test(s)) return 'Effet Joule';
  if(/reseau\s+de\s+chaleur/.test(s)) return 'Réseau de chaleur';
  return null;
}
function ec_energyVector(v=''){
  const s=v.toLowerCase();
  if(/electric/.test(s)) return 'Électricité';
  if(/gaz/.test(s)) return 'Gaz';
  if(/reseau/.test(s)) return 'Réseau de chaleur';
  if(/bois|biomasse|granul/.test(s)) return 'Bois / biomasse';
  if(/fioul/.test(s)) return 'Fioul';
  return null;
}
function ec_ecsSystem(v=''){
  const s=v.toLowerCase();
  if(/thermodynamique/.test(s)) return 'Chauffe-eau thermodynamique';
  if(/instantane/.test(s)) return 'Chauffe-eau électrique instantané';
  if(/chauffe-eau\s+electrique|ballon\s+electrique|cumulus/.test(s)) return 'Ballon électrique';
  if(/solaire/.test(s)) return 'Chauffe-eau solaire';
  return null;
}
function ec_ventilationSystem(v=''){
  const s=v.toLowerCase();
  if(/double\s+flux/.test(s)) return 'VMC double flux';
  if(/hygro\w*\s*b/.test(s)) return 'VMC Hygro B';
  if(/hygro\w*\s*a/.test(s)) return 'VMC Hygro A';
  if(/simple\s+flux/.test(s)) return 'VMC simple flux';
  if(/naturelle/.test(s)) return 'Ventilation naturelle';
  return null;
}
const ec_cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;

function parseEcAcvNotice(doc,occ){
  const out=[]; const lines=ec_allLines(doc);
  const origin='Notice ACV E+C- — annexe RSEnv';
  const emit=(at,field,value,method,conf,unit='',extra={})=>{ if(!at||value===null||value===undefined||value==='') return; const o=occ(doc,at.page,at.line,field,value,`acv-ec:${method}`,conf,unit,{structuredPdf:true,origin,...extra}); if(o) out.push(o); };
  const find=re=>lines.find(x=>re.test(x.t));
  const numAfter=(re)=>{ const x=lines.find(l=>re.test(l.t)); if(!x) return null; const m=x.t.match(re); const v=m?parseFrNumber(m[1]):null; return v===null?null:{value:v,at:x}; };

  // --- Carbone : Eges PCE (contributeur Produits de construction et équipements) --------------------
  const egesPce=numAfter(new RegExp(`^Eges\\s*,?\\s*PCE\\s+${ec_NUM}\\s*$`,'i'));
  const egesTotal=numAfter(new RegExp(`^Eges\\s+${ec_NUM}\\s*$`,'i'));
  const egesPceSummary=numAfter(new RegExp(`Eges\\s*,?\\s*PCE\\s*=\\s*${ec_NUM}\\s*kg`,'i'));
  const egesSummary=numAfter(new RegExp(`(?:^|[-•]\\s*)Eges\\s*=\\s*${ec_NUM}\\s*kg`,'i'));
  const pce=egesPce||egesPceSummary;
  if(pce){
    const v=Math.round(pce.value*100)/100;
    const totalTxt=(egesTotal||egesSummary)?` Eges total (tous contributeurs) = ${Math.round((egesTotal||egesSummary).value*100)/100} kg éq.CO2/m².`:'';
    emit(pce.at,'ic_components',v,egesPce?'eges-pce':'eges-pce-summary',egesPce?0.95:0.92,'kgCO2e/m²',{
      provenanceNote:`Indicateur E+C- « Eges PCE » (Produits de construction et équipements, ACV statique sur 50 ans, kg éq.CO2/m² SDP) — équivalent E+C- de l'IC composants ; non comparable à l'Ic,composant RE2020 (ACV dynamique).${totalTxt}`});
  }

  // --- Niveaux Énergie / Carbone ------------------------------------------------------------------
  const bepos=find(/^Niveau\s+BEPOS\s+Niveau\s*\d/i);
  const carbon=find(/^Niveau\s+E\s*ges\s+Niveau\s*\d/i);
  const eLevel=bepos?ec_levelNumber(bepos.t.replace(/^Niveau\s+BEPOS/i,'')):null;
  const cLevel=carbon?ec_levelNumber(carbon.t.replace(/^Niveau\s+E\s*ges/i,'')):null;
  if(eLevel) emit(bepos,'energy_level',`E${eLevel}`,'bepos-level',0.95,'',{provenanceNote:`Niveau BEPOS du référentiel E+C- (« Niveau ${eLevel} »).`});
  if(eLevel&&cLevel) emit(carbon,'performance',`E${eLevel}C${cLevel}`,'energy-carbon-level',0.88,'',{provenanceNote:`Niveaux E+C- de l'annexe RSEnv : Énergie ${eLevel} (BEPOS), Carbone ${cLevel} (Eges). À valider : le libellé « Performance » attendu peut différer.`});

  // --- Surface de référence du RSEnv (« <bâtiment> - SRT : 713.30 m2 ») ------------------------------
  const srt=numAfter(new RegExp(`-\\s*SRT\\s*:\\s*${ec_NUM}\\s*m(?:2|²)`,'i'));
  if(srt){
    const sdp=numAfter(new RegExp(`^SDP\\s+${ec_NUM}\\s*m(?:2|²)`,'i')), srtNotice=numAfter(new RegExp(`^SRT\\s+${ec_NUM}\\s*m(?:2|²)`,'i'));
    const other=[srtNotice&&`SRT ${srtNotice.value} m² (p.${srtNotice.at.page.page})`,sdp&&`SDP ${sdp.value} m² (p.${sdp.at.page.page})`].filter(Boolean);
    const diverge=other.length&&[srtNotice,sdp].some(x=>x&&Math.abs(x.value-srt.value)>0.5);
    emit(srt.at,'shab',srt.value,'rsenv-srt',diverge?0.86:0.93,'m²',{provenanceNote:`SRT déclarée dans les quantitatifs du RSEnv.${diverge?` Le texte de la notice indique une autre surface (${other.join(', ')}) : à vérifier.`:''}`});
  }

  // --- Données générales du bâtiment (tableau RSEnv) -----------------------------------------------
  // Dernière occurrence du titre : la première est souvent l'entrée du sommaire (« ....... 12 »).
  const start=lines.map((x,i)=>/^\d+\.\s*Donnees\s+generales\b/i.test(x.t)&&!/\.{4,}|\s\d+\s*$/.test(x.t)?i:-1).filter(i=>i>=0).pop()??-1;
  if(start>=0){
    let end=lines.findIndex((x,i)=>i>start&&/niveaux?\s+energie\s*-\s*carbone/i.test(x.t)); if(end<0) end=Math.min(lines.length,start+60);
    const g=ec_readGeneralBlock(lines.slice(start,end));
    const gNote='Tableau « Données générales » de l’annexe RSEnv.';
    if(g.structureType||g.material){
      const mat=g.material?.value, typ=g.structureType?.value;
      const value=mat&&typ?`${ec_cap(mat)} (${typ.toLowerCase()})`:ec_cap(mat||typ);
      emit((g.material||g.structureType).at,'structure',value,'general-structure',0.92,'',{provenanceNote:gNote});
    }
    if(g.infill){ const v=g.infill.value.toLowerCase(); const ins=/paille/.test(v)?'Paille':/chanvre/.test(v)?'Chanvre':/laine\s+de\s+bois|fibre\s+de\s+bois/.test(v)?'Laine de bois':/ouate/.test(v)?'Ouate de cellulose':null; if(ins) emit(g.infill.at,'wall_insulation',ins,'general-infill',0.9,'',{provenanceNote:`${gNote} Matériau de remplissage de façade : ${g.infill.value}.`}); }
    if(g.floor) emit(g.floor.at,'floor_structure',ec_cap(g.floor.value),'general-floor',0.9,'',{provenanceNote:gNote});
    if(g.ventilation){ const v=ec_ventilationSystem(g.ventilation.value); if(v) emit(g.ventilation.at,'ventilation',v,'general-ventilation',0.96,'',{provenanceNote:`${gNote} ${g.ventilation.value}.`}); }
    if(g.heatingEnergy){ const v=ec_energyVector(g.heatingEnergy.value); if(v) emit(g.heatingEnergy.at,'heating_vector_after',v,'general-heating-energy',0.95,'',{provenanceNote:gNote}); }
    if(g.heatingGen){ const v=ec_heatingMode(g.heatingGen.value); if(v) emit(g.heatingGen.at,'heating_mode_after',v,'general-heating-generator',0.95,'',{provenanceNote:`${gNote} Générateur : ${g.heatingGen.value}.`}); }
    if(g.ecsEnergy){ const v=ec_energyVector(g.ecsEnergy.value); if(v) emit(g.ecsEnergy.at,'ecs_vector_after',v,'general-ecs-energy',0.95,'',{provenanceNote:gNote}); }
    if(g.ecsGen){ const v=ec_ecsSystem(g.ecsGen.value); if(v) emit(g.ecsGen.at,'ecs',v,'general-ecs-generator',0.94,'',{provenanceNote:`${gNote} Générateur ECS : ${g.ecsGen.value}.`}); }
  }

  // --- ENR : panneaux photovoltaïques saisis dans les quantitatifs (lot 13) ------------------------------
  const pvLine=lines.find(x=>/photovoltaiques?/i.test(x.t)&&/\b(?:PEP|FDES|INIES|Wc|kWc)\b/i.test(x.t));
  if(pvLine){ emit(pvLine,'enr','Oui','pv-quantities',0.93,'',{provenanceNote:'Panneaux photovoltaïques saisis dans le contributeur Composants (lot 13).'}); emit(pvLine,'enr_type','Photovoltaïque','pv-quantities',0.93,'',{provenanceNote:'Panneaux photovoltaïques saisis dans le contributeur Composants (lot 13).'}); }

  // --- Département (« Département 69 - Rhône (H1 c) ») ---------------------------------------------------
  const dep=find(/^Departement\s+(\d{2,3}|2A|2B)\s*-/i);
  if(dep){ const d=dep.t.match(/^Departement\s+(\d{2,3}|2A|2B)/i)[1].padStart(2,'0'); emit(dep,'department',d,'department',0.97,'',{provenanceNote:'Données administratives de l’opération (RSEnv).'}); }

  return out;
}

/* ---- pleiades-sortie.js ---- */
// v2.3.5 — « Sortie logiciel – Partie thermique » de Pléiades (IZUBA) : rapport RE2020 multi-bâtiments.
// Structure : « 1 Résultats RE2020 Energie » puis une section « 1.N <bâtiment> » par bâtiment
// (Bbio, Cep, Cep,nr, Ic énergie : valeur projet + max ; postes ; DH par groupe), puis
// « 5 Caractéristiques du projet » avec « 5.N <bâtiment> » (SRT déclarée, nombre de logements).
// Les noms de bâtiments sont repris des titres de section, jamais des lignes de tableau.

const pl_N='([-+]?\\d+(?:[\\s\\u00a0]\\d{3})*(?:[.,]\\d+)?)';
const pl_num=v=>{ const n=parseFrNumber(String(v??'').replace(/[\s ]/g,'')); return n===null?null:n; };
const pl_lineText=l=>normalizeText(l?.text||'');

function isPleiadesThermalOutput(doc){
  const t=String(doc?.read?.text||'').slice(0,400000);
  return /pleiades\s*,?\s*version/i.test(t)&&/resultats\s+re2020\s+energie/i.test(t)&&/exigence\s+de\s+resultat\s*:\s*bbio/i.test(t);
}

function pl_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:pl_lineText(line)}));
  return out;
}
const pl_titleName=raw=>{ const s=String(raw||'').trim(); return /^batiment\b/i.test(s)?s.replace(/^batiment/i,'Bâtiment'):s; };

// Sections « 1.N Nom » (résultats) et « 5.N Nom » (caractéristiques), dans l'ordre du document.
function pleiadesThermalSections(doc){
  const lines=pl_allLines(doc); const res=[]; const car=[];
  let chapter=null;
  lines.forEach((x,i)=>{
    const ch=x.t.match(/^(\d)\s+[A-Z]/); if(ch&&!/^\d\s+\d/.test(x.t)) chapter=Number(ch[1]);
    // Titres « 1.N Nom » ou, selon la version de Pléiades, « .N Nom » (numérotation continue sans chapitre).
    const m=x.t.match(/^([15])?\.(\d{1,2})\s+(.{2,60})$/); if(!m) return; m[1]=m[1]||String(chapter||'');
    if(/[.]{4,}|\d+\s*$/.test(m[3])) return; // sommaire
    const name=pl_titleName(m[3]);
    if(m[1]==='1'&&chapter===1) res.push({index:i,name,pl_num:Number(m[2]),page:x.page.page});
    if(m[1]==='5'&&chapter===5&&!/^environnement$/i.test(m[3])) car.push({index:i,name,pl_num:Number(m[2]),page:x.page.page});
  });
  // Chapitre 5 : ne garder que les sections qui portent le nom d'un bâtiment des résultats (pas « Systèmes de chauffage »…).
  const resNames=new Set(res.map(r=>r.name.toLowerCase()));
  return {lines,res,car:car.filter(c=>resNames.has(c.name.toLowerCase())||!res.length)};
}
function pleiadesThermalBuildingNames(doc){ const {res}=pleiadesThermalSections(doc); return [...new Set(res.map(s=>s.name))]; }

function parsePleiadesThermalOutput(doc,occ,canonical=(s)=>s){
  const out=[]; const {lines,res,car}=pleiadesThermalSections(doc);
  const origin='Pléiades — sortie logiciel RE2020 (partie thermique)';
  const emit=(x,building,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const o=occ(doc,x.page,x.line,field,value,`pleiades-sortie:${method}`,conf,unit,{building:canonical(building),structuredPdf:true,origin,...extra}); if(o) out.push(o); };
  const endOfChapter1=lines.findIndex(x=>/^2\s+Synthese\s+de\s+l'enveloppe/i.test(x.t));

  res.forEach((sec,k)=>{
    const end=k+1<res.length?res[k+1].index:(endOfChapter1>0?endOfChapter1:lines.length);
    const block=lines.slice(sec.index,end);
    const b=sec.name;
    const pair=(re)=>{ const x=block.find(l=>re.test(l.t)); if(!x) return null; const m=x.t.match(re); return {x,v:pl_num(m[1]),max:m[2]!==undefined?pl_num(m[2]):null}; };
    const bbio=pair(new RegExp(`^Besoins\\s+Bioclimatique\\s+${pl_N}\\s*points\\s+${pl_N}\\s*points`,'i'));
    if(bbio){ emit(bbio.x,b,'bbio',bbio.v,'bbio',0.995,'points'); emit(bbio.x,b,'bbio_max',bbio.max,'bbio-max',0.995,'points'); }
    const cepnr=pair(new RegExp(`^Consommation\\s+energie\\s+Primaire\\s+non\\s+renouvelable\\s+${pl_N}\\s*kWh\\s*EP\\/m²?2?\\s+${pl_N}`,'i'));
    const cep=pair(new RegExp(`^Consommation\\s+energie\\s+Primaire\\s+${pl_N}\\s*kWh\\s*EP\\/m²?2?\\s+${pl_N}`,'i'));
    if(cep){ emit(cep.x,b,'cep',cep.v,'cep',0.995,'kWhEP/m².an'); emit(cep.x,b,'cep_max',cep.max,'cep-max',0.995,'kWhEP/m².an'); }
    if(cepnr){ emit(cepnr.x,b,'cepnr',cepnr.v,'cepnr',0.995,'kWhEP/m².an'); emit(cepnr.x,b,'cepnr_max',cepnr.max,'cepnr-max',0.995,'kWhEP/m².an'); }
    const ic=pair(new RegExp(`^Indice\\s+Carbone\\s+Energie\\s+${pl_N}\\s*kg\\s*eq\\.?\\s*CO2\\s+${pl_N}`,'i'));
    if(ic){ emit(ic.x,b,'ic_energy',ic.v,'ic-energie',0.995,'kgCO2e/m²'); emit(ic.x,b,'ic_energy_max',ic.max,'ic-energie-max',0.995,'kgCO2e/m²'); }
    // Seuils Ic énergie par période (« Cible 2022 / 2025 / 2028 ») : la cible 2028 alimente « IC énergie Max 2028 ».
    const c28=block.find(l=>new RegExp(`^Cible\\s+2028\\s+${pl_N}\\s*kg`,'i').test(l.t));
    if(c28) emit(c28,b,'ic_energy_max_2028',pl_num(c28.t.match(new RegExp(`^Cible\\s+2028\\s+${pl_N}`,'i'))[1]),'ic-energie-cible-2028',0.995,'kgCO2e/m²');

    // Postes du Cep (premier bloc « Consommations de … » qui précède le total Cep, pas celui du Cep,nr).
    const cepIdx=cep?block.indexOf(cep.x):-1;
    if(cepIdx>0){
      const start=block.slice(0,cepIdx).map(l=>/^Exigence\s+de\s+resultat\s*:\s*Cep\b/i.test(l.t)).lastIndexOf(true);
      const posts=block.slice(Math.max(0,start),cepIdx);
      const map=[[/^Consommations\s+de\s+climatisation\s+/i,'cep_cooling'],[/^Consommations\s+d'eclairage\s+/i,'cep_lighting'],[/^Consommations\s+des\s+auxiliaires\s+de\s+ventilation\s+/i,'cep_aux_vent'],[/^Consommations\s+des\s+auxiliaires\s+hydrauliques\s+/i,'cep_aux_dist'],[/^Consommations\s+de\s+mobilite\s+interne\s+/i,'cep_mobility']];
      for(const [re,field] of map){ const x=posts.find(l=>re.test(l.t)); if(!x) continue; const m=x.t.replace(re,'').match(new RegExp(`^${pl_N}\\s*kWh`,'i')); if(m) emit(x,b,field,pl_num(m[1]),'cep-poste',0.99,'kWhEP/m².an'); }
    }
    // Postes Ic énergie (kg éq.CO2/m²).
    const icMap=[[/^IC\s+chauffage\s+/i,'ic_energy_heating'],[/^IC\s+climatisation\s+/i,'ic_energy_cooling'],[/^IC\s+ECS\s+/i,'ic_energy_ecs'],[/^IC\s+auxiliaires\s+de\s+ventilation\s+/i,'ic_energy_aux_vent'],[/^IC\s+auxiliaires\s+hydrauliques\s+/i,'ic_energy_aux_dist'],[/^IC\s+mobilite\s+interne\s+/i,'ic_energy_mobility']];
    for(const [re,field] of icMap){ const x=block.find(l=>re.test(l.t)); if(!x) continue; const m=x.t.replace(re,'').match(new RegExp(`^${pl_N}\\s*kg`,'i')); if(m) emit(x,b,field,pl_num(m[1]),'ic-poste',0.99,'kgCO2e/m²'); }

    // DH : groupe le plus défavorable de la section, avec son DH max.
    const dhStart=block.findIndex(l=>/^Exigence\s+de\s+resultat\s*:\s*Degres-?Heures/i.test(l.t));
    if(dhStart>=0){
      let worst=null;
      for(const l of block.slice(dhStart+1)){ const m=l.t.match(new RegExp(`^(.+?)\\s+${pl_N}\\s*°C\\.h\\s+${pl_N}\\s*°C\\.h\\s*$`,'i')); if(!m) { if(worst&&/^Exigences\s+de\s+moyens/i.test(l.t)) break; continue; } const v=pl_num(m[2]),mx=pl_num(m[3]); if(v!==null&&(!worst||v>worst.v)) worst={x:l,v,mx,group:m[1]}; }
      if(worst){ const note=`Groupe le plus défavorable : ${worst.group}.`; emit(worst.x,b,'dh',worst.v,'dh-worst-group',0.99,'°C.h',{provenanceNote:note}); emit(worst.x,b,'dh_max',worst.mx,'dh-max-worst-group',0.99,'°C.h',{provenanceNote:note}); }
    }
  });

  // Caractéristiques par bâtiment (chapitre 5).
  car.forEach((sec,k)=>{
    const end=k+1<car.length?car[k+1].index:lines.length;
    const block=lines.slice(sec.index,end); const b=sec.name;
    const srt=block.find(l=>new RegExp(`^SRT\\s+declaree\\s+${pl_N}\\s*m`,'i').test(l.t));
    if(srt&&pl_num(srt.t.match(new RegExp(`^SRT\\s+declaree\\s+${pl_N}`,'i'))[1])>0) emit(srt,b,'shab',pl_num(srt.t.match(new RegExp(`^SRT\\s+declaree\\s+${pl_N}`,'i'))[1]),'srt-declaree',0.97,'m²',{provenanceNote:'SRT déclarée du bâtiment (chapitre 5).'});
    // SRT déclarée absente ou nulle : somme des surfaces utiles des groupes (SHAB / SURT) du bâtiment.
    const srtVal=srt?pl_num(srt.t.match(new RegExp(`^SRT\\s+declaree\\s+${pl_N}`,'i'))[1]):null;
    if(!srtVal){ const grp=block.filter(l=>new RegExp(`^Surface\\s+utile\\s+du\\s+groupe\\s*\\(SHAB\\s*\\/\\s*SURT\\)\\s+${pl_N}\\s*m`,'i').test(l.t));
      if(grp.length){ const sum=grp.reduce((a,l)=>a+pl_num(l.t.match(new RegExp(`\\)\\s+${pl_N}`))[1]),0); emit(grp[0],b,'shab',Math.round(sum*100)/100,'surface-utile-groupes',grp.length>1?0.93:0.96,'m²',{provenanceNote:`Somme des surfaces utiles (SHAB / SURT) de ${grp.length} groupe(s) : la SRT déclarée est absente ou nulle.`}); } }
    const lg=block.find(l=>/^Nombre\s+de\s+logements?\s+\d+/i.test(l.t));
    if(lg) emit(lg,b,'housing_count',Number(lg.t.match(/(\d+)\s*$/)?.[1]),'nombre-logements',0.97);
    const clim=block.filter(l=>/^Climatisation\s+(?:Oui|Non)\b/i.test(l.t));
    if(clim.length){ const on=clim.filter(l=>/^Climatisation\s+Oui/i.test(l.t)); emit(on[0]||clim[0],b,'cooling',on.length?'Climatisation active':'Aucun','groupes-climatisation',on.length?0.9:0.95,'',{provenanceNote:`${clim.length} groupe(s) : ${on.length} climatisé(s).`}); }
  });

  const dep=lines.find(x=>/^Departement\s*:\s*(\d{2,3}|2A|2B)\s*-/i.test(x.t));
  if(dep){ const d=dep.t.match(/^Departement\s*:\s*(\d{2,3}|2A|2B)/i)[1].padStart(2,'0'); const o=occ(doc,dep.page,dep.line,'department',d,'pleiades-sortie:department',0.97,'',{building:'Bâtiment unique',structuredPdf:true,origin}); if(o) out.push(o); }
  return out;
}

/* ---- rset-cstb.js ---- */
// v2.3.5 — « Récapitulatif Standardisé Energie Environnement » (fiche RSET / RSEE au format CSTB,
// imprimée depuis fiche.html : Pléiades, ClimaWin, Perrenoud…). Deux parties possibles :
//  • « Partie Etude Thermique » : par bâtiment (« Bâtiment : X » puis titre « "X" ») — SRef, logements,
//    Bbio / Bbiomax / gain, Cep / Cepmax / Cep,nr / Cep,nrmax / gains, tableau DH par groupe ;
//  • « Partie Etude Environnementale » : « Indicateurs principaux, à l'échelle du bâtiment N » —
//    Ic construction (+ max), Ic énergie (+ max), Ic composant, Ic chantier, stockage carbone.
// Le texte peut provenir d'un OCR (polices sans table Unicode) : chaque couple valeur / max est
// contrôlé (valeur ≤ max) et, à défaut, la valeur part en « À vérifier ».

// Milliers séparés par une espace seulement s'ils portent une décimale (« 2 190,5 ») : dans les tableaux,
// « 631 242 178 » est une suite de trois nombres, pas un seul.
const cs_NUM_RE=/[-+]?\d{1,3}(?:[ \u00a0]\d{3})+[.,]\d+|[-+]?\d+(?:[.,]\d+)?/g;
const cs_numbers=s=>(String(s||'').match(cs_NUM_RE)||[]).map(x=>parseFrNumber(x.replace(/[ \u00a0]/g,''))).filter(v=>v!==null);
const cs_lineText=l=>normalizeText(l?.text||'');

function isCstbRseeFiche(doc){
  const t=normalizeText(String(doc?.read?.text||'').slice(0,60000));
  return /recapitulatif\s+standardise\s+energie\s+environnement/i.test(t)&&/partie\s*[«"]?\s*etude\s+(?:thermique|environnementale)/i.test(t);
}

function cs_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:cs_lineText(line)}));
  return out;
}

// Contexte bâtiment ligne par ligne (marqueurs explicites du format CSTB uniquement).
function cstbBuildingContext(doc){
  const lines=cs_allLines(doc); let current=null; let afterTech=false; let scope='building'; const names=[];
  const set=(raw)=>{ const n=String(raw||'').replace(/^["“”']+|["“”']+$/g,'').trim(); if(!n||n.length>60||/^bat\.\d/i.test(n)) return; current=n; if(!names.includes(n)) names.push(n); };
  for(const x of lines){
    let m;
    if((m=x.t.match(/pour\s+le\s+batiment\s*:\s*(.+?)\s+Conformite\b/i))) set(m[1]);
    else if((m=x.t.match(/^Batiment\s*:\s*(.+)$/i))) set(m[1]);
    else if(afterTech&&(m=x.t.match(/^["“](.+)["”]$/))) set(m[1]);
    else if((m=x.t.match(/Resultats\s+sorties\s+detaillees\s*-\s*\((.+)\)/i))) set(m[1]);
    else if((m=x.t.match(/^Nom\s+du\s+batiment\s+(.+)$/i))) set(m[1]);
    else if((m=x.t.match(/a\s+l'echelle\s+du\s+batiment\s+(\d+)\b/i))) set(`Batiment ${m[1]}`);
    afterTech=/^Donnees\s+techniques\s+du\s+batiment/i.test(x.t);
    if(/^Batiment\s*:|echelle\s+du\s+batiment|niveau\s+batiment\b/i.test(x.t)) scope='building';
    else if(/^Exigences?\s+de\s+moyens|^Chapitres\s+et\s+articles\b/i.test(x.t)) scope='requirements';
    else if(scope==='requirements'&&/^Chapitre\s+\d|^Donnees\s+techniques\s+du\s+batiment/i.test(x.t)) scope='building';
    else if(/^Generation\s*:\s*["“]|Fonctionnement\s+de\s+la\s+generation|Generation\s+commune\s+liee|^Reseaux?\s+de\s+distribution\s+intergroupe/i.test(x.t)) scope='generation';
    else if(/echelle\s+de\s+la\s+(?:zone|parcelle)|niveau\s+(?:zones?\s+de\s+batiment|parcelle)|^Chapitre\s+[67]\b/i.test(x.t)) scope='other';
    x.building=current; x.scope=scope;
  }
  return {lines,names};
}
function cstbBuildingNames(doc){ return cstbBuildingContext(doc).names; }

function parseCstbRseeFiche(doc,occ,canonical=(s)=>s){
  const out=[]; const {lines}=cstbBuildingContext(doc);
  const ocrDoc=(doc.read?.pages||[]).some(p=>p.textSource==='ocr'||p.textSource==='hybrid');
  const origin='RSET / RSEE — récapitulatif standardisé CSTB';
  const emit=(x,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined||value==='') return; const ocr=x.page.textSource==='ocr'||x.page.textSource==='hybrid'; const o=occ(doc,x.page,x.line,field,value,`cstb:${method}`,ocr?Math.min(conf,extra.ocrOk?0.93:0.86):conf,unit,{building:canonical(x.building||'Bâtiment unique'),structuredPdf:true,origin,...(ocr?{ocrDerived:true}:{}),...extra}); if(o) out.push(o); };
  const byBuilding=new Map(); for(const x of lines){ const k=x.building||''; if(!byBuilding.has(k)) byBuilding.set(k,[]); byBuilding.get(k).push(x); }

  // --- Thermique -----------------------------------------------------------------------------------
  for(const x of lines){
    let m;
    if(/^Coef\s*f?\s*i?\s*cient\s+Bbio\b/i.test(x.t)){ const n=cs_numbers(x.t.replace(/^.*?Bbio/i,'')); if(n.length>=2){ const ok=n[0]<=n[1]; emit(x,'bbio',n[0],'bbio',ok?0.995:0.8,'points',{ocrOk:ok}); emit(x,'bbio_max',n[1],'bbio-max',ok?0.995:0.8,'points',{ocrOk:ok}); if(n.length>=3) emit(x,'bbio_gain',n[2],'bbio-gain',0.99,'%',{ocrOk:ok}); } }
    if(/Cep\s*\/\s*Cepmax.{0,6}Cep\s*,?\s*nr\s*\/\s*Cep\s*,?\s*nrmax/i.test(x.t)){ const n=cs_numbers(x.t.replace(/^.*?nrmax/i,'')); if(n.length>=4){ const ok=n[0]<=n[1]&&n[2]<=n[3]&&n[2]<=n[0]; const c=ok?0.995:0.8; emit(x,'cep',n[0],'cep',c,'kWhEP/m².an',{ocrOk:ok}); emit(x,'cep_max',n[1],'cep-max',c,'kWhEP/m².an',{ocrOk:ok}); emit(x,'cepnr',n[2],'cepnr',c,'kWhEP/m².an',{ocrOk:ok}); emit(x,'cepnr_max',n[3],'cepnr-max',c,'kWhEP/m².an',{ocrOk:ok}); if(n.length>=6){ emit(x,'cep_gain',n[4],'cep-gain',0.99,'%',{ocrOk:ok}); emit(x,'cepnr_gain',n[5],'cepnr-gain',0.99,'%',{ocrOk:ok}); } } }
    if((m=x.t.match(/^SRef\s*\/\s*usage\s+principal\s+(.+?)\s*m2?\s*\//i))){ const n=cs_numbers(m[1]); if(n.length===1) emit(x,'shab',n[0],'sref-batiment',0.97,'m²',{provenanceNote:'SRef du bâtiment (données générales).'}); }
    if((m=x.t.match(/^Nombre\s+de\s+logements\s+(\d+)\s*$/i))) emit(x,'housing_count',Number(m[1]),'nombre-logements',0.97);
  }
  // Partie environnementale : « Nom du bâtiment X » → « Surface de Référence [m2] » (bâtiment) et
  // « Nombre de logement » (somme des zones du bâtiment).
  { const env=new Map();
    for(const x of lines){ if(!x.building) continue; const k=x.building; if(!env.has(k)) env.set(k,{sref:null,lgt:[],seen:false});
      const e=env.get(k); let m;
      if(/^Nom\s+du\s+batiment\b/i.test(x.t)) e.seen=true;
      if(!e.seen) continue;
      if(!e.sref&&(m=x.t.match(/^Surface\s+de\s+Reference\s*\[m[2²?]?\]\s+(.+)$/i))){ const n=cs_numbers(m[1]); if(n.length===1) e.sref={x,v:n[0]}; }
      if((m=x.t.match(/^Nombre\s+de\s+logement\s+(\d+)\s*$/i))) e.lgt.push({x,v:Number(m[1])});
      if(/^Chapitre\s+3\b/i.test(x.t)) e.seen=false; }
    for(const e of env.values()){
      if(e.sref&&!out.some(o=>o.field==='shab'&&o.building===canonical(e.sref.x.building))) { const plaus=e.sref.v>0&&e.sref.v<=50000; emit(e.sref.x,'shab',e.sref.v,'sref-rsenv',plaus?0.96:0.7,'m²',{ocrOk:plaus,provenanceNote:plaus?'Surface de référence du bâtiment (RSEnv).':'Surface de référence peu plausible (séparateur décimal perdu ?) : à vérifier.'}); }
      if(e.lgt.length&&!out.some(o=>o.field==='housing_count'&&o.building===canonical(e.lgt[0].x.building))) emit(e.lgt[0].x,'housing_count',e.lgt.reduce((a,l)=>a+l.v,0),'logements-rsenv',0.95,'',{ocrOk:true,provenanceNote:`Somme des logements de ${e.lgt.length} zone(s).`});
    } }
  // Tableau DH : lignes « Oui|Non SRef DH h1 h2 h3 Conforme » → groupe le plus défavorable du bâtiment.
  for(const [b,ls] of byBuilding){
    if(!b) continue; let worst=null;
    for(const x of ls){ const m=x.t.match(/(?:^|\s)(?:Oui|Non)\s+([\d ,.]+?)\s+(?:Non\s+)?Conforme\b/i); if(!m) continue; const n=cs_numbers(m[1]); if(n.length<5) continue; const dh=n[1]; if(!worst||dh>worst.dh) worst={x,dh}; }
    if(worst){ emit(worst.x,'dh',worst.dh,'dh-worst-group',0.98,'°C.h',{provenanceNote:'Groupe le plus défavorable du tableau DH.'});
      const lim=ls.find(x=>/Le\s+DH\s+max\s+est\s+de\s+\d+/i.test(x.t)); const v=lim?Number(lim.t.match(/DH\s+max\s+est\s+de\s+(\d+)/i)[1]):null;
      if(v) emit(lim,'dh_max',v,'dh-max-texte',0.86,'°C.h',{reviewCap:0.86,provenanceNote:'DH max rappelé dans le texte (catégorie de contrainte extérieure 1) : à confirmer pour le groupe le plus défavorable.'}); }
  }

  // --- Seuils par période (RSEnv 2024+) : « Icconstruction Icconstruction_max Icconstruction_max_2022 … _2031 »
  //     puis, sur la ligne suivante, les valeurs dans le même ordre (idem pour Icenergie).
  lines.forEach((x,i)=>{
    const head=x.t.match(/^(Ic\s*construction|Ic\s*energie)\s+(Ic\s*(?:construction|energie)_max(?:\s+Ic\s*(?:construction|energie)_max_\d{4})*)\s*$/i); if(!head) return;
    const kind=/construction/i.test(head[1])?'construction':'energy';
    const cols=[kind,...head[2].split(/\s+(?=Ic)/i).map(c=>{ const y=c.match(/_(\d{4})$/); return y?`max_${y[1]}`:'max'; })];
    const vx=lines[i+1]; if(!vx) return; const v=cs_numbers(vx.t); if(v.length!==cols.length) return;
    const base=kind==='construction'?'ic_construction':'ic_energy';
    cols.forEach((c,k)=>{
      const field=c===kind?base:c==='max'?`${base}_max`:c==='max_2028'?`${base}_max_2028`:null; if(!field) return;
      emit(vx,field,v[k],`seuils-${kind}`,0.99,'kgCO2e/m²',{ocrOk:true,provenanceNote:`Tableau « Respect des ${kind==='construction'?'Icconstruction':'Icenergie'}_max » (valeur, max, max 2022/2025/2028${kind==='construction'?'/2031':''}).`});
    });
  });

  // --- Environnement -------------------------------------------------------------------------------
  const unitTail=(t)=>{ const i=t.search(/\]|m[²2°?]\s*\]?|\/m\b/); return i>=0?t.slice(i):t; };
  for(const [b,ls] of byBuilding){
    ls.forEach((x,i)=>{
      const t=x.t; if(x.scope!=='building') return; if(/par\s+occupant|annualis|parcelle|_?DED\b/i.test(t)) return;
      const next=ls[i+1]?.t||'';
      const isCons=/contribution\s*construction|\bI\s*c\s*_?\s*construction\b/i.test(t)&&!/valeur\s+maximale|inferieure|egale/i.test(t);
      const isEne=/contribution\s*[eé]nergie|\bI\s*c\s*_?\s*[eé]nergie\b/i.test(t)&&!/valeur\s+maximale|inferieure|egale|annualis/i.test(t);
      if(!isCons&&!isEne) return;
      // Les valeurs suivent l'unité entre crochets ([kgéq. CO2/m²]) ; sinon elles sont sur la ligne suivante.
      const afterUnit=(s)=>{ const k=s.indexOf(']'); return k>=0?cs_numbers(s.slice(k+1)):[]; };
      let src=x, n=afterUnit(t.replace(/CO\s*[2z₂]/gi,'CO'));
      if(!n.length&&/\[/.test(next)){ src=ls[i+1]; n=afterUnit(next.replace(/CO\s*[2z₂]/gi,'CO')); }
      if(!n.length) return;
      // « … [kgeq.CO2/m²] 532,36 max » : le max est le premier nombre de la ligne suivante.
      if(n.length===1&&/\bmax\s*$/i.test(src.t)){ const nx=ls[ls.indexOf(src)+1]; const m2=nx?cs_numbers(nx.t):[]; if(m2.length===1) n=[n[0],m2[0]]; }
      const v=n[0], mx=n.length>=2?n[1]:null, ok=(mx===null||v<=mx)&&v>=5;
      const f=isCons?'ic_construction':'ic_energy'; const fm=isCons?'ic_construction_max':'ic_energy_max';
      if(out.some(o=>o.field===f&&o.building===canonical(b))) return;
      emit(src,f,v,isCons?'ic-construction':'ic-energie',ok?0.98:0.75,'kgCO2e/m²',{ocrOk:ok,provenanceNote:ok?'':'Valeur supérieure au max lu : lecture à vérifier.'});
      if(mx!==null) emit(src,fm,mx,isCons?'ic-construction-max':'ic-energie-max',ok?0.98:0.75,'kgCO2e/m²',{ocrOk:ok});
    });
    for(const x of ls){
      let m; if(x.scope!=='building') continue;
      if(/^Composant\s*-\s*\/?\s*I?c\s*_?\s*composant/i.test(x.t)){ const n=cs_numbers(unitTail(x.t).replace(/CO\s*[2z₂]/gi,'CO')); if(n.length) emit(x,'ic_components',n[0],'ic-composant',0.97,'kgCO2e/m²',{ocrOk:true}); }
      if(/^Chantier\s*-\s*\/?\s*I?c\s*_?\s*chantier/i.test(x.t)){ const n=cs_numbers(unitTail(x.t).replace(/CO\s*[2z₂]/gi,'CO')); if(n.length) emit(x,'ic_site',n[0],'ic-chantier',0.97,'kgCO2e/m²',{ocrOk:true}); }
      if((m=x.t.match(/^Indicateur\s+de\s+stockage\s+Carbone\s*\[[^\]]*\]\s*([\d ,.]+)$/i))){ const n=cs_numbers(m[1]); if(n.length===1) emit(x,'stock_c_per_m2',n[0],'stockage-carbone',0.93,'kgC/m²',{ocrOk:true,provenanceNote:'Indicateur de stockage carbone du bâtiment (kgC/m²).'}); }
    }
  }
  // Contrôle croisé : Ic construction = Ic composant + Ic chantier (à 1 % près) → lecture confirmée, même en OCR.
  const byB=new Map(); for(const o of out){ if(!byB.has(o.building)) byB.set(o.building,{}); byB.get(o.building)[o.field]=o; }
  for(const g of byB.values()){
    const c=g.ic_construction,k=g.ic_components,ch=g.ic_site; if(!c||!k||!ch) continue;
    if(Math.abs(c.value-(k.value+ch.value))<=Math.max(0.5,c.value*0.01)) for(const o of [c,k,ch,g.ic_construction_max].filter(Boolean)) if(o.confidence<0.97&&(o!==g.ic_construction_max||o.value>=c.value)){ o.confidence=0.97; o.provenanceNote=[o.provenanceNote,'Cohérence vérifiée : Ic construction = Ic composant + Ic chantier.'].filter(Boolean).join(' '); }
  }
  return out;
}

// v2.3.5 — Rapport de simulation thermique dynamique (STD, confort d'été) : ce n'est pas une étude
// réglementaire. Seules les dispositions de la variante de base sont lues ; les variantes étudiées
// (rafraîchissement adiabatique, détente directe, BSO sur toutes les façades…) ne sont jamais reprises.
function isStdReport(doc){
  const t=normalizeText(String(doc?.read?.text||'').slice(0,30000));
  return /simulation\s+thermique\s+dynamique|rapport\s+de\s+simulation\s+dynamique/i.test(t)&&/confort\s+d'ete|inconfort/i.test(t);
}
function parseStdReport(doc,occ){
  const out=[]; const lines=cs_allLines(doc);
  const origin='Simulation thermique dynamique (confort d’été) — variante de base';
  const emit=(x,field,value,method,conf,note)=>{ const o=occ(doc,x.page,x.line,field,value,`std:${method}`,conf,'',{structuredPdf:true,origin,provenanceNote:note}); if(o) out.push(o); };
  const variantsAt=lines.findIndex(x=>/variantes?\s+etudiees/i.test(x.t)&&!/\.{4,}/.test(x.t));
  const base=variantsAt>=0?lines.slice(0,variantsAt):lines;
  const v0=variantsAt>=0?(()=>{ const i=lines.findIndex((x,k)=>k>variantsAt&&/V0\s*:\s*variante\s+de\s+base/i.test(x.t)); if(i<0) return []; const j=lines.findIndex((x,k)=>k>i&&/^\d+(?:\.\d+)+\s+V\d\s*:/i.test(x.t)); return lines.slice(i,j>0?j:i+40); })():[];
  const noCool=lines.find(x=>/pas\s+envisage\s+de\s+rafraichir|sans\s+(?:systeme\s+de\s+)?rafraichissement\s+actif/i.test(x.t));
  const noCoolNext=noCool?null:lines.find((x,i)=>/n'est\s+pas\s+envisage\s+de$/i.test(x.t)&&/rafraichi/i.test(lines[i+1]?.t||''));
  if(noCool||noCoolNext) emit(noCool||noCoolNext,'cooling','Aucun','no-active-cooling',0.9,'La STD indique qu’aucun rafraîchissement actif n’est envisagé (variantes de rafraîchissement non retenues).');
  const bso=v0.find(x=>/brise\s*-?\s*soleil\s+orientable|\bBSO\b/i.test(x.t))||base.find(x=>/protections?\s+solaires?\s+mobiles?/i.test(x.t));
  if(bso) emit(bso,'window_shading','BSO','base-variant-shading',0.88,'Protections solaires de la variante de base de la STD.');
  const triple=base.find(x=>/triples?\s+vitrages?/i.test(x.t));
  if(triple) emit(triple,'window_glazing','Triple vitrage','glazing-hypothesis',0.86,'Hypothèse de vitrage de la STD (à confirmer par la notice thermique).');
  const cta=base.find(x=>/\bCTA\b/.test(x.t));
  if(cta) emit(cta,'ventilation','CTA','ventilation-hypothesis',0.85,'Ventilation mécanique par CTA citée dans les hypothèses de la STD.');
  return out;
}

/* ---- notice-carbone.js ---- */
// v2.3.6 — Notice carbone RE2020 de bureau d'études (ex. « Analyse du cycle de vie », éventuellement BBCA) :
// une section « N EVALUATION DU BILAN CARBONE – BATIMENT X (CAGE n) » par bâtiment avec
//  • le tableau « Evaluation projet / Seuils RE2020 » (Ic construction et Ic énergie + seuils),
//  • la calculette par lot (« 1.VRD … », « 2.1. Fondations … », « Ic Composants = »,  « Ic Chantier = »),
//  • les postes Ic énergie (« Chauffage 114 », « ECS 65 »…), et la ligne « Ic-Energie 214 ».
// Les seuils sont rangés dans « Max 2028 » quand la notice déclare viser le seuil 2028, sinon dans « Max ».

const nc_lineText=l=>normalizeText(l?.text||'');
const nc_num=s=>{ const m=String(s||'').match(/[-+]?\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|[-+]?\d+(?:[.,]\d+)?/); return m?parseFrNumber(m[0].replace(/[  ]/g,'')):null; };

function isCarbonNoticeRe2020(doc){
  const t=String(doc?.read?.text||'').slice(0,800000);
  return /evaluation\s+du\s+bilan\s+carbone\s*[–-]\s*batiment/i.test(t)&&/ic\s*-?\s*construction/i.test(t);
}

function nc_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:nc_lineText(line)}));
  return out;
}
const nc_cleanName=s=>String(s||'').replace(/\(\s*cage\s*\d+\s*\)/i,'').replace(/\s+/g,' ').trim();

function carbonNoticeSections(doc){
  const lines=nc_allLines(doc); const secs=[];
  lines.forEach((x,i)=>{
    const m=x.t.match(/^\d+\s+EVALUATION\s+DU\s+BILAN\s+CARBONE\s*[–-]\s*BATIMENT\s*(.*)$/i); if(!m||/\.{4,}/.test(x.t)) return;
    let name=m[1].trim(); if(!name||name.length<3) name=lines[i+1]?.t||'';
    name=nc_cleanName(name); if(name) secs.push({index:i,name:`Batiment ${name}`});
  });
  return {lines,secs};
}
function carbonNoticeBuildingNames(doc){ return [...new Set(carbonNoticeSections(doc).secs.map(s=>s.name))]; }

function parseCarbonNoticeRe2020(doc,occ,canonical=(s)=>s){
  const out=[]; const {lines,secs}=carbonNoticeSections(doc);
  const target2028=lines.some(x=>/seuils?\s+2028/i.test(x.t));
  const origin='Notice carbone RE2020 (bureau d’études)';
  const emit=(x,b,field,value,method,conf,unit='kgCO2e/m²',extra={})=>{ if(!x||value===null||value===undefined) return; const o=occ(doc,x.page,x.line,field,value,`notice-carbone:${method}`,conf,unit,{building:canonical(b),structuredPdf:true,origin,...extra}); if(o) out.push(o); };
  secs.forEach((sec,k)=>{
    const block=lines.slice(sec.index,k+1<secs.length?secs[k+1].index:lines.length); const b=sec.name;
    const find=re=>block.find(l=>re.test(l.t));
    // Tableau de synthèse : « max 519 565 -8% » (construction) puis « 214 284 -25% » (énergie).
    const consIdx=block.findIndex(l=>/^Seuil\s+IC\s+Construction/i.test(l.t)); const eneIdx=block.findIndex(l=>/^Seuil\s+IC\s+Energie/i.test(l.t));
    const triple=(from,to)=>{ for(const l of block.slice(Math.max(0,from),Math.max(from+1,to))){ const m=l.t.match(/(?:^|max\s+)([\d ,.]+?)\s+([\d ,.]+?)\s+[-+]?\d+\s*%/i); if(m) return {l,v:nc_num(m[1]),max:nc_num(m[2])}; } return null; };
    const cons=consIdx>=0?triple(consIdx,consIdx+4):null, ene=eneIdx>=0?triple(eneIdx,eneIdx+4):null;
    const maxField=target2028?'_max_2028':'_max';
    const note=target2028?'Seuil indiqué par la notice, qui vise la RE2020 seuil 2028.':'Seuil indiqué par la notice (période non précisée).';
    if(cons){ emit(cons.l,b,'ic_construction',cons.v,'synthese-ic-construction',0.97); emit(cons.l,b,`ic_construction${maxField}`,cons.max,'seuil-ic-construction',target2028?0.95:0.88,'kgCO2e/m²',{provenanceNote:note}); }
    if(ene){ emit(ene.l,b,'ic_energy',ene.v,'synthese-ic-energie',0.97); emit(ene.l,b,`ic_energy${maxField}`,ene.max,'seuil-ic-energie',target2028?0.95:0.88,'kgCO2e/m²',{provenanceNote:note}); }
    // Calculette : Ic composants / chantier / construction et lots.
    const eq=(re)=>{ const l=find(re); return l?{l,v:nc_num(l.t.replace(re,''))}:null; };
    const comp=eq(/^Ic\s+Composants\s*=\s*/i), site=eq(/^Ic\s+Chantier\s*=\s*/i), ic=eq(/^Ic\s+Construction\s*=\s*/i);
    if(comp) emit(comp.l,b,'ic_components',comp.v,'ic-composants',0.97);
    if(site) emit(site.l,b,'ic_site',site.v,'ic-chantier',0.97);
    if(ic&&!cons) emit(ic.l,b,'ic_construction',ic.v,'ic-construction',0.97);
    const lots={}; let firstLotLine=null;
    for(const l of block){ const m=l.t.match(/^(\d{1,2})\.(?:(\d)\.?)?\s*[A-Za-z].*?\s([-+]?\d+(?:[.,]\d+)?)$/); if(!m) continue; const lot=Number(m[1]); if(lot<1||lot>13) continue; const v=parseFrNumber(m[3]); if(v===null) continue; lots[lot]=(lots[lot]||0)+v; firstLotLine=firstLotLine||l; if(lot===13) break; }
    const lotSum=Object.values(lots).reduce((a,v)=>a+v,0);
    const lotsOk=comp&&Object.keys(lots).length>=10&&Math.abs(lotSum-comp.v)<=Math.max(2,comp.v*0.02);
    for(const [lot,v] of Object.entries(lots)) emit(firstLotLine,b,`ic_lot_${lot}`,Math.round(v*100)/100,'calculette-lot',lotsOk?0.95:0.86,'kgCO2e/m²',{provenanceNote:lotsOk?'Calculette par lot (Σ lots = Ic composants).':'Calculette par lot : somme non vérifiée.'});
    // Postes Ic énergie (calculette « Exploitation maîtrisée »).
    const posts=[[/^Chauffage\s+/i,'ic_energy_heating'],[/^Refroidissement\s+/i,'ic_energy_cooling'],[/^ECS\s+/i,'ic_energy_ecs'],[/^Auxiliaires\s+de\s+distribution\s+/i,'ic_energy_aux_dist'],[/^Auxiliaires\s+de\s+ventilation\s+/i,'ic_energy_aux_vent'],[/^Deplacements?\s+des\s+occupants/i,'ic_energy_mobility']];
    const expl=block.findIndex(l=>/Exploitation\s+Maitrisee/i.test(l.t));
    if(expl>=0) for(const [re,field] of posts){ const l=block.slice(expl).find(x=>re.test(x.t)&&/\s[-+]?\d+(?:[.,]\d+)?$/.test(x.t)); if(l) emit(l,b,field,nc_num(l.t.match(/([-+]?\d+(?:[.,]\d+)?)$/)[1]),'calculette-poste',0.93); }
  });
  // Mention BBCA visée.
  const bbca=lines.find(x=>/labelisation\s+(?:du\s+projet\s+)?BBCA|label\s+BBCA/i.test(x.t));
  if(bbca){ const o=occ(doc,bbca.page,bbca.line,'mention_bbca','Oui','notice-carbone:bbca',0.9,'',{building:'Bâtiment unique',origin,provenanceNote:'Labellisation BBCA visée par la notice carbone.'}); if(o) out.push(o); }
  return out;
}

/* ---- notice-thermique.js ---- */
// v2.3.6 — Notice thermique RE2020 de bureau d'études avec tableaux de synthèse en colonnes par bâtiment :
//   « POSTE | BATIMENT CENTRAL | BATIMENT NORD | BATIMENT SUD » puis « BBIO 56,40 59,00 62,20 », « CEP_MAX … »,
//   « CEP,NR … », « ICENERGIE … », « GAIN … % » (selon le tableau), « Nombre total des logements 37 14 10 »,
//   « Surface habitable totale (Sref) 2521,3 m² … », DH par bâtiment (« GROUPE CHAUFFE 412,90 1250 »).
// Les colonnes sont associées aux bâtiments de l'en-tête, dans l'ordre : aucune valeur n'est recopiée d'un bâtiment à l'autre.
// Notice « label bâtiment biosourcé » : seule la démarche de labellisation est relevée (les tableaux FDES ne décrivent pas le projet).

const nt_lineText=l=>normalizeText(l?.text||'');
const nt_nums=s=>(String(s||'').match(/[-+]?\d+(?:[.,]\d+)?/g)||[]).map(x=>parseFrNumber(x)).filter(v=>v!==null);

function isThermalNoticeColumns(doc){
  const t=String(doc?.read?.text||'').slice(0,400000);
  return /note\s*thermique|notice\s+thermique/i.test(t)&&/poste\s+batiment\s+\S+\s+batiment\s+\S+/i.test(t)&&/\bbbio\b/i.test(t);
}
function isBiosourcedLabelNotice(doc){
  const t=String(doc?.read?.text||'').slice(0,200000);
  return /label\s+batiment\s+biosource/i.test(t)&&/masse\s+(?:de\s+)?(?:carbone\s+biogenique|matiere\s+biosourcee)/i.test(t);
}

function nt_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:nt_lineText(line)}));
  return out;
}
// En-tête « POSTE BATIMENT A BATIMENT B … » ou « BATIMENT A BATIMENT B … » (noms d'un mot).
function nt_header(t){
  const s=t.replace(/^POSTE\s+/i,'');
  if(!/^BATIMENT\s+\S+(?:\s+BATIMENT\s+\S+)+\s*$/i.test(s)) return null;
  return s.split(/\s*BATIMENT\s+/i).map(x=>x.trim()).filter(Boolean);
}
function thermalNoticeBuildingNames(doc){
  for(const x of nt_allLines(doc)){ const h=nt_header(x.t); if(h&&h.length>=2) return h.map(n=>`Batiment ${n}`); }
  return [];
}

function parseThermalNoticeColumns(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=nt_allLines(doc);
  const origin='Notice thermique RE2020 — tableaux de synthèse par bâtiment';
  const emit=(x,b,field,value,method,conf,unit='',extra={})=>{ if(!x||value===null||value===undefined) return; const o=occ(doc,x.page,x.line,field,value,`notice-thermique:${method}`,conf,unit,{building:canonical(`Batiment ${b}`),structuredPdf:true,origin,...extra}); if(o) out.push(o); };
  let names=null, table='', gainDone=new Set();
  const ROWS={
    bbio:[[/^BBIO\s/i,'bbio','points'],[/^BBIO_?MAX\s/i,'bbio_max','points'],[/^GAIN\s/i,'bbio_gain','%']],
    cep:[[/^CEP\s/i,'cep','kWhEP/m².an'],[/^CEP_?MAX\s/i,'cep_max','kWhEP/m².an'],[/^GAIN\s/i,'cep_gain','%'],[/^REFROIDISSEMENT\s/i,'cep_cooling','kWhEP/m².an'],[/^ECLAIRAGE\s/i,'cep_lighting','kWhEP/m².an'],[/^AUX\.?\s*DE\s+DISTRIBUTION\s/i,'cep_aux_dist','kWhEP/m².an'],[/^AUX\.?\s*DE\s+VENTILATION\s/i,'cep_aux_vent','kWhEP/m².an'],[/^ASCENSEUR/i,'cep_mobility','kWhEP/m².an']],
    cepnr:[[/^CEP\s*,\s*NR\s/i,'cepnr','kWhEP/m².an'],[/^CEP\s*,\s*NR_?MAX\s/i,'cepnr_max','kWhEP/m².an'],[/^GAIN\s/i,'cepnr_gain','%']],
    ic:[[/^ICENERGIE\s/i,'ic_energy','kgCO2e/m²'],[/^ICENERGIE_?MAX\s/i,'ic_energy_max','kgCO2e/m²']]
  };
  for(let i=0;i<lines.length;i++){
    const x=lines[i], t=x.t;
    if(/BESOINS\s+BIOCLIMATIQUES/i.test(t)) table='bbio';
    else if(/ENERGIE\s+PRIMAIRE\s+NON\s+RENOUVELABLE|\(CEP\s*,\s*NR/i.test(t)) table='cepnr';
    else if(/CONSOMMATIONS\s+D'ENERGIE\s+PRIMAIRE|\(CEP\s+EN/i.test(t)) table='cep';
    else if(/ICENERGIE\s+EN|CHANGEMENT\s+CLIMATIQUE\s+DES\s+CONSOMMATIONS/i.test(t)) table='ic';
    else if(/RESULTATS?\s+BBIO\s+RT\s*2012|PARTIE\s+COMMERCES/i.test(t)) table='';
    const h=nt_header(t); if(h&&h.length>=2){ names=h; continue; }
    if(!names||!table) continue;
    for(const [re,field,unit] of ROWS[table]){
      if(!re.test(t)) continue;
      if(field.endsWith('_gain')&&gainDone.has(field)) continue;
      const v=nt_nums(t.replace(re,' ')); if(v.length!==names.length) continue;
      names.forEach((n,k)=>emit(x,n,field,v[k],`${table}-colonnes`,0.97,unit));
      if(field.endsWith('_gain')) gainDone.add(field);
      break;
    }
  }
  // Données générales : « BATIMENT HABITATION COLLECTIVE CENTRAL NORD SUD » puis logements / Sref.
  const gi=lines.findIndex(x=>/^BATIMENT\s+HABITATION\s+COLLECTIVE\s+(.+)$/i.test(x.t));
  if(gi>=0){
    const cols=lines[gi].t.replace(/^BATIMENT\s+HABITATION\s+COLLECTIVE\s+/i,'').split(/\s+/).filter(Boolean);
    for(const x of lines.slice(gi+1,gi+8)){
      if(/^Nombre\s+total\s+des\s+logements/i.test(x.t)){ const v=nt_nums(x.t); if(v.length===cols.length) cols.forEach((n,k)=>emit(x,n,'housing_count',v[k],'logements-colonnes',0.97)); }
      if(/^Surface\s+habitable\s+totale/i.test(x.t)){ const v=nt_nums(x.t.replace(/^.*?\)/,'')); if(v.length===cols.length) cols.forEach((n,k)=>emit(x,n,'shab',v[k],'sref-colonnes',0.97,'m²')); }
    }
  }
  // DH : « BATIMENT X » seul sur sa ligne, puis lignes de groupes « … DH DH_MAX ✓ ».
  for(let i=0;i<lines.length;i++){
    const m=lines[i].t.match(/^BATIMENT\s+(\S+)\s*$/i); if(!m) continue;
    let worst=null;
    for(const y of lines.slice(i+1,i+12)){ if(/^BATIMENT\s+\S+\s*$/i.test(y.t)) break; const g=y.t.match(/^(.+?)\s+([\d.,]+)\s+(\d{3,4})\s*✓?\s*$/); if(g&&!/^DH\b|GROUPE\s+DH/i.test(y.t)){ const dh=parseFrNumber(g[2]),mx=Number(g[3]); if(dh!==null&&(!worst||dh>worst.dh)) worst={y,dh,mx,group:g[1]}; } }
    if(worst&&lines.slice(i+1,i+4).some(y=>/DH\s*\(/i.test(y.t))){ emit(worst.y,m[1],'dh',worst.dh,'dh-groupe',0.97,'°C.h',{provenanceNote:`Groupe : ${worst.group}.`}); emit(worst.y,m[1],'dh_max',worst.mx,'dh-max-groupe',0.97,'°C.h'); }
  }
  // Ventilation par bâtiment : « … hygroréglable type B … Localisation : tous les logements … bâtiment X ».
  lines.forEach((x,i)=>{
    const m=x.t.match(/^Localisation\s*:.*batiment\s+(\S+)\s*$/i); if(!m) return;
    const ctx=lines.slice(Math.max(0,i-8),i).map(y=>y.t).join(' ');
    const v=/hygro\w*\s+type\s+B/i.test(ctx)?'VMC Hygro B':/hygro\w*\s+type\s+A/i.test(ctx)?'VMC Hygro A':/double\s+flux/i.test(ctx)?'VMC double flux':/simple\s+flux|autoreglable/i.test(ctx)?'VMC simple flux':null;
    if(v&&/ventilation|VMC|extracteur/i.test(ctx)) emit(x,m[1],'ventilation',v,'ventilation-localisation',0.93);
  });
  return out;
}

function parseBiosourcedLabelNotice(doc,occ){
  const lines=nt_allLines(doc);
  const x=lines.find(y=>/label\s+batiment\s+biosource/i.test(y.t)); if(!x) return [];
  const lvl=x.t.match(/niveau\s+(\d)\s+du\s+label\s+2012/i);
  const out=[occ(doc,x.page,x.line,'mention_biosourced_building','Oui','biosource:label-vise',0.92,'',{building:'Bâtiment unique',structuredPdf:true,origin:'Notice label bâtiment biosourcé',provenanceNote:'Estimation des quantités de matières biosourcées pour le label Bâtiment Biosourcé.'})];
  if(lvl) out.push(occ(doc,x.page,x.line,'biosourced_2013',`Niveau ${lvl[1]}`,'biosource:niveau-2012',0.88,'',{building:'Bâtiment unique',structuredPdf:true,origin:'Notice label bâtiment biosourcé',provenanceNote:`Objectif « niveau ${lvl[1]} du label 2012 » cité par la notice.`}));
  return out.filter(Boolean);
}

/* ---- pleiades-rapports.js ---- */
// v2.3.7 — Autres éditions Pléiades (IZUBA) :
//  • « Rapport ACV » / « Récapitulatif du calcul réglementaire — Partie Environnement » : par bâtiment
//    (« Données générales Bâtiment 2 »), lignes « Ic construction max 2028 kg eq CO2/m² 624.37 ».
//    Les blocs « Zone Zone 2 » répètent les mêmes indicateurs à l'échelle de la zone : ignorés.
//  • « Tableau de synthèse des prestations thermiques » : tableau Résultats
//    « 62,2 / 71,5 points 83,9 / 89,4 kWh EP/m² 16,1 / 73,6 kWh EP/m² 82.75 / 588.8 kg eq. CO2 » puis « Bâtiment 1 ».
//  • « Synthèse des déperditions (NF EN 12831) » : calcul de puissance, aucune donnée du référentiel ExtracTerre
//    (seul le département est relevé) — évite les faux bâtiments et valeurs parasites.

const pr_lineText=l=>normalizeText(l?.text||'');
const pr_nums=s=>(String(s||'').match(/[-+]?\d+(?:[.,]\d+)?/g)||[]).map(x=>parseFrNumber(x)).filter(v=>v!==null);
function pr_allLines(doc){
  const out=[];
  for(const page of doc.read?.pages||[]) (page.lines||[]).forEach((line,pos)=>out.push({page,line,pos,t:pr_lineText(line)}));
  return out;
}

function isPleiadesAcvReport(doc){
  const t=String(doc?.read?.text||'').slice(0,300000);
  return /Ic\s+construction\s+max\s+20\d\d\s+kg\s+eq\s+CO2\/m/i.test(t)&&/Donnees\s+generales\s+Batiment|Indicateurs\s+de\s+performance/i.test(t);
}
function isPleiadesServicesSummary(doc){
  const t=String(doc?.read?.text||'').slice(0,200000);
  return /Tableau\s+de\s+synthese\s+des\s+prestations\s+thermiques/i.test(t);
}
function isHeatLossReport(doc){
  const t=String(doc?.read?.text||'').slice(0,60000);
  return /deperditions\s+suivant\s+la\s+norme\s+(?:EN\s+)?12831/i.test(t);
}
function pleiadesReportBuildingNames(doc){
  const names=[];
  for(const x of pr_allLines(doc)){
    let m;
    if(isPleiadesAcvReport(doc)&&(m=x.t.match(/^Donnees\s+generales\s+(Batiment\s+.+)$/i))) names.push(m[1].trim());
    if(isPleiadesServicesSummary(doc)&&(m=x.t.match(/^(Batiment\s+\S+)\s+(?:Conforme|Non\s+conforme)\b/i))) names.push(m[1].trim());
    if(isHeatLossReport(doc)&&(m=x.t.match(/^Batiment\s+(Batiment\s+\S+)\s*$/i))) names.push(m[1].trim());
  }
  return [...new Set(names)];
}

const ACV_LINES=[
  [/^Ic\s+construction\s+max\s+2028\s/i,'ic_construction_max_2028'],[/^Ic\s+construction\s+max\s+kg/i,'ic_construction_max'],[/^Ic\s+construction\s+kg/i,'ic_construction'],
  [/^Ic\s+energie\s+max\s+2028\s/i,'ic_energy_max_2028'],[/^Ic\s+energie\s+max\s+kg/i,'ic_energy_max'],[/^Ic\s+energie\s+kg/i,'ic_energy'],
  [/^Ic\s+composants?\s+kg/i,'ic_components'],[/^Ic\s+chantier\s+kg/i,'ic_site'],[/^Stock\s+c\s+batiment\s+kg/i,'stock_c_per_m2']
];

function parsePleiadesAcvReport(doc,occ,canonical=(s)=>s){
  const out=[]; let building=null, scope='building';
  const origin='Pléiades — rapport ACV (partie environnement)';
  for(const x of pr_allLines(doc)){
    let m;
    if((m=x.t.match(/^Donnees\s+generales\s+(Batiment\s+.+)$/i))){ building=m[1].trim(); scope='building'; continue; }
    if(/^Zone\s+Zone\b|^Quantitatifs\s+saisis\s+Zone\b|^Resultats\s+detailles.*\bZone\b/i.test(x.t)){ scope='zone'; continue; }
    if(!building||scope!=='building') continue;
    for(const [re,field] of ACV_LINES){
      if(!re.test(x.t)) continue;
      const v=pr_nums(x.t.replace(/CO2/gi,'').replace(/m²|m2/gi,'')); const val=v.length?v[v.length-1]:null; if(val===null) break;
      if(out.some(o=>o.field===field&&o.building===canonical(building))) break;
      const o=occ(doc,x.page,x.line,field,val,'pleiades-acv:indicateur',0.99,field==='stock_c_per_m2'?'kgC/m²':'kgCO2e/m²',{building:canonical(building),structuredPdf:true,origin,...(field==='stock_c_per_m2'?{provenanceNote:'« Stock c bâtiment » (stockage carbone, kgC/m² malgré l’unité affichée).'}:{})});
      if(o) out.push(o); break;
    }
  }
  return out;
}

function parsePleiadesServicesSummary(doc,occ,canonical=(s)=>s){
  const out=[]; const lines=pr_allLines(doc);
  const origin='Pléiades — tableau de synthèse des prestations thermiques';
  const P='([\\d.,]+)\\s*\\/\\s*([\\d.,]+)';
  const re=new RegExp(`^${P}\\s*points\\s+${P}\\s*kWh\\s*EP\\/m²?2?\\s+${P}\\s*kWh\\s*EP\\/m²?2?\\s+${P}\\s*kg`,'i');
  lines.forEach((x,i)=>{
    const m=x.t.match(re); if(!m) return;
    const b=(lines[i+1]?.t.match(/^(Batiment\s+\S+)/i)||[])[1]; if(!b) return;
    const v=m.slice(1).map(s=>parseFrNumber(s)); const B=canonical(b);
    const emit=(field,val,unit)=>{ const o=occ(doc,x.page,x.line,field,val,'pleiades-prestations:resultats',0.99,unit,{building:B,structuredPdf:true,origin}); if(o) out.push(o); };
    emit('bbio',v[0],'points'); emit('bbio_max',v[1],'points'); emit('cep',v[2],'kWhEP/m².an'); emit('cep_max',v[3],'kWhEP/m².an');
    emit('cepnr',v[4],'kWhEP/m².an'); emit('cepnr_max',v[5],'kWhEP/m².an'); emit('ic_energy',v[6],'kgCO2e/m²'); emit('ic_energy_max',v[7],'kgCO2e/m²');
  });
  // Systèmes communs (section « Systèmes ») : production et émetteurs, valables pour tous les bâtiments.
  const sys=lines.findIndex(x=>/^Systemes$/i.test(x.t));
  if(sys>=0){
    const block=lines.slice(sys,sys+20); const common=(field,val,l,conf=0.95)=>{ const o=occ(doc,l.page,l.line,field,val,'pleiades-prestations:systemes',conf,'',{building:'Bâtiment unique',structuredPdf:true,origin}); if(o) out.push(o); };
    const gen=block.find(l=>/chaudiere\s+(?:biomasse|bois|granul)/i.test(l.t)); if(gen){ common('heating_mode_after','Chaudière biomasse',gen); common('heating_vector_after','Bois / biomasse',gen); if(/ECS/i.test(gen.t)){ common('ecs','Chaudière',gen,0.93); common('ecs_vector_after','Bois / biomasse',gen,0.93); } }
    const pac=block.find(l=>/pompe\s+a\s+chaleur|\bPAC\b/i.test(l.t)); if(pac&&!gen) common('heating_mode_after','PAC',pac,0.9);
  }
  return out;
}

function parseHeatLossReport(doc,occ){
  const x=pr_allLines(doc).find(y=>/^Departement\s*:\s*(\d{2,3}|2A|2B)\s*-/i.test(y.t)); if(!x) return [];
  const o=occ(doc,x.page,x.line,'department',x.t.match(/^Departement\s*:\s*(\d{2,3}|2A|2B)/i)[1].padStart(2,'0'),'deperditions:department',0.97,'',{building:'Bâtiment unique',structuredPdf:true,origin:'Synthèse des déperditions (NF EN 12831)'});
  return o?[o]:[];
}

/* ---- xml-re2020.js ---- */
// ExtracTerre v2.3 — lecture structurée des XML RE2020 (RSET + RSEnv + Datas_Comp).
// Les valeurs sont lues directement dans les balises normalisées du schéma RE2020 :
// aucune expression régulière sur du texte linéarisé, aucun décalage de colonne possible.

// ---------------------------------------------------------------------------
// Parseur XML minimal (secours hors navigateur / tests Node). Dans le navigateur,
// DOMParser est utilisé ; les deux exposent la même mini-API : tagName, children,
// textContent, getAttribute().
// ---------------------------------------------------------------------------
const RE20_ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
function re20Decode(s){
  if(!s||s.indexOf('&')<0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>{
    if(e[0]==='#') return String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):parseInt(e.slice(1),10));
    return RE20_ENTITIES[e]??m;
  });
}
class Re20Node{
  constructor(tagName,attributes){ this.tagName=tagName; this.attributes=attributes||{}; this.children=[]; this._text=''; }
  getAttribute(n){ return Object.prototype.hasOwnProperty.call(this.attributes,n)?this.attributes[n]:null; }
  get textContent(){ return this.children.length?this._text+this.children.map(c=>c.textContent).join(''):this._text; }
}
function parseXmlLite(source){
  const text=String(source||'').replace(/^\uFEFF/,'');
  const root=new Re20Node('#document'); const stack=[root];
  const tagRe=/<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s>\/]+)((?:\s+[^\s=>\/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const attrRe=/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let last=0, m;
  while((m=tagRe.exec(text))){
    const between=text.slice(last,m.index); last=tagRe.lastIndex;
    const cur=stack[stack.length-1];
    if(between&&cur!==root&&!cur.children.length) cur._text+=re20Decode(between);
    if(m[1]!==undefined){ cur._text+=m[1]; continue; }
    if(m[2]){ if(stack.length>1) stack.pop(); continue; }
    if(m[3]){
      const attrs={}; let a; attrRe.lastIndex=0; const raw=m[4]||'';
      while((a=attrRe.exec(raw))) attrs[a[1]]=re20Decode(a[2]??a[3]??'');
      const node=new Re20Node(m[3],attrs); cur.children.push(node);
      if(!m[5]) stack.push(node);
    }
  }
  const documentElement=root.children[0]||null;
  return {documentElement,querySelector:()=>null};
}
function parseXmlDocument(source){
  if(typeof globalThis.DOMParser==='function'){
    const xml=new globalThis.DOMParser().parseFromString(String(source||''),'application/xml');
    if(xml.querySelector('parsererror')) throw new Error('XML illisible ou invalide.');
    return xml;
  }
  const lite=parseXmlLite(source); if(!lite.documentElement) throw new Error('XML illisible ou invalide.');
  return lite;
}

// ---------------------------------------------------------------------------
// Petits accesseurs indépendants de l'implémentation DOM.
// ---------------------------------------------------------------------------
function re20Kids(el){ return el?Array.from(el.children||[]):[]; }
function re20Child(el,name){ if(!el) return null; for(const c of re20Kids(el)) if(c.tagName===name) return c; return null; }
function re20All(el,name){ return re20Kids(el).filter(c=>c.tagName===name); }
function re20Path(el,path){ let cur=el; for(const p of path.split('/')){ cur=re20Child(cur,p); if(!cur) return null; } return cur; }
function re20Text(el){ return el?String(el.textContent||'').replace(/\s+/g,' ').trim():''; }
function re20Num(el){ const t=re20Text(el); if(!t||/^nan$/i.test(t)) return null; const v=Number(t.replace(',','.')); return Number.isFinite(v)?v:null; }
function re20PathNum(el,path){ return re20Num(re20Path(el,path)); }
function re20PathText(el,path){ return re20Text(re20Path(el,path)); }
function re20ByIndex(list,key='Index'){ const m=new Map(); for(const el of list){ const i=re20PathNum(el,key); if(i!==null) m.set(i,el); } return m; }
function re20Round(v,d=2){ if(v==null||!Number.isFinite(v)) return null; const f=10**d; return Math.round(v*f)/f; }
function re20Sum(list){ let s=0,n=0; for(const v of list) if(Number.isFinite(v)){ s+=v; n++; } return n?s:null; }

function isRe2020XmlDocument(xml){
  const root=xml?.documentElement; if(!root||root.tagName!=='projet') return false;
  return !!(re20Child(root,'RSET')||re20Child(root,'RSEnv'));
}

// Ordre normatif des sous-contributeurs énergie RE2020 (vérifié sur Cef × facteurs).
const RE2020_ENERGY_SUBCONTRIBUTORS=Object.freeze({1:'ic_energy_heating',2:'ic_energy_ecs',3:'ic_energy_cooling',4:null,5:'ic_energy_aux_vent',6:'ic_energy_aux_dist',7:'ic_energy_mobility'});
const RE20_VECTOR_LABELS=Object.freeze({gaz:'Gaz',elec:'Électricité',bois:'Bois / biomasse',reseau:'Réseau de chaleur urbain',fioul:'Fioul'});
const RE20_EP_FACTOR=Object.freeze({gaz:1,elec:2.3,bois:1,reseau:1,fioul:1});

function re20DynamicSum(el){ const d=re20Child(el,'indicateur_co2_dynamique'); if(!d) return null; return re20Sum(re20All(d,'valeur_phase_acv').map(re20Num)); }

// Parois opaques Datas_Comp : 1xx murs, 2xx planchers bas, 3xx toitures, 4xx parois sur local non chauffé.
function re20EnvelopeTarget(code){
  const n=Number(code); if(!Number.isFinite(n)) return null;
  if([105,106,405].includes(n)) return null; // coffres, portes
  if(n>=100&&n<200) return 'wall'; if(n>=200&&n<300) return 'floor'; if(n>=300&&n<400) return 'roof'; if(n>=400&&n<405) return 'wall_lnc';
  return null;
}
function re20Envelope(bat){
  const env=re20Child(bat,'enveloppe'); if(!env) return null;
  const best={};
  for(const p of re20All(env,'parois_opaques')){
    const target=re20EnvelopeTarget(re20PathText(p,'nature')); if(!target) continue;
    const surface=re20PathNum(p,'surface_totale')||0;
    const item={target,name:re20PathText(p,'name'),surface,u:re20PathNum(p,'U_paroi'),rTotal:re20PathNum(p,'resistance_thermique_isolant'),nature:re20PathText(p,'nature')};
    if(!best[target]||surface>best[target].surface) best[target]=item;
  }
  if(!best.wall&&best.wall_lnc) best.wall=best.wall_lnc;
  delete best.wall_lnc;
  const glazing=new Map(); let windowName='', windowSurface=0;
  for(const p of re20All(env,'parois_vitrees')){
    const s=re20PathNum(p,'surface_totale')||0, t=re20PathText(p,'type_vitrage');
    if(t) glazing.set(t,(glazing.get(t)||0)+s);
    if(s>windowSurface){ windowSurface=s; windowName=re20PathText(p,'name'); }
  }
  const glazingType=[...glazing.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  return {...best,glazingType,windowName};
}

function re20BuildingName(rawNames,index,count){
  const cleaned=rawNames.map(n=>String(n||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  const pick=cleaned.find(n=>/[àâäéèêëîïôöùûüç]/i.test(n))||cleaned[0]||'';
  const generic=!pick||/^b[aâ]t(?:iment)?\.?$/i.test(pick);
  if(count===1&&generic) return 'Bâtiment unique';
  if(generic) return canonicalBuilding(`Bâtiment ${index}`);
  return canonicalBuilding(pick);
}

// Extraction complète → objet JSON compact, conservé dans read.re2020 (persisté).
function extractRe2020(xml){
  const root=xml?.documentElement; if(!isRe2020XmlDocument(xml)) return null;
  const dc=re20Child(root,'Datas_Comp'), rset=re20Child(root,'RSET'), rsenv=re20Child(root,'RSEnv');
  const gen=re20Path(dc,'donnees_generales');
  const soft=re20Path(gen,'logiciel');
  const op=re20Path(gen,'operation');
  const sortie=re20Path(rset,'Sortie_Projet'), entree=re20Path(rset,'Entree_Projet');
  const general={
    schemaVersion:root.getAttribute?.('version')||'',
    software:soft?{editor:re20PathText(soft,'editeur'),name:re20PathText(soft,'nom'),version:re20PathText(soft,'version'),studyDate:re20PathText(soft,'date_etude')}:null,
    operation:re20PathText(op,'nom'),
    permit:re20PathText(op,'num_permis'),
    address:re20PathText(op,'adresse/label'), postcode:re20PathText(op,'adresse/postcode'), city:re20PathText(op,'adresse/city'),
    climateZone:re20PathText(op,'zone_climatique'),
    owner:re20PathText(gen,'maitre_ouvrage/nom'),
    department:re20PathText(sortie,'Departement')||String(re20PathText(op,'adresse/postcode')).slice(0,2),
    hasRset:!!rset, hasRsenv:!!rsenv
  };
  const bIn=re20ByIndex(re20All(re20Path(entree,'Batiment_Collection'),'Batiment'));
  const bB=re20ByIndex(re20All(re20Path(sortie,'Sortie_Batiment_B_Collection'),'Sortie_Batiment_B'));
  const bC=re20ByIndex(re20All(re20Path(sortie,'Sortie_Batiment_C_Collection'),'Sortie_Batiment_C'));
  const bD=re20ByIndex(re20All(re20Path(sortie,'Sortie_Batiment_D_Collection'),'Sortie_Batiment_D'));
  const envIn=re20ByIndex(re20All(re20Path(rsenv,'entree_projet'),'batiment'),'index');
  const envOut=re20ByIndex(re20All(re20Path(rsenv,'sortie_projet'),'batiment'),'index');
  const dcBat=re20ByIndex(re20All(re20Path(dc,'batiment_collection'),'batiment'));
  const indexes=[...new Set([...bIn.keys(),...bC.keys(),...envOut.keys(),...dcBat.keys()])].sort((a,b)=>a-b);
  const buildings=[];
  for(const index of indexes){
    const ein=bIn.get(index), sB=bB.get(index), sC=bC.get(index), sD=bD.get(index), rin=envIn.get(index), rout=envOut.get(index), d=dcBat.get(index);
    const name=re20BuildingName([re20PathText(rin,'nom'),re20PathText(ein,'Name'),re20PathText(sC,'Name')],index,indexes.length);
    const b={index,name,rawName:re20PathText(ein,'Name')||re20PathText(rin,'nom')||''};
    // --- Programme / surfaces
    const zones=re20All(re20Path(ein,'Zone_Collection'),'Zone');
    b.housing=re20Sum(zones.map(z=>re20PathNum(z,'NB_logement')));
    if(b.housing===null) b.housing=re20Sum(re20All(rin,'zone').map(z=>re20PathNum(z,'nb_logement')));
    const groups=zones.flatMap(z=>re20All(re20Path(z,'Groupe_Collection'),'Groupe'));
    b.shab=re20Sum(groups.map(g=>re20PathNum(g,'SHAB')));
    if(!b.shab) b.shab=re20Sum(re20All(re20Path(sC,'Sortie_Zone_C_Collection'),'Sortie_Zone_C').map(z=>re20PathNum(z,'O_SHAB')));
    b.sref=re20PathNum(sC,'O_SREF')??re20PathNum(rin,'sref')??re20PathNum(d,'O_SREF');
    const trav=zones.map(z=>({t:re20PathNum(z,'Is_Traversant'),n:re20PathNum(z,'NB_logement')||0}));
    b.crossVentilated=trav.some(z=>z.t===1); b.nonCrossVentilated=trav.some(z=>z.t===0);
    b.anyCooled=groups.some(g=>re20PathNum(g,'Is_Climatise')===1); b.groupsKnown=groups.length>0;
    // --- Bbio / Cep / Cepnr
    b.bbio=re20PathNum(sB,'O_Bbio_pts_annuel'); b.bbioMax=re20PathNum(sB,'O_Bbio_Max');
    b.cep=re20PathNum(sC,'O_Cep_annuel'); b.cepMax=re20PathNum(sC,'O_Cep_Max');
    b.cepnr=re20PathNum(sC,'O_Cep_nr_annuel'); b.cepnrMax=re20PathNum(sC,'O_Cep_nr_Max');
    // --- Consommations finales importées par vecteur et par usage
    const vec={}; for(const v of ['gaz','fioul','bois','elec','reseau']) vec[v]=re20PathNum(sC,`O_Cef_${v}_imp_annuel`);
    const use={};
    for(const v of ['gaz','fioul','bois','elec','reseau']) for(const u of ['ch','fr','ecs']) use[`${v}_${u}`]=re20PathNum(sC,`O_Cef_${v}_imp_${u}_annuel`);
    for(const u of ['ecl','auxvent','auxdist','deplacement']) use[`elec_${u}`]=re20PathNum(sC,`O_Cef_elec_imp_${u}_annuel`);
    b.cef={vectors:vec,uses:use};
    // --- DH : groupe le plus défavorable, DHmax lu sur le même groupe.
    let worst=null;
    for(const z of re20All(re20Path(sD,'Sortie_Zone_D_Collection'),'Sortie_Zone_D')) for(const g of re20All(re20Path(z,'Sortie_Groupe_D_Collection'),'Sortie_Groupe_D')){
      const dh=re20PathNum(g,'O_NbDegresHeures'); if(dh===null) continue;
      if(!worst||dh>worst.dh) worst={dh,dhMax:re20PathNum(g,'O_NbDegresHeures_max'),group:re20PathText(g,'Name')};
    }
    b.dh=worst?.dh??null; b.dhMax=worst?.dhMax??null; b.dhGroup=worst?.group||'';
    // --- ACV (RSEnv sortie bâtiment)
    if(rout){
      const perf=re20Child(rout,'indicateur_perf_env');
      b.icConstruction=re20PathNum(perf,'ic_construction'); b.icConstructionMax=re20PathNum(perf,'ic_construction_max');
      b.icEnergy=re20PathNum(perf,'ic_energie'); b.icEnergyMax=re20PathNum(perf,'ic_energie_max');
      b.icComponents=re20PathNum(perf,'ic_composant'); b.icSite=re20PathNum(perf,'ic_chantier');
      b.icBuilding=re20PathNum(perf,'ic_batiment'); b.icWater=re20PathNum(perf,'ic_eau');
      b.stockC=re20PathNum(perf,'stock_c_batiment');
      const comp=re20Path(rout,'contributeur/composant');
      b.lots={}; for(const lot of re20All(comp,'lot')){ const ref=Number(lot.getAttribute('ref')); const v=re20PathNum(lot,'ic'); if(ref>=1&&ref<=13&&v!==null) b.lots[ref]=v; }
      b.energy={}; for(const sc of re20All(re20Path(rout,'contributeur/energie'),'sous_contributeur')){ const ref=Number(sc.getAttribute('ref')); const v=re20DynamicSum(sc); if(Number.isFinite(ref)&&v!==null) b.energy[ref]=re20Round(v,3); }
    }
    b.envelope=re20Envelope(d);
    buildings.push(b);
  }
  return {format:'RE2020-XML',general,buildings};
}

// Texte de synthèse lisible (recherche libre, tags, surlignage) : une page par bâtiment.
function re2020SummaryPages(data){
  if(!data) return [];
  const g=data.general||{}; const fmt=v=>v==null?'—':String(v);
  const head=[`RSEE RE2020 — Récapitulatif standardisé d'étude énergétique et environnementale (XML)`,
    `Opération : ${fmt(g.operation)}`,`Maître d'ouvrage : ${fmt(g.owner)}`,`Adresse : ${fmt(g.address)} ${fmt(g.postcode)} ${fmt(g.city)}`,
    `Département : ${fmt(g.department)}`,`Zone climatique : ${fmt(g.climateZone)}`,
    g.software?`Logiciel : ${g.software.editor} ${g.software.name} ${g.software.version}`:'',`Nombre de bâtiments : ${data.buildings.length}`].filter(Boolean);
  const pages=[{page:1,text:head.join('\n'),lines:head.map((text,index)=>({index,text}))}];
  data.buildings.forEach((b,i)=>{
    const L=[`Bâtiment ${b.index} : ${b.name}`,`Nombre de logements : ${fmt(b.housing)}`,`SHAB : ${fmt(b.shab)} m²`,`Sref : ${fmt(b.sref)} m²`,
      `Bbio : ${fmt(b.bbio)} / Bbio max : ${fmt(b.bbioMax)}`,`Cep : ${fmt(b.cep)} / Cep max : ${fmt(b.cepMax)} kWhEP/m².an`,`Cep,nr : ${fmt(b.cepnr)} / Cep,nr max : ${fmt(b.cepnrMax)} kWhEP/m².an`,
      `DH : ${fmt(b.dh)} / DH max : ${fmt(b.dhMax)} °C.h`,
      `Ic construction : ${fmt(b.icConstruction)} / max ${fmt(b.icConstructionMax)} kgCO2e/m²`,`Ic composants : ${fmt(b.icComponents)} kgCO2e/m²`,`Ic chantier : ${fmt(b.icSite)} kgCO2e/m²`,
      `Ic énergie : ${fmt(b.icEnergy)} / max ${fmt(b.icEnergyMax)} kgCO2e/m²`,`Stock C : ${fmt(b.stockC)} kgC/m²`,
      ...Object.entries(b.lots||{}).map(([k,v])=>`Ic composants lot ${k} : ${re20Round(v,3)} kgCO2e/m²`),
      b.envelope?.wall?`Mur : ${b.envelope.wall.name}`:'',b.envelope?.floor?`Plancher bas : ${b.envelope.floor.name}`:'',b.envelope?.roof?`Toiture : ${b.envelope.roof.name}`:'',
      b.envelope?.glazingType?`Vitrage : ${b.envelope.glazingType}`:'',b.envelope?.windowName?`Menuiserie : ${b.envelope.windowName}`:''].filter(Boolean);
    pages.push({page:i+2,text:L.join('\n'),lines:L.map((text,index)=>({index,text})),re2020Building:b.index});
  });
  return pages;
}

// Occurrences ExtracTerre à partir de l'objet extrait. `makeOcc` est fourni par parsers.js
// pour rester strictement compatible avec la traçabilité existante (page, extrait, méthode).
function re2020Occurrences(doc,makeOcc){
  const data=doc?.read?.re2020; if(!data) return [];
  const out=[]; const g=data.general||{};
  const pages=doc.read.pages||[];
  const pageFor=b=>pages.find(p=>p.re2020Building===b.index)||pages[0]||{page:1,lines:[]};
  const lineFor=(page,re)=>(page.lines||[]).find(l=>re.test(l.text))||(page.lines||[])[0]||{index:0,text:''};
  const soft=g.software?`${g.software.editor} ${g.software.name}`.trim():'logiciel non renseigné';
  const add=(b,field,value,tag,unit,re,extra={})=>{
    if(value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value))) return;
    const page=b?pageFor(b):(pages[0]||{page:1,lines:[]}); const line=lineFor(page,re||/./);
    out.push(makeOcc(doc,page,line,field,value,`xml:re2020:${tag}`,extra.confidence??0.999,unit||'',{
      building:b?b.name:'Bâtiment unique',structuredXml:true,
      origin:extra.origin||`XML RE2020 — ${tag.split('-')[0].toUpperCase()}`,
      excerpt:extra.excerpt||`${line.text||''}`.slice(0,420),
      provenanceNote:extra.note||`Valeur lue directement dans la balise normalisée du XML RE2020 (${soft}).`,
      ...(extra.derived?{derivedFromDocument:true}:{})
    }));
  };
  const multi=data.buildings.length>1;
  // Données d'opération : valeurs projet (non spécifiques à un bâtiment).
  add(null,'operation',g.operation,'general-operation','',/Opération/);
  add(null,'project',g.operation,'general-operation','',/Opération/);
  add(null,'department',g.department,'general-department','',/Département/);
  add(null,'owner_company',g.owner,'general-owner','',/Maître/);
  for(const b of data.buildings){
    add(b,'building',b.name,'rset-building','',/^Bâtiment/);
    add(b,'housing_count',b.housing,'rset-housing','',/logements/);
    add(b,'shab',b.shab??b.sref,'rset-surface','m²',/SHAB/,{note:b.shab?'Somme des SHAB des groupes du bâtiment (Entree_Projet).':'Sref du bâtiment (SHAB non renseignée).'});
    add(b,'bbio',b.bbio,'rset-bbio','points',/Bbio/);
    add(b,'bbio_max',b.bbioMax,'rset-bbio','points',/Bbio/);
    add(b,'cep',b.cep,'rset-cep','kWhEP/m².an',/^Cep :/);
    add(b,'cep_max',b.cepMax,'rset-cep','kWhEP/m².an',/^Cep :/);
    add(b,'cepnr',b.cepnr,'rset-cepnr','kWhEP/m².an',/Cep,nr/);
    add(b,'cepnr_max',b.cepnrMax,'rset-cepnr','kWhEP/m².an',/Cep,nr/);
    const gain=(v,max)=>v!=null&&max?re20Round((max-v)/max*100,1):null;
    add(b,'bbio_gain',gain(b.bbio,b.bbioMax),'rset-gain-calc','%',/Bbio/,{confidence:0.995,derived:true,note:'Gain = (Bbio max − Bbio) / Bbio max, calculé à partir des deux valeurs du XML.'});
    add(b,'cep_gain',gain(b.cep,b.cepMax),'rset-gain-calc','%',/^Cep :/,{confidence:0.995,derived:true,note:'Gain = (Cep max − Cep) / Cep max, calculé à partir des deux valeurs du XML.'});
    add(b,'cepnr_gain',gain(b.cepnr,b.cepnrMax),'rset-gain-calc','%',/Cep,nr/,{confidence:0.995,derived:true,note:'Gain = (Cep,nr max − Cep,nr) / Cep,nr max, calculé à partir des deux valeurs du XML.'});
    add(b,'dh',b.dh,'rset-dh','°C.h',/^DH/,{note:`DH du groupe le plus défavorable (${b.dhGroup||'groupe'}) lu dans Sortie_Groupe_D.`});
    add(b,'dh_max',b.dhMax,'rset-dh','°C.h',/^DH/,{note:`DH max lu sur le même groupe que le DH retenu (${b.dhGroup||'groupe'}).`});
    if(b.crossVentilated) add(b,'cross_ventilated','Oui','rset-traversant','',/^Bâtiment/);
    if(b.nonCrossVentilated) add(b,'non_cross_ventilated','Oui','rset-traversant','',/^Bâtiment/);
    if(b.groupsKnown&&!b.anyCooled) add(b,'cooling','Aucun','rset-climatisation','',/^Bâtiment/,{confidence:0.95,note:'Aucun groupe déclaré climatisé (Is_Climatise = 0) dans le XML.'});
    // Cep par poste / par vecteur : Cef importée × coefficient RE2020 (élec 2,3 ; autres 1), contrôlé vs O_Cep_annuel.
    const u=b.cef?.uses||{}, v=b.cef?.vectors||{};
    const ep=(vecKey,val)=>val==null?null:val*RE20_EP_FACTOR[vecKey];
    const usage=k=>re20Sum(['gaz','fioul','bois','elec','reseau'].map(x=>ep(x,u[`${x}_${k}`])));
    const cepCheck=re20Sum(Object.entries(v).map(([k,val])=>ep(k,val)));
    const consistent=cepCheck!=null&&b.cep!=null&&Math.abs(cepCheck-b.cep)<=Math.max(1,b.cep*0.03);
    const calcNote=`Cef importée × coefficient d'énergie primaire RE2020 (électricité 2,3 ; autres vecteurs 1). Contrôle : Σ vecteurs = ${re20Round(cepCheck,1)} pour Cep = ${b.cep}.`;
    if(consistent){
      const d={confidence:0.97,derived:true,note:calcNote};
      add(b,'cep_cooling',re20Round(usage('fr'),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_lighting',re20Round(ep('elec',u.elec_ecl),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_aux_vent',re20Round(ep('elec',u.elec_auxvent),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_aux_dist',re20Round(ep('elec',u.elec_auxdist),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_mobility',re20Round(ep('elec',u.elec_deplacement),2),'rset-cep-poste-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_electricity',re20Round(ep('elec',v.elec),2),'rset-cep-vecteur-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_gas',re20Round(ep('gaz',v.gaz),2),'rset-cep-vecteur-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_district',re20Round(ep('reseau',v.reseau),2),'rset-cep-vecteur-calc','kWhEP/m².an',/^Cep :/,d);
      add(b,'cep_biomass',re20Round(ep('bois',v.bois),2),'rset-cep-vecteur-calc','kWhEP/m².an',/^Cep :/,d);
    }
    // Vecteurs principaux : vecteur dont la Cef importée est la plus forte pour l'usage.
    const dominant=k=>{ const rows=['gaz','fioul','bois','elec','reseau'].map(x=>[x,u[`${x}_${k}`]||0]).filter(r=>r[1]>0).sort((a,b2)=>b2[1]-a[1]); if(!rows.length) return null; const total=rows.reduce((s,r)=>s+r[1],0); return rows[0][1]/total>=0.6?RE20_VECTOR_LABELS[rows[0][0]]:'Hybride'; };
    const vecNote=k=>`Vecteur majoritaire des consommations finales importées (${k}) dans Sortie_Batiment_C.`;
    add(b,'heating_vector_after',dominant('ch'),'rset-vecteur-calc','',/^Bâtiment/,{confidence:0.95,derived:true,note:vecNote('chauffage')});
    add(b,'ecs_vector_after',dominant('ecs'),'rset-vecteur-calc','',/^Bâtiment/,{confidence:0.95,derived:true,note:vecNote('ECS')});
    // ACV
    add(b,'ic_components',b.icComponents,'rsenv-ic','kgCO2e/m²',/Ic composants :/);
    add(b,'ic_site',b.icSite,'rsenv-ic','kgCO2e/m²',/Ic chantier/);
    add(b,'ic_energy',b.icEnergy,'rsenv-ic','kgCO2e/m²',/Ic énergie/);
    add(b,'ic_energy_max',b.icEnergyMax,'rsenv-ic-max','kgCO2e/m²',/Ic énergie/);
    add(b,'ic_construction',b.icConstruction,'rsenv-ic','kgCO2e/m²',/Ic construction/);
    add(b,'ic_construction_max',b.icConstructionMax,'rsenv-ic-max','kgCO2e/m²',/Ic construction/);
    add(b,'stock_c_per_m2',b.stockC,'rsenv-stock-c','kgC/m²',/Stock C/,{note:'Balise stock_c_batiment (stockage carbone du bâtiment rapporté au m²).'});
    for(const [ref,val] of Object.entries(b.lots||{})) add(b,`ic_lot_${ref}`,re20Round(val,3),'rsenv-lot','kgCO2e/m²',new RegExp(`lot ${ref} :`),{note:`Balise contributeur/composant/lot[ref=${ref}]/ic.`});
    for(const [ref,val] of Object.entries(b.energy||{})){ const f=RE2020_ENERGY_SUBCONTRIBUTORS[ref]; if(f) add(b,f,re20Round(val,2),'rsenv-energie','kgCO2e/m²',/Ic énergie/,{confidence:0.99,derived:true,note:`Somme des phases du sous-contributeur énergie ${ref} (indicateur CO2 dynamique).`}); }
  }
  void multi;
  return out;
}

// Lignes synthétiques d'enveloppe, analysées ensuite par le parseur enveloppe existant
// (matériaux, isolants, épaisseurs, R explicites, bibliothèque isolants).
function re2020EnvelopeLines(data){
  const out=[];
  for(const b of data?.buildings||[]){
    const e=b.envelope; if(!e) continue;
    const label={wall:'Mur extérieur isolation',floor:'Plancher bas isolation',roof:'Toiture isolation'};
    for(const t of ['wall','floor','roof']) if(e[t]?.name) out.push({building:b.name,index:b.index,text:`${label[t]} : ${e[t].name}`});
    if(e.windowName||e.glazingType) out.push({building:b.name,index:b.index,text:`Menuiserie fenêtre : ${e.windowName||''} — vitrage ${e.glazingType||''}`});
  }
  return out;
}

/* ---- patches.js ---- */
const STORAGE_KEY='extracterre-improvement-patches-v1';
const SCHEMA='extracterre-improvement-patch/v1';
let registry=[];
const safeArray=v=>Array.isArray(v)?v:[];
const safeText=v=>String(v??'').slice(0,5000);

function validateRegex(raw,label,max=1200){
  if(raw==null) return;
  if(typeof raw!=='string'||raw.length>max) throw new Error(`Expression régulière invalide : ${label}`);
  try{ new RegExp(raw,'im'); }catch{ throw new Error(`Expression régulière invalide : ${label}`); }
}
function versionParts(value=''){ return String(value||'').trim().replace(/^v/i,'').split('.').map(x=>Number.parseInt(x,10)||0); }
function compareVersions(a,b){
  const aa=versionParts(a),bb=versionParts(b),n=Math.max(aa.length,bb.length,3);
  for(let i=0;i<n;i++){ const d=(aa[i]||0)-(bb[i]||0); if(d) return d<0?-1:1; }
  return 0;
}
function validPatch(p){
  if(!p||p.schema!==SCHEMA||typeof p.id!=='string'||!p.id.trim()) throw new Error('Patch ExtracTerre invalide ou incompatible.');
  if(p.minAppVersion&&compareVersions(APP_VERSION,p.minAppVersion)<0) throw new Error(`Patch ${p.id} incompatible : ExtracTerre ${p.minAppVersion} minimum requis (version actuelle ${APP_VERSION}).`);
  if(safeArray(p.extractionRules).length>160) throw new Error('Patch refusé : trop de règles.');
  for(const r of safeArray(p.extractionRules)){
    if(!r.field||!FIELD_MAP[r.field]) throw new Error(`Champ de patch inconnu : ${r.field||'—'}`);
    validateRegex(r.regex,r.id||r.field,900);
    validateRegex(r.sectionStartRegex,`${r.id||r.field}: sectionStartRegex`);
    validateRegex(r.sectionEndRegex,`${r.id||r.field}: sectionEndRegex`);
  }
  return true;
}
function uniqueById(items){ const m=new Map(); for(const x of items){ if(x?.id) m.set(x.id,x); } return [...m.values()]; }
function readLocal(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return []} }
function writeLocal(items){ localStorage.setItem(STORAGE_KEY,JSON.stringify(items)); }
async function initializeImprovementPatches(){
  let site=[];
  try{
    const res=await fetch(`./data/patches/manifest.json?ts=${Date.now()}`,{cache:'no-store'});
    if(res.ok){ const manifest=await res.json(); for(const entry of safeArray(manifest.patches)){ try{ validPatch(entry); site.push({...entry,_origin:'site'}); }catch(e){ console.warn('Patch site ignoré',e); } } }
  }catch(e){ console.warn('Manifest patches indisponible',e); }
  const local=[]; for(const p of readLocal()){ try{validPatch(p); local.push({...p,_origin:'local'});}catch(e){console.warn('Patch local ignoré',e);} }
  registry=uniqueById([...site,...local]); return registry;
}
function getImprovementPatches(){return registry.map(p=>({id:p.id,title:p.title||p.id,version:p.version||'1.0.0',origin:p._origin||'site',description:p.description||''}));}
function importImprovementPatchObject(p){ validPatch(p); const clean=JSON.parse(JSON.stringify(p)); const local=readLocal().filter(x=>x?.id!==clean.id); local.push(clean); writeLocal(local); registry=uniqueById([...registry.filter(x=>x.id!==clean.id),{...clean,_origin:'local'}]); return clean; }
async function importImprovementPatchFile(file){ const txt=await file.text(); return importImprovementPatchObject(JSON.parse(txt)); }
function removeLocalImprovementPatch(id){ const local=readLocal().filter(x=>x?.id!==id); writeLocal(local); registry=registry.filter(x=>!(x.id===id&&x._origin==='local')); }

function signatureMatchesDocument(signature,fileName,text){
  const n=normLower(fileName),t=normLower(text).slice(0,180000);
  const all=safeArray(signature?.all).every(x=>t.includes(normLower(x))||n.includes(normLower(x)));
  const any=!safeArray(signature?.any).length||safeArray(signature?.any).some(x=>t.includes(normLower(x))||n.includes(normLower(x)));
  const none=safeArray(signature?.none).some(x=>t.includes(normLower(x))||n.includes(normLower(x)));
  return all&&any&&!none;
}
function patchMatchesDocument(p,doc,text){
  const sigs=safeArray(p?.documentSignatures).filter(s=>!s?.docType||s.docType===doc.type);
  if(!sigs.length) return true;
  return sigs.some(s=>signatureMatchesDocument(s,doc.name||'',text));
}
function patchClassifierScores(fileName,text=''){
  const n=normLower(fileName),t=normLower(text).slice(0,180000),scores={};
  for(const p of registry) for(const s of safeArray(p.documentSignatures)){
    const all=safeArray(s.all).every(x=>t.includes(normLower(x))||n.includes(normLower(x)));
    const any=!safeArray(s.any).length||safeArray(s.any).some(x=>t.includes(normLower(x))||n.includes(normLower(x)));
    const none=safeArray(s.none).some(x=>t.includes(normLower(x))||n.includes(normLower(x)));
    if(all&&any&&!none){ const k=s.docType; if(k) scores[k]=(scores[k]||0)+(Number(s.weight)||8); }
  }
  return scores;
}
function patchOccurrence(doc,page,line,r,value,p,buildingOverride=null){
  return {field:r.field,value,building:buildingOverride||r.building||'Bâtiment unique',docId:doc.id,fileName:doc.name,docType:doc.type,page:page?.page||1,excerpt:normalizeText(line?.text||r.label||'').slice(0,420),confidence:clamp(Number(r.confidence)||.91),method:`patch:${p.id}:${r.id||r.field}`,unit:r.unit||'',origin:`Patch ${p.title||p.id}`,provenanceNote:r.note||'Règle documentaire versionnée issue de la bibliothèque ExtracTerre.',patchId:p.id};
}
function pageLineForAbsoluteIndex(doc,text,absoluteIndex,raw,matchText=''){
  const before=text.slice(0,Math.max(0,absoluteIndex)), pageNum=(before.match(/<PARSED TEXT FOR PAGE:/g)||[]).length||1;
  const page=doc.read.pages?.find(x=>x.page===pageNum)||doc.read.pages?.[0]||{page:pageNum,lines:[]};
  const needle=normalizeText(String(raw??'')).slice(0,22);
  const line=page.lines?.find(x=>needle&&normalizeText(x.text).includes(needle))||page.lines?.find(x=>normalizeText(matchText).includes(normalizeText(x.text).slice(0,22)))||page.lines?.[0]||{text:matchText,index:0};
  return {page,line};
}
function ruleValue(r,m){
  if(Object.prototype.hasOwnProperty.call(r,'constantValue')) return r.constantValue;
  const raw=m[Number(r.valueGroup)||1]; if(raw==null) return null;
  return r.valueType==='number'?parseFrNumber(raw):normalizeText(raw);
}
function selectMatches(matches,r){
  if(!matches.length) return [];
  const mode=String(r.selection||'').toLowerCase();
  if(!mode) return r.allowMultiple?matches:matches.slice(0,1);
  const g=Number(r.selectionGroup)||Number(r.valueGroup)||1;
  const scored=matches.map(x=>({x,v:parseFrNumber(x.m[g])})).filter(z=>Number.isFinite(z.v));
  if(!scored.length) return matches.slice(0,1);
  scored.sort((a,b)=>mode==='min'?a.v-b.v:b.v-a.v);
  return [scored[0].x];
}
function sectionSlices(text,r){
  if(!r.sectionStartRegex) return [{text,start:0,building:r.building||null}];
  let sr; try{sr=new RegExp(r.sectionStartRegex,'gim')}catch{return []}
  const starts=[]; let sm;
  while((sm=sr.exec(text))){
    let building=r.building||null;
    const bg=Number(r.sectionBuildingGroup)||0;
    if(bg&&sm[bg]) building=canonicalBuilding(sm[bg]);
    starts.push({match:sm,start:sm.index,contentStart:sm.index+sm[0].length,building});
    if(sr.lastIndex===sm.index) sr.lastIndex++;
  }
  const out=[];
  for(let i=0;i<starts.length;i++){
    const cur=starts[i], hardEnd=i+1<starts.length?starts[i+1].start:text.length;
    let end=hardEnd;
    if(r.sectionEndRegex){
      try{ const er=new RegExp(r.sectionEndRegex,'im'), em=er.exec(text.slice(cur.contentStart,hardEnd)); if(em) end=cur.contentStart+em.index; }catch{}
    }
    out.push({text:text.slice(cur.contentStart,end),start:cur.contentStart,building:cur.building});
  }
  return out;
}
function parsePatchOccurrences(doc){
  const out=[], text=String(doc?.read?.text||''), low=normLower(text);
  for(const p of registry){
    if(!patchMatchesDocument(p,doc,text)) continue;
    for(const r of safeArray(p.extractionRules)){
      if(safeArray(r.docTypes).length&&!r.docTypes.includes(doc.type)) continue;
      if(safeArray(r.requireAny).length&&!safeArray(r.requireAny).some(x=>low.includes(normLower(x)))) continue;
      if(safeArray(r.forbidAny).some(x=>low.includes(normLower(x)))) continue;
      const slices=sectionSlices(text,r);
      for(const section of slices){
        let re; try{re=new RegExp(r.regex,'gim')}catch{continue;} let m,count=0; const matches=[];
        while((m=re.exec(section.text))&&count++<(Number(r.maxMatches)||20)){
          matches.push({m,index:m.index});
          if(re.lastIndex===m.index) re.lastIndex++;
        }
        for(const hit of selectMatches(matches,r)){
          const value=ruleValue(r,hit.m); if(value==null||value==='') continue;
          const absoluteIndex=section.start+hit.index;
          const raw=Object.prototype.hasOwnProperty.call(r,'constantValue')?String(r.constantValue):hit.m[Number(r.valueGroup)||1];
          const {page,line}=pageLineForAbsoluteIndex(doc,text,absoluteIndex,raw,hit.m[0]);
          out.push(patchOccurrence(doc,page,line,r,value,p,section.building));
        }
      }
    }
  }
  return out;
}
const PATCH_SCHEMA=SCHEMA;

/* ---- classifier.js ---- */
function classifyDocument(fileName, text='', meta={}) {
  // v2.3 — XML RE2020 lu par balises : le type est certain (présence des blocs RSET / RSEnv).
  if(meta?.re2020){
    const g=meta.re2020.general||{};
    const type=g.hasRsenv?DOC_TYPES.RSEE_RE2020:DOC_TYPES.RSET_RE2020;
    return {type,confidence:0.99,scores:{[type]:99},reason:[[type,99]],structured:'xml-re2020'};
  }
  const n=normLower(fileName), t=normLower(text).slice(0,120000), head=normLower(text).slice(0,18000);
  const has=(re)=>re.test(n)||re.test(t);
  const score={}; const add=(k,v)=>score[k]=(score[k]||0)+v;

  const isStdRset=/recapitulatif\s+standardise\s+d['’]?etude\s+thermique|r[eé]capitulatif\s+standardis[eé]\s+d['’]?etude\s+thermique/i.test(t);
  const explicitRT2012=/reglementation\s+thermique\s+2012|r[eé]glementation\s+thermique\s+2012|rset[^\n]{0,80}rt2012|th[- ]?bce\s*2012/i.test(t);
  const titleRT2012=/r[eé]capitulatif\s+standardis[eé]\s+d['’]?etude\s+thermique[\s\S]{0,500}r[eé]glementation\s+thermique\s+2012|r[eé]glementation\s+thermique\s+2012[\s\S]{0,500}r[eé]capitulatif\s+standardis[eé]\s+d['’]?etude\s+thermique/i.test(head);
  const explicitRE2020=/reglementation\s+environnementale\s+2020|r[eé]glementation\s+environnementale\s+2020|\bre\s*2020\b|cep\s*,?\s*nr|degres[- ]?heures|\bdh\b/i.test(t);
  const explicitRSEE=/(?:^|[^a-z0-9])rsee(?:[^a-z0-9]|$)|recapitulatif\s+standardise\s+d['’]?etude\s+(?:energetique|[eé]nerg[eé]tique)\s+et\s+environnementale/i.test(n+' '+t);
  const explicitRSENV=/(?:^|[^a-z0-9])rsenv(?:[^a-z0-9]|$)|rse[_ -]?env|partie\s+[«\"]?etude\s+environnementale|partie\s+[«\"]?[eé]tude\s+environnementale/i.test(n+' '+head);

  // « RSET » désigne le format standardisé, pas nécessairement la RE2020.
  // La réglementation contenue dans le document prime sur le nom du fichier.
  if (/rt\s*2012/i.test(n)) add(DOC_TYPES.RT2012,10);
  if (explicitRT2012) add(DOC_TYPES.RT2012,titleRT2012?50:(isStdRset?22:12));
  if (explicitRSENV) add(DOC_TYPES.RSENV,/rsenv|rse[_ -]?env/i.test(n)?55:32);
  if (explicitRSEE) add(DOC_TYPES.RSEE_RE2020,20);
  if (/(?:^|[^a-z0-9])rset(?:[^a-z0-9]|$)|rse[_ -]?t\b/i.test(n)) {
    if(explicitRT2012&&!explicitRE2020) add(DOC_TYPES.RT2012,12);
    else add(DOC_TYPES.RSET_RE2020,14);
  }
  if (/\.xml$/i.test(fileName)) {
    if(explicitRSEE) add(DOC_TYPES.RSEE_RE2020,14);
    else if(/rset|re2020|resultat.*etude/i.test(t)) add(DOC_TYPES.RSET_RE2020,12);
  }
  if (explicitRE2020) add(DOC_TYPES.RSET_RE2020,12);
  if (/coefficient\s+bbio|coefficients?\s+cep/i.test(t)) { if(explicitRT2012&&!explicitRE2020) add(DOC_TYPES.RT2012,5); else add(DOC_TYPES.RSET_RE2020,8); }
  // v2.3.3 — « RTEx » est aussi un en-tête de colonne ClimaWin (« RE2020 | RT2012 | RTEx | Déperditions »)
  // et « rénovation thermique » apparaît dans bien des CCTP : dans le texte, seuls les libellés explicites comptent.
  const rtExNameHit=/rt\s*(?:existant|existante|ex|reno)\b|th[- ]?cex|thcex|th[- ]?c(?:e|ex)\s*ex/i.test(n);
  const rtExTextHit=/r[eé]glementation\s+thermique\s+existante|th[- ]?c(?:e|ex)\s*ex|th[- ]?cex|thcex|\brt\s*(?:existant|existante)\b|r[eé]novation\s+thermique\s+r[eé]glementaire/i.test(t);
  if (rtExNameHit||rtExTextHit) add(DOC_TYPES.RT_EXISTING,/r[eé]glementation\s+thermique\s+existante/i.test(t)?30:18);
  if (/\bcontrat\b|convention\s+(?:de\s+)?certification|march[eé]\s+de\s+certification/i.test(n+' '+t)) add(DOC_TYPES.CONTRACT,/contrat/i.test(n)?17:9);
  if (/livret\s+d['’]?op[eé]ration|livret\s+op[eé]ration|fiche\s+op[eé]ration/i.test(n+' '+t)) add(DOC_TYPES.OPERATION_BOOKLET,17);
  if (/compte\s+rendu.{0,25}conception|\bcr\b.{0,20}conception|revue\s+de\s+conception/i.test(n+' '+t)) add(DOC_TYPES.DESIGN_REPORT,16);
  if (/compte\s+rendu.{0,25}environnement|\bcr\b.{0,20}environnement|revue\s+environnementale/i.test(n+' '+t)) add(DOC_TYPES.ENV_REPORT,17);
  if (/choix\s+des?\s+exigences|exigences?\s+(?:retenues?|choisies?)|grille\s+des?\s+exigences/i.test(n+' '+t)) add(DOC_TYPES.REQUIREMENTS,17);
  if (/descriptif\s+(?:du\s+)?projet|description\s+(?:du\s+)?projet|pr[eé]sentation\s+(?:du\s+)?projet/i.test(n+' '+t)) add(DOC_TYPES.PROJECT_DESCRIPTION,13);
  if (/cctp|cahier des clauses techniques/i.test(n+' '+t)) add(DOC_TYPES.CCTP,12);
  if (/dpgf|decomposition du prix global/i.test(n+' '+t)) add(DOC_TYPES.DPGF,12);
  if (/tableau.*surface|surfaces?\s+(?:habitables|shab|sref)/i.test(n+' '+t)) add(DOC_TYPES.SURFACE,9);
  if (/plan(?:s)?\s+(?:architect|niveau|rdc|etage)|echelle\s*1\s*\//i.test(n+' '+t)) add(DOC_TYPES.PLAN,8);
  if (/notice\s+(?:architect|descriptive)/i.test(n+' '+t)) add(DOC_TYPES.NOTICE,9);
  if (/permis\s+de\s+construire|\bpc\d|cerfa/i.test(n+' '+t)) add(DOC_TYPES.PERMIT,8);
  if (/rapport[^\n]{0,40}(?:perm[eé]abilit[eé]|infiltrom[eé]tr)|(?:perm[eé]abilit[eé]|infiltrom[eé]tr)[^\n]{0,40}rapport|blower\s+door/i.test(n)) add(DOC_TYPES.AIRTIGHTNESS,24); else if (/perm[eé]abilit[eé]\s+(?:a|à)\s+l['’]?air|\bq4pa(?:-?surf)?\b|blower\s+door|infiltrom[eé]tr/i.test(t)) add(DOC_TYPES.AIRTIGHTNESS,4);
  if (/diagnostic\s+de\s+performance\s+energetique|diagnostic\s+de\s+performance\s+[eé]nerg[eé]tique|\bdpe\b/i.test(n+' '+t)) add(DOC_TYPES.DPE,14);
  if (/\bdiagnostic\b|audit\s+(?:thermique|[eé]nerg[eé]tique)|[eé]tat\s+des\s+lieux\s+technique/i.test(n+' '+t)) add(DOC_TYPES.DIAGNOSTIC,8);
  if (/\bacv\b|analyse\s+du\s+cycle\s+de\s+vie|ic\s+construction|ic\s+composants/i.test(n+' '+t)) add(DOC_TYPES.CARBON,10);
  if (/etude\s+(?:thermique|energetique|énergétique)|etude\s+reglementaire|thermique\s+reglementaire|rapport\s+(?:d['’])?etude\s+(?:thermique|energetique|énergétique)/i.test(n+' '+t)) add(DOC_TYPES.THERMAL,/(?:rapport|etude|étude)[^\n]{0,30}(?:thermique|energetique|énergétique)/i.test(n)?20:10);
  if (/bao\s*evolution|bao\s*[eé]volution|catalogue\s+des\s+parois\s+de\s+l['’]?etat\s+initial|calcul\s+du\s+coefficient\s+ubat/i.test(n+' '+t)) add(DOC_TYPES.THERMAL,18);
  if(meta?.kind==='spreadsheet' && /(?:code\s+interne|nom\s+operation|maitre\s+d.?ouvrage|referentiel|total\s+logements|surface\s+batiment|ic\s+composants)/i.test(t)) add(DOC_TYPES.MANUAL,11);

  // Règles documentaires versionnées (patches) : elles renforcent la classification sans exécuter de code arbitraire.
  for(const [k,v] of Object.entries(patchClassifierScores(fileName,text))) add(k,v);

  // Règle anti-faux-positif : Th-BCE 2012 peut être cité dans un RSET RE2020, mais un RSET
  // explicitement titré « Réglementation Thermique 2012 » doit rester classé RT2012.
  if (titleRT2012){
    score[DOC_TYPES.RT2012]=(score[DOC_TYPES.RT2012]||0)+30;
    score[DOC_TYPES.RSET_RE2020]=(score[DOC_TYPES.RSET_RE2020]||0)*0.05;
    score[DOC_TYPES.RSEE_RE2020]=(score[DOC_TYPES.RSEE_RE2020]||0)*0.05;
  } else {
    if (explicitRE2020&&!explicitRT2012&&(score[DOC_TYPES.RSET_RE2020]||0)>=12) score[DOC_TYPES.RT2012]=(score[DOC_TYPES.RT2012]||0)*0.2;
    if (explicitRT2012&&!explicitRE2020) score[DOC_TYPES.RSET_RE2020]=(score[DOC_TYPES.RSET_RE2020]||0)*0.15;
  }
  if(explicitRSENV && /rsenv|rse[_ -]?env/i.test(n)){
    score[DOC_TYPES.RSENV]=(score[DOC_TYPES.RSENV]||0)+25;
    score[DOC_TYPES.RSEE_RE2020]=(score[DOC_TYPES.RSEE_RE2020]||0)*0.25;
    score[DOC_TYPES.RSET_RE2020]=(score[DOC_TYPES.RSET_RE2020]||0)*0.25;
  }
  // v2.3.3 — Synthèse ClimaWin 2020 (RE2020) : structure explicite, certaine.
  const climaWinSynth=/synthese\s+d['’]?etude\s+realisee\s+avec\s+climawin\s+2020/i.test(t)&&/calcul\s+bbio\s*:\s*resultats\s+par\s+zone|bbio\s*\(points\)|exigences\s+de\s+moyens\s*\(titre\s+iii/i.test(t);
  if(climaWinSynth){
    score[DOC_TYPES.RSET_RE2020]=(score[DOC_TYPES.RSET_RE2020]||0)+40;
    for(const k of [DOC_TYPES.RT_EXISTING,DOC_TYPES.DPE,DOC_TYPES.THERMAL,DOC_TYPES.DIAGNOSTIC,DOC_TYPES.SURFACE,DOC_TYPES.PERMIT,DOC_TYPES.AIRTIGHTNESS,DOC_TYPES.RT2012]) score[k]=(score[k]||0)*0.1;
  }
  // Rapport « Saisie détaillée » ClimaWin : données d'entrée (parois, menuiseries), pas un résultat réglementaire.
  const climaWinInput=/climawin\s+2020/i.test(t)&&/rapport\s+detaille/i.test(t)&&/\b3\.\s*parois\b/i.test(t);
  if(climaWinInput&&!climaWinSynth){
    score[DOC_TYPES.THERMAL]=(score[DOC_TYPES.THERMAL]||0)+30;
    for(const k of [DOC_TYPES.RT_EXISTING,DOC_TYPES.DPE,DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020]) score[k]=(score[k]||0)*0.1;
  }
  // Récapitulatif thermique d'un BE (BE ACT « Préconisations et remarques ») : la mention « DPE » y désigne un
  // classement informatif (« ne remplace pas un DPE »), jamais un DPE réglementaire.
  const beRecap=/performance\s+du\s+batiment\s+selon\s+la\s+re\s*2020/i.test(t)&&/(?:precon|remarques|systemes\s+principaux)/i.test(t);
  const dpeInformatif=/classement\s+dpe[^\n]{0,160}(?:titre\s+informatif|ne\s+remplace)/i.test(t);
  if(beRecap||dpeInformatif){
    if(beRecap){ score[DOC_TYPES.THERMAL]=(score[DOC_TYPES.THERMAL]||0)+34; score[DOC_TYPES.RSET_RE2020]=(score[DOC_TYPES.RSET_RE2020]||0)*0.3; }
    score[DOC_TYPES.DPE]=(score[DOC_TYPES.DPE]||0)*0.1; score[DOC_TYPES.DIAGNOSTIC]=(score[DOC_TYPES.DIAGNOSTIC]||0)*0.3;
  }
  // v2.3.6 — notices de bureau d'études reconnues par leur structure.
  if(/evaluation\s+du\s+bilan\s+carbone\s*[–-]\s*batiment/i.test(t)&&/ic\s*-?\s*construction/i.test(t)){
    score[DOC_TYPES.CARBON]=(score[DOC_TYPES.CARBON]||0)+45;
    for(const k of [DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.DPE,DOC_TYPES.THERMAL]) score[k]=(score[k]||0)*0.2;
  }
  if(/note\s*thermique|notice\s+thermique/i.test(t.slice(0,6000))&&/poste\s+batiment\s+\S+\s+batiment/i.test(t)){
    score[DOC_TYPES.THERMAL]=(score[DOC_TYPES.THERMAL]||0)+45;
    for(const k of [DOC_TYPES.DPE,DOC_TYPES.DIAGNOSTIC,DOC_TYPES.RT_EXISTING,DOC_TYPES.RSET_RE2020]) score[k]=(score[k]||0)*0.1;
  }
  if(/tableau\s+de\s+synthese\s+des\s+prestations\s+thermiques|deperditions\s+suivant\s+la\s+norme/i.test(t)){
    score[DOC_TYPES.THERMAL]=(score[DOC_TYPES.THERMAL]||0)+45;
    for(const k of [DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.DPE]) score[k]=(score[k]||0)*0.1;
  }
  if(/label\s+batiment\s+biosource/i.test(t)&&/masse\s+(?:de\s+)?(?:carbone\s+biogenique|matiere\s+biosourcee)/i.test(t)){
    score[DOC_TYPES.ENV_REPORT]=(score[DOC_TYPES.ENV_REPORT]||0)+40;
  }
  const ranked=Object.entries(score).sort((a,b)=>b[1]-a[1]);
  const type=ranked[0]?.[0]||DOC_TYPES.UNKNOWN;
  const confidence=ranked.length ? Math.min(0.99,0.45+(ranked[0][1]/22)) : 0.25;
  return {type,confidence,scores:score,reason:ranked.slice(0,3)};
}

/* ---- readers.js ---- */
const OCR_DEFAULTS={mode:'auto',lang:'fra+eng',scale:1.85,maxPixels:5200000,minChars:150};
function throwIfAborted(signal){ if(signal?.aborted){ const e=new Error(signal.reason==='analysis-timeout'?'Analyse interrompue après 5 minutes.':'Analyse annulée.'); e.name='AbortError'; throw e; } }


let OCR_ACTIVE=0;
let OCR_LIMIT=MAX_OCR_WORKERS;
const OCR_WAITING=[];
function pumpOcrQueue(){
  while(OCR_ACTIVE<OCR_LIMIT&&OCR_WAITING.length){
    const item=OCR_WAITING.shift();
    if(item.signal?.aborted){ item.reject(Object.assign(new Error('Analyse annulée.'),{name:'AbortError'})); continue; }
    OCR_ACTIVE++;
    item.cleanup?.();
    item.resolve(()=>{ OCR_ACTIVE=Math.max(0,OCR_ACTIVE-1); pumpOcrQueue(); });
  }
}
function acquireOcrSlot(signal,onWaiting=()=>{}){
  throwIfAborted(signal);
  if(OCR_ACTIVE<OCR_LIMIT){ OCR_ACTIVE++; return Promise.resolve(()=>{ OCR_ACTIVE=Math.max(0,OCR_ACTIVE-1); pumpOcrQueue(); }); }
  onWaiting(OCR_ACTIVE,OCR_WAITING.length+1);
  return new Promise((resolve,reject)=>{
    const item={signal,resolve,reject,cleanup:null};
    const abort=()=>{ const i=OCR_WAITING.indexOf(item); if(i>=0) OCR_WAITING.splice(i,1); reject(Object.assign(new Error('Analyse annulée.'),{name:'AbortError'})); };
    item.cleanup=()=>signal?.removeEventListener('abort',abort);
    signal?.addEventListener('abort',abort,{once:true}); OCR_WAITING.push(item);
  });
}
function setOcrConcurrencyLimit(limit=MAX_OCR_WORKERS){
  const next=Math.max(1,Math.min(2,Math.round(Number(limit)||MAX_OCR_WORKERS)));
  OCR_LIMIT=next;
  pumpOcrQueue();
  return OCR_LIMIT;
}
function ocrPoolStatus(){ return {active:OCR_ACTIVE,waiting:OCR_WAITING.length,max:OCR_LIMIT}; }

function groupItemsIntoLines(items, yTolerance=2.8) {
  const enriched=items.map((it,idx)=>({text:it.str||'',x:it.transform?.[4]||0,y:it.transform?.[5]||0,w:it.width||0,h:Math.abs(it.transform?.[3]||it.height||0),idx})).filter(i=>i.text.trim());
  // v2.3 — tri strict (ordre total) : y décroissant puis x croissant. L'ancien comparateur intégrait
  // la tolérance et n'était pas transitif, ce qui pouvait mélanger les fragments des pages denses.
  enriched.sort((a,b)=>(b.y-a.y)||(a.x-b.x));
  // Regroupement linéaire ; la tolérance s'adapte à la hauteur de police et compare au y moyen de la ligne.
  const lines=[]; let current=null;
  for(const item of enriched){
    const tol=Math.max(yTolerance,Math.min(6,(item.h||0)*0.45));
    if(!current || Math.abs(current.y-item.y)>tol){ current={y:item.y,sumY:0,n:0,items:[]}; lines.push(current); }
    current.items.push(item); current.sumY+=item.y; current.n++; current.y=current.sumY/current.n;
  }
  return lines.map((line,index)=>{
    line.items.sort((a,b)=>a.x-b.x);
    let text=''; let prev=null;
    for(const it of line.items){ if(prev){ const gap=it.x-(prev.x+prev.w); if(gap>2) text+=' '; } text+=it.text; prev=it; }
    return {index,y:line.y,text:normalizeText(text),items:line.items.map(it=>({text:it.text,x:it.x}))};
  }).filter(l=>l.text);
}

function ocrTextToLines(text=''){
  return String(text||'').split(/\r?\n/).map(normalizeText).filter(Boolean).map((text,index)=>({index,y:null,text,items:[],ocr:true}));
}
// v2.3 — lignes OCR géolocalisées : les boîtes Tesseract (pixels du canvas, origine en haut)
// sont reconverties dans le repère PDF.js (points, origine en bas) pour que les parseurs
// positionnels (colonnes, bâtiment courant, contexte avant/après) fonctionnent aussi sur l'OCR.
function ocrBlocksToLines(blocks,geometry={}){
  const scale=Number(geometry.scale)||1, baseHeight=Number(geometry.baseHeight)||0;
  const out=[];
  for(const block of blocks||[]) for(const para of block?.paragraphs||[]) for(const line of para?.lines||[]){
    const text=normalizeText(line?.text||''); if(!text) continue;
    const bb=line.bbox||{}; const yPix=((Number(bb.y0)||0)+(Number(bb.y1)||0))/2;
    const words=(line.words||[]).filter(w=>String(w?.text||'').trim()).map(w=>({text:String(w.text),x:(Number(w.bbox?.x0)||0)/scale}));
    out.push({y:baseHeight?baseHeight-yPix/scale:-yPix/scale,text,items:words,ocr:true});
  }
  out.sort((a,b)=>b.y-a.y);
  return out.map((l,index)=>({...l,index}));
}

// v2.3.5 — couche texte « brouillée » : certaines polices (Type 3 / sous-ensembles sans table Unicode)
// produisent des lettres et symboles plausibles mais qui ne forment aucun mot (« %&'()*+,+-(./ »).
// Les mesures alphanumériques ne la détectent pas : on mesure la part de mots français / techniques courants.
const COMMON_WORDS=new Set(('de des du la le les et en a au aux un une pour par sur dans avec sans est sont ou que qui ne pas '+
  'total valeur projet batiment batiments zone zones surface page lot lots energie chauffage eau ecs ventilation type nom date '+
  'operation etude reference indicateur donnees contribution composant chantier mois an annee nombre logement logements usage '+
  'max min moyenne plancher planchers toiture mur murs paroi parois isolant isolation menuiseries fenetre vitrage beton bois acier '+
  'reseau chaleur electricite gaz conforme non oui unite quantite chapitre fiche base resultat resultats exigence exigences').split(' '));
function garbledTextRatio(text=''){
  const norm=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const toks=(norm.match(/[a-z]{3,}/g)||[]);
  if(toks.length<20) return null;
  return toks.filter(t=>COMMON_WORDS.has(t)).length/toks.length;
}
function symbolRatio(text=''){ const raw=String(text||'').replace(/\s+/g,''); if(raw.length<80) return 0; return (raw.match(/[!"#$%&()*+\/:;<=>?@[\]^_`{|}~]/g)||[]).length/raw.length; }
function isGarbledTextLayer(text=''){ const r=garbledTextRatio(text); return symbolRatio(text)>0.12||(r!==null&&r<0.02); }
function pdfTextQuality(text='',items=[]){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  if(!raw) return {score:0,chars:0,alnumRatio:0,weirdRatio:1,fragmentRatio:1};
  const chars=raw.length;
  const alnum=(raw.match(/[A-Za-zÀ-ÿ0-9]/g)||[]).length;
  const weird=(raw.match(/[�□■◆◇▯����]/g)||[]).length;
  const tokens=raw.split(/\s+/).filter(Boolean);
  const fragments=tokens.filter(t=>t.length===1&&!/[0-9A-Za-zÀ-ÿ]/.test(t)).length;
  const alnumRatio=alnum/Math.max(1,chars);
  const weirdRatio=weird/Math.max(1,chars);
  const fragmentRatio=fragments/Math.max(1,tokens.length);
  const lengthScore=Math.min(1,chars/520);
  const itemScore=Math.min(1,(items?.length||0)/65);
  const score=Math.max(0,Math.min(1,lengthScore*.28+alnumRatio*.38+itemScore*.20+(1-Math.min(1,weirdRatio*7))*.09+(1-Math.min(1,fragmentRatio*4))*.05));
  // Une couche brouillée vaut une couche vide : l'OCR devient la base principale.
  if(isGarbledTextLayer(raw)) return {score:0.05,chars,alnumRatio,weirdRatio,fragmentRatio,garbled:true};
  return {score,chars,alnumRatio,weirdRatio,fragmentRatio};
}


function countNumericTokens(line=''){
  return (String(line).match(/(?<![A-Za-zÀ-ÿ])[-+]?\d+(?:[,.]\d+)?/g)||[]).length;
}
function criticalTableNeedsOcr(text=''){
  const raw=String(text||'');
  const low=normalizeText(raw).toLowerCase();
  const lines=raw.split(/\r?\n/).map(normalizeText).filter(Boolean);
  // SHAB : l'en-tête est visible mais aucune ligne de zone exploitable n'est reconstruite.
  if(/surface\s+utile\s+(?:su|surt)|surf\.?\s*hab\.?\s*shab|shab\s+ou\s+surt|s\s*ref\s*\/\s*usage\s+principal|surface\s+habitable(?:\s+du\s+batiment)?|surface\s+du\s+batiment/.test(low)){
    const zoneRows=lines.filter(l=>/^zone\b/i.test(l)&&countNumericTokens(l)>=2).length;
    const explicitRows=lines.filter(l=>/(?:\bshab\s+ou\s+surt\b|\bshab\s*\/\s*su\b|\bs\s*ref\s*\/\s*usage\s+principal\b|^\s*s\s*ref\s*:|^\s*surface\s+(?:habitable|du\s+batiment)\b)/i.test(l)&&countNumericTokens(l)>=1).length;
    if(zoneRows===0&&explicitRows===0) return true;
  }
  // Cep détaillé : titre détecté mais aucune ligne bâtiment suffisamment structurée.
  if(/resultats?\s+detaille?s?\s+des\s+consommations\s+annuelles|consommations\s+annuelles\s+par\s+poste/.test(low)){
    const structured=lines.some(l=>/^(?:batiment|bâtiment)\b/i.test(l)&&countNumericTokens(l)>=6);
    const postRows=lines.filter(l=>/^(?:chauffage|refroidissement|ecs|eclairage|éclairage|auxiliaires|deplacement)/i.test(l)&&countNumericTokens(l)>=1).length;
    if(!structured&&postRows<3) return true;
  }
  // Bao Evolution / audits de rénovation : ces pages portent des consommations d'énergie primaire
  // par poste. Si l'en-tête existe mais que les lignes du tableau sont trop fragmentées, on OCRise
  // uniquement cette page afin de sécuriser Cep avant/après et les postes détaillés.
  if(/details\s+des\s+consommations/.test(low) && /energie\s+primaire/.test(low)){
    const labels=['chauffage','refroidissement','ecs','eclairage','auxiliaires','ventilateurs','autres usages'];
    const labelHits=labels.filter(label=>low.includes(label)).length;
    const numericPostRows=lines.filter(l=>/^(?:chauffage|refroidissement|ecs|eau\s+chaude|eclairage|éclairage|auxiliaires|ventilateurs|autres\s+usages|electricit)/i.test(l)&&countNumericTokens(l)>=2).length;
    const totalPrimary=lines.some(l=>/^total\b/i.test(l)&&countNumericTokens(l)>=2)||/total\s+kwh\s*ep\s*\/\s*m[²2]/i.test(low);
    if(labelHits<6||numericPostRows<4||!totalPrimary) return true;
  }
  // Le bilan GES Bao est court mais essentiel : OCR ciblé si les libellés sont visibles sans leurs valeurs.
  if(/evolution\s+emission\s+ges|emission\s+de\s+co2\s+avant\s+travaux/.test(low)){
    const gesRows=lines.filter(l=>/emission\s+de\s+co2\s+(?:avant|apres|après|des\s+travaux)/i.test(l)&&countNumericTokens(l)>=1).length;
    if(gesRows<2) return true;
  }
  // Bao : les pages Ubat, enveloppe et systèmes ont une structure stable. Si leur titre est lisible
  // mais que la valeur/ligne métier manque dans la couche texte, on OCRise uniquement cette page.
  if(/calcul\s+du\s+coefficient\s+ubat/.test(low) && !/coefficient\s+ubat\s*=\s*[-+]?\d+(?:[,.]\d+)?/.test(low)) return true;
  if(/details\s+des\s+parois/.test(low)){
    const compositionRows=lines.filter(l=>/(?:laine|isover|polysty|polyurethane|fibre\s+de\s+bois|ouate|brique|beton|béton)/i.test(l)&&countNumericTokens(l)>=1).length;
    if(compositionRows<2) return true;
  }
  if(/catalogue\s+des\s+vitrages/.test(low)){
    const vitrageRows=lines.filter(l=>/^fe\d+\b/i.test(l)&&countNumericTokens(l)>=2).length;
    if(vitrageRows<2 || (!/\bdouble\b|\btriple\b/i.test(low) && !/\buw\b/i.test(low))) return true;
  }
  if(/saisie\s+de\s+la\s+ventilation|saisie\s+de\s+l['’]?ecs|saisie\s+des\s+generations/.test(low)){
    const signals=['systeme de ventilation','type d ecs','type de stockage','type de generateur','type d energie pour la production de chaud'];
    const hits=signals.filter(x=>low.includes(x)).length;
    if(hits===0) return true;
  }
  // ACV / RSENV : si le tableau résumé des lots est détecté mais ses totaux sont cassés,
  // l'OCR de secours est utile même quand la couche texte générale semble bonne.
  if(/(?:1\s*[-–—]\s*vrd|energie\s*\(\s*ce\s*\)|iccomposant|ic\s*composant)/.test(low) && /total\s*(?:lot)?\s*:/.test(low)){
    const totals=lines.filter(l=>/^total\s*(?:lot)?\s*:/i.test(l)&&countNumericTokens(l)>=5).length;
    if(totals<2) return true;
  }
  return false;
}

function shouldOcrPdfPage(text='',items=[],mode='auto'){
  if(mode==='off') return false;
  if(mode==='always'||mode==='max') return true;
  const q=pdfTextQuality(text,items);
  // Priorité aux pages métier réellement incomplètes. Une page courte mais propre (titre,
  // graphique, séparation de chapitre) ne doit plus déclencher Tesseract à elle seule.
  if(criticalTableNeedsOcr(text)) return true;
  if(q.chars===0 || (items?.length||0)===0) return true;
  const cleanShortPage=q.chars>=24 && q.alnumRatio>=0.62 && q.weirdRatio<=0.012 && q.fragmentRatio<=0.12;
  if(cleanShortPage) return false;
  // OCR automatique seulement si la couche texte est réellement pauvre ou corrompue.
  if(q.chars<45 || (items?.length||0)<3) return q.alnumRatio<0.48 || q.weirdRatio>0.02 || q.fragmentRatio>0.22;
  return q.score<0.43 || q.weirdRatio>0.03 || q.fragmentRatio>0.24;
}

function mergePdfAndOcrLines(pdfLines=[],ocrLines=[],pdfQuality=null,ocrQuality=null){
  if(!ocrLines.length) return {lines:pdfLines,source:'pdf'};
  if(!pdfLines.length) return {lines:ocrLines,source:'ocr'};
  const pq=pdfQuality?.score??0, oq=ocrQuality?.score??0;
  // Si la couche texte est très faible, l'OCR devient la base principale.
  if(oq>pq+0.17 || pq<0.42) return {lines:ocrLines,source:'ocr'};
  // Sinon on garde la géométrie PDF.js et on ajoute seulement les lignes OCR nouvelles.
  const seen=new Set(pdfLines.map(l=>normalizeText(l.text).toLowerCase()));
  const extra=ocrLines.filter(l=>{ const k=normalizeText(l.text).toLowerCase(); if(!k||seen.has(k)) return false; seen.add(k); return true; });
  if(!extra.length) return {lines:pdfLines,source:'pdf'};
  // v2.3 — insertion à leur position verticale réelle quand les deux couches sont géolocalisées,
  // au lieu d'un ajout en fin de page qui cassait les contextes avant/après.
  const geo=pdfLines.every(l=>Number.isFinite(l.y))&&extra.every(l=>Number.isFinite(l.y));
  const merged=geo?[...pdfLines,...extra].sort((a,b)=>b.y-a.y):[...pdfLines,...extra];
  return {lines:merged.map((l,i)=>({...l,index:i})),source:'hybrid'};
}

async function renderPdfPageForOcr(page,opts={}){
  const base=page.getViewport({scale:1});
  const wanted=opts.scale||OCR_DEFAULTS.scale;
  const maxPixels=opts.maxPixels||OCR_DEFAULTS.maxPixels;
  const scale=Math.min(wanted,Math.sqrt(maxPixels/Math.max(1,base.width*base.height)));
  const viewport=page.getViewport({scale:Math.max(1.25,scale)});
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.floor(viewport.width)); canvas.height=Math.max(1,Math.floor(viewport.height));
  const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:true});
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:ctx,viewport,background:'white'}).promise;
  try{ canvas._etGeometry={scale:viewport.width/Math.max(1,base.width),baseHeight:base.height}; }catch{}
  return canvas;
}

async function createOcrWorker(lang,onLog=()=>{}){
  if(!globalThis.Tesseract?.createWorker) return null;
  return globalThis.Tesseract.createWorker(lang||OCR_DEFAULTS.lang,1,{logger:onLog});
}

async function readPdf(file, onProgress=()=>{}, options={}) {
  if(!globalThis.pdfjsLib) throw new Error('PDF.js non chargé. Vérifiez la connexion au premier chargement.');
  globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const opts={...OCR_DEFAULTS,...options};
  if(opts.mode==='max'){ opts.scale=Math.max(Number(opts.scale)||0,3.0); opts.maxPixels=Math.max(Number(opts.maxPixels)||0,8000000); opts.minChars=0; }
  throwIfAborted(opts.signal);
  const ocrPages=[]; const ocrWarnings=[]; let activeOcrPage=1; let totalPages=1; let worker=null; let abortedWorker=false,releaseOcrSlot=null;
  const workerEnabled=opts.mode!=='off'&&!!globalThis.Tesseract?.createWorker;
  let workerInitError=null;
  let data=null, loadingTask=null, pdf=null;
  const pages=[];
  const ensureWorker=async()=>{
    if(worker||workerInitError||!workerEnabled) return worker;
    try{
      releaseOcrSlot=await acquireOcrSlot(opts.signal,(active,waiting)=>onProgress(.01,{stage:'ocr-wait',page:activeOcrPage,totalPages,message:`OCR en attente · ${active}/${OCR_LIMIT} actif · file ${waiting}`}));
      worker=await createOcrWorker(opts.lang,m=>{
        if(m?.status==='recognizing text'&&Number.isFinite(m.progress)) onProgress(((activeOcrPage-1)+.25+.68*m.progress)/Math.max(1,totalPages),{stage:'ocr',page:activeOcrPage,totalPages,ocrProgress:m.progress,message:`OCR · page ${activeOcrPage}/${totalPages} · ${Math.round(m.progress*100)} %`});
        else if(m?.status) onProgress(.01,{stage:'ocr-init',page:activeOcrPage,totalPages,message:`Initialisation OCR · ${m.status}`});
      });
      if(worker&&opts.mode==='max'&&typeof worker.setParameters==='function') try{ await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'}); }catch{}
    }catch(err){ workerInitError=err; if(releaseOcrSlot){ releaseOcrSlot(); releaseOcrSlot=null; } }
    return worker;
  };
  const abortHandler=()=>{ abortedWorker=true; if(worker){ try{worker.terminate();}catch{} } if(loadingTask){ try{loadingTask.destroy?.();}catch{} } };
  opts.signal?.addEventListener('abort',abortHandler,{once:true});
  try{
    data=await file.arrayBuffer();
    throwIfAborted(opts.signal);
    loadingTask=globalThis.pdfjsLib.getDocument({data});
    pdf=await loadingTask.promise;
    data=null; // PDF.js possède désormais sa copie ; libère la référence au gros ArrayBuffer du fichier.
    throwIfAborted(opts.signal);
    totalPages=pdf.numPages;
    for(let p=1;p<=pdf.numPages;p++){
      throwIfAborted(opts.signal);
      let page=null, content=null, canvas=null;
      try{
        page=await pdf.getPage(p);
        content=await page.getTextContent({includeMarkedContent:true});
        throwIfAborted(opts.signal);
        const pdfLines=groupItemsIntoLines(content.items);
        const pdfText=pdfLines.map(l=>l.text).join('\n');
        const pdfQuality=pdfTextQuality(pdfText,content.items);
        let finalLines=pdfLines, textSource='pdf', ocrConfidence=null;
        const needOcr=shouldOcrPdfPage(pdfText,content.items,opts.mode);
        onProgress(((p-1)+.18)/pdf.numPages,{stage:'pdf',page:p,totalPages:pdf.numPages,message:`Lecture PDF page ${p}/${pdf.numPages}`});
        if(needOcr){
          activeOcrPage=p;
          if(workerEnabled&&!worker&&!workerInitError) await ensureWorker();
          if(!globalThis.Tesseract?.createWorker){
            ocrWarnings.push(`Page ${p} : OCR requis mais Tesseract.js n'est pas chargé.`);
          } else if(!worker){
            ocrWarnings.push(`Page ${p} : worker OCR indisponible${workerInitError?` (${workerInitError?.message||workerInitError})`:''}.`);
          } else {
            try{
              canvas=await renderPdfPageForOcr(page,opts);
              let ret;
              try{ ret=await worker.recognize(canvas,{},{text:true,blocks:true}); }
              catch(optErr){ ret=await worker.recognize(canvas); }
              throwIfAborted(opts.signal);
              const ocrText=String(ret?.data?.text||'');
              ocrConfidence=Number.isFinite(ret?.data?.confidence)?ret.data.confidence:null;
              const geoLines=Array.isArray(ret?.data?.blocks)?ocrBlocksToLines(ret.data.blocks,canvas._etGeometry):[];
              const ocrLines=geoLines.length?geoLines:ocrTextToLines(ocrText);
              const ocrQuality=pdfTextQuality(ocrText,ocrLines.map(l=>({str:l.text})));
              const merged=mergePdfAndOcrLines(pdfLines,ocrLines,pdfQuality,ocrQuality);
              finalLines=merged.lines; textSource=merged.source; ocrPages.push(p);
            }catch(err){ if(opts.signal?.aborted) throw err; ocrWarnings.push(`Page ${p} : échec OCR (${err?.message||err}).`); }
          }
        }
        const text=finalLines.map(l=>l.text).join('\n');
        // Ne conserver que les structures réellement utilisées par les parseurs.
        // Pas de copie page.items ni de copie ocrText : ces objets doublaient/triplaient la RAM.
        pages.push({page:p,text,lines:finalLines,textSource,pdfTextQuality:pdfQuality.score,ocrConfidence});
        onProgress(p/pdf.numPages,{stage:'page-done',page:p,totalPages:pdf.numPages,message:`Page ${p}/${pdf.numPages} lue${textSource==='ocr'?' · OCR':textSource==='hybrid'?' · PDF + OCR':''}`});
        // Rend la main à l'UI entre deux pages pour éviter le message « page ne répond pas ».
        await new Promise(resolve=>setTimeout(resolve,0));
      } finally {
        if(canvas){ try{canvas.width=1; canvas.height=1; canvas.remove?.();}catch{} canvas=null; }
        if(content?.items){ try{content.items.length=0;}catch{} }
        if(page){ try{page.cleanup?.();}catch{} }
        content=null; page=null;
      }
    }
    const text=pages.map(p=>p.text).join('\n\f\n');
    return {kind:'pdf',pages,text,pageCount:totalPages,ocr:{mode:opts.mode,used:ocrPages.length>0,pages:ocrPages,warnings:ocrWarnings,engine:'Tesseract.js',languages:opts.lang,parallelism:`global-pool-${OCR_LIMIT}`,quality:opts.mode==='max'?'maximum':'standard'}};
  } finally {
    opts.signal?.removeEventListener('abort',abortHandler);
    if(worker&&!abortedWorker){ try{await worker.terminate();}catch{} }
    worker=null;
    if(releaseOcrSlot){ releaseOcrSlot(); releaseOcrSlot=null; }
    if(pdf){ try{pdf.cleanup?.();}catch{} try{await pdf.destroy?.();}catch{} }
    else if(loadingTask){ try{await loadingTask.destroy?.();}catch{} }
    pdf=null; loadingTask=null; data=null;
  }
}

function compactReadForRetention(read){
  if(!read) return null;
  if(read.retainedCompact) return read;
  // Compactage en place : évite de dupliquer toutes les lignes d'un gros PDF juste après parsing.
  // Les parseurs ont déjà consommé la géométrie PDF.js ; texte, cellules Excel et indicateurs OCR suffisent ensuite.
  for(const page of read.pages||[]){
    const compactLines=[];
    for(const line of page.lines||[]){
      const clean={index:Number.isFinite(line.index)?line.index:0,text:String(line.text||'')};
      if(Array.isArray(line.cells)) clean.cells=line.cells.map(v=>v==null?'':String(v));
      if(line.ocr) clean.ocr=true;
      compactLines.push(clean);
    }
    page.lines=compactLines;
    page.text=String(page.text||compactLines.map(l=>l.text).join('\n'));
    // Ces propriétés sont les seules métadonnées de page conservées volontairement.
    for(const key of Object.keys(page)) if(!['page','sheet','text','lines','textSource','pdfTextQuality','ocrConfidence','re2020Building'].includes(key)) delete page[key];
  }
  read.text=String(read.text||(read.pages||[]).map(p=>p.text||'').join('\n\f\n'));
  read.pageCount=Number.isFinite(read.pageCount)?read.pageCount:(read.pages||[]).length;
  read.retainedCompact=true;
  return read;
}

async function readXml(file){
  const text=await file.text();
  return readXmlText(text);
}
function readXmlText(text){
  const xml=parseXmlDocument(text);
  // v2.3 — XML RE2020 (RSEE / RSET / RSEnv) : extraction structurée par balises normalisées.
  // Le texte conservé est une synthèse lisible (une page par bâtiment) et non l'arbre complet,
  // qui pèse souvent plus de 10 Mo et noyait les parseurs texte sous les sorties mensuelles.
  if(isRe2020XmlDocument(xml)){
    const re2020=extractRe2020(xml);
    const pages=re2020SummaryPages(re2020);
    const normalized=pages.map(p=>p.text).join('\n\f\n');
    return {kind:'xml',xmlFormat:'re2020',re2020,pages,text:normalized,pageCount:pages.length};
  }
  const rows=[]; let idx=0;
  const walk=(node,path=[])=>{
    for(const child of Array.from(node.children||[])){ const p=[...path,child.tagName]; const kids=Array.from(child.children||[]); const value=(kids.length===0?String(child.textContent||''):'').trim(); if(value) rows.push(`${p.join(' > ')} = ${value}`); walk(child,p); }
  }; walk(xml.documentElement,[xml.documentElement.tagName]);
  const normalized=rows.join('\n'); return {kind:'xml',pages:[{page:1,text:normalized,lines:rows.map(text=>({index:idx++,text}))}],text:normalized,pageCount:1};
}

async function readSpreadsheet(file){
  if(!globalThis.XLSX) throw new Error('SheetJS non chargé. Vérifiez la connexion au premier chargement.');
  const data=await file.arrayBuffer(); const wb=globalThis.XLSX.read(data,{type:'array',cellDates:false,raw:false});
  const pages=[]; let p=1;
  for(const name of wb.SheetNames){ const ws=wb.Sheets[name]; const matrix=globalThis.XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
    const lines=matrix.map((row,index)=>({index,text:normalizeText(row.map(v=>String(v??'')).join(' | ')),cells:row})).filter(l=>l.text.replace(/\|/g,'').trim());
    pages.push({page:p++,sheet:name,text:lines.map(l=>l.text).join('\n'),lines});
  }
  return {kind:'spreadsheet',pages,text:pages.map(p=>`[${p.sheet}]\n${p.text}`).join('\n\f\n'),pageCount:pages.length};
}

async function readFile(file,onProgress=()=>{},options={}){
  throwIfAborted(options.signal); const lower=file.name.toLowerCase();
  if(lower.endsWith('.pdf')) return readPdf(file,onProgress,options);
  if(lower.endsWith('.xml')) return readXml(file);
  if(lower.endsWith('.xlsx')||lower.endsWith('.xls')) return readSpreadsheet(file);
  throw new Error(`Format non pris en charge : ${file.name}`);
}

function makeDocumentRecord(file){ return {id:uid('doc'),file,name:file.name,size:file.size,type:'En attente',classification:null,read:null,status:'pending',error:null}; }

/* ---- routing.js ---- */
const KEY='prestaterreExtract.sourceRules.v2';
function loadSourceRules(){
  try{ const s=JSON.parse(localStorage.getItem(KEY)); return s&&typeof s==='object'?mergeRules(s):structuredClone(DEFAULT_SOURCE_RULES); }catch{return structuredClone(DEFAULT_SOURCE_RULES);}
}
function saveSourceRules(rules){ localStorage.setItem(KEY,JSON.stringify(rules)); }
function resetSourceRules(){ localStorage.removeItem(KEY); return structuredClone(DEFAULT_SOURCE_RULES); }
function mergeRules(custom){ const out=structuredClone(DEFAULT_SOURCE_RULES); for(const [k,v] of Object.entries(custom||{})){ if(FIELD_MAP[k]&&v) out[k]={main:Array.isArray(v.main)?v.main:out[k].main,secondary:Array.isArray(v.secondary)?v.secondary:out[k].secondary,forbidden:Array.isArray(v.forbidden)?v.forbidden:out[k].forbidden}; } return out; }
function sourceTier(field,docType,rules){ const r=rules[field]||DEFAULT_SOURCE_RULES[field]; if(!r) return 'unrouted'; if(r.forbidden.includes(docType)) return 'forbidden'; if(r.main.includes(docType)) return 'main'; if(r.secondary.includes(docType)) return 'secondary'; return 'unrouted'; }
function sourceRank(field,docType,rules){ const r=rules[field]||DEFAULT_SOURCE_RULES[field]; if(!r) return 999; const mi=r.main.indexOf(docType); if(mi>=0) return mi; const si=r.secondary.indexOf(docType); if(si>=0) return 100+si; if(r.forbidden.includes(docType)) return 10000; return 1000; }

/* ---- parsers.js ---- */
function occ(doc,page,line,field,value,method,confidence=0.75,unit='',extra={}){
  if(value===null||value===undefined||value==='') return null;
  return {field,value,building:buildingForPosition(doc,page.page,line.index),docId:doc.id,fileName:doc.name,docType:doc.type,page:page.page,excerpt:normalizeText(line.text).slice(0,420),confidence:clamp(confidence),method,unit,...extra};
}
function push(out,o){ if(o) out.push(o); }
function lineWindow(page,i,before=2,after=2){ const ls=page.lines||[]; return ls.slice(Math.max(0,i-before),Math.min(ls.length,i+after+1)).map(x=>x.text).join(' | '); }
function firstValueAfterLabel(text,labelRe){ const flags=labelRe.flags.includes('i')?'i':''; const clean=normalizeText(maskNonDataNumerics(text)); const m=clean.match(new RegExp(`(?:${labelRe.source})[^0-9+-]{0,90}([-+]?\\d+(?:[\\s.]\\d{3})*(?:[,.]\\d+)?)`,flags)); return m?parseFrNumber(m[1]):null; }
function phaseFromContext(text,doc){
  const s=normLower(`${doc.name} ${text}`);
  if(/\b(?:avant\s+travaux|etat\s+initial|etat\s+existant|existant|initial|avant\s+renovation|situation\s+initiale)\b/.test(s)) return 'before';
  if(/\b(?:apres\s+travaux|etat\s+projet|projet|projete|final|reception|neuf|remplace|nouveau|future?)\b/.test(s)) return 'after';
  if(doc.type===DOC_TYPES.RT_EXISTING) return 'before';
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(doc.type)) return 'after';
  return 'unknown';
}
function targetFromContext(s){ if(ELEMENT_PATTERNS.wall.test(s)) return 'wall'; if(ELEMENT_PATTERNS.floor.test(s)) return 'floor'; if(ELEMENT_PATTERNS.roof.test(s)) return 'roof'; return null; }
function explicitThickness(s){
  const m=s.match(/(?:ep(?:aisseur)?\.?|e)\s*(?:isolant(?:e)?\s*)?(?:=|:)?\s*(\d{1,4}(?:[,.]\d+)?)\s*(mm|cm|m)\b/i)||s.match(/\b(\d{2,4}(?:[,.]\d+)?)\s*(mm|cm)\b/i);
  if(!m) return null; let v=parseFrNumber(m[1]); const u=m[2].toLowerCase(); if(u==='cm') v*=10; if(u==='m') v*=1000; return v;
}
function explicitR(s){ const m=s.match(/(?:\bresistance\s+thermique\b|\bR\b)\s*(?:thermique\s*)?(?:=|:|de)?\s*(\d+(?:[,.]\d+)?)/i); return m?parseFrNumber(m[1]):null; }

function rowNumericValues(line){
  const items=(line?.items||[]).map(it=>({text:normalizeText(it.text||it.str||''),x:Number(it.x)||0}));
  const nums=[];
  for(const it of items){ if(/^[-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?$/.test(it.text)){ const v=parseFrNumber(it.text); if(v!==null) nums.push({...it,value:v}); } }
  return nums;
}
function valueNearestX(line,targetX,maxDistance=95){
  if(targetX==null) return null; const nums=rowNumericValues(line); if(!nums.length) return null;
  nums.sort((a,b)=>Math.abs(a.x-targetX)-Math.abs(b.x-targetX)); return Math.abs(nums[0].x-targetX)<=maxDistance?nums[0].value:null;
}
function headerXNear(lines,start,re){
  for(let k=Math.max(0,start-1);k<=Math.min(lines.length-1,start+2);k++){
    for(const it of lines[k].items||[]){ const t=normalizeText(it.text||it.str||''); if(re.test(t)) return Number(it.x)||null; }
  }
  return null;
}
function shabValueFromRow(line,shabX=null){
  const xVal=valueNearestX(line,shabX,125); if(xVal!==null && xVal>0) return xVal;
  let nums=numbersIn(line.text||'');
  if(nums.length<2) return null;
  const low=normLower(line.text||'');
  // Une ligne peut commencer par « Zone 02 » : l'identifiant de zone n'est pas une surface.
  if(/^zone\s+\d+\b/.test(low) && nums.length>=3) nums=nums.slice(1);
  // Dans les tableaux Chapitre 2 RT2012/RE2020 : première valeur = surface réglementaire,
  // deuxième valeur = colonne « Surface utile ... / SHAB », puis viennent CE1/CE2/.../groupes.
  if(nums.length>=2 && nums[0]>0 && nums[1]>=0) return nums[1];
  return null;
}
function rsetShabFromChapter2(doc){
  const out=[];
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const h=normalizeText(lines[i].text);
      if(!/surface\s+utile\s+(?:su|surt)|surf\.?\s*hab\.?\s*shab/i.test(h)) continue;
      const building=buildingForPosition(doc,page.page,lines[i].index);
      const shabX=headerXNear(lines,i,/surface\s+utile|\bshab\b/i);
      const rows=[];
      for(let j=i+1;j<Math.min(lines.length,i+40);j++){
        const line=lines[j], t=normalizeText(line.text), low=normLower(t);
        if(/^(?:nombre\s+de\s+logements|type\s+de\s+construction|type\s+de\s+r[eé]seau|exigences?\s+de\s+r[eé]sultat|batiment\s*:|bâtiment\s*:)/i.test(t)) break;
        // Les vraies lignes de zones contiennent le libellé ZONE et au moins deux valeurs de surface.
        // Avec extraction PDF, le libellé et les valeurs sont normalement sur la même ligne.
        if(!/^zone\b/i.test(t) || /^zone\(s\)\s+du\s+batiment|^zone\(s\)\s+du\s+bâtiment/i.test(t)) continue;
        const v=shabValueFromRow(line,shabX);
        if(v!==null && v>0){ rows.push({label:t.replace(/\s+/g,' ').slice(0,120),value:v,line}); continue; }
        // Certains PDF scindent le libellé et les chiffres : regarder uniquement les 3 lignes suivantes,
        // sans jamais prendre un « m2 » d'en-tête comme valeur.
        for(let k=j+1;k<Math.min(lines.length,j+4);k++){
          const nt=normalizeText(lines[k].text);
          if(/\bzone\b/i.test(nt)) break;
          const nv=shabValueFromRow(lines[k],shabX);
          if(nv!==null && nv>0 && numbersIn(nt).length>=2){ rows.push({label:t,value:nv,line:lines[k]}); j=k; break; }
        }
      }
      if(!rows.length) continue;
      // Uniquement une occurrence par ligne de zone ; ne jamais sommer deux extractions du même groupe.
      const seen=new Set(), uniq=[];
      for(const r of rows){ const k=`${r.line.index}|${Math.round(r.value*1000)}`; if(!seen.has(k)){seen.add(k);uniq.push(r);} }
      const sum=Math.round(uniq.reduce((a,r)=>a+r.value,0)*1000)/1000;
      const detail=uniq.map(r=>`${r.label}: ${String(r.value).replace('.',',')} m²`).join(' + ');
      push(out,occ(doc,page,uniq[0].line,'shab',sum,'rset:chapter2-shab-column',0.995,'m²',{building,surfacePriority:101,derivedFromDocument:uniq.length>1,origin:'RSET Chapitre 2',excerpt:`Chapitre 2 — colonne « Surface utile SU/SURT ou surf. hab. SHAB » : ${detail}${uniq.length>1?` = ${String(sum).replace('.',',')} m²`:''}`,provenanceNote:uniq.length>1?'SHAB = somme stricte des lignes de zones dans la colonne « Surface utile SU/SURT ou surf. hab. SHAB » du Chapitre 2 pour ce bâtiment.':'SHAB lue directement dans la colonne « Surface utile SU/SURT ou surf. hab. SHAB » du Chapitre 2.'}));
    }
  }
  // Un seul résultat SHAB final par bâtiment, même si l'en-tête est scindé sur plusieurs lignes.
  const best=new Map();
  for(const o of out){ const cur=best.get(o.building); if(!cur || String(o.excerpt||'').length>String(cur.excerpt||'').length) best.set(o.building,o); }

  // Secours strict : certains RSET répètent explicitement « SHAB ou SURT 1 169,1 m² »
  // dans les feuillets techniques. On ne l'utilise que si le Chapitre 2 n'a rien fourni
  // pour ce bâtiment et si une vraie surface (>20 m²) est portée par la même ligne.
  for(const page of doc.read.pages||[]){
    for(const line of page.lines||[]){
      const t=normalizeText(line.text), low=normLower(t);
      if(!/\bshab\s+ou\s+surt\b|\bsurf\.?\s*hab\.?\s*shab\b/i.test(t)) continue;
      if(/ratio|1\s*\/\s*6|tic\b|tic\s*r[eé]f|surface\s+utile\s+surt/i.test(low)) continue;
      const vals=numbersIn(t).filter(v=>Number.isFinite(v)&&v>20&&v<100000);
      if(!vals.length) continue;
      const building=buildingForPosition(doc,page.page,line.index);
      if(best.has(building)) continue;
      const value=vals[0];
      best.set(building,occ(doc,page,line,'shab',value,'rset:explicit-shab-fallback',0.96,'m²',{building,surfacePriority:100,origin:'RSET — mention SHAB explicite',excerpt:t.slice(0,420),provenanceNote:'Valeur utilisée uniquement en secours car la ligne porte explicitement la mention « SHAB ou SURT » avec une surface exploitable.'}));
    }
  }
  return [...best.values()].filter(Boolean);
}
function plausibleBuildingSurface(value){
  return Number.isFinite(value) && value>=10 && value<1000000;
}
function parseBuildingSurface(doc){
  const out=[];
  // Le champ historique `shab` devient le champ de surface bâtiment de référence.
  // Priorité sémantique : SHAB explicite > Sref/SRéf > surface habitable > surface du bâtiment > SU/SURT/SRT/SHONRT explicite.
  // On n'extrait jamais une simple occurrence de "m²", ni une surface de paroi/baie/zone sans libellé bâtiment.
  const patterns=[
    {kind:'SHAB',re:/^\s*(?:shab|surf\.?\s*hab\.?\s*shab)(?:\s*(?:ou|\/|-)\s*(?:su|surt))?\s*(?:\([^)]*\))?\s*[:=]?\s*/i,confidence:.997},
    {kind:'SHAB / SU',re:/^\s*shab\s*\/\s*su\s*[:=]?\s*/i,confidence:.997},
    {kind:'Sref',re:/^\s*s\s*ref\s*\/\s*usage\s+principal\s*[:=]?\s*/i,confidence:.996},
    {kind:'Sref',re:/^\s*s\s*ref\s*(?:\([^)]*\))?\s*[:=]?\s*/i,confidence:.994},
    {kind:'Sref',re:/^\s*surface\s+(?:de\s+)?r[eé]f[eé]rence(?:\s+du\s+b[aâ]timent)?\s*[:=]\s*/i,confidence:.992},
    {kind:'Surface habitable',re:/^\s*surface\s+habitable(?:\s+(?:du|de)\s+b[aâ]timent(?:\s+r[eé]sidentiel)?)?\s*(?:\([^)]*\))?\s*[:=]?\s*/i,confidence:.994},
    {kind:'Surface bâtiment',re:/^\s*surface\s+(?:totale\s+)?(?:du\s+)?b[aâ]timent\s*(?:\([^)]*\))?\s*[:=]?\s*/i,confidence:.989},
    {kind:'Surface de plancher',re:/^\s*surface\s+de\s+plancher(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.976},
    {kind:'Surface réglementaire',re:/^\s*surface\s+r[eé]glementaire(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.986},
    {kind:'Surface thermique',re:/^\s*surface\s+thermique(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.984},
    {kind:'Surface totale',re:/^\s*surface\s+totale(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.983},
    {kind:'SU',re:/^\s*surface\s+utile(?:\s+du\s+b[aâ]timent)?\s*[:=]?\s*/i,confidence:.982},
    {kind:'SURT',re:/^\s*surt\s*(?:totale)?\s*[:=]?\s*/i,confidence:.978},
    {kind:'SRT',re:/^\s*srt\s*(?:totale)?\s*[:=]?\s*/i,confidence:.975},
    {kind:'SHONRT',re:/^\s*shonrt\s*(?:totale)?\s*[:=]?\s*/i,confidence:.972},
    {kind:'Surface',re:/^\s*surface\s*[:=]\s*/i,confidence:.970}
  ];
  const byBuilding=new Map();
  const accept=(page,line,value,kind,confidence,method,excerptText='')=>{
    if(!plausibleBuildingSurface(value)) return;
    const building=buildingForPosition(doc,page.page,line.index);
    const semanticPriority=/SHAB/i.test(kind)?100:/Surface habitable/i.test(kind)?98:/Sref/i.test(kind)?96:/Surface bâtiment|Surface réglementaire|Surface thermique/i.test(kind)?94:/Surface totale|Surface de plancher|SU|SURT/i.test(kind)?92:/SRT|SHONRT/i.test(kind)?88:/^Surface$/i.test(kind)?86:90;
    const candidate=occ(doc,page,line,'shab',value,method,confidence,'m²',{
      building,
      surfacePriority:semanticPriority,
      origin:`${doc.type} — ${kind}`,
      excerpt:(excerptText||normalizeText(line.text)).slice(0,420),
      provenanceNote:`Surface bâtiment lue explicitement sous le libellé « ${kind} ». Le champ accepte SHAB, Sref/SRéf, surface habitable, surface du bâtiment, surface réglementaire/thermique/totale, SU, SURT, SRT ou SHONRT selon le document.`
    });
    if(!candidate) return;
    const cur=byBuilding.get(building);
    if(!cur || candidate.confidence>cur.confidence || (candidate.confidence===cur.confidence && candidate.page<cur.page)) byBuilding.set(building,candidate);
  };
  for(const page of doc.read.pages||[]){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], raw=normalizeText(line.text), low=normLower(raw);
      if(!raw) continue;
      // Exclure les lignes de ratios, exigences réglementaires et surfaces d'éléments constructifs.
      if(/ratio\s*\/\s*sref|1\s*\/\s*6|surface\s+(?:de\s+)?(?:fa[cç]ade|baie|paroi|plancher|toiture|mur)|w\s*\/\s*\(?m2\s*sref|kwh\s*\/\s*\(?m2\s*sref|kg\s*(?:eq\.)?\s*co2\s*\/\s*m2\s*sref/i.test(low)) continue;

      // Cas très courant RSEE : « SRef / usage principal 1 138,5 m2 / ... » (pas de : ou =).
      let m=raw.match(/^\s*s\s*ref\s*\/\s*usage\s+principal\s+([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)\s*m(?:2|²)(?=\s|\/|$)/i);
      if(m){ accept(page,line,parseFrNumber(m[1]),'Sref',.998,'surface:sref-usage-principal',raw); continue; }

      // Cas synthèse : « Type de travaux : ... Sref : 330,8 m² » ; le libellé n'est pas en début de ligne.
      m=raw.match(/\bs\s*ref\s*:\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)\s*m(?:2|²)(?=\s|\/|$)/i);
      if(m){ accept(page,line,parseFrNumber(m[1]),'Sref',.996,'surface:sref-inline',raw); continue; }

      // Valeur SHAB explicite en tableau : « Shab m² 5 110,25 » ou « SHAB : 5 110,25 m² ».
      // Ce format détaillé prime sur une valeur SHAB/SU arrondie trouvée ailleurs dans le même document.
      m=raw.match(/^\s*shab\s*(?:\([^)]*\))?\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)(?:\s*m(?:2|²))?\b/i);
      if(m){ accept(page,line,parseFrNumber(m[1]),'SHAB',.999,'surface:shab-explicit-table',raw); continue; }

      // Cas étude thermique : « ... SHAB/SU : 5110 m² ... » dans une ligne descriptive globale.
      m=raw.match(/\bshab\s*\/\s*su\s*:\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)\s*m(?:2|²)?\b/i);
      if(m){ accept(page,line,parseFrNumber(m[1]),'SHAB / SU',.997,'surface:shab-su-inline',raw); continue; }

      let matched=false;
      for(const spec of patterns){
        const lm=raw.match(spec.re); if(!lm) continue;
        const tail=raw.slice(lm[0].length);
        // Cas direct : « SHAB 1 138,5 m² », « Surface habitable 5110 m² »...
        const vm=tail.match(/^\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)\s*(?:m(?:2|²))?(?=\s|\/|$)/i);
        if(vm){ const directValue=parseFrNumber(vm[1]); if(plausibleBuildingSurface(directValue)){ accept(page,line,directValue,spec.kind,spec.confidence,`surface:${spec.kind.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,raw); matched=true; break; } }

        // PDF.js sépare parfois l'unité « m² » et la valeur sur deux lignes, voire place
        // le « 2 » exposant avant la vraie surface. On regarde uniquement le voisinage immédiat
        // du libellé et on ignore tout nombre < 10 (exposant, indice de zone, ratio...).
        const compactLabel=/^(?:shab(?:\s*(?:ou|\/)\s*(?:su|surt))?|s\s*ref(?:\s*\/\s*usage\s+principal)?|surt(?:\s+totale)?|srt(?:\s+totale)?|shonrt(?:\s+totale)?|surface(?:\s+(?:habitable|utile|r[eé]glementaire|thermique|totale|de\s+plancher|(?:de\s+)?r[eé]f[eé]rence|(?:totale\s+)?(?:du\s+)?b[aâ]timent))?)(?:\s*\([^)]*\))?\s*(?::|=)?\s*(?:m(?:2|²))?\s*$/i;
        if(compactLabel.test(raw) || /^s\s*ref\s*\/\s*usage\s+principal\b/i.test(raw) || /^srt\b/i.test(raw)){
          const near=normalizeText([tail,...lines.slice(i+1,i+3).map(x=>x.text)].join(' | '));
          const nearVals=numbersIn(near).filter(plausibleBuildingSurface);
          if(nearVals.length){
            const chosen=nearVals[0];
            accept(page,line,chosen,spec.kind,spec.confidence-.002,`surface:${spec.kind.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-nearby`,`${raw} | ${lines.slice(i+1,i+3).map(x=>normalizeText(x.text)).join(' | ')}`);
            matched=true; break;
          }
        }
      }
      if(matched) continue;
    }
  }
  return [...byBuilding.values()].filter(Boolean);
}

function rsetChapter2Structured(doc){
  const out=[]; const ticByBuilding=new Map();
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], s=normalizeText(line.text), building=buildingForPosition(doc,page.page,line.index);
      let m=s.match(/^nombre\s+de\s+logements\s*[:\-]?\s*(\d+)/i);
      if(m) push(out,occ(doc,page,line,'housing_count',parseInt(m[1],10),'rset:chapter2-housing-count',0.995,'',{building,origin:'RSET Chapitre 2'}));
      if(/^(?:zone\s+)?traversante\b/i.test(normLower(s)) && !/non\s+traversante/i.test(normLower(s))) push(out,occ(doc,page,line,'cross_ventilated','Oui','rset:chapter2-zone-type',0.98,'',{building,origin:'RSET Chapitre 2'}));
      if(/non\s+traversante/i.test(normLower(s))) push(out,occ(doc,page,line,'non_cross_ventilated','Oui','rset:chapter2-zone-type',0.98,'',{building,origin:'RSET Chapitre 2'}));

      // RT2012 : le tableau Tic contient une ligne par groupe. On retient le groupe le plus défavorable,
      // c.-à-d. celui dont Tic - TicRef est le plus élevé (marge de sécurité la plus faible).
      const header=normalizeText(lineWindow(page,i,0,6));
      if(/zones?\s+ou\s+parties?\s+de\s+zones?.*\btic\b.*\btic\s*(?:ref|r[eé]f)/i.test(header)){
        for(let j=i+1;j<Math.min(lines.length,i+24);j++){
          const rowLine=lines[j], row=normalizeText(lineWindow(page,j,0,2));
          if(/tic\s+repr[eé]sente|exigences?\s+de\s+r[eé]sultat/i.test(row)) break;
          if(!/conforme|non\s+conforme/i.test(row)) continue;
          const nums=numbersIn(row);
          if(nums.length<4) continue;
          const surface=nums[nums.length-4], tic=nums[nums.length-3], ref=nums[nums.length-2], delta=nums[nums.length-1];
          if(!(tic>10&&tic<50&&ref>10&&ref<50&&delta>-20&&delta<20)) continue;
          const cur=ticByBuilding.get(building);
          if(!cur||delta>cur.delta) ticByBuilding.set(building,{tic,ref,delta,surface,page,rowLine,excerpt:row});
        }
      }
    }
  }
  for(const [building,r] of ticByBuilding){
    push(out,occ(doc,r.page,r.rowLine,'tic',r.tic,'rset:chapter2-tic-worst-group',0.995,'°C',{building,origin:'RSET Chapitre 2',excerpt:r.excerpt,provenanceNote:'Tic du groupe le plus défavorable du bâtiment (marge Tic - TicRef la plus élevée).'}));
    push(out,occ(doc,r.page,r.rowLine,'tic_ref',r.ref,'rset:chapter2-tic-worst-group',0.995,'°C',{building,origin:'RSET Chapitre 2',excerpt:r.excerpt,provenanceNote:'TicRef correspondant au groupe le plus défavorable retenu pour le bâtiment.'}));
  }
  return out;
}

function buildingFromKnownAlias(doc,text,fallback='Bâtiment unique'){
  const low=normLower(text);
  for(const b of doc.buildings?.names||[]){
    if(b==='Bâtiment unique') continue;
    const short=normLower(b.replace(/^Bâtiment\s+/i,'')).trim();
    if(!short) continue;
    const esc=short.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    // Ne jamais rechercher un identifiant court (A/B/1...) comme simple sous-chaîne :
    // « a » apparaît dans presque tous les libellés et contaminait auparavant les bâtiments suivants.
    const explicit=[`bat\\.?\\s*${esc}`,`batiment\\s*${esc}`,`bâtiment\\s*${esc}`];
    if(explicit.some(src=>{
      if(short.length<=2) return new RegExp(`(?:^|[^a-z0-9])${src}(?=$|\\s*(?:\\(|s(?:ref|rt)?\\s*:|[-:])|[\\)\\]\"'])`,'i').test(low);
      return new RegExp(`(?:^|[^a-z0-9])${src}(?:$|[^a-z0-9])`,'i').test(low);
    })) return b;
    if(new RegExp(`\\(\\s*${esc}\\s*\\)`,'i').test(low)) return b;
    if(low.trim()===short) return b;
  }
  return fallback;
}

function envelopeRowStart(low){
  if(/^parois\s+verticales\b/.test(low)) return 'wall';
  if(/^planchers\s+bas\b/.test(low)) return 'floor';
  if(/^planchers\s+hauts\b/.test(low)) return 'roof';
  return null;
}
function parseEnvelopeRowSegment(lines,start,category){
  let end=start+1;
  for(;end<Math.min(lines.length,start+34);end++){
    const low=normLower(lines[end].text||'');
    if(envelopeRowStart(low) || /^total\s+(?:parois|planchers)|^parois\s+sur\s+locaux|^parois\s+vitr[eé]es|^liaisons?\s+ponts/i.test(low)) break;
  }
  const preStart=Math.max(0,start-5);
  const seg=lines.slice(start,end), ctx=normalizeText(lines.slice(preStart,end).map(x=>x.text).join(' | '));
  const mat=findFirstMatch(ctx,MATERIALS), struct=findFirstMatch(ctx,STRUCTURES);
  const allNums=numbersIn(ctx);
  let thickness=null,totalR=null,pairLine=null;
  // La table RSET contient un couple [épaisseur isolant (cm), R total isolants].
  // Chercher le couple sur une ligne avant de chercher dans le segment concaténé.
  const candidates=[];
  for(let j=0;j<seg.length;j++){
    const ns=numbersIn(seg[j].text||'');
    for(let q=0;q<ns.length-1;q++){
      const a=ns[q],b=ns[q+1];
      if(a>=4 && a<=100 && b>=0 && b<=15 && (b===0 || a/Math.max(b,0.1)>=1.15)) candidates.push({a,b,j,score:(b>0?4:1)+(a>=8?1:0)});
    }
  }
  // Si le PDF a fusionné toute la ligne, les mêmes règles restent valables sur la chaîne concaténée.
  for(let q=0;q<allNums.length-1;q++){
    const a=allNums[q],b=allNums[q+1];
    if(a>=4 && a<=100 && b>=0 && b<=15 && (b===0 || a/Math.max(b,0.1)>=1.15)) candidates.push({a,b,j:-1,score:(b>0?2:0)+(a>=8?1:0)});
  }
  candidates.sort((a,b)=>b.score-a.score || (b.b>0)-(a.b>0));
  if(candidates.length){ thickness=candidates[0].a*10; totalR=candidates[0].b; pairLine=candidates[0].j; }
  if(totalR===null){ const r=explicitR(ctx); if(r!==null&&r<=15) totalR=r; }

  let surface=null;
  // Surface : couple [U, surface] situé après épaisseur/R ; U est typiquement <= 5 W/m².K.
  const surfCandidates=[];
  for(let j=0;j<seg.length;j++){
    const ns=numbersIn(seg[j].text||'');
    for(let q=0;q<ns.length-1;q++){
      const u=ns[q],sf=ns[q+1];
      if(u>=0.01&&u<=5&&sf>0.5&&sf<20000){
        // Écarter le couple épaisseur/R lui-même.
        if(thickness!==null && Math.abs(u-thickness/10)<0.001 && totalR!==null && Math.abs(sf-totalR)<0.001) continue;
        surfCandidates.push({u,sf,j,score:(sf>=10?4:1)+(j>(pairLine??-1)?2:0)});
      }
    }
  }
  surfCandidates.sort((a,b)=>b.score-a.score || b.sf-a.sf);
  if(surfCandidates.length) surface=surfCandidates[0].sf;

  return {mat,struct,thickness,totalR,surface:surface||0,ctx,end};
}
function representativeEnvelopeRecords(doc){
  const recs=[];
  for(const page of doc.read.pages){ const lines=page.lines||[];
    // Les tables de parois sont structurées dans le Chapitre 4. Ne jamais interpréter les
    // tableaux pédagogiques du Chapitre 3 comme des fiches isolants.
    if(!/donn[eé]es\s+r[eé]capitulatives\s+sur\s+les\s+parois/i.test(page.text||'')) continue;
    for(let i=0;i<lines.length;i++){
      const category=envelopeRowStart(normLower(lines[i].text||''));
      if(!category) continue;
      const r=parseEnvelopeRowSegment(lines,i,category);
      if(r.totalR===null&&r.thickness===null&&!r.mat&&!r.struct) continue;
      recs.push({building:buildingForPosition(doc,page.page,lines[i].index),category,mat:r.mat,struct:r.struct,thickness:r.thickness,totalR:r.totalR,surface:r.surface,page,line:lines[i],ctx:r.ctx});
      i=Math.max(i,r.end-1);
    }
  }
  const dedup=new Map();
  for(const r of recs){ const k=[r.building,r.category,r.mat||'',r.struct||'',r.thickness||'',r.totalR||'',r.surface||''].join('|'); if(!dedup.has(k)) dedup.set(k,r); }
  return [...dedup.values()];
}

function rsetEnvelopeStructured(doc){
  const out=[], recs=representativeEnvelopeRecords(doc);
  for(const building of doc.buildings?.names||[]){
    for(const category of ['wall','floor','roof']){
      const pool=recs.filter(r=>r.building===building&&r.category===category);
      if(!pool.length) continue;
      // Par champ, prendre l'enregistrement de plus grande surface qui porte réellement l'information.
      const bestFor=(pred)=>pool.filter(pred).sort((a,b)=>(b.surface||0)-(a.surface||0))[0];
      const rRec=bestFor(r=>r.totalR!==null&&r.totalR>0), thRec=bestFor(r=>r.thickness!==null&&r.thickness>0), matRec=bestFor(r=>!!r.mat), stRec=bestFor(r=>!!r.struct);
      const add=(rec,field,value,unit='')=>{ if(!rec||value===null||value===undefined||value==='') return; push(out,occ(doc,rec.page,rec.line,field,value,'rset:chapter4-envelope-dominant',0.995,unit,{building,origin:'RSET Chapitre 4',excerpt:rec.ctx.slice(0,420),provenanceNote:`Valeur lue dans le tableau « Données récapitulatives sur les parois » du bâtiment ; paroi représentative choisie par la plus grande surface${rec.surface?` (${rec.surface} m²)`:''}.`})); };
      add(matRec,`${category}_insulation`,matRec?.mat);
      add(stRec,`${category}_structure`,stRec?.struct);
      if(category==='wall'&&stRec) add(stRec,'structure',stRec.struct);
      add(thRec,`${category}_insulation_thickness`,thRec?.thickness,'mm');
      add(rRec,`${category}_insulation_r`,rRec?.totalR,'m².K/W');
    }
  }

  // Menuiseries : compter une fois chaque ligne/entrée, sans fenêtre glissante qui surpondère les mots voisins.
  const tally=new Map();
  const addT=(b,k,v,page,line,ctx,weight=1)=>{ if(!v)return; const key=`${b}|${k}|${v}`; const x=tally.get(key)||{building:b,field:k,value:v,count:0,page,line,ctx}; x.count+=weight; tally.set(key,x); };
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){
    const raw=normalizeText(lines[i].text), low=normLower(raw), b=buildingForPosition(doc,page.page,lines[i].index);
    // Une entrée de baie commence le plus souvent par ses dimensions. Regrouper l'entrée jusqu'à la baie suivante
    // évite de compter plusieurs fois le même PVC / vitrage / volet quand le PDF scinde les colonnes en lignes.
    if(/^\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\b/i.test(raw)){
      let j=i+1;
      for(;j<Math.min(lines.length,i+18);j++){
        const t=normalizeText(lines[j].text);
        if(/^\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\b/i.test(t) || /^total\s+(?:verticales|horizontales)|^parois\s+vitr[eé]es|^liaisons?/i.test(t)) break;
      }
      const ctx=normalizeText(lines.slice(i,j).map(x=>x.text).join(' | '));
      addT(b,'window_material',findFirstMatch(ctx,WINDOW_MATERIALS),page,lines[i],ctx);
      addT(b,'window_glazing',normalizeGlazingType(ctx)||findFirstMatch(ctx,GLAZINGS),page,lines[i],ctx);
      let sh=findFirstMatch(ctx,SHADINGS);
      if(!sh&&/volet\s+avec\s+gestion/i.test(normLower(ctx))) sh='Volet avec gestion manuelle';
      addT(b,'window_shading',sh,page,lines[i],ctx);
      i=Math.max(i,j-1);
      continue;
    }
    // Fallback pour des exports PDF dont les dimensions ne sont pas conservées sur une même ligne.
    if(/^volet\s+avec/i.test(low)){
      const ctx=normalizeText(lines.slice(i,Math.min(lines.length,i+4)).map(x=>x.text).join(' '));
      addT(b,'window_shading','Volet avec gestion manuelle',page,lines[i],ctx);
    } else if(/^sans\s+protection\s+mobile/i.test(low)) addT(b,'window_shading','Sans occultation',page,lines[i],raw);
  }}
  for(const b of doc.buildings?.names||[]){ for(const f of ['window_material','window_glazing','window_shading']){ const xs=[...tally.values()].filter(x=>x.building===b&&x.field===f).sort((a,c)=>c.count-a.count); if(xs[0]) push(out,occ(doc,xs[0].page,xs[0].line,f,xs[0].value,'rset:chapter4-windows-majority',0.995,'',{building:b,origin:'RSET Chapitre 4',excerpt:xs[0].ctx.slice(0,420),provenanceNote:`Valeur dominante repérée dans les lignes de menuiseries du bâtiment (${xs[0].count} occurrence(s) non dupliquée(s)).`})); } }
  return out;
}

function rsetSystemsStructured(doc){
  const out=[];
  // Ventilation, au niveau bâtiment/zone dans les feuillets équipements.
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const s=normalizeText(lines[i].text), low=normLower(s), building=buildingForPosition(doc,page.page,lines[i].index);
      if(/groupe\s+de\s+ventilation\s+simple\s+flux/.test(low) && /oui\b/.test(low)){
        let mode='VMC simple flux autoréglable'; const ctx=normalizeText(lines.slice(i,Math.min(lines.length,i+8)).map(x=>x.text).join(' | '));
        if(/hygror[eé]glable\s+type\s*b[^|]{0,20}oui/i.test(ctx)) mode='VMC Hygro B'; else if(/hygror[eé]glable\s+type\s*a[^|]{0,20}oui/i.test(ctx)) mode='VMC Hygro A';
        push(out,occ(doc,page,lines[i],'ventilation',mode,'rset:equipment-ventilation',0.995,'',{building,origin:'RSET Feuillets équipements',excerpt:ctx.slice(0,420)}));
      }
      if(/groupe\s+de\s+ventilation\s+double\s+flux/.test(low) && /oui\b/.test(low)) push(out,occ(doc,page,lines[i],'ventilation','VMC double flux','rset:equipment-ventilation',0.995,'',{building,origin:'RSET Feuillets équipements'}));
    }
  }

  // Génération : l'en-tête « Génération : ... BAT xxx » fixe explicitement le bâtiment desservi.
  let current=null, coldSection=false;
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const s=normalizeText(lines[i].text), low=normLower(s);
      if(/^g[eé]n[eé]ration\s*:/i.test(s)){ current=buildingFromKnownAlias(doc,s,buildingForPosition(doc,page.page,lines[i].index)); coldSection=false; continue; }
      if(!current||current==='Bâtiment unique') continue;
      if(/g[eé]n[eé]rateurs?\s+affect[eé]s?\s+[aà]\s+la\s+production\s+de\s+froid/i.test(s)){ coldSection=true; continue; }
      if(coldSection && /pas\s+de\s+g[eé]n[eé]rateurs?\s+de\s+ce\s+type/i.test(low)){
        push(out,occ(doc,page,lines[i],'cooling','Aucun','rset:generation-no-cooling',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:s})); coldSection=false; continue;
      }
      if(/cat[eé]gorie\s+du\s+g[eé]n[eé]rateur|type\s+d['’]?energie\s+de\s+base|poste\s+de\s+consommation\s+assur[eé]e|chaudi[eè]re|pompe\s+[aà]\s+chaleur|r[eé]seau\s+de\s+chaleur/i.test(low)){
        const ctx=normalizeText(lines.slice(i,Math.min(lines.length,i+4)).map(x=>x.text).join(' | '));
        const mode=findFirstMatch(ctx,HVAC.heating), vec=findFirstMatch(ctx,HVAC.vectors), ecs=findFirstMatch(ctx,HVAC.ecs);
        if(mode) push(out,occ(doc,page,lines[i],'heating_mode_after',mode,'rset:generation-heating',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:ctx.slice(0,420)}));
        if(vec){ push(out,occ(doc,page,lines[i],'heating_vector_after',vec,'rset:generation-heating-vector',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:ctx.slice(0,420)})); if(/ecs|eau\s+chaude|sanitaire|ballon|stockage/i.test(normLower(ctx))) push(out,occ(doc,page,lines[i],'ecs_vector_after',vec,'rset:generation-ecs-vector',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:ctx.slice(0,420)})); }
        if(ecs||(/chauffage\s*\+\s*eau\s+chaude\s+sanitaire/i.test(ctx)&&mode?.includes('Chaudière'))) push(out,occ(doc,page,lines[i],'ecs',ecs||'Chaudière','rset:generation-ecs',0.995,'',{building:current,origin:'RSET Feuillets génération',excerpt:ctx.slice(0,420)}));
      }
    }
  }
  return out;
}

function buildingFromDetailedLine(text,fallback='Bâtiment unique'){
  const s=normalizeText(text);
  let m=s.match(/^(.+?)\s+S(?:Ref|RT)?\s*:\s*[-+]?\d[\d\s.,]*\s+Consommations\s+et\s+productions\s+annuelles\s+du\s+batiment/i);
  if(m) return canonicalBuilding(m[1]);
  m=s.match(/resultats\s+sorties\s+detaillees\s*-\s*\((.+)\)/i); if(m) return canonicalBuilding(m[1]);
  return fallback;
}
function parseBuildingSummaryRow(line){
  const s=normalizeText(line.text); const m=s.match(/^(?:batiment|bâtiment)\s*\((.+?)\)\s+(.*)$/i); if(!m) return null;
  return {building:canonicalBuilding(m[1]),values:numbersIn(m[2]),excerpt:s,consumed:0};
}
function parseBuildingSummaryRowAt(lines,index){
  const direct=parseBuildingSummaryRow(lines[index]);
  if(direct && direct.values.length) return direct;
  const first=normalizeText(lines[index]?.text||'');
  // Perrenoud/PDF.js peut placer les chiffres sur la ligne « Bâtiment » puis le nom sur
  // les 1 à 2 lignes suivantes : « Bâtiment 1169,1 ... » / « (Batiment » / « A) ».
  if(/^(?:batiment|bâtiment)\s+[-+]?\d/i.test(first)){
    const vals=numbersIn(first);
    const tail=normalizeText(lines.slice(index+1,Math.min(lines.length,index+4)).map(x=>x?.text||'').join(' '));
    const m=tail.match(/^\(\s*(?:batiment|bâtiment|bat)\s+(.+?)\s*\)/i) || tail.match(/^\(\s*(.+?)\s*\)/i);
    if(vals.length && m) return {building:canonicalBuilding(m[1]),values:vals,excerpt:normalizeText(first+' '+tail),consumed:Math.min(3,lines.length-index-1)};
  }
  const parts=[];
  for(let k=index;k<Math.min(lines.length,index+5);k++){
    const t=normalizeText(lines[k]?.text||'');
    if(!t) continue;
    parts.push(t);
    const joined=normalizeText(parts.join(' '));
    const m=joined.match(/^(?:batiment|bâtiment)\s*(?:\((.+?)\)|:?\s*([^0-9]+?))?\s+([-+]?\d[\d\s.,].*)$/i);
    if(m){
      const name=normalizeText(m[1]||m[2]||'').replace(/^[-–—:\s]+|[-–—:\s]+$/g,'');
      const vals=numbersIn(m[3]);
      if(vals.length) return {building:canonicalBuilding(name||'Bâtiment unique'),values:vals,excerpt:joined,consumed:k-index};
    }
    // Cas fréquent PDF : « Bâtiment » / « (Batiment A) » / ligne numérique.
    const m2=joined.match(/^(?:batiment|bâtiment)\s*\((.+?)\)\s*$/i);
    if(m2 && k+1<lines.length){
      const nums=numbersIn(lines[k+1]?.text||'');
      if(nums.length) return {building:canonicalBuilding(m2[1]),values:nums,excerpt:normalizeText(joined+' '+(lines[k+1]?.text||'')),consumed:k+1-index};
    }
  }
  return direct;
}
function rsetDetailedConsumptionData(doc){
  const byBuilding=new Map();
  const ensure=b=>{ if(!byBuilding.has(b)) byBuilding.set(b,{building:b,posts:null,energy:null,energyRows:{},page:null,line:null,basis:null,cep:null,cepnr:null,cepmax:null,cepnrmax:null}); return byBuilding.get(b); };
  for(const page of doc.read.pages){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const s=normalizeText(lines[i].text), low=normLower(s);
      // Bloc détaillé par poste et par énergie, en EF (RE2020) ou directement en EP (RT2012).
      if(/consommations\s+et\s+productions\s+annuelles\s+du\s+batiment\s+par\s+poste\s+et\s+par\s+type\s+d['’]?energie/i.test(low)){
        const context=normalizeText(lines.slice(Math.max(0,i-3),Math.min(lines.length,i+5)).map(x=>x.text).join(' | '));
        const building=buildingFromKnownAlias(doc,context,buildingFromDetailedLine(s,buildingForPosition(doc,page.page,lines[i].index))); const d=ensure(building); d.page=page; d.line=lines[i];
        d.basis=/energie\s+primaire|énergie\s+primaire/i.test(context)?'primary':'final';
        let headerIdx=-1, hasCoal=false;
        for(let j=i;j<Math.min(lines.length,i+10);j++) if(/\bgaz\b.*\bfod\b.*\bbois\b.*electricite/i.test(normLower(lines[j].text))){headerIdx=j;hasCoal=/charbon/i.test(normLower(lines[j].text));break;}
        const colX={};
        if(headerIdx>=0){
          for(let j=headerIdx;j<Math.min(lines.length,headerIdx+3);j++) for(const it of lines[j].items||[]){ const t=normLower(it.text||it.str||''), x=Number(it.x)||0; if(/^gaz$/.test(t)) colX.gas=x; else if(/^fod$/.test(t)) colX.fod=x; else if(/^charbon$/.test(t)) colX.coal=x; else if(/^bois$/.test(t)) colX.biomass=x; else if(/electricite/.test(t)) colX.electricity=x; else if(/reseau/.test(t)&&colX.district==null) colX.district=x; }
        }
        const rowDefs=[
          ['heating',/^(?:poste\s+de\s+consommation\s+)?chauffage\b/i],
          ['cooling',/^(?:refroidissement|refroid\.?|froid|climatisation)\b/i],
          ['ecs',/^(?:ecs|eau\s+chaude\s+sanitaire)\b/i],
          ['lighting',/^(?:eclairage|éclairage)\b/i],
          ['auxVent',/^(?:auxiliaires?\s+(?:vmc|ventil(?:ation|ateurs?))|aux\.?\s*ventil(?:ation|ateurs?))\b/i],
          ['mobility',/^(?:deplacements?|déplacements?|ascenseurs?|parking|autres\s+usages)\b/i]
        ];
        for(let j=i+1;j<Math.min(lines.length,i+32);j++){
          const t=normalizeText(lines[j].text); if(/consommations\s+annuelles\s+par\s+poste\s+en\s+energie/i.test(normLower(t))) break;
          let key=null; for(const [k,re] of rowDefs) if(re.test(normLower(t))){key=k;break;}
          if(/^auxiliaires?$/i.test(t) && /distribution/i.test(normalizeText(lines[j+1]?.text||''))){ key='auxDist'; j++; }
          else if(/^(?:auxiliaires?\s+(?:de\s+)?distribution|aux\.?\s*distribution)/i.test(normLower(t))) key='auxDist';
          if(!key) continue;
          const line=lines[j], vals={};
          if(Object.keys(colX).length>=4){ for(const [carrier,x] of Object.entries(colX)){ const v=valueNearestX(line,x,78); if(v!==null) vals[carrier]=v; } }
          let ns=numbersIn(line.text||'');
          if(!ns.length && ['lighting','auxVent','auxDist','mobility'].includes(key)){
            const follow=normalizeText(lines.slice(j,Math.min(lines.length,j+3)).map(x=>x.text).join(' ')); ns=numbersIn(follow);
          }
          if(!Object.keys(vals).length){
            if(hasCoal&&ns.length>=6){ [vals.gas,vals.fod,vals.coal,vals.biomass,vals.electricity,vals.district]=ns.slice(-6); }
            else if(ns.length>=5){ [vals.gas,vals.fod,vals.biomass,vals.electricity,vals.district]=ns.slice(-5); }
            else if(['lighting','auxVent','auxDist','mobility'].includes(key) && ns.length) vals.electricity=ns.at(-1);
          }
          if(Object.keys(vals).length) d.energyRows[key]={...vals,line,page};
        }
      }
      // Tableaux récapitulatifs annuels par poste ou par énergie, en EF ou EP.
      if(/consommations\s+annuelles\s+par\s+poste\s+en\s+energie\s+(?:finale|primaire)/i.test(low)){
        const basis=/primaire/i.test(low)?'primary':'final'; let kind=null, header='';
        for(let j=i+1;j<Math.min(lines.length,i+12);j++){ const t=normLower(lines[j].text); header+=' '+t; if(/\bch\b.*\bfr\b.*\becs\b|chauffage.*refroid.*ecs/.test(header)){kind='posts';break;} if(/\bgaz\b.*\bfod\b.*\bbois\b.*electricite/.test(header)){kind='energy';break;} }
        for(let j=i+1;j<Math.min(lines.length,i+32);j++){
          const row=parseBuildingSummaryRowAt(lines,j); if(!row) continue; const rowFallback=row.building==='Bâtiment unique'?buildingForPosition(doc,page.page,lines[j].index):row.building; const d=ensure(buildingFromKnownAlias(doc,row.excerpt||row.building,rowFallback)); d.page=page; d.line=lines[j]; d.basis=d.basis||basis; const v=row.values;
          if(kind==='posts'){
            if(v.length>=12) d.posts={heating:v[1],cooling:v[2],ecs:v[3],lighting:v[4],auxVent:v[5],auxDist:v[6],mobility:v[7],furniture:v[8],pv:v[9],cogen:v[10],total:v[11],surface:v[0]};
            else if(v.length>=10) d.posts={heating:v[1],cooling:v[2],ecs:v[3],lighting:v[4],auxVent:v[5],auxDist:v[6],pv:v[7],cogen:v[8],total:v[9],surface:v[0]};
          }
          if(kind==='energy'){
            const hasCoal=/charbon/i.test(header);
            if(hasCoal&&v.length>=10) d.energy={gas:v[1],fod:v[2],coal:v[3],biomass:v[4],electricity:v[5],district:v[6],pv:v[7],cogen:v[8],total:v[9],surface:v[0]};
            else if(v.length>=9) d.energy={gas:v[1],fod:v[2],biomass:v[3],electricity:v[4],district:v[5],pv:v[6],cogen:v[7],total:v[8],surface:v[0]};
          }
          break;
        }
      }
      // RE2020 : tableau explicite « Bâtiment / Zone(s) S Coefficient Cep Coefficient Cep,nr ».
      if(/batiment\s*\/\s*zone\(s\).*coefficient\s+cep(?!\s*max).*coefficient\s+cep\s*[,._-]?\s*nr(?!\s*max)/i.test(low)){
        for(let j=i+1;j<Math.min(lines.length,i+10);j++){
          const row=parseBuildingSummaryRowAt(lines,j); if(!row) continue;
          const v=row.values; if(v.length<3) continue;
          const building=buildingFromKnownAlias(doc,row.building,buildingForPosition(doc,page.page,lines[j].index));
          const d=ensure(building); d.page=page; d.line=lines[j]; d.cep=v.at(-2); d.cepnr=v.at(-1);
          break;
        }
      }
      // RE2020 / rapports Perrenoud : en-tête et ligne valeur parfois séparés pour Cep,nr max.
      if(/cep\s*[,._-]?\s*nr.*(?:_?max|maximal)/i.test(low)){
        const ctx=normalizeText(lines.slice(i,Math.min(lines.length,i+4)).map(x=>x.text).join(' '));
        if(/cep\s*[,._-]?\s*nr.*(?:_?max|maximal)/i.test(normLower(ctx))){
          for(let j=i;j<Math.min(lines.length,i+5);j++){
            const t=normalizeText(lines[j].text); if(!/^cep\s*[,._-]?\s*nr\b/i.test(normLower(t))) continue;
            const ns=numbersIn(t); if(ns.length>=2){
              const building=buildingForPosition(doc,page.page,lines[j].index); const d=ensure(building); d.page=page; d.line=lines[j]; d.cepnr=ns[0]; d.cepnrmax=ns[1];
              if(ns.length>=3) d.cepnrGain=ns[2];
            }
          }
        }
      }
      // Variante de sortie détaillée : tableau des coefficients maximaux.
      if(/coefficient\s+cep\s*max.*cep\s*[,._-]?\s*nr\s*max|coefficient\s+cepmax.*cep\s*[,._-]?\s*nrmax/i.test(low)){
        for(let j=i+1;j<Math.min(lines.length,i+10);j++){
          const row=parseBuildingSummaryRowAt(lines,j); if(!row) continue; const v=row.values; if(v.length<3) continue;
          const building=buildingFromKnownAlias(doc,row.building,buildingForPosition(doc,page.page,lines[j].index)); const d=ensure(building); d.page=page; d.line=lines[j]; d.cepmax=v.at(-2); d.cepnrmax=v.at(-1); break;
        }
      }
    }
  }
  return byBuilding;
}
function addRsetCepBreakdown(doc,out){
  const data=rsetDetailedConsumptionData(doc);
  for(const [building,d] of data){ if(!d.page||!d.line) continue;
    const primary=d.basis==='primary';
    const factor=primary?{gas:1,fod:1,coal:1,biomass:1,electricity:1,district:1}:{gas:1,fod:1,coal:1,biomass:1,electricity:2.3,district:1};
    const add=(field,value,note,confidence=0.99)=>{ if(value==null||!Number.isFinite(value)) return; push(out,occ(doc,d.page,d.line,field,Math.round(value*1000)/1000,primary?'rset:detailed-output-primary':'rset:detailed-output-cep',confidence,'kWhEP/m².an',{building,derivedFromDocument:!primary,origin:primary?'RSET — Résultats sorties détaillées (énergie primaire)':'RSET — Résultats sorties détaillées',excerpt:`Résultats sorties détaillées — ${building}. ${note}`,provenanceNote:primary?'Valeur directement lue dans le tableau des consommations en énergie primaire du RSET.':'Valeur de Cep détaillée calculée à partir des consommations en énergie finale du RSET ; les valeurs documentaires directes restent prioritaires.'})); };
    const postValue=(key)=>{ const row=d.energyRows[key]; if(!row) return null; let sum=0,found=false; for(const [k,v] of Object.entries(row)){ if(['line','page'].includes(k)||typeof v!=='number'||factor[k]==null) continue; sum+=v*factor[k]; found=true; } return found?sum:null; };
    // Coefficients explicites : ils sont lus directement dans les tableaux RSET, sans estimation.
    const addCoefficient=(field,value,label,unit='kWhEP/m².an')=>{ if(value==null||!Number.isFinite(value)) return; push(out,occ(doc,d.page,d.line,field,Math.round(value*1000)/1000,'rset:coefficient-direct',0.999,unit,{building,origin:'RSET — coefficient explicite',excerpt:`${label} — ${building} : ${value}`,provenanceNote:'Valeur directement lue dans le RSET.'})); };
    addCoefficient('cep',d.cep,'Coefficient Cep');
    addCoefficient('cepnr',d.cepnr,'Coefficient Cep,nr');
    addCoefficient('cep_max',d.cepmax,'Coefficient Cep max');
    addCoefficient('cepnr_max',d.cepnrmax,'Coefficient Cep,nr max');
    addCoefficient('cepnr_gain',d.cepnrGain,'Gain Cep,nr','%');
    const postDefs=[['cep_cooling','cooling','Refroidissement'],['cep_lighting','lighting','Éclairage'],['cep_aux_vent','auxVent','Auxiliaires VMC'],['cep_aux_dist','auxDist','Auxiliaires distribution'],['cep_mobility','mobility','Déplacements occupants']];
    // Priorité au tableau récapitulatif « Consommations annuelles par poste » :
    // il donne explicitement une valeur bâtiment pour chaque poste et résiste mieux aux PDF dont
    // les colonnes sont fragmentées. Le tableau par énergie reste un secours / contrôle.
    for(const [field,key,label] of postDefs){
      if(d.posts&&d.posts[key]!=null){
        const f=primary?1:2.3;
        add(field,d.posts[key]*f,`${label} : ${d.posts[key]}${primary?' kWhEP/m².an (lu directement).':` kWhEF/m².an × ${f}.`}`);
        continue;
      }
      const v=postValue(key);
      if(v!==null) add(field,v,`${label} : ${v} kWhEP/m².an${primary?' (lu directement)':' après conversion'}.`);
    }
    if(d.energy){
      add('cep_gas',(d.energy.gas||0)*factor.gas,`Gaz : ${d.energy.gas||0}${primary?' kWhEP/m².an.':' kWhEF/m².an × 1.'}`);
      add('cep_biomass',(d.energy.biomass||0)*factor.biomass,`Bois/biomasse : ${d.energy.biomass||0}${primary?' kWhEP/m².an.':' kWhEF/m².an × 1.'}`);
      add('cep_electricity',(d.energy.electricity||0)*factor.electricity,`Électricité : ${d.energy.electricity||0}${primary?' kWhEP/m².an.':` kWhEF/m².an × ${factor.electricity}.`}`);
      add('cep_district',(d.energy.district||0)*factor.district,`Réseau de chaleur : ${d.energy.district||0}${primary?' kWhEP/m².an.':' kWhEF/m².an × 1.'}`);
    }
  }
}


function totalTailValue(page,index,maxLines=4){
  const lines=page.lines||[]; const first=normalizeText(lines[index]?.text||''); const firstNums=numbersIn(first);
  // Les tableaux ACV comportent généralement 7 à 8 colonnes numériques sur la ligne Total.
  // Si elles sont déjà présentes, ne jamais avaler un numéro de page ou un artefact de la ligne suivante.
  if(firstNums.length>=7) return firstNums.at(-1);
  const parts=[first];
  for(let j=index+1;j<Math.min(lines.length,index+maxLines);j++){
    const t=normalizeText(lines[j]?.text||'');
    if(/[A-Za-zÀ-ÿ]/.test(t)) break;
    parts.push(t);
    const nums=numbersIn(parts.join(' ')); if(nums.length>=7) return nums.at(-1);
  }
  const nums=numbersIn(parts.join(' ')); return nums.length?nums.at(-1):null;
}

function addRsetCarbonBreakdown(doc,out){
  const energyHeadings=[
    ['ic_energy_heating',/^chauffage\s*$/i],
    ['ic_energy_ecs',/^(?:ecs|eau\s+chaude\s+sanitaire)\s*$/i],
    ['ic_energy_cooling',/^refroidissement\s*$/i],
    ['ic_energy_aux_vent',/^auxiliaires?\s+(?:ventilateurs?|ventilation)\s*$/i],
    ['ic_energy_aux_dist',/^auxiliaires?\s+distribution\s*$/i],
    ['ic_energy_mobility',/^(?:ascenseur(?:s)?\s*\/\s*parking|deplacements?|déplacements?)\s*$/i]
  ];
  let mode=null,currentLot=null,currentEnergy=null;
  for(const page of doc.read.pages||[]){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], t=normalizeText(line.text), low=normLower(t);
      // Les pages de résultats ACV utilisent des titres numérotés « 1-VRD », « 8-CVC », etc.
      // Les sections d'entrée du logiciel utilisent aussi « Lot 11 : ... » : ne pas les confondre
      // avec le tableau de résultats, sinon un Total sans rapport peut être attribué au mauvais lot.
      const pageLow=normLower(page.text||'');
      const carbonSummaryPage=/total\s+lot\s*:/.test(pageLow) && ((pageLow.match(/total\s*:/g)||[]).length>=2);
      const numberedLot=t.match(/^\s*(1[0-3]|[1-9])\s*[-–—]\s*(.+)$/i);
      const namedLot=carbonSummaryPage?t.match(/^\s*lot\s*(1[0-3]|[1-9])\s*[:\-–—]\s*(.+)$/i):null;
      const lot=numberedLot||namedLot;
      const lotLabelLooksValid=lot && /vrd|fondation|infrastructure|superstructure|maconn|maçon|couverture|etanche|étanch|charpente|zinguer|cloison|doublage|plafond|menuiser|facade|façade|revetement|revêtement|cvc|chauffage|ventilation|sanitaire|plomberie|reseaux?|réseaux?|communication|courant\s+faible|elevateur|élévateur|transport\s+interieur|production\s+locale/i.test(normLower(lot[2]));
      // Dans le tableau ACV de synthèse, les libellés peuvent être coupés sur plusieurs lignes
      // (« 11-Réseaux de » puis « communication ... »). Le numéro reste alors une ancre fiable.
      if(lot && (lotLabelLooksValid || (mode==='components'&&carbonSummaryPage))){ mode='components'; currentLot=parseInt(lot[1],10); currentEnergy=null; continue; }
      if(/^energie\s*\(\s*ce\s*\)/i.test(low)){ mode='energy'; currentLot=null; currentEnergy=null; continue; }
      if(/^eau\s*\(\s*cre\s*\)/i.test(low)){ mode='water'; currentLot=null; currentEnergy=null; continue; }
      if(/^chantier\s*\(\s*cha\s*\)/i.test(low)){ mode='site'; currentLot=null; currentEnergy=null; continue; }
      if(mode==='energy'){
        if(/^(?:chauffage|ecs|eau\s+chaude\s+sanitaire|refroidissement|eclairage|éclairage|auxiliaires?|ascenseur|deplacements?|déplacements?)/i.test(t)) currentEnergy=null;
        for(const [field,re] of energyHeadings){ if(re.test(t)){ currentEnergy=field; break; } }
      }
      if(/^total\s*:/i.test(low)){
        const value=totalTailValue(page,i,4); if(value==null||!Number.isFinite(value)) continue;
        const building=buildingForPosition(doc,page.page,line.index);
        if(mode==='components'&&currentLot){
          push(out,occ(doc,page,line,`ic_lot_${currentLot}`,value,`rset:carbon-lot-${currentLot}-total`,0.995,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`IC composants lot ${currentLot} — Total cycle de vie : ${value} kgCO2e/m²`}));
        } else if(mode==='energy'&&currentEnergy){
          push(out,occ(doc,page,line,currentEnergy,value,'rset:carbon-energy-post-total',0.995,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`${currentEnergy} — Total cycle de vie : ${value} kgCO2e/m²`}));
        }
      }
      if(/^total\s+lot\s*:/i.test(low)){
        const value=totalTailValue(page,i,4); if(value==null||!Number.isFinite(value)) continue;
        const building=buildingForPosition(doc,page.page,line.index);
        if(mode==='components') push(out,occ(doc,page,line,'ic_components',value,'rset:carbon-components-total',0.998,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`IC composants bâtiment — Total Lot : ${value} kgCO2e/m²`}));
        else if(mode==='energy') push(out,occ(doc,page,line,'ic_energy',value,'rset:carbon-energy-total',0.998,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`IC énergie bâtiment — Total Lot : ${value} kgCO2e/m²`}));
        else if(mode==='site') push(out,occ(doc,page,line,'ic_site',value,'rset:carbon-site-total',0.998,'kgCO2e/m²',{building,origin:'RSEE/RSET — résultats ACV détaillés',excerpt:`IC chantier — Total Lot : ${value} kgCO2e/m²`}));
      }
    }
  }
}

function parseRset(doc){
  const out=[];
  for(const page of doc.read.pages){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], s=normalizeText(line.text), win=lineWindow(page,i,0,4);
      if(/coefficient\s+bbio/i.test(s)){
        // Ne jamais lire les numéros d'article / de bâtiment comme des valeurs Bbio.
        // Ex.: « 1-2° Le coefficient Bbio ... Conforme » ou « ... - Bât.1 ».
        const narrative=/\b(?:article|art\.?|conforme|inferieur|inférieur|egal|égal|exigence)\b/i.test(s) || /-\s*b[aâ]t\.?\s*\d+\s*$/i.test(s);
        let vals=[];
        if(!narrative && /^\s*coefficient\s+bbio\b/i.test(s)) vals=numbersIn(s).filter(x=>x>=0&&x<1000);
        if(vals.length<2 && !narrative && /^\s*coefficient\s+bbio\b/i.test(s)) vals=numbersIn(lineWindow(page,i,0,1)).filter(x=>x>=0&&x<1000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'bbio',vals[0],'rset:bbio-table',0.99)); push(out,occ(doc,page,line,'bbio_max',vals[1],'rset:bbio-table',0.99)); if(vals.length>=3) push(out,occ(doc,page,line,'bbio_gain',vals[2],'rset:bbio-table',0.98,'%')); }
      }
      if(/coefficients?\s+cep\s*\/\s*cep\s*(?:max)?/i.test(s)){
        let vals=numbersIn(s).filter(x=>x>=-100); if(vals.length<4) vals=numbersIn(lineWindow(page,i,0,2)).filter(x=>x>=-100);
        if(vals.length>=4){
          push(out,occ(doc,page,line,'cep',vals[0],'rset:cep-table',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cep_max',vals[1],'rset:cep-table',0.995,'kWhEP/m².an'));
          push(out,occ(doc,page,line,'cepnr',vals[2],'rset:cep-table',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cepnr_max',vals[3],'rset:cep-table',0.995,'kWhEP/m².an'));
          if(vals.length>=5) push(out,occ(doc,page,line,'cep_gain',vals[4],'rset:cep-table',0.99,'%')); if(vals.length>=6) push(out,occ(doc,page,line,'cepnr_gain',vals[5],'rset:cep-table',0.99,'%'));
        }
      } else if(/^coefficient\s+cep\b/i.test(s)){
        // Une ligne de sommaire telle que « Coefficient Cep max du bâtiment - Bât.1 »
        // ne porte aucune valeur de résultat. On exige une vraie ligne de tableau numérique.
        const headingOnly=/du\s+b[aâ]timent|b[aâ]t\.?\s*\d+|sommaire/i.test(s) && !/[=:]|\d+[,.]\d+/.test(s);
        let vals=headingOnly?[]:numbersIn(s).filter(x=>x>=-100&&x<5000);
        if(vals.length<2 && !headingOnly && /[=:]|\d+[,.]\d+/.test(s)) vals=numbersIn(lineWindow(page,i,0,2)).filter(x=>x>=-100&&x<5000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'cep',vals[0],'rset:rt2012-cep-table',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cep_max',vals[1],'rset:rt2012-cep-table',0.995,'kWhEP/m².an')); if(vals.length>=3) push(out,occ(doc,page,line,'cep_gain',vals[2],'rset:rt2012-cep-table',0.99,'%')); }
      }
      // Récapitulatifs logiciels compacts : « Bbio 43,2 65,9 34,45 ».
      if(/^bbio\b/i.test(s) && !/^bbio\s*(?:max|maxi|maximal|_max)\b/i.test(s)){
        const vals=numbersIn(s).filter(x=>x>=-100&&x<5000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'bbio',vals[0],'rset:bbio-summary-row',0.997,'points')); push(out,occ(doc,page,line,'bbio_max',vals[1],'rset:bbio-summary-row',0.997,'points')); if(vals.length>=3) push(out,occ(doc,page,line,'bbio_gain',vals[2],'rset:bbio-summary-row',0.995,'%')); }
      }
      // Récapitulatifs logiciels compacts : « Cep 45,5 80,5 43,48 » / « Cep,nr 45,5 59 22,88 ».
      if(/^cep\s*[,._-]?\s*nr\b/i.test(s) && !/coefficient/i.test(s)){
        const vals=numbersIn(s).filter(x=>x>=-100&&x<5000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'cepnr',vals[0],'rset:cepnr-summary-row',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cepnr_max',vals[1],'rset:cepnr-summary-row',0.995,'kWhEP/m².an')); if(vals.length>=3) push(out,occ(doc,page,line,'cepnr_gain',vals[2],'rset:cepnr-summary-row',0.99,'%')); }
      } else if(/^cep\b/i.test(s) && !/^cep\s*[,._-]?\s*nr\b/i.test(s) && !/coefficient/i.test(s)){
        const vals=numbersIn(s).filter(x=>x>=-100&&x<5000);
        if(vals.length>=2){ push(out,occ(doc,page,line,'cep',vals[0],'rset:cep-summary-row',0.995,'kWhEP/m².an')); push(out,occ(doc,page,line,'cep_max',vals[1],'rset:cep-summary-row',0.995,'kWhEP/m².an')); if(vals.length>=3) push(out,occ(doc,page,line,'cep_gain',vals[2],'rset:cep-summary-row',0.99,'%')); }
      }
      if(/\bdh\b|degres?[- ]heures?/i.test(s)){
        const explicit=firstValueAfterLabel(s,/\bDH\b|degres?[- ]heures?/i); if(explicit!==null) push(out,occ(doc,page,line,'dh',explicit,'rset:dh-explicit',0.98,'°C.h'));
        const max=firstValueAfterLabel(s,/DH\s*(?:max|seuil)|degres?[- ]heures?\s*(?:max|seuil)/i); if(max!==null) push(out,occ(doc,page,line,'dh_max',max,'rset:dh-explicit',0.97,'°C.h'));
      }
      if(/conforme|non\s+conforme/i.test(s) && i>0){
        const context=lineWindow(page,i,5,0);
        if(/\bdh\b|degres?[- ]heures?/i.test(context)){
          const yn=s.match(/\b(?:oui|non)\b/i);
          if(yn){
            const n=numbersIn(s.slice(yn.index));
            if(n.length>=2){
              const building=buildingForPosition(doc,page.page,line.index);
              push(out,occ(doc,page,line,'dh',n[1],'rset:dh-row',0.97,'°C.h',{building,context:'tableau DH',excerpt:normalizeText(context).slice(0,420)}));
            }
          }
        }
      }
      if(/\bzone(?:s)?\s+traversante|\bgroupe\s+traversant/i.test(s) && !/non\s+traversant/i.test(s)) push(out,occ(doc,page,line,'cross_ventilated','Oui','rset:traversant',0.88));
      if(/\bzone(?:s)?\s+non\s+traversante|\bgroupe\s+non\s+traversant/i.test(s)) push(out,occ(doc,page,line,'non_cross_ventilated','Oui','rset:non-traversant',0.88));
      if(/ic\s*composants?/i.test(s)){ const n=numbersIn(s); if(n.length) push(out,occ(doc,page,line,'ic_components',n[0],'rset:ic-components',0.97,'kgCO2e/m²')); }
      if(/ic\s*chantier/i.test(s)){ const n=numbersIn(s); if(n.length) push(out,occ(doc,page,line,'ic_site',n[0],'rset:ic-site',0.97,'kgCO2e/m²')); }
      if(/ic\s*[eé]nergie/i.test(s)){ const n=numbersIn(s); if(n.length) push(out,occ(doc,page,line,'ic_energy',n[0],'rset:ic-energy',0.97,'kgCO2e/m²')); }
      const lot=s.match(/\blot\s*(1[0-3]|[1-9])\b/i); if(lot&&/ic|carbone|kg\s*co2/i.test(s)){ const n=numbersIn(s); if(n.length) push(out,occ(doc,page,line,`ic_lot_${lot[1]}`,n[n.length-1],`rset:ic-lot-${lot[1]}`,0.90,'kgCO2e/m²')); }
    }
  }
  // Extraction structurée par bâtiment : le registre bâtiment est construit avant les parseurs.
  out.push(...rsetChapter2Structured(doc));
  // SHAB RSET : source de référence = Chapitre 2, colonne « Surface utile SU ou surf. hab. SHAB ».
  out.push(...rsetShabFromChapter2(doc));
  out.push(...rsetEnvelopeStructured(doc));
  out.push(...rsetSystemsStructured(doc));
  addRsetCepBreakdown(doc,out);
  addRsetCarbonBreakdown(doc,out);
  return fallbackRset(doc,out);
}

function fallbackRset(doc,current){
  const have=new Set(current.map(o=>`${o.building}|${o.field}`)); const out=[...current];
  for(const page of doc.read.pages){ for(const line of page.lines||[]){ const s=normalizeText(line.text), building=buildingForPosition(doc,page.page,line.index); if(/certification|referentiel|référentiel|performance|niveau|label|objectif|seuil|article|\bart\.?\s*\d+|représente|represente/i.test(normLower(s))) continue; const patterns={bbio:/\bbbio\b(?!\s*max)/i,bbio_max:/\bbbio\s*max\b/i,cep:/\bcep\b(?!\s*,?\s*nr|\s*max)/i,cep_max:/\bcep\s*max\b/i,cepnr:/\bcep\s*,?\s*nr\b(?!\s*max)/i,cepnr_max:/\bcep\s*,?\s*nr\s*max\b/i,dh:/\bdh\b|degres?[- ]heures?/i};
    for(const [field,re] of Object.entries(patterns)){ const key=`${building}|${field}`; if(have.has(key)||!re.test(s)) continue; const val=firstValueAfterLabel(s,re); if(val!==null){ push(out,occ(doc,page,line,field,val,'rset:fallback-label',0.87,'',{building})); have.add(key); } }
  }} return out;
}

function isRegulatoryNarrativeNoise(text=''){
  const low=normLower(text);
  return /(?:^|\b)(?:article|art\.?\s*\d+|rappel|definition|définition|objectif|critere|critère|cible|exigence|reglementation|réglementation|methode|méthode)(?:\b|\s)/i.test(low)
    || /(?:est|doit\s+etre|doit\s+être)\s+(?:inferieur|inférieur|superieur|supérieur|egal|égal)|\brepresente\b|\breprésente\b|\bconforme\b/i.test(low);
}
function explicitMetricCarrier(line='',re){
  const raw=normalizeText(line), low=normLower(raw);
  if(!re.test(raw)) return false;
  // Refuse les phrases réglementaires/descriptives : une métrique doit être portée par une ligne de résultat,
  // un couple libellé-valeur ou un tableau compact.
  if(isRegulatoryNarrativeNoise(raw) && !/^(?:coefficient\s+)?(?:bbio|cep(?:\s*[,._-]?\s*nr)?|dh|degres?[- ]heures?|tic|ubat)\b/i.test(raw)) return false;
  return /[:=|]|\d[,.]\d|\b\d{2,}(?:[,.]\d+)?\b/.test(raw) || /^(?:coefficient\s+)?(?:bbio|cep|dh|tic|ubat)\b/i.test(low);
}

function parseGenericRegulatory(doc){
  const out=[];
  const specs=[
    ['bbio_max',/\bbbio\s*(?:max|maxi|maximal|_max)\b/i,'points'],['bbio',/\bbbio\b(?!\s*(?:max|maxi|maximal|_max))/i,'points'],
    ['cepnr_max',/\bcep\s*[,._-]?\s*nr\s*(?:max|maxi|maximal|_max)\b/i,'kWhEP/m².an'],['cepnr',/\bcep\s*[,._-]?\s*nr\b(?!\s*(?:max|maxi|maximal|_max))/i,'kWhEP/m².an'],
    ['cep_max',/\bcep\s*(?:max|maxi|maximal|_max)\b/i,'kWhEP/m².an'],['cep',/\bcep\b(?!\s*[,._-]?\s*nr|\s*(?:max|maxi|maximal|_max))/i,'kWhEP/m².an'],
    ['dh_max',/\b(?:dh|degres?[- ]heures?)\s*(?:max|maxi|maximal|seuil)\b/i,'°C.h'],['dh',/\b(?:dh|degres?[- ]heures?)\b(?!\s*(?:max|maxi|maximal|seuil))/i,'°C.h'],
    ['tic_ref',/\btic\s*(?:ref|reference|référence|max)\b/i,'°C'],['tic',/\btic\b(?!\s*(?:ref|reference|référence|max))/i,'°C']
  ];
  const breakdown=[
    ['cep_cooling',/\bcep\b[^|]{0,45}(?:refroidissement|refroid|froid|climatisation)/i],['cep_lighting',/\bcep\b[^|]{0,45}(?:eclairage|éclairage)/i],
    ['cep_aux_vent',/\bcep\b[^|]{0,60}(?:auxiliaires?\s+(?:de\s+)?ventilation|ventilation)/i],['cep_aux_dist',/\bcep\b[^|]{0,60}(?:auxiliaires?\s+(?:de\s+)?distribution|distribution)/i],
    ['cep_mobility',/\bcep\b[^|]{0,60}(?:deplacements?|déplacements?|ascenseurs?|escalators?)/i],['cep_electricity',/\bcep\b[^|]{0,45}(?:electricite|électricité)/i],
    ['cep_gas',/\bcep\b[^|]{0,45}\bgaz\b/i],['cep_district',/\bcep\b[^|]{0,55}(?:reseau\s+de\s+chaleur|réseau\s+de\s+chaleur|rcu)/i],['cep_biomass',/\bcep\b[^|]{0,55}(?:bois|biomasse|granules|granulés)/i]
  ];
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){ const line=lines[i], s=normalizeText(line.text), ctx=lineWindow(page,i,1,2);
    const ticTableContext=/\btic\b/i.test(ctx)&&/\btic\s*(?:ref|réf|reference|référence|max)\b/i.test(ctx)&&/\bCE[12]\b/i.test(ctx);
    if(ticTableContext){ const temps=numbersIn(ctx).filter(v=>v>=15&&v<=50); if(temps.length>=2){ const tic=temps[temps.length-2],ref=temps[temps.length-1],building=buildingForPosition(doc,page.page,line.index); push(out,occ(doc,page,line,'tic',tic,'generic:tic-table-paired',0.97,'°C',{building,excerpt:normalizeText(ctx).slice(0,420),provenanceNote:'Tic lue avec TicRef sur la même ligne de tableau ; identifiants de groupe ignorés.'})); push(out,occ(doc,page,line,'tic_ref',ref,'generic:tic-table-paired',0.97,'°C',{building,excerpt:normalizeText(ctx).slice(0,420),provenanceNote:'TicRef associée à la Tic de la même ligne de tableau.'})); } }
    for(const [field,re,unit] of specs){ if(ticTableContext&&(field==='tic'||field==='tic_ref')) continue; if(explicitMetricCarrier(s,re)||(!isRegulatoryNarrativeNoise(ctx)&&re.test(ctx))){ const carrier=explicitMetricCarrier(s,re)?s:ctx; const v=firstValueAfterLabel(carrier,re);
      // Garde-fous issus du journal bêta : « RT2012 » ne doit jamais devenir Tic=2012/Ticref=2012.
      // Les températures réglementaires Tic/Ticref plausibles sont exprimées en °C.
      if(v!==null && ((field==='tic'||field==='tic_ref') && (v<5||v>60))) continue;
      // Les autres indicateurs ne doivent pas capturer un millésime isolé après un libellé.
      if(v!==null && v>=1900 && v<=2100) continue;
      if(v!==null) push(out,occ(doc,page,line,field,v,'generic:regulatory-label',0.91,unit,{excerpt:normalizeText(ctx).slice(0,420)})); } }
    for(const [field,re] of breakdown){ if(!isRegulatoryNarrativeNoise(ctx)&&re.test(ctx)){ const v=firstValueAfterLabel(ctx,re); if(v!==null) push(out,occ(doc,page,line,field,v,'generic:cep-breakdown',0.90,'kWhEP/m².an',{excerpt:normalizeText(ctx).slice(0,420)})); } }
    const phase=phaseFromContext(ctx,doc);
    if(/\bubat\b/i.test(ctx)){
      // Le mot Ubat dans un index, un intitulé de chapitre ou une formule n'est pas une valeur.
      // On ne conserve le fallback générique que si le voisinage porte explicitement une valeur plausible.
      const lowCtx=normLower(ctx);
      const structuralHeading=/\b(?:index|sommaire|justification\s+du\s+calcul|coefficient\s+moyen.*ubat\s*$)\b/i.test(lowCtx);
      const m=ctx.match(/\bubat\b[^\n|]{0,45}?(?:[:=]|\bprojet\b|\binitial\b|\bavant\b|\bapres\b|\baprès\b)?\s*(-?\d+(?:[,.]\d+)?)/i);
      const v=m?parseFrNumber(m[1]):null;
      if(!structuralHeading && v!==null && v>0.02 && v<8){
        if(phase==='before') push(out,occ(doc,page,line,'ubat_before',v,'renovation:ubat-before',0.92,'W/m².K',{excerpt:normalizeText(ctx).slice(0,420)}));
        if(phase==='after') push(out,occ(doc,page,line,'ubat_after',v,'renovation:ubat-after',0.92,'W/m².K',{excerpt:normalizeText(ctx).slice(0,420)}));
      }
    }
    if(/\bcep\b/i.test(ctx) && !/cep\s*[,._-]?\s*nr/i.test(ctx)){ const v=firstValueAfterLabel(ctx,/\bcep\b/i); if(v!==null && phase==='before') push(out,occ(doc,page,line,'cep_before',v,'renovation:cep-before',0.91,'kWhEP/m².an',{excerpt:normalizeText(ctx).slice(0,420)})); if(v!==null && phase==='after' && /final|reception|apres\s+travaux/i.test(normLower(`${doc.name} ${ctx}`))) push(out,occ(doc,page,line,'cep_after_final',v,'renovation:cep-after-final',0.92,'kWhEP/m².an',{excerpt:normalizeText(ctx).slice(0,420)})); }
  }} return out;
}


function thermalStudyPhase(text){
  const low=normLower(text);
  // Rapports de rénovation (Bao Evolution, audits, RT existant...) : l'état initial doit
  // rester distinct de l'état après travaux, même lorsque le titre de phase n'est présent
  // qu'une fois en haut de page.
  if(/(?:^|\b)(?:etat|état)\s+(?:initial|existant)\b|\bavant\s+travaux\b|\bsituation\s+initiale\b/.test(low)) return 'before';
  if(/(?:^|\b)(?:etat|état)\s+(?:apres|après)\s+travaux\b|\b(?:variante|modification)\s*(?:n[°ºo]?\s*)?\d*[^\n]{0,60}(?:apres|après)\s+travaux\b|(?:^|\b)(?:etat|état)\s+(?:projete|projeté|scenario|scénario)\b|\bscenario\s+\d+\b|\bscénario\s+\d+\b/.test(low)) return 'after';
  return '';
}


function isStructuredRenovationThermalDocument(doc){
  const s=normLower(`${doc?.name||''}\n${doc?.read?.text||''}`);
  return /bao\s*(?:evolution|evolution)|catalogue\s+des\s+parois\s+de\s+l['’]?etat\s+initial|details\s+des\s+consommations[\s\S]{0,160}energie\s+primaire|bilan\s+energetique[\s\S]{0,80}bilan\s+co2/.test(s);
}
function baoNumber(value=''){
  let t=String(value??'').replace(/\u00a0/g,' ').trim();
  if(/^[-+]?[,.]\d+$/.test(t)) t=t.replace(/^([-+]?)\s*([,.])/,'$10$2');
  return parseFrNumber(t);
}
function baoNumericTail(raw=''){
  const cleaned=String(raw??'').replace(/(?<!\d)([-+]?),(?=\d)/g,'$10,');
  return numbersIn(cleaned);
}
function baoPhaseFromPage(page){
  const low=normLower(page?.text||'');
  if(/etat\s+apres\s+travaux|modification\s+(?:prioritaire|n[°ºo]?\s*\d+)|variante\s+\d+/.test(low)) return 'after';
  if(/etat\s+initial|etat\s+existant/.test(low)) return 'before';
  return '';
}
function baoLineAfter(lines,index,max=2){
  const parts=[];
  for(let j=index;j<Math.min(lines.length,index+max+1);j++){
    const t=normalizeText(lines[j]?.text||''); if(t) parts.push(t);
  }
  return normalizeText(parts.join(' | '));
}
function baoPrimaryFromRow(raw=''){
  const ns=baoNumericTail(raw);
  // Format Bao courant : Energie finale | Energie primaire | Dépense.
  // La consommation primaire est donc l'avant-dernière valeur, jamais le montant en euros.
  if(ns.length>=3) return ns.at(-2);
  if(ns.length===2) return ns.at(-1);
  return null;
}
function baoFinalEnergyFromRow(raw=''){
  const ns=baoNumericTail(raw);
  if(ns.length>=3) return ns.at(-3);
  if(ns.length===2) return ns[0];
  return null;
}
function baoEnergyPage(page){
  const low=normLower(page?.text||'');
  if(!/details\s+des\s+consommations/.test(low)||!/energie\s+primaire/.test(low)) return null;
  const phase=baoPhaseFromPage(page); if(!phase) return null;
  const lines=page.lines||[], values={}, finalEnergy={};
  const defs=[
    ['heating',/^chauffage\b/i],['cooling',/^refroidissement\b/i],['ecs',/^ecs\b|^eau\s+chaude\s+sanitaire\b/i],
    ['lighting',/^eclairage\b|^éclairage\b/i],['auxDist',/^auxiliaires\b/i],['auxVent',/^ventilateurs\b|^ventilation\b/i],['other',/^autres\s+usages\b/i]
  ];
  const headingRe=/^(?:chauffage|refroidissement|ecs|eau\s+chaude\s+sanitaire|eclairage|éclairage|auxiliaires|ventilateurs|ventilation|autres\s+usages|total\b)/i;
  let total=null,totalFinalEnergy=null, totalMwh=null,gesTonnes=null,gesKgM2=null;
  for(let i=0;i<lines.length;i++){
    const raw=normalizeText(lines[i].text), lowLine=normLower(raw);
    for(const [key,re] of defs){
      if(!re.test(raw)) continue;
      let source=raw, primary=baoPrimaryFromRow(source), ef=baoFinalEnergyFromRow(source);
      if(primary===null){
        for(let j=i+1;j<Math.min(lines.length,i+3);j++){
          const nraw=normalizeText(lines[j].text); if(!nraw) continue;
          if(headingRe.test(nraw)) break;
          const pv=baoPrimaryFromRow(nraw); if(pv!==null){ source=`${raw} | ${nraw}`; primary=pv; ef=baoFinalEnergyFromRow(nraw); break; }
        }
      }
      // Bao laisse parfois les colonnes énergie vides pour un poste nul et n'imprime que « 0,00 » en dépense.
      // On ne convertit ce zéro en énergie primaire que pour le refroidissement ET seulement si le rapport
      // indique ailleurs qu'il n'y a pas de système de refroidissement.
      if(key==='cooling'&&primary===null&&baoNumericTail(raw).length===1&&baoNumericTail(raw)[0]===0&&/sans\s+systeme\s+de\s+refroidissement/.test(normLower(page?._docText||''))){ primary=0; ef=0; }
      if(primary!==null&&primary>=0&&primary<5000){ values[key]=primary; if(ef!==null) finalEnergy[key]=ef; }
    }
    if(/^total\b/i.test(raw)&&!/depense|abonnement/i.test(lowLine)){
      const ns=baoNumericTail(raw); if(ns.length>=2){
        if(ns.length>=3){ totalFinalEnergy=ns.at(-3); total=ns.at(-2); }
        else total=ns.at(-1);
      }
    }
    let m;
    if((m=raw.match(/total\s+mwh\s*ep\s*\/\s*an\s*:\s*([-+]?\s*\d*[,.]?\d+)/i))) totalMwh=baoNumber(m[1]);
    if((m=raw.match(/total\s*\(\s*tonnes?\s*\)\s*:\s*([-+]?\s*\d*[,.]?\d+)/i))) gesTonnes=baoNumber(m[1]);
    if((m=raw.match(/total\s+kwh\s*ep\s*\/\s*m[²2]\s*\.?(?:an)?\s*:\s*([-+]?\s*\d*[,.]?\d+)/i))) total=baoNumber(m[1]);
    if((m=raw.match(/total\s*\(\s*kg\s*\/\s*m[²2]\s*\)\s*:\s*([-+]?\s*\d*[,.]?\d+)/i))) gesKgM2=baoNumber(m[1]);
  }
  return {page,phase,values,finalEnergy,total,totalFinalEnergy,totalMwh,gesTonnes,gesKgM2};
}
function parseStructuredRenovationThermal(doc){
  if(!isStructuredRenovationThermalDocument(doc)) return [];
  const out=[], allText=normLower(doc.read?.text||'');
  const add=(page,line,field,value,method,confidence=.995,unit='',extra={})=>{ if(value===null||value===undefined||value==='') return; push(out,occ(doc,page,line,field,value,method,confidence,unit,{origin:'Étude thermique rénovation structurée',...extra})); };
  const energyPages=[], recap={}, gesAbsolute={};
  let titleHousing=null, firstBuildingLine=null;

  let activePhase='';
  for(const page of doc.read.pages||[]){
    // Permet au parseur de ligne de vérifier les systèmes annoncés ailleurs dans le rapport sans multiplier les recherches.
    page._docText=allText;
    const explicitPagePhase=baoPhaseFromPage(page); if(explicitPagePhase) activePhase=explicitPagePhase;
    const phase=activePhase, lines=page.lines||[];
    const ep=baoEnergyPage(page); if(ep) energyPages.push(ep);
    for(let i=0;i<lines.length;i++){
      const line=lines[i], raw=normalizeText(line.text), low=normLower(raw), ctx=baoLineAfter(lines,i,2); let m;
      const building=buildingForPosition(doc,page.page,line.index);
      if(!firstBuildingLine&&/batiment\s+n[°ºo]?\s*1|bâtiment\s+n[°ºo]?\s*1/i.test(raw)) firstBuildingLine={page,line,building};
      if(titleHousing===null&&(m=raw.match(/(?:etude\s+thermique\s+)?(\d+)\s+logements?\b/i))){ const n=parseInt(m[1],10); if(n>0&&n<10000) titleHousing={n,page,line,building}; }

      if((m=raw.match(/numero\s+de\s+departement\s*:\s*(\d{1,3})/i))){ const d=m[1].padStart(2,'0'); add(page,line,'department',d,'bao:department-code',.999,'',{building:'Bâtiment unique',excerpt:ctx}); }
      if((m=raw.match(/type\s+de\s+batiment\s*:\s*(.+)$/i))){ const v=normLower(m[1]); const work=/logements?\s+collectifs?/.test(v)?'Logement collectif':/maisons?\s+individuelles?|logements?\s+individuels?/.test(v)?'Maison individuelle':normalizeText(m[1]); add(page,line,'work_type',work,'bao:building-type',.995,'',{building:'Bâtiment unique',excerpt:ctx}); }
      if((m=raw.match(/surface\s+habitable\s*:\s*([\d\s.,]+)\s*m[²2]/i))){ const v=parseFrNumber(m[1]); if(v&&v>20) add(page,line,'shab',v,'bao:shab',.999,'m²',{building,surfacePriority:100,excerpt:ctx,provenanceNote:'Surface habitable explicitement indiquée par Bao Evolution.'}); }
      // Bao imprime une valeur Ubat explicite dans deux blocs distincts. On la rattache à la phase
      // déterminée par les titres de section, et jamais à une valeur U de paroi voisine.
      if((m=raw.match(/coefficient\s+ubat\s*=\s*([-+]?\d+(?:[,.]\d+)?)/i))){
        const v=parseFrNumber(m[1]);
        if(v!==null&&phase==='before') add(page,line,'ubat_before',v,'bao:ubat-before-explicit',.999,'W/m².K',{building,excerpt:ctx,provenanceNote:'Valeur lue sur la ligne « COEFFICIENT UBAT » du bloc ÉTAT INITIAL.'});
        if(v!==null&&phase==='after') add(page,line,'ubat_after',v,'bao:ubat-after-explicit',.999,'W/m².K',{building,excerpt:ctx,provenanceNote:'Valeur lue sur la ligne « COEFFICIENT UBAT » du bloc ÉTAT APRÈS TRAVAUX.'});
      }

      // Systèmes avant/après : lecture des champs exacts Bao, sans interpréter les listes d'exemples entre parenthèses.
      if((m=raw.match(/systeme\s+de\s+refroidissement\s*:\s*(.+)$/i))&&phase==='after'){
        const v=/sans\s+systeme\s+de\s+refroidissement/i.test(m[1])?'Sans système de refroidissement':findFirstMatch(m[1],COOLING)||normalizeText(m[1]);
        add(page,line,'cooling',v,'bao:cooling-after',.999,'',{building,excerpt:ctx});
      }
      if((m=raw.match(/type\s+de\s+chauffage\s*:\s*electrique\s+thermodynamique/i))){
        if(phase==='before') add(page,line,'heating_vector_before','Électricité','bao:heating-vector-before',.999,'',{building,excerpt:ctx});
        if(phase==='after') add(page,line,'heating_vector_after','Électricité','bao:heating-vector-after',.999,'',{building,excerpt:ctx});
      }
      if((m=raw.match(/type\s+de\s+generateur\s*:\s*(.+)$/i))&&phase==='after'){
        const mode=findFirstMatch(m[1],HVAC.heating); if(mode) add(page,line,'heating_mode_after',mode,'bao:heating-generator-after',.999,'',{building,excerpt:ctx});
      }
      if((m=raw.match(/type\s+d['’]?energie\s+pour\s+la\s+production\s+de\s+chaud\s*:\s*(.+)$/i))){
        const vec=findFirstMatch(m[1],HVAC.vectors); if(vec&&phase==='before') add(page,line,'heating_vector_before',vec,'bao:generator-energy-before',.999,'',{building,excerpt:ctx}); if(vec&&phase==='after') add(page,line,'heating_vector_after',vec,'bao:generator-energy-after',.999,'',{building,excerpt:ctx});
      }
      if((m=raw.match(/type\s+d['’]?ecs\s*:\s*(.+)$/i))){ const vec=findFirstMatch(m[1],HVAC.vectors); if(vec&&phase==='before') add(page,line,'ecs_vector_before',vec,'bao:ecs-vector-before',.999,'',{building,excerpt:ctx}); if(vec&&phase==='after') add(page,line,'ecs_vector_after',vec,'bao:ecs-vector-after',.999,'',{building,excerpt:ctx}); }
      if((m=raw.match(/type\s+de\s+stockage\s*:\s*(.+)$/i))&&phase==='after'){
        const mode=findFirstMatch(m[1],HVAC.ecs); if(mode){
          const nearby=normalizeText(lines.slice(Math.max(0,i-2),Math.min(lines.length,i+4)).map(x=>x.text).join(' | '));
          const vol=nearby.match(/volume\s+de\s+stockage\s*:\s*([\d.,]+)/i), count=nearby.match(/nombre\s*:\s*(\d+)/i);
          const note=[count?`${count[1]} ballon(s)`:null,vol?`${String(vol[1]).replace('.',',')} L`:null].filter(Boolean).join(' · ');
          add(page,line,'ecs',mode,'bao:ecs-storage-after',.999,'',{building,excerpt:ctx,provenanceNote:note?`Production ECS : ${note}.`:'Type de stockage explicitement indiqué.'});
        }
      }
      if((m=raw.match(/systeme\s+de\s+ventilation\s*:\s*(.+)$/i))&&phase==='after'){
        const vent=findFirstMatch(m[1],HVAC.ventilation)||normalizeText(m[1]); add(page,line,'ventilation',vent,'bao:ventilation-after',.999,'',{building,excerpt:ctx});
      }

      // Enveloppe : on privilégie l'état final quand le rapport est une rénovation.
      if(phase==='after'){
        if(/parois?\s+me\d*\s*\/\s*murs?\s+exterieurs?|murs?\s+exterieurs?/i.test(raw)){
          const block=normalizeText(lines.slice(i,Math.min(lines.length,i+15)).map(x=>x.text).join(' | '));
          if(/brique\s+creuse/i.test(block)) add(page,line,'wall_structure','Brique terre cuite','bao:wall-structure-after',.998,'',{building,excerpt:block.slice(0,420)});
          const iso=block.match(/doublage\s+isover[^|]{0,80}?(?:r\s*=\s*([\d.,]+))?[^|]{0,80}?\b(\d{1,3}(?:[,.]\d+)?)\s*(?:cm\b)?/i);
          const rr=block.match(/doublage\s+isover[^|]{0,80}?r\s*=\s*([\d.,]+)/i), th=block.match(/doublage\s+isover[^|]{0,120}?\b(\d{1,2}(?:[,.]\d+)?)\s*(?:cm)\b/i);
          if(/doublage\s+isover/i.test(block)) add(page,line,'wall_insulation','Laine de verre','bao:wall-insulation-after',.93,'',{building,libraryDerived:true,excerpt:block.slice(0,420),provenanceNote:'Matériau déduit de la marque ISOVER et contrôlé par le couple épaisseur/R ; le rapport n’indique pas le nom produit exact.'});
          const directIsoRow=block.match(/doublage\s+isover\s+r\s*=\s*([\d.,]+)\s+(\d{1,3}(?:[,.]\d+)?)\s+([\d.,]+)\s+100/i);
          if(directIsoRow){ const rv=parseFrNumber(directIsoRow[1]), tv=parseFrNumber(directIsoRow[2]); if(tv) add(page,line,'wall_insulation_thickness',tv*10,'bao:wall-insulation-thickness-after',.999,'mm',{building,excerpt:block.slice(0,420),provenanceNote:'Épaisseur lue dans la ligne de composition Bao (colonne cm).'}); if(rv) add(page,line,'wall_insulation_r',rv,'bao:wall-insulation-r-after',.999,'m².K/W',{building,excerpt:block.slice(0,420)}); }
          else { if(th){ const v=parseFrNumber(th[1]); if(v) add(page,line,'wall_insulation_thickness',v*10,'bao:wall-insulation-thickness-after',.998,'mm',{building,excerpt:block.slice(0,420)}); } if(rr){ const v=parseFrNumber(rr[1]); if(v) add(page,line,'wall_insulation_r',v,'bao:wall-insulation-r-after',.999,'m².K/W',{building,excerpt:block.slice(0,420)}); } }
        }
        if(/parois?\s+to\d*\s*\/\s*plafond|type\s+de\s+plafond/i.test(raw)){
          const block=normalizeText(lines.slice(i,Math.min(lines.length,i+15)).map(x=>x.text).join(' | '));
          if(/dalle\s+beton|plancher\s*-?\s*dalle\s+beton/i.test(normLower(block))) add(page,line,'roof_structure','Dalle béton','bao:roof-structure-after',.997,'',{building,excerpt:block.slice(0,420)});
          if(/laine\s+de\s+verre/i.test(block)){ add(page,line,'roof_insulation','Laine de verre','bao:roof-insulation-after',.999,'',{building,excerpt:block.slice(0,420)}); const r=block.match(/laine\s+de\s+verre[^|]{0,100}?\b(\d{1,2}(?:[,.]\d+)?)\s+([\d.,]+)\s+100/i); if(r){ add(page,line,'roof_insulation_thickness',parseFrNumber(r[1])*10,'bao:roof-thickness-after',.997,'mm',{building,excerpt:block.slice(0,420)}); add(page,line,'roof_insulation_r',parseFrNumber(r[2]),'bao:roof-r-after',.997,'m².K/W',{building,excerpt:block.slice(0,420)}); } }
        }
        if(/parois?\s+pl\s*\/\s*plancher|type\s+de\s+plancher/i.test(raw)){
          const block=normalizeText(lines.slice(i,Math.min(lines.length,i+18)).map(x=>x.text).join(' | '));
          if(/dalle\s+beton|plancher\s*-?\s*dalle\s+beton/i.test(normLower(block))) add(page,line,'floor_structure','Dalle béton','bao:floor-structure-after',.997,'',{building,excerpt:block.slice(0,420)});
          // Ne pas recopier l'isolant de l'état initial si Bao annonce « Paroi non rénovée » et qu'aucune couche isolante n'est présente dans le bloc final.
          if(!/paroi\s+non\s+renovee/i.test(normLower(block))){
            if(/laine\s+de\s+roche/i.test(block)) add(page,line,'floor_insulation','Laine de roche','bao:floor-insulation-after',.999,'',{building,excerpt:block.slice(0,420)});
          }
        }
        if(/catalogue\s+des\s+vitrages|\bfe\d+\b.*\bdouble\b/i.test(raw)){
          const block=normalizeText(lines.slice(i,Math.min(lines.length,i+18)).map(x=>x.text).join(' | '));
          const lame=block.match(/\+\s*(\d{1,2}(?:[,.]\d+)?)\s*mm/i); const gl=/\bdouble\b/i.test(block)&&lame?`Double vitrage — lame ${String(parseFrNumber(lame[1])).replace('.',',')} mm`:normalizeGlazingType(block); if(gl) add(page,line,'window_glazing',gl,'bao:glazing-after',.999,'',{building,excerpt:block.slice(0,420),provenanceNote:'Bao indique la nature du vitrage et la largeur de lame, mais pas les épaisseurs des verres : aucune composition 4.x.4 n’est inventée.'});
          if(/volet\s+roulant\s+alu/i.test(block)) add(page,line,'window_shading','Volet roulant','bao:shading-after',.999,'',{building,excerpt:block.slice(0,420),provenanceNote:'Fermeture indiquée par Bao : volet roulant aluminium.'});
        }
      }

      // Récapitulatif : deuxième source indépendante de contrôle pour Cep total et GES surfacique.
      if(/\betat\s+initial\b/i.test(raw)&&/\d/.test(raw)&&/recapitulatif/i.test(normLower(page.text||''))){ const ns=baoNumericTail(raw.replace(/^\s*\d+\s*/,'')); if(ns.length>=3) recap.before={mwh:ns[0],cep:ns[1],gesKgM2:ns[2]}; }
      if(/\betat\s+apres\s+travaux\b/i.test(raw)&&/\d/.test(raw)&&/recapitulatif/i.test(normLower(page.text||''))){ const ns=baoNumericTail(raw.replace(/^\s*\d+\s*/,'')); if(ns.length>=3) recap.after={mwh:ns[0],cep:ns[1],gesKgM2:ns[2]}; }

      if((m=raw.match(/emission\s+de\s+co2\s+avant\s+travaux\s*:\s*([\d\s.,-]+)\s*kg\s*co2/i))) gesAbsolute.before=baoNumber(m[1]);
      if((m=raw.match(/emission\s+de\s+co2\s+apres\s+travaux\s*:\s*([\d\s.,-]+)\s*kg\s*co2/i))) gesAbsolute.after=baoNumber(m[1]);
      if((m=raw.match(/emission\s+de\s+co2\s+des\s+travaux\s*:\s*([\d\s.,-]+)\s*kg\s*co2/i))) gesAbsolute.works=baoNumber(m[1]);
      if((m=raw.match(/economie\s+realisee\s*:\s*([-+\d\s.,]+)\s*kg/i))) gesAbsolute.saving30y=baoNumber(m[1]);
    }
  }

  if(titleHousing){
    add(titleHousing.page,titleHousing.line,'housing_count',titleHousing.n,'bao:housing-count-title',.995,'',{building:titleHousing.building,provenanceNote:'Nombre de logements lu une seule fois dans le titre du rapport Bao.'});
    if(/type\s+de\s+batiment\s*:\s*logements?\s+collectifs?/.test(allText)){
      add(titleHousing.page,titleHousing.line,'housing_collective_units',titleHousing.n,'bao:collective-housing-count',.99,'',{building:'Bâtiment unique'});
      add(titleHousing.page,titleHousing.line,'housing_total',titleHousing.n,'bao:housing-total',.99,'',{building:'Bâtiment unique'});
    }
  }
  if(firstBuildingLine){
    add(firstBuildingLine.page,firstBuildingLine.line,'building_total',1,'bao:single-building',.93,'',{building:'Bâtiment unique',derivedFromDocument:true,provenanceNote:'Un seul identifiant bâtiment est présent dans le rapport Bao analysé.'});
    if(/type\s+de\s+batiment\s*:\s*logements?\s+collectifs?/.test(allText)) add(firstBuildingLine.page,firstBuildingLine.line,'housing_collective_buildings',1,'bao:single-collective-building',.93,'',{building:'Bâtiment unique',derivedFromDocument:true,provenanceNote:'Le rapport décrit un seul bâtiment et le qualifie de logements collectifs.'});
  }

  for(const e of energyPages){
    const lines=e.page.lines||[], line=lines.find(l=>/^total\b/i.test(normalizeText(l.text))&&!/depense/i.test(normLower(l.text)))||lines.find(l=>/total\s+kwh\s*ep/i.test(normLower(l.text)))||lines[0];
    const building=buildingForPosition(doc,e.page.page,line?.index||0);
    const vals=e.values;
    const sumKeys=['heating','cooling','ecs','lighting','auxDist','auxVent','other'];
    const complete=sumKeys.every(k=>Number.isFinite(vals[k]));
    const sum=complete?Math.round(sumKeys.reduce((a,k)=>a+vals[k],0)*1000)/1000:null;
    const crossOk=Number.isFinite(e.total)&&Number.isFinite(sum)&&Math.abs(e.total-sum)<=0.12;
    const summary=recap[e.phase]; const recapOk=Number.isFinite(summary?.cep)&&Number.isFinite(e.total)&&Math.abs(summary.cep-e.total)<=0.15;
    const parts=[['Chauffage',vals.heating],['Refroidissement',vals.cooling],['ECS',vals.ecs],['Éclairage',vals.lighting],['Aux. distribution',vals.auxDist],['Aux. ventilation',vals.auxVent],['Autres usages',vals.other]].filter(([,v])=>Number.isFinite(v));
    const breakdown=parts.map(([k,v])=>`${k} ${String(v).replace('.',',')}`).join(' ; ');
    const gesParts=[];
    if(Number.isFinite(e.gesKgM2)) gesParts.push(`${String(e.gesKgM2).replace('.',',')} kgCO₂e/m².an`);
    if(Number.isFinite(e.gesTonnes)) gesParts.push(`${String(e.gesTonnes).replace('.',',')} tCO₂e/an`);
    if(Number.isFinite(gesAbsolute[e.phase])) gesParts.push(`${String(gesAbsolute[e.phase]).replace('.',',')} kgCO₂e/an (évolution GES)`);
    const discrepancy=Number.isFinite(e.gesTonnes)&&Number.isFinite(gesAbsolute[e.phase])&&Math.abs(e.gesTonnes*1000-gesAbsolute[e.phase])>Math.max(25,e.gesTonnes*1000*.03);
    const note=`Consommations d’énergie primaire par poste : ${breakdown}${Number.isFinite(e.total)?` ; total ${String(e.total).replace('.',',')} kWhEP/m².an`:''}.${gesParts.length?` Bilan GES : ${gesParts.join(' ; ')}.`:''}${crossOk?' Somme des postes = total Bao : contrôle OK.':''}${recapOk?' Récapitulatif final cohérent avec le tableau détaillé.':''}${discrepancy?' Attention : les deux valeurs annuelles de GES imprimées dans le rapport ne sont pas strictement cohérentes ; elles sont conservées séparément sans fusion.':''}`;
    const meta={building,excerpt:normalizeText(e.page.text||'').slice(0,420),provenanceNote:note,baoBreakdown:{...vals},baoEnergyFinal:{...e.finalEnergy},baoGes:{kgM2:e.gesKgM2,tonnesPerYear:e.gesTonnes,kgPerYear:gesAbsolute[e.phase],worksKgPerYear:gesAbsolute.works,saving30yKg:gesAbsolute.saving30y},baoChecks:{postSum:sum,crossOk,recapOk,recap:summary||null}};
    if(Number.isFinite(e.total)){
      if(e.phase==='before') add(e.page,line,'cep_before',e.total,'bao:primary-energy-total-before',(crossOk&&recapOk)?0.999:0.997,'kWhEP/m².an',meta);
      else { add(e.page,line,'cep_after_final',e.total,'bao:primary-energy-total-after',(crossOk&&recapOk)?0.999:0.997,'kWhEP/m².an',meta); add(e.page,line,'cep',e.total,'bao:primary-energy-total-project',(crossOk&&recapOk)?0.999:0.997,'kWhEP/m².an',meta); }
    }
    // Les colonnes détaillées existantes du schéma décrivent le résultat projet/final : ne pas y injecter l'état initial.
    if(e.phase==='after'){
      const map=[['cep_cooling','cooling'],['cep_lighting','lighting'],['cep_aux_dist','auxDist'],['cep_aux_vent','auxVent']];
      for(const [field,key] of map) if(Number.isFinite(vals[key])) add(e.page,line,field,vals[key],`bao:primary-energy-post-${key}`,.999,'kWhEP/m².an',meta);
      // Dans ce Bao, tous les postes du bilan sont électriques. Le total EP peut donc alimenter Cep électricité,
      // mais uniquement si aucune autre énergie combustible/réseau n'est décrite dans le tableau de bilan.
      const pageEnergyLow=normLower(e.page.text||'');
      if(Number.isFinite(e.total)&&/electricit/.test(pageEnergyLow)&&!/(?:gaz\s+naturel|fuel\s+domestique|fioul|biomasse|reseau\s+de\s+chaleur)/.test(pageEnergyLow)) add(e.page,line,'cep_electricity',e.total,'bao:primary-energy-by-vector-electricity',.985,'kWhEP/m².an',{...meta,derivedFromDocument:true,provenanceNote:`${note} Cep électricité = total, car aucune autre énergie n’est portée par ce tableau de bilan.`});
    }
  }

  // Nettoyage des propriétés temporaires placées sur les pages.
  for(const page of doc.read.pages||[]) try{ delete page._docText; }catch{}
  return out;
}

function parseThermalStudy(doc){
  const out=[];
  const add=(page,line,field,value,method,confidence=.98,unit='',extra={})=>{ if(value===null||value===undefined||value==='') return; push(out,occ(doc,page,line,field,value,method,confidence,unit,{origin:doc.type===DOC_TYPES.RT_EXISTING?'RT Existant':'Étude thermique',...extra})); };
  for(const page of doc.read.pages){ const lines=page.lines||[]; let phase=thermalStudyPhase(page.text||''); let currentPost=''; const pageLow=normLower(page.text||'');
    // Les chapitres 4.x décrivent l'existant, 5.x les travaux projetés et 6.1/6.2 les résultats avant/après.
    // Bao Evolution utilise plutôt « ETAT INITIAL » puis « Modification / Etat après travaux ».
    if(/\b6\.1\.?\s+(?:etat|état)\s+existant|\b4\.1\.?\s+(?:etat|état)\s+existant|\betat\s+initial\b/.test(pageLow)) phase='before';
    if(/\b6\.2\.?\s+(?:etat|état)\s+(?:projete|projeté)|\b5\.4\.?\s+scenario|\b5\.4\.\d|\betat\s+apres\s+travaux\b|\bmodification\s+n?[°ºo]?\s*\d+/.test(pageLow)) phase='after';
    for(let i=0;i<lines.length;i++){
      const line=lines[i], raw=normalizeText(line.text), low=normLower(raw), ctx=normalizeText(lineWindow(page,i,1,2));
      const explicitPhase=thermalStudyPhase(raw); if(explicitPhase) phase=explicitPhase;
      const building=buildingForPosition(doc,page.page,line.index);
      let m;
      // SHAB / SU globale explicitement annoncée par l'étude.
      if((m=raw.match(/(?:shab\s*\/\s*su|surface\s+habitable)\s*[:=]?\s*([\d\s.,]+)/i))){ const v=parseFrNumber(m[1]); if(v&&v>20) add(page,line,'shab',v,'thermal:shab-explicit',.99,'m²',{building,surfacePriority:100,excerpt:ctx.slice(0,420)}); }
      if((m=raw.match(/^\s*shab\s+(?:m2|m²)\s+([\d\s.,]+)/i))){ const v=parseFrNumber(m[1]); if(v&&v>20) add(page,line,'shab',v,'thermal:shab-summary',.99,'m²',{building,surfacePriority:100,excerpt:ctx.slice(0,420)}); }

      // Ubat : uniquement les libellés de résultats explicites, jamais un nombre voisin (ex. « gain 57 % »).
      if((m=raw.match(/ubat\s+(?:du\s+)?b[aâ]timent\s*[:=]?\s*(\d+(?:[,.]\d+)?)/i))){ const v=parseFrNumber(m[1]); if(phase==='before') add(page,line,'ubat_before',v,'thermal:ubat-before-structured',.995,'W/m².K',{building,excerpt:ctx.slice(0,420)}); else if(phase==='after') add(page,line,'ubat_after',v,'thermal:ubat-after-structured',.995,'W/m².K',{building,excerpt:ctx.slice(0,420)}); }
      if((m=raw.match(/ubat\s+(?:initial|avant)\s*[:=]?\s*(\d+(?:[,.]\d+)?)/i))) add(page,line,'ubat_before',parseFrNumber(m[1]),'thermal:ubat-before-summary',.995,'W/m².K',{building,excerpt:ctx.slice(0,420)});
      if((m=raw.match(/ubat\s+(?:projet|apr[eè]s)\s*[:=]?\s*(\d+(?:[,.]\d+)?)/i))) add(page,line,'ubat_after',parseFrNumber(m[1]),'thermal:ubat-after-summary',.995,'W/m².K',{building,excerpt:ctx.slice(0,420)});
      if((m=raw.match(/coefficient\s+ubat\s*[:=]\s*(\d+(?:[,.]\d+)?)/i))){ const v=parseFrNumber(m[1]); if(phase==='before') add(page,line,'ubat_before',v,'thermal:bao-ubat-before',.999,'W/m².K',{building,excerpt:ctx.slice(0,420),provenanceNote:'Coefficient Ubat explicite du bloc Etat initial.'}); else if(phase==='after') add(page,line,'ubat_after',v,'thermal:bao-ubat-after',.999,'W/m².K',{building,excerpt:ctx.slice(0,420),provenanceNote:'Coefficient Ubat explicite du bloc Etat après travaux.'}); }

      // Coefficients Cep : ne retenir que les lignes de résultat, pas les objectifs réglementaires dans le texte.
      if((m=raw.match(/coefficient\s+cep\s+existant[^0-9]{0,80}(\d+(?:[,.]\d+)?)/i))){ const v=parseFrNumber(m[1]); add(page,line,'cep_before',v,'thermal:cep-before-structured',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)}); }
      if((m=raw.match(/coefficient\s+cep\s+projet[^0-9]{0,80}(\d+(?:[,.]\d+)?)/i))){ const v=parseFrNumber(m[1]); add(page,line,'cep',v,'thermal:cep-project-structured',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)}); add(page,line,'cep_after_final',v,'thermal:cep-after-structured',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)}); }
      if((m=raw.match(/coefficient\s+cep\s+(?:r[eé]f\.?|reference|référence|max)[^0-9]{0,80}(\d+(?:[,.]\d+)?)/i))) add(page,line,'cep_max',parseFrNumber(m[1]),'thermal:cep-reference',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)});
      if((m=raw.match(/coefficient\s+cep\s+gain[^0-9]{0,50}(\d+(?:[,.]\d+)?)/i))) add(page,line,'cep_gain',parseFrNumber(m[1]),'thermal:cep-gain',.995,'%',{building,excerpt:ctx.slice(0,420)});
      // RT existant : ligne de tableau « Groupe 001 °C 25.02 28.44 -3.42 ».
      if(/tic\s*\(a\)|tic\s+ref\s*\(b\)|temp[eé]ratures?\s+d['’]?ete/i.test(pageLow)){
        const tm=raw.match(/(?:groupe|zone)[^°]{0,80}°c\s+([-+]?\d+(?:[,.]\d+)?)\s+([-+]?\d+(?:[,.]\d+)?)/i);
        if(tm){ add(page,line,'tic',parseFrNumber(tm[1]),'thermal:tic-table',.995,'°C',{building,excerpt:ctx.slice(0,420)}); add(page,line,'tic_ref',parseFrNumber(tm[2]),'thermal:tic-ref-table',.995,'°C',{building,excerpt:ctx.slice(0,420)}); }
      }


      // État courant du tableau de consommations par poste.
      if(/^chauffage\b/i.test(raw)) currentPost='heating';
      else if(/^refroidissement\b/i.test(raw)) currentPost='cooling';
      else if(/^ecs\b|^eau\s+chaude\s+sanitaire\b/i.test(raw)) currentPost='ecs';
      else if(/^eclairage\b|^éclairage\b/i.test(raw)) currentPost='lighting';
      else if(/^auxiliaires\b/i.test(raw)) currentPost='aux';
      if(currentPost==='cooling'&&/sans\s+objet/i.test(low)) add(page,line,'cep_cooling',0,'thermal:cep-cooling-none',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)});
      if(/total\s+energie\s+primaire/i.test(low)){
        const nums=numbersIn(raw), v=nums.length?nums[nums.length-1]:null;
        if(v!==null&&v>=0&&v<1000){
          if(currentPost==='cooling') add(page,line,'cep_cooling',v,'thermal:cep-cooling-total',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)});
          else if(currentPost==='lighting') add(page,line,'cep_lighting',v,'thermal:cep-lighting-total',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)});
          else if(currentPost==='aux'&&!/^vent\s*-/i.test(raw)) add(page,line,'cep_aux_dist',v,'thermal:cep-aux-distribution-total',.97,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420),provenanceNote:'Valeur « Total énergie primaire » du bloc auxiliaires ; la part ventilateurs est lue séparément lorsqu’elle est fournie.'});
        }
      }
      if(/vent\s*-\s*total\s+energie\s+primaire/i.test(low)){ const nums=numbersIn(raw); if(nums.length) add(page,line,'cep_aux_vent',nums[nums.length-1],'thermal:cep-aux-vent',.995,'kWhEP/m².an',{building,excerpt:ctx.slice(0,420)}); }

      // Tableaux de prescriptions isolants : Paroi + produit + épaisseur + R sur une même ligne.
      const target=targetFromContext(raw); const mat=findFirstMatch(raw,MATERIALS);
      if(target&&mat&&/(?:ecorock|fibrexpan|efigreen|isolant|laine|pse|pur|pir|xps)/i.test(low)){
        const nums=numbersIn(raw); let th=null,r=null;
        // Dans les tableaux BET : les deux nombres après le produit sont généralement Ep. cm puis R isolant.
        for(let q=0;q<nums.length-1;q++){ if(nums[q]>=2&&nums[q]<=60&&nums[q+1]>=0.5&&nums[q+1]<=12){ th=nums[q]*10; r=nums[q+1]; break; } }
        add(page,line,`${target}_insulation`,mat,'thermal:insulation-table',.995,'',{building,excerpt:ctx.slice(0,420)});
        if(th!==null) add(page,line,`${target}_insulation_thickness`,th,'thermal:insulation-thickness-table',.995,'mm',{building,excerpt:ctx.slice(0,420)});
        if(r!==null) add(page,line,`${target}_insulation_r`,r,'thermal:insulation-r-table',.995,'m².K/W',{building,excerpt:ctx.slice(0,420)});
      }

      // Équipements projetés explicitement décrits dans les chapitres travaux.
      if(phase==='after'){
        if(/simple\s+flux\s+hygror[eé]glable\s+de\s+type\s+a|vmc\s+hygro\s*a/i.test(raw)) add(page,line,'ventilation','VMC Hygro A','thermal:project-ventilation',.995,'',{building,excerpt:ctx.slice(0,420)});
        if(/chaudi[eè]res?.{0,45}gaz.{0,25}condensation|gaz\s+[aà]\s+condensation/i.test(raw)){ add(page,line,'heating_mode_after','Chaudière condensation','thermal:project-heating',.995,'',{building,excerpt:ctx.slice(0,420)}); add(page,line,'heating_vector_after','Gaz','thermal:project-heating-vector',.995,'',{building,excerpt:ctx.slice(0,420)}); }
        if(/production\s+d['’]?ecs\s+collective|production\s+ecs\s+collective/i.test(raw)) add(page,line,'ecs','ECS collective','thermal:project-ecs',.98,'',{building,excerpt:ctx.slice(0,420)});
      }
    }
  }
  return out;
}

function parseProgram(doc){
  const out=[];
  for(const page of doc.read.pages){ const lines=page.lines||[], pageTypes=[];
    for(let i=0;i<lines.length;i++){ const line=lines[i], s=normalizeText(line.text), ctx=lineWindow(page,i,1,1);
      const countPatterns=[/(?:nombre|nb\.?|nombre\s+total)\s*(?:de\s+)?logements?\s*[:=\-]?\s*(\d+)/i,/\bconstruction\s+de\s+(\d+)\s+logements?\b/i,/\bprogramme\s+(?:de|comprenant)\s+(\d+)\s+logements?\b/i,/\b(?:comprend|comprenant|comporte)\s+(\d+)\s+logements?\b/i,/\b(\d+)\s+logements?\b/i];
      const repeatedThermalHeader=/(?:etude|étude)\s+(?:thermique|energetique|énergétique)\s+\d+\s+logements?/i.test(s)&&page.page>1;
      if(!repeatedThermalHeader) for(const re of countPatterns){ const m=s.match(re); if(m){ const n=parseInt(m[1],10); if(n>0&&n<10000){ push(out,occ(doc,page,line,'housing_count',n,'program:housing-count-explicit',0.88,'',{excerpt:normalizeText(ctx).slice(0,420)})); break; } } }
      const yearPatterns=[/(?:annee\s+de\s+construction|année\s+de\s+construction|construit\s+en|construction\s+en|acheve\s+en|achevé\s+en|annee\s+d['’]achevement|année\s+d['’]achèvement)\D{0,20}(17\d{2}|18\d{2}|19\d{2}|20\d{2})/i,/(?:immeuble|batiment|bâtiment)\D{0,40}(?:de|en|construit\s+en)\s*(17\d{2}|18\d{2}|19\d{2}|20\d{2})/i];
      for(const re of yearPatterns){ const m=s.match(re); if(m){ const around=normLower(s); if(/(?:entre|de)\s+(?:17|18|19|20)\d{2}\s+(?:et|a|à|-)\s+(?:17|18|19|20)\d{2}/.test(around)) break; push(out,occ(doc,page,line,'construction_year',parseInt(m[1],10),'program:construction-year',0.90)); break; } }
      if(![DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(doc.type) && [DOC_TYPES.PLAN,DOC_TYPES.SURFACE,DOC_TYPES.NOTICE,DOC_TYPES.PERMIT].includes(doc.type)){ const found=s.match(/\b(?:studio|T1\s*bis|T[1-9]|F[1-9]|maison\s+individuelle|duplex|triplex)\b/ig)||[]; pageTypes.push(...found.map(x=>x.toUpperCase().replace(/\s+/g,' '))); }
    }
    const ty=unique(pageTypes); if(ty.length){ const line=lines.find(l=>/(?:studio|T1\s*bis|T[1-9]|F[1-9]|maison\s+individuelle|duplex|triplex)/i.test(l.text))||lines[0]; const conf=[DOC_TYPES.PLAN,DOC_TYPES.SURFACE].includes(doc.type)?0.88:0.94; push(out,occ(doc,page,line,'housing_typologies',ty.join(', '),'program:typologies-page',conf,'',{excerpt:`Typologies explicites détectées sur la page : ${ty.join(', ')}`})); }
  } return out;
}

function parseEnvelope(doc){
  const out=[];
  for(const page of doc.read.pages){
    if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(doc.type) && /(?:chapitre\s*3\s*:.*indicateurs|donn[eé]es\s+r[eé]capitulatives\s+sur\s+les\s+parois)/i.test(page.text||'')) continue;
    const lines=page.lines||[]; for(let i=0;i<lines.length;i++){
    const line=lines[i], base=normalizeText(line.text); let ctx=base, target=targetFromContext(base);
    const baseMat=findFirstMatch(base,MATERIALS), baseStruct=findFirstMatch(base,STRUCTURES);
    if(target) ctx=normalizeText(lineWindow(page,i,0,2));
    else if(baseMat||baseStruct){ ctx=normalizeText(lineWindow(page,i,1,0)); target=targetFromContext(ctx); }
    else if(ELEMENT_PATTERNS.window.test(base)) ctx=normalizeText(lineWindow(page,i,0,2));
    else continue;
    const explicitTh=explicitThickness(base)??explicitThickness(ctx);
    const productMatch=(target&&matchInsulationProduct(base,target,explicitTh))||(target&&matchInsulationProduct(ctx,target,explicitTh));
    const mat=productMatch?.material||baseMat||findFirstMatch(ctx,MATERIALS), struct=baseStruct||findFirstMatch(ctx,STRUCTURES);
    const hasEnvelope=/isol|thermi|paroi|mur|facade|toiture|plancher|dalle|combles|rampant|ite|iti|sarking|bardage|doublage|contre[- ]cloison|solive/i.test(ctx);
    if(struct && hasEnvelope){ const field=target?`${target}_structure`:'structure'; push(out,occ(doc,page,line,field,struct,'envelope:structure-context',target?0.91:0.87,'',{excerpt:ctx.slice(0,420)})); }
    if(mat && target && hasEnvelope){
      const productExtra=productMatch?{libraryProductMatch:true,libraryBrand:productMatch.brand,libraryProduct:productMatch.product,librarySource:productMatch.source}:{};
      push(out,occ(doc,page,line,`${target}_insulation`,mat,productMatch?'envelope:insulation-product':'envelope:insulation-context',productMatch?0.96:0.93,'',{excerpt:ctx.slice(0,420),...productExtra}));
      if(explicitTh!==null) push(out,occ(doc,page,line,`${target}_insulation_thickness`,explicitTh,'envelope:thickness-context',productMatch?0.96:0.94,'mm',{excerpt:ctx.slice(0,420),...productExtra}));
      else if(productMatch?.variant && productMatch.thicknessEvidence==='product-context'){
        push(out,occ(doc,page,line,`${target}_insulation_thickness`,productMatch.variant.thickness,'library:insulation-thickness',0.93,'mm',{excerpt:ctx.slice(0,420),libraryDerived:true,origin:'Bibliothèque isolants',provenanceNote:libraryNote(productMatch,'thickness'),...productExtra}));
      }
      const r=explicitR(base)??explicitR(ctx);
      if(r!==null) push(out,occ(doc,page,line,`${target}_insulation_r`,r,'envelope:r-context',0.98,'m².K/W',{excerpt:ctx.slice(0,420),...productExtra}));
      else if(productMatch?.variant && productMatch.score>=0.96 && productMatch.thicknessEvidence){
        push(out,occ(doc,page,line,`${target}_insulation_r`,productMatch.variant.r,'library:insulation-r',0.94,'m².K/W',{excerpt:ctx.slice(0,420),libraryDerived:true,origin:'Bibliothèque isolants',provenanceNote:libraryNote(productMatch,'r'),...productExtra}));
      }
    }
    if(ELEMENT_PATTERNS.window.test(ctx)){ const materialCtx=ctx.replace(/volets?\s+roulants?\s+(?:alu(?:minium)?|pvc|bois)/ig,' ').replace(/fermeture\s*:?\s*(?:alu(?:minium)?|pvc|bois)/ig,' '); const wm=findFirstMatch(materialCtx,WINDOW_MATERIALS); const glazingEvidence=/(?:simple|double|triple)\s+(?:vitrage|verre)|\bdouble\s*\+?\s*\d{1,2}(?:[,.]\d+)?\s*mm\b|\d{1,2}\s*(?:\/|-)\s*\d{1,2}(?:\s*(?:ar(?:gon)?|kr(?:ypton)?|air))?\s*(?:\/|-)\s*\d{1,2}|\d{1,2}\.\d{1,2}\.\d{1,2}/i.test(ctx); const gl=glazingEvidence?(normalizeGlazingType(ctx.replace(/\bversion\s*:?\s*\d+(?:\.\d+)+/gi,' '))||findFirstMatch(ctx,GLAZINGS)):null; let sh=findFirstMatch(base,SHADINGS); if(!sh && !/sans\s+protection|sans\s+occultation/i.test(ctx)) sh=findFirstMatch(ctx,SHADINGS); if(wm) push(out,occ(doc,page,line,'window_material',wm,'windows:material-context',0.89,'',{excerpt:ctx.slice(0,420)})); if(gl) push(out,occ(doc,page,line,'window_glazing',gl,'windows:glazing-context',0.90,'',{excerpt:ctx.slice(0,420)})); if(sh) push(out,occ(doc,page,line,'window_shading',sh,'windows:shading-context',0.90,'',{building:buildingForPosition(doc,page.page,line.index),excerpt:ctx.slice(0,420)})); }
  }} return out;
}

// v2.3 — DPE / 3CL : les sections « recommandations / scénarios / préconisations » décrivent des
// travaux possibles, pas des équipements en place. Elles sont ignorées, et les équipements décrits
// hors de ces sections sont l'état existant (avant travaux).
const DPE_RECO_HEADING=/(?:^|\b)(?:recommandations?|pr[eé]conisations?|travaux\s+(?:a\s+(?:envisager|realiser|prevoir)|recommandes?|proposes?|envisages?)|scenarios?\s+(?:de\s+travaux|\d|[a-c]\b)|pack\s+de\s+travaux|parcours\s+de\s+travaux|etape\s+\d)/i;
const DPE_CURRENT_HEADING=/(?:etat\s+(?:actuel|initial|existant)|descriptif\s+(?:du\s+logement|des\s+equipements)|caracteristiques\s+(?:du\s+logement|techniques)|installations?\s+actuelles?|equipements?\s+(?:actuels|existants|en\s+place)|logement\s+actuel)/i;
const DPE_RECO_VERB=/(?:installation\s+d['’]?(?:une?|des)\b|remplacement\s+(?:par|de|du|des)\b|mise\s+en\s+place|remplacer|installer|pourrait|pourraient|envisager|preconis|recommand|il\s+est\s+conseill|gain\s+estime|economies?\s+estimee?s?)/i;
function parseSystems(doc){
  const out=[]; let inheritedPhase='unknown';
  const recoAware=doc.type===DOC_TYPES.DPE; let inReco=false;
  for(const page of doc.read.pages){ const lines=page.lines||[]; const explicitPagePhase=recoAware?'before':phaseFromContext(page.text||'',doc); if(explicitPagePhase!=='unknown') inheritedPhase=explicitPagePhase; const pagePhase=inheritedPhase; const resolvedPhase=ctx=>{ if(recoAware) return 'before'; const p=phaseFromContext(ctx,doc); return p==='unknown'?pagePhase:p; }; for(let i=0;i<lines.length;i++){
    const line=lines[i], base=normalizeText(line.text), next=normalizeText(lines[i+1]?.text||''); const baseLow=normLower(base); const envInventoryNoise=/(?:\binies\b|fiche\s+de\s+donn[eé]es\s+environnementales|mise\s+[aà]\s+disposition\s+d['’]?un\s+kwh|impact\s+environnemental|contribution\s+composant)/i.test(baseLow);
    const makeCtx=(kindRe,matcher)=>{ if(!kindRe.test(baseLow)) return null; if(matcher(base)) return base; return normalizeText(`${base} | ${next}`); };
    if(recoAware){ if(DPE_RECO_HEADING.test(baseLow)) inReco=true; else if(DPE_CURRENT_HEADING.test(baseLow)) inReco=false; if(inReco||DPE_RECO_VERB.test(baseLow)) continue; }

    const heatCtx=makeCtx(/chauffage|chaudiere|pac|pompe\s+a\s+chaleur|radiateur|convecteur|plancher\s+chauffant|vrv|drv|sous[- ]station/i,t=>!!(findFirstMatch(t,HVAC.heating)||findFirstMatch(t,HVAC.vectors)));
    if(heatCtx){ const phase=resolvedPhase(heatCtx), heatLow=normLower(heatCtx); const heatNoise=envInventoryNoise||/(?:taux\s+de\s+couverture|si\s+chauffage|dont\s+chauffage|exigence|rappel|exemple|scenario\s+non\s+retenu|scénario\s+non\s+retenu|hypoth[eè]se)/i.test(heatLow)||(/\bsolaire\b/i.test(heatLow)&&/(?:^|\s)0(?:[,.]0+)?(?:\s+0(?:[,.]0+)?)*\s*$/.test(heatLow)); const mode=heatNoise?null:findFirstMatch(heatCtx,HVAC.heating); const optionList=/type\s+de\s+chauffage\s*:\s*autre\s*\([^)]*(?:gaz|fioul|bois|reseau)[^)]*\)/i.test(heatLow); const strongVector=/^(?:type\s+d['’]?energie|type\s+d['’]?énergie|energie|énergie|combustible|vecteur|alimentation)\s*[:=-]/i.test(heatCtx)||/(?:chaudi[eè]re|pac|pompe\s+[aà]\s+chaleur|sous[- ]station|r[eé]seau\s+de\s+chaleur|convecteur|radiateur|plancher\s+chauffant)/i.test(heatLow); const vec=(!heatNoise&&!optionList&&strongVector)?findFirstMatch(heatCtx,HVAC.vectors):null; if(mode && phase!=='before') push(out,occ(doc,page,line,'heating_mode_after',mode,'systems:heating-mode-context',0.94,'',{excerpt:heatCtx.slice(0,420)})); if(vec && phase==='before') push(out,occ(doc,page,line,'heating_vector_before',vec,'systems:heating-vector-before',0.94,'',{excerpt:heatCtx.slice(0,420)})); if(vec && phase!=='before') push(out,occ(doc,page,line,'heating_vector_after',vec,'systems:heating-vector-after',0.93,'',{excerpt:heatCtx.slice(0,420)})); }

    const ecsCtx=makeCtx(/\becs\b|eau\s+chaude\s+sanitaire|chauffe[- ]eau|ballon|cumulus|cesi/i,t=>!!(findFirstMatch(t,HVAC.ecs)||findFirstMatch(t,HVAC.vectors)));
    if(ecsCtx){ const phase=resolvedPhase(ecsCtx), mode=findFirstMatch(ecsCtx,HVAC.ecs), vec=findFirstMatch(ecsCtx,HVAC.vectors); if(mode && phase!=='before') push(out,occ(doc,page,line,'ecs',mode,'systems:ecs-context',phase==='after'?0.96:0.94,'',{excerpt:ecsCtx.slice(0,420)})); if(vec && phase==='before') push(out,occ(doc,page,line,'ecs_vector_before',vec,'systems:ecs-vector-before',0.94,'',{excerpt:ecsCtx.slice(0,420)})); if(vec && phase!=='before') push(out,occ(doc,page,line,'ecs_vector_after',vec,'systems:ecs-vector-after',0.93,'',{excerpt:ecsCtx.slice(0,420)})); }

    let vent=findFirstMatch(base,HVAC.ventilation), ventCtx=base; if(!vent && /ventil|vmc|cta|air\s+neuf|extraction|hygro/i.test(baseLow)){ ventCtx=normalizeText(`${base} | ${next}`); vent=findFirstMatch(ventCtx,HVAC.ventilation); } const ventPhase=resolvedPhase(ventCtx); if(vent && ventPhase!=='before') push(out,occ(doc,page,line,'ventilation',vent,'systems:ventilation-context',ventPhase==='after'?0.96:0.94,'',{excerpt:ventCtx.slice(0,420)}));

    if(/refroid|rafraich|clim|froid|eau\s+glacee/i.test(baseLow)){ let cool=findFirstMatch(base,COOLING)||findFirstMatch(base,HVAC.heating), coolCtx=base; if(!cool){ coolCtx=normalizeText(`${base} | ${next}`); cool=findFirstMatch(coolCtx,COOLING)||findFirstMatch(coolCtx,HVAC.heating); } const coolLow=normLower(coolCtx); if(envInventoryNoise||/(?:inconnu|non\s+specifie|non\s+spécifié|sans\s+objet|non\s+concerne|non\s+concerné)/i.test(coolLow)) cool=null; if(/sans\s+systeme\s+de\s+refroidissement|sans\s+système\s+de\s+refroidissement|zone\s+non\s+refroidie|pas\s+de\s+climatisation\s+active|absence\s+de\s+climatisation/i.test(coolLow)) cool='Aucun'; if(/chauffe[- ]eau\s+thermodynamique|\bcet\b/i.test(coolLow) && /\bsplit\b/i.test(coolLow) && !/climatisation|refroidissement\s+actif|rafraichissement\s+actif/i.test(coolLow)) cool=null; const coolPhase=resolvedPhase(coolCtx); if(cool && coolPhase!=='before') push(out,occ(doc,page,line,'cooling',cool,'systems:cooling-context',coolPhase==='after'?0.95:0.93,'',{excerpt:coolCtx.slice(0,420)})); }

    let enr=findFirstMatch(base,ENR_TYPES), enrCtx=base; if(!enr && /enr|renouvel|photovolta|solaire|biomasse|geotherm|recuperation|chaleur/i.test(baseLow)){ enrCtx=normalizeText(`${base} | ${next}`); enr=findFirstMatch(enrCtx,ENR_TYPES); } const enrLow=normLower(enrCtx); const enrNoise=/(?:autres?\s+solutions?|exemples?|possibilit[eé]s?|recommandations?|peut\s+etre|peut\s+être|pourrait|envisager|liste\s+non\s+exhaustive)/i.test(enrLow); const enrInstalled=/(?:pr[eé]sence|installation\s+(?:photovolta|solaire|bois|biomasse|g[eé]otherm)|install[eé]e?s?|mis(?:e)?\s+en\s+place|sera\s+install[eé]|g[eé]n[eé]rateurs?\s+photovolta|panneaux?\s+(?:solaires?\s+)?photovolta|capteurs?\s+solaires?|[eé]quipements?\s+solaires?)\b/i.test(enrLow); if(enr && !enrNoise && enrInstalled && /enr|renouvel|photovolta|solaire|biomasse|geotherm|recuperation|chaleur/i.test(enrLow)){ push(out,occ(doc,page,line,'enr','Oui','enr:installed-context',0.93,'',{excerpt:enrCtx.slice(0,420)})); push(out,occ(doc,page,line,'enr_type',enr,'enr:type-installed-context',0.93,'',{excerpt:enrCtx.slice(0,420)})); }

    let fan=findFirstMatch(base,FAN_TYPES), fanCtx=base; if(!fan && /brasseur|ventilateur\s+de\s+plafond|hvls/i.test(baseLow)){ fanCtx=normalizeText(`${base} | ${next}`); fan=findFirstMatch(fanCtx,FAN_TYPES); } if(fan){ push(out,occ(doc,page,line,'fan_type',fan,'comfort:fan-type',0.94,'',{excerpt:fanCtx.slice(0,420)})); const m=fanCtx.match(/(?:nombre|nb\.?)\s*(?:de\s+)?(?:brasseurs?|ventilateurs?\s+de\s+plafond)\s*[:=\-]?\s*(\d+)/i)||fanCtx.match(/(\d+)\s+(?:brasseurs?|ventilateurs?\s+de\s+plafond)/i); if(m) push(out,occ(doc,page,line,'fan_count',parseInt(m[1],10),'comfort:fan-count',0.94,'',{excerpt:fanCtx.slice(0,420)})); }
  }} return out;
}

// v2.3 — DPE : la lettre est lue sur la ligne courante (plus dans une fenêtre de 4 lignes qui
// prenait toujours la première classe rencontrée), énergie / GES sont distingués par le libellé de
// la ligne elle-même, et la phase vient de l'en-tête de section le plus récent (avant / après).
const DPE_LABEL_ENERGY=/(?:classe|[eé]tiquette|[eé]tiquette\s+dpe|classe\s+dpe)\s*(?:dpe\s*)?(?:[eé]nergie|[eé]nerg[eé]tique|de\s+consommation|consommation)|(?:^|\|\s*)(?:[eé]nergie|consommation\s+d['’]?[eé]nergie)\s*[:=]/i;
const DPE_LABEL_GES=/(?:classe|[eé]tiquette)\s*(?:dpe\s*)?(?:ges|climat|[eé]missions?(?:\s+de\s+ges)?|gaz\s+[aà]\s+effet\s+de\s+serre)|(?:^|\|\s*)(?:ges|climat)\s*[:=]/i;
const DPE_NARRATIVE=/(?:classe\s+[a-g]\s+minimum|au\s+moins\s+(?:la\s+)?classe|doivent?\s+parvenir|passoires?|crit[eè]res?|eco[- ]?pr[eê]t|sup[eé]rieure?\s+ou\s+[eé]gale|inf[eé]rieure?\s+ou\s+[eé]gale|peuvent?\s+b[eé]n[eé]ficier|obligation\s+de\s+r[eé]sultat|objectif|[aà]\s+atteindre|interdiction|gel\s+des\s+loyers)/i;
function dpePhaseHeading(low){
  if(/(?:apres\s+(?:travaux|renovation|realisation)|scenarios?\b|etape\s+\d|etat\s+projete|situation\s+projetee|dpe\s+(?:apres|projete|final)|projet\s+de\s+renovation|post[- ]travaux)/.test(low)) return 'after';
  if(/(?:avant\s+(?:travaux|renovation)|etat\s+(?:initial|actuel|existant)|situation\s+(?:initiale|actuelle)|dpe\s+(?:initial|avant|existant|actuel)|logement\s+actuel)/.test(low)) return 'before';
  return null;
}
function dpeLetterAfter(text,labelRe){
  const m=text.match(labelRe); if(!m) return null;
  const tail=text.slice(m.index+m[0].length);
  const lm=tail.match(/^\s*(?:[:=\-–]\s*)?([A-G])(?![A-Za-zÀ-ÿ])/);
  return lm?lm[1]:null;
}
function parseDpe(doc){
  const out=[]; const name=normLower(doc.name);
  const fullLow=normLower(doc.read?.text||'');
  const hasHeadings=/(?:avant|apres)\s+(?:travaux|renovation)|etat\s+(?:initial|actuel)|scenario|etape\s+\d/.test(fullLow);
  const newBuilding=/(?:\bneuf\b|construction\s+neuve|logement\s+neuf)/.test(`${name} ${fullLow.slice(0,6000)}`);
  // Phase par défaut d'un DPE isolé : neuf → après ; existant → avant (avec confiance réduite, validation conseillée).
  const filePhase=/(?:apres|final|projet)/.test(name)&&!/(?:avant|initial|existant)/.test(name)?'after':/(?:avant|initial|existant)/.test(name)&&!/(?:apres|final)/.test(name)?'before':null;
  const defaultPhase=filePhase||(newBuilding?'after':(doc.type===DOC_TYPES.DPE?'before':null));
  const isDpeDoc=doc.type===DOC_TYPES.DPE;
  let phase=null;
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){
    const line=lines[i], text=normalizeText(line.text||''), low=normLower(text);
    const heading=dpePhaseHeading(low); if(heading) phase=heading;
    let energy=null, ges=null;
    // Mise en page éclatée : libellé seul sur une ligne, lettre seule (ou « Classe : X ») sur la suivante.
    const solo=text.match(/^(?:classe\s*[:=\-]?\s*)?([A-G])$/);
    if(solo&&i>0){ const prev=normalizeText(lines[i-1]?.text||''); if(!DPE_NARRATIVE.test(normLower(prev))){ if(/(?:ges|climat|emission)/i.test(prev)&&/(?:classe|etiquette)/i.test(prev)) ges=solo[1]; else if(/(?:energie|energetique|consommation)/i.test(prev)&&/(?:classe|etiquette)/i.test(prev)) energy=solo[1]; } }
    if(!energy&&!ges){
      if(!/(?:classe|etiquette|energie|ges|climat|consommation)/.test(low)) continue;
      if(DPE_NARRATIVE.test(low)) continue;
      energy=dpeLetterAfter(text,DPE_LABEL_ENERGY); ges=dpeLetterAfter(text,DPE_LABEL_GES);
    }
    if(!energy&&!ges) continue;
    if(!isDpeDoc&&!heading&&!phase&&!/dpe/.test(low)) continue; // hors DPE : uniquement dans une section explicitement phasée
    const effective=phase||defaultPhase; if(!effective) continue;
    const explicit=!!phase||!!filePhase||newBuilding;
    const conf=explicit?0.96:(hasHeadings?0.9:0.88);
    const extra={excerpt:normalizeText(lineWindow(page,i,1,1)).slice(0,420),dpePhase:effective,dpePhaseSource:phase?'section':filePhase?'nom de fichier':newBuilding?'logement neuf':'DPE isolé (état existant présumé)'};
    if(energy) push(out,occ(doc,page,line,effective==='after'?'dpe_energy_after':'dpe_energy_before',energy,'dpe:class-line',conf,'',extra));
    if(ges) push(out,occ(doc,page,line,effective==='after'?'dpe_ges_after':'dpe_ges_before',ges,'dpe:class-line',conf,'',extra));
  }}
  return out;
}


function normalizedAcvZoneName(raw=''){
  return normLower(String(raw||'').replace(/\s+/g,' ').trim())
    .replace(/^zone\s+d['’]?usage\s*/,'')
    .replace(/\s+/g,' ')
    .trim();
}
function parseClimaWinAcv(doc){
  const full=normLower(doc.read?.text||'');
  if(!/climawin\s*2020/.test(full)||!/synthese\s+d['’]?etude\s+acv|synthèse\s+d['’]?étude\s+acv|resultats\s+acv|résultats\s+acv/.test(full)) return [];
  const out=[];
  const zoneSref=new Map();
  const zoneKey=(building,zone)=>`${canonicalBuilding(building)}|${normalizedAcvZoneName(zone)}`;

  // Les tableaux d'exigence donnent le Sref de chaque zone. On les mémorise afin de
  // pondérer correctement les postes Ic énergie lorsqu'un bâtiment contient plusieurs zones.
  for(const page of doc.read?.pages||[]){
    const zre=/Zone\s*n[°o]?\s*\d+\s*:\s*Zone\s+d['’]?usage\s+([^0-9]{2,90}?)\s+([0-9]+(?:[,.][0-9]+)?)\s+[-+]?[0-9]+(?:[,.][0-9]+)?/i;
    for(const line of page.lines||[]){
      const row=normalizeText(line.text||''); const zm=row.match(zre); if(!zm) continue;
      const building=buildingForPosition(doc,page.page,line.index), sref=parseFrNumber(zm[2]);
      if(sref!==null&&sref>0) zoneSref.set(zoneKey(building,zm[1]),sref);
    }
  }

  const add=(page,line,field,value,method,unit='kgCO2e/m²',note='')=>{
    const v=parseFrNumber(value); if(v===null) return;
    const building=buildingForPosition(doc,page.page,line.index);
    push(out,occ(doc,page,line,field,v,method,0.999,unit,{building,origin:'Étude ACV ClimaWin — synthèse bâtiment',provenanceNote:note||'Valeur extraite d’un tableau ACV ClimaWin structuré.'}));
  };

  for(const page of doc.read?.pages||[]){
    const lines=page.lines||[];
    const pageText=normalizeText(page.text||lines.map(x=>x.text).join(' '));
    const firstLine=lines[0]||{index:0,text:pageText};
    const building=buildingForPosition(doc,page.page,firstLine.index||0);

    for(const line of lines){
      const raw=normalizeText(line.text||'');
      let m;
      if((m=raw.match(/Ic\s*,?\s*[eé]nergie\s+([-+]?\d+(?:[,.]\d+)?)\s+[-+]?\d+(?:[,.]\d+)?\s+[-+]?\d+(?:[,.]\d+)?\s*%/i))) add(page,line,'ic_energy',m[1],'acv:climawin-principal-ic-energy');
      if((m=raw.match(/Contributeur\s+composant\s+Ic\s*,?\s*composant\s+([-+]?\d+(?:[,.]\d+)?)/i))) add(page,line,'ic_components',m[1],'acv:climawin-components-summary');
      if((m=raw.match(/Contributeur\s+chantier\s+Ic\s*,?\s*chantier\s+([-+]?\d+(?:[,.]\d+)?)/i))) add(page,line,'ic_site',m[1],'acv:climawin-site-summary');
      if((m=raw.match(/Stockage\s+carbone\s+Stock\s*,?\s*C\s*\(\s*par\s+m(?:²|2)\s*\)\s*([-+]?\d+(?:[,.]\d+)?)\s*kg\s*C\s*\/\s*m(?:²|2)/i))) add(page,line,'stock_c_per_m2',m[1],'acv:climawin-stock-c-per-m2','kgC/m²','Valeur lue sur la ligne explicite « Stockage carbone Stock,C (par m²) ».');
      if((m=raw.match(/TOTAL\s+composants\s+([-+]?\d+(?:[,.]\d+)?)/i))) add(page,line,'ic_components',m[1],'acv:climawin-total-components');
      if((m=raw.match(/Total\s+chantier\s+([-+]?\d+(?:[,.]\d+)?)/i))) add(page,line,'ic_site',m[1],'acv:climawin-total-site');
      if((m=raw.match(/Ic\s*,?\s*[eé]nergie\s+par\s+m(?:²|2)\s*\([^)]*\)\s*([-+]?\d+(?:[,.]\d+)?)/i))) add(page,line,'ic_energy',m[1],'acv:climawin-energy-per-m2');
    }

    // Synthèse des lots : la première valeur numérique après le libellé du lot est le TOTAL.
    const lotRe=/Lot\s+(1[0-3]|[1-9])\s*-\s*([^0-9]{1,80}?)\s+([-+]?\d+(?:[,.]\d+)?)(?=\s|$)/gi;
    let lm; while((lm=lotRe.exec(pageText))){
      const pseudo={index:firstLine.index||0,text:`Lot ${lm[1]} - ${lm[2]} ${lm[3]}`};
      add(page,pseudo,`ic_lot_${lm[1]}`,lm[3],`acv:climawin-lot-${lm[1]}-total`,'kgCO2e/m²',`Total du lot ${lm[1]} lu dans « Synthèse du contributeur composants ».`);
    }

    // Détails énergie par zone. Pour un bâtiment multi-zones, on calcule la moyenne pondérée
    // par Sref ; pour un bâtiment mono-zone, la valeur de zone est déjà la valeur bâtiment.
    if(/Contributeur\s+[eé]nergie/i.test(pageText)&&/Vecteur\s+[eé]nerg[eé]tique/i.test(pageText)){
      const zoneRe=/ZONE\s*:\s*Zone\s+d['’]?usage\s+(.+?)\s*-\s*Contributeur\s+[eé]nergie[^]*?(?=ZONE\s*:\s*Zone\s+d['’]?usage|\d+\.\d+\.\s*D[eé]tails|Liste\s+des\s+produits|$)/gi;
      const zones=[]; let z;
      while((z=zoneRe.exec(pageText))){
        const segment=z[0], name=z[1];
        const vals={};
        const rowDefs=[
          ['ic_energy_heating',/Elec\s+Ch\.\s+[-+]?\d+(?:[,.]\d+)?\s+[-+]?\d+(?:[,.]\d+)?\s+([-+]?\d+(?:[,.]\d+)?)/i],
          ['ic_energy_cooling',/Elec\s+Fr\.\s+[-+]?\d+(?:[,.]\d+)?\s+[-+]?\d+(?:[,.]\d+)?\s+([-+]?\d+(?:[,.]\d+)?)/i],
          ['ic_energy_ecs',/Elec\s+ECS\s+[-+]?\d+(?:[,.]\d+)?\s+[-+]?\d+(?:[,.]\d+)?\s+([-+]?\d+(?:[,.]\d+)?)/i],
          ['ic_energy_aux_vent',/Elec\s+Vent\.\s+[-+]?\d+(?:[,.]\d+)?\s+[-+]?\d+(?:[,.]\d+)?\s+([-+]?\d+(?:[,.]\d+)?)/i],
          ['ic_energy_aux_dist',/Elec\s+Dist\.\s+[-+]?\d+(?:[,.]\d+)?\s+[-+]?\d+(?:[,.]\d+)?\s+([-+]?\d+(?:[,.]\d+)?)/i],
          ['ic_energy_mobility',/Elec\s+Depl\.\s+[-+]?\d+(?:[,.]\d+)?\s+[-+]?\d+(?:[,.]\d+)?\s+([-+]?\d+(?:[,.]\d+)?)/i]
        ];
        for(const [field,re] of rowDefs){ const mm=segment.match(re); if(mm){ const n=parseFrNumber(mm[1]); if(n!==null) vals[field]=n; } }
        zones.push({name,weight:zoneSref.get(zoneKey(building,name))||null,vals});
      }
      const fields=['ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility'];
      for(const field of fields){
        const usable=zones.filter(z=>Number.isFinite(z.vals[field])); if(!usable.length) continue;
        let value=null,method='acv:climawin-energy-zone';
        if(usable.length===1){ value=usable[0].vals[field]; }
        else if(usable.every(z=>Number.isFinite(z.weight)&&z.weight>0)){
          const den=usable.reduce((a,z)=>a+z.weight,0); value=den?usable.reduce((a,z)=>a+z.vals[field]*z.weight,0)/den:null; method='acv:climawin-energy-sref-weighted';
        }
        if(value!==null){
          const pseudo={index:firstLine.index||0,text:`${FIELD_MAP[field]?.label||field} ${value}`};
          push(out,occ(doc,page,pseudo,field,Math.round(value*100)/100,method,0.995,'kgCO2e/m²',{building,origin:'Étude ACV ClimaWin — détails énergie',provenanceNote:usable.length>1?'Valeur bâtiment calculée comme moyenne des zones pondérée par Sref.':'Valeur issue de l’unique zone énergétique du bâtiment.'}));
        }
      }
    }
  }
  return out;
}

function parseCarbon(doc){
  const out=[...parseClimaWinAcv(doc)]; const mappings=[
    ['ic_energy_heating',/ic\s*[eé]nergie[^|]{0,45}chauffage/i],['ic_energy_cooling',/ic\s*[eé]nergie[^|]{0,45}(?:refroid|froid)/i],['ic_energy_ecs',/ic\s*[eé]nergie[^|]{0,45}(?:ecs|eau\s+chaude)/i],
    ['ic_energy_aux_vent',/ic\s*[eé]nergie[^|]{0,60}auxiliaires?[^|]{0,25}ventil/i],['ic_energy_aux_dist',/ic\s*[eé]nergie[^|]{0,60}auxiliaires?[^|]{0,25}distribution/i],['ic_energy_mobility',/ic\s*[eé]nergie[^|]{0,60}(?:deplacements?|déplacements?|ascenseurs?|escalators?|parking)/i],
    ['ic_components',/ic\s*composants?(?:\s+batiment)?/i],['ic_site',/ic\s*chantier/i],['ic_energy',/ic\s*[eé]nergie(?:\s+batiment)?/i]
  ];
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){ const line=lines[i], raw=normalizeText(line.text||''), ctx=normalizeText(lineWindow(page,i,1,2));
    // Apprentissage initial ACV v2.2.3 : le stockage carbone surfacique est une donnée
    // explicitement portée par la ligne « Stockage carbone Stock,C (par m²) ».
    // La présence de « par m² » est obligatoire afin de ne jamais confondre avec le Stock,C total en kgC.
    const stockC=raw.match(/stockage\s+carbone\s+stock\s*,?\s*c\s*\(\s*par\s+m(?:²|2)\s*\)\s*[:=]?\s*([-+]?\d+(?:[,.]\d+)?)\s*kg\s*c\s*\/\s*m(?:²|2)/i);
    if(stockC){ const v=parseFrNumber(stockC[1]); if(v!==null) push(out,occ(doc,page,line,'stock_c_per_m2',v,'acv:stock-c-per-m2-seed-v1',0.999,'kgC/m²',{building:buildingForPosition(doc,page.page,line.index),excerpt:ctx.slice(0,420),origin:'Étude ACV — Résultats ACV',provenanceNote:'Valeur lue sur la ligne explicite « Stockage carbone Stock,C (par m²) ».'})); }
    // v2.3 — variantes : l'unité explicite kgC/m² (et non kgC ni kgCO2) suffit à distinguer la valeur surfacique du total.
    else { const loose=raw.match(/stock(?:age)?(?:\s+carbone)?(?:\s+stock)?\s*,?\s*c?\b[^|]{0,40}?([-+]?\d+(?:[,.]\d+)?)\s*kg\s*c\s*\/\s*m(?:²|2)(?![a-z0-9])/i); if(loose&&!/co\s*2|eq/i.test(raw.slice(loose.index,loose.index+loose[0].length))){ const v=parseFrNumber(loose[1]); if(v!==null) push(out,occ(doc,page,line,'stock_c_per_m2',v,'acv:stock-c-per-m2-unit',0.95,'kgC/m²',{building:buildingForPosition(doc,page.page,line.index),excerpt:ctx.slice(0,420),origin:'Étude ACV — stockage carbone',provenanceNote:'Valeur reconnue par son unité explicite kgC/m² (validation conseillée).'})); } }
    // Une occurrence carbone générique doit porter elle-même le libellé ET une valeur.
    // Les titres de chapitres, n° de lot et tableaux d'autres indicateurs ne sont jamais utilisés ici.
    const strongCarrier=/kg\s*(?:eq|éq)?\.?\s*co2|kgco2|[:=]/i.test(raw);
    if(strongCarrier){
      for(const [f,re] of mappings){
        if(!re.test(raw)) continue;
        const v=firstValueAfterLabel(raw,re);
        if(v!==null) push(out,occ(doc,page,line,f,v,'carbon:explicit-label',0.94,'kgCO2e/m²',{building:buildingForPosition(doc,page.page,line.index),excerpt:ctx.slice(0,420)}));
      }
    }
    // Forme autorisée : « IC composants lot 8 = 39,09 ». Un simple « LOT : 08 - CVC » est un titre.
    const lot=raw.match(/ic\s+composants?\s+lot\s*(1[0-3]|[1-9])\s*(?:[:=|-])\s*([-+]?\d+(?:[,.]\d+)?)/i);
    if(lot){ const v=parseFrNumber(lot[2]); if(v!==null) push(out,occ(doc,page,line,`ic_lot_${lot[1]}`,v,'carbon:explicit-lot-label',0.96,'kgCO2e/m²',{building:buildingForPosition(doc,page.page,line.index),excerpt:ctx.slice(0,420)})); }
  }} return out;
}


// Dictionnaire central des 168 colonnes ExtracTerre.
// Ce parseur reste volontairement strict : il exploite les couples libellé/valeur explicites
// et les tableaux Excel, tandis que les parseurs RSET/RSEE/thermiques spécialisés gardent la priorité.
function taggedValue(def,raw=''){
  const text=String(raw??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
  if(!text) return null;
  if(def.type==='number'){
    // Le parseur générique ne tranche jamais une ligne de tableau contenant plusieurs nombres
    // (ex. « Bbio | 43,8 | 65,9 | 33,5 »). Ces tableaux restent au parseur métier spécialisé.
    const cleaned=text.replace(/(?:€|euros?|ht|ttc|m²|m2|kwh[^\s;|]*|kg[^\s;|]*|logements?|batiments?|bâtiments?)/ig,' ').trim().replace(/^[^0-9+\-]+|[^0-9]+$/g,'').trim();
    if(!/^[-+]?\d+(?:[ \u00a0]\d{3})*(?:[,.]\d+)?$/.test(cleaned)) return null;
    const n=parseFrNumber(cleaned);
    return n!==null&&Number.isFinite(n)?n:null;
  }
  return text.replace(/^[:=|;\-–—\s]+/,'').trim()||null;
}
// Index de tags précompilé : auparavant chaque ligne de chaque PDF reparcourait les 168 champs,
// retriait leurs tags et les renormalisait. Sur un rapport dense cela pouvait monopoliser le thread
// principal plusieurs secondes et déclencher « page ne répond pas ».
const TAG_CACHE_BY_KEY=new Map();
const TAG_PREFIX_INDEX=new Map();
for(const def of FIELD_DEFS){
  const tags=[...(def.tags||[])].map(tag=>({tag,norm:normalizeFieldHeader(tag)})).filter(x=>x.norm).sort((a,b)=>b.norm.length-a.norm.length);
  TAG_CACHE_BY_KEY.set(def.key,tags);
  for(const item of tags){
    const first=item.norm.split(/\s+/)[0]; if(!first) continue;
    let defs=TAG_PREFIX_INDEX.get(first); if(!defs){ defs=new Set(); TAG_PREFIX_INDEX.set(first,defs); }
    defs.add(def);
  }
}
const PRESENCE_DEFS=FIELD_DEFS.filter(def=>def.presence);
function taggedCandidateDefs(normalized=''){
  const first=String(normalized||'').split(/\s+/)[0];
  return first?[...(TAG_PREFIX_INDEX.get(first)||[])]:[];
}
function taggedLineMatch(raw,def,normalizedInput=''){
  const src=String(raw??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim(), normalized=normalizedInput||normalizeFieldHeader(src);
  if(!src||!normalized) return null;
  const tags=TAG_CACHE_BY_KEY.get(def.key)||[];
  for(const {tag,norm:nt} of tags){
    if(normalized===nt) return {value:null,tag,exact:true};
    if(normalized.startsWith(nt)){
      const approx=src.slice(Math.min(src.length,tag.length));
      if(/^\s*(?::|=|\||;|\-|–|—)\s*/.test(approx)) return {value:taggedValue(def,approx.replace(/^\s*(?::|=|\||;|\-|–|—)\s*/,'')),tag,exact:true};
      if(def.type==='number'&&/^\s+[-+]?\d/.test(approx)) return {value:taggedValue(def,approx),tag,exact:true};
    }
  }
  return null;
}
function taggedPresence(raw,def,normalizedInput=''){
  if(!def.presence) return null;
  const n=normalizedInput||normalizeFieldHeader(raw); if(!n) return null;
  for(const {tag,norm:t} of TAG_CACHE_BY_KEY.get(def.key)||[]){
    if(t.length<3||!n.includes(t)) continue;
    const explicitSelected=/(?:retenu|retenue|choisi|choisie|selection|sélection|mention|label|option|exigence)/i.test(raw);
    const negated=new RegExp(`(?:non|sans|aucun(?:e)?|pas\s+de|non\s+retenu(?:e)?|non\s+choisi(?:e)?)\s+[^|;,]{0,28}${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`,'i').test(n);
    return {value:negated?'Non':'Oui',confidence:explicitSelected ? 0.90 : 0.82,tag};
  }
  return null;
}
function parseTaggedSpreadsheet(doc){
  const out=[];
  for(const page of doc.read?.pages||[]){
    const rows=(page.lines||[]).filter(l=>Array.isArray(l.cells)); if(!rows.length) continue;
    let header=null, map=[];
    for(const line of rows.slice(0,12)){
      const m=line.cells.map((cell,col)=>{ const def=matchFieldByHeader(cell); return def?{col,def}:null; }).filter(Boolean);
      if(m.length>(header?.count||0)) header={line,count:m.length,index:line.index},map=m;
    }
    if(!header||header.count<2) continue;
    const dataRows=rows.filter(l=>l.index>header.index);
    for(const line of dataRows){
      const buildingEntry=map.find(x=>x.def.key==='building');
      const rawBuilding=buildingEntry?String(line.cells[buildingEntry.col]??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim():'';
      const building=rawBuilding||'Bâtiment unique';
      for(const {col,def} of map){
        if(def.key==='building') continue;
        const raw=String(line.cells[col]??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim(); if(!raw) continue;
        const value=taggedValue(def,raw); if(value===null||value==='') continue;
        push(out,occ(doc,page,line,def.key,value,'tags:spreadsheet-header',.965,'',{building,origin:`${doc.type} — tableau structuré`,provenanceNote:`Colonne reconnue par le tag « ${normalizeText(header.line.cells[col]||def.label)} ».`}));
      }
    }
  }
  return out;
}
const TECHNICAL_DOC_TYPES=new Set([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL,DOC_TYPES.RSENV,DOC_TYPES.CARBON,DOC_TYPES.DPE]);
const SAFE_TECH_TAG_KEYS=new Set(['internal_code','operation_name','owner_company','work_type','housing_count','housing_total','building_total','reference_name','reference_version','department','construction_year']);
function taggedFieldAllowedForDocument(doc,def){
  if(!TECHNICAL_DOC_TYPES.has(doc.type)) return true;
  return SAFE_TECH_TAG_KEYS.has(def.key);
}

function parseTaggedFields(doc){
  if(doc.read?.kind==='spreadsheet') return parseTaggedSpreadsheet(doc);
  const out=[];
  for(const page of doc.read?.pages||[]){ const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], raw=String(line.text??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
      if(!raw) continue;
      const normalized=normalizeFieldHeader(raw), matched=new Set();
      for(const def of taggedCandidateDefs(normalized)){
        if(def.key==='building'||!taggedFieldAllowedForDocument(doc,def)) continue;
        const hit=taggedLineMatch(raw,def,normalized);
        if(!hit) continue;
        matched.add(def.key);
        let value=hit.value;
        if(value===null && def.presence) value='Oui';
        if(value===null){
          const next=String(lines[i+1]?.text??'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
          if(next){
            const nextNorm=normalizeFieldHeader(next);
            const nextIsLabel=taggedCandidateDefs(nextNorm).some(f=>!!taggedLineMatch(next,f,nextNorm));
            if(!nextIsLabel) value=taggedValue(def,next);
          }
        }
        if(value!==null&&value!=='') push(out,occ(doc,page,line,def.key,value,'tags:label-value',.915,'',{origin:`${doc.type} — libellé structuré`,provenanceNote:`Champ reconnu par le tag « ${hit.tag} ».`}));
      }
      for(const def of PRESENCE_DEFS){
        if(!taggedFieldAllowedForDocument(doc,def)||matched.has(def.key)) continue;
        const presence=taggedPresence(raw,def,normalized);
        if(presence) push(out,occ(doc,page,line,def.key,presence.value,'tags:presence',presence.confidence,'',{origin:`${doc.type} — mention détectée`,provenanceNote:`Mention reconnue par le tag « ${presence.tag} »${presence.confidence<.9?' ; validation conseillée.':''}`}));
      }
    }
  }
  return out;
}



// v1.1.17 — lecture hiérarchique des familles réglementaires.
// Le but n'est plus de laisser toutes les occurrences d'un mot-clé se concurrencer à égalité :
// on encode la position fonctionnelle de la donnée (résultat réglementaire, sortie détaillée,
// récapitulatif, annexe, lot, zone...) afin que la consolidation puisse privilégier la bonne couche.
function semanticHierarchyRank(doc,o){
  const m=String(o?.method||'');
  if(/^xml:re2020:/.test(m)) return /envelope/.test(m)?5:1;
  if(/^climawin:/.test(m)) return 2;
  if(/^recap-be:/.test(m)) return 12;
  const e=normLower(`${o?.origin||''} ${o?.excerpt||''}`);
  if(o?.userValidated) return 0;

  if(doc.type===DOC_TYPES.RT2012){
    if(/rt2012:chapter2-|rset:chapter2-|rset:rt2012-cep-table|rset:bbio-table|rset:chapter2-tic-worst-group/.test(m)) return 5;
    if(/rset:coefficient-direct|rset:detailed-output-primary|rset:detailed-output-cep/.test(m)) return 10;
    if(/rset:chapter4-|rset:equipment-|rset:generation-/.test(m)) return 15;
    if(/rset:(?:bbio|cep|cepnr)-summary-row/.test(m)) return 25;
    if(/annexe|valeurs\s+cles|synthese/.test(e)) return 35;
    if(/generic:|tags:/.test(m)) return 80;
    return 45;
  }
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020].includes(doc.type)){
    if(/rset:chapter2-|rset:cep-table|rset:bbio-table|rset:dh-row|rset:dh-explicit/.test(m)) return 5;
    if(/rset:coefficient-direct|rset:detailed-output-primary|rset:detailed-output-cep/.test(m)) return 10;
    if(/rset:chapter4-|rset:equipment-|rset:generation-/.test(m)) return 15;
    if(/rset:carbon-(?:components|energy|site|lot|energy-post)-total|rsenv:building-summary|rsenv:lot-summary/.test(m)) return 8;
    if(/rset:(?:bbio|cep|cepnr)-summary-row/.test(m)) return 25;
    if(/generic:|tags:/.test(m)) return 80;
    return 45;
  }
  if(doc.type===DOC_TYPES.RSENV){
    if(/rsenv:building-summary/.test(m)) return 5;
    if(/rsenv:lot-summary|rset:carbon-lot-/.test(m)) return 10;
    if(/rset:carbon-(?:components|energy|site)-total/.test(m)) return 8;
    if(/parse-carbon|carbon:|generic:|tags:/.test(m)) return 70;
    return 40;
  }
  if(doc.type===DOC_TYPES.CARBON){
    // Une ACV libre est une bonne source carbone, mais une éventuelle reprise Bbio/Cep/Tic
    // reste une source de contrôle et ne doit pas concurrencer un RSET/RSEE primaire.
    if(/ic_|carbon|acv/.test(e+m)) return 25;
    return 75;
  }
  if(doc.type===DOC_TYPES.RT_EXISTING){
    if(/patch:|rt-existing|cype|therm/.test(m+e)) return 10;
    if(/generic:/.test(m)) return 70;
    return 35;
  }
  return Number.isFinite(o?.hierarchyRank)?o.hierarchyRank:50;
}

function annotateSemanticHierarchy(doc,out){
  return out.map(o=>({...o,hierarchyRank:semanticHierarchyRank(doc,o)}));
}


function parseRt2012Hierarchical(doc){
  if(doc.type!==DOC_TYPES.RT2012) return [];
  const out=[];
  let inChapter2=false;
  for(const page of doc.read?.pages||[]){
    const pageLow=normLower(page.text||'');
    if(/chapitre\s*2\s*:/.test(pageLow)) inChapter2=true;
    if(/chapitre\s*[34]\s*:/.test(pageLow) && !/chapitre\s*2\s*:/.test(pageLow)) inChapter2=false;
    if(!inChapter2 && !/(?:coefficient\s+bbio|coefficient\s+cep|tic\s+en\s*°?c)/i.test(page.text||'')) continue;
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], t=normalizeText(line.text||'');
      if(/^coefficient\s+bbio\b/i.test(t)){
        const v=numbersIn(t).filter(x=>x>=0&&x<1000); if(v.length>=2){
          push(out,occ(doc,page,line,'bbio',v[0],'rt2012:chapter2-bbio',0.999,'points',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
          push(out,occ(doc,page,line,'bbio_max',v[1],'rt2012:chapter2-bbio',0.999,'points',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
          if(v.length>=3) push(out,occ(doc,page,line,'bbio_gain',v[2],'rt2012:chapter2-bbio',0.998,'%',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
        }
      }
      if(/^coefficient\s+cep\b/i.test(t)){
        const v=numbersIn(t).filter(x=>x>=-100&&x<5000); if(v.length>=2){
          push(out,occ(doc,page,line,'cep',v[0],'rt2012:chapter2-cep',0.999,'kWhEP/m².an',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
          push(out,occ(doc,page,line,'cep_max',v[1],'rt2012:chapter2-cep',0.999,'kWhEP/m².an',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
          if(v.length>=3) push(out,occ(doc,page,line,'cep_gain',v[2],'rt2012:chapter2-cep',0.998,'%',{origin:'RT2012 — Chapitre 2 résultats réglementaires'}));
        }
      }
      if(/conforme/i.test(t)){
        const m=t.match(/(\d+(?:[,.]\d+)?)\s+(\d+(?:[,.]\d+)?)\s+(-?\d+(?:[,.]\d+)?)\s+conforme/i);
        if(m){ const tic=parseFrNumber(m[1]), ref=parseFrNumber(m[2]); if(tic>=5&&tic<=60&&ref>=5&&ref<=60){
          const building=buildingForPosition(doc,page.page,line.index);
          push(out,occ(doc,page,line,'tic',tic,'rt2012:chapter2-tic',0.999,'°C',{building,origin:'RT2012 — Chapitre 2 résultats réglementaires',provenanceNote:'Tic lue sur la ligne de groupe du tableau réglementaire.'}));
          push(out,occ(doc,page,line,'tic_ref',ref,'rt2012:chapter2-tic',0.999,'°C',{building,origin:'RT2012 — Chapitre 2 résultats réglementaires',provenanceNote:'TicRef lue sur la même ligne que la Tic du groupe.'}));
        }}
      }
    }
  }
  return out;
}

function parseRsenvHierarchical(doc){
  if(doc.type!==DOC_TYPES.RSENV) return [];
  const out=[];
  const knownBuildings=(doc.buildings?.names||[]).map(canonicalBuilding).filter((x,i,a)=>x&&x!=='Bâtiment unique'&&a.indexOf(x)===i);
  const buildingByIndex=n=>knownBuildings[n-1]||canonicalBuilding(`Bâtiment ${n}`);
  let chapter=0, currentLot=null, building='Bâtiment unique';
  for(const page of doc.read?.pages||[]){
    const lines=page.lines||[];
    const pageText=normalizeText(page.text||lines.map(x=>x.text||'').join(' '));
    const pageLow=normLower(pageText);
    const indexed=pageText.match(/(?:[eé]chelle\s+du\s+b[aâ]timent|Contribution\s+B[aâ]t\.)\s*(\d+)/i);
    if(indexed) building=buildingByIndex(parseInt(indexed[1],10));
    const bmLine=(page.lines||[]).map(x=>normalizeText(x.text||'')).find(x=>/^B[aâ]timent\s+[A-Za-z0-9._-]+(?:\s|$)/i.test(x)); const bm=bmLine?bmLine.match(/^B[aâ]timent[ \t]+([A-Za-z0-9._-]+)/i):null; if(bm && !/^\d+$/.test(bm[1])) building=canonicalBuilding(`Bâtiment ${bm[1]}`);
    if(/chapitre\s*5\s*:/.test(pageLow)) chapter=5;
    else if(/chapitre\s*6\s*:/.test(pageLow)) chapter=6;
    else if(/chapitre\s*7\s*:/.test(pageLow)) chapter=7;
    if(chapter===5 && /[eé]chelle\s+du\s+b[aâ]timent[\s\S]{0,180}contribution\s+[\"“]?composant/i.test(pageLow) && /par\s+lot/i.test(pageLow)){
      const lotLine=lines.find(x=>/indicateur\s+co\s*(?:2\s*)?dynamique/i.test(normLower(x.text||'')));
      let vals=lotLine?numbersIn(lotLine.text||''):[];
      if(vals.length<10){ const m=pageText.match(/Indicateur\s+CO\s*(?:2\s*)?Dynamique[^\d-]*([\s\S]{0,420})/i); if(m) vals=numbersIn(m[1]); }
      if(vals.length>=12){ const lotVals=vals.slice(-13); for(let n=1;n<=Math.min(13,lotVals.length);n++){ const v=lotVals[n-1]; if(!Number.isFinite(v)||v<0||v>5000) continue; const line=lotLine||lines[0]||{text:'Indicateur CO dynamique par lot',index:0}; push(out,occ(doc,page,line,`ic_lot_${n}`,v,'rsenv:lot-summary',0.999,'kgCO2e/m²',{building,origin:'RSENV — Chapitre 5 contribution Composant / lot',provenanceNote:`Indicateur CO dynamique du lot ${n}, lu dans le tableau au niveau bâtiment.`})); } }
    }
    for(let i=0;i<lines.length;i++){
      const line=lines[i], t=normalizeText(line.text||''), low=normLower(t);
      const lot=t.match(/^\s*(?:lot\s*)?(1[0-3]|0?[1-9])\s*[-–—:]\s*(.+)$/i);
      if(lot && /vrd|fondation|infrastructure|superstructure|maçon|macon|couverture|charpente|cloison|doublage|menuiser|façade|facade|revêtement|revetement|cvc|chauffage|ecs|ventilation|sanitaire|réseaux?|reseaux?|communication|élévateur|elevateur|photovolta|production\s+locale/i.test(normLower(lot[2]))) currentLot=parseInt(lot[1],10);
      if(chapter===5){
        const defs=[
          ['ic_components',/^ic\s+composant(?:s)?\b(?![^|]{0,40}\blot\b)/i],
          ['ic_site',/^ic\s+chantier\b/i],
          ['ic_energy',/^ic\s+[eé]nergie\b(?![^|]{0,40}annualis)/i]
        ];
        for(const [field,re] of defs){ if(re.test(t) && !/\blot\b/i.test(t) && !/annualis/i.test(t)){
          const nums=numbersIn(t).filter(v=>v>=0&&v<10000); if(nums.length) push(out,occ(doc,page,line,field,nums[0],'rsenv:building-summary',0.999,'kgCO2e/m²',{building,origin:'RSENV — Chapitre 5 niveau bâtiment',provenanceNote:'Indicateur lu dans les sorties ACV au niveau bâtiment, prioritaires sur les quantitatifs, zones et annexes.'}));
        }}
        if(currentLot && /(?:ic\s+(?:composant\s+)?dynamique\s+du\s+lot|ic\s+dynamique\s+lot)/i.test(t)){
          const nums=numbersIn(t).filter(v=>v>=0&&v<10000); if(nums.length) push(out,occ(doc,page,line,`ic_lot_${currentLot}`,nums[0],'rsenv:lot-summary',0.999,'kgCO2e/m²',{building,origin:'RSENV — Chapitre 5 contribution Composant / lot',provenanceNote:`Valeur carbone du lot ${currentLot} lue dans la sortie ACV niveau bâtiment.`}));
        }
      }
    }
  }
  return out;
}


function pruneHierarchicalShadowed(doc,out){
  if(doc.type===DOC_TYPES.RSENV){
    const strongFields=new Set(out.filter(o=>/^rsenv:(?:building|lot)-summary/.test(String(o.method||''))).map(o=>o.field));
    if(strongFields.size) out=out.filter(o=>!strongFields.has(o.field) || /^rsenv:(?:building|lot)-summary/.test(String(o.method||'')) || o.userValidated);
  }
  if(doc.type===DOC_TYPES.RT2012){
    const strong=new Set(out.filter(o=>/^rt2012:chapter2-|rset:chapter2-|rset:bbio-table|rset:rt2012-cep-table/.test(String(o.method||''))).map(o=>o.field));
    if(strong.size) out=out.filter(o=>!strong.has(o.field) || !/rset:(?:bbio|cep|cepnr)-summary-row|generic:regulatory-label/.test(String(o.method||'')) || o.userValidated);
  }
  return out;
}


// V2.3 — familles documentaires (une seule dropzone, famille détectée ou choisie par fichier).
// Chaque famille garde sa liste blanche stricte : une occurrence hors périmètre est ignorée même si un
// tag générique, un patch ou un sous-parseur la détecte. Un document peut porter plusieurs familles
// (ex. RSEE PDF = thermique + carbone) : chaque famille filtre ses propres occurrences, puis on fusionne.
const ADMIN_FIELDS=['project','operation','building'];
const ENVELOPE_FIELDS=['structure','roof_structure','roof_insulation','roof_insulation_thickness','roof_insulation_r','wall_structure','wall_insulation','wall_insulation_thickness','wall_insulation_r','floor_structure','floor_insulation','floor_insulation_thickness','floor_insulation_r','window_material','window_glazing','window_shading'];
const IC_LOTS=Array.from({length:13},(_,i)=>`ic_lot_${i+1}`);
const IC_ENERGY_POSTS=['ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility'];
const CEP_DETAIL=['cep_cooling','cep_lighting','cep_aux_vent','cep_aux_dist','cep_mobility','cep_electricity','cep_gas','cep_district','cep_biomass'];
const DOCUMENT_FAMILIES=Object.freeze({
  rset:{label:'RSET / RSEE RE2020 — thermique',short:'RE2020 thermique',type:DOC_TYPES.RSET_RE2020},
  rt2012:{label:'RSET RT2012',short:'RT2012',type:DOC_TYPES.RT2012},
  thcex:{label:'THCex / RT Existant',short:'THCex',type:DOC_TYPES.RT_EXISTING},
  carbone:{label:'Carbone — RSENV / RSEE / ACV',short:'Carbone',type:DOC_TYPES.CARBON},
  cctp:{label:'CCTP',short:'CCTP',type:DOC_TYPES.CCTP},
  dpgf:{label:'DPGF',short:'DPGF',type:DOC_TYPES.DPGF},
  dpe:{label:'DPE / 3CL',short:'DPE',type:DOC_TYPES.DPE},
  annex:{label:'Moteur libre — sans liste blanche',short:'Libre',type:null}
});
const LEGACY_FAMILY_ALIASES=Object.freeze({rsenv:'carbone',acv:'carbone','3cl':'dpe',manual:'annex',libre:'annex'});
function normalizeFamilyKey(key){ const k=String(key||'').trim().toLowerCase(); const n=LEGACY_FAMILY_ALIASES[k]||k; return DOCUMENT_FAMILIES[n]?n:null; }
function autoFamiliesForType(type){
  switch(type){
    case DOC_TYPES.RSEE_RE2020: return ['rset','carbone'];
    case DOC_TYPES.RSET_RE2020: return ['rset'];
    case DOC_TYPES.RT2012: return ['rt2012'];
    case DOC_TYPES.RT_EXISTING: return ['thcex'];
    case DOC_TYPES.RSENV: case DOC_TYPES.CARBON: return ['carbone'];
    case DOC_TYPES.CCTP: return ['cctp'];
    case DOC_TYPES.DPGF: return ['dpgf'];
    case DOC_TYPES.DPE: return ['dpe'];
    default: return ['annex'];
  }
}
// Familles effectives d'un document : choix manuel > ancienne dropzone spécialisée > détection automatique.
function resolveDocumentFamilies(doc){
  if(doc?.familyMode==='manual'&&Array.isArray(doc.families)&&doc.families.length){ const f=[...new Set(doc.families.map(normalizeFamilyKey).filter(Boolean))]; if(f.length) return f; }
  if(doc?.familyMode!=='auto'&&doc?.specializedFamily){ const f=normalizeFamilyKey(doc.specializedFamily); if(f) return [f]; }
  const type=doc?.classification?.automaticType||doc?.classification?.type||doc?.type;
  const fams=autoFamiliesForType(type);
  // Un RSET RE2020 qui contient les sorties ACV (IC, contributeurs, lots) est en pratique un RSEE :
  // on lui associe automatiquement la famille carbone pour ne perdre ni le thermique ni le carbone.
  if(fams.length===1&&fams[0]==='rset'&&CARBON_CONTENT_SIGNATURE.test(String(doc?.read?.text||'').slice(0,400000))) fams.push('carbone');
  return fams;
}
const CARBON_CONTENT_SIGNATURE=/ic\s*(?:composants?|construction|[eé]nergie)\b|contributeur\s+(?:composant|[eé]nergie)|indicateur\s+co\s*2?\s*dynamique|(?:^|\n)\s*0?1\s*[-–]\s*vrd\b|total\s+lot\s*:/i;
// v2.3.5 — indicateurs RE2020 Ic construction / Ic énergie et leurs seuils (max courant et max 2028).
const IC_LIMIT_FIELDS=['ic_construction','ic_construction_max','ic_construction_max_2028','ic_energy_max','ic_energy_max_2028'];
const FAMILY_ALLOWED_FIELDS=Object.freeze({
  rset:new Set([...ADMIN_FIELDS,'housing_count','shab','dh','dh_max','cross_ventilated','non_cross_ventilated','fan_count','fan_type',...ENVELOPE_FIELDS,
    'heating_vector_after','heating_mode_after','ecs_vector_after','ecs','cooling','ventilation','bbio','bbio_max','bbio_gain','cep','cep_max','cep_gain','cepnr','cepnr_max','cepnr_gain',...CEP_DETAIL,'enr','enr_type','department']),
  rt2012:new Set([...ADMIN_FIELDS,'housing_count','shab','tic','tic_ref','cross_ventilated','non_cross_ventilated','fan_count','fan_type',...ENVELOPE_FIELDS,
    'heating_vector_after','heating_mode_after','ecs_vector_after','ecs','cooling','ventilation','bbio','bbio_max','bbio_gain','cep','cep_max','cep_gain',...CEP_DETAIL,'enr','enr_type','department']),
  thcex:new Set([...ADMIN_FIELDS,'housing_count','shab','construction_year',...ENVELOPE_FIELDS,
    'heating_vector_before','heating_vector_after','heating_mode_after','ecs_vector_before','ecs_vector_after','ecs','cooling','ventilation','ubat_before','ubat_after','cep_before','cep_after_final','enr','enr_type']),
  carbone:new Set([...ADMIN_FIELDS,'ic_components','ic_site','stock_c_per_m2',...IC_LOTS,'ic_energy',...IC_ENERGY_POSTS,...IC_LIMIT_FIELDS]),
  cctp:new Set([...ADMIN_FIELDS,...ENVELOPE_FIELDS,'heating_vector_after','heating_mode_after','ecs_vector_after','ecs','cooling','ventilation','enr','enr_type']),
  dpgf:new Set([...ADMIN_FIELDS,...ENVELOPE_FIELDS,'heating_vector_after','heating_mode_after','ecs_vector_after','ecs','cooling','ventilation','enr','enr_type']),
  // DPE / 3CL : état existant uniquement pour les systèmes (les recommandations sont exclues en amont).
  dpe:new Set([...ADMIN_FIELDS,'shab','construction_year',...ENVELOPE_FIELDS,'heating_vector_before','ecs_vector_before','dpe_energy_before','dpe_ges_before','dpe_energy_after','dpe_ges_after'])
});
// Complétude attendue : sous-ensemble strict des champs autorisés (vérifié par les tests).
// Un tableau imbriqué signifie « au moins un de ces champs ».
const FAMILY_EXPECTED_FIELDS=Object.freeze({
  rset:['housing_count','shab','bbio','bbio_max','cep','cep_max','cepnr','cepnr_max','dh','dh_max','heating_vector_after','ecs_vector_after'],
  rt2012:['housing_count','shab','bbio','bbio_max','cep','cep_max','tic','tic_ref'],
  thcex:['shab','ubat_before','ubat_after','cep_before','cep_after_final','heating_vector_before','heating_vector_after'],
  carbone:['ic_components','ic_site','ic_energy',...IC_LOTS,'ic_energy_heating','ic_energy_ecs'],
  cctp:['wall_insulation','roof_insulation','floor_insulation','window_material','window_glazing','heating_mode_after','ventilation'],
  dpgf:['wall_insulation','roof_insulation','window_material','heating_mode_after','ventilation'],
  dpe:[['dpe_energy_before','dpe_energy_after'],['dpe_ges_before','dpe_ges_after']],
  annex:[]
});
function documentExpectedFields(doc){
  const out=[]; const seen=new Set();
  for(const f of resolveDocumentFamilies(doc)) for(const e of FAMILY_EXPECTED_FIELDS[f]||[]){ const k=Array.isArray(e)?e.join('|'):e; if(!seen.has(k)){ seen.add(k); out.push(e); } }
  return out;
}
// Compatibilité : anciennes clés de dropzone.
const SPECIALIZED_ALLOWED_FIELDS=new Proxy({}, {get:(_,k)=>FAMILY_ALLOWED_FIELDS[normalizeFamilyKey(k)]});
function filterSpecializedOccurrences(family,occurrences=[]){
  const allowed=SPECIALIZED_ALLOWED_FIELDS[family];
  if(!allowed) return occurrences;
  return occurrences.filter(o=>o?.field&&allowed.has(o.field));
}
function typeForFamily(family,doc){
  const t=doc.classification?.automaticType||doc.type;
  if(family==='rset') return [DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020].includes(t)?t:DOC_TYPES.RSET_RE2020;
  if(family==='carbone') return [DOC_TYPES.RSENV,DOC_TYPES.CARBON].includes(t)?t:(t===DOC_TYPES.RSEE_RE2020?DOC_TYPES.RSENV:DOC_TYPES.CARBON);
  return DOCUMENT_FAMILIES[family]?.type||doc.type;
}
function parseFamily(doc,family){
  const fdoc={...doc,type:typeForFamily(family,doc)};
  let out=[...parseTaggedFields(fdoc)];
  if(family==='rset'||family==='rt2012'){
    out.push(...parseBuildingSurface(fdoc),...parseRset(fdoc),...parseRt2012Hierarchical(fdoc),...parseProgram(fdoc),...parseEnvelope(fdoc),...parseSystems(fdoc));
  }else if(family==='carbone'){
    out.push(...parseProgram(fdoc),...parseCarbon(fdoc)); addRsetCarbonBreakdown(fdoc,out);
    const rsenvLike=fdoc.type===DOC_TYPES.RSENV||/chapitre\s*5\s*:/i.test(fdoc.read?.text||'');
    if(rsenvLike) out.push(...parseRsenvHierarchical({...fdoc,type:DOC_TYPES.RSENV}));
  }else if(family==='thcex'){
    out.push(...parseBuildingSurface(fdoc),...parseGenericRegulatory(fdoc));
    if(isStructuredRenovationThermalDocument(fdoc)) out.push(...parseStructuredRenovationThermal(fdoc));
    out.push(...parseThermalStudy(fdoc),...parseProgram(fdoc),...parseEnvelope(fdoc),...parseSystems(fdoc));
  }else if(family==='cctp'){
    out.push(...parseBuildingSurface(fdoc),...parseProgram(fdoc),...parseEnvelope(fdoc),...parseSystems(fdoc));
  }else if(family==='dpgf'){
    out.push(...parseProgram(fdoc),...parseEnvelope(fdoc),...parseSystems(fdoc));
  }else if(family==='dpe'){
    // DPE et 3CL fusionnés : classes + état existant ; recommandations exclues par parseSystems.
    out.push(...parseBuildingSurface(fdoc),...parseProgram(fdoc),...parseDpe(fdoc),...parseEnvelope(fdoc),...parseSystems(fdoc));
  }
  out.push(...parsePatchOccurrences(fdoc));
  out=filterSpecializedOccurrences(family,out.filter(Boolean));
  out=pruneHierarchicalShadowed(fdoc,out);
  return annotateSemanticHierarchy(fdoc,out).map(o=>({...o,specializedFamily:family,specializedParser:true}));
}
function parseSpecializedDocument(doc,families){
  const fams=families||resolveDocumentFamilies(doc);
  if(fams.length===1) return parseFamily(doc,fams[0]);
  const seen=new Set(), out=[];
  for(const f of fams) for(const o of parseFamily(doc,f)){ const k=[o.field,typeof o.value==='number'?o.value.toFixed(6):String(o.value),o.building,o.page,o.excerpt].join('|'); if(seen.has(k)) continue; seen.add(k); out.push(o); }
  return out;
}

// v2.3 — XML RE2020 : lecture par balises, puis enveloppe via le parseur existant sur les libellés de parois.
function parseRe2020Xml(doc){
  let out=re2020Occurrences(doc,occ);
  const pages=doc.read.pages||[];
  const byBuilding=new Map();
  for(const l of re2020EnvelopeLines(doc.read.re2020)){ if(!byBuilding.has(l.building)) byBuilding.set(l.building,{index:l.index,lines:[]}); byBuilding.get(l.building).lines.push(l.text); }
  for(const [building,{index,lines}] of byBuilding){
    const realPage=pages.find(p=>p.re2020Building===index)||pages[0]||{page:1};
    const page={page:realPage.page,text:lines.join('\n'),lines:lines.map((text,i)=>({index:i,text}))};
    const tmp={...doc,type:DOC_TYPES.CCTP,buildings:{names:[building],hits:[]},read:{...doc.read,pages:[page]}};
    for(const o of parseEnvelope(tmp)) out.push({...o,docType:doc.type,building,method:`xml:re2020:envelope:${o.method}`,structuredXml:true,origin:'XML RE2020 — parois Datas_Comp',provenanceNote:`Libellé de paroi déclaré dans le XML RE2020, analysé par le parseur enveloppe (${o.method}).`});
  }
  out=out.filter(Boolean);
  if(doc.familyMode==='manual'){ const fams=resolveDocumentFamilies(doc); const allowed=new Set(fams.flatMap(f=>[...(FAMILY_ALLOWED_FIELDS[f]||[])])); if(!fams.includes('annex')) out=out.filter(o=>allowed.has(o.field)||['department','owner_company'].includes(o.field)); }
  return annotateSemanticHierarchy(doc,out).map(o=>({...o,specializedFamily:'xml-re2020'}));
}

// v2.3.3 — Synthèse ClimaWin 2020 : parseur structuré par section de bâtiment + parseurs d'enveloppe/systèmes
// existants (descriptifs de parois, vitrages). Les parseurs d'indicateurs génériques sont écartés : ils
// confondaient lignes de tableau et bâtiments.
function parseClimaWinDocument(doc){
  const fdoc={...doc,type:DOC_TYPES.RSET_RE2020};
  let out=[...parseClimaWinSynthesis(fdoc,occ)];
  // Enveloppe : parois dominantes par bâtiment → lignes synthétiques analysées par le parseur enveloppe existant.
  for(const l of climaWinEnvelopeLines(fdoc)){
    const page={page:l.anchor?.page?.page??l.anchor?.page??1,text:l.text,lines:[{index:0,text:l.text}]};
    const tmp={...fdoc,type:DOC_TYPES.CCTP,buildings:{names:[l.building],hits:[]},read:{...fdoc.read,pages:[page]}};
    for(const o of parseEnvelope(tmp)) out.push({...o,docType:fdoc.type,building:l.building,method:`climawin:envelope:${o.method}`,structuredPdf:true,origin:'ClimaWin 2020 — enveloppe du bâtiment',excerpt:(l.anchor?.text||o.excerpt||'').slice(0,420),page:l.anchor?.page??o.page,provenanceNote:`Paroi dominante du bâtiment (${l.surface?l.surface+' m²':'menuiseries'}) — ${l.text.slice(0,160)}`});
    // R dérivé = épaisseur / λ (λ arrondi à 3 décimales dans ClimaWin) : approximatif, donc proposé à validation (< 90 %).
    const rField={wall:'wall_insulation_r',floor:'floor_insulation_r',roof:'roof_insulation_r'}[l.category];
    if(rField&&l.rValue) out.push({field:rField,value:l.rValue,building:l.building,docId:fdoc.id,fileName:fdoc.name,docType:fdoc.type,page:l.anchor?.page??1,excerpt:(l.anchor?.text||'').slice(0,420),confidence:0.86,method:'climawin:envelope-r-derived',unit:'m².K/W',structuredPdf:true,derivedFromDocument:true,origin:'ClimaWin 2020 — R dérivé',provenanceNote:`R = ${l.thicknessMm} mm / λ du tableau ClimaWin (λ arrondi à 3 décimales) : à confirmer avec le R certifié du produit.`});
  }
  out=out.filter(o=>o&&o.field);
  // Familles imposées par l'utilisateur : liste blanche de la/les famille(s) choisie(s).
  if(doc.familyMode==='manual'){ const fams=resolveDocumentFamilies(doc); if(!fams.includes('annex')){ const allowed=new Set(fams.flatMap(f=>[...(FAMILY_ALLOWED_FIELDS[f]||[])])); out=out.filter(o=>allowed.has(o.field)); } }
  else { const allowed=new Set([...FAMILY_ALLOWED_FIELDS.rset,'ic_energy']); out=out.filter(o=>allowed.has(o.field)); }
  return annotateSemanticHierarchy(fdoc,out).map(o=>({...o,specializedFamily:'climawin'}));
}

// v2.3.3 — Récapitulatif thermique BE (lot) : indicateurs + systèmes lus par libellés précis ; l'enveloppe, très
// hétérogène dans ces légendes, est laissée aux synthèses par bâtiment (ClimaWin) plutôt que lue au hasard.
function parseBeActRecapDocument(doc){
  const fdoc={...doc,type:doc.type||DOC_TYPES.THERMAL};
  let out=parseBeActRecap(fdoc,occ).filter(Boolean);
  if(doc.familyMode==='manual'){ const fams=resolveDocumentFamilies(doc); if(!fams.includes('annex')){ const allowed=new Set(fams.flatMap(f=>[...(FAMILY_ALLOWED_FIELDS[f]||[])])); out=out.filter(o=>allowed.has(o.field)); } }
  return annotateSemanticHierarchy(fdoc,out).map(o=>({...o,specializedFamily:'recap-be'}));
}

// v2.3.5 — Sortie logiciel Pléiades (partie thermique) : indicateurs par section de bâtiment (parseur dédié).
// Enveloppe et systèmes : le moteur générique ne sait pas rattacher les bibliothèques de parois / générateurs
// à un bâtiment précis ; ses valeurs sont conservées mais plafonnées à 88 % (validation ✓ / ✕).
function parsePleiadesThermalDocument(doc){
  const fdoc={...doc,type:doc.type||DOC_TYPES.RSET_RE2020};
  const dedicated=annotateSemanticHierarchy(fdoc,parsePleiadesThermalOutput(fdoc,occ,canonicalBuilding).filter(Boolean)).map(o=>({...o,specializedFamily:'pleiades-sortie'}));
  const have=new Set(dedicated.map(o=>`${o.building}|${o.field}`)); const haveField=new Set(dedicated.map(o=>o.field));
  const generic=parseDocument({...doc,__skipDedicated:true}).filter(o=>!haveField.has(o.field)&&!have.has(`${o.building}|${o.field}`)&&!/pleiades\s*,?\s*version/i.test(o.excerpt||'')).map(o=>({...o,confidence:Math.min(o.confidence||0,0.88),reviewCap:0.88,provenanceNote:[o.provenanceNote,'Sortie Pléiades : rattachement au bâtiment à confirmer.'].filter(Boolean).join(' ')}));
  return [...dedicated,...generic];
}

// v2.3.5 — Fiche RSET / RSEE au format CSTB : indicateurs réglementaires lus par le parseur dédié (par bâtiment) ;
// le moteur générique complète l'enveloppe et les systèmes, rattachés au bâtiment de la section où ils sont lus
// (plus de faux bâtiments créés à partir de lignes de tableau).
function parseCstbRseeDocument(doc){
  const fdoc={...doc,type:doc.type||DOC_TYPES.RSEE_RE2020};
  const dedicated=annotateSemanticHierarchy(fdoc,parseCstbRseeFiche(fdoc,occ,canonicalBuilding).filter(Boolean)).map(o=>({...o,specializedFamily:'cstb-rsee'}));
  const {lines,names}=cstbBuildingContext(fdoc); const known=new Set(names.map(canonicalBuilding));
  const ctx=new Map(lines.map(x=>[`${x.page.page}|${x.line.index}`,x.building])); const scopeAt=new Map(lines.map(x=>[`${x.page.page}|${x.line.index}`,x.scope]));
  const haveField=new Set(dedicated.map(o=>o.field));
  const generic=parseDocument({...doc,__skipDedicated:true}).filter(o=>!haveField.has(o.field)).map(o=>{
    const pl=doc.read?.pages?.find(p=>p.page===o.page)?.lines||[]; const ex=String(o.excerpt||'');
    // L'extrait peut être une fenêtre de plusieurs lignes : on retient la ligne exacte, sinon la première ligne contenue.
    const lineIdx=(pl.find(l=>normalizeText(l.text).slice(0,420)===ex)||pl.find(l=>{ const t=normalizeText(l.text); return t.length>=12&&ex.includes(t); }))?.index;
    // Feuillets « Génération » : communs à plusieurs bâtiments et mêlant chauffage / ECS (ballon d'appoint
    // à effet Joule…) → proposés à validation, jamais retenus d'office pour un bâtiment.
    // Exigences de moyens (articles de l'arrêté recopiés) : texte réglementaire, jamais une description du projet.
    if(scopeAt.get(`${o.page}|${lineIdx}`)==='requirements') return null;
    if(scopeAt.get(`${o.page}|${lineIdx}`)==='generation') return {...o,confidence:Math.min(o.confidence||0,0.86),reviewCap:0.86,provenanceNote:[o.provenanceNote,'Lu dans un feuillet Génération (commun) : à confirmer pour ce bâtiment.'].filter(Boolean).join(' ')};
    if(known.has(o.building)||!known.size) return o;
    const b=ctx.get(`${o.page}|${lineIdx}`); return b?{...o,building:canonicalBuilding(b),originalBuilding:o.building}:(known.size===1?{...o,building:[...known][0],originalBuilding:o.building}:{...o,building:'Bâtiment unique'});
  }).filter(Boolean);
  return [...dedicated,...generic];
}

// v2.3.5 — STD : parseur dédié (variante de base uniquement) + données administratives du moteur générique.
function parseStdDocument(doc){
  const fdoc={...doc,type:doc.type||DOC_TYPES.THERMAL};
  const dedicated=parseStdReport(fdoc,occ).filter(Boolean).map(o=>({...o,specializedFamily:'std'}));
  const admin=new Set([...ADMIN_FIELDS,'operation_name','owner_company','department']);
  const generic=parseDocument({...doc,__skipDedicated:true}).filter(o=>admin.has(o.field));
  return annotateSemanticHierarchy(fdoc,[...dedicated,...generic]);
}

// v2.3.6 — Notice carbone RE2020 (sections par bâtiment) : parseur dédié ; l'enveloppe et les systèmes cités
// dans le texte d'une notice carbone ne sont pas repris (les PDF annexes listent des fiches FDES, pas le projet).
function parseCarbonNoticeDocument(doc){
  const fdoc={...doc,type:doc.type||DOC_TYPES.CARBON};
  return annotateSemanticHierarchy(fdoc,parseCarbonNoticeRe2020(fdoc,occ,canonicalBuilding).filter(Boolean)).map(o=>({...o,specializedFamily:'notice-carbone'}));
}

// v2.3.6 — Notice thermique BE (tableaux en colonnes) : résultats par bâtiment via le parseur dédié ; l'enveloppe
// et les systèmes du moteur générique sont proposés à validation (les articles de l'arrêté y sont recopiés).
function parseThermalNoticeDocument(doc){
  const fdoc={...doc,type:doc.type||DOC_TYPES.THERMAL};
  const dedicated=annotateSemanticHierarchy(fdoc,parseThermalNoticeColumns(fdoc,occ,canonicalBuilding).filter(Boolean)).map(o=>({...o,specializedFamily:'notice-thermique'}));
  const haveField=new Set(dedicated.map(o=>o.field));
  const generic=parseDocument({...doc,__skipDedicated:true}).filter(o=>!haveField.has(o.field)&&!/(?:^|\s)Titre\s+I{1,3}\s*[–-]\s*chapitre|\bArt\.?\s*\d+\s*:/i.test(o.excerpt||'')).map(o=>({...o,confidence:Math.min(o.confidence||0,0.86),reviewCap:0.86,building:'Bâtiment unique'}));
  return [...dedicated,...generic];
}
function parseBiosourcedNoticeDocument(doc){
  const fdoc={...doc,type:doc.type||DOC_TYPES.ENV_REPORT};
  return annotateSemanticHierarchy(fdoc,parseBiosourcedLabelNotice(fdoc,occ)).map(o=>({...o,specializedFamily:'notice-biosource'}));
}

// v2.3.7 — Éditions Pléiades : rapport ACV (indicateurs par bâtiment), synthèse des prestations (résultats + systèmes),
// synthèse des déperditions (aucune donnée du référentiel). Parseurs dédiés uniquement.
function parsePleiadesReportDocument(doc,kind){
  const fdoc={...doc,type:doc.type||(kind==='acv'?DOC_TYPES.RSENV:DOC_TYPES.THERMAL)};
  const out=kind==='acv'?parsePleiadesAcvReport(fdoc,occ,canonicalBuilding):kind==='prestations'?parsePleiadesServicesSummary(fdoc,occ,canonicalBuilding):parseHeatLossReport(fdoc,occ);
  return annotateSemanticHierarchy(fdoc,out.filter(Boolean)).map(o=>({...o,specializedFamily:`pleiades-${kind}`}));
}

// v2.3.4 — Notice ACV E+C- (annexe RSEnv Pléiades) : parseur dédié. En analyse manuelle (moteur libre),
// le moteur générique complète uniquement les champs que le parseur dédié n'a pas trouvés.
function parseEcAcvDocument(doc){
  const fdoc={...doc,type:doc.type||DOC_TYPES.RSENV};
  let out=parseEcAcvNotice(fdoc,occ).filter(Boolean);
  const fams=resolveDocumentFamilies(doc);
  if(doc.familyMode==='manual'&&!fams.includes('annex')){ const allowed=new Set(fams.flatMap(f=>[...(FAMILY_ALLOWED_FIELDS[f]||[])])); out=out.filter(o=>allowed.has(o.field)); }
  out=annotateSemanticHierarchy(fdoc,out).map(o=>({...o,specializedFamily:'acv-ec'}));
  if(fams.includes('annex')){ const have=new Set(out.map(o=>o.field)); out.push(...parseDocument({...doc,__skipEcAcv:true}).filter(o=>!have.has(o.field))); }
  return out;
}

function parseDocument(doc){
  if(doc?.read?.re2020) return parseRe2020Xml(doc);
  if(isClimaWinInputReport(doc)) return [];
  if(isClimaWinSynthesis(doc)) return parseClimaWinDocument(doc);
  if(isBeActRecap(doc)) return parseBeActRecapDocument(doc);
  if(!doc.__skipEcAcv&&isEcAcvNotice(doc)) return parseEcAcvDocument(doc);
  if(!doc.__skipDedicated&&isPleiadesThermalOutput(doc)) return parsePleiadesThermalDocument(doc);
  if(!doc.__skipDedicated&&isCstbRseeFiche(doc)) return parseCstbRseeDocument(doc);
  if(!doc.__skipDedicated&&isCarbonNoticeRe2020(doc)) return parseCarbonNoticeDocument(doc);
  if(!doc.__skipDedicated&&isPleiadesAcvReport(doc)) return parsePleiadesReportDocument(doc,'acv');
  if(!doc.__skipDedicated&&isPleiadesServicesSummary(doc)) return parsePleiadesReportDocument(doc,'prestations');
  if(!doc.__skipDedicated&&isHeatLossReport(doc)) return parsePleiadesReportDocument(doc,'deperditions');
  if(!doc.__skipDedicated&&isThermalNoticeColumns(doc)) return parseThermalNoticeDocument(doc);
  if(!doc.__skipDedicated&&isBiosourcedLabelNotice(doc)) return parseBiosourcedNoticeDocument(doc);
  if(!doc.__skipDedicated&&isStdReport(doc)) return parseStdDocument(doc);
  const families=resolveDocumentFamilies(doc);
  if(families.some(f=>f!=='annex')) return parseSpecializedDocument(doc,families.filter(f=>f!=='annex'));
  let out=[];
  out.push(...parseTaggedFields(doc));
  // Surface bâtiment générique : SHAB, Sref/SRéf, surface habitable, surface du bâtiment, SU/SURT/SRT.
  if(doc.type!==DOC_TYPES.DPGF) out.push(...parseBuildingSurface(doc));
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(doc.type)) out.push(...parseRset(doc));
  out.push(...parseRt2012Hierarchical(doc));
  if(doc.type===DOC_TYPES.THERMAL) out.push(...parseGenericRegulatory(doc));
  if([DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL].includes(doc.type)){ const structuredRenovation=isStructuredRenovationThermalDocument(doc); if(structuredRenovation) out.push(...parseStructuredRenovationThermal(doc)); out.push(...parseThermalStudy(doc)); }
  out.push(...parseProgram(doc),...parseEnvelope(doc));
  // Un DPE contient de nombreuses recommandations et exemples (PAC, biomasse, climatisation, ENR).
  // Ils ne décrivent pas nécessairement les équipements réellement en place : pas de parseur systèmes générique sur DPE.
  if(doc.type!==DOC_TYPES.DPE) out.push(...parseSystems(doc));
  if(doc.type===DOC_TYPES.DPE||/\bdpe\b/i.test(doc.read.text)) out.push(...parseDpe(doc));
  if([DOC_TYPES.CARBON,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RSENV].includes(doc.type)||/ic\s*(?:composants?|composant|energie|énergie|construction|chantier)/i.test(doc.read.text)) out.push(...parseCarbon(doc));
  // Un RSENV/ACV peut être classé « Étude carbone / ACV » tout en utilisant exactement
  // les tableaux détaillés RSEE (lots 1 à 13 + Énergie CE). On applique donc le même parseur.
  if([DOC_TYPES.CARBON,DOC_TYPES.RSENV].includes(doc.type)) addRsetCarbonBreakdown(doc,out);
  out.push(...parseRsenvHierarchical(doc));
  // Patches déclaratifs : uniquement des règles de bibliothèque validées, sans eval/JS externe.
  out.push(...parsePatchOccurrences(doc));
  out=pruneHierarchicalShadowed(doc,out.filter(Boolean));
  return annotateSemanticHierarchy(doc,out);
}

/* ---- tags.js ---- */
const PROJECT_TAG_LIBRARY = [
  {label:'Traitement / réemploi des eaux grises',category:'Eau',patterns:[/eaux?\s+grises?/i,/reutilisation\s+des?\s+eaux?\s+usees?/i,/réutilisation\s+des?\s+eaux?\s+usées?/i,/recyclage\s+des?\s+eaux?/i]},
  {label:'Récupération des eaux pluviales',category:'Eau',patterns:[/recuperation\s+des?\s+eaux?\s+pluviales?/i,/récupération\s+des?\s+eaux?\s+pluviales?/i,/cuve\s+eaux?\s+pluviales?/i,/EP\s+reutilisees?/i]},
  {label:'Gestion alternative des eaux pluviales',category:'Eau',patterns:[/noue\s+(?:paysagere|d['’]infiltration)/i,/bassin\s+d['’]infiltration/i,/infiltration\s+(?:a|à)\s+la\s+parcelle/i,/gestion\s+alternative\s+des?\s+eaux?\s+pluviales?/i]},
  {label:'Biodiversité',category:'Biodiversité',patterns:[/biodiversit[eé]/i,/refuge\s+LPO/i,/hotel\s+a\s+insectes/i,/hôtel\s+à\s+insectes/i,/nichoirs?/i,/gites?\s+a\s+chauves?-souris/i,/gîtes?\s+à\s+chauves?-souris/i]},
  {label:'Toiture / façade végétalisée',category:'Biodiversité',patterns:[/toiture\s+vegetalis[eé]e/i,/terrasse\s+vegetalis[eé]e/i,/fa[cç]ade\s+vegetalis[eé]e/i,/mur\s+vegetal/i]},
  {label:'Habitat sénior',category:'Usage',patterns:[/habitat\s+s[eé]nior/i,/r[eé]sidence\s+s[eé]nior/i,/logements?\s+s[eé]niors?/i,/personnes?\s+[aâ]g[eé]es/i,/ehpad/i,/r[eé]sidence\s+autonomie/i]},
  {label:'Habitat intergénérationnel',category:'Usage',patterns:[/interg[eé]n[eé]rationnel/i,/intergenerationnel/i]},
  {label:'Habitat inclusif',category:'Usage',patterns:[/habitat\s+inclusif/i,/logement\s+inclusif/i]},
  {label:'Résidence étudiante',category:'Usage',patterns:[/r[eé]sidence\s+[eé]tudiante/i,/logements?\s+[eé]tudiants?/i]},
  {label:'Qualité de l’air intérieur',category:'Santé',patterns:[/qualit[eé]\s+de\s+l(?:['’]|\s+)air\s+int[eé]rieur/i,/\bQAI\b/i,/capteur\s+CO2/i,/mesure\s+du\s+CO2/i,/faibles?\s+[eé]missions?\s+de\s+COV/i,/classe\s+A\+\s*(?:COV|emission)/i]},
  {label:'Matériaux biosourcés',category:'Carbone',patterns:[/biosourc[eé]/i,/fibre\s+de\s+bois/i,/ouate\s+de\s+cellulose/i,/chanvre/i,/paille/i,/metisse/i,/m[eé]tisse/i,/li[eè]ge\s+expans[eé]/i]},
  {label:'Réemploi / économie circulaire',category:'Carbone',patterns:[/r[eé]emploi/i,/r[eé]utilisation\s+des?\s+mat[eé]riaux/i,/economie\s+circulaire/i,/économie\s+circulaire/i,/mat[eé]riaux\s+de\s+seconde\s+vie/i]},
  {label:'Production photovoltaïque',category:'Énergie',patterns:[/photovoltaique/i,/photovoltaïque/i,/panneaux?\s+PV\b/i,/centrale\s+solaire/i]},
  {label:'Autoconsommation',category:'Énergie',patterns:[/autoconsommation/i,/auto-consommation/i]},
  {label:'Réseau de chaleur',category:'Énergie',patterns:[/r[eé]seau\s+de\s+chaleur/i,/chauffage\s+urbain/i,/sous[- ]station/i]},
  {label:'Géothermie',category:'Énergie',patterns:[/g[eé]otherm/i,/sondes?\s+g[eé]othermiques?/i]},
  {label:'Brasseurs d’air',category:'Confort',patterns:[/brasseurs?\s+d['’]?air/i,/ventilateurs?\s+de\s+plafond/i,/\bHVLS\b/i]},
  {label:'Conception traversante',category:'Confort',patterns:[/logements?\s+traversants?/i,/zone\s+traversante/i,/groupe\s+traversant/i]},
  {label:'Mobilité électrique',category:'Mobilité',patterns:[/IRVE/i,/bornes?\s+de\s+recharge/i,/recharge\s+des?\s+v[eé]hicules?\s+[eé]lectriques?/i]},
  {label:'Stationnement vélo renforcé',category:'Mobilité',patterns:[/local\s+v[eé]lo/i,/stationnement\s+v[eé]lo/i,/abri\s+v[eé]lo/i]},
  {label:'BBCA',category:'Label',patterns:[/\bBBCA\b/i]},
  {label:'Bâtiment biosourcé',category:'Label',patterns:[/label\s+b[aâ]timent\s+biosourc[eé]/i]},
  {label:'Effinergie',category:'Label',patterns:[/effinergie/i]},
  {label:'BEPOS',category:'Label',patterns:[/\bBEPOS\b/i]},
  {label:'BEE+',category:'Label',patterns:[/\bBEE\+\b/i]}
];

function firstEvidence(doc,patterns){
  for(const page of doc.read?.pages||[]){
    for(const line of page.lines||[]){
      const text=normalizeText(line.text||'');
      if(patterns.some(re=>re.test(text))) return {document:doc.name,page:page.page,excerpt:text.slice(0,360)};
    }
  }
  const text=normalizeText(doc.read?.text||'');
  if(patterns.some(re=>re.test(text))) return {document:doc.name,page:'',excerpt:text.slice(0,360)};
  return null;
}

function performanceTags(result){
  const tags=[];
  for(const row of result?.rows||[]){
    let gain=typeof row.cep_gain==='number'?row.cep_gain:null;
    if(gain==null && typeof row.cep==='number' && typeof row.cep_max==='number' && row.cep_max>0) gain=(row.cep_max-row.cep)/row.cep_max*100;
    if(gain!=null && Number.isFinite(gain) && gain>=5){
      const rounded=Math.round(gain*10)/10;
      tags.push({label:`Performance CEP -${String(rounded).replace('.',',')} %`,category:'Performance',source:'calcul RSET',building:row.building,confidence:1,excerpt:`Cep ${row.cep ?? '—'} / Cep max ${row.cep_max ?? '—'}`});
    }
    let bg=typeof row.bbio_gain==='number'?row.bbio_gain:null;
    if(bg==null && typeof row.bbio==='number' && typeof row.bbio_max==='number' && row.bbio_max>0) bg=(row.bbio_max-row.bbio)/row.bbio_max*100;
    if(bg!=null && Number.isFinite(bg) && bg>=10){ const rounded=Math.round(bg*10)/10; tags.push({label:`Performance Bbio -${String(rounded).replace('.',',')} %`,category:'Performance',source:'calcul RSET',building:row.building,confidence:1,excerpt:`Bbio ${row.bbio ?? '—'} / Bbio max ${row.bbio_max ?? '—'}`}); }
  }
  // Pour rester lisible, une même performance numérique n'est affichée qu'une fois.
  const seen=new Set(); return tags.filter(t=>{const k=normLower(t.label); if(seen.has(k)) return false; seen.add(k); return true;}).slice(0,8);
}

function buildProjectTags(docs,result,manualTags=[]){
  const auto=[];
  for(const def of PROJECT_TAG_LIBRARY){
    let evidence=null;
    for(const doc of docs){ evidence=firstEvidence(doc,def.patterns); if(evidence) break; }
    if(evidence) auto.push({...def,...evidence,source:'document',confidence:.97});
  }
  auto.push(...performanceTags(result));
  const manual=(manualTags||[]).filter(Boolean).map(label=>({label,category:'Manuel',source:'manuel',confidence:1,manual:true}));
  const out=[]; const seen=new Set();
  for(const t of [...manual,...auto]){ const k=normLower(t.label); if(seen.has(k)) continue; seen.add(k); out.push(t); }
  return out;
}

/* ---- learning-memory.js ---- */
const LEARNING_DB_NAME='extracterre-learning-memory';
const LEARNING_DB_VERSION=1;
const LEARNING_SIGNAL_STORE='signals';
const LEARNING_SETTINGS_STORE='settings';
const cache={ready:false,signals:new Map(),profiles:[],disabled:new Set()};

function openLearningDb(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){ reject(new Error('IndexedDB indisponible.')); return; }
    const req=indexedDB.open(LEARNING_DB_NAME,LEARNING_DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(LEARNING_SIGNAL_STORE)){
        const s=db.createObjectStore(LEARNING_SIGNAL_STORE,{keyPath:'id'});
        s.createIndex('field','field',{unique:false}); s.createIndex('docType','docType',{unique:false}); s.createIndex('createdAt','createdAt',{unique:false});
      }
      if(!db.objectStoreNames.contains(LEARNING_SETTINGS_STORE)) db.createObjectStore(LEARNING_SETTINGS_STORE,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('Mémoire d’apprentissage indisponible.'));
  });
}
function reqP(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Erreur IndexedDB apprentissage.'));});}
function txP(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Transaction apprentissage impossible.'));tx.onabort=()=>reject(tx.error||new Error('Transaction apprentissage annulée.'));});}
function safe(v=''){return normalizeText(String(v||'')).trim();}
function anchorText(signal={}){return safe([signal.beforeLine,signal.lineText,signal.afterLine].filter(Boolean).join(' | '));}
function anchorTokens(text=''){
  return [...new Set(normLower(text).replace(/\d+(?:[.,]\d+)?/g,' ').replace(/[^a-zà-ÿ0-9]+/gi,' ').split(/\s+/).filter(t=>t.length>=3&&!/^(?:page|bâtiment|batiment|ligne|valeur|total)$/.test(t)))].slice(0,70);
}
function similarityTokens(a=[],b=[]){if(!a.length||!b.length)return 0;const A=new Set(a),B=new Set(b);let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(1,new Set([...A,...B]).size);}
function locationSimilarity(a,b){
  if(a.field!==b.field||String(a.docType||'')!==String(b.docType||'')) return 0;
  const text=similarityTokens(a.tokens||anchorTokens(a.anchor||''),b.tokens||anchorTokens(b.anchor||''));
  const pageA=Number(a.page),pageB=Number(b.page); let page=0;
  if(Number.isFinite(pageA)&&Number.isFinite(pageB)) page=Math.max(0,1-Math.abs(pageA-pageB)/5);
  const ratioA=Number(a.lineRatio),ratioB=Number(b.lineRatio); let ratio=0;
  if(Number.isFinite(ratioA)&&Number.isFinite(ratioB)) ratio=Math.max(0,1-Math.abs(ratioA-ratioB)/0.35);
  const boxA=a.bboxNormalized,boxB=b.bboxNormalized; let geometry=0;
  if(boxA&&boxB&&Number.isFinite(Number(boxA.x))&&Number.isFinite(Number(boxA.y))&&Number.isFinite(Number(boxB.x))&&Number.isFinite(Number(boxB.y))){
    const ax=Number(boxA.x)+Number(boxA.w||0)/2,ay=Number(boxA.y)+Number(boxA.h||0)/2,bx=Number(boxB.x)+Number(boxB.w||0)/2,by=Number(boxB.y)+Number(boxB.h||0)/2;
    const dist=Math.hypot(ax-bx,ay-by); geometry=Math.max(0,1-dist/.32);
  }
  const hasGeometry=geometry>0||boxA&&boxB;
  return Math.min(1,hasGeometry?text*.58+page*.10+ratio*.12+geometry*.20:text*.72+page*.12+ratio*.16);
}
function profileReliability(p){return (p.confirmations+1)/(p.confirmations+p.rejections+2);}
function baseBoost(p){
  const n=p.confirmations,r=profileReliability(p); if(n<2||r<.55) return 0;
  const b=n>=10?.075:n>=5?.055:n>=3?.035:.018; return Math.max(0,b*Math.min(1,(r-.45)/.45));
}
function rebuildProfiles(){
  const groups=[];
  const signals=[...cache.signals.values()].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  for(const s of signals){
    if(!s?.field||!s?.docType) continue;
    const probe={field:s.field,docType:s.docType,page:s.page,lineRatio:s.lineRatio,bboxNormalized:s.bboxNormalized||null,anchor:anchorText(s),tokens:anchorTokens(anchorText(s))};
    let best=null,bestScore=0;
    for(const p of groups){const score=locationSimilarity(probe,p);if(score>bestScore){best=p;bestScore=score;}}
    if(!best||bestScore<.52){
      best={id:`profile-${groups.length+1}`,seedId:s.id,field:s.field,docType:s.docType,anchor:probe.anchor,tokens:probe.tokens,page:Number(s.page)||null,lineRatio:Number.isFinite(Number(s.lineRatio))?Number(s.lineRatio):null,bboxNormalized:s.bboxNormalized||null,confirmations:0,rejections:0,lastAt:0,samples:[],disabled:false}; groups.push(best);
    }
    if(s.polarity==='negative') best.rejections++; else best.confirmations++;
    best.lastAt=Math.max(best.lastAt,Number(s.createdAt)||0); if(best.samples.length<5) best.samples.push({page:s.page,lineText:s.lineText,selectedText:s.selectedText,polarity:s.polarity||'positive'});
    if(s.polarity!=='negative' && bestScore>=.52){ best.anchor=probe.anchor||best.anchor; best.tokens=probe.tokens.length?probe.tokens:best.tokens; if(Number.isFinite(Number(s.page))) best.page=Number(s.page); if(Number.isFinite(Number(s.lineRatio))) best.lineRatio=Number(s.lineRatio); if(s.bboxNormalized) best.bboxNormalized=s.bboxNormalized; }
  }
  for(const p of groups){ p.reliability=profileReliability(p); p.boost=baseBoost(p); p.disabled=cache.disabled.has(profileKey(p)); }
  cache.profiles=groups.sort((a,b)=>b.confirmations-a.confirmations||b.reliability-a.reliability);
}
function profileKey(p){return `${p.field}|${p.docType}|${p.seedId||normLower(p.anchor||'').slice(0,180)}`;}
async function putSignal(signal){
  const db=await openLearningDb(); try{const tx=db.transaction(LEARNING_SIGNAL_STORE,'readwrite');tx.objectStore(LEARNING_SIGNAL_STORE).put(signal);await txP(tx);}finally{db.close();}
}
function makeId(){try{return `learn-${Date.now()}-${crypto.randomUUID()}`;}catch{return `learn-${Date.now()}-${Math.random().toString(36).slice(2)}`;}}
async function initializeLearningMemory(){
  const db=await openLearningDb(); try{
    const tx=db.transaction([LEARNING_SIGNAL_STORE,LEARNING_SETTINGS_STORE],'readonly'); const signals=await reqP(tx.objectStore(LEARNING_SIGNAL_STORE).getAll()); const disabled=await reqP(tx.objectStore(LEARNING_SETTINGS_STORE).get('disabledProfiles')); await txP(tx);
    cache.signals=new Map((signals||[]).map(s=>[s.id,s])); cache.disabled=new Set(disabled?.value||[]); cache.ready=true; rebuildProfiles(); return getLearningMemoryStats();
  }finally{db.close();}
}
async function reinforceLearningLocation(location={},meta={}){
  const signal={id:String(meta.eventId||makeId()),createdAt:Number(meta.createdAt)||Date.now(),polarity:'positive',field:String(meta.field||location.field||''),docType:String(meta.docType||location.docType||''),document:String(location.document||meta.document||''),page:Number(location.page)||null,pageRatio:Number.isFinite(Number(location.pageRatio))?Number(location.pageRatio):null,lineIndex:Number.isFinite(Number(location.lineIndex))?Number(location.lineIndex):null,lineRatio:Number.isFinite(Number(location.lineRatio))?Number(location.lineRatio):null,lineText:safe(location.lineText),beforeLine:safe(location.beforeLine),afterLine:safe(location.afterLine),selectedText:safe(location.selectedText),selectionMode:String(location.selectionMode||''),normalizedRects:Array.isArray(location.normalizedRects)?location.normalizedRects.slice(0,24):[],bboxNormalized:location.bboxNormalized||null,building:String(meta.building||''),source:'user-highlight'};
  if(!signal.field||!signal.docType) return null; if(cache.signals.has(signal.id)) return signal; await putSignal(signal); cache.signals.set(signal.id,signal); rebuildProfiles(); return signal;
}
async function penalizeLearningLocation(location={},meta={}){
  const signal={id:String(meta.eventId||makeId()),createdAt:Number(meta.createdAt)||Date.now(),polarity:'negative',field:String(meta.field||location.field||''),docType:String(meta.docType||location.docType||''),document:String(location.document||meta.document||''),page:Number(location.page)||null,lineRatio:Number.isFinite(Number(location.lineRatio))?Number(location.lineRatio):null,lineText:safe(location.lineText||meta.lineText),beforeLine:safe(location.beforeLine),afterLine:safe(location.afterLine),selectedText:safe(location.selectedText||meta.selectedText),bboxNormalized:location.bboxNormalized||null,building:String(meta.building||''),source:'user-rejection'};
  if(!signal.field||!signal.docType) return null; if(cache.signals.has(signal.id)) return signal; await putSignal(signal); cache.signals.set(signal.id,signal); rebuildProfiles(); return signal;
}
function applyLearningBoosts(raw=[]){
  if(!cache.ready||!cache.profiles.length) return raw;
  return raw.map(o=>{
    if(!o?.field||!o?.docType||o.userValidated) return o;
    const probe={field:o.field,docType:o.docType,page:o.page,lineRatio:o.lineRatio,bboxNormalized:o.bboxNormalized||null,anchor:safe(o.excerpt||o.lineText||''),tokens:anchorTokens(o.excerpt||o.lineText||'')};
    let best=null,match=0; for(const p of cache.profiles){if(p.disabled||p.boost<=0)continue;const s=locationSimilarity(probe,p);if(s>match){best=p;match=s;}}
    if(!best||match<.42) return o;
    const boost=Math.min(.08,best.boost*Math.min(1,match/.72)); if(boost<=.002) return o;
    return {...o,confidence:Math.min(1,Number(o.confidence||0)+boost),learningBoost:boost,learningMatch:match,learningConfirmations:best.confirmations,learningReliability:best.reliability,learningProfile:profileKey(best)};
  });
}
async function importRemoteLearningEvents(events=[]){
  let added=0;
  for(const e of events||[]){ if(!e?.id||cache.signals.has(e.id)) continue; const p=e.payload||{}; if(e.eventType==='parser_location_learning'){await reinforceLearningLocation(p,{eventId:e.id,createdAt:e.createdAt,field:p.field,docType:p.docType,building:p.building});added++;} else if(e.eventType==='parser_location_rejection'){await penalizeLearningLocation(p,{eventId:e.id,createdAt:e.createdAt,field:p.field,docType:p.docType,building:p.building});added++;} }
  return added;
}
function listLearningProfiles(){return cache.profiles.map(p=>({...p,key:profileKey(p)}));}
function getLearningMemoryStats(){const active=cache.profiles.filter(p=>!p.disabled);return {ready:cache.ready,signals:cache.signals.size,profiles:cache.profiles.length,activeProfiles:active.length,strongProfiles:active.filter(p=>p.confirmations>=5&&p.reliability>=.7).length};}
async function setLearningProfileEnabled(key,enabled=true){
  if(enabled) cache.disabled.delete(key); else cache.disabled.add(key);
  const db=await openLearningDb(); try{const tx=db.transaction(LEARNING_SETTINGS_STORE,'readwrite');tx.objectStore(LEARNING_SETTINGS_STORE).put({key:'disabledProfiles',value:[...cache.disabled]});await txP(tx);}finally{db.close();} rebuildProfiles(); return getLearningMemoryStats();
}
async function clearLearningMemory(){
  const db=await openLearningDb(); try{const tx=db.transaction([LEARNING_SIGNAL_STORE,LEARNING_SETTINGS_STORE],'readwrite');tx.objectStore(LEARNING_SIGNAL_STORE).clear();tx.objectStore(LEARNING_SETTINGS_STORE).clear();await txP(tx);}finally{db.close();} cache.signals.clear();cache.disabled.clear();rebuildProfiles();return getLearningMemoryStats();
}

function __learningMemoryTestProfile(confirmations=5,rejections=0){ const p={field:'cep',docType:'RSET RE2020',anchor:'chapitre exigences cep maximum consommation energie',tokens:anchorTokens('chapitre exigences cep maximum consommation energie'),page:5,lineRatio:.4,confirmations,rejections}; p.reliability=profileReliability(p);p.boost=baseBoost(p);p.disabled=false;return p;}
function __learningMemoryTestSimilarity(a,b){return locationSimilarity(a,b);}

/* ---- coherence.js ---- */
// ExtracTerre v2.3 — contrôles de cohérence métier après consolidation.
// Principe : une valeur cohérente avec ses voisines est confirmée ; une valeur incohérente quitte le
// tableau final et rejoint la file « À vérifier » avec la raison. Les valeurs issues d'un XML structuré
// ou validées par l'utilisateur ne sont jamais retirées : l'incohérence est alors seulement signalée.

const PLAUSIBLE_RANGES=Object.freeze({
  bbio:[5,300], bbio_max:[5,300], cep:[5,700], cep_max:[5,700], cepnr:[5,700], cepnr_max:[5,700],
  dh:[0,5000], dh_max:[0,5000], tic:[15,45], tic_ref:[15,45], ubat_before:[0.05,5], ubat_after:[0.05,5],
  cep_before:[5,1500], cep_after_final:[5,1500], shab:[8,500000], housing_count:[1,5000],
  ic_components:[100,2500], ic_site:[0,250], ic_energy:[0,2000], stock_c_per_m2:[0,400],
  bbio_gain:[-100,100], cep_gain:[-100,100], cepnr_gain:[-100,100], construction_year:[1700,2035]
});
const LOTS=Array.from({length:13},(_,i)=>`ic_lot_${i+1}`);
const ENERGY_POSTS=['ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility'];
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const label=f=>FIELD_MAP[f]?.label||f;
function protectedFinal(f){ return !!(f?.userValidated||f?.structuredXml||/^manual:|^xml:/.test(String(f?.method||''))||f?.docType==='Entrée manuelle'); }

function applyCoherenceChecks(result){
  const alerts=[], demoted=[], checks=[];
  if(!result?.rows?.length) return {alerts,demoted,checks};
  const finalsByKey=new Map(); for(const f of result.finals||[]) finalsByKey.set(`${f.building}|${f.field}`,f);
  for(const row of result.rows){
    const b=row.building; const get=f=>num(row[f]); const fin=f=>finalsByKey.get(`${b}|${f}`);
    const toDemote=new Map();
    const record=(check,status,detail,fields=[],level='warning')=>{
      checks.push({building:b,check,status,detail,fields});
      if(status!=='fail') return;
      const removable=fields.filter(f=>fin(f)&&!protectedFinal(fin(f)));
      const locked=fields.filter(f=>fin(f)&&protectedFinal(fin(f)));
      for(const f of removable) if(!toDemote.has(f)) toDemote.set(f,`${check} : ${detail}`);
      alerts.push({level:locked.length&&!removable.length?'error':level,building:b,message:`Cohérence ${b} — ${check} : ${detail}${removable.length?` → ${removable.map(label).join(', ')} renvoyé(s) en vérification.`:locked.length?' (valeur issue d’une source structurée ou validée : conservée, à contrôler).':''}`});
    };
    // 1. Plages plausibles
    for(const [f,[lo,hi]] of Object.entries(PLAUSIBLE_RANGES)){ const v=get(f); if(v===null) continue; if(v<lo||v>hi) record('Plage plausible','fail',`${label(f)} = ${v} hors de [${lo} ; ${hi}]`,[f]); }
    for(const f of LOTS){ const v=get(f); if(v!==null&&(v<-100||v>1500)) record('Plage plausible','fail',`${label(f)} = ${v} hors de [-100 ; 1500]`,[f]); }
    // 2. Σ lots ≈ IC composants
    const lots=LOTS.map(get); const known=lots.filter(v=>v!==null); const icc=get('ic_components');
    if(icc!==null&&known.length===13){
      const sum=known.reduce((a,v)=>a+v,0); const tol=Math.max(2,Math.abs(icc)*0.03);
      if(Math.abs(sum-icc)<=tol) record('Σ lots 1–13 = IC composants','ok',`${sum.toFixed(1)} ≈ ${icc}`);
      else record('Σ lots 1–13 = IC composants','fail',`Σ lots = ${sum.toFixed(1)} pour IC composants = ${icc} (écart ${(sum-icc).toFixed(1)})`,[...LOTS,'ic_components']);
    }
    // 3. Σ postes énergie ≤ IC énergie (l'éclairage n'a pas de colonne : la somme peut être inférieure)
    const ice=get('ic_energy'); const posts=ENERGY_POSTS.map(get).filter(v=>v!==null);
    if(ice!==null&&posts.length>=3){
      const sum=posts.reduce((a,v)=>a+v,0);
      if(sum<=ice*1.03+1) record('Σ postes énergie ≤ IC énergie','ok',`${sum.toFixed(1)} ≤ ${ice}`);
      else record('Σ postes énergie ≤ IC énergie','fail',`Σ postes = ${sum.toFixed(1)} > IC énergie = ${ice}`,[...ENERGY_POSTS,'ic_energy']);
    }
    // 4. Cep,nr ≤ Cep
    const cep=get('cep'), cepnr=get('cepnr');
    if(cep!==null&&cepnr!==null){ if(cepnr<=cep+0.5) record('Cep,nr ≤ Cep','ok',`${cepnr} ≤ ${cep}`); else record('Cep,nr ≤ Cep','fail',`Cep,nr = ${cepnr} > Cep = ${cep}`,['cep','cepnr']); }
    // 5. Gains recalculés
    for(const [v,m,g] of [['bbio','bbio_max','bbio_gain'],['cep','cep_max','cep_gain'],['cepnr','cepnr_max','cepnr_gain']]){
      const a=get(v), mx=get(m), gain=get(g); if(a===null||!mx) continue;
      const calc=Math.round((mx-a)/mx*1000)/10;
      if(gain===null){
        const src=fin(v)||fin(m)||{};
        const derived={field:g,value:calc,building:b,docId:src.docId||'coherence',fileName:src.fileName||'Calcul de cohérence',docType:src.docType||'',page:src.page||'',excerpt:`${label(m)} = ${mx} ; ${label(v)} = ${a} → gain = (max − valeur) / max = ${calc} %`,confidence:0.995,method:'coherence:gain-calc',unit:'%',status:'retenu',derivedFromDocument:true,origin:'Calcul de cohérence ExtracTerre',provenanceNote:'Gain calculé à partir des deux valeurs retenues du même bâtiment.'};
        row[g]=calc; result.finals.push(derived); finalsByKey.set(`${b}|${g}`,derived);
        record(`Gain ${label(v)}`,'ok',`calculé : ${calc} %`);
      } else {
        const asPct=Math.abs(gain)<=1&&Math.abs(calc)>1?gain*100:gain;
        if(Math.abs(asPct-calc)<=1.5) record(`Gain ${label(v)}`,'ok',`${gain} ≈ ${calc} %`);
        else record(`Gain ${label(v)}`,'fail',`gain lu = ${gain} ; recalculé = ${calc} % (${label(v)} ${a} / max ${mx})`,[g]);
      }
    }
    // 6. Dépassements de seuils réglementaires : informatifs, jamais de retrait.
    for(const [v,m] of [['bbio','bbio_max'],['cep','cep_max'],['cepnr','cepnr_max'],['dh','dh_max']]){ const a=get(v), mx=get(m); if(a!==null&&mx!==null&&a>mx*1.0001) alerts.push({level:'warning',building:b,message:`Cohérence ${b} — ${label(v)} = ${a} dépasse ${label(m)} = ${mx} : non-conformité déclarée ou valeur à contrôler.`}); }
    const tic=get('tic'), ticRef=get('tic_ref'); if(tic!==null&&ticRef!==null&&tic>ticRef+0.05) alerts.push({level:'warning',building:b,message:`Cohérence ${b} — Tic = ${tic} > Tic réf = ${ticRef}.`});
    // Retrait effectif des valeurs incohérentes non protégées.
    for(const [f,reason] of toDemote){
      const final=fin(f); if(!final) continue;
      delete row[f]; finalsByKey.delete(`${b}|${f}`);
      result.finals=result.finals.filter(x=>x!==final);
      demoted.push({...final,status:'à vérifier',coherenceReason:reason,confidence:Math.min(Number(final.confidence)||0.89,0.89)});
      for(const d of result.detailed||[]) if(d.field===f&&d.building===b&&d.status==='retenu'){ d.status='rejeté'; d.rejectionReason=`Incohérence métier : ${reason}`; }
    }
  }
  return {alerts,demoted,checks};
}

/* ---- engine.js ---- */
const BUILDING_SCOPED_FAMILIES=new Set(['confort d\'ete','performance energetique','carbone','dpe']);
function isBuildingScopedField(field){
  if(['shab','housing_count','construction_year'].includes(field)) return true;
  const fam=normLower(FIELD_MAP[field]?.family||'');
  return BUILDING_SCOPED_FAMILIES.has(fam);
}
function valueKey(v){ return typeof v==='number'?v.toFixed(6):normLower(v); }
function routeAndDeduplicate(raw,rules){
  // Normalisation transversale : quelle que soit la source (RSET, CCTP, Excel, manuel),
  // le résultat Menuiseries vitrage privilégie la composition technique 4.16.4 Ar.
  const learnedRaw=applyLearningBoosts(raw);
  const normalizedRaw=learnedRaw.map(o=>o?.field==='window_glazing'?{...o,value:normalizeGlazingType(o.value)||o.value}:o);
  let routed=normalizedRaw.map(o=>({...o,sourceTier:o.userValidated?'main':sourceTier(o.field,o.docType,rules),sourceRank:o.userValidated?-1:sourceRank(o.field,o.docType,rules)})).map(o=>{ if(o.userValidated) return {...o,confidence:1,sourceTier:'main',sourceRank:-1}; const adj=o.libraryDerived?(o.sourceTier==='main'?0:o.sourceTier==='secondary'?-0.03:o.sourceTier==='forbidden'?-0.5:-0.10):(o.sourceTier==='main'?0.05:o.sourceTier==='secondary'?-0.03:o.sourceTier==='forbidden'?-0.5:-0.10); return {...o,confidence:Math.max(0,Math.min(1,o.confidence+adj))}; });
  const agreement=new Map();
  for(const o of routed){ const k=[o.field,valueKey(o.value),o.building].join('|'); if(!agreement.has(k)) agreement.set(k,new Set()); agreement.get(k).add(o.docId); }
  routed=routed.map(o=>{ const n=agreement.get([o.field,valueKey(o.value),o.building].join('|'))?.size||1; const boost=n>=3?0.05:n>=2?0.03:0; return {...o,confidence:Math.max(0,Math.min(1,o.confidence+boost)),agreementSources:n}; });
  // v2.3 — la mémoire d'apprentissage peut faire remonter un candidat en tête de la file « À vérifier »,
  // mais elle ne peut jamais être, à elle seule, la raison du franchissement du seuil de remplissage automatique.
  routed=routed.map(o=>{ const b=Number(o.learningBoost)||0; if(b>0&&!o.userValidated&&o.confidence>=MIN_RETAINED_CONFIDENCE&&o.confidence-b<MIN_RETAINED_CONFIDENCE) return {...o,confidence:MIN_RETAINED_CONFIDENCE-0.001,learningCappedForReview:true}; return o; });
  // v2.3.5 — plafond explicite posé par un parseur (valeur à faire valider) : aucun bonus ne le franchit.
  routed=routed.map(o=>Number.isFinite(o.reviewCap)&&!o.userValidated&&o.confidence>o.reviewCap?{...o,confidence:o.reviewCap}:o);
  const seen=new Map();
  for(const o of routed){ const k=[o.field,valueKey(o.value),o.building,o.docId,o.page,o.excerpt].join('|'); const prev=seen.get(k); if(!prev||o.confidence>prev.confidence) seen.set(k,o); }
  return [...seen.values()];
}


function resolveManualBuilding(name,manual={}){
  let cur=name, guard=0;
  while(manual?.[cur] && manual[cur]!==cur && guard++<12) cur=manual[cur];
  return manual?.[cur]||cur;
}

function buildBuildingGrouping(docs,rawOccurrences=[],manualOverrides={}){
  const docNames=unique(docs.flatMap(d=>d.buildings?.names||[])).filter(Boolean);
  const occNames=unique(rawOccurrences.map(o=>o.building)).filter(Boolean);
  const names=unique([...docNames,...occNames]).filter(b=>b!=='Bâtiment unique');
  const authoritative=unique(docs.filter(d=>[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV].includes(d.type)).flatMap(d=>d.buildings?.names||[])).filter(b=>b&&b!=='Bâtiment unique');
  const aliasMap={}; const modes={};

  const authByCore=new Map();
  for(const a of authoritative){ const c=buildingCoreId(a); if(!c) continue; const list=authByCore.get(c)||[]; list.push(a); authByCore.set(c,list); }
  const allByKey=new Map();
  for(const n of names){ const k=buildingMergeKey(n); if(!k) continue; const list=allByKey.get(k)||[]; list.push(n); allByKey.set(k,list); }

  for(const n of names){
    let target=n, mode='distinct';
    const core=buildingCoreId(n), key=buildingMergeKey(n);
    const auth=core?authByCore.get(core)||[]:[];
    if(auth.length===1){ target=auth[0]; mode=target===n?'rset-master':'auto-rset'; }
    else if(key && (allByKey.get(key)||[]).length>1){
      const group=allByKey.get(key); const master=group.find(x=>authoritative.includes(x))||group.slice().sort((a,b)=>a.length-b.length)[0];
      target=master; mode=target===n?'auto-master':'auto-exact';
    }
    const manualTarget=manualOverrides?.[n]||manualOverrides?.[target];
    if(manualTarget){ target=resolveManualBuilding(manualTarget,manualOverrides); mode='manual'; }
    aliasMap[n]=target;
    modes[n]=mode;
  }

  // Une cible manuelle peut elle-même correspondre à une variante typographique d'un maître RSET.
  for(const [n,t0] of Object.entries(aliasMap)){
    let t=resolveManualBuilding(t0,manualOverrides);
    const core=buildingCoreId(t), auth=core?authByCore.get(core)||[]:[];
    if(modes[n]!=='manual'&&auth.length===1) t=auth[0];
    aliasMap[n]=t;
  }

  const canonicalNames=unique(names.map(n=>aliasMap[n]||n));
  const suggestions=[];
  for(let i=0;i<canonicalNames.length;i++) for(let j=i+1;j<canonicalNames.length;j++){
    const a=canonicalNames[i], b=canonicalNames[j], score=buildingSimilarity(a,b);
    if(score>=.72 && score<.98) suggestions.push({a,b,score});
  }
  suggestions.sort((a,b)=>b.score-a.score);
  const aliases=names.map(source=>({source,target:aliasMap[source]||source,mode:modes[source]||'distinct'}));
  return {aliasMap,aliases,authoritative,canonicalNames,suggestions,manualOverrides:{...manualOverrides}};
}

function mappedBuilding(name,grouping){
  if(name==='Bâtiment unique') return name;
  return grouping?.aliasMap?.[name]||name;
}

function consolidate(docs,occurrences,rules,operationName='',grouping=null){
  const operation=operationName||operationNameFromFiles(docs);
  const detected=unique(docs.flatMap(d=>(d.buildings?.names||['Bâtiment unique']).map(b=>mappedBuilding(b,grouping))));
  const fromOcc=unique(occurrences.map(o=>o.building)).filter(Boolean);
  const explicit=unique([...detected,...fromOcc]).filter(b=>b!=='Bâtiment unique');
  const buildings=explicit.length?explicit:['Bâtiment unique'];
  const finals=[]; const rows=[];

  // Index field+bâtiment : l'ancienne consolidation refiltrait toutes les occurrences pour chacun
  // des champs et chacun des bâtiments. Avec plusieurs centaines de dossiers cela pouvait
  // bloquer le thread principal plusieurs secondes.
  const byFieldBuilding=new Map();
  for(const o of occurrences){
    const key=`${o.field}|${o.building||'Bâtiment unique'}`;
    const list=byFieldBuilding.get(key); if(list) list.push(o); else byFieldBuilding.set(key,[o]);
  }
  // v2.3 — une valeur non attribuée à un bâtiment ne remplit plus silencieusement tous les bâtiments.
  // Pour les indicateurs propres à un bâtiment (performance, confort d'été, carbone, DPE, surface,
  // logements), elle est réservée à la file « À vérifier » dès que l'opération compte plusieurs bâtiments.
  // Pour les autres champs (enveloppe, systèmes, administratif), elle reste utilisable mais une valeur
  // attribuée au bâtiment l'emporte toujours, quel que soit le rang de la source.
  const multiBuilding=buildings.length>1;
  const candidatesFor=(field,building)=>{
    const exact=byFieldBuilding.get(`${field}|${building}`)||[];
    if(building==='Bâtiment unique') return exact;
    const global=byFieldBuilding.get(`${field}|Bâtiment unique`)||[];
    if(!global.length) return exact;
    if(multiBuilding&&isBuildingScopedField(field)) return exact;
    return exact.concat(global.map(o=>({...o,_globalCandidate:true})));
  };

  for(const building of buildings){
    const row={building};
    for(const f of FIELD_DEFS){
      if(f.key==='building') continue;
      const candidates=candidatesFor(f.key,building).filter(o=>o.sourceTier!=='forbidden');
      if(!candidates.length) continue;
      const eligible=candidates.filter(o=>o.confidence>=MIN_RETAINED_CONFIDENCE);
      const main=eligible.filter(o=>o.sourceTier==='main'); const secondary=eligible.filter(o=>o.sourceTier==='secondary');
      // v1.1.13 : une source non routée ne remplit plus automatiquement le tableau final.
      // Elle reste disponible dans la file « À vérifier » pour éviter les faux positifs.
      let pool=main.length?main:secondary;
      if(!pool.length) continue;
      const insulationField=/^(?:wall|floor|roof)_insulation(?:_|$)/.test(f.key);
      const directRset=insulationField?pool.filter(o=>!o.libraryDerived&&[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020].includes(o.docType)):[];
      if(directRset.length) pool=directRset;
      else { const directPool=pool.filter(o=>!o.libraryDerived); if(directPool.length) pool=directPool; }
      pool=[...pool].sort((a,b)=>{
        const ag=a._globalCandidate?1:0, bg=b._globalCandidate?1:0; if(ag!==bg) return ag-bg;
        const ar=Number.isFinite(a.sourceRank)?a.sourceRank:sourceRank(f.key,a.docType,rules), br=Number.isFinite(b.sourceRank)?b.sourceRank:sourceRank(f.key,b.docType,rules);
        if(ar!==br) return ar-br;
        const ah=Number.isFinite(a.hierarchyRank)?a.hierarchyRank:50, bh=Number.isFinite(b.hierarchyRank)?b.hierarchyRank:50;
        if(ah!==bh) return ah-bh;
        // v2.3.3 — plusieurs versions d'une même étude : la date d'étude la plus récente l'emporte (à rang égal).
        const ad=Date.parse(a.studyDate||''), bd=Date.parse(b.studyDate||''); if(Number.isFinite(ad)&&Number.isFinite(bd)&&Math.abs(ad-bd)>36e5) return bd-ad;
        if(f.key==='shab'){ const ap=Number(a.surfacePriority)||0, bp=Number(b.surfacePriority)||0; if(ap!==bp) return bp-ap; }
        return b.confidence-a.confidence;
      });
      let chosen=pool[0];
      if(f.key==='dh') {
        // v2.3.3 — le DH le plus défavorable se cherche parmi les groupes d'UNE version d'étude : on écarte d'abord les versions plus anciennes.
        const dated=pool.map(o=>Date.parse(o.studyDate||'')).filter(Number.isFinite); const newest=dated.length?Math.max(...dated):null;
        if(newest!==null){ const recent=pool.filter(o=>{ const d=Date.parse(o.studyDate||''); return !Number.isFinite(d)||newest-d<=36e5; }); if(recent.length) pool=recent; }
        const dhRows=pool.filter(o=>o.method==='rset:dh-row'||/^climawin:dh/.test(o.method||'')); const numeric=(dhRows.length?dhRows:pool).filter(o=>typeof o.value==='number'); if(numeric.length) chosen=numeric.sort((a,b)=>b.value-a.value)[0]; }
      { const {_globalCandidate,...clean}=chosen; row[f.key]=chosen.value; finals.push({...clean,status:'retenu',operation,...(_globalCandidate?{appliedFromUnattributed:true}:{})}); }
    }
    if(row.operation===undefined) row.operation=operation;
    if(row.operation_name===undefined&&operationName) row.operation_name=operationName;
    rows.push(row);
  }

  const finalIds=new Set(finals.map(o=>[o.field,o.building,o.docId,o.page,o.excerpt,valueKey(o.value)].join('|')));
  const directFinalExact=new Set(), directFinalGlobal=new Set();
  for(const f of finals){
    if(f.libraryDerived) continue;
    if(f.building==='Bâtiment unique') directFinalGlobal.add(f.field);
    else directFinalExact.add(`${f.field}|${f.building}`);
  }
  const detailed=occurrences.map(o=>{
    const retained=finalIds.has([o.field,o.building,o.docId,o.page,o.excerpt,valueKey(o.value)].join('|'));
    const directWinner=!retained&&o.libraryDerived&&(directFinalGlobal.has(o.field)||directFinalExact.has(`${o.field}|${o.building}`));
    const loneScoped=!retained&&multiBuilding&&o.building==='Bâtiment unique'&&isBuildingScopedField(o.field)&&o.sourceTier!=='forbidden';
    // Chaque bâtiment a déjà sa propre valeur : la valeur de niveau lot n'apporte rien et n'est pas proposée en revue.
    const covered=loneScoped&&rows.length>0&&rows.every(r=>r[o.field]!==undefined&&r[o.field]!==null);
    const unattributed=loneScoped&&!covered;
    return {...o,status:retained?'retenu':'rejeté',...(unattributed?{unattributedScoped:true}:{}),rejectionReason:retained?'':(covered?'Valeur de niveau lot : chaque bâtiment dispose déjà de sa propre valeur':unattributed?'Valeur sans bâtiment identifié dans une opération multi-bâtiments : à attribuer manuellement':o.sourceTier==='unrouted'?'Source non autorisée pour remplissage automatique':o.confidence<MIN_RETAINED_CONFIDENCE?`Confiance < ${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`:directWinner?'Valeur documentaire directe prioritaire sur la bibliothèque':'Non retenu après consolidation')};
  });
  return {operation,buildings,rows,finals,detailed,buildingAliases:grouping?.aliases||[],buildingSuggestions:grouping?.suggestions||[],authoritativeBuildings:grouping?.authoritative||[],buildingOverrides:grouping?.manualOverrides||{}};
}

function diagnostics(docs,finals,grouping=null){
  const alerts=[];
  for(const d of docs){
    const standardized=/recapitulatif\s+standardise\s+d['’]?etude\s+thermique|r[eé]capitulatif\s+standardis[eé]\s+d['’]?etude\s+thermique/i.test(normLower(d.read?.text||''));
    if(![DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RT2012].includes(d.type) || (d.type===DOC_TYPES.RT2012&&!standardized)) continue;
    const rawBs=d.buildings?.names||['Bâtiment unique']; const bs=rawBs.map(b=>mappedBuilding(b,grouping));
    if(d.buildings?.expectedCount && rawBs.length!==d.buildings.expectedCount) alerts.push({level:'error',docId:d.id,fileName:d.name,message:`Découpage bâtiments incomplet : le RSET annonce ${d.buildings.expectedCount} bâtiment(s)/zone(s), mais ${rawBs.length} identifiant(s) bâtiment ont été détectés.`});
    const required=expectedFieldsForDocument(d);
    for(const b of bs){
      let found=0;
      for(const field of required){ const ok=finals.some(o=>o.field===field&&(o.docId===d.id||(d.type!==DOC_TYPES.RT2012&&[DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020].includes(o.docType)))&&(o.building===b||bs.length===1)); if(ok) found++; else alerts.push({level:'warning',docId:d.id,fileName:d.name,building:b,field,message:`RSET incomplet — ${b} : ${FIELD_MAP[field].label} absent ou confiance < ${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`}); }
      if(found<required.length) alerts.push({level:'warning',docId:d.id,fileName:d.name,building:b,message:`Complétude réglementaire ${b} : ${found}/${required.length} champs structurés obligatoires.`});
    }
  }
  for(const d of docs){ if(isClimaWinInputReport(d)) alerts.push({level:'info',docId:d.id,fileName:d.name,message:`Rapport de saisie ClimaWin (${d.read?.pageCount||'?'} pages) : paramètres d'entrée non exploités par l'extraction automatique. Les résultats et l'enveloppe par bâtiment viennent de la synthèse ClimaWin.`}); }
  for(const d of docs){ if(d.read?.kind==='pdf'&&d.read.text.replace(/\s/g,'').length<40) alerts.push({level:'warning',docId:d.id,fileName:d.name,message:'PDF sans couche texte exploitable — OCR probablement nécessaire.'}); if(d.error) alerts.push({level:'error',docId:d.id,fileName:d.name,message:d.error}); }
  return alerts;
}


function expectedFieldsForDocument(doc){
  const text=normLower(doc?.read?.text||'');
  if(doc.type===DOC_TYPES.RT2012) return [...REQUIRED_RT2012_RSET_FIELDS];
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020].includes(doc.type)){
    const base=[...REQUIRED_RE2020_RSET_FIELDS];
    // v2.3.6 — les IC ne sont exigés que si ce document en publie réellement (un RSET seul ne contient pas l'ACV,
    // même s'il cite « Ic construction » dans le rappel des exigences).
    const publishesIc=!Array.isArray(doc.cachedOccurrences)||doc.cachedOccurrences.some(o=>/^ic_(?:components|lot_\d+)$/.test(o?.field||''));
    if(publishesIc&&/ic\s*(?:composants?|construction)|(?:1\s*[-–—]\s*vrd)|energie\s*\(\s*ce\s*\)/i.test(text)) base.push('ic_components','ic_energy','ic_site',...Array.from({length:13},(_,i)=>`ic_lot_${i+1}`));
    return unique(base);
  }
  if([DOC_TYPES.RSENV,DOC_TYPES.CARBON].includes(doc.type)) return ['ic_components','ic_site',...Array.from({length:13},(_,i)=>`ic_lot_${i+1}`),'ic_energy'];
  return [];
}
function buildCompleteness(docs,finals,grouping){
  const checks=[]; let expected=0,found=0;
  for(const d of docs){
    const fields=expectedFieldsForDocument(d); if(!fields.length) continue;
    const rawBs=d.buildings?.names||['Bâtiment unique']; const buildings=rawBs.map(b=>mappedBuilding(b,grouping));
    for(const building of buildings){
      const missing=[]; let ok=0;
      for(const field of fields){
        const hit=finals.some(o=>o.field===field&&(o.building===building||o.building==='Bâtiment unique'||buildings.length===1));
        if(hit) ok++; else missing.push(field);
      }
      expected+=fields.length; found+=ok; checks.push({docId:d.id,fileName:d.name,docType:d.type,building,found:ok,expected:fields.length,missing});
    }
  }
  return {found,expected,missing:Math.max(0,expected-found),percent:expected?Math.round(found/expected*100):null,checks};
}
function buildUncertain(detailed=[]){
  const best=new Map();
  for(const o of detailed){
    if(o.sourceTier==='forbidden'||o.confidence<MIN_REVIEW_CONFIDENCE) continue;
    if(o.unattributedScoped){ const k=`${o.building}|${o.field}|unattributed`; const prev=best.get(k); if(!prev||o.confidence>prev.confidence) best.set(k,o); continue; }
    // Les candidats non routés restent à vérifier même au-dessus de 90 % :
    // une bonne ressemblance textuelle ne remplace pas une source métier autorisée.
    if(o.sourceTier!=='unrouted'&&o.confidence>=MIN_RETAINED_CONFIDENCE) continue;
    const k=`${o.building}|${o.field}`; const prev=best.get(k);
    const rank=o.sourceRank??999, prevRank=prev?.sourceRank??999;
    if(!prev||rank<prevRank||(rank===prevRank&&o.confidence>prev.confidence)) best.set(k,o);
  }
  return [...best.values()].sort((a,b)=>b.confidence-a.confidence);
}

// v2.3 — contrôle « famille choisie / type détecté » : la détection reste un garde-fou visible.
function familyMismatchAlerts(docs=[]){
  const alerts=[];
  for(const d of docs){
    if(d?.familyMode!=='manual'||!d.classification) continue;
    const detectedType=d.classification.automaticType||d.classification.type; const conf=Number(d.classification.confidence)||0;
    const auto=autoFamiliesForType(detectedType); const chosen=resolveDocumentFamilies(d);
    if(conf<0.75||auto.includes('annex')||chosen.includes('annex')) continue;
    if(!auto.some(f=>chosen.includes(f))) alerts.push({level:'warning',docId:d.id,fileName:d.name,message:`Famille choisie « ${chosen.map(f=>DOCUMENT_FAMILIES[f]?.short||f).join(' + ')} » différente du type détecté « ${detectedType} » (confiance ${Math.round(conf*100)} %). Vérifiez le choix : le parseur et la liste blanche suivent la famille choisie.`});
  }
  return alerts;
}
function analyzeDocuments(docs,rules,operationName='',buildingOverrides={},extraOccurrences=[]){
  const raw=[...(extraOccurrences||[])]; let newlyParsedCount=0, reusedParsedCount=0;
  for(const d of docs){
    if(Array.isArray(d.cachedOccurrences)){ raw.push(...d.cachedOccurrences); reusedParsedCount++; continue; }
    const parsed=parseDocument(d); d.cachedOccurrences=parsed; d.analysisCachedAt=Date.now(); raw.push(...parsed); newlyParsedCount++;
  }
  const grouping=buildBuildingGrouping(docs,raw,buildingOverrides);
  const remappedRaw=raw.map(o=>{ const mapped=mappedBuilding(o.building,grouping); return {...o,originalBuilding:o.originalBuilding||o.building,building:mapped}; });
  const occurrences=routeAndDeduplicate(remappedRaw,rules); const consolidated=consolidate(docs,occurrences,rules,operationName,grouping); const alerts=diagnostics(docs,consolidated.finals,grouping);
  if(grouping.suggestions?.length) alerts.push({level:'warning',message:`${grouping.suggestions.length} rapprochement(s) de bâtiments ambigu(s) sont proposés à la vérification manuelle.`});
  alerts.push(...familyMismatchAlerts(docs));
  // Versions multiples d'une même étude pour un bâtiment : on indique laquelle est retenue.
  { const seen=new Map(); for(const o of consolidated.detailed||[]){ if(o.field!=='bbio'||!o.studyDate) continue; const k=o.building; if(!seen.has(k)) seen.set(k,new Map()); seen.get(k).set(o.docId,{file:o.fileName,date:o.studyDate,retained:o.status==='retenu'}); }
    for(const [b,m] of seen){ if(m.size<2) continue; const list=[...m.values()].sort((a,c)=>Date.parse(c.date)-Date.parse(a.date)); alerts.push({level:'warning',building:b,message:`Plusieurs versions d'étude pour ${b} : ${list.map(x=>`${x.file} (${String(x.date).slice(0,10)})`).join(' ; ')}. La plus récente est retenue ; vérifiez qu'elle est bien la version de référence.`}); } }
  const unattributedCount=consolidated.detailed.filter(o=>o.unattributedScoped).length;
  if(unattributedCount) alerts.push({level:'warning',message:`${unattributedCount} valeur(s) d'indicateur sans bâtiment identifié n'ont pas été recopiées sur chaque bâtiment : elles sont proposées dans « À vérifier ».`});
  // v2.3 — contrôles de cohérence métier : une valeur incohérente avec ses voisines quitte le tableau
  // et part en revue ; les valeurs structurées (XML) et les validations utilisateur ne sont jamais retirées.
  const coherence=applyCoherenceChecks(consolidated);
  alerts.push(...coherence.alerts);
  const completeness=buildCompleteness(docs,consolidated.finals,grouping);
  const uncertain=[...coherence.demoted,...buildUncertain(consolidated.detailed)];
  return {...consolidated,occurrences,alerts,grouping,completeness,uncertain,coherence:coherence.checks,newlyParsedCount,reusedParsedCount};
}

function freeSearch(docs,query){
  const rawQuery=query.trim(); if(!rawQuery) return [];
  const qlow=normLower(rawQuery);
  const surfaceQuery=/\b(?:shab|sref|surt|srt|surface)\b/.test(qlow);
  const cepQuery=/\bcep\b|cep\s*,?\s*nr/.test(qlow);
  const icEnergyQuery=/\bic\s*(?:energie|énergie)\b|icenergie/.test(qlow);
  const icComponentsQuery=/\bic\s*composants?\b|iccomposant/.test(qlow);
  const icQuery=icEnergyQuery||icComponentsQuery||/^\s*ic\s*$/.test(qlow);

  let variants=[rawQuery];
  if(surfaceQuery) variants.push('shab','sref','surface habitable','surface de référence','surface utile','surt','srt','surface du bâtiment');
  else {
    const synonymGroups={
      toiture:['toiture','plancher haut','combles'],facade:['facade','mur','paroi verticale'],chaudiere:['chaudiere','chauffage'],isolation:['isolation','isolant','thermique']
    };
    for(const [key,arr] of Object.entries(synonymGroups)) if(qlow.includes(key)) variants.push(...arr);
  }
  if(cepQuery) variants.push('cep','coefficient cep','consommations annuelles par poste');
  if(icEnergyQuery) variants.push('ic énergie','ic energie','energie ce','énergie ce');
  else if(icComponentsQuery) variants.push('ic composants','iccomposant');
  else if(icQuery) variants.push('ic','carbone','acv');
  const uniqueVariants=[...new Set(variants.map(v=>normLower(v)).filter(Boolean))];

  const variantScore=(variant,text)=>{
    const vt=variant.split(/[^a-z0-9]+/).filter(x=>x.length>1||x==='ic'); if(!vt.length) return 0;
    const tt=new Set(normLower(text).split(/[^a-z0-9]+/).filter(Boolean));
    return vt.reduce((n,t)=>n+(tt.has(t)?1:0),0)/vt.length;
  };
  const surfacePositive=t=>/\bshab\b|\bs\s*ref\b|\bsref\b|\bsurt\b|\bsrt\b|\bshonrt\b|surface\s+(?:habitable|utile|r[eé]glementaire|thermique|totale\s+(?:du\s+)?b[aâ]timent|(?:de\s+)?reference|(?:de\s+)?référence|(?:totale\s+)?du\s+batiment|(?:totale\s+)?du\s+bâtiment|de\s+plancher)/i.test(t);
  const surfaceNoise=t=>/ratio\s*1\s*\/\s*6|surface\s+(?:de\s+)?(?:parcelle|vegetalis|végétalis|arrosee|arrosée|impermeabilis|imperméabilis|facade|façade|baie|paroi|plancher\s+(?:haut|bas)|toiture|mur|isolant)|temperature\s+de\s+surface|température\s+de\s+surface|surface\s+(?:totale\s+)?d[eé]perditive|(?:kwhep|kwh|w|kg[^|]{0,12})\s*\/\s*m(?:2|²)\s*(?:shab|sref|surt|srt)\b/i.test(t);
  const surfaceRelevant=t=>surfacePositive(t)&&!surfaceNoise(t);
  const surfaceDataSegment=t=>surfaceRelevant(t)
    && /(?:m(?:2|²)|[:=]\s*[-+]?\d)/i.test(t)
    && !/(?:w\s*\/|kwh\s*\/|kg\s*(?:eq\.?\s*)?co2\s*\/|ratio|q4pa|d[eé]perdition|coefficient|seuil|max(?:imum)?\b)/i.test(t);
  const intentRelevant=t=>{
    if(surfaceQuery) return String(t).split('|').some(seg=>surfaceRelevant(seg));
    if(icEnergyQuery) return /\bic\s*(?:energie|énergie)\b|icenergie|energie\s*\(\s*ce\s*\)|énergie\s*\(\s*ce\s*\)/i.test(t);
    if(icComponentsQuery) return /\bic\s*composants?\b|iccomposant/i.test(t);
    if(icQuery) return /\bic\b|iccomposant|icenergie|\bacv\b|kg\s*(?:eq\.?\s*)?co2/i.test(t);
    if(cepQuery) return /\bcep\b|consommations?\s+annuelles?\s+par\s+poste/i.test(t);
    return true;
  };
  const probableNumber=(current,context)=>{
    const segments=String(context).split('|').map(x=>x.trim()).filter(Boolean);
    const safeCurrent=maskNonDataNumerics(current), safeContext=maskNonDataNumerics(context);
    let nums=numbersIn(safeCurrent); if(!nums.length) nums=numbersIn(safeContext);
    if(surfaceQuery){
      // Prendre la valeur sur le segment portant réellement le libellé de surface,
      // pas un numéro d'article situé sur la ligne voisine.
      const surfaceSegment=segments.find(seg=>surfaceDataSegment(seg)&&numbersIn(maskNonDataNumerics(seg)).some(v=>v>20&&v<250000));
      if(!surfaceSegment) return null;
      const clean=normalizeText(maskNonDataNumerics(surfaceSegment));
      const explicitPatterns=[
        /\bshab(?:\s*(?:\/|ou)\s*(?:su|surt))?\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i,
        /\bs\s*ref(?:\s*\/\s*usage\s+principal)?\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i,
        /\bsref(?:\s*\/\s*usage\s+principal)?\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i,
        /surface\s+(?:habitable|utile|r[eé]glementaire|thermique|(?:totale\s+)?du\s+b[aâ]timent|de\s+plancher|(?:de\s+)?r[eé]f[eé]rence)[^0-9]{0,35}([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i,
        /\b(?:surt|srt|shonrt)\b\s*(?:m(?:2|²))?\s*[:=]?\s*([-+]?\d+(?:[\s.]\d{3})*(?:[,.]\d+)?)/i
      ];
      for(const re of explicitPatterns){ const m=clean.match(re); if(m){ const v=Number(String(m[1]).replace(/\s/g,'').replace(',','.')); if(v>20&&v<250000) return v; } }
      const vals=numbersIn(clean).filter(v=>v>20&&v<250000);
      return vals[0]??null;
    }
    if(cepQuery){
      const wantsNr=/cep\s*,?\s*nr|cepnr/.test(qlow), wantsMax=/\bmax\b/.test(qlow);
      const coeffLine=segments.find(x=>/coefficients?\s+cep\s*\/\s*cep\s*(?:max)?/i.test(x));
      const coeffNums=numbersIn(maskNonDataNumerics(coeffLine||'')).filter(v=>v>=-100&&v<5000);
      if(coeffLine && coeffNums.length>=4){
        if(wantsNr&&wantsMax) return coeffNums[3];
        if(wantsNr) return coeffNums[2];
        if(wantsMax) return coeffNums[1];
        return coeffNums[0];
      }
      // Lignes de synthèse RE2020 : « Cep 45,5 80,5 43,48 » / « Cep,nr 45,5 59 22,88 ».
      const rowRe=wantsNr?/^\s*cep\s*,?\s*nr\b/i:/^\s*cep\b(?!\s*,?\s*nr)/i;
      const row=segments.find(x=>rowRe.test(normalizeText(x)));
      if(row){
        const vals=numbersIn(maskNonDataNumerics(row)).filter(v=>v>=-100&&v<5000);
        if(vals.length){ if(wantsMax&&vals.length>=2) return vals[1]; return vals[0]; }
      }
      // Recherche par poste : refroidissement, éclairage, auxiliaires, déplacements...
      const postPatterns=[];
      if(/refroid|clim|froid/.test(qlow)) postPatterns.push(/refroid|clim|froid/i);
      if(/eclairage|éclairage/.test(qlow)) postPatterns.push(/eclairage|éclairage/i);
      if(/aux.*vent|ventilat/.test(qlow)) postPatterns.push(/aux.*vent|ventilat/i);
      if(/aux.*dist|distribution/.test(qlow)) postPatterns.push(/aux.*dist|distribution/i);
      if(/deplacement|déplacement|ascenseur|mobilite|mobilité/.test(qlow)) postPatterns.push(/deplacement|déplacement|ascenseur|mobilite|mobilité/i);
      if(postPatterns.length){
        const rowPost=segments.find(x=>postPatterns.some(re=>re.test(x))&&numbersIn(maskNonDataNumerics(x)).length);
        if(rowPost){ const vals=numbersIn(maskNonDataNumerics(rowPost)).filter(v=>v>=0&&v<5000); if(vals.length) return vals[vals.length-1]; }
      }
      // Sans ligne Cep explicite, ne pas prendre un numéro d'article, une surface ou un millésime voisin.
      return null;
    }
    if(icComponentsQuery){
      const explicit=normalizeText(context).match(/\bic\s*composants?\s*(?:=|:)?\s*([-+]?\d+(?:[,.]\d+)?)/i)||normalizeText(context).match(/\biccomposant\s*(?:=|:)?\s*([-+]?\d+(?:[,.]\d+)?)/i);
      if(explicit) return parseFloat(explicit[1].replace(',','.'));
    }
    if(icEnergyQuery){
      const explicit=normalizeText(context).match(/\bic\s*(?:energie|énergie)\s*(?:=|:)?\s*([-+]?\d+(?:[,.]\d+)?)/i)||normalizeText(context).match(/\bicenergie\s*(?:=|:)?\s*([-+]?\d+(?:[,.]\d+)?)/i);
      if(explicit) return parseFloat(explicit[1].replace(',','.'));
      // Dans les tableaux ACV, l'intitulé « Energie (CE) » est souvent sur la ligne précédente
      // et la valeur du poste sur la ligne courante : le dernier nombre de la ligne est le total.
      const rowVals=numbersIn(safeCurrent).filter(v=>v>=0&&v<100000); if(rowVals.length) return rowVals[rowVals.length-1];
    }
    return nums.length?nums[nums.length-1]:null;
  };

  const results=[];
  for(const d of docs){
    for(const page of d.read?.pages||[]){
      const lines=page.lines||[];
      for(let i=0;i<lines.length;i++){
        const line=lines[i], text=line.text||'';
        // Une fenêtre élargie est nécessaire pour les tableaux PDF où l'intitulé de section
        // (ex. « ENERGIE (CE) » / « IC composants » / « SRef ») est séparé de la ligne de valeur.
        // On reste local à la page afin d'éviter de mélanger des tableaux éloignés.
        const context=lines.slice(Math.max(0,i-4),Math.min(lines.length,i+5)).map(x=>x.text||'').filter(Boolean).join(' | ');
        if(!intentRelevant(context)) continue;
        if(cepQuery && /chapitre\s+\d+.*cep/i.test(normLower(context)) && !/coefficients?\s+cep|consommations?\s+annuelles?/i.test(normLower(context))) continue;
        const baseScore=Math.max(0,...uniqueVariants.map(v=>variantScore(v,context))); if(baseScore<0.5) continue;
        const low=normLower(text); const headingLike=/^(?:chapitre|section|partie)\s+\d+\b|^\d+(?:\.\d+){1,}\.?\s+|logiciel\s+et\s+version|version\s*:/i.test(low);
        // En ACV, une ligne voisine peut contenir « IC énergie » alors que la ligne courante
        // n'est qu'un identifiant/numéro de section. On ne garde que les vraies lignes de
        // données énergie (libellé IC, poste, total, ou section Energie (CE)).
        if(icEnergyQuery && !/(?:\bic\s*(?:energie|énergie)\b|icenergie|energie\s*\(\s*ce\s*\)|énergie\s*\(\s*ce\s*\)|chauffage|refroidissement|\becs\b|eclairage|éclairage|auxiliaires?|ventilat(?:eur|ion)|distribution|deplacements?|déplacements?|ascenseur|parking|total\s+(?:lot|:))/i.test(text)) continue;
        const probable=headingLike?null:probableNumber(text,context);
        if(surfaceQuery && probable!==null){
          const validCarrier=String(context).split('|').map(x=>x.trim()).filter(Boolean).some(seg=>surfaceDataSegment(seg)&&numbersIn(maskNonDataNumerics(seg)).some(v=>Math.abs(v-probable)<1e-6));
          if(!validCarrier) continue;
        }
        if((surfaceQuery||cepQuery||icQuery) && probable===null) continue;
        if((cepQuery||icQuery) && headingLike && probable===null) continue;
        const numericBonus=probable!==null?.08:0, exactBonus=variantScore(qlow,context)>=.99?.06:0;
        const rank=baseScore+numericBonus+exactBonus-(headingLike?.18:0);
        const confidence=Math.min(.98,.46+baseScore*.46+numericBonus+exactBonus); if(confidence<MIN_RETAINED_CONFIDENCE) continue;
        results.push({value:probable??'—',numericValue:probable,document:d.name,docId:d.id,page:page.page,building:buildingForPosition(d,page.page,line.index),excerpt:normalizeText(context).slice(0,420),confidence,score:rank});
      }
    }
  }
  const seen=new Set();
  return results.sort((a,b)=>b.score-a.score||b.confidence-a.confidence).filter(x=>{ const k=`${x.docId}|${x.page}|${x.building}|${x.value}`; if(seen.has(k)) return false; seen.add(k); return true; }).slice(0,150);
}


function runSelfTests(){
  const tests=[]; const assert=(name,ok,details='')=>tests.push({name,ok:!!ok,details});
  const mk=(text,type=DOC_TYPES.RSET_RE2020)=>({id:'test',name:'RSET_TEST.pdf',type,read:{pages:[{page:1,lines:text.split('\n').map((text,index)=>({text,index})),text}],text},buildings:{names:['Bâtiment A'],hits:[{building:'Bâtiment A',page:1,line:0}]}});
  const r=parseDocument(mk('Bâtiment A\nCoefficient Bbio | 43,8 | 65,9 | 33,5\nCoefficients Cep / Cepmax - Cep,nr / Cep,nrmax | 65 | 82,3 | 65 | 67,8 | 21 | 4,1\nDH = 988,2'));
  const get=f=>r.find(o=>o.field===f)?.value;
  assert('RSET Bbio',get('bbio')===43.8,`obtenu ${get('bbio')}`); assert('RSET Bbio Max',get('bbio_max')===65.9); assert('RSET Cep',get('cep')===65); assert('RSET Cep Max',get('cep_max')===82.3); assert('RSET Cepnr',get('cepnr')===65); assert('RSET Cepnr Max',get('cepnr_max')===67.8); assert('RSET DH',get('dh')===988.2);
  const t=parseDocument(mk('Bâtiment A\nT2 T3 T4',DOC_TYPES.RSET_RE2020)); assert('Typologies interdites dans parseur RSET',!t.some(o=>o.field==='housing_typologies'));
  assert('Colonnes numériques non concaténées',JSON.stringify(numbersIn('505 212 162 116'))===JSON.stringify([505,212,162,116]));
  assert('Vitrage Climawin feuilleté 8/16(argon)/44.2',normalizeGlazingType('8/16(argon)/44.2 Si')==='8.16.44.2 Ar');
  assert('Vitrage Climawin feuilleté 44.2/16(argon)/4',normalizeGlazingType('44.2/16(argon)/4')==='44.2.16.4 Ar');
  const dhTable=parseDocument(mk('Bâtiment A\nZone / Groupes SRef Indicateur degrés-heures (DH) en °C.h\nNb heures inconfort\nOui | 663,4 | 505 | 212 | 162 | 116 | Conforme\nNon | 475,1 | 791,4 | 266 | 211 | 164 | Conforme',DOC_TYPES.RSET_RE2020)); assert('Tableau DH réel',dhTable.some(o=>o.field==='dh'&&o.value===791.4)); assert('SHAB jamais calculée depuis le tableau DH',!dhTable.some(o=>o.field==='shab'));
  const shabDoc=mk('Bâtiment : Batiment A\nZone(s) du bâtiment Usage zone S (m²) Surface utile SU ou surf. hab. SHAB Nombre de groupes\nZone traversante\n604,1 604,1 1\nZone non traversante\n914,1 914,1 1\nNombre de logements 25',DOC_TYPES.RSET_RE2020); const shabParsed=parseDocument(shabDoc); assert('SHAB Chapitre 2 = somme colonne SHAB',shabParsed.some(o=>o.field==='shab'&&Math.abs(o.value-1518.2)<0.001),String(shabParsed.find(o=>o.field==='shab')?.value));
  const namedBuilding=mk('Bâtiment : BAT Fa - Bat de 3 MI accolés\nIdentifiant Bâtiment \"BAT Fa - Bat de 3 MI accolés\"',DOC_TYPES.RSET_RE2020); namedBuilding.buildings=detectBuildings(namedBuilding); assert('Nom bâtiment RSET descriptif conservé',namedBuilding.buildings.names.includes('Bâtiment FA - BAT DE 3 MI ACCOLES'),namedBuilding.buildings.names.join(', '));
  const detailDoc=mk('Bâtiment : Batiment B\nCoefficient Bbio | 50 | 70 | 28,6\nCoefficients Cep / Cepmax - Cep,nr / Cep,nrmax | 72 | 89,1 | 72 | 73,4 | 19,2 | 1,9\nBatiment B S : 1138,5 Consommations et productions annuelles du bâtiment par poste et par type d’énergie exprimée en énergie finale\nGaz FOD Bois Electricité Réseau de chaleur\nPoste de consommation Chauffage 0 0 0 16,8 0\nRefroidissement 0 0 0 1,1 0\nECS 0 0 0 9,3 0\nEclairage 1,9\nAuxiliaires VMC 0,5\nAuxiliaires distribution 0\nDéplacement 1,7\nS Consommations annuelles par poste en énergie finale\nCH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements Mobilier Prod. photovoltaïque Prod. cogénération Total annuel\nBâtiment (Batiment B) 1138,5 16,8 1,1 9,3 1,9 0,5 0 1,7 24,8 0 0 56,1\nS Consommations annuelles par poste en énergie finale\nGaz FOD Bois Electricité Réseau chaleur Prod. photovoltaïque Prod. cogénération Total annuel\nBâtiment (Batiment B) 1138,5 0 0 0 31,3 0 0 0 31,3',DOC_TYPES.RSET_RE2020); const detailParsed=parseDocument(detailDoc); assert('RSET sorties détaillées -> Cep éclairage',detailParsed.some(o=>o.field==='cep_lighting'&&Math.abs(o.value-4.37)<0.001),String(detailParsed.find(o=>o.field==='cep_lighting')?.value)); assert('RSET sorties détaillées -> Cep refroidissement',detailParsed.some(o=>o.field==='cep_cooling'&&Math.abs(o.value-2.53)<0.001),String(detailParsed.find(o=>o.field==='cep_cooling')?.value)); assert('RSET sorties détaillées -> Cep électricité',detailParsed.some(o=>o.field==='cep_electricity'&&Math.abs(o.value-71.99)<0.001),String(detailParsed.find(o=>o.field==='cep_electricity')?.value));
  const d=parseDocument(mk('Bâtiment A\nFaçade : laine de roche 160 mm R = 4,50',DOC_TYPES.CCTP)); assert('Isolant façade normalisé',d.some(o=>o.field==='wall_insulation'&&o.value==='Laine de roche')); assert('Épaisseur façade',d.some(o=>o.field==='wall_insulation_thickness'&&o.value===160)); assert('R façade',d.some(o=>o.field==='wall_insulation_r'&&o.value===4.5));
  const thresholdDoc={id:'threshold-test',name:'TEST.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment A']}};
  const thresholdOcc=[
    {field:'structure',value:'Sous seuil',building:'Bâtiment A',docId:'threshold-test',fileName:'TEST.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'test 89%',confidence:0.89,method:'test',sourceTier:'main'},
    {field:'ventilation',value:'Au seuil',building:'Bâtiment A',docId:'threshold-test',fileName:'TEST.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'test 90%',confidence:0.90,method:'test',sourceTier:'main'}
  ];
  const thresholdResult=consolidate([thresholdDoc],thresholdOcc,DEFAULT_SOURCE_RULES,'Test seuil');
  assert('Confiance < 90 % exclue',thresholdResult.rows[0].structure===undefined);
  assert('Confiance >= 90 % retenue',thresholdResult.rows[0].ventilation==='Au seuil');
  const rich=parseDocument(mk('Façade extérieure : doublage ITE ROCKMUR ép. 160 mm résistance thermique R = 4,50\nVentilation : VMC simple flux hygro B\nChauffage projet : chaudière gaz à condensation\nECS : chauffe-eau thermodynamique CET\nMenuiseries extérieures : châssis aluminium double vitrage faible émissivité, volets roulants',DOC_TYPES.CCTP));
  assert('Alias isolant produit -> Laine de roche',rich.some(o=>o.field==='wall_insulation'&&o.value==='Laine de roche'));
  assert('Contexte ITE épaisseur',rich.some(o=>o.field==='wall_insulation_thickness'&&o.value===160));
  assert('VMC hygro B élargie',rich.some(o=>o.field==='ventilation'&&o.value==='VMC Hygro B'));
  assert('Chaudière condensation élargie',rich.some(o=>o.field==='heating_mode_after'&&o.value==='Chaudière condensation'));
  assert('CET élargi',rich.some(o=>o.field==='ecs'&&o.value==='Chauffe-eau thermodynamique'));
  assert('Menuiserie alu élargie',rich.some(o=>o.field==='window_material'&&o.value==='Aluminium'));
  assert('Vitrage VIR élargi',rich.some(o=>o.field==='window_glazing'&&o.value==='Double vitrage VIR'));
  const program=parseDocument(mk('Construction de 53 logements\nA 001 T4 - 79,22 m²\nB 001 T3 - 65,74 m²\nB 004 T2 - 45,26 m²',DOC_TYPES.PLAN));
  assert('Nombre logements formulation construction de',program.some(o=>o.field==='housing_count'&&o.value===53));
  assert('Typologies plan agrégées',program.some(o=>o.field==='housing_typologies'&&/T2/.test(o.value)&&/T3/.test(o.value)&&/T4/.test(o.value)));
  const mixedText='Bâtiment A\nToiture terrasse : isolant TMS ép. 120 mm R = 5,45\nPlancher bas sur parking : laine de verre GR32 100 mm R = 3,15\nChauffage projet : chaudière gaz à condensation - gaz naturel\nECS projet : chauffe-eau thermodynamique CET - électricité';
  const mixedDoc=mk(mixedText,DOC_TYPES.CCTP); mixedDoc.name='CCTP_TEST.pdf';
  const mixedParsed=parseDocument(mixedDoc);
  assert('Contexte voisin sans contamination toiture/plancher',mixedParsed.some(o=>o.field==='roof_insulation'&&o.value==='PUR')&&!mixedParsed.some(o=>o.field==='roof_insulation'&&o.value==='Laine de verre'));
  assert('Bibliothèque cœur = 150 variantes demandées',CORE_INSULATION_VARIANT_COUNT===150,String(CORE_INSULATION_VARIANT_COUNT));
  assert('Bibliothèque isolants totale = 173 variantes',INSULATION_LIBRARY_VARIANT_COUNT===173,String(INSULATION_LIBRARY_VARIANT_COUNT));
  const mixedResult=analyzeDocuments([mixedDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test vocabulaire');
  assert('Détections contextuelles conservées à >= 90 %',mixedResult.rows[0].roof_insulation==='PUR'&&mixedResult.rows[0].heating_mode_after==='Chaudière condensation');
  const libDoc=mk('Façade extérieure ITE : Isover GR32 ép. 120 mm',DOC_TYPES.CCTP); libDoc.name='CCTP_LIBRARY.pdf'; const libResult=analyzeDocuments([libDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test bibliothèque');
  const libR=libResult.finals.find(o=>o.field==='wall_insulation_r'); assert('Fallback R bibliothèque avec produit + épaisseur',libR?.value===3.75&&libR?.libraryDerived===true,`${libR?.value} ${libR?.method}`);
  const directLibDoc=mk('Façade extérieure ITE : Isover GR32 ép. 120 mm R = 3,80',DOC_TYPES.CCTP); directLibDoc.name='CCTP_DIRECT.pdf'; const directLibResult=analyzeDocuments([directLibDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test priorité directe'); const directR=directLibResult.finals.find(o=>o.field==='wall_insulation_r'); assert('R direct prioritaire sur bibliothèque',directR?.value===3.8&&!directR?.libraryDerived,`${directR?.value} ${directR?.method}`);
  const sourcePriorityDocR={id:'rset-priority',name:'RSET.pdf',type:DOC_TYPES.RSET_RE2020,buildings:{names:['Bâtiment A']}};
  const sourcePriorityDocC={id:'cctp-priority',name:'CCTP.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment A']}};
  const sourcePriorityResult=consolidate([sourcePriorityDocR,sourcePriorityDocC],[{field:'wall_insulation_r',value:3.7,building:'Bâtiment A',docId:'rset-priority',fileName:'RSET.pdf',docType:DOC_TYPES.RSET_RE2020,page:1,excerpt:'RSET R=3,7',confidence:.91,method:'test:rset-direct',sourceTier:'main'},{field:'wall_insulation_r',value:3.8,building:'Bâtiment A',docId:'cctp-priority',fileName:'CCTP.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'CCTP R=3,8',confidence:.99,method:'test:cctp-direct',sourceTier:'main'}],DEFAULT_SOURCE_RULES,'Test priorité RSET');
  assert('Isolation directe RSET prioritaire',sourcePriorityResult.rows[0].wall_insulation_r===3.7,String(sourcePriorityResult.rows[0].wall_insulation_r));
  const fuzzyDoc=mk('Façade extérieure ITE : Pavaflx Confort ép. 120 mm',DOC_TYPES.CCTP); fuzzyDoc.name='CCTP_FUZZY.pdf'; const fuzzyResult=analyzeDocuments([fuzzyDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test fuzzy');
  assert('Nom produit proche / faute légère reconnu',fuzzyResult.rows[0].wall_insulation==='Fibre de bois'&&fuzzyResult.rows[0].wall_insulation_r===3.15,`${fuzzyResult.rows[0].wall_insulation} / ${fuzzyResult.rows[0].wall_insulation_r}`);
  const noThicknessDoc=mk('Façade extérieure ITE : Isover GR32',DOC_TYPES.CCTP); noThicknessDoc.name='CCTP_NO_THICKNESS.pdf'; const noThicknessResult=analyzeDocuments([noThicknessDoc],structuredClone(DEFAULT_SOURCE_RULES),'Test pas invention');
  assert('Produit sans épaisseur : aucun R bibliothèque inventé',noThicknessResult.rows[0].wall_insulation_r===undefined,String(noThicknessResult.rows[0].wall_insulation_r));
  assert('ECS ne récupère pas le vecteur chauffage voisin',mixedResult.rows[0].ecs_vector_after==='Électricité');

  // RSET RT2012 multi-bâtiments : le registre Chapitre 2 doit créer exactement une ligne par identifiant.
  const multiText=`Nombre de bâtiments/zones du projet 4 ( Bât. 1 : 2 zones. Bât. 2 : 2 zones. Bât. 3 : 1 zone. Bât. 4 : 3 zones. )
Identifiant Bâtiment Bat 100
Identifiant Bâtiment Bat 200
Identifiant Bâtiment Bat 300
Identifiant Bâtiment Bat 400`;
  const multiDoc={id:'multi-rt',name:'RSET_RT2012.pdf',type:DOC_TYPES.RT2012,read:{pages:[{page:1,text:multiText,lines:multiText.split('\n').map((text,index)=>({text,index}))}],text:multiText}};
  multiDoc.buildings=detectBuildings(multiDoc);
  assert('RT2012 registre maître = 4 bâtiments',multiDoc.buildings.names.length===4&&multiDoc.buildings.expectedCount===4,multiDoc.buildings.names.join(', '));
  const multiConsolidated=consolidate([multiDoc],[],DEFAULT_SOURCE_RULES,'Multi');
  assert('RT2012 4 bâtiments = 4 lignes export',multiConsolidated.rows.length===4,String(multiConsolidated.rows.length));

  // En RT2012, les sorties détaillées sont déjà exprimées en énergie primaire : aucune conversion ×2,3.
  const epText=`Identifiant Bâtiment Bat 100
Résultats sorties détaillées
Bat 100
Consommations et productions annuelles du bâtiment par poste et par type d'énergie exprimée en énergie primaire (kWh ep/m2 SRT)
Gaz FOD Charbon Bois Electricité Réseau de chaleur
Chauffage 25,5 0 0 0 0,6 0
ECS 22,5 0 0 0 0,5 0
Eclairage 4,1
Auxiliaires VMC 1,3
Auxiliaires distribution 1,6
SRT m2 Consommations annuelles par poste en énergie primaire (kWh ep/m2 SRT)
Chauffage Refroid. ECS Eclairage Auxiliaires VMC Aux. distribution Prod. photov. Prod. cogénération Total annuel
Bâtiment (Bat 100) 947,3 26,1 0 23 4,1 1,3 1,6 0 0 56,1
SRT m2 Consommations annuelles par poste en énergie primaire (kWh ep/m2 SRT)
Gaz FOD Charbon Bois Electricité Réseau chaleur Prod. photov. Prod. cogénération Total annuel
Bâtiment (Bat 100) 947,3 48 0 0 0 8,2 0 0 0 56,2`;
  const epDoc={id:'ep-rt',name:'RSET_RT2012_EP.pdf',type:DOC_TYPES.RT2012,read:{pages:[{page:1,text:epText,lines:epText.split('\n').map((text,index)=>({text,index,items:[]}))}],text:epText}}; epDoc.buildings=detectBuildings(epDoc);
  const epParsed=parseDocument(epDoc);
  assert('RT2012 Cep détaillé primaire lu sans reconversion',epParsed.some(o=>o.field==='cep_lighting'&&o.value===4.1)&&epParsed.some(o=>o.field==='cep_electricity'&&o.value===8.2),`${epParsed.find(o=>o.field==='cep_lighting')?.value}/${epParsed.find(o=>o.field==='cep_electricity')?.value}`);

  // RE2020 : tableaux PDF fréquemment éclatés sur plusieurs lignes.
  const reSplitText=`Identifiant Bâtiment Batiment A
Résultats sorties détaillées - (Batiment A)
S Consommations annuelles par poste en énergie finale
CH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements Mobilier Prod. photovoltaïque Prod. cogénération Total annuel
Bâtiment
(Batiment A)
1169,1 10,4 4,7 7,8 2 0,6 0 0,1 24,8 0 0 50,4
S Consommations annuelles par poste en énergie finale
Gaz FOD Bois Electricité Réseau chaleur Prod. photovoltaïque Prod. cogénération Total annuel
Bâtiment (Batiment A) 1169,1 0 0 0 25,6 0 0 0 25,6
Bâtiment / Zone(s) S Coefficient Cep Coefficient Cep,nr
Bâtiment (Batiment A) 1169,1 72,3 59,6
Cep,nr Cep,nr_Max Gain en %
Cep,nr 59,6 67,5 11,7`;
  const reSplitDoc={id:'re-split',name:'RSET_RE2020_SPLIT.pdf',type:DOC_TYPES.RSET_RE2020,read:{pages:[{page:1,text:reSplitText,lines:reSplitText.split('\n').map((text,index)=>({text,index,items:[]}))}],text:reSplitText}}; reSplitDoc.buildings=detectBuildings(reSplitDoc);
  const reSplitParsed=parseDocument(reSplitDoc);
  assert('RE2020 ligne bâtiment éclatée -> Cep refroidissement',reSplitParsed.some(o=>o.field==='cep_cooling'&&Math.abs(o.value-10.81)<.001),String(reSplitParsed.find(o=>o.field==='cep_cooling')?.value));
  assert('RE2020 ligne bâtiment éclatée -> Cep éclairage',reSplitParsed.some(o=>o.field==='cep_lighting'&&Math.abs(o.value-4.6)<.001),String(reSplitParsed.find(o=>o.field==='cep_lighting')?.value));
  assert('RE2020 ligne bâtiment éclatée -> Cep auxiliaire ventilation',reSplitParsed.some(o=>o.field==='cep_aux_vent'&&Math.abs(o.value-1.38)<.001),String(reSplitParsed.find(o=>o.field==='cep_aux_vent')?.value));
  assert('RE2020 ligne bâtiment éclatée -> Cep auxiliaire distribution = 0',reSplitParsed.some(o=>o.field==='cep_aux_dist'&&o.value===0),String(reSplitParsed.find(o=>o.field==='cep_aux_dist')?.value));
  assert('RE2020 ligne bâtiment éclatée -> Cep déplacement occupants',reSplitParsed.some(o=>o.field==='cep_mobility'&&Math.abs(o.value-.23)<.001),String(reSplitParsed.find(o=>o.field==='cep_mobility')?.value));
  assert('RE2020 tableau coefficient -> Cep,nr',reSplitParsed.some(o=>o.field==='cepnr'&&o.value===59.6),String(reSplitParsed.find(o=>o.field==='cepnr')?.value));
  assert('RE2020 récapitulatif -> Cep,nr max',reSplitParsed.some(o=>o.field==='cepnr_max'&&o.value===67.5),String(reSplitParsed.find(o=>o.field==='cepnr_max')?.value));

  // Deux bâtiments successifs : les identifiants courts A/B ne doivent jamais se contaminer.
  const multiReText=`Identifiant Bâtiment Batiment A
Coefficients Cep / Cepmax - Cep,nr / Cep,nrmax 82,7 88,9 35,3 73,2 7 51,8
Résultats sorties détaillées - (Batiment A)
S Consommations annuelles par poste en énergie finale
CH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements Mobilier Prod. photovoltaïque Prod. cogénération Total annuel
Bâtiment (Batiment A) 1169,1 10,4 4,7 7,8 2 0,6 0 0,1 24,8 0 0 50,4
Identifiant Bâtiment Batiment B
Coefficients Cep / Cepmax - Cep,nr / Cep,nrmax 84,4 86,3 35,7 71,1 2,2 49,8
Résultats sorties détaillées - (Batiment B)
S Consommations annuelles par poste en énergie finale
CH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements Mobilier Prod. photovoltaïque Prod. cogénération Total annuel
Bâtiment (Batiment B) 1323,3 10,1 4,6 7,6 2 0,6 0 0,1 24,8 0 0 49,8`;
  const multiReDoc={id:'multi-re',name:'RSET_MULTI.pdf',type:DOC_TYPES.RSET_RE2020,read:{pages:[{page:1,text:multiReText,lines:multiReText.split('\n').map((text,index)=>({text,index,items:[]}))}],text:multiReText}}; multiReDoc.buildings=detectBuildings(multiReDoc);
  const multiReParsed=parseDocument(multiReDoc);
  const val=(b,f)=>multiReParsed.find(o=>o.building===b&&o.field===f&&o.method==='rset:cep-table')?.value;
  assert('RSET multi-bâtiments : Cep,nr A conservé sur A',val('Bâtiment A','cepnr')===35.3,String(val('Bâtiment A','cepnr')));
  assert('RSET multi-bâtiments : Cep,nr B conservé sur B',val('Bâtiment B','cepnr')===35.7,String(val('Bâtiment B','cepnr')));
  const postVal=(b,f)=>multiReParsed.find(o=>o.building===b&&o.field===f&&o.method==='rset:detailed-output-cep')?.value;
  assert('RSET multi-bâtiments : refroidissement B rattaché au bon bâtiment',Math.abs((postVal('Bâtiment B','cep_cooling')??0)-10.58)<.001,String(postVal('Bâtiment B','cep_cooling')));

  // Analyse incrémentale : un document déjà extrait réutilise son cache et n'est pas reparsé.
  const thermalFixture=mk(`ETUDE ÉNERGÉTIQUE TH-CEx\nÉtat Existant Bâtiment\nUbat du bâtiment 1,580\nCoefficient Cep Existant (kWh énergie primaire / m² Shon) 198,0\nÉtat projeté Scénario 2\nUbat du bâtiment 0,660\nCoefficient Cep Projet (kWh énergie primaire / m² Shon) 97,7\nCoefficient Cep Réf. (kWh énergie primaire / m² Shon) 157,7\nECLAIRAGE\nTotal Energie primaire (kWh EP /m²Shon) 27,8\nAUXILIAIRES\nVent - Total Energie primaire (kwh EP /m²Shon) 5,1`,DOC_TYPES.THERMAL);
  const thermalParsed=parseDocument(thermalFixture);
  assert('Étude thermique -> Ubat avant',thermalParsed.some(o=>o.field==='ubat_before'&&o.value===1.58),String(thermalParsed.find(o=>o.field==='ubat_before')?.value));
  assert('Étude thermique -> Ubat projet',thermalParsed.some(o=>o.field==='ubat_after'&&o.value===0.66),String(thermalParsed.find(o=>o.field==='ubat_after')?.value));
  assert('Étude thermique -> Cep projet',thermalParsed.some(o=>o.field==='cep'&&o.value===97.7),String(thermalParsed.find(o=>o.field==='cep')?.value));
  assert('Étude thermique -> Cep référence',thermalParsed.some(o=>o.field==='cep_max'&&o.value===157.7),String(thermalParsed.find(o=>o.field==='cep_max')?.value));
  assert('Étude thermique -> Cep éclairage',thermalParsed.some(o=>o.field==='cep_lighting'&&o.value===27.8),String(thermalParsed.find(o=>o.field==='cep_lighting')?.value));
  assert('Étude thermique -> Cep auxiliaire ventilation',thermalParsed.some(o=>o.field==='cep_aux_vent'&&o.value===5.1),String(thermalParsed.find(o=>o.field==='cep_aux_vent')?.value));
  const cachedDoc={id:'cached-doc',name:'ancien.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment A']},cachedOccurrences:[{field:'structure',value:'Béton',building:'Bâtiment A',docId:'cached-doc',fileName:'ancien.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'Béton',confidence:.96,method:'cached'}]};
  const cachedResult=analyzeDocuments([cachedDoc],DEFAULT_SOURCE_RULES,'Cache');
  assert('Analyse incrémentale réutilise les documents déjà analysés',cachedResult.reusedParsedCount===1&&cachedResult.newlyParsedCount===0&&cachedResult.rows[0].structure==='Béton',`${cachedResult.reusedParsedCount}/${cachedResult.newlyParsedCount}`);
  const newText='Mur extérieur PSE R=3.8';
  const newDoc={id:'new-doc',name:'nouveau.txt',type:DOC_TYPES.CCTP,read:{pages:[{page:1,text:newText,lines:[{text:newText,index:0,items:[]}]}],text:newText},buildings:{names:['Bâtiment A']}};
  const incremented=analyzeDocuments([cachedDoc,newDoc],DEFAULT_SOURCE_RULES,'Cache');
  assert('Analyse incrémentale ne parse que le nouveau document',incremented.reusedParsedCount===1&&incremented.newlyParsedCount===1,`${incremented.reusedParsedCount}/${incremented.newlyParsedCount}`);

  const tagText='Résidence sénior avec traitement des eaux grises, démarche biodiversité et suivi de la qualité de l air intérieur.';
  const tagDoc={id:'tag-doc',name:'notice.pdf',type:DOC_TYPES.NOTICE,read:{pages:[{page:1,text:tagText,lines:[{text:tagText,index:0}]}],text:tagText},buildings:{names:['Bâtiment unique']}};
  const tags=buildProjectTags([tagDoc],{rows:[{building:'Bâtiment unique',cep:40,cep_max:100}]},[]);
  assert('Tags projet : eaux grises / biodiversité / sénior',tags.some(t=>/eaux grises/i.test(t.label))&&tags.some(t=>/biodiversit/i.test(t.label))&&tags.some(t=>/sénior/i.test(t.label)),tags.map(t=>t.label).join(', '));
  assert('Tag dynamique performance CEP',tags.some(t=>/Performance CEP -60/.test(t.label)),tags.map(t=>t.label).join(', '));

  // Regroupement bâtiments : variantes évidentes automatiques, identifiants ambigus uniquement sur validation manuelle.
  const aliasDocs=[
    {id:'rset-a',name:'RSET A.pdf',type:DOC_TYPES.RT2012,buildings:{names:['Bâtiment A']}},
    {id:'cctp-a',name:'CCTP A.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bât A']}}
  ];
  const aliasGrouping=buildBuildingGrouping(aliasDocs,[{building:'BAT A'}],{});
  assert('Bât A / Bâtiment A / BAT A fusionnés automatiquement',aliasGrouping.aliasMap['Bât A']==='Bâtiment A'&&aliasGrouping.aliasMap['BAT A']==='Bâtiment A',JSON.stringify(aliasGrouping.aliasMap));

  const ambiguousDocs=[
    {id:'b',name:'B.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment B']}},
    {id:'b1',name:'B1.pdf',type:DOC_TYPES.CCTP,buildings:{names:['Bâtiment B1']}}
  ];
  const ambiguousGrouping=buildBuildingGrouping(ambiguousDocs,[],{});
  assert('B et B1 restent distincts sans validation',ambiguousGrouping.canonicalNames.length===2,ambiguousGrouping.canonicalNames.join(', '));
  assert('B et B1 proposés comme rapprochement possible',ambiguousGrouping.suggestions.some(x=>[x.a,x.b].includes('Bâtiment B')&&[x.a,x.b].includes('Bâtiment B1')),JSON.stringify(ambiguousGrouping.suggestions));

  const manualGrouping=buildBuildingGrouping(ambiguousDocs,[],{'Bâtiment B1':'Bâtiment B'});
  const mergeRaw=[
    {field:'structure',value:'Béton',building:'Bâtiment B',docId:'b',fileName:'B.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'structure',confidence:.95,method:'test'},
    {field:'ventilation',value:'VMC Hygro B',building:'Bâtiment B1',docId:'b1',fileName:'B1.pdf',docType:DOC_TYPES.CCTP,page:1,excerpt:'ventilation',confidence:.95,method:'test'}
  ].map(o=>({...o,originalBuilding:o.building,building:mappedBuilding(o.building,manualGrouping)}));
  const mergeOcc=routeAndDeduplicate(mergeRaw,DEFAULT_SOURCE_RULES);
  const mergeResult=consolidate(ambiguousDocs,mergeOcc,DEFAULT_SOURCE_RULES,'Fusion',manualGrouping);
  assert('Fusion manuelle = une seule ligne avec données cumulées',mergeResult.rows.length===1&&mergeResult.rows[0].structure==='Béton'&&mergeResult.rows[0].ventilation==='VMC Hygro B',JSON.stringify(mergeResult.rows));

  const carbonDetailText=`Bâtiment A
1-VRD
Total : 1 2 3 4 25,58 0 0 25,58
6-Façades et menuiseries extérieures
Total : 27,82 1,80 16,99 0,4438092 43,73 0,0 0,0 43,73
8-CVC
Total : 38,97 3,06 90,14 5,78 125,7 0,0 0,0 125,7
Total Lot : 279,3 48,24 208,2 33,44 547,3 0,0 0,0 547,3
Energie (CE)
Chauffage
Total : 0 0 0 0 28,12 0 0 28,12
Ecs
Total : 0 0 0 0 15,42 0 0 15,42
Refroidissement
Total : 0 0 0 0 2,53 0 0 2,53
Eclairage
Total : 0 0 0 0 5,73 0 0 5,73
Auxiliaires Ventilateurs
Total : 0 0 0 0 3,80 0 0 3,80
Auxiliaires Distribution
Total : 0 0 0 0 0,2530752 0 0 0,2530752
Ascenseur / parking
Total : 0 0 0 0 0,5061504 0 0 0,5061504
Total Lot : 0 0 0 0 56,35 0 0 56,35
Eau (CRE)
Total Lot : 0 0 54,81 0 54,81 0 0 54,81
Chantier (Cha)
Total Lot : 0 0 0 0 7,55 0 0 7,55`;
  const carbonDetailDoc=mk(carbonDetailText,DOC_TYPES.RSET_RE2020); const carbonDetail=parseDocument(carbonDetailDoc); const cval=f=>carbonDetail.find(o=>o.field===f&&String(o.method||'').startsWith('rset:carbon'))?.value;
  assert('RSEE détaillé -> IC composants lot 1',cval('ic_lot_1')===25.58,String(cval('ic_lot_1')));
  assert('RSEE détaillé -> IC composants lot 6',cval('ic_lot_6')===43.73,String(cval('ic_lot_6')));
  assert('RSEE détaillé -> IC composants lot 8',cval('ic_lot_8')===125.7,String(cval('ic_lot_8')));
  assert('RSEE détaillé -> IC composants bâtiment',cval('ic_components')===547.3,String(cval('ic_components')));
  assert('RSEE détaillé -> IC énergie chauffage',cval('ic_energy_heating')===28.12,String(cval('ic_energy_heating')));
  assert('RSEE détaillé -> IC énergie refroidissement',cval('ic_energy_cooling')===2.53,String(cval('ic_energy_cooling')));
  assert('RSEE détaillé -> IC énergie auxiliaires ventilation',cval('ic_energy_aux_vent')===3.8,String(cval('ic_energy_aux_vent')));
  assert('RSEE détaillé -> IC énergie auxiliaires distribution',Math.abs((cval('ic_energy_aux_dist')??0)-.2530752)<1e-9,String(cval('ic_energy_aux_dist')));
  assert('RSEE détaillé -> IC énergie déplacements',Math.abs((cval('ic_energy_mobility')??0)-.5061504)<1e-9,String(cval('ic_energy_mobility')));
  assert('RSEE détaillé -> IC énergie bâtiment',cval('ic_energy')===56.35,String(cval('ic_energy')));
  assert('RSEE détaillé -> IC chantier',cval('ic_site')===7.55,String(cval('ic_site')));

  const validated=routeAndDeduplicate([{field:'cep_cooling',value:4.2,building:'Bâtiment A',docId:'ocr',fileName:'RSET.pdf',docType:DOC_TYPES.RSET_RE2020,page:9,excerpt:'OCR',confidence:.73,method:'ocr',userValidated:true}],DEFAULT_SOURCE_RULES);
  assert('Validation utilisateur OCR -> confiance 100 % et source principale',validated[0]?.confidence===1&&validated[0]?.sourceTier==='main',JSON.stringify(validated[0]));

  // v1.0.19 : tolérance aux rapports logiciels mono-bâtiment dont les titres génériques
  // ressemblent à tort à des identifiants bâtiment.
  const genericBuildingText=`1.1. Bâtiment : BÂTIMENT
Bâtiment : Bâtiment (RE2020)
Bâtiment : Bâtiment - bâtiment neuf Consommations
ICcomposant = 547,3 kg eq.CO2/m² SRef`;
  const genericBuildingDoc={id:'generic-building',name:'RSENV_TEST.pdf',type:DOC_TYPES.RSET_RE2020,read:{pages:[{page:1,text:genericBuildingText,lines:genericBuildingText.split('\n').map((text,index)=>({text,index,items:[]}))}],text:genericBuildingText}};
  genericBuildingDoc.buildings=detectBuildings(genericBuildingDoc);
  assert('Rapport mono-bâtiment : titres RE2020/Consommations non créés comme bâtiments',genericBuildingDoc.buildings.names.length===1&&genericBuildingDoc.buildings.names[0]==='Bâtiment unique',genericBuildingDoc.buildings.names.join(', '));

  const rsenvClass=classifyDocument('Mon_projet_RSENV.pdf','Indicateur de changement climatique ICcomposant = 547,3 kg eq.CO2/m² SRef RE2020');
  assert('Nom de fichier RSENV reconnu comme source RSENV',rsenvClass.type===DOC_TYPES.RSENV,`${rsenvClass.type} ${JSON.stringify(rsenvClass.reason)}`);
  const rseeClass=classifyDocument('Mon_projet_RSEE.pdf','Récapitulatif standardisé d’étude énergétique et environnementale RE2020 Cep,nr DH IC composants');
  assert('RSEE distingué du RSET dans le routage',rseeClass.type===DOC_TYPES.RSEE_RE2020,`${rseeClass.type} ${JSON.stringify(rseeClass.reason)}`);

  const regTokenNumbers=numbersIn('IC énergie est inférieure à IC énergie max conformément à la RE2020');
  assert('RE2020 jamais interprété comme valeur numérique',regTokenNumbers.length===0,JSON.stringify(regTokenNumbers));
  const falseIcDoc=mk('IC énergie est inférieure à IC énergie max conformément à la RE2020',DOC_TYPES.RSET_RE2020);
  const falseIc=parseDocument(falseIcDoc);
  assert('Phrase réglementaire RE2020 ne crée pas de faux IC énergie',!falseIc.some(o=>o.field==='ic_energy'),JSON.stringify(falseIc.filter(o=>o.field==='ic_energy')));

  const shabFallbackText=`Bâtiment : Bâtiment A
Résultats sorties détaillées
SHAB ou SURT : 1 138,5 m²`;
  const shabFallbackDoc=mk(shabFallbackText,DOC_TYPES.RSET_RE2020);
  const shabFallback=parseDocument(shabFallbackDoc);
  assert('SHAB explicite de secours récupérée hors tableau Chapitre 2',shabFallback.some(o=>o.field==='shab'&&Math.abs(o.value-1138.5)<.001),String(shabFallback.find(o=>o.field==='shab')?.value));
  const surfaceSref=parseDocument(mk('Bâtiment : Bâtiment A\nSRef / usage principal 1 323,3 m2 / Logement collectif',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment depuis SRef / usage principal',surfaceSref.some(o=>o.field==='shab'&&Math.abs(o.value-1323.3)<.001),String(surfaceSref.find(o=>o.field==='shab')?.value));
  const surfaceInline=parseDocument(mk('Type de travaux : Bâtiment neuf Sref : 330,8 m²',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment depuis Sref inline',surfaceInline.some(o=>o.field==='shab'&&Math.abs(o.value-330.8)<.001),String(surfaceInline.find(o=>o.field==='shab')?.value));
  const surfaceBuilding=parseDocument(mk('Surface du bâtiment : 330,80 m²',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment depuis libellé Surface du bâtiment',surfaceBuilding.some(o=>o.field==='shab'&&Math.abs(o.value-330.8)<.001),String(surfaceBuilding.find(o=>o.field==='shab')?.value));
  const surfaceHab=parseDocument(mk('Surface habitable 5 110,25 m²',DOC_TYPES.THERMAL));
  assert('Surface bâtiment depuis Surface habitable',surfaceHab.some(o=>o.field==='shab'&&Math.abs(o.value-5110.25)<.001),String(surfaceHab.find(o=>o.field==='shab')?.value));
  const surfaceShabSu=parseDocument(mk('Bâtiment 1 - SHAB/SU : 5110 m² - Année 1983',DOC_TYPES.THERMAL));
  assert('Surface bâtiment depuis SHAB/SU inline',surfaceShabSu.some(o=>o.field==='shab'&&Math.abs(o.value-5110)<.001),String(surfaceShabSu.find(o=>o.field==='shab')?.value));
  const surfaceNoFalse=parseDocument(mk('La surface de façade est inférieure à la moitié de la surface habitable du bâtiment. Éclairage naturel 1/6 SHAB',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment : aucune valeur tirée des règles 1/6 ou surfaces de façade',!surfaceNoFalse.some(o=>o.field==='shab'),String(surfaceNoFalse.find(o=>o.field==='shab')?.value));
  const surfaceSplitSref=parseDocument(mk('Bâtiment : Bâtiment A\nSRef / usage principal\n1 518,3 m² / Logement collectif',DOC_TYPES.RSET_RE2020));
  assert('Surface bâtiment depuis Sref scindée sur 2 lignes',surfaceSplitSref.some(o=>o.field==='shab'&&Math.abs(o.value-1518.3)<.001),String(surfaceSplitSref.find(o=>o.field==='shab')?.value));
  const surfaceShabUnitFirst=parseDocument(mk('Bâtiment : Bâtiment A\nShab m² 5 110,25',DOC_TYPES.THERMAL));
  assert('Surface bâtiment depuis ligne Shab m² valeur',surfaceShabUnitFirst.some(o=>o.field==='shab'&&Math.abs(o.value-5110.25)<.001),String(surfaceShabUnitFirst.find(o=>o.field==='shab')?.value));
  const surfaceSplitSrt=parseDocument(mk('Bâtiment : Bat 100\nSRT 2\n947,3 m',DOC_TYPES.RT2012));
  assert('Surface bâtiment secours depuis SRT scindée',surfaceSplitSrt.some(o=>o.field==='shab'&&Math.abs(o.value-947.3)<.001),String(surfaceSplitSrt.find(o=>o.field==='shab')?.value));
  const searchSurface=freeSearch([mk('Bâtiment A\nSRef / usage principal 1 323,3 m2 / Logement collectif',DOC_TYPES.RSET_RE2020)],'surface bâtiment');
  assert('Recherche libre surface reconnaît SRef',searchSurface.some(x=>Math.abs((x.numericValue??0)-1323.3)<.001),JSON.stringify(searchSurface.slice(0,2)));
  const searchNoRe=freeSearch([mk('IC énergie conforme à la RE2020',DOC_TYPES.RSET_RE2020)],'IC énergie');
  assert('Recherche libre ne propose jamais 2020 depuis RE2020',!searchNoRe.some(x=>x.numericValue===2020),JSON.stringify(searchNoRe));

  const wrappedCarbonText=`Bâtiment A
1-VRD
Total : 1 2 3 4 25,58 0 0 25,58
10-Réseaux d’énergie
Total : 1 2 3 4 98,00 0 0 98,00
11-Réseaux de
communication (courant faible)
Total : 1 0 0,9964836 0 2,00 0 0 2,00
12-Appareils élévateurs et
autres équipements de transport intérieur
Total : 0 0 0 0 0 0 0 0
13-Equipements de
production locale d’électricité
Total : 0 0 0 0 0 0 0 0
Total Lot : 279,3 48,24 208,2 33,44 547,3 0 0 547,3`;
  const wrappedCarbonDoc=mk(wrappedCarbonText,DOC_TYPES.RSET_RE2020);
  const wrappedCarbon=parseDocument(wrappedCarbonDoc);
  const wc=f=>wrappedCarbon.find(o=>o.field===f&&String(o.method||'').startsWith('rset:carbon'))?.value;
  assert('IC lot 11 récupéré malgré intitulé sur plusieurs lignes',wc('ic_lot_11')===2,String(wc('ic_lot_11')));
  assert('IC lot 13 à zéro conservé',wc('ic_lot_13')===0,String(wc('ic_lot_13')));

  const searchSurfaceNoise=freeSearch([mk('Article 22 : coefficient 0,50 W/(m2 SRef.K)\nSurface de façade : 1062 m2\nSRef / usage principal 1 323,3 m2 / Logement collectif',DOC_TYPES.RSET_RE2020)],'surface bâtiment');
  assert('Recherche libre surface privilégie la surface bâtiment et ignore ratios/parois',searchSurfaceNoise[0]?.numericValue===1323.3,JSON.stringify(searchSurfaceNoise.slice(0,3)));
  const searchIcEnergyRows=freeSearch([mk('17.1.2.1.2. ENERGIE (CE)\nML23015163\nChauffage\nTotal : 0 0 0 0 28,12 0 0 28,12',DOC_TYPES.RSET_RE2020)],'IC énergie');
  assert('Recherche libre IC énergie ignore les identifiants de section voisins',!searchIcEnergyRows.some(x=>x.numericValue===2)&&searchIcEnergyRows.some(x=>Math.abs((x.numericValue??0)-28.12)<.001),JSON.stringify(searchIcEnergyRows));

  const criticalCepText=`Résultats détaillés des consommations annuelles par poste pour le bâtiment
Consommations annuelles par poste en énergie finale
CH FR ECS Eclairage Aux. ventilation Aux. distribution Déplacements`;
  const richItems=Array.from({length:80},(_,i)=>({str:i%2?'texte':'123'}));
  assert('OCR auto renforcé sur tableau Cep critique incomplet',shouldOcrPdfPage(criticalCepText,richItems,'auto')===true);
  const criticalCarbonText=`Détail des émissions de gaz à effet de serre ICcomposant
1-VRD
Total Lot : 547,3`;
  assert('OCR auto renforcé sur tableau IC critique mal reconstruit',shouldOcrPdfPage(criticalCarbonText,richItems,'auto')===true);

  // Contrat de schéma v2.3.5 : 173 colonnes exactes (168 historiques + 5 IC ajoutées en fin), chacune avec des tags reconnus.
  assert('Schéma métier = 173 colonnes',FIELD_DEFS.length===173,String(FIELD_DEFS.length));
  assert('Chaque colonne possède au moins un tag',FIELD_DEFS.every(f=>Array.isArray(FIELD_TAGS[f.key])&&FIELD_TAGS[f.key].length>0),FIELD_DEFS.filter(f=>!FIELD_TAGS[f.key]?.length).map(f=>f.label).join(', '));
  assert('Tous les intitulés exacts sont reconnus comme en-têtes',FIELD_DEFS.every(f=>matchFieldByHeader(f.label)?.key===f.key),FIELD_DEFS.filter(f=>matchFieldByHeader(f.label)?.key!==f.key).map(f=>f.label).join(', '));
  const contractTagged=parseDocument(mk('Code interne : OPE-009999\nNom opération : Résidence Test',DOC_TYPES.CONTRACT));
  assert('Tags contrat -> Code interne',contractTagged.some(o=>o.field==='internal_code'&&o.value==='OPE-009999'));
  assert('Tags contrat -> Nom opération',contractTagged.some(o=>o.field==='operation_name'&&o.value==='Résidence Test'));
  const sourceOrderOccurrences=routeAndDeduplicate([
    {field:'reference_name',value:'Contrat prioritaire',building:'Bâtiment unique',docId:'c',fileName:'contrat.pdf',docType:DOC_TYPES.CONTRACT,page:1,excerpt:'Référentiel',confidence:.90,method:'test'},
    {field:'reference_name',value:'Livret plus confiant',building:'Bâtiment unique',docId:'l',fileName:'livret.pdf',docType:DOC_TYPES.OPERATION_BOOKLET,page:1,excerpt:'Référentiel',confidence:.99,method:'test'}
  ], DEFAULT_SOURCE_RULES);
  const sourceOrderResult=consolidate([], sourceOrderOccurrences, DEFAULT_SOURCE_RULES, 'Test sources');
  assert('Ordre des sources prime sur la confiance',sourceOrderResult.rows[0]?.reference_name==='Contrat prioritaire',String(sourceOrderResult.rows[0]?.reference_name));
  const rseeVsRset=consolidate([],routeAndDeduplicate([
    {field:'housing_total',value:24,building:'Bâtiment unique',docId:'rsee',fileName:'RSEE.pdf',docType:DOC_TYPES.RSEE_RE2020,page:1,excerpt:'24 logements',confidence:.90,method:'test'},
    {field:'housing_total',value:25,building:'Bâtiment unique',docId:'rset',fileName:'RSET.pdf',docType:DOC_TYPES.RSET_RE2020,page:1,excerpt:'25 logements',confidence:.99,method:'test'}
  ],DEFAULT_SOURCE_RULES),DEFAULT_SOURCE_RULES,'Test ordre RSEE RSET');
  assert('Bloc programme : RSEE peut primer sur RSET selon la hiérarchie',rseeVsRset.rows[0]?.housing_total===24,String(rseeVsRset.rows[0]?.housing_total));

  // v1.1.4 : le vitrage doit ressortir sous forme de composition technique lorsqu'elle existe.
  assert('Vitrage 4/16/4 Argon normalisé',normalizeGlazingType('4/16/4 Argon')==='4.16.4 Ar',String(normalizeGlazingType('4/16/4 Argon')));
  assert('Vitrage 4-16Ar-4 normalisé',normalizeGlazingType('4-16Ar-4')==='4.16.4 Ar',String(normalizeGlazingType('4-16Ar-4')));
  const glazingDoc=mk('Menuiseries extérieures : châssis aluminium, double vitrage 4/16/4 gaz argon, volets roulants',DOC_TYPES.CCTP);
  const glazingParsed=parseDocument(glazingDoc);
  assert('Parseur menuiseries privilégie la composition vitrage',glazingParsed.some(o=>o.field==='window_glazing'&&o.value==='4.16.4 Ar'),JSON.stringify(glazingParsed.filter(o=>o.field==='window_glazing')));

  // v1.1.8 : rapport Bao Evolution / rénovation.
  const baoClass=classifyDocument('Rapport Bao Evolution SED.pdf','ETAT INITIAL : CALCUL du COEFFICIENT UBAT\nEtat après travaux');
  assert('Bao Evolution classé en étude thermique',baoClass.type===DOC_TYPES.THERMAL,baoClass.type);
  const baoBefore=parseDocument(mk('Bao Evolution\nETAT INITIAL : CALCUL du COEFFICIENT UBAT\nTempérature intérieure : 20 °C\nCOEFFICIENT UBAT = 0,428',DOC_TYPES.THERMAL));
  assert('Bao Ubat état initial',baoBefore.some(o=>o.field==='ubat_before'&&Math.abs(o.value-.428)<1e-9),JSON.stringify(baoBefore.filter(o=>/ubat/.test(o.field))));
  assert('Bao Ubat état initial utilise le parseur dédié',baoBefore.some(o=>o.field==='ubat_before'&&o.method==='bao:ubat-before-explicit'),JSON.stringify(baoBefore.filter(o=>/ubat/.test(o.field))));
  assert('Température intérieure Bao jamais confondue avec Tic',!baoBefore.some(o=>o.field==='tic'),JSON.stringify(baoBefore.filter(o=>o.field==='tic')));
  const baoAfter=parseDocument(mk('Bao Evolution\nModification n° 1 : CALCUL du COEFFICIENT UBAT\nEtat après travaux\nCOEFFICIENT UBAT = 0,526',DOC_TYPES.THERMAL));
  assert('Bao Ubat état après travaux',baoAfter.some(o=>o.field==='ubat_after'&&Math.abs(o.value-.526)<1e-9),JSON.stringify(baoAfter.filter(o=>/ubat/.test(o.field))));
  assert('Bao Ubat après travaux utilise le parseur dédié',baoAfter.some(o=>o.field==='ubat_after'&&o.method==='bao:ubat-after-explicit'),JSON.stringify(baoAfter.filter(o=>/ubat/.test(o.field))));
  assert('Bao vitrage Double +15mm normalisé sans invention',normalizeGlazingType('Double +15mm')==='Double vitrage — lame 15 mm',String(normalizeGlazingType('Double +15mm')));


  // v1.1.10 : Bao Evolution — bilan énergétique par poste, GES et garde-fous contextuels.
  const baoEnergyBeforeText=`Bao Evolution
ETAT INITIAL
Système de refroidissement : Sans système de refroidissement
Détails des consommations Energie finale Energie primaire Dépense
CHAUFFAGE
Electricité 2682,51 26,99 0,00
REFROIDISSEMENT 0,00
ECS
Electricité 3979,14 40,04 0,00
ECLAIRAGE 1466,61 14,76 0,00
AUXILIAIRES 168,06 1,69 0,00
VENTILATEURS 1243,92 12,52 0,00
AUTRES USAGES
Electrique 4899,79 49,30
TOTAL 14 440,0 145,3 0,0
Bilan Energétique Bilan CO2
TOTAL MWhEP/an : 37,26 TOTAL (tonnes) : ,953
TOTAL kWhEP/m².an : 145,3 TOTAL (kg/m²) : 3,72`;
  const baoEnergyBefore=parseDocument(mk(baoEnergyBeforeText,DOC_TYPES.THERMAL));
  const baoBeforeCep=baoEnergyBefore.find(o=>o.field==='cep_before'&&o.method==='bao:primary-energy-total-before');
  assert('Bao Cep avant depuis bilan énergie primaire',Math.abs((baoBeforeCep?.value??0)-145.3)<.001,String(baoBeforeCep?.value));
  assert('Bao chauffage/ECS/autres conservés dans le bilan par poste',Math.abs((baoBeforeCep?.baoBreakdown?.heating??0)-26.99)<.001&&Math.abs((baoBeforeCep?.baoBreakdown?.ecs??0)-40.04)<.001&&Math.abs((baoBeforeCep?.baoBreakdown?.other??0)-49.3)<.001,JSON.stringify(baoBeforeCep?.baoBreakdown));
  assert('Bao GES surfacique conservé sans faux mapping DPE/IC',Math.abs((baoBeforeCep?.baoGes?.kgM2??0)-3.72)<.001&&!baoEnergyBefore.some(o=>/^dpe_|^ic_/.test(o.field)),JSON.stringify(baoBeforeCep?.baoGes));
  assert('Bao contrôle somme des postes = total',baoBeforeCep?.baoChecks?.crossOk===true,JSON.stringify(baoBeforeCep?.baoChecks));

  const baoEnergyAfterText=`Bao Evolution
Etat après travaux
Système de refroidissement : Sans système de refroidissement
Détails des consommations Energie finale Energie primaire Dépense
CHAUFFAGE
Electricité 3670,89 36,94 0,00
REFROIDISSEMENT 0,00
ECS
Electricité 3979,14 40,04 0,00
ECLAIRAGE 1466,61 14,76 0,00
AUXILIAIRES 96,75 0,97 0,00
VENTILATEURS 1243,92 12,52 0,00
AUTRES USAGES
Electrique 4899,79 49,30
TOTAL 15 357,1 154,53 0,0
Bilan Energétique Bilan CO2
TOTAL MWhEP/an : 39,62 TOTAL (tonnes) : 1,128
TOTAL kWhEP/m².an : 154,53 TOTAL (kg/m²) : 4,4`;
  const baoEnergyAfter=parseDocument(mk(baoEnergyAfterText,DOC_TYPES.THERMAL));
  const baoAfterCep=baoEnergyAfter.find(o=>o.field==='cep_after_final'&&o.method==='bao:primary-energy-total-after');
  assert('Bao Cep final depuis bilan énergie primaire',Math.abs((baoAfterCep?.value??0)-154.53)<.001,String(baoAfterCep?.value));
  assert('Bao Cep détaillé éclairage/auxiliaires/ventilateurs',baoEnergyAfter.some(o=>o.field==='cep_lighting'&&Math.abs(o.value-14.76)<.001)&&baoEnergyAfter.some(o=>o.field==='cep_aux_dist'&&Math.abs(o.value-.97)<.001)&&baoEnergyAfter.some(o=>o.field==='cep_aux_vent'&&Math.abs(o.value-12.52)<.001),JSON.stringify(baoEnergyAfter.filter(o=>o.method?.startsWith('bao:primary-energy-post'))));
  assert('Bao Cep électricité agrégé quand le bilan est mono-énergie',baoEnergyAfter.some(o=>o.field==='cep_electricity'&&Math.abs(o.value-154.53)<.001),JSON.stringify(baoEnergyAfter.filter(o=>o.field==='cep_electricity')));

  const baoGlazing=parseDocument(mk(`Bao Evolution
Etat après travaux
Modification n° 1 : CATALOGUE DES VITRAGES
FE1 Menuiserie 0.9x1.8 0,90 1,80 Volet Roulant Alu
+15mm
Double`,DOC_TYPES.THERMAL));
  assert('Bao vitrage scindé Double + 15 mm reconstitué',baoGlazing.some(o=>o.field==='window_glazing'&&o.value==='Double vitrage — lame 15 mm'),JSON.stringify(baoGlazing.filter(o=>o.field==='window_glazing')));
  assert('Alu du volet Bao jamais pris pour matériau de menuiserie',!baoGlazing.some(o=>o.field==='window_material'&&o.value==='Aluminium'),JSON.stringify(baoGlazing.filter(o=>o.field==='window_material')));
  const baoOptionList=parseDocument(mk(`Bao Evolution
Etat après travaux
Type de chauffage : Autre (Thermodynamique, Gaz, Fioul, Bois, Réseau,...)`,DOC_TYPES.THERMAL));
  assert('Liste d’exemples Bao jamais interprétée comme vecteur chauffage',!baoOptionList.some(o=>o.field==='heating_vector_after'),JSON.stringify(baoOptionList.filter(o=>o.field==='heating_vector_after')));
  const baoYearRange=parseDocument(mk(`Bao Evolution
Année de construction : Entre 1948 et 1974`,DOC_TYPES.THERMAL));
  assert('Période de construction Bao jamais convertie en année exacte',!baoYearRange.some(o=>o.field==='construction_year'),JSON.stringify(baoYearRange.filter(o=>o.field==='construction_year')));
  const baoCritical=`Détails des consommations Energie finale Energie primaire Dépense\nCHAUFFAGE\nECS\nTOTAL`;
  assert('OCR ciblé sur tableau Bao énergie primaire incomplet',shouldOcrPdfPage(baoCritical,richItems,'auto')===true);
  assert('OCR ciblé sur page Ubat Bao sans valeur reconstruite',shouldOcrPdfPage('Modification n° 1 : CALCUL du COEFFICIENT UBAT\nEtat après travaux',richItems,'auto')===true);
  const baoCollective=parseDocument(mk(`Bao Evolution\nEtude thermique 4 logements Romorantin\nDONNEES TECHNIQUES\nType de bâtiment : Logements collectifs\nBATIMENT : Bâtiment n°1`,DOC_TYPES.THERMAL));
  assert('Bao bâtiment collectif unique -> 1 bâtiment collectif',baoCollective.some(o=>o.field==='housing_collective_buildings'&&o.value===1),JSON.stringify(baoCollective.filter(o=>o.field==='housing_collective_buildings')));
  // v1.1.13 - bibliothèque documentaire stricte / anti-faux-positifs.
  const rtNarrative=mk("Article 7 Respect des exigences\nl - 2° Le Coefficient Bbio du bâtiment est inférieur ou égal au coefficient maximal Bbiomax Conforme\nCoefficient Bbio 53,6 72 25,6\nl - 3° la température Tic est inférieure ou égale à Ticréf Conforme\nZone : Z / Groupe : G 673,8 26 30,8 -4,8 Conforme",DOC_TYPES.RT2012);
  const rtNarrativeParsed=parseDocument(rtNarrative);
  assert('RT2012 : numéro d’article jamais pris pour Bbio',!rtNarrativeParsed.some(o=>o.field==='bbio'&&o.value===2),JSON.stringify(rtNarrativeParsed.filter(o=>o.field==='bbio')));
  assert('RT2012 : tableau Bbio explicite conservé',rtNarrativeParsed.some(o=>o.field==='bbio'&&o.value===53.6),JSON.stringify(rtNarrativeParsed.filter(o=>o.field==='bbio')));
  const betaTicNoise=mk(`Synthese Tic :
Tic Projet TIC Max RT2012
Tic Projet < Tic Max RT2012`,DOC_TYPES.THERMAL);
  const betaTicNoiseParsed=parseDocument(betaTicNoise);
  assert('Journal bêta : RT2012 jamais interprété comme Tic=2012',!betaTicNoiseParsed.some(o=>(o.field==='tic'||o.field==='tic_ref')&&o.value===2012),JSON.stringify(betaTicNoiseParsed.filter(o=>/^tic/.test(o.field))));
  const betaCepHeading=mk(`Récapitulatif Standardisé d'Etude Thermique
Coefficient Cep max du bâtiment -Bat.1
Coefficient Cep 41,30 55,00 24,91`,DOC_TYPES.RT2012);
  const betaCepHeadingParsed=parseDocument(betaCepHeading);
  assert('Journal bêta : identifiant Bât.1 jamais interprété comme Cep',!betaCepHeadingParsed.some(o=>o.field==='cep'&&o.value===1),JSON.stringify(betaCepHeadingParsed.filter(o=>/^cep/.test(o.field))));
  assert('Journal bêta : vraie ligne Cep RT2012 conservée',betaCepHeadingParsed.some(o=>o.field==='cep'&&Math.abs(o.value-41.3)<.001),JSON.stringify(betaCepHeadingParsed.filter(o=>/^cep/.test(o.field))));
  const betaUbatToc=mk(`INDEX
1.6.- Justification du calcul des Coefficients de déperdition par transmission à travers les parois du bâtiment
1.6.1.- Coefficient moyen de déperdition par transmission à travers les parois du bâtiment, Ubât 6
Etat initial`,DOC_TYPES.THERMAL);
  const betaUbatTocParsed=parseDocument(betaUbatToc);
  assert('Journal bêta : numéro de chapitre Ubat jamais interprété comme Ubat avant',!betaUbatTocParsed.some(o=>o.field==='ubat_before'&&o.value===6),JSON.stringify(betaUbatTocParsed.filter(o=>/^ubat/.test(o.field))));
  const dpeRecommendations=mk("DPE NEUF diagnostic de performance énergétique\nProduction d’énergies renouvelables\nD'autres solutions d'énergies renouvelables existent : pompe à chaleur chauffe eau thermodynamique panneaux solaires thermiques chauffage au bois réseau de chaleur vertueux géothermie\nSi climatisation, température recommandée en été -> 28°C",DOC_TYPES.DPE);
  const dpeNoiseParsed=parseDocument(dpeRecommendations);
  assert('DPE : recommandations ENR jamais prises pour installation réelle',!dpeNoiseParsed.some(o=>o.field==='enr'||o.field==='enr_type'),JSON.stringify(dpeNoiseParsed.filter(o=>/^enr/.test(o.field))));
  assert('DPE : recommandation climatisation jamais prise pour refroidissement',!dpeNoiseParsed.some(o=>o.field==='cooling'),JSON.stringify(dpeNoiseParsed.filter(o=>o.field==='cooling')));
  const carbonHeading=mk("Indicateurs principaux, à l'échelle du bâtiment, contribution Composant, par lot\nLOT : 08 - CVC\nIndicateur CO Dynamique kg CO2 39,09",DOC_TYPES.CARBON);
  const carbonHeadingParsed=parseDocument(carbonHeading);
  assert('Carbone : titre LOT 08 jamais pris pour IC lot 8',!carbonHeadingParsed.some(o=>o.field==='ic_lot_8'),JSON.stringify(carbonHeadingParsed.filter(o=>o.field==='ic_lot_8')));
  const carbonExplicit=mk("IC composants lot 8 = 39,09 kg eq.CO2/m²",DOC_TYPES.CARBON);
  assert('Carbone : libellé IC lot explicite accepté',parseDocument(carbonExplicit).some(o=>o.field==='ic_lot_8'&&Math.abs(o.value-39.09)<.001));
  const unroutedDoc={id:'unrouted-test',name:'DPE.pdf',type:DOC_TYPES.DPE,read:{pages:[],text:''},buildings:{names:['Bâtiment A']}};
  const unroutedResult=analyzeDocuments([unroutedDoc],structuredClone(DEFAULT_SOURCE_RULES),'Strict',{},[{field:'cep',value:777,building:'Bâtiment A',docId:'unrouted-test',fileName:'DPE.pdf',docType:DOC_TYPES.DPE,page:1,excerpt:'Cep 777',confidence:.99,method:'test'}]);
  assert('Source non routée : jamais injectée au résultat final',unroutedResult.rows[0]?.cep===undefined,String(unroutedResult.rows[0]?.cep));
  assert('Source non routée : candidate conservée À vérifier',unroutedResult.uncertain.some(o=>o.field==='cep'&&o.value===777),JSON.stringify(unroutedResult.uncertain));
  const ticGroupTable=mk(`ZONE 1 Logement collectif 3790,80
Groupe Refroidissement Categorie Tic Tic Ref.
9 Groupe non refroidi CE1 24,76 30,92`,DOC_TYPES.THERMAL);
  const ticGroupParsed=parseDocument(ticGroupTable);
  assert('Journal bêta v1.1.17 : numéro de groupe ignoré dans tableau Tic',ticGroupParsed.some(o=>o.field==='tic'&&Math.abs(o.value-24.76)<.001)&&!ticGroupParsed.some(o=>o.field==='tic'&&o.value===9),JSON.stringify(ticGroupParsed.filter(o=>/^tic/.test(o.field))));
  assert('Journal bêta v1.1.17 : TicRef appariée à la même ligne',ticGroupParsed.some(o=>o.field==='tic_ref'&&Math.abs(o.value-30.92)<.001),JSON.stringify(ticGroupParsed.filter(o=>/^tic/.test(o.field))));


  return {tests,passed:tests.filter(t=>t.ok).length,total:tests.length,ok:tests.every(t=>t.ok)};
}

/* ---- economics.js ---- */
function moneyValue(v){
  const s=String(v??'').replace(/\u00a0/g,' ').trim();
  if(!s) return null;
  const cleaned=s.replace(/€/g,'').replace(/\s/g,'');
  const n=parseFrNumber(cleaned); return n!==null&&n>=0?n:null;
}
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
      for(const line of totals){ const nums=(line.cells||[]).map(moneyValue).filter(x=>x!==null); if(nums.length){ out.push({label:cleanLotLabel(page.sheet),amount:nums[nums.length-1],confidence:.98,sheet:page.sheet,excerpt:normalizeText(line.text),document:doc.name,page:page.page,docId:doc.id}); } }
    }
  }
  return out;
}
function analyzeEconomicData(docs,operation='',manual={}){
  const candidates=docs.filter(d=>d.status==='ready'&&d.type===DOC_TYPES.DPGF).flatMap(parseDpgfDocument);
  const best=new Map();
  for(const c of candidates){ const key=canonicalLotKey(c.label); const prev=best.get(key); if(!prev||c.confidence>prev.confidence||c.confidence===prev.confidence) best.set(key,c); }
  const lots=[...best.values()].sort((a,b)=>a.label.localeCompare(b.label,'fr',{numeric:true}));
  for(const [label,value] of Object.entries(manual||{})){ const key=canonicalLotKey(label); const existing=lots.find(x=>canonicalLotKey(x.label)===key); if(existing){existing.amount=value;existing.manual=true;existing.confidence=1;} else lots.push({label,amount:value,manual:true,confidence:1,document:'Correction utilisateur',page:'',excerpt:'Valeur économique saisie manuellement'}); }
  const total=lots.reduce((s,x)=>s+(Number(x.amount)||0),0);
  return {operation,lots,total,documents:docs.filter(d=>d.status==='ready'&&d.type===DOC_TYPES.DPGF).map(d=>d.name)};
}

/* ---- exporter.js ---- */
function aoaSheet(rows){ return XLSX.utils.aoa_to_sheet(rows); }
function autoWidth(ws,max=42){ const range=XLSX.utils.decode_range(ws['!ref']||'A1:A1'); const widths=[]; for(let c=range.s.c;c<=range.e.c;c++){ let m=10; for(let r=range.s.r;r<=Math.min(range.e.r,250);r++){ const cell=ws[XLSX.utils.encode_cell({r,c})]; if(cell?.v!=null) m=Math.max(m,String(cell.v).length+2); } widths.push({wch:Math.min(max,m)}); } ws['!cols']=widths; }
function projectTagsText(p){ return (p?.projectTags||[]).map(t=>t?.label).filter(Boolean).join(' ; '); }
function projectName(p,index){ return (p?.customTitle||p?.operationName||p?.result?.operation||p?.label||`Projet ${index+1}`).trim(); }

function exportProjectsExcel(projects,rules){
  if(!globalThis.XLSX) throw new Error('SheetJS non chargé.');
  const usable=(projects||[]).filter(p=>p?.result);
  if(!usable.length) throw new Error('Aucun projet analysé à exporter.');
  const wb=XLSX.utils.book_new();
  const fields=FIELD_DEFS;

  // La feuille principale respecte strictement le schéma métier : 173 colonnes dans l'ordre de référence
  // (les nouvelles colonnes sont toujours ajoutées à la fin), puis la colonne « Tags » du projet.
  const data=[[...fields.map(f=>f.label),'Tags']];
  usable.forEach((p,idx)=>{ const r=p.result, pname=projectName(p,idx); for(const row of r.rows){ data.push(fields.map(f=>{ if(f.key==='building') return row.building??''; if(f.key==='project') return row.project??pname; if(f.key==='operation') return row.operation??r.operation??pname; if(f.key==='operation_name') return row.operation_name??p.operationName??r.operation??''; return row[f.key]??''; }).concat([projectTagsText(p)])); } });
  const ws1=aoaSheet(data); autoWidth(ws1); XLSX.utils.book_append_sheet(wb,ws1,'Données par bâtiment');

  const tr=[['Projet','Opération','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Source','Type document','Page','Confiance','Méthode','Origine','Commentaire','Extrait']];
  usable.forEach((p,idx)=>{ const r=p.result,pname=projectName(p,idx); for(const o of r.finals) tr.push([pname,r.operation||pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,o.fileName,o.docType,o.page,o.confidence,o.method,o.origin||'Document',o.provenanceNote||'',o.excerpt]); });
  const ws2=aoaSheet(tr); autoWidth(ws2); XLSX.utils.book_append_sheet(wb,ws2,'Traçabilité');

  const oc=[['Projet','Bâtiment consolidé','Nom bâtiment source','Donnée','Valeur','Source','Type document','Page','Confiance','Routage','Statut','Motif rejet','Méthode','Origine','Commentaire','Extrait']];
  usable.forEach((p,idx)=>{ const pname=projectName(p,idx); for(const o of p.result.detailed) oc.push([pname,o.building,o.originalBuilding||o.building,FIELD_MAP[o.field]?.label||o.field,o.value,o.fileName,o.docType,o.page,o.confidence,o.sourceTier,o.status,o.rejectionReason||'',o.method,o.origin||'Document',o.provenanceNote||'',o.excerpt]); });
  const ws3=aoaSheet(oc); autoWidth(ws3); XLSX.utils.book_append_sheet(wb,ws3,'Occurrences');

  const bg=[['Projet','Nom détecté','Bâtiment consolidé','Mode de regroupement']];
  usable.forEach((p,idx)=>{ const pname=projectName(p,idx); for(const a of p.result.buildingAliases||[]) bg.push([pname,a.source,a.target,a.mode]); });
  const wsBg=aoaSheet(bg); autoWidth(wsBg); XLSX.utils.book_append_sheet(wb,wsBg,'Regroupement bâtiments');

  const allLotLabels=[]; const seenLots=new Set();
  usable.forEach(p=>{ for(const lot of p.economic?.lots||[]){ if(!seenLots.has(lot.label)){ seenLots.add(lot.label); allLotLabels.push(lot.label); } } });
  if(allLotLabels.length){
    const econ=[['Projet','Opération',...allLotLabels,'Total HT travaux']];
    usable.forEach((p,idx)=>{ const pname=projectName(p,idx), map=new Map((p.economic?.lots||[]).map(x=>[x.label,x.amount])); econ.push([pname,p.economic?.operation||p.result.operation||pname,...allLotLabels.map(l=>map.get(l)??''),p.economic?.total??'']); });
    const wsEco=aoaSheet(econ); autoWidth(wsEco); XLSX.utils.book_append_sheet(wb,wsEco,'Données économiques');
  }

  const rr=[['Donnée','Sources principales','Sources secondaires','Sources interdites']];
  for(const f of FIELD_DEFS){ const r=rules[f.key]; rr.push([f.label,(r?.main||[]).join(' ; '),(r?.secondary||[]).join(' ; '),(r?.forbidden||[]).join(' ; ')]); }
  const ws4=aoaSheet(rr); autoWidth(ws4); XLSX.utils.book_append_sheet(wb,ws4,'Règles sources');

  const totalDocs=usable.reduce((n,p)=>n+(p.result?.documentsCount||0),0), totalBuildings=usable.reduce((n,p)=>n+(p.result?.buildings?.length||0),0), totalFinals=usable.reduce((n,p)=>n+(p.result?.finals?.length||0),0), totalAlerts=usable.reduce((n,p)=>n+(p.result?.alerts?.length||0),0);
  const info=[['Clé','Valeur'],['Application','ExtracTerre'],['Version',APP_VERSION],['Date export',new Date().toLocaleString('fr-FR')],['Projets',usable.length],['Documents',totalDocs],['Bâtiments consolidés',totalBuildings],['Valeurs finales',totalFinals],['Seuil de confiance',`${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`],['Bibliothèque isolants',`${INSULATION_LIBRARY_VARIANT_COUNT} variantes produit/épaisseur/R, dont ${CORE_INSULATION_VARIANT_COUNT} dans les familles cœur demandées`],['Version bibliothèque isolants',INSULATION_LIBRARY_VERSION],['Règle bibliothèque','Valeurs documentaires directes prioritaires ; bibliothèque uniquement en secours avec provenance explicite'],['Alertes',totalAlerts],['Regroupement bâtiments','Variantes évidentes fusionnées automatiquement ; rapprochements ambigus uniquement après validation manuelle'],['Principe','Extraction déterministe locale sans IA']];
  const ws5=aoaSheet(info); autoWidth(ws5); XLSX.utils.book_append_sheet(wb,ws5,'Informations');
  const safe=(usable.length===1?projectName(usable[0],0):'Multi_projets').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80); XLSX.writeFile(wb,`ExtracTerre_${safe}.xlsx`);
}

function exportExcel(result,rules,economic=null){ return exportProjectsExcel([{result,economic,operationName:result?.operation||''}],rules); }

/* ---- persistence.js ---- */
const DB_NAME='extracterre-local-workspace';
const DB_VERSION=2;
const WORKSPACE_STORE='workspaces';
const DOCUMENT_STORE='documents';
const JOURNAL_STORE='learningJournal';
const WORKSPACE_KEY='current';
const SNAPSHOT_SCHEMA=1;

function openDb(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){ reject(new Error('IndexedDB indisponible dans ce navigateur.')); return; }
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(WORKSPACE_STORE)) db.createObjectStore(WORKSPACE_STORE,{keyPath:'key'});
      if(!db.objectStoreNames.contains(DOCUMENT_STORE)){
        const store=db.createObjectStore(DOCUMENT_STORE,{keyPath:'id'});
        store.createIndex('projectId','projectId',{unique:false});
      }
      if(!db.objectStoreNames.contains(JOURNAL_STORE)){
        const journal=db.createObjectStore(JOURNAL_STORE,{keyPath:'id'});
        journal.createIndex('createdAt','createdAt',{unique:false});
        journal.createIndex('syncedAt','syncedAt',{unique:false});
        journal.createIndex('eventType','eventType',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Impossible d’ouvrir la base locale IndexedDB.'));
  });
}

function requestPromise(req){
  return new Promise((resolve,reject)=>{ req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('Erreur IndexedDB.')); });
}
function transactionDone(tx){
  return new Promise((resolve,reject)=>{ tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error||new Error('Transaction IndexedDB impossible.')); tx.onabort=()=>reject(tx.error||new Error('Transaction IndexedDB annulée.')); });
}
function safeJsonClone(value,fallback=null){
  if(value===undefined) return fallback;
  try{return JSON.parse(JSON.stringify(value));}catch{return fallback;}
}
function serializeLine(line={}){
  const out={index:Number.isFinite(line.index)?line.index:0,text:String(line.text||'')};
  if(Array.isArray(line.cells)) out.cells=line.cells.map(v=>v==null?'':String(v));
  if(line.ocr) out.ocr=true;
  return out;
}
function serializeRead(read){
  if(!read) return null;
  const pages=(read.pages||[]).map(page=>{
    const lines=page.lines||[];
    const hasCells=lines.some(line=>Array.isArray(line.cells));
    const base={
      page:page.page,
      ...(page.sheet?{sheet:page.sheet}:{}),
      ...(page.textSource?{textSource:page.textSource}:{}),
      ...(Number.isFinite(page.pdfTextQuality)?{pdfTextQuality:page.pdfTextQuality}:{}),
      ...(Number.isFinite(page.ocrConfidence)?{ocrConfidence:page.ocrConfidence}:{}),
      ...(Number.isFinite(page.re2020Building)?{re2020Building:page.re2020Building}:{}),
    };
    // PDF/XML : une seule chaîne par page suffit pour restaurer la recherche libre et les tags.
    // Excel : conserver les cellules, nécessaires au parseur économique DPGF lors d'une restauration.
    if(hasCells) base.lines=lines.map(serializeLine);
    else base.text=String(page.text||lines.map(l=>String(l.text||'')).join('\n'));
    return base;
  });
  return {kind:read.kind||'',pageCount:Number.isFinite(read.pageCount)?read.pageCount:pages.length,pages,ocr:safeJsonClone(read.ocr,null),...(read.re2020?{re2020:safeJsonClone(read.re2020,null),xmlFormat:read.xmlFormat||'re2020'}:{})};
}
function hydrateRead(read){
  if(!read) return null;
  const pages=(read.pages||[]).map(page=>{
    let lines;
    if(Array.isArray(page.lines)) lines=page.lines.map(line=>({...line,items:[]}));
    else lines=String(page.text||'').split(/\r?\n/).filter(Boolean).map((text,index)=>({index,text,items:[]}));
    const text=String(page.text||lines.map(l=>l.text||'').join('\n'));
    return {...page,text,lines};
  });
  return {...read,pages,text:pages.map(p=>p.text).join('\n\f\n'),retainedCompact:true};
}

function serializeDocMeta(doc={}){
  const hasAnalysis=Array.isArray(doc.cachedOccurrences)||!!doc.read;
  const status=doc.status==='reading'?'missing':(!hasAnalysis&&doc.status==='pending'?'missing':doc.status);
  return {
    id:doc.id,
    name:doc.name||'',
    size:Number(doc.size)||0,
    relativePath:doc.relativePath||doc.name||'',
    type:doc.type||'En attente',
    classification:safeJsonClone(doc.classification,null),
    status:status||'missing',
    error:doc.error||null,
    buildings:safeJsonClone(doc.buildings,null),
    analysisCachedAt:doc.analysisCachedAt||null,
    ocrWarnings:safeJsonClone(doc.ocrWarnings,[]),
    targetedLastAt:doc.targetedLastAt||null,
    targetedLastProposals:Number.isFinite(doc.targetedLastProposals)?doc.targetedLastProposals:null,
    targetedLastOcrPages:Number.isFinite(doc.targetedLastOcrPages)?doc.targetedLastOcrPages:null,
    targetedRejectedKeys:safeJsonClone(doc.targetedRejectedKeys,[]),
    targetedStatus:doc.targetedStatus==='running'?null:(doc.targetedStatus||null),
    processingLocation:doc.processingLocation||null,
    remoteAnalysis:safeJsonClone(doc.remoteAnalysis,null),
    cloudFallback:doc.cloudFallback||null,
    specializedFamily:doc.specializedFamily||'annex',
    specializedLabel:doc.specializedLabel||'',
    families:safeJsonClone(doc.families,null),
    familyMode:doc.familyMode||'auto',
    persistedAnalysis:hasAnalysis
  };
}
function hydrateDocMeta(meta={}){
  return {...meta,file:null,read:null,cachedOccurrences:null,status:meta.status||'missing'};
}

function serializeProject(project={}){
  return {
    id:project.id,
    label:project.label||'Projet',
    customTitle:project.customTitle||'',
    operationName:project.operationName||'',
    docs:(project.docs||[]).map(serializeDocMeta),
    // Le résultat consolidé est recalculé à la restauration depuis les occurrences checkpointées.
    // Ne pas le dupliquer ici évite une copie mémoire potentiellement massive à chaque sauvegarde.
    result:null,
    buildingOverrides:safeJsonClone(project.buildingOverrides,{}),
    deletedBuildings:safeJsonClone(project.deletedBuildings,[]),
    manualTags:safeJsonClone(project.manualTags,[]),
    projectTags:safeJsonClone(project.projectTags,[]),
    manualValues:safeJsonClone(project.manualValues,{}),
    manualSources:safeJsonClone(project.manualSources,{}),
    manualPasteRaw:project.manualPasteRaw||'',
    manualPasteRows:safeJsonClone(project.manualPasteRows,[]),
    manualPasteColumns:safeJsonClone(project.manualPasteColumns,[]),
    retainedOccurrences:safeJsonClone(project.retainedOccurrences,[]),
    uncertainRejectedKeys:safeJsonClone(project.uncertainRejectedKeys,[]),
    manualEconomics:safeJsonClone(project.manualEconomics,{}),
    economic:safeJsonClone(project.economic,null),
    expanded:project.expanded!==false
  };
}

async function saveWorkspaceSnapshot({projects=[],activeProjectId=null,activeTab='summary'}={}){
  const record={
    key:WORKSPACE_KEY,
    schema:SNAPSHOT_SCHEMA,
    appVersion:APP_VERSION,
    savedAt:Date.now(),
    activeProjectId,
    activeTab,
    projects:projects.map(serializeProject)
  };
  const db=await openDb();
  try{
    const tx=db.transaction(WORKSPACE_STORE,'readwrite');
    tx.objectStore(WORKSPACE_STORE).put(record);
    await transactionDone(tx);
  } finally { db.close(); }
  return {savedAt:record.savedAt,projects:record.projects.length};
}

function serializeDocAnalysis(projectId,doc,compact=false,minimal=false){
  return {
    id:doc.id,
    projectId,
    savedAt:Date.now(),
    appVersion:APP_VERSION,
    read:minimal?null:serializeRead(doc.read),
    cachedOccurrences:Array.isArray(doc.cachedOccurrences)?doc.cachedOccurrences:[],
    buildings:safeJsonClone(doc.buildings,null),
    classification:safeJsonClone(doc.classification,null),
    type:doc.type||'En attente',
    specializedFamily:doc.specializedFamily||'annex',
    specializedLabel:doc.specializedLabel||'',
    families:safeJsonClone(doc.families,null),
    familyMode:doc.familyMode||'auto',
    analysisCachedAt:doc.analysisCachedAt||Date.now(),
    storageMode:minimal?'results-only':compact?'compact':'full-index'
  };
}
async function putDocumentRecord(record){
  const db=await openDb();
  try{
    const tx=db.transaction(DOCUMENT_STORE,'readwrite');
    tx.objectStore(DOCUMENT_STORE).put(record);
    await transactionDone(tx);
  } finally { db.close(); }
}
async function saveDocumentCheckpoint(projectId,doc){
  if(!doc?.id) return {saved:false,mode:'none'};
  try{
    // Toujours écrire l'index compact : les objets géométriques PDF.js/OCR ne doivent jamais
    // être clonés vers IndexedDB, car la sérialisation peut doubler brutalement la RAM.
    await putDocumentRecord(serializeDocAnalysis(projectId,doc,true,false));
    return {saved:true,mode:'compact'};
  }catch(err){
    const quota=err?.name==='QuotaExceededError'||/quota/i.test(String(err?.message||''));
    if(!quota) throw err;
    await putDocumentRecord(serializeDocAnalysis(projectId,doc,true,true));
    return {saved:true,mode:'results-only'};
  }
}

async function getDocumentRecord(db,id){
  const tx=db.transaction(DOCUMENT_STORE,'readonly');
  const done=transactionDone(tx);
  const record=await requestPromise(tx.objectStore(DOCUMENT_STORE).get(id));
  await done;
  return record||null;
}
async function loadWorkspaceSnapshot(){
  const db=await openDb();
  try{
    const tx=db.transaction(WORKSPACE_STORE,'readonly');
    const done=transactionDone(tx);
    const record=await requestPromise(tx.objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY));
    await done;
    if(!record||record.schema!==SNAPSHOT_SCHEMA||!Array.isArray(record.projects)) return null;
    const projects=[];
    for(const rawProject of record.projects){
      const project={...rawProject,docs:[]};
      for(const meta of rawProject.docs||[]){
        const doc=hydrateDocMeta(meta);
        if(meta.persistedAnalysis){
          const saved=await getDocumentRecord(db,meta.id);
          if(saved){
            doc.read=hydrateRead(saved.read);
            doc.cachedOccurrences=Array.isArray(saved.cachedOccurrences)?saved.cachedOccurrences:[];
            doc.buildings=saved.buildings||doc.buildings;
            doc.specializedFamily=saved.specializedFamily||doc.specializedFamily||'annex';
            doc.specializedLabel=saved.specializedLabel||doc.specializedLabel||'';
            doc.classification=saved.classification||doc.classification;
            doc.type=saved.type||doc.type;
            doc.analysisCachedAt=saved.analysisCachedAt||doc.analysisCachedAt;
            doc.persistenceMode=saved.storageMode||'full-index';
            doc.status='ready';
          }else if(!doc.result){ doc.status='missing'; }
        }else if(!doc.file){ doc.status='missing'; }
        project.docs.push(doc);
      }
      projects.push(project);
    }
    return {...record,projects};
  } finally { db.close(); }
}

async function deleteDocumentCheckpoint(docId){
  if(!docId) return;
  const db=await openDb();
  try{
    const tx=db.transaction(DOCUMENT_STORE,'readwrite');
    tx.objectStore(DOCUMENT_STORE).delete(docId);
    await transactionDone(tx);
  } finally { db.close(); }
}

async function clearWorkspaceSnapshot(){
  const db=await openDb();
  try{
    const tx=db.transaction([WORKSPACE_STORE,DOCUMENT_STORE],'readwrite');
    tx.objectStore(WORKSPACE_STORE).delete(WORKSPACE_KEY);
    tx.objectStore(DOCUMENT_STORE).clear();
    await transactionDone(tx);
  } finally { db.close(); }
}

async function getWorkspaceStorageInfo(){
  try{
    const estimate=await navigator.storage?.estimate?.();
    const persisted=await navigator.storage?.persisted?.();
    return {supported:true,usage:estimate?.usage||0,quota:estimate?.quota||0,persisted:!!persisted};
  }catch{return {supported:!!globalThis.indexedDB,usage:0,quota:0,persisted:false};}
}

async function requestPersistentStorage(){
  try{return !!(await navigator.storage?.persist?.());}catch{return false;}
}

function makeJournalId(){
  try{return `evt-${Date.now()}-${crypto.randomUUID()}`;}catch{return `evt-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;}
}
function compactJournalPayload(value,depth=0){
  if(depth>5) return '[profondeur limitée]';
  if(value===null||value===undefined) return value??null;
  if(typeof value==='string') return value.length>900?`${value.slice(0,900)}…`:value;
  if(typeof value==='number'||typeof value==='boolean') return value;
  if(Array.isArray(value)) return value.slice(0,220).map(v=>compactJournalPayload(v,depth+1));
  if(typeof value==='object'){
    const out={}; let n=0;
    for(const [k,v] of Object.entries(value)){
      if(++n>120){ out.__truncated=true; break; }
      out[k]=compactJournalPayload(v,depth+1);
    }
    return out;
  }
  return String(value);
}
async function appendLearningEvent(event={}){
  const record={
    id:event.id||makeJournalId(),
    schema:1,
    appVersion:event.appVersion||APP_VERSION,
    createdAt:Number(event.createdAt)||Date.now(),
    eventType:String(event.eventType||'event'),
    projectRef:String(event.projectRef||''),
    instanceId:String(event.instanceId||''),
    accessRole:String(event.accessRole||''),
    payload:compactJournalPayload(event.payload||{}),
    syncedAt:event.syncedAt||null,
    syncError:null
  };
  const db=await openDb();
  try{
    const tx=db.transaction(JOURNAL_STORE,'readwrite');
    tx.objectStore(JOURNAL_STORE).put(record);
    await transactionDone(tx);
  }finally{db.close();}
  return record;
}
async function listLearningEvents({unsyncedOnly=false,limit=50000}={}){
  const db=await openDb();
  try{
    const tx=db.transaction(JOURNAL_STORE,'readonly');
    const done=transactionDone(tx);
    const all=await requestPromise(tx.objectStore(JOURNAL_STORE).getAll());
    await done;
    const rows=(all||[]).filter(x=>!unsyncedOnly||!x.syncedAt).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    return rows.slice(Math.max(0,rows.length-Math.max(1,limit)));
  }finally{db.close();}
}
async function getLearningJournalStats(){
  const events=await listLearningEvents({limit:50000});
  return {
    total:events.length,
    unsynced:events.filter(x=>!x.syncedAt).length,
    firstAt:events[0]?.createdAt||null,
    lastAt:events[events.length-1]?.createdAt||null,
    byType:events.reduce((acc,e)=>(acc[e.eventType]=(acc[e.eventType]||0)+1,acc),{})
  };
}
async function markLearningEventsSynced(ids=[],syncedAt=Date.now()){
  const wanted=new Set(ids||[]); if(!wanted.size) return 0;
  const db=await openDb(); let count=0;
  try{
    const tx=db.transaction(JOURNAL_STORE,'readwrite');
    const store=tx.objectStore(JOURNAL_STORE);
    for(const id of wanted){
      const record=await requestPromise(store.get(id));
      if(record){ record.syncedAt=syncedAt; record.syncError=null; store.put(record); count++; }
    }
    await transactionDone(tx);
  }finally{db.close();}
  return count;
}
async function markLearningEventsSyncError(ids=[],message=''){
  const wanted=new Set(ids||[]); if(!wanted.size) return 0;
  const db=await openDb(); let count=0;
  try{
    const tx=db.transaction(JOURNAL_STORE,'readwrite');
    const store=tx.objectStore(JOURNAL_STORE);
    for(const id of wanted){
      const record=await requestPromise(store.get(id));
      if(record){ record.syncError=String(message||'').slice(0,500); store.put(record); count++; }
    }
    await transactionDone(tx);
  }finally{db.close();}
  return count;
}

/* ---- journal.js ---- */
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
function getRemoteJournalConfig(){
  const base=globalThis.EXTRACTERRE_JOURNAL_CONFIG||{};
  let local={};
  try{ local=JSON.parse(localStorage.getItem(REMOTE_OVERRIDE_KEY)||'{}')||{}; }catch{}
  const supabaseUrl=cleanSupabaseUrl(local.supabaseUrl||base.supabaseUrl||'');
  const supabaseAnonKey=String(local.supabaseAnonKey||base.supabaseAnonKey||'').trim();
  return {supabaseUrl,supabaseAnonKey,configured:!!(supabaseUrl&&supabaseAnonKey)};
}
function saveRemoteJournalConfig(config={}){
  const record={supabaseUrl:cleanSupabaseUrl(config.supabaseUrl),supabaseAnonKey:String(config.supabaseAnonKey||'').trim()};
  localStorage.setItem(REMOTE_OVERRIDE_KEY,JSON.stringify(record));
  return getRemoteJournalConfig();
}
function clearRemoteJournalConfig(){ localStorage.removeItem(REMOTE_OVERRIDE_KEY); return getRemoteJournalConfig(); }
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
async function recordLearningEvent(eventType,payload={},project=null,{sync=true}={}){
  const ctx=accessContext();
  const record=await appendLearningEvent({
    eventType, payload:safeClone(payload,{}), projectRef:projectRef(project), instanceId:getInstanceId(), accessRole:ctx?.role||''
  });
  if(sync) scheduleJournalSync();
  return record;
}
function scheduleJournalSync(delay=1300){
  if(!getRemoteJournalConfig().configured) return;
  if(syncTimer) clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{syncTimer=null;flushLearningJournal().catch(()=>{});},Math.max(100,delay));
}
async function flushLearningJournal(){
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
async function testRemoteJournalConnection(){
  const ctx=accessContext(); if(!ctx?.journalProof) throw new Error('Session d’accès introuvable.');
  const data=await remoteRpc('extracterre_journal_status',{p_proof:ctx.journalProof});
  return data||{ok:true};
}
async function pullRemoteLearningMemoryEvents(){
  const cfg=getRemoteJournalConfig(),ctx=accessContext();
  if(!cfg.configured||!ctx?.journalProof) return {configured:cfg.configured,events:[]};
  try{
    const data=await remoteRpc('extracterre_learning_memory_pull',{p_proof:ctx.journalProof});
    return {configured:true,events:Array.isArray(data)?data:(Array.isArray(data?.events)?data.events:[])};
  }catch(err){
    return {configured:true,events:[],unsupported:true,error:err?.message||String(err)};
  }
}
async function getLearningJournalOverview(){
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
  const byType={},byVersion={},fieldCorrections={},betaReasons={},locationLearning={}; let accepted=0,rejected=0,errors=0,betaErrors=0,betaCorrected=0,totalAnalysisMs=0,analysisDocs=0;
  for(const e of events){
    byType[e.eventType]=(byType[e.eventType]||0)+1; byVersion[e.appVersion]=(byVersion[e.appVersion]||0)+1;
    const p=e.payload||{};
    if(e.eventType==='manual_override'&&p.field) fieldCorrections[p.field]=(fieldCorrections[p.field]||0)+1;
    if(/decision|validation/.test(e.eventType)){ if(p.decision==='accept'||p.accepted===true) accepted++; if(p.decision==='reject'||p.accepted===false) rejected++; }
    if(e.eventType==='analysis_error') errors++;
    if(e.eventType==='beta_result_error'){ betaErrors++; if(p.hasCorrectedValue) betaCorrected++; if(p.reason) betaReasons[p.reason]=(betaReasons[p.reason]||0)+1; if(p.field) fieldCorrections[p.field]=(fieldCorrections[p.field]||0)+1; }
    if(e.eventType==='parser_location_learning'&&p.field){ const k=[p.field,p.docType||'Document'].join('|'); const x=locationLearning[k]||{field:p.field,label:FIELD_MAP[p.field]?.label||p.field,docType:p.docType||'',count:0,pages:{},lineRatios:[]}; x.count++; if(p.page) x.pages[p.page]=(x.pages[p.page]||0)+1; if(Number.isFinite(Number(p.lineRatio))) x.lineRatios.push(Number(p.lineRatio)); locationLearning[k]=x; }
    if(e.eventType==='analysis_document'&&Number.isFinite(Number(p.durationMs))){totalAnalysisMs+=Number(p.durationMs);analysisDocs++;}
  }
  const mostCorrected=Object.entries(fieldCorrections).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([field,count])=>({field,label:FIELD_MAP[field]?.label||field,count}));
  const learnedLocations=Object.values(locationLearning).sort((a,b)=>b.count-a.count).slice(0,100).map(x=>({...x,meanLineRatio:x.lineRatios.length?Math.round(x.lineRatios.reduce((a,b)=>a+b,0)/x.lineRatios.length*1000)/1000:null,lineRatios:undefined}));
  return {events:events.length,byType,byVersion,accepted,rejected,errors,betaErrors,betaCorrected,betaReasons,analysisDocs,meanAnalysisDurationMs:analysisDocs?Math.round(totalAnalysisMs/analysisDocs):null,mostCorrectedFields:mostCorrected,learnedLocations};
}
function pretty(value){ return JSON.stringify(value,null,2); }
function improvementPrompt(summary){
return `# PROMPT — Amélioration continue d’ExtracTerre\n\nJe joins à ce nouveau chat :\n1. le dernier ZIP complet d’ExtracTerre ;\n2. ce pack de journal d’amélioration généré par l’application.\n\n## Mission\n\nAnalyse d’abord le code de la dernière version d’ExtracTerre puis l’intégralité du journal. Utilise les validations, rejets, corrections manuelles, signalements bêta champ par champ, champs manquants, Cribles fins, erreurs et mesures de performance pour produire une nouvelle version réellement meilleure. Les événements beta_result_error et beta_missing_data_location sont des retours propriétaires prioritaires. Les événements parser_location_learning décrivent les endroits exacts surlignés dans les documents : type documentaire, page, position relative, ligne et contexte avant/après. Regroupe-les par champ + type documentaire afin de faire rechercher en priorité les emplacements récurrents, sans jamais créer une valeur absente du document.\n\nLes objectifs sont, dans cet ordre :\n- augmenter la fiabilité des extractions et réduire les faux positifs ;\n- récupérer davantage de données réellement présentes dans les documents sans inventer ;\n- améliorer les parseurs spécialisés, les tags, les normalisations et la hiérarchie de sources à partir des cas observés ;\n- réduire le recours à l’OCR intégral et privilégier lecture structurée puis OCR ciblé ;\n- améliorer la rapidité globale, la consommation mémoire et la stabilité sur de gros lots ;\n- exploiter les corrections récurrentes comme cas de régression permanents ;\n- conserver les comportements qui fonctionnent déjà.\n\n## Contraintes à ne pas casser\n\n- Conserver exactement le schéma métier actuel de 168 colonnes et leur ordre dans l’export Excel, sauf demande explicite contraire de ma part.\n- Ne jamais fabriquer une valeur absente des sources : tolérance d’hallucination = 0.\n- Respecter les priorités de sources configurées par champ.\n- Conserver le système de confiance, les candidats à vérifier et le Crible fin.\n- Conserver le checkpoint IndexedDB, le pool d’analyse borné, la libération mémoire et le journal d’amélioration.\n- Ne jamais mettre les mots de passe en clair dans les fichiers livrés.\n- L’Excel doit continuer à exporter l’ensemble du tableau, même si l’interface répartit les résultats en onglets métier.\n\n## Méthode attendue\n\n1. Établis les statistiques du journal : corrections les plus fréquentes, champs souvent absents, sources/types de documents responsables, faux positifs, validations et temps d’analyse.\n2. Regroupe les problèmes par cause racine plutôt que d’ajouter des rustines document par document.\n3. Modifie les parseurs/dictionnaires/règles nécessaires dans le code de la dernière version jointe.\n4. Pour chaque motif récurrent corrigé, ajoute un test de régression.\n5. Vérifie les tests historiques et les nouveaux tests. Une amélioration ne doit pas faire régresser un cas déjà validé.\n6. Vérifie particulièrement les performances : parsing parallèle borné, OCR ciblé, destruction des ressources PDF/canvas, absence de duplication massive en mémoire.\n7. Mets à jour VERSION, CHANGELOG, README et TESTS.\n8. Livre le ZIP complet de la nouvelle version, pas seulement des fichiers de patch.\n\n## Informations synthétiques du pack\n\n${pretty(summary)}\n\nCommence par analyser les causes récurrentes visibles dans le journal et applique directement les améliorations les plus rentables en efficacité, fiabilité et rapidité.\n`;
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function downloadLearningImprovementPack({packProof='',skipRemote=false}={}){
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
  const betaErrors=events.filter(e=>['beta_result_error','beta_missing_data_location'].includes(e.eventType));
  const learnedLocations=events.filter(e=>e.eventType==='parser_location_learning');
  const decisions=events.filter(e=>['uncertain_decision','targeted_decision','free_search_validation'].includes(e.eventType));
  const performance=events.filter(e=>['analysis_document','analysis_batch','analysis_error'].includes(e.eventType));
  const missing=events.filter(e=>e.eventType==='analysis_batch'&&(e.payload?.missingFields?.length||e.payload?.completeness));
  const errors=events.filter(e=>e.eventType==='analysis_error');
  const zip=new JSZip();
  zip.file('PROMPT_NOUVEAU_CHAT.md',improvementPrompt(summary));
  zip.file('manifest.json',pretty(manifest));
  zip.file('journal_complet.json',pretty(events));
  zip.file('corrections_manuelles.json',pretty(corrections));
  zip.file('erreurs_beta_proprietaire.json',pretty(betaErrors));
  zip.file('apprentissage_emplacements.json',pretty(learnedLocations));
  zip.file('validations_rejets.json',pretty(decisions));
  zip.file('performances.json',pretty(performance));
  zip.file('donnees_manquantes.json',pretty(missing));
  zip.file('erreurs.json',pretty(errors));
  zip.file('README_PACK.md',`# Pack d’amélioration ExtracTerre\n\nCe pack est généré automatiquement depuis le journal d’apprentissage local et, lorsqu’il est configuré, le journal partagé multi-ordinateurs.\n\nIl ne contient pas les PDF originaux. Il contient les événements utiles à l’amélioration du moteur : corrections, validations/rejets, signalements bêta propriétaires champ par champ, surlignages d’emplacements documentaires, résultats de Crible fin, champs manquants, temps d’analyse et erreurs techniques. Le fichier erreurs_beta_proprietaire.json doit être traité en priorité car il contient les faux résultats explicitement signalés avec leur contexte et, lorsque renseignée, la bonne valeur.\n\nPour une nouvelle itération, joignez ce pack et le dernier ZIP complet d’ExtracTerre dans un nouveau chat. Le fichier PROMPT_NOUVEAU_CHAT.md indique la mission à exécuter.\n`);
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  const stamp=now.toISOString().slice(0,10).replaceAll('-','');
  const name=`ExtracTerre_Journal_Amelioration_${stamp}.zip`; downloadBlob(blob,name);
  return {name,manifest};
}

/* ---- cloud.js ---- */
const CLOUD_CONFIG_STORAGE_KEY='extracterre-cloud-config-v2';
const CLOUD_AUTH_STORAGE_KEY='extracterre-cloud-auth-v2';
const CLOUD_EXECUTION_MODE_KEY='extracterre-execution-mode-v2';
const CLOUD_MODES=Object.freeze({
  auto:{key:'auto',label:'Hybride auto',description:'PDF lourds/OCR sur serveur ; petits documents localement'},
  local:{key:'local',label:'Local',description:'Tout analyser sur cet ordinateur'},
  remote:{key:'remote',label:'Serveur',description:'PDF envoyés au worker distant ; autres formats locaux'}
});
let cloudClient=null;

const CLOUD_MAX_CONCURRENCY=1;
let cloudActive=0;
const cloudWaiters=[];
function acquireCloudSlot(signal,onProgress=()=>{}){
  if(cloudActive<CLOUD_MAX_CONCURRENCY){ cloudActive++; return Promise.resolve(()=>releaseCloudSlot()); }
  onProgress(.005,{stage:'cloud-wait',message:'Cloud · attente du créneau gratuit'});
  return new Promise((resolve,reject)=>{
    const waiter={resolve,reject,signal,onAbort:null};
    waiter.onAbort=()=>{
      const i=cloudWaiters.indexOf(waiter); if(i>=0) cloudWaiters.splice(i,1);
      const e=new Error('Analyse distante interrompue.'); e.name='AbortError'; reject(e);
    };
    signal?.addEventListener?.('abort',waiter.onAbort,{once:true});
    cloudWaiters.push(waiter);
  });
}
function releaseCloudSlot(){
  cloudActive=Math.max(0,cloudActive-1);
  while(cloudWaiters.length){
    const waiter=cloudWaiters.shift();
    if(waiter.signal?.aborted) continue;
    waiter.signal?.removeEventListener?.('abort',waiter.onAbort);
    cloudActive++;
    waiter.resolve(()=>releaseCloudSlot());
    break;
  }
}

function defaultCloudConfig(){
  const cfg=globalThis.EXTRACTERRE_CLOUD_CONFIG||{};
  return {
    supabaseUrl:String(cfg.supabaseUrl||'').trim().replace(/\/$/,''),
    supabasePublishableKey:String(cfg.supabasePublishableKey||'').trim(),
    functions:{
      createJob:String(cfg.functions?.createJob||'extracterre-create-job'),
      startJob:String(cfg.functions?.startJob||'extracterre-start-job'),
      jobStatus:String(cfg.functions?.jobStatus||'extracterre-job-status'),
      finishJob:String(cfg.functions?.finishJob||'extracterre-finish-job')
    },
    storageBucket:String(cfg.storageBucket||'extracterre-temp'),
    autoRemoteMinBytes:Number(cfg.autoRemoteMinBytes)||6*1024*1024,
    maxRemoteBytes:Number(cfg.maxRemoteBytes)||700*1024*1024,
    pollIntervalMs:Number(cfg.pollIntervalMs)||1400,
    maxWaitMs:Number(cfg.maxWaitMs)||25*60*1000
  };
}
function getCloudConfig(){
  const base=defaultCloudConfig();
  try{
    const local=JSON.parse(localStorage.getItem(CLOUD_CONFIG_STORAGE_KEY)||'null');
    if(local&&typeof local==='object'){
      if(typeof local.supabaseUrl==='string'&&local.supabaseUrl.trim()) base.supabaseUrl=local.supabaseUrl.trim().replace(/\/$/,'');
      if(typeof local.supabasePublishableKey==='string'&&local.supabasePublishableKey.trim()) base.supabasePublishableKey=local.supabasePublishableKey.trim();
    }
  }catch{}
  return base;
}
function saveCloudConfig({supabaseUrl='',supabasePublishableKey=''}={}){
  const clean={supabaseUrl:String(supabaseUrl||'').trim().replace(/\/$/,''),supabasePublishableKey:String(supabasePublishableKey||'').trim()};
  localStorage.setItem(CLOUD_CONFIG_STORAGE_KEY,JSON.stringify(clean)); cloudClient=null; return getCloudConfig();
}
function resetCloudConfig(){ localStorage.removeItem(CLOUD_CONFIG_STORAGE_KEY); cloudClient=null; return getCloudConfig(); }
function cloudConfigured(){ const c=getCloudConfig(); return /^https:\/\//i.test(c.supabaseUrl)&&/^sb_publishable_/i.test(c.supabasePublishableKey)&&!!globalThis.supabase?.createClient; }
function getCloudClient(){
  if(cloudClient) return cloudClient;
  if(!globalThis.supabase?.createClient) throw new Error('Supabase.js n’est pas chargé. Rechargez la page avec une connexion internet.');
  const c=getCloudConfig();
  if(!c.supabaseUrl||!c.supabasePublishableKey) throw new Error('Configuration Cloud ExtracTerre incomplète.');
  cloudClient=globalThis.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:CLOUD_AUTH_STORAGE_KEY}});
  return cloudClient;
}
async function getCloudSession(){
  if(!cloudConfigured()) return {configured:false,connected:false,user:null,error:null};
  try{
    const client=getCloudClient(); const {data,error}=await client.auth.getSession();
    if(error) return {configured:true,connected:false,user:null,error:error.message};
    const session=data?.session||null; return {configured:true,connected:!!session,user:session?.user||null,error:null};
  }catch(err){ return {configured:true,connected:false,user:null,error:err?.message||String(err)}; }
}
async function cloudSignIn(email,password){
  const client=getCloudClient();
  const {data,error}=await client.auth.signInWithPassword({email:String(email||'').trim(),password:String(password||'')});
  if(error) throw error; return data?.session||null;
}
async function cloudSignOut(){ if(!cloudConfigured()) return; const client=getCloudClient(); const {error}=await client.auth.signOut(); if(error) throw error; }
function getExecutionMode(){ const raw=localStorage.getItem(CLOUD_EXECUTION_MODE_KEY)||'auto'; return CLOUD_MODES[raw]?raw:'auto'; }
function setExecutionMode(mode){ const key=CLOUD_MODES[mode]?mode:'auto'; localStorage.setItem(CLOUD_EXECUTION_MODE_KEY,key); return key; }
function shouldUseCloudForFile(file,mode='auto',ocrMode='auto'){
  if(!file||!/\.pdf$/i.test(file.name||'')) return false;
  const cfg=getCloudConfig(); const size=Number(file.size)||0;
  if(size>cfg.maxRemoteBytes) return false;
  if(mode==='local') return false;
  if(mode==='remote') return true;
  return ocrMode==='always'||size>=cfg.autoRemoteMinBytes;
}
function cloudReasonForFile(file,mode='auto',ocrMode='auto'){
  if(!file||!/\.pdf$/i.test(file.name||'')) return 'format local';
  const cfg=getCloudConfig(),size=Number(file.size)||0;
  if(size>cfg.maxRemoteBytes) return 'taille hors plafond Cloud';
  if(mode==='remote') return 'mode Serveur';
  if(mode==='local') return 'mode Local';
  if(ocrMode==='always') return 'OCR renforcé';
  if(size>=cfg.autoRemoteMinBytes) return `PDF ≥ ${(cfg.autoRemoteMinBytes/1024/1024).toFixed(0)} Mo`;
  return 'PDF léger';
}
function throwIfCloudAborted(signal){ if(signal?.aborted){ const e=new Error('Analyse distante interrompue.'); e.name='AbortError'; throw e; } }
function sleepCloud(ms,signal){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){ const e=new Error('Analyse distante interrompue.'); e.name='AbortError'; reject(e); return; }
    const id=setTimeout(()=>{ signal?.removeEventListener?.('abort',onAbort); resolve(); },ms);
    const onAbort=()=>{ clearTimeout(id); const e=new Error('Analyse distante interrompue.'); e.name='AbortError'; reject(e); };
    signal?.addEventListener?.('abort',onAbort,{once:true});
  });
}
async function invokeCloudFunction(name,body){
  const client=getCloudClient(); const {data,error}=await client.functions.invoke(name,{body});
  if(error){ const msg=error?.context?.body||error?.message||String(error); throw new Error(`Cloud ExtracTerre : ${msg}`); }
  let out=data;
  if(out instanceof Uint8Array||out instanceof ArrayBuffer){ try{out=JSON.parse(new TextDecoder().decode(out));}catch{} }
  if(typeof out==='string'){ try{out=JSON.parse(out);}catch{} }
  if(out?.error&&!out?.ok) throw new Error(out.error);
  return out;
}
async function uploadCloudParts(file,upload,onProgress=()=>{},signal){
  const client=getCloudClient(); const bucket=getCloudConfig().storageBucket;
  const parts=Array.isArray(upload?.parts)&&upload.parts.length?upload.parts:[upload];
  const total=Math.max(1,Number(file.size)||1); let uploaded=0;
  for(let i=0;i<parts.length;i++){
    throwIfCloudAborted(signal); const part=parts[i];
    if(!part?.path||!part?.token) throw new Error('Autorisation d’upload Cloud incomplète.');
    const start=Number.isFinite(part.start)?part.start:uploaded;
    const end=Number.isFinite(part.end)?part.end:Math.min(file.size,start+(Number(part.size)||file.size));
    const blob=file.slice(start,end,'application/octet-stream');
    const {error}=await client.storage.from(bucket).uploadToSignedUrl(part.path,part.token,blob,{contentType:parts.length===1?'application/pdf':'application/octet-stream'});
    if(error) throw error;
    uploaded=end; onProgress(Math.min(.28,.03+.25*(uploaded/total)),{stage:'cloud-upload',message:`Cloud · envoi ${i+1}/${parts.length}`});
  }
  return parts.length;
}
async function fetchCloudRead(url,compression='gzip',signal){
  throwIfCloudAborted(signal); const response=await fetch(url,{cache:'no-store',signal});
  if(!response.ok) throw new Error(`Téléchargement index distant impossible (HTTP ${response.status}).`);
  if(compression==='gzip'){
    if(typeof DecompressionStream!=='function') throw new Error('Ce navigateur ne sait pas décompresser le résultat Cloud. Utilisez Chrome/Edge récent ou le mode Local.');
    const stream=response.body.pipeThrough(new DecompressionStream('gzip')); const text=await new Response(stream).text(); return JSON.parse(text);
  }
  return response.json();
}
async function analyzePdfInCloud(file,{ocrMode='auto',onProgress=()=>{},signal}={}){
  if(!/\.pdf$/i.test(file?.name||'')) throw new Error('Le Cloud v2.1 traite uniquement les PDF ; XML/Excel restent locaux.');
  const releaseCloud=await acquireCloudSlot(signal,onProgress);
  try{
  const cfg=getCloudConfig();
  if((Number(file.size)||0)>cfg.maxRemoteBytes) throw new Error(`PDF trop volumineux pour le quota Cloud configuré (${Math.round(cfg.maxRemoteBytes/1024/1024)} Mo max).`);
  const session=await getCloudSession(); if(!session.connected) throw new Error('Connexion Cloud requise. Ouvrez « Cloud » et connectez votre compte Supabase.');
  throwIfCloudAborted(signal); onProgress(.01,{stage:'cloud-create',message:'Cloud · création du job'});
  const created=await invokeCloudFunction(cfg.functions.createJob,{originalFilename:file.name,fileSize:file.size,options:{ocrMode,clientVersion:typeof APP_VERSION==='string'?APP_VERSION:'2.1'}});
  if(!created?.ok||!created?.job?.id) throw new Error(created?.error||'Création du job Cloud impossible.');
  const jobId=created.job.id; let started=false;
  try{
    const partCount=await uploadCloudParts(file,created.upload,onProgress,signal);
    throwIfCloudAborted(signal); onProgress(.30,{stage:'cloud-queue',message:'Cloud · mise en file GitHub'});
    const start=await invokeCloudFunction(cfg.functions.startJob,{jobId});
    if(!start?.ok) throw new Error(start?.error||'Démarrage du worker impossible.'); started=true;
    const begun=Date.now(); let lastStatus='queued';
    while(Date.now()-begun<cfg.maxWaitMs){
      throwIfCloudAborted(signal);
      const status=await invokeCloudFunction(cfg.functions.jobStatus,{jobId});
      if(!status?.ok) throw new Error(status?.error||'État Cloud indisponible.');
      lastStatus=status.status||lastStatus;
      if(lastStatus==='queued') onProgress(.34,{stage:'cloud-queued',message:'Cloud · worker en attente'});
      else if(lastStatus==='processing') onProgress(.38,{stage:'cloud-processing',message:'Cloud · PDF/OCR sur GitHub'});
      else if(lastStatus==='error') throw new Error(status.errorMessage||'Le worker distant a échoué.');
      else if(lastStatus==='cancelled') throw new Error('Job Cloud annulé.');
      else if(lastStatus==='completed'){
        if(!status.readUrl){ throw new Error('Le worker a terminé mais aucun index documentaire v2.1 n’a été retourné. Mettez à jour extracterre-worker avec le pack V2.1.'); }
        onProgress(.78,{stage:'cloud-download',message:'Cloud · récupération de l’index'});
        const read=await fetchCloudRead(status.readUrl,status.readCompression||'gzip',signal);
        if(!read?.pages||!Array.isArray(read.pages)) throw new Error('Index documentaire Cloud invalide.');
        onProgress(.86,{stage:'cloud-done',message:'Cloud · lecture distante terminée'});
        try{ await invokeCloudFunction(cfg.functions.finishJob,{jobId}); }catch(err){ console.warn('Nettoyage Cloud différé',err); }
        return {read,cloud:{jobId,partCount,status:'completed',worker:status.result?.worker||'github-actions',workerVersion:status.result?.workerVersion||'',durationMs:Date.now()-begun,result:status.result||{}}};
      }
      await sleepCloud(cfg.pollIntervalMs,signal);
    }
    throw new Error('Le worker Cloud n’a pas terminé dans le délai maximal autorisé.');
  }catch(err){
    if(started) console.warn(`Job Cloud ${jobId} interrompu côté client`,err);
    throw err;
  }
  } finally { releaseCloud(); }
}

// v2.3 — appel générique d'une Edge Function avec la session Cloud courante (utilisé par l'assistance IA).
async function invokeLlmCloudFunction(name,body){
  if(!cloudConfigured()) throw new Error('Cloud Supabase non configuré.');
  const client=getCloudClient();
  const {data:sess}=await client.auth.getSession();
  if(!sess?.session) throw new Error('Connectez-vous au compte Cloud pour utiliser l’assistance IA serveur.');
  const {data,error}=await client.functions.invoke(name,{body});
  if(error){ let detail=error.message||String(error); try{ const j=await error.context?.json?.(); if(j?.error) detail=j.error; }catch{} throw new Error(detail); }
  return data;
}

/* ---- llm-assist.js ---- */
// ExtracTerre v2.3 — assistance IA en secours, avec vérification littérale.
// Règles non négociables :
//  1. le modèle ne propose que des champs autorisés pour la famille du document et absents du tableau ;
//  2. chaque proposition doit citer un extrait qui figure MOT POUR MOT dans la page indiquée ;
//  3. la valeur doit apparaître dans cet extrait ;
//  4. une proposition acceptée plafonne à 85 % : elle ne remplit jamais le tableau seule et passe
//     obligatoirement par la validation ✓ / ✕ (même fenêtre que le Crible fin).




const LLM_CONFIG_KEY='extracterre.llm.v1';
const LLM_DIRECT_KEY_PREFIX='extracterre.llm.directKey.';
const LLM_CONSENT_KEY='extracterre.llm.consent.v1';
const LLM_PROVIDERS=Object.freeze({
  openai:{label:'ChatGPT (OpenAI)',defaultModel:'gpt-5.4-mini',keyHint:'sk-…',endpoint:'https://api.openai.com/v1/chat/completions'},
  gemini:{label:'Gemini (Google)',defaultModel:'gemini-3.5-flash',keyHint:'AIza…',endpoint:'https://generativelanguage.googleapis.com/v1beta/models'},
  anthropic:{label:'Claude (Anthropic)',defaultModel:'claude-sonnet-5-5',keyHint:'sk-ant-…',endpoint:'https://api.anthropic.com/v1/messages'}
});
const LLM_DEFAULT_PROVIDER='openai';
const LLM_MAX_CONFIDENCE=0.85;
const LLM_DEFAULT_MODEL=LLM_PROVIDERS[LLM_DEFAULT_PROVIDER].defaultModel;
const LLM_MODES=Object.freeze({off:'Désactivée',edge:'Serveur ExtracTerre (Edge Function Supabase)',direct:'Clé API personnelle (cette session uniquement)'});

function getLlmConfig(){
  let c={}; try{ c=JSON.parse(localStorage.getItem(LLM_CONFIG_KEY)||'{}')||{}; }catch{}
  const provider=LLM_PROVIDERS[c.provider]?c.provider:LLM_DEFAULT_PROVIDER;
  return {mode:LLM_MODES[c.mode]?c.mode:'off',provider,model:String(c.model||LLM_PROVIDERS[provider].defaultModel),maxPages:Math.max(1,Math.min(12,Number(c.maxPages)||6))};
}
function saveLlmConfig(cfg={}){ const cur=getLlmConfig(); const next={...cur,...cfg}; if(!LLM_PROVIDERS[next.provider]) next.provider=LLM_DEFAULT_PROVIDER; try{ localStorage.setItem(LLM_CONFIG_KEY,JSON.stringify({mode:next.mode,provider:next.provider,model:next.model,maxPages:next.maxPages})); }catch{} return getLlmConfig(); }
// Une clé par fournisseur, en sessionStorage uniquement (effacée à la fermeture de l'onglet).
function setLlmDirectKey(key,provider=getLlmConfig().provider){ try{ const k=LLM_DIRECT_KEY_PREFIX+provider; if(key) sessionStorage.setItem(k,String(key).trim()); else sessionStorage.removeItem(k); }catch{} }
function llmHasDirectKey(provider=getLlmConfig().provider){ return !!llmDirectKey(provider); }
function llmDirectKey(provider){ try{ return sessionStorage.getItem(LLM_DIRECT_KEY_PREFIX+provider)||''; }catch{ return ''; } }
function llmConsentGiven(){ try{ return localStorage.getItem(LLM_CONSENT_KEY)==='1'; }catch{ return false; } }
function setLlmConsent(v){ try{ if(v) localStorage.setItem(LLM_CONSENT_KEY,'1'); else localStorage.removeItem(LLM_CONSENT_KEY); }catch{} }

// Champs que l'IA peut chercher pour ce document : autorisés par sa/ses famille(s) et encore vides.
function llmCandidateFields(doc,missingFields=null){
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
function selectPagesForLlm(doc,fields,maxPages=6,maxChars=6000){
  const pages=(doc.read?.pages||[]).map(p=>({page:p.page,text:p.text||(p.lines||[]).map(l=>l.text).join('\n')})).filter(p=>p.text.trim());
  let scored=pages.map(p=>({...p,score:llmPageScore(p,fields)})).filter(p=>p.score>0);
  // Petit document sans correspondance de vocabulaire : on envoie ses premières pages plutôt que rien.
  if(!scored.length&&pages.length<=maxPages) scored=pages.map(p=>({...p,score:0}));
  return scored.sort((a,b)=>b.score-a.score||a.page-b.page).slice(0,maxPages).sort((a,b)=>a.page-b.page).map(p=>({page:p.page,text:p.text.slice(0,maxChars)}));
}

function buildLlmRequest(doc,fields,pages,{model=LLM_DEFAULT_MODEL,provider=LLM_DEFAULT_PROVIDER}={}){
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

function parseLlmJson(text){
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
function verifyLlmProposal(doc,p,allowedFields,{model=''}={}){
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
function providerHttpRequest(request,key){
  const p=request.provider||LLM_DEFAULT_PROVIDER, user=request.messages?.[0]?.content||'';
  if(p==='openai') return {url:LLM_PROVIDERS.openai.endpoint,init:{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${key}`},body:JSON.stringify({model:request.model,max_completion_tokens:request.max_tokens||2000,response_format:{type:'json_object'},messages:[{role:'system',content:request.system},{role:'user',content:user}]})}};
  if(p==='gemini') return {url:`${LLM_PROVIDERS.gemini.endpoint}/${encodeURIComponent(request.model)}:generateContent`,init:{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:request.system}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:request.max_tokens||2000,temperature:0}})}};
  if(p==='anthropic') return {url:LLM_PROVIDERS.anthropic.endpoint,init:{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:request.model,max_tokens:request.max_tokens||2000,system:request.system,messages:request.messages})}};
  throw new Error(`Fournisseur IA inconnu : ${p}`);
}
function providerResponseText(provider,data){
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
async function runLlmAssist(doc,{missingFields=null,config=null,fetchImpl=null,invokeFunction=null}={}){
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

/* ---- app.js ---- */
function createProject(index=1){ return {id:`project-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label:`Projet ${index}`,customTitle:'',operationName:'',docs:[],result:null,buildingOverrides:{},deletedBuildings:[],manualTags:[],projectTags:[],manualValues:{},manualSources:{},manualPasteRaw:'',manualPasteRows:[],manualPasteColumns:[],retainedOccurrences:[],uncertainRejectedKeys:[],manualEconomics:{},economic:null,resultView:'generic',expanded:true}; }
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
  generic:{label:'Données générales',groups:[
    {title:'Administration',families:['Administration']},
    {title:'Projet & programme',families:['Programme']},
    {title:'Référentiel & contexte',keys:['reference_name','reference_version','mentions','performance','selected_profile','built_before_1948','built_after_1948','renovation','anru_zone','no_mention','environmental_performance','specific_profile']},
    {title:'Mentions, labels & dérogations',keys:['mention_building_performance','mention_bee_plus','mention_tfpb','mention_ec','derogation_ec','mention_bbca','derogation_bbca','mention_neutrality_contribution','mention_effinergie','effinergie_energy_carbon_level','mention_biosourced_building','derogation_biosourced','mention_habitat_quality','mention_charge_assessment','mention_buildability_bonus','mention_air_quality','mention_acoustic','mention_circular_economy','mention_eu_taxonomy','mention_zero_carbon','mention_biodiversity']},
    {title:'Niveaux de certification',keys:['dpe_ges_label','energy_level','passive_level','cep_level','cepnr_level','bbio_level','ic_construction_level','ic_energy_level','enhanced_performance','biosourced_2013']}
  ]},
  thermal:{label:'Thermique',groups:[
    {title:'Confort d’été',keys:['dh','dh_max','tic','tic_ref','cross_ventilated','non_cross_ventilated','fan_count','fan_type']},
    {title:'Systèmes & énergies',keys:['heating_vector_before','heating_vector_after','heating_mode_after','ecs_vector_before','ecs_vector_after','ecs','cooling','ventilation','enr','enr_type']},
    {title:'Performance réglementaire',keys:['bbio','bbio_max','bbio_gain','cep','cep_max','cep_gain','cepnr','cepnr_max','cepnr_gain']},
    {title:'Rénovation — avant / après',keys:['ubat_before','ubat_after','cep_before','cep_after_final','dpe_energy_before','dpe_ges_before','dpe_energy_after','dpe_ges_after']},
    {title:'Consommations par poste / énergie',keys:['cep_cooling','cep_lighting','cep_aux_vent','cep_aux_dist','cep_mobility','cep_electricity','cep_gas','cep_district','cep_biomass']}
  ]},
  carbon:{label:'Carbone',groups:[
    {title:'IC composants & chantier',keys:['ic_components','ic_site','stock_c_per_m2','ic_lot_1','ic_lot_2','ic_lot_3','ic_lot_4','ic_lot_5','ic_lot_6','ic_lot_7','ic_lot_8','ic_lot_9','ic_lot_10','ic_lot_11','ic_lot_12','ic_lot_13']},
    {title:'IC construction & seuils',keys:['ic_construction','ic_construction_max','ic_construction_max_2028','ic_energy_max','ic_energy_max_2028']},
    {title:'IC énergie',keys:['ic_energy','ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility']}
  ]},
  envelope:{label:'Structure & enveloppe',groups:[
    {title:'Structure & isolation',keys:['structure','roof_structure','roof_insulation','roof_insulation_thickness','roof_insulation_r','wall_structure','wall_insulation','wall_insulation_thickness','wall_insulation_r','floor_structure','floor_insulation','floor_insulation_thickness','floor_insulation_r']},
    {title:'Menuiseries',keys:['window_material','window_glazing','window_shading']}
  ]}
});
const RESULT_VIEW_ALIASES=Object.freeze({thermalNew:'thermal',thermalReno:'thermal',carbonNew:'carbon',carbonReno:'carbon'});
function normalizedResultViewKey(key){ return RESULT_VIEW_ALIASES[key]||key||'generic'; }
function currentResultView(){ const p=activeProject(); const key=normalizedResultViewKey(p.resultView); if(p.resultView!==key) p.resultView=key; return RESULT_VIEWS[key]||RESULT_VIEWS.generic; }
function fieldsForResultGroup(group){
  if(group.keys) return group.keys.map(k=>FIELD_MAP[k]).filter(Boolean);
  const families=new Set(group.families||[]); return FIELD_DEFS.filter(f=>f.key!=='building'&&families.has(f.family));
}
function fieldsForCurrentResultView(){ return [...new Map(currentResultView().groups.flatMap(fieldsForResultGroup).map(f=>[f.key,f])).values()]; }
function syncResultTabs(){ const key=normalizedResultViewKey(activeProject().resultView); $$('.result-tab').forEach(b=>b.classList.toggle('active',b.dataset.resultView===key)); }
function syncStickyResultTabs(){ const key=normalizedResultViewKey(activeProject().resultView); $$('.sticky-result-tab').forEach(b=>b.classList.toggle('active',b.dataset.stickyResultView===key)); const ov=$('#stickyOverviewBtn'); if(ov) ov.classList.toggle('active',state.resultWorkspaceMode==='overview'); }
function projectResultStats(p){ const r=p?.result; return {docs:(p?.docs||[]).length,buildings:r?.rows?.length||0,values:r?.finals?.length||0,candidates:(r?.uncertain||[]).filter(o=>!Object.prototype.hasOwnProperty.call(p.manualValues||{},`${o.building}|${o.field}`)&&!(p.uncertainRejectedKeys||[]).includes(uncertainKey(o))).length,alerts:r?.alerts?.length||0}; }
function renderResultNavigator(){
  const nav=$('#resultNavigator'); if(!nav) return;
  const hasAny=state.projects.some(p=>(p.docs||[]).length||p.result); nav.hidden=!hasAny;
  if(!hasAny){ nav.innerHTML=''; return; }
  nav.innerHTML=`<div class="result-nav-head"><strong>Projets</strong><span class="result-nav-count">${state.projects.length}</span></div><div class="result-quick-drop" id="resultQuickDrop"><small>Déposer d’autres pièces</small><div class="result-quick-actions"><label for="fileInput">＋ Fichiers</label><label for="folderInput">▱ Dossier</label></div></div><div class="result-project-list">${state.projects.map(p=>{const st=projectResultStats(p);return `<button class="result-project-item ${p.id===state.activeProjectId&&state.resultWorkspaceMode==='detail'?'active':''}" data-result-project="${p.id}" type="button" title="${escapeHtml(projectTitle(p))}"><strong>${escapeHtml(projectTitle(p))}</strong><small>${st.docs} doc · ${st.buildings} bât. · ${st.values} valeurs</small><span class="nav-alert ${st.alerts?'':'ok'}">${st.alerts||'✓'}</span></button>`;}).join('')}</div>`;
  $$('#resultNavigator [data-result-project]').forEach(b=>b.onclick=()=>activateProject(b.dataset.resultProject));
  const q=$('#resultQuickDrop'); if(q){ for(const ev of ['dragenter','dragover']) q.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();q.classList.add('drag');}); q.addEventListener('dragleave',e=>{e.preventDefault();e.stopPropagation();if(!q.contains(e.relatedTarget)) q.classList.remove('drag');}); q.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();q.classList.remove('drag');try{const fs=await filesFromDrop(e.dataTransfer);if(fs?.length)addFiles(fs);}catch(err){toast(`Import impossible : ${err?.message||err}`,'error');}}); }
}
function renderResultWorkspaceControls(){
  const sel=$('#stickyProjectSelect'); if(sel){ sel.innerHTML=state.projects.map(p=>`<option value="${p.id}" ${p.id===state.activeProjectId?'selected':''}>${escapeHtml(projectTitle(p))}</option>`).join(''); }
  const i=Math.max(0,state.projects.findIndex(p=>p.id===state.activeProjectId)); const prev=$('#stickyPrevProject'),next=$('#stickyNextProject'); if(prev) prev.disabled=i<=0; if(next) next.disabled=i>=state.projects.length-1;
  const sticky=$('#resultStickyBar'); if(sticky) sticky.hidden=!state.projects.some(p=>(p.docs||[]).length||p.result);
  syncStickyResultTabs(); renderResultNavigator();
}
function showProjectsOverview(){ state.resultWorkspaceMode='overview'; switchTab('summary'); renderSummary(); renderResultWorkspaceControls(); scheduleWorkspaceCheckpoint('vue synthèse'); }
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

function addFiles(fileList,specializedFamily=null,opts={}){
  const allowed=/\.(pdf|xml|xlsx?|xls)$/i; let added=0,rehydrated=0;
  for(const file of fileList){
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
    state.docs.push(rec); added++;
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
function activateProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; activeProject().operationName=$('#operationName').value.trim(); state.activeProjectId=id; state.resultWorkspaceMode='detail'; if(!p.result) rebuildProjectFromCheckpoints(p); p.expanded=true; syncProjectInput(); switchTab('summary'); renderAll(); scheduleWorkspaceCheckpoint('projet actif'); }
function toggleProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; p.expanded=!p.expanded; renderSummary(); scheduleWorkspaceCheckpoint('affichage projet'); }
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
  $('#manualDataPaste').value=state.manualPasteRaw||''; renderManualPastePreview(parseManualClipboard(state.manualPasteRaw||'')); dlg.showModal();
}
function renderManualPastePreview(parsed){
  const box=$('#manualDataPreview'); if(!box) return;
  if(!parsed.recognized){ box.innerHTML='<div class="empty-small">Collez au minimum une ligne d’en-têtes puis une ligne de données.</div>'; return; }
  const recognized=parsed.columns.filter(c=>c.def).map(c=>({label:c.def.label,mode:c.matchMode||'exact'}));
  const flexible=recognized.filter(x=>x.mode!=='exact').length;
  box.innerHTML=`<div class="manual-preview-stats"><span><b>${parsed.recognized}</b> colonne(s) reconnue(s)</span>${flexible?`<span><b>${flexible}</b> rapprochement(s) souple(s)</span>`:''}<span><b>${parsed.rows.length}</b> ligne(s) de données</span>${parsed.unrecognized.length?`<span class="warn"><b>${parsed.unrecognized.length}</b> en-tête(s) non reconnu(s)</span>`:''}</div><div class="manual-chip-wrap">${recognized.slice(0,28).map(x=>`<span title="${x.mode==='exact'?'Intitulé exact':'Intitulé rapproché automatiquement'}">${escapeHtml(x.label)}${x.mode==='exact'?'':' ≈'}</span>`).join('')}${recognized.length>28?`<span>+${recognized.length-28}</span>`:''}</div>${parsed.unrecognized.length?`<small>Non reconnus (aucun équivalent existant suffisamment fiable) : ${escapeHtml(parsed.unrecognized.join(' · '))}</small>`:''}`;
}
function applyManualPaste(){
  const raw=$('#manualDataPaste')?.value||''; const parsed=parseManualClipboard(raw);
  if(!parsed.recognized||!parsed.rows.length){ toast('Aucune ligne de données exploitable. Vérifiez les en-têtes et collez au moins une ligne de valeurs.','warn'); renderManualPastePreview(parsed); return; }
  state.manualPasteRaw=raw; state.manualPasteRows=parsed.rows; state.manualPasteColumns=parsed.columns.map(c=>({header:c.header,key:c.def?.key||null,matchMode:c.matchMode||''}));
  // Si le nom de l'opération est fourni manuellement et que le champ Projet actuel est vide, on le reprend comme titre de travail.
  const first=parsed.rows[0]?.values||{}; if(!$('#operationName').value.trim()&&(first.operation_name||first.operation)){ const op=String(first.operation_name||first.operation); $('#operationName').value=op; activeProject().operationName=op; }
  $('#manualDataDialog')?.close();
  learn('manual_paste',{rows:parsed.rows.length,recognizedColumns:parsed.columns.filter(c=>c.def).map(c=>({header:c.header,field:c.def.key,label:c.def.label,matchMode:c.matchMode||'exact',matchScore:c.matchScore||1})),unrecognizedHeaders:parsed.unrecognized||[]},activeProject());
  recomputeProject(`${parsed.rows.length} ligne(s) manuelle(s) intégrée(s) · ${parsed.recognized} colonne(s) reconnue(s).`);
}
function clearManualPaste(){
  state.manualPasteRaw=''; state.manualPasteRows=[]; state.manualPasteColumns=[]; const ta=$('#manualDataPaste'); if(ta) ta.value=''; renderManualPastePreview({rows:[],columns:[],unrecognized:[],recognized:0}); if(state.result) recomputeProject('Données manuelles copiées-collées supprimées.');
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
  const r=state.result; const wrap=$('#summaryView'); const view=currentResultView(); const groups=view.groups.map(g=>({...g,fields:fieldsForResultGroup(g)})).filter(g=>g.fields.length); const fields=fieldsForCurrentResultView(); syncResultTabs(); syncStickyResultTabs();
  if(state.resultWorkspaceMode==='overview'){ const rows=state.projects.map(p=>({p,st:projectResultStats(p)})); wrap.innerHTML=`<div class="result-overview"><div class="result-overview-intro"><div><h3>Synthèse des projets</h3><p>Un projet à la fois en détail ; toutes les informations restent disponibles dans sa fiche.</p></div><span class="badge doc">${rows.length} projet(s)</span></div><div class="table-scroll result-overview-table"><table><thead><tr><th>Projet</th><th>Documents</th><th>Bâtiments</th><th>Valeurs retenues</th><th>Candidats</th><th>Alertes</th><th></th></tr></thead><tbody>${rows.map(({p,st})=>`<tr><td class="result-overview-title">${escapeHtml(projectTitle(p))}</td><td>${st.docs}</td><td>${st.buildings}</td><td class="overview-metric-ok">${st.values}</td><td class="${st.candidates?'overview-metric-warn':''}">${st.candidates}</td><td class="${st.alerts?'overview-metric-warn':'overview-metric-ok'}">${st.alerts||'✓'}</td><td><button class="overview-open" data-overview-open="${p.id}">Ouvrir</button></td></tr>`).join('')}</tbody></table></div></div>`; $$('#summaryView [data-overview-open]').forEach(b=>b.onclick=()=>activateProject(b.dataset.overviewOpen)); renderResultWorkspaceControls(); return; }
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


let betaLearningSelection=null;
const betaPdfPreviewState={docId:'',pdf:null,loadingTask:null,renderTask:null,pageNo:1,mode:'native',renderToken:0,ocrWorker:null,ocrWords:[],viewport:null};

const MANUAL_ANALYSIS_SECTIONS={
  general:{label:'Généralités',families:new Set(['Administration','Programme','Certification & exigences'])},
  thermal:{label:'Thermique',families:new Set(['Performance énergétique','Confort d’été','Systèmes','DPE','ENR'])},
  carbon:{label:'Carbone',families:new Set(['Carbone'])},
  envelope:{label:'Enveloppe',families:new Set(['Enveloppe'])}
};
let manualAnalysisState={building:'',section:'general',field:''};
function manualAnalysisMode(){ return $('#betaErrorDialog')?.dataset.mode==='manual'; }
function manualAnalysisBuildings(){
  const fromResult=(state.result?.rows||[]).map(r=>r.building).filter(Boolean);
  if(fromResult.length)return unique(fromResult);
  const fromDocs=state.docs.flatMap(d=>d.buildings?.names||[]).filter(Boolean);
  return unique(fromDocs.length?fromDocs:['Bâtiment unique']);
}
function manualAnalysisFields(section=manualAnalysisState.section){
  const cfg=MANUAL_ANALYSIS_SECTIONS[section]||MANUAL_ANALYSIS_SECTIONS.general;
  return FIELD_DEFS.filter(f=>f.key!=='building'&&cfg.families.has(f.family));
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
  if(fb)fb.innerHTML=fields.map(f=>{const v=manualAnalysisCurrentValue(manualAnalysisState.building,f.key),filled=v!==undefined&&v!==null&&v!=='';return `<button type="button" class="manual-field-btn ${manualAnalysisState.field===f.key?'active':''} ${filled?'filled':''}" data-field="${f.key}"><span>${escapeHtml(f.label)}</span><strong>${filled?escapeHtml(formatValue(v)):'À renseigner'}</strong></button>`;}).join('')||'<div class="empty-small">Aucun champ dans cette famille.</div>';
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
  fb?.querySelectorAll('.manual-field-btn').forEach(b=>b.onclick=()=>{manualAnalysisState.field=b.dataset.field||'';renderManualAnalysisSidebar();const feedback=$('#manualAnalysisFeedback');if(feedback){const d=FIELD_MAP[manualAnalysisState.field];feedback.textContent=d?`Prêt : surlignez « ${d.label} » dans le document ou saisissez directement la bonne valeur.`:'';feedback.className='manual-analysis-feedback';}setTimeout(()=>$('#manualDirectValue')?.select?.(),0);});
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
  if(feedback){feedback.textContent=`✓ ${def.label} = ${formatValue(value)} · ${building}${manualEntry?' · saisie manuelle':''}`;feedback.className='manual-analysis-feedback ok';}
  return true;
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
  manualAnalysisState={building:manualAnalysisBuildings()[0]||'Bâtiment unique',section:'general',field:''};
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
}
function applyManualValues(){ applyManualValuesToProject(activeProject()); }
function rebuildProjectFromCheckpoints(project){
  const valid=(project.docs||[]).filter(d=>d.status==='ready'&&Array.isArray(d.cachedOccurrences));
  if(!valid.length&&!(project.manualPasteRows||[]).length&&!hasRetainedData(project)){ project.result=null; return; }
  project.result=analyzeDocuments(valid,state.rules,project.operationName||'',project.buildingOverrides||{},manualPasteOccurrences(project));
  applyDeletedBuildings(project); project.result.documentsCount=valid.length; applyManualValuesToProject(project);
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


function updateUxMirrors(){ const manualCount=$('#manualDataCount'); if(manualCount) manualCount.textContent=String(state.manualPasteRows.length); const docs=$('#projectMirrorDocs'); if(docs) docs.textContent=String(state.docs.length); const r=state.result; const values=$('#projectMirrorValues'); if(values) values.textContent=String(r?.finals?.length||0); const buildings=$('#projectMirrorBuildings'); if(buildings) buildings.textContent=String(r?.buildings?.length||r?.rows?.length||0); const alerts=$('#projectMirrorAlerts'); if(alerts) alerts.textContent=String(r?.alerts?.length||0); const status=$('#projectMirrorStatus'); if(status) status.textContent=$('#statusText')?.textContent||'Prêt'; }
function renderAll(){ renderFiles(); renderSummary(); renderResultWorkspaceControls(); renderOccurrences(); renderDiagnostics(); renderEconomic(); if(state.activeTab==='rules') renderRules(); $('#exportBtn').disabled=!state.projects.some(p=>p.result); const pending=state.docs.filter(d=>!!d.file&&!Array.isArray(d.cachedOccurrences)&&!['error','timeout'].includes(d.status)).length; const missing=state.docs.filter(d=>!d.file&&!Array.isArray(d.cachedOccurrences)&&d.status==='missing').length; const manualRows=state.manualPasteRows.length; const timedOut=state.docs.filter(d=>d.status==='timeout').length; $('#analyzeBtn').textContent=state.result?(pending?`▶ Analyser ${pending} nouveau${pending>1?'x':''} document${pending>1?'s':''} et compléter`:'↻ Recalculer la consolidation'):(manualRows?'▶ Consolider les données manuelles':missing&&!pending?`＋ Redéposer ${missing} fichier${missing>1?'s':''}`:'▶ Lancer l’analyse'); if(timedOut&&!pending&&state.result) $('#analyzeBtn').textContent='↻ Recalculer la consolidation'; $('#analyzeBtn').disabled=!state.result&&!pending&&!manualRows&&missing>0; updateUxMirrors(); }
function switchTab(name){ state.activeTab=name; $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); $$('.view').forEach(v=>v.hidden=v.id!==`${name}Panel`); const resultTabs=$('#resultTabsWrap'); if(resultTabs) resultTabs.hidden=name!=='summary'; const rulesWrap=$('#rulesActionWrap'); if(rulesWrap) rulesWrap.hidden=name!=='rules'; if(name==='rules') renderRules(); if(name==='economics') renderEconomic(); scheduleWorkspaceCheckpoint('onglet actif'); }

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
    <p class="llm-warning"><strong>Confidentialité :</strong> les pages du document qui mentionnent les champs manquants (texte uniquement, ${cfg.maxPages} pages max.) sont envoyées au modèle. N’activez pas cette fonction pour des pièces que le client n’autorise pas à transmettre à un service tiers.</p>
    <div class="llm-grid">
      <label>Mode<select id="llmMode">${Object.entries(LLM_MODES).map(([k,l])=>`<option value="${k}" ${k===cfg.mode?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select></label>
      <label>Fournisseur<select id="llmProvider">${Object.entries(LLM_PROVIDERS).map(([k,p])=>`<option value="${k}" ${k===cfg.provider?'selected':''}>${escapeHtml(p.label)}</option>`).join('')}</select></label>
      <label>Modèle<input id="llmModel" value="${escapeHtml(cfg.model)}" spellcheck="false"></label>
      <label>Pages max. envoyées<input id="llmMaxPages" type="number" min="1" max="12" value="${cfg.maxPages}"></label>
    </div>
    <small class="llm-hint">Le modèle est modifiable : saisissez l’identifiant exact proposé par le fournisseur.</small>
    <label id="llmKeyWrap"><span>Clé API <span id="llmKeyProvider"></span> — conservée pour cette session seulement</span><input id="llmKey" type="password" autocomplete="off"><small id="llmKeyState" class="llm-hint"></small></label>
    <label class="llm-consent"><input id="llmConsent" type="checkbox" ${llmConsentGiven()?'checked':''}> <span>J’ai compris que le texte des pages sélectionnées est transmis au modèle et que chaque proposition devra être validée.</span></label>
  </div>
  <footer class="llm-foot"><button value="cancel" class="btn light" type="submit">Annuler</button><button id="llmSave" value="default" class="btn primary" type="submit">Enregistrer</button></footer></form>`;
  let lastProvider=cfg.provider;
  const sync=()=>{ const prov=$('#llmProvider').value, p=LLM_PROVIDERS[prov];
    $('#llmKeyWrap').hidden=$('#llmMode').value!=='direct';
    $('#llmKeyProvider').textContent=p.label; $('#llmKey').placeholder=p.keyHint;
    $('#llmKeyState').textContent=llmHasDirectKey(prov)?'Une clé est déjà enregistrée pour cette session (laisser vide pour la conserver).':'Aucune clé enregistrée pour cette session.';
    // Changement de fournisseur : on propose son modèle par défaut si l'utilisateur n'a pas personnalisé le champ.
    if(prov!==lastProvider){ const cur=$('#llmModel').value.trim(); if(!cur||cur===LLM_PROVIDERS[lastProvider]?.defaultModel) $('#llmModel').value=p.defaultModel; lastProvider=prov; } };
  $('#llmMode').onchange=sync; $('#llmProvider').onchange=sync; sync();
  $('#llmSave').onclick=e=>{ e.preventDefault(); const mode=$('#llmMode').value; const consent=$('#llmConsent').checked;
    if(mode!=='off'&&!consent){ toast('Cochez la case de consentement pour activer l’assistance IA.','warn'); return; }
    const provider=$('#llmProvider').value;
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
  $('#analyzeBtn').onclick=()=>analyze(); const manualAnalysisBtn=$('#manualAnalysisBtn'); if(manualAnalysisBtn) manualAnalysisBtn.onclick=openManualAnalysisDialog; const manualOpen=$('#manualDataBtn'); if(manualOpen) manualOpen.onclick=openManualDataDialog; const manualPaste=$('#manualDataPaste'); if(manualPaste) manualPaste.oninput=()=>renderManualPastePreview(parseManualClipboard(manualPaste.value)); const manualApply=$('#manualDataApply'); if(manualApply) manualApply.onclick=applyManualPaste; const manualClear=$('#manualDataClear'); if(manualClear) manualClear.onclick=clearManualPaste; const manualClose=$('#manualDataClose'); if(manualClose) manualClose.onclick=()=>$('#manualDataDialog')?.close(); const previewDlg=$('#filePreviewDialog'); const previewClose=$('#filePreviewClose'); if(previewClose) previewClose.onclick=()=>previewDlg?.close(); if(previewDlg){ previewDlg.addEventListener('close',closeFilePreview); previewDlg.addEventListener('cancel',()=>setTimeout(closeFilePreview,0)); } $('#newProjectBtn').onclick=addNewProject; const lockBtn=$('#lockBtn'); if(lockBtn) lockBtn.onclick=async()=>{ try{await checkpointWorkspace('verrouillage',true);await syncLearningJournalNow(false);}catch{} globalThis.__lockExtracterre?.(); }; $('#clearBtn').onclick=async()=>{ if(!confirm('Effacer la session locale ExtracTerre ? Les résultats et checkpoints du projet seront supprimés. Le journal d’amélioration et les règles de sources seront conservés.')) return; try{await clearWorkspaceSnapshot();}catch(err){toast(`Impossible d’effacer complètement la sauvegarde locale : ${err?.message||err}`,'warn');} state.projects=[createProject(1)];state.activeProjectId=state.projects[0].id;syncProjectInput();renderAll();lastLocalSaveAt=null;setLocalSaveUi('Session vide',null);await refreshJournalUi();toast('Session locale effacée. Le journal d’amélioration est conservé.','success');};
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
  $('#exportBtn').onclick=()=>{try{exportProjectsExcel(state.projects,state.rules);}catch(e){toast(e.message,'error');}};
  $$('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab)); $$('.result-tab').forEach(b=>b.onclick=()=>{ state.resultWorkspaceMode='detail'; activeProject().resultView=b.dataset.resultView||'generic'; syncResultTabs(); renderSummary(); scheduleWorkspaceCheckpoint('onglet résultat'); }); $$('.sticky-result-tab').forEach(b=>b.onclick=()=>{state.resultWorkspaceMode='detail';activeProject().resultView=b.dataset.stickyResultView||'generic';switchTab('summary');renderSummary();scheduleWorkspaceCheckpoint('onglet résultat sticky');}); const stickyOverview=$('#stickyOverviewBtn'); if(stickyOverview) stickyOverview.onclick=showProjectsOverview; const stickySelect=$('#stickyProjectSelect'); if(stickySelect) stickySelect.onchange=()=>activateProject(stickySelect.value); const stickyPrev=$('#stickyPrevProject'); if(stickyPrev) stickyPrev.onclick=()=>moveProject(-1); const stickyNext=$('#stickyNextProject'); if(stickyNext) stickyNext.onclick=()=>moveProject(1); const stickyAnalyze=$('#stickyAnalyzeBtn'); if(stickyAnalyze) stickyAnalyze.onclick=()=>$('#analyzeBtn')?.click();
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
  syncProjectInput(); renderAll(); switchTab(state.activeTab||'summary'); refreshLocalStorageInfo(); await refreshCloudUi(false); await refreshJournalUi(); await renderLearningMemoryUi(); if(getRemoteJournalConfig().configured) syncLearningJournalNow(false); window.__prestaterreExtractReady=true;
}
initializeApp();

})();
