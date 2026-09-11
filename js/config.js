export const APP_VERSION = '1.1.10';
export const MIN_RETAINED_CONFIDENCE = 0.90;
export const MIN_REVIEW_CONFIDENCE = 0.65;
export const ANALYSIS_MODES = Object.freeze({
  safe:Object.freeze({key:'safe',label:'Sécurisé',documents:1,ocr:1,description:'1 document / 1 OCR'}),
  balanced:Object.freeze({key:'balanced',label:'Équilibré',documents:3,ocr:1,description:'3 documents / 1 OCR'}),
  fast:Object.freeze({key:'fast',label:'Rapide',documents:5,ocr:2,description:'5 documents / 2 OCR'})
});
export const DEFAULT_ANALYSIS_MODE = 'balanced';
// Compatibilité avec les modules/tests existants : ces constantes représentent le profil par défaut.
export const MAX_OCR_WORKERS = ANALYSIS_MODES[DEFAULT_ANALYSIS_MODE].ocr;
export const MAX_DOCUMENT_CONCURRENCY = ANALYSIS_MODES[DEFAULT_ANALYSIS_MODE].documents;

export const DOC_TYPES = {
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

export const FIELD_DEFS = [
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
  {key:"ic_lot_1",label:"IC composants lot 1",family:"Carbone",type:"number",tags:["IC composants lot 1", "lot 1", "lot 1 IC", "lot 1 composants"] ,presence:false},
  {key:"ic_lot_2",label:"IC composants lot 2",family:"Carbone",type:"number",tags:["IC composants lot 2", "lot 2", "lot 2 IC", "lot 2 composants"] ,presence:false},
  {key:"ic_lot_3",label:"IC composants lot 3",family:"Carbone",type:"number",tags:["IC composants lot 3", "lot 3", "lot 3 IC", "lot 3 composants"] ,presence:false},
  {key:"ic_lot_4",label:"IC composants lot 4",family:"Carbone",type:"number",tags:["IC composants lot 4", "lot 4", "lot 4 IC", "lot 4 composants"] ,presence:false},
  {key:"ic_lot_5",label:"IC composants lot 5",family:"Carbone",type:"number",tags:["IC composants lot 5", "lot 5", "lot 5 IC", "lot 5 composants"] ,presence:false},
  {key:"ic_lot_6",label:"IC composants lot 6",family:"Carbone",type:"number",tags:["IC composants lot 6", "lot 6", "lot 6 IC", "lot 6 composants"] ,presence:false},
  {key:"ic_lot_7",label:"IC composants lot 7",family:"Carbone",type:"number",tags:["IC composants lot 7", "lot 7", "lot 7 IC", "lot 7 composants"] ,presence:false},
  {key:"ic_lot_8",label:"IC composants lot 8",family:"Carbone",type:"number",tags:["IC composants lot 8", "lot 8", "lot 8 IC", "lot 8 composants"] ,presence:false},
  {key:"ic_lot_9",label:"IC composants lot 9",family:"Carbone",type:"number",tags:["IC composants lot 9", "lot 9", "lot 9 IC", "lot 9 composants"] ,presence:false},
  {key:"ic_lot_10",label:"IC composants lot 10",family:"Carbone",type:"number",tags:["IC composants lot 10", "lot 10", "lot 10 IC", "lot 10 composants"] ,presence:false},
  {key:"ic_lot_11",label:"IC composants lot 11",family:"Carbone",type:"number",tags:["IC composants lot 11", "lot 11", "lot 11 IC", "lot 11 composants"] ,presence:false},
  {key:"ic_lot_12",label:"IC composants lot 12",family:"Carbone",type:"number",tags:["IC composants lot 12", "lot 12", "lot 12 IC", "lot 12 composants"] ,presence:false},
  {key:"ic_lot_13",label:"IC composants lot 13",family:"Carbone",type:"number",tags:["IC composants lot 13", "lot 13", "lot 13 IC", "lot 13 composants"] ,presence:false},
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
  {key:"enr_type",label:"ENR type",family:"ENR",type:"text",tags:["ENR type", "type ENR", "photovoltaïque", "solaire thermique", "géothermie", "biomasse"] ,presence:false}
];
export const FIELD_MAP = Object.fromEntries(FIELD_DEFS.map(f=>[f.key,f]));
export const FIELD_TAGS = Object.fromEntries(FIELD_DEFS.map(f=>[f.key,[...f.tags]]));
export const FAMILIES = [...new Set(FIELD_DEFS.map(f=>f.family))];

export function normalizeFieldHeader(value=''){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/[^a-zA-Z0-9+&/,.-]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
}
const HEADER_LOOKUP=new Map();
for(const f of FIELD_DEFS) for(const tag of f.tags){ const n=normalizeFieldHeader(tag); if(n&&!HEADER_LOOKUP.has(n)) HEADER_LOOKUP.set(n,f.key); }
export function matchFieldByHeader(header=''){ const key=HEADER_LOOKUP.get(normalizeFieldHeader(header)); return key?FIELD_MAP[key]:null; }

const SOURCE_ADMIN=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.DESIGN_REPORT,DOC_TYPES.MANUAL];
const SOURCE_CERT=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.REQUIREMENTS,DOC_TYPES.ENV_REPORT,DOC_TYPES.MANUAL];
const SOURCE_LEVELS=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.ENV_REPORT,DOC_TYPES.REQUIREMENTS,DOC_TYPES.MANUAL];
const SOURCE_PROGRAM=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.PROJECT_DESCRIPTION,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL];
const SOURCE_PROJECT_META=[DOC_TYPES.CONTRACT,DOC_TYPES.OPERATION_BOOKLET,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.PLAN,DOC_TYPES.NOTICE,DOC_TYPES.MANUAL];
const SOURCE_ENVELOPE=[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.THERMAL,DOC_TYPES.CCTP,DOC_TYPES.DPGF,DOC_TYPES.MANUAL];
const SOURCE_SYSTEMS=[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.CCTP,DOC_TYPES.DPGF,DOC_TYPES.DIAGNOSTIC,DOC_TYPES.MANUAL];
const SOURCE_UBAT_CEP=[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.CCTP,DOC_TYPES.DPGF,DOC_TYPES.DIAGNOSTIC,DOC_TYPES.AIRTIGHTNESS,DOC_TYPES.MANUAL];
const SOURCE_ENR=[DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.CCTP,DOC_TYPES.DPGF,DOC_TYPES.MANUAL];
const ordered=(types,secondary=[])=>({main:[...types],secondary:[...secondary],forbidden:[]});
export const DEFAULT_SOURCE_RULES={};
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
for(const key of ['bbio','bbio_max','bbio_gain','cep','cep_max','cep_gain','cepnr','cepnr_max','cepnr_gain']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSENV,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL]);
for(const key of ['cep_cooling','cep_lighting','cep_aux_vent','cep_aux_dist','cep_mobility','cep_electricity','cep_gas','cep_district','cep_biomass']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSET_RE2020,DOC_TYPES.RT2012,DOC_TYPES.RSENV,DOC_TYPES.THERMAL,DOC_TYPES.RT_EXISTING,DOC_TYPES.MANUAL]);
for(const key of ['ic_components','ic_site','ic_lot_1','ic_lot_2','ic_lot_3','ic_lot_4','ic_lot_5','ic_lot_6','ic_lot_7','ic_lot_8','ic_lot_9','ic_lot_10','ic_lot_11','ic_lot_12','ic_lot_13','ic_energy','ic_energy_heating','ic_energy_cooling','ic_energy_ecs','ic_energy_aux_vent','ic_energy_aux_dist','ic_energy_mobility']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.RSEE_RE2020,DOC_TYPES.RSENV,DOC_TYPES.CARBON,DOC_TYPES.RSET_RE2020,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL]);
for(const key of ['dpe_energy_before','dpe_ges_before','dpe_energy_after','dpe_ges_after']) DEFAULT_SOURCE_RULES[key]=ordered([DOC_TYPES.DPE,DOC_TYPES.DIAGNOSTIC,DOC_TYPES.RT_EXISTING,DOC_TYPES.THERMAL,DOC_TYPES.MANUAL]);
const ALL=Object.values(DOC_TYPES).filter(x=>x!==DOC_TYPES.UNKNOWN);
for(const f of FIELD_DEFS) if(!DEFAULT_SOURCE_RULES[f.key]) DEFAULT_SOURCE_RULES[f.key]=ordered([...ALL.filter(x=>x!==DOC_TYPES.MANUAL),DOC_TYPES.MANUAL]);

export const REQUIRED_RE2020_RSET_FIELDS = ['housing_count','shab','bbio','bbio_max','cep','cep_max','cepnr','cepnr_max','dh'];
export const REQUIRED_RT2012_RSET_FIELDS = ['housing_count','shab','bbio','bbio_max','cep','cep_max','tic','tic_ref'];
export const REQUIRED_RSET_FIELDS = REQUIRED_RE2020_RSET_FIELDS;

function normAlias(s){ return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function rxEscape(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'); }
function aliasRegex(aliases){ return new RegExp(`\\b(?:${aliases.map(a=>rxEscape(normAlias(a))).join('|')})\\b`,'i'); }
const pair=(canon,aliases)=>[canon,aliasRegex(aliases)];

export const MATERIALS = [
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

export const STRUCTURES = [
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

export const HVAC = {
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

export const COOLING = [
  pair('PAC réversible',['pac réversible','pac reversible','pompe à chaleur réversible','pompe a chaleur reversible']),
  pair('Split / multisplit',['split','multi-split','multisplit']),
  pair('DRV/VRV',['drv','vrv']),
  pair('Groupe froid',['groupe froid','chiller','production eau glacée','production eau glacee']),
  pair('Plancher rafraîchissant',['plancher rafraîchissant','plancher rafraichissant']),
  pair('Rafraîchissement adiabatique',['rafraîchissement adiabatique','rafraichissement adiabatique','adiabatique']),
  pair('Réseau de froid urbain',['réseau de froid','reseau de froid']),
  pair('Climatisation active',['climatisation','climatiseur'])
];

export const WINDOW_MATERIALS = [
  pair('Bois/aluminium',['bois/aluminium','bois aluminium','bois-alu','bois alu','mixte bois alu']),
  pair('PVC',['pvc','menuiserie pvc','châssis pvc','chassis pvc']),
  pair('Aluminium',['aluminium','alu','menuiserie aluminium','châssis aluminium','chassis aluminium']),
  pair('Bois',['menuiserie bois','châssis bois','chassis bois','bois massif']),
  pair('Acier',['menuiserie acier','châssis acier','chassis acier'])
];
export const GLAZINGS = [
  pair('Triple vitrage',['triple vitrage','3 vitrages','triple verre']),
  pair('Double vitrage VIR',['double vitrage vir','vitrage vir','faible émissivité','faible emissivite','low-e','vitrage peu émissif','vitrage peu emissif']),
  pair('Double vitrage',['double vitrage','2 vitrages','4/16/4','4-16-4','4/20/4']),
  pair('Simple vitrage',['simple vitrage','simple verre'])
];
export const SHADINGS = [
  pair('Volet roulant',['volet roulant','volets roulants','vr motorisé','vr motorise']),
  pair('Volet battant',['volet battant','volets battants']),
  pair('BSO',['bso','brise-soleil orientable','brise soleil orientable']),
  pair('Store extérieur',['store extérieur','store exterieur','store banne']),
  pair('Persienne',['persienne','persiennes']),
  pair('Sans occultation',['sans occultation','sans protection mobile','aucune occultation','sans protection solaire'])
];
export const ENR_TYPES = [
  pair('Photovoltaïque',['photovoltaïque','photovoltaique','panneaux photovoltaïques','panneaux photovoltaiques','modules pv','centrale pv']),
  pair('Solaire thermique',['solaire thermique','cesi','capteurs solaires thermiques']),
  pair('Biomasse',['biomasse','bois énergie','bois energie','granulés bois','granules bois','plaquettes bois']),
  pair('Géothermie',['géothermie','geothermie','sondes géothermiques','sondes geothermiques']),
  pair('Réseau de chaleur renouvelable',['réseau de chaleur renouvelable','reseau de chaleur renouvelable','rcu renouvelable','taux enr&r','taux enr']),
  pair('Récupération de chaleur',['récupération de chaleur','recuperation de chaleur','récupération sur air extrait','recuperation sur air extrait','récupération eaux grises','recuperation eaux grises'])
];
export const FAN_TYPES = [
  pair('Brasseur d’air plafonnier',['brasseur d air','brasseur plafond','brasseur plafonnier','ventilateur de plafond']),
  pair('HVLS',['hvls','high volume low speed'])
];

export const ELEMENT_PATTERNS = {
  wall:/\b(?:facade|mur(?:s)?\s+exterieur(?:s)?|paroi(?:s)?\s+verticale(?:s)?|doublage\s+mur|ite|iti|bardage|mur\s+peripherique)\b/i,
  roof:/\b(?:toiture|toiture[- ]terrasse|terrasse|plancher(?:s)?\s+haut(?:s)?|combles?|rampants?|sarking|sous[- ]face\s+toiture|plafond\s+haut)\b/i,
  floor:/\b(?:plancher(?:s)?\s+bas|dalle\s+basse|dalle\s+sur|terre[- ]?plein|vide\s+sanitaire|sous[- ]sol|parking|garage|local\s+non\s+chauffe)\b/i,
  window:/\b(?:menuiserie(?:s)?(?:\s+exterieure(?:s)?)?|fenetre(?:s)?|baie(?:s)?(?:\s+vitree(?:s)?)?|chassis|ouvrant(?:s)?|vitrage(?:s)?)\b/i
};
