/* ExtracTerre bundled runtime v2.1.1 - compatible file:// and GitHub Pages */
(function(){
'use strict';

/* ---- config.js ---- */
const APP_VERSION = '2.1.0';
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
  {key:"enr_type",label:"ENR type",family:"ENR",type:"text",tags:["ENR type", "type ENR", "type d’énergie renouvelable", "type énergie renouvelable"] ,presence:false}
];
const FIELD_MAP = Object.fromEntries(FIELD_DEFS.map(f=>[f.key,f]));
const FIELD_TAGS = Object.fromEntries(FIELD_DEFS.map(f=>[f.key,[...f.tags]]));
const FAMILIES = [...new Set(FIELD_DEFS.map(f=>f.family))];

function normalizeFieldHeader(value=''){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/[^a-zA-Z0-9+&/,.-]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
}
const HEADER_LOOKUP=new Map();
for(const f of FIELD_DEFS) for(const tag of f.tags){ const n=normalizeFieldHeader(tag); if(n&&!HEADER_LOOKUP.has(n)) HEADER_LOOKUP.set(n,f.key); }
function matchFieldByHeader(header=''){ const key=HEADER_LOOKUP.get(normalizeFieldHeader(header)); return key?FIELD_MAP[key]:null; }

const SOURCE_ADMIN=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.DESIGN_REPORT,DOC_TYPES.MANUAL];
const SOURCE_CERT=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.REQUIREMENTS,DOC_TYPES.ENV_REPORT,DOC_TYPES.MANUAL];
const SOURCE_LEVELS=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.ENV_REPORT,DOC_TYPES.REQUIREMENTS,DOC_TYPES.MANUAL];
const SOURCE_PROGRAM=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.PROJECT_DESCRIPTION,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL];
const SOURCE_PROJECT_META=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.PLAN,DOC_TYPES.NOTICE,DOC_TYPES.MANUAL];
const SOURCE_ENVELOPE=[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.THERMAL,DOC_TYPES.CCTP,DOC_TYPES.DPGF,DOC_TYPES.MANUAL];
const SOURCE_SYSTEMS=[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.CCTP,DOC_TYPES.DPGF,DOC_TYPES.DIAGNOSTIC,DOC_TYPES.MANUAL];
const SOURCE_UBAT_CEP=[DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.MANUAL];
const SOURCE_ENR=[DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSENV,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.MANUAL];
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
for(const key of ['dh','dh_max']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RSENV,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL]);
for(const key of ['tic','tic_ref']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RT2012,DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL]);
for(const key of ['cross_ventilated','non_cross_ventilated','fan_count','fan_type']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.PLAN,DOC_TYPES.CCTP,DOC_TYPES.MANUAL],[DOC_TYPES.NOTICE]);
for(const key of ['bbio','bbio_max','bbio_gain','cep','cep_max','cep_gain','cepnr','cepnr_max','cepnr_gain']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL],[DOC_TYPES.RSENV,DOC_TYPES.RT_EXISTING,DOC_TYPES.CARBON,DOC_TYPES.DIAGNOSTIC]);
for(const key of ['cep_cooling','cep_lighting','cep_aux_vent','cep_aux_dist','cep_mobility','cep_electricity','cep_gas','cep_district','cep_biomass']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSENV,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.MANUAL],[DOC_TYPES.DIAGNOSTIC]);
for(const key of ['ic_components','ic_site','ic_lot_1','ic_lot_2','ic_lot_3','ic_lot_4','ic_lot_5','ic_lot_6','ic_lot_7','ic_lot_8','ic_lot_9','ic_lot_10','ic_lot_11','ic_lot_12','ic_lot_13','ic_energy','ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.CARBON,DOC_TYPES.RSET_RE2020,DOC_TYPES.MANUAL],[DOC_TYPES.THERMAL]);
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
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u00a0/g,' ').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
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
  if (/rt\s*(?:existant|existante|ex|reno)|r[eé]glementation\s+thermique\s+existante|th[- ]?c(?:e|ex)\s*ex|th[- ]?cex|thcex|r[eé]novation\s+thermique/i.test(n+' '+t)) add(DOC_TYPES.RT_EXISTING,/r[eé]glementation\s+thermique\s+existante/i.test(t)?30:18);
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
  const enriched=items.map((it,idx)=>({text:it.str||'',x:it.transform?.[4]||0,y:it.transform?.[5]||0,w:it.width||0,idx})).filter(i=>i.text.trim());
  enriched.sort((a,b)=>Math.abs(b.y-a.y)>yTolerance?b.y-a.y:a.x-b.x);
  // Parcours linéaire après tri. L'ancienne version faisait lines.find() pour chaque item,
  // soit un coût quadratique sur les pages PDF très denses.
  const lines=[]; let current=null;
  for(const item of enriched){
    if(!current || Math.abs(current.y-item.y)>yTolerance){
      current={y:item.y,items:[]}; lines.push(current);
    }
    current.items.push(item);
  }
  return lines.map((line,index)=>{
    line.items.sort((a,b)=>a.x-b.x);
    let text=''; let prev=null;
    for(const it of line.items){ if(prev){ const gap=it.x-(prev.x+prev.w); if(gap>2) text+=' '; } text+=it.text; prev=it; }
    return {index,text:normalizeText(text),items:line.items.map(it=>({text:it.text,x:it.x}))};
  }).filter(l=>l.text);
}

function ocrTextToLines(text=''){
  return String(text||'').split(/\r?\n/).map(normalizeText).filter(Boolean).map((text,index)=>({index,y:null,text,items:[],ocr:true}));
}

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
  return {lines:[...pdfLines,...extra.map((l,i)=>({...l,index:pdfLines.length+i}))],source:extra.length?'hybrid':'pdf'};
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
              const ret=await worker.recognize(canvas);
              throwIfAborted(opts.signal);
              const ocrText=String(ret?.data?.text||'');
              ocrConfidence=Number.isFinite(ret?.data?.confidence)?ret.data.confidence:null;
              const ocrLines=ocrTextToLines(ocrText);
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
    for(const key of Object.keys(page)) if(!['page','sheet','text','lines','textSource','pdfTextQuality','ocrConfidence'].includes(key)) delete page[key];
  }
  read.text=String(read.text||(read.pages||[]).map(p=>p.text||'').join('\n\f\n'));
  read.pageCount=Number.isFinite(read.pageCount)?read.pageCount:(read.pages||[]).length;
  read.retainedCompact=true;
  return read;
}

async function readXml(file){
  const text=await file.text(); const parser=new DOMParser(); const xml=parser.parseFromString(text,'application/xml');
  if(xml.querySelector('parsererror')) throw new Error('XML illisible ou invalide.');
  const rows=[]; let idx=0;
  const walk=(node,path=[])=>{
    for(const child of node.children||[]){ const p=[...path,child.tagName]; const value=(child.children.length===0?child.textContent:'').trim(); if(value) rows.push(`${p.join(' > ')} = ${value}`); walk(child,p); }
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
    if(ELEMENT_PATTERNS.window.test(ctx)){ const materialCtx=ctx.replace(/volets?\s+roulants?\s+(?:alu(?:minium)?|pvc|bois)/ig,' ').replace(/fermeture\s*:?\s*(?:alu(?:minium)?|pvc|bois)/ig,' '); const wm=findFirstMatch(materialCtx,WINDOW_MATERIALS); const glazingEvidence=/(?:simple|double|triple)\s+(?:vitrage|verre)|\bdouble\s*\+?\s*\d{1,2}(?:[,.]\d+)?\s*mm\b|\d{1,2}\s*(?:\/|-)\s*\d{1,2}(?:\s*(?:ar(?:gon)?|kr(?:ypton)?|air))?\s*(?:\/|-)\s*\d{1,2}|\d{1,2}\.\d{1,2}\.\d{1,2}/i.test(ctx); const gl=glazingEvidence?(normalizeGlazingType(ctx)||findFirstMatch(ctx,GLAZINGS)):null; let sh=findFirstMatch(base,SHADINGS); if(!sh && !/sans\s+protection|sans\s+occultation/i.test(ctx)) sh=findFirstMatch(ctx,SHADINGS); if(wm) push(out,occ(doc,page,line,'window_material',wm,'windows:material-context',0.89,'',{excerpt:ctx.slice(0,420)})); if(gl) push(out,occ(doc,page,line,'window_glazing',gl,'windows:glazing-context',0.90,'',{excerpt:ctx.slice(0,420)})); if(sh) push(out,occ(doc,page,line,'window_shading',sh,'windows:shading-context',0.90,'',{excerpt:ctx.slice(0,420)})); }
  }} return out;
}

function parseSystems(doc){
  const out=[]; let inheritedPhase='unknown';
  for(const page of doc.read.pages){ const lines=page.lines||[]; const explicitPagePhase=phaseFromContext(page.text||'',doc); if(explicitPagePhase!=='unknown') inheritedPhase=explicitPagePhase; const pagePhase=inheritedPhase; const resolvedPhase=ctx=>{ const p=phaseFromContext(ctx,doc); return p==='unknown'?pagePhase:p; }; for(let i=0;i<lines.length;i++){
    const line=lines[i], base=normalizeText(line.text), next=normalizeText(lines[i+1]?.text||''); const baseLow=normLower(base); const envInventoryNoise=/(?:\binies\b|fiche\s+de\s+donn[eé]es\s+environnementales|mise\s+[aà]\s+disposition\s+d['’]?un\s+kwh|impact\s+environnemental|contribution\s+composant)/i.test(baseLow);
    const makeCtx=(kindRe,matcher)=>{ if(!kindRe.test(baseLow)) return null; if(matcher(base)) return base; return normalizeText(`${base} | ${next}`); };

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

function parseDpe(doc){
  const out=[]; const name=normLower(doc.name);
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){
    const line=lines[i], ctx=normalizeText(lineWindow(page,i,1,2)), low=normLower(ctx);
    if(!/dpe|classe\s+(?:energie|energetique|énergie|énergétique|ges|climat)|etiquette\s+(?:energie|énergie|climat)|performance\s+energetique|performance\s+énergétique/i.test(low)) continue;
    const narrative=/(?:classe\s+[a-g]\s+minimum|etiquette\s+[a-g]\s*\(|doivent?\s+parvenir|passoires?|crit[eè]res?|eco[- ]?pret|éco[- ]?prêt|sup[eé]rieur|inf[eé]rieur|peuvent?\s+b[eé]n[eé]ficier|obligation\s+de\s+r[eé]sultat)/i.test(low);
    const explicitSection=doc.type===DOC_TYPES.DPE||/(?:[eé]tiquettes?\s+(?:[eé]tat|sc[eé]nario)|dpe\s+(?:avant|apr[eè]s)|classe\s+(?:energie|énergie|ges)\s+(?:avant|apr[eè]s))/i.test(low);
    if(narrative||!explicitSection) continue;
    const explicit=ctx.match(/(?:classe|etiquette|étiquette)\s*(?:dpe\s*)?(?:energie|énergie|energetique|énergétique|climat|ges)?\s*[:=\-]?\s*([A-G])\b/i)||ctx.match(/\b(?:energie|énergie|energetique|énergétique|ges|climat)\s*[:=\-]\s*([A-G])\b/i); if(!explicit) continue;
    const letter=explicit[1].toUpperCase(), ges=/ges|climat|gaz\s+a\s+effet|gaz\s+à\s+effet/i.test(low), before=/avant|initial|existant|audit/.test(normLower(`${name} ${ctx}`)), after=/apres|après|final|reception|réception|post[- ]travaux|scenario|scénario|projet/.test(normLower(`${name} ${ctx}`));
    // Un DPE neuf/final isolé est une donnée après travaux/finale.
    const finalAfter=after||(doc.type===DOC_TYPES.DPE&&!before&&/(?:\bneuf\b|dpe[-_ ]?2021)/i.test(normLower(`${name} ${page.text||''}`)));
    if(!before&&!finalAfter) continue;
    const field=finalAfter?(ges?'dpe_ges_after':'dpe_energy_after'):(ges?'dpe_ges_before':'dpe_energy_before'); push(out,occ(doc,page,line,field,letter,'dpe:explicit-class-phase',0.96,'',{excerpt:ctx.slice(0,420)}));
  }} return out;
}

function parseCarbon(doc){
  const out=[]; const mappings=[
    ['ic_energy_heating',/ic\s*[eé]nergie[^|]{0,45}chauffage/i],['ic_energy_cooling',/ic\s*[eé]nergie[^|]{0,45}(?:refroid|froid)/i],['ic_energy_ecs',/ic\s*[eé]nergie[^|]{0,45}(?:ecs|eau\s+chaude)/i],
    ['ic_energy_aux_vent',/ic\s*[eé]nergie[^|]{0,60}auxiliaires?[^|]{0,25}ventil/i],['ic_energy_aux_dist',/ic\s*[eé]nergie[^|]{0,60}auxiliaires?[^|]{0,25}distribution/i],['ic_energy_mobility',/ic\s*[eé]nergie[^|]{0,60}(?:deplacements?|déplacements?|ascenseurs?|escalators?|parking)/i],
    ['ic_components',/ic\s*composants?(?:\s+batiment)?/i],['ic_site',/ic\s*chantier/i],['ic_energy',/ic\s*[eé]nergie(?:\s+batiment)?/i]
  ];
  for(const page of doc.read.pages){ const lines=page.lines||[]; for(let i=0;i<lines.length;i++){ const line=lines[i], raw=normalizeText(line.text||''), ctx=normalizeText(lineWindow(page,i,1,2));
    // Une occurrence carbone générique doit porter elle-même le libellé ET une valeur.
    // Les titres de chapitres, n° de lot et tableaux d'autres indicateurs ne sont jamais utilisés ici.
    const strongCarrier=/kg\s*(?:eq|éq)?\.?\s*co2|kgco2|[:=]/i.test(raw);
    if(strongCarrier){
      for(const [f,re] of mappings){
        if(!re.test(raw)) continue;
        const v=firstValueAfterLabel(raw,re);
        if(v!==null) push(out,occ(doc,page,line,f,v,'carbon:explicit-label',0.94,'kgCO2e/m²',{excerpt:ctx.slice(0,420)}));
      }
    }
    // Forme autorisée : « IC composants lot 8 = 39,09 ». Un simple « LOT : 08 - CVC » est un titre.
    const lot=raw.match(/ic\s+composants?\s+lot\s*(1[0-3]|[1-9])\s*(?:[:=|-])\s*([-+]?\d+(?:[,.]\d+)?)/i);
    if(lot){ const v=parseFrNumber(lot[2]); if(v!==null) push(out,occ(doc,page,line,`ic_lot_${lot[1]}`,v,'carbon:explicit-lot-label',0.96,'kgCO2e/m²',{excerpt:ctx.slice(0,420)})); }
  }} return out;
}


// Dictionnaire central des 167 colonnes ExtracTerre.
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
// Index de tags précompilé : auparavant chaque ligne de chaque PDF reparcourait les 167 champs,
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

function parseDocument(doc){
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
  return Math.min(1,text*.72+page*.12+ratio*.16);
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
    const probe={field:s.field,docType:s.docType,page:s.page,lineRatio:s.lineRatio,anchor:anchorText(s),tokens:anchorTokens(anchorText(s))};
    let best=null,bestScore=0;
    for(const p of groups){const score=locationSimilarity(probe,p);if(score>bestScore){best=p;bestScore=score;}}
    if(!best||bestScore<.52){
      best={id:`profile-${groups.length+1}`,seedId:s.id,field:s.field,docType:s.docType,anchor:probe.anchor,tokens:probe.tokens,page:Number(s.page)||null,lineRatio:Number.isFinite(Number(s.lineRatio))?Number(s.lineRatio):null,confirmations:0,rejections:0,lastAt:0,samples:[],disabled:false}; groups.push(best);
    }
    if(s.polarity==='negative') best.rejections++; else best.confirmations++;
    best.lastAt=Math.max(best.lastAt,Number(s.createdAt)||0); if(best.samples.length<5) best.samples.push({page:s.page,lineText:s.lineText,selectedText:s.selectedText,polarity:s.polarity||'positive'});
    if(s.polarity!=='negative' && bestScore>=.52){ best.anchor=probe.anchor||best.anchor; best.tokens=probe.tokens.length?probe.tokens:best.tokens; if(Number.isFinite(Number(s.page))) best.page=Number(s.page); if(Number.isFinite(Number(s.lineRatio))) best.lineRatio=Number(s.lineRatio); }
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
  const signal={id:String(meta.eventId||makeId()),createdAt:Number(meta.createdAt)||Date.now(),polarity:'positive',field:String(meta.field||location.field||''),docType:String(meta.docType||location.docType||''),document:String(location.document||meta.document||''),page:Number(location.page)||null,pageRatio:Number.isFinite(Number(location.pageRatio))?Number(location.pageRatio):null,lineIndex:Number.isFinite(Number(location.lineIndex))?Number(location.lineIndex):null,lineRatio:Number.isFinite(Number(location.lineRatio))?Number(location.lineRatio):null,lineText:safe(location.lineText),beforeLine:safe(location.beforeLine),afterLine:safe(location.afterLine),selectedText:safe(location.selectedText),building:String(meta.building||''),source:'user-highlight'};
  if(!signal.field||!signal.docType) return null; if(cache.signals.has(signal.id)) return signal; await putSignal(signal); cache.signals.set(signal.id,signal); rebuildProfiles(); return signal;
}
async function penalizeLearningLocation(location={},meta={}){
  const signal={id:String(meta.eventId||makeId()),createdAt:Number(meta.createdAt)||Date.now(),polarity:'negative',field:String(meta.field||location.field||''),docType:String(meta.docType||location.docType||''),document:String(location.document||meta.document||''),page:Number(location.page)||null,lineRatio:Number.isFinite(Number(location.lineRatio))?Number(location.lineRatio):null,lineText:safe(location.lineText||meta.lineText),beforeLine:safe(location.beforeLine),afterLine:safe(location.afterLine),selectedText:safe(location.selectedText||meta.selectedText),building:String(meta.building||''),source:'user-rejection'};
  if(!signal.field||!signal.docType) return null; if(cache.signals.has(signal.id)) return signal; await putSignal(signal); cache.signals.set(signal.id,signal); rebuildProfiles(); return signal;
}
function applyLearningBoosts(raw=[]){
  if(!cache.ready||!cache.profiles.length) return raw;
  return raw.map(o=>{
    if(!o?.field||!o?.docType||o.userValidated) return o;
    const probe={field:o.field,docType:o.docType,page:o.page,lineRatio:o.lineRatio,anchor:safe(o.excerpt||o.lineText||''),tokens:anchorTokens(o.excerpt||o.lineText||'')};
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

/* ---- engine.js ---- */
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
  // des 167 champs et chacun des bâtiments. Avec plusieurs centaines de dossiers cela pouvait
  // bloquer le thread principal plusieurs secondes.
  const byFieldBuilding=new Map();
  for(const o of occurrences){
    const key=`${o.field}|${o.building||'Bâtiment unique'}`;
    const list=byFieldBuilding.get(key); if(list) list.push(o); else byFieldBuilding.set(key,[o]);
  }
  const candidatesFor=(field,building)=>{
    const exact=byFieldBuilding.get(`${field}|${building}`)||[];
    if(building==='Bâtiment unique') return exact;
    const global=byFieldBuilding.get(`${field}|Bâtiment unique`)||[];
    return global.length?exact.concat(global):exact;
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
        const ar=Number.isFinite(a.sourceRank)?a.sourceRank:sourceRank(f.key,a.docType,rules), br=Number.isFinite(b.sourceRank)?b.sourceRank:sourceRank(f.key,b.docType,rules);
        if(ar!==br) return ar-br;
        const ah=Number.isFinite(a.hierarchyRank)?a.hierarchyRank:50, bh=Number.isFinite(b.hierarchyRank)?b.hierarchyRank:50;
        if(ah!==bh) return ah-bh;
        if(f.key==='shab'){ const ap=Number(a.surfacePriority)||0, bp=Number(b.surfacePriority)||0; if(ap!==bp) return bp-ap; }
        return b.confidence-a.confidence;
      });
      let chosen=pool[0];
      if(f.key==='dh') { const dhRows=pool.filter(o=>o.method==='rset:dh-row'); const numeric=(dhRows.length?dhRows:pool).filter(o=>typeof o.value==='number'); if(numeric.length) chosen=numeric.sort((a,b)=>b.value-a.value)[0]; }
      row[f.key]=chosen.value; finals.push({...chosen,status:'retenu',operation});
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
    return {...o,status:retained?'retenu':'rejeté',rejectionReason:retained?'':(o.sourceTier==='unrouted'?'Source non autorisée pour remplissage automatique':o.confidence<MIN_RETAINED_CONFIDENCE?`Confiance < ${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`:directWinner?'Valeur documentaire directe prioritaire sur la bibliothèque':'Non retenu après consolidation')};
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
      for(const field of required){ const ok=finals.some(o=>o.docId===d.id&&o.field===field&&(o.building===b||bs.length===1)); if(ok) found++; else alerts.push({level:'warning',docId:d.id,fileName:d.name,building:b,field,message:`RSET incomplet — ${b} : ${FIELD_MAP[field].label} absent ou confiance < ${Math.round(MIN_RETAINED_CONFIDENCE*100)} %`}); }
      if(found<required.length) alerts.push({level:'warning',docId:d.id,fileName:d.name,building:b,message:`Complétude réglementaire ${b} : ${found}/${required.length} champs structurés obligatoires.`});
    }
  }
  for(const d of docs){ if(d.read?.kind==='pdf'&&d.read.text.replace(/\s/g,'').length<40) alerts.push({level:'warning',docId:d.id,fileName:d.name,message:'PDF sans couche texte exploitable — OCR probablement nécessaire.'}); if(d.error) alerts.push({level:'error',docId:d.id,fileName:d.name,message:d.error}); }
  return alerts;
}


function expectedFieldsForDocument(doc){
  const text=normLower(doc?.read?.text||'');
  if(doc.type===DOC_TYPES.RT2012) return [...REQUIRED_RT2012_RSET_FIELDS];
  if([DOC_TYPES.RSET_RE2020,DOC_TYPES.RSEE_RE2020].includes(doc.type)){
    const base=[...REQUIRED_RE2020_RSET_FIELDS];
    if(/ic\s*(?:composants?|construction)|(?:1\s*[-–—]\s*vrd)|energie\s*\(\s*ce\s*\)/i.test(text)) base.push('ic_components','ic_energy','ic_site',...Array.from({length:13},(_,i)=>`ic_lot_${i+1}`));
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
    // Les candidats non routés restent à vérifier même au-dessus de 90 % :
    // une bonne ressemblance textuelle ne remplace pas une source métier autorisée.
    if(o.sourceTier!=='unrouted'&&o.confidence>=MIN_RETAINED_CONFIDENCE) continue;
    const k=`${o.building}|${o.field}`; const prev=best.get(k);
    const rank=o.sourceRank??999, prevRank=prev?.sourceRank??999;
    if(!prev||rank<prevRank||(rank===prevRank&&o.confidence>prev.confidence)) best.set(k,o);
  }
  return [...best.values()].sort((a,b)=>b.confidence-a.confidence);
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
  const completeness=buildCompleteness(docs,consolidated.finals,grouping);
  const uncertain=buildUncertain(consolidated.detailed);
  return {...consolidated,occurrences,alerts,grouping,completeness,uncertain,newlyParsedCount,reusedParsedCount};
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

  // Contrat de schéma v1.1.1 : 167 colonnes exactes, chacune avec des tags reconnus.
  assert('Schéma métier = 167 colonnes',FIELD_DEFS.length===167,String(FIELD_DEFS.length));
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
function projectName(p,index){ return (p?.customTitle||p?.operationName||p?.result?.operation||p?.label||`Projet ${index+1}`).trim(); }

function exportProjectsExcel(projects,rules){
  if(!globalThis.XLSX) throw new Error('SheetJS non chargé.');
  const usable=(projects||[]).filter(p=>p?.result);
  if(!usable.length) throw new Error('Aucun projet analysé à exporter.');
  const wb=XLSX.utils.book_new();
  const fields=FIELD_DEFS;

  // La feuille principale respecte strictement le schéma métier demandé : 167 colonnes, mêmes intitulés, même ordre.
  const data=[fields.map(f=>f.label)];
  usable.forEach((p,idx)=>{ const r=p.result, pname=projectName(p,idx); for(const row of r.rows){ data.push(fields.map(f=>{ if(f.key==='building') return row.building??''; if(f.key==='project') return row.project??pname; if(f.key==='operation') return row.operation??r.operation??pname; if(f.key==='operation_name') return row.operation_name??p.operationName??r.operation??''; return row[f.key]??''; })); } });
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
    };
    // PDF/XML : une seule chaîne par page suffit pour restaurer la recherche libre et les tags.
    // Excel : conserver les cellules, nécessaires au parseur économique DPGF lors d'une restauration.
    if(hasCells) base.lines=lines.map(serializeLine);
    else base.text=String(page.text||lines.map(l=>String(l.text||'')).join('\n'));
    return base;
  });
  return {kind:read.kind||'',pageCount:Number.isFinite(read.pageCount)?read.pageCount:pages.length,pages,ocr:safeJsonClone(read.ocr,null)};
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
return `# PROMPT — Amélioration continue d’ExtracTerre\n\nJe joins à ce nouveau chat :\n1. le dernier ZIP complet d’ExtracTerre ;\n2. ce pack de journal d’amélioration généré par l’application.\n\n## Mission\n\nAnalyse d’abord le code de la dernière version d’ExtracTerre puis l’intégralité du journal. Utilise les validations, rejets, corrections manuelles, signalements bêta champ par champ, champs manquants, Cribles fins, erreurs et mesures de performance pour produire une nouvelle version réellement meilleure. Les événements beta_result_error et beta_missing_data_location sont des retours propriétaires prioritaires. Les événements parser_location_learning décrivent les endroits exacts surlignés dans les documents : type documentaire, page, position relative, ligne et contexte avant/après. Regroupe-les par champ + type documentaire afin de faire rechercher en priorité les emplacements récurrents, sans jamais créer une valeur absente du document.\n\nLes objectifs sont, dans cet ordre :\n- augmenter la fiabilité des extractions et réduire les faux positifs ;\n- récupérer davantage de données réellement présentes dans les documents sans inventer ;\n- améliorer les parseurs spécialisés, les tags, les normalisations et la hiérarchie de sources à partir des cas observés ;\n- réduire le recours à l’OCR intégral et privilégier lecture structurée puis OCR ciblé ;\n- améliorer la rapidité globale, la consommation mémoire et la stabilité sur de gros lots ;\n- exploiter les corrections récurrentes comme cas de régression permanents ;\n- conserver les comportements qui fonctionnent déjà.\n\n## Contraintes à ne pas casser\n\n- Conserver exactement le schéma métier actuel de 167 colonnes et leur ordre dans l’export Excel, sauf demande explicite contraire de ma part.\n- Ne jamais fabriquer une valeur absente des sources : tolérance d’hallucination = 0.\n- Respecter les priorités de sources configurées par champ.\n- Conserver le système de confiance, les candidats à vérifier et le Crible fin.\n- Conserver le checkpoint IndexedDB, le pool d’analyse borné, la libération mémoire et le journal d’amélioration.\n- Ne jamais mettre les mots de passe en clair dans les fichiers livrés.\n- L’Excel doit continuer à exporter l’ensemble du tableau, même si l’interface répartit les résultats en onglets métier.\n\n## Méthode attendue\n\n1. Établis les statistiques du journal : corrections les plus fréquentes, champs souvent absents, sources/types de documents responsables, faux positifs, validations et temps d’analyse.\n2. Regroupe les problèmes par cause racine plutôt que d’ajouter des rustines document par document.\n3. Modifie les parseurs/dictionnaires/règles nécessaires dans le code de la dernière version jointe.\n4. Pour chaque motif récurrent corrigé, ajoute un test de régression.\n5. Vérifie les tests historiques et les nouveaux tests. Une amélioration ne doit pas faire régresser un cas déjà validé.\n6. Vérifie particulièrement les performances : parsing parallèle borné, OCR ciblé, destruction des ressources PDF/canvas, absence de duplication massive en mémoire.\n7. Mets à jour VERSION, CHANGELOG, README et TESTS.\n8. Livre le ZIP complet de la nouvelle version, pas seulement des fichiers de patch.\n\n## Informations synthétiques du pack\n\n${pretty(summary)}\n\nCommence par analyser les causes récurrentes visibles dans le journal et applique directement les améliorations les plus rentables en efficacité, fiabilité et rapidité.\n`;
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

/* ---- app.js ---- */
function createProject(index=1){ return {id:`project-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,label:`Projet ${index}`,customTitle:'',operationName:'',docs:[],result:null,buildingOverrides:{},deletedBuildings:[],manualTags:[],projectTags:[],manualValues:{},manualSources:{},manualPasteRaw:'',manualPasteRows:[],manualPasteColumns:[],uncertainRejectedKeys:[],manualEconomics:{},economic:null,resultView:'generic',expanded:true}; }
const state={projects:[],activeProjectId:null,rules:loadSourceRules(),selfTests:runSelfTests(),activeTab:'summary',resultWorkspaceMode:'overview'};

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
for(const key of ['docs','result','buildingOverrides','deletedBuildings','manualTags','projectTags','manualValues','manualSources','manualPasteRaw','manualPasteRows','manualPasteColumns','uncertainRejectedKeys','manualEconomics','economic']) Object.defineProperty(state,key,{get(){return activeProject()[key]},set(v){activeProject()[key]=v}});
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
    {title:'IC composants & chantier',keys:['ic_components','ic_site','ic_lot_1','ic_lot_2','ic_lot_3','ic_lot_4','ic_lot_5','ic_lot_6','ic_lot_7','ic_lot_8','ic_lot_9','ic_lot_10','ic_lot_11','ic_lot_12','ic_lot_13']},
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
    const liveLabel=d.status==='reading'&&String(d.liveStage||'').startsWith('cloud-')?'Cloud…':d.status==='reading'?'Lecture parallèle…':null;
    return `<div class="file-row"><div class="file-icon">${d.name.split('.').pop().toUpperCase().slice(0,4)}</div><div class="file-main"><div class="file-name" title="${escapeHtml(d.relativePath||d.name)}">${escapeHtml(d.name)}</div><div class="file-meta">${(d.size/1024/1024).toFixed(2)} Mo · ${escapeHtml(d.status==='ready'?d.type:d.status==='missing'?'À redéposer':d.status==='error'?'Erreur':d.status==='timeout'?'À relancer · délai dépassé':liveLabel||'En attente')}${d.status==='ready'&&d.buildings?` · ${d.buildings.expectedCount?`${d.buildings.names.length}/${d.buildings.expectedCount}`:d.buildings.names.length} bâtiment(s)`:''}${d.read?.ocr?.used?` · OCR ${d.read.ocr.pages.length} p.`:''}${Array.isArray(d.cachedOccurrences)?' · analysé':''}${escapeHtml(cloudMeta)}${escapeHtml(targetedMeta)}${escapeHtml(unloaded)}</div></div>${d.classification?`<span class="badge doc">${escapeHtml(d.type)}</span>`:''}<div class="file-actions"><button class="btn light preview-file" data-id="${d.id}" ${canPreview?'':'disabled'} title="${canPreview?'Afficher ce fichier dans ExtracTerre sans ouvrir de nouvel onglet':'Redéposez ce fichier pour afficher son aperçu'}">👁 Aperçu</button>${showTarget||targetedRunning?`<button class="btn light targeted-file" data-id="${d.id}" ${targetedRunning||!canTarget?'disabled':''} title="${!d.file?'Redéposez ce PDF pour réactiver le crible fin ; les résultats déjà sauvegardés seront conservés.':!state.result?'Terminez d’abord la première consolidation du projet.':'Repasser ce PDF au crible fin avec OCR maximal, sans retraiter les autres documents'}">${targetedRunning?'Crible fin…':'🔎 Crible fin'}</button>`:''}${d.status==='timeout'?`<button class="btn light retry-file" data-id="${d.id}">↻ Relancer sans limite</button>`:''}<button class="icon-btn remove-file" data-id="${d.id}" aria-label="Supprimer">×</button></div></div>`;
  }).join('');
  $$('.remove-file').forEach(b=>b.onclick=async()=>{ const id=b.dataset.id; state.docs=state.docs.filter(d=>d.id!==id); state.result=null; try{await deleteDocumentCheckpoint(id);}catch{} renderAll(); scheduleWorkspaceCheckpoint('suppression document',50); });
  $$('.retry-file').forEach(b=>b.onclick=()=>retryTimedOutDocument(b.dataset.id));
  $$('.targeted-file').forEach(b=>b.onclick=()=>targetedReanalysis(b.dataset.id));
  $$('.preview-file').forEach(b=>b.onclick=()=>openFilePreview(b.dataset.id));
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
function activateProject(id){ const p=state.projects.find(x=>x.id===id); if(!p)return; activeProject().operationName=$('#operationName').value.trim(); state.activeProjectId=id; state.resultWorkspaceMode='detail'; if(!p.result) rebuildProjectFromCheckpoints(p); p.expanded=true; syncProjectInput(); switchTab('summary'); renderAll(); scheduleWorkspaceCheckpoint('projet actif'); }
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
  const recognized=parsed.columns.filter(c=>c.def).map(c=>c.def.label);
  box.innerHTML=`<div class="manual-preview-stats"><span><b>${parsed.recognized}</b> colonne(s) reconnue(s)</span><span><b>${parsed.rows.length}</b> ligne(s) de données</span>${parsed.unrecognized.length?`<span class="warn"><b>${parsed.unrecognized.length}</b> en-tête(s) non reconnu(s)</span>`:''}</div><div class="manual-chip-wrap">${recognized.slice(0,28).map(x=>`<span>${escapeHtml(x)}</span>`).join('')}${recognized.length>28?`<span>+${recognized.length-28}</span>`:''}</div>${parsed.unrecognized.length?`<small>Non reconnus : ${escapeHtml(parsed.unrecognized.join(' · '))}</small>`:''}`;
}
function applyManualPaste(){
  const raw=$('#manualDataPaste')?.value||''; const parsed=parseManualClipboard(raw);
  if(!parsed.recognized||!parsed.rows.length){ toast('Aucune ligne de données exploitable. Vérifiez les en-têtes et collez au moins une ligne de valeurs.','warn'); renderManualPastePreview(parsed); return; }
  state.manualPasteRaw=raw; state.manualPasteRows=parsed.rows; state.manualPasteColumns=parsed.columns.map(c=>({header:c.header,key:c.def?.key||null}));
  // Si le nom de l'opération est fourni manuellement et que le champ Projet actuel est vide, on le reprend comme titre de travail.
  const first=parsed.rows[0]?.values||{}; if(!$('#operationName').value.trim()&&(first.operation_name||first.operation)){ const op=String(first.operation_name||first.operation); $('#operationName').value=op; activeProject().operationName=op; }
  $('#manualDataDialog')?.close();
  learn('manual_paste',{rows:parsed.rows.length,recognizedColumns:parsed.columns.filter(c=>c.def).map(c=>({header:c.header,field:c.def.key,label:c.def.label})),unrecognizedHeaders:parsed.unrecognized||[]},activeProject());
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
  if(!state.docs.length&&!state.manualPasteRows.length){ toast('Ajoutez au moins un document ou collez des données manuelles.','warn'); return; }
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
      d.classification=classifyDocument(d.name,d.read.text,{kind:d.read.kind});
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

function showTargetedReview(doc,candidates,ocrMeta){
  const dlg=$('#targetedReviewDialog'), list=$('#targetedReviewList'), title=$('#targetedReviewTitle'), sub=$('#targetedReviewSub'), apply=$('#targetedReviewApply'), close=$('#targetedReviewClose');
  if(!dlg||!list) return;
  const decisions=new Map(),logged=new Set();
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
    const classification=classifyDocument(doc.name,highRead.text,{kind:highRead.kind});
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
function betaLearningDocs(){ return (activeProject()?.docs||[]).filter(d=>d.status==='ready'&&d.read?.pages?.length); }
function betaLearningDoc(){ const id=$('#betaLearningDocument')?.value||''; return betaLearningDocs().find(d=>d.id===id)||null; }
function renderBetaLearningPage(){
  const doc=betaLearningDoc(), pageSelect=$('#betaLearningPage'), textBox=$('#betaLearningText'), meta=$('#betaLearningMeta');
  if(!doc||!pageSelect||!textBox) return;
  const pages=doc.read?.pages||[]; const current=Number(pageSelect.value)||Number(doc?.read?.pages?.[0]?.page)||1;
  pageSelect.innerHTML=pages.map(p=>`<option value="${Number(p.page)||1}" ${Number(p.page)===current?'selected':''}>Page ${Number(p.page)||1}${p.sheet?` · ${escapeHtml(p.sheet)}`:''}</option>`).join('');
  const page=pages.find(p=>Number(p.page)===Number(pageSelect.value))||pages[0]; if(!page){textBox.innerHTML='<div class="empty-small">Aucun texte exploitable.</div>';return;}
  const lines=(page.lines||String(page.text||'').split(/\r?\n/).map((t,index)=>({text:t,index}))).filter(l=>String(l.text||'').trim());
  textBox.innerHTML=lines.map((l,i)=>`<div class="beta-learning-line" data-line-index="${Number.isFinite(l.index)?l.index:i}">${escapeHtml(l.text||'')}</div>`).join('')||'<div class="empty-small">Aucun texte exploitable sur cette page.</div>';
  if(meta) meta.textContent=`${doc.name} · ${doc.type||'Document'} · page ${page.page||1} / ${pages.length}`;
  betaLearningSelection=null; const out=$('#betaLearningSelection'); if(out) out.textContent='Aucun surlignage sélectionné.';
}
function syncBetaLearningDocument(preferredDocId='',preferredPage=null){
  const sel=$('#betaLearningDocument'); if(!sel) return; const docs=betaLearningDocs();
  sel.innerHTML=docs.map(d=>`<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)} · ${escapeHtml(d.type||'Document')}</option>`).join('');
  if(preferredDocId&&docs.some(d=>d.id===preferredDocId)) sel.value=preferredDocId;
  else if(docs.length) sel.value=docs[0].id;
  const page=$('#betaLearningPage'); if(page&&preferredPage) page.value=String(preferredPage);
  renderBetaLearningPage(); if(page&&preferredPage&&[...page.options].some(o=>o.value===String(preferredPage))){page.value=String(preferredPage);renderBetaLearningPage();}
}
function captureBetaLearningSelection(){
  const box=$('#betaLearningText'), selection=globalThis.getSelection?.(); if(!box||!selection||selection.rangeCount<1||selection.isCollapsed){ $('#betaErrorFeedback').textContent='Surlignez d’abord la donnée correcte dans le texte du document.'; return; }
  const range=selection.getRangeAt(0); if(!box.contains(range.commonAncestorContainer)){ $('#betaErrorFeedback').textContent='Le surlignage doit être fait dans la zone texte du document.'; return; }
  const selectedText=selection.toString().replace(/\s+/g,' ').trim(); if(!selectedText){ $('#betaErrorFeedback').textContent='Le surlignage est vide.'; return; }
  const startEl=(range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement)?.closest?.('.beta-learning-line');
  const endEl=(range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement)?.closest?.('.beta-learning-line')||startEl;
  const doc=betaLearningDoc(), pageNo=Number($('#betaLearningPage')?.value)||1, page=doc?.read?.pages?.find(p=>Number(p.page)===pageNo);
  const lines=page?.lines||[]; const startIndex=Number(startEl?.dataset?.lineIndex); const endIndex=Number(endEl?.dataset?.lineIndex);
  const lineObj=lines.find(l=>Number(l.index)===startIndex)||null; const pos=lines.findIndex(l=>Number(l.index)===startIndex);
  betaLearningSelection={docId:doc?.id||'',document:doc?.name||'',docType:doc?.type||'',page:pageNo,pageCount:doc?.read?.pages?.length||0,lineIndex:Number.isFinite(startIndex)?startIndex:null,endLineIndex:Number.isFinite(endIndex)?endIndex:null,lineCount:lines.length,selectedText,lineText:lineObj?.text||startEl?.textContent||'',beforeLine:pos>0?lines[pos-1]?.text||'':'',afterLine:pos>=0&&pos<lines.length-1?lines[pos+1]?.text||'':'',pageRatio:(doc?.read?.pages?.length?Math.round((pageNo/doc.read.pages.length)*1000)/1000:null),lineRatio:(lines.length&&pos>=0?Math.round(((pos+1)/lines.length)*1000)/1000:null)};
  box.querySelectorAll('.beta-learning-line').forEach(el=>el.classList.remove('beta-learning-line-selected'));
  if(startEl&&endEl){ let active=false; for(const el of box.querySelectorAll('.beta-learning-line')){ if(el===startEl) active=true; if(active) el.classList.add('beta-learning-line-selected'); if(el===endEl) break; } }
  $('#betaLearningSelection').textContent=`Surligné : « ${selectedText} » · ${doc?.name||''} · p.${pageNo}${Number.isFinite(startIndex)?` · ligne ${startIndex+1}`:''}`;
  const def=FIELD_MAP[$('#betaErrorDialog')?.dataset.field||'']; const input=$('#betaErrorCorrectValue');
  if(input&&def){ if(def.type==='number'){ const n=parseFrNumber(selectedText); if(n!==null) input.value=String(n).replace('.',','); } else input.value=selectedText; }
  $('#betaErrorFeedback').textContent='';
}
function openBetaErrorDialog(building,field){
  if(!ownerBetaEnabled()||!state.result) return;
  const def=FIELD_MAP[field],ctx=betaResultContext(building,field),dlg=$('#betaErrorDialog');
  if(!def||!ctx.row||!dlg) return;
  const src=ctx.source||{}, missing=ctx.value===undefined||ctx.value===null||ctx.value==='';
  $('#betaErrorTitle').textContent=missing?'Renseigner une donnée manquante':'Corriger une donnée';
  $('#betaErrorIntro').textContent=missing?'Choisissez la pièce, surlignez la donnée correcte et ExtracTerre mémorisera son emplacement pour les prochains documents similaires.':'Choisissez la pièce, surlignez la bonne donnée et ExtracTerre remplacera la valeur tout en mémorisant précisément son emplacement.';
  $('#betaErrorField').textContent=def.label||field;
  $('#betaErrorBuilding').textContent=building||'Bâtiment unique';
  $('#betaErrorDetected').textContent=missing?'Donnée vide':formatValue(ctx.value);
  $('#betaErrorSource').textContent=src.fileName?`${src.fileName}${src.page?` · p.${src.page}`:''}${Number.isFinite(src.confidence)?` · ${Math.round(src.confidence*100)} %`:''}`:'Aucune source retenue';
  $('#betaErrorExcerpt').textContent=src.excerpt||'Aucun extrait source disponible.';
  $('#betaErrorCorrectValue').value='';
  $('#betaErrorReason').value=missing?'missing_data':'wrong_value';
  $('#betaErrorComment').value=''; $('#betaApplyCorrection').checked=true; $('#betaErrorFeedback').textContent='';
  dlg.dataset.building=building; dlg.dataset.field=field; dlg.dataset.wasMissing=missing?'1':'0'; betaLearningSelection=null;
  syncBetaLearningDocument(src.docId||'',src.page||null); dlg.showModal();
}
function closeBetaErrorDialog(){ const dlg=$('#betaErrorDialog'); if(dlg?.open) dlg.close(); betaLearningSelection=null; }
async function submitBetaError(){
  if(!ownerBetaEnabled()) return;
  const dlg=$('#betaErrorDialog'),building=dlg?.dataset.building||'',field=dlg?.dataset.field||'',def=FIELD_MAP[field];
  const ctx=betaResultContext(building,field); if(!dlg||!def||!ctx.row) return;
  const raw=($('#betaErrorCorrectValue')?.value||'').trim(); let correctedValue=null,hasCorrection=!!raw;
  if(hasCorrection){ if(def.type==='number'){ const n=parseFrNumber(raw); if(n===null){ $('#betaErrorFeedback').textContent='La bonne valeur doit être numérique pour ce champ.'; return; } correctedValue=n; } else correctedValue=field==='window_glazing'?(normalizeGlazingType(raw)||raw):raw; }
  if(!hasCorrection&&dlg.dataset.wasMissing==='1'){ $('#betaErrorFeedback').textContent='Pour renseigner une donnée vide, surlignez ou saisissez la bonne valeur.'; return; }
  const src=ctx.source||{},chosenDoc=betaLearningDoc(),reason=$('#betaErrorReason')?.value||'other',comment=($('#betaErrorComment')?.value||'').trim();
  const loc=betaLearningSelection?{...betaLearningSelection}:null;
  const payload={beta:true,learningLocation:true,field,fieldLabel:def.label||field,building,wasMissing:dlg.dataset.wasMissing==='1',detectedValue:ctx.value??null,correctedValue:hasCorrection?correctedValue:null,hasCorrectedValue:hasCorrection,reason,comment,sourceDocument:src.fileName||'',sourceDocId:src.docId||'',sourcePage:src.page||null,sourceConfidence:Number.isFinite(src.confidence)?src.confidence:null,sourceMethod:src.method||'',sourceExcerpt:src.excerpt||'',sourceBuilding:src.originalBuilding||src.building||'',selectedSourceDocument:loc?.document||chosenDoc?.name||'',selectedSourceDocId:loc?.docId||chosenDoc?.id||'',selectedSourceDocType:loc?.docType||chosenDoc?.type||'',selectedSourcePage:loc?.page||Number($('#betaLearningPage')?.value)||null,highlight:loc,operation:activeProject()?.operationName||state.result?.operation||'',resultView:activeProject()?.resultView||'generic'};
  try{
    await recordLearningEvent(dlg.dataset.wasMissing==='1'?'beta_missing_data_location':'beta_result_error',payload,activeProject());
    if(loc){
      const learnPayload={field,fieldLabel:def.label||field,building,docType:loc.docType,document:loc.document,page:loc.page,pageRatio:loc.pageRatio,lineIndex:loc.lineIndex,lineRatio:loc.lineRatio,lineText:loc.lineText,beforeLine:loc.beforeLine,afterLine:loc.afterLine,selectedText:loc.selectedText,correctedValue:hasCorrection?correctedValue:null,operation:payload.operation};
      const evt=await recordLearningEvent('parser_location_learning',learnPayload,activeProject());
      await reinforceLearningLocation(learnPayload,{eventId:evt.id,createdAt:evt.createdAt,field,docType:loc.docType,building});
    }
    const negativeReasons=new Set(['wrong_source','wrong_building','false_positive']);
    const srcDoc=state.docs.find(d=>d.id===src.docId);
    if(dlg.dataset.wasMissing!=='1'&&negativeReasons.has(reason)&&src.docId&&srcDoc?.type){
      const rejectPayload={field,fieldLabel:def.label||field,building,docType:srcDoc.type,document:src.fileName||srcDoc.name,page:src.page||null,lineText:src.excerpt||'',selectedText:String(ctx.value??''),reason,operation:payload.operation};
      const evt=await recordLearningEvent('parser_location_rejection',rejectPayload,activeProject());
      await penalizeLearningLocation(rejectPayload,{eventId:evt.id,createdAt:evt.createdAt,field,docType:srcDoc.type,building});
    }
    if(hasCorrection&&$('#betaApplyCorrection')?.checked){
      const key=`${building}|${field}`,previous=ctx.value; state.manualValues[key]=correctedValue;
      state.manualSources[key]={docId:loc?.docId||chosenDoc?.id||src.docId||'',fileName:loc?.document||chosenDoc?.name||src.fileName||'Correction bêta',page:loc?.page||Number($('#betaLearningPage')?.value)||src.page||1,excerpt:loc?.lineText||loc?.selectedText||src.excerpt||'',method:'manual:highlight-learning',provenanceNote:`Correction propriétaire par surlignage — ${reason}`};
      applyManualValues(); learn('manual_override',{building,field,previousValue:previous,newValue:correctedValue,source:'highlight_learning',reason,highlight:loc},activeProject()); refreshEconomic(); scheduleWorkspaceCheckpoint('correction par surlignage',80);
    }
    closeBetaErrorDialog(); renderSummary(); scheduleJournalUiRefresh(); renderLearningMemoryUi();
    toast(dlg.dataset.wasMissing==='1'?'Donnée ajoutée et emplacement mémorisé.':'Correction appliquée et emplacement mémorisé.','success');
  }catch(err){ $('#betaErrorFeedback').textContent=`Enregistrement impossible : ${err?.message||err}`; }
}

function rerunWithBuildingLinks(message='Regroupement des bâtiments mis à jour.'){
  const valid=state.docs.filter(d=>d.status==='ready'); if((!valid.length&&!state.manualPasteRows.length)||!state.result) return;
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
  if(!valid.length&&!(project.manualPasteRows||[]).length){ project.result=null; return; }
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
      d.classification=classifyDocument(d.name,d.read.text,{kind:d.read.kind});
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
  $('#analyzeBtn').onclick=()=>analyze(); const manualOpen=$('#manualDataBtn'); if(manualOpen) manualOpen.onclick=openManualDataDialog; const manualPaste=$('#manualDataPaste'); if(manualPaste) manualPaste.oninput=()=>renderManualPastePreview(parseManualClipboard(manualPaste.value)); const manualApply=$('#manualDataApply'); if(manualApply) manualApply.onclick=applyManualPaste; const manualClear=$('#manualDataClear'); if(manualClear) manualClear.onclick=clearManualPaste; const manualClose=$('#manualDataClose'); if(manualClose) manualClose.onclick=()=>$('#manualDataDialog')?.close(); const previewDlg=$('#filePreviewDialog'); const previewClose=$('#filePreviewClose'); if(previewClose) previewClose.onclick=()=>previewDlg?.close(); if(previewDlg){ previewDlg.addEventListener('close',closeFilePreview); previewDlg.addEventListener('cancel',()=>setTimeout(closeFilePreview,0)); } $('#newProjectBtn').onclick=addNewProject; const lockBtn=$('#lockBtn'); if(lockBtn) lockBtn.onclick=async()=>{ try{await checkpointWorkspace('verrouillage',true);await syncLearningJournalNow(false);}catch{} globalThis.__lockExtracterre?.(); }; $('#clearBtn').onclick=async()=>{ if(!confirm('Effacer la session locale ExtracTerre ? Les résultats et checkpoints du projet seront supprimés. Le journal d’amélioration et les règles de sources seront conservés.')) return; try{await clearWorkspaceSnapshot();}catch(err){toast(`Impossible d’effacer complètement la sauvegarde locale : ${err?.message||err}`,'warn');} state.projects=[createProject(1)];state.activeProjectId=state.projects[0].id;syncProjectInput();renderAll();lastLocalSaveAt=null;setLocalSaveUi('Session vide',null);await refreshJournalUi();toast('Session locale effacée. Le journal d’amélioration est conservé.','success');};
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
  const betaClose=$('#betaErrorClose'); if(betaClose) betaClose.onclick=closeBetaErrorDialog; const betaCancel=$('#betaErrorCancel'); if(betaCancel) betaCancel.onclick=closeBetaErrorDialog; const betaSubmit=$('#betaErrorSubmit'); if(betaSubmit) betaSubmit.onclick=submitBetaError; const betaDoc=$('#betaLearningDocument'); if(betaDoc) betaDoc.onchange=renderBetaLearningPage; const betaPage=$('#betaLearningPage'); if(betaPage) betaPage.onchange=renderBetaLearningPage; const betaHighlight=$('#betaUseHighlight'); if(betaHighlight) betaHighlight.onclick=captureBetaLearningSelection; const betaPreview=$('#betaPreviewSelectedDoc'); if(betaPreview) betaPreview.onclick=()=>{const d=betaLearningDoc(); if(d) openFilePreview(d.id);}; const betaDlg=$('#betaErrorDialog'); if(betaDlg) betaDlg.addEventListener('click',e=>{if(e.target===betaDlg) closeBetaErrorDialog();});
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
