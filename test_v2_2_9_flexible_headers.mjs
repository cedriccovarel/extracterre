import assert from 'node:assert/strict';
import {APP_VERSION,matchFieldByHeaderDetailed} from './js/config.js';
assert.equal(APP_VERSION,'2.3.11');
const expected={
  'Numéro du contrat':'contract_number',
  'Opération: Code interne':'internal_code',
  'Statut':'contract_status',
  'Opération: Étape':'stage',
  'Opportunité: Accepté le':'case_accepted_date',
  "Date de création de l'affaire":'case_creation_date',
  "Nom de la société: Société principale: Nom de la société":'owner_main_company',
  'Nom de la société: Nom de la société':'owner_company',
  'Nom de la société: Hiérarchie':'owner_hierarchy',
  "Opportunité: Nom de l'affaire":'case_name',
  "Nom de l'opération":'operation_name',
  "Département de l'opération":'department',
  'Référentiel':'reference_name',
  'Version':'reference_version',
  'Opération: Mentions':'mentions',
  'Opération: Performance':'performance',
  'Opération: Profil choisi':'selected_profile',
  'Opération: Évaluation: Code interne':'evaluation_internal_code',
  'Opération: Évaluation: Statut':'evaluation_status',
  "Opération: Avancement de l'opération":'progress_status',
  'Année':'construction_year',
  'Planchers hauts structure':'roof_structure',
  'Planchers hauts type isolant':'roof_insulation',
  "Parois verticales type d’isolant":'wall_insulation',
  'Planchers bas type isolant':'floor_insulation',
  'Menuiseries extérieures matériau':'window_material',
  'Cep,nr projet':'cepnr',
  'DPE énergie après travaux final':'dpe_energy_after'
};
for(const [header,key] of Object.entries(expected)) assert.equal(matchFieldByHeaderDetailed(header)?.def?.key,key,header);
// v2.3.8 — ces colonnes existent désormais : elles doivent être reconnues.
assert.equal(matchFieldByHeaderDetailed('IC énergie max')?.def?.key,'ic_energy_max');
assert.equal(matchFieldByHeaderDetailed('IC construction max')?.def?.key,'ic_construction_max');
for(const header of ['Région de l’opération','Code postal']) assert.equal(matchFieldByHeaderDetailed(header),null,`Ne pas inventer un rapprochement pour ${header}`);
console.log('OK v2.2.9 flexible headers');
