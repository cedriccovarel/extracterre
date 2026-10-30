// ExtracTerre v2.14.0 — fiche Salesforce : statuts, code EVA, société principale du MOA, version du référentiel, profil spécifique ;
// recherche « Sécurité des logements » : « A2P » ou « BP1 » seuls = non conforme, clôtures de chantier écartées. Données FICTIVES.
import assert from 'node:assert/strict';
import {APP_VERSION,FIELD_DEFS} from './js/config.js';
import {salesforceEvaluationToPaste,parseFreePaste,freePasteValues} from './js/collage-libre.js';
import {SECURITY_GRID,normalizeGrid,runSearchGrid,searchCellValue} from './js/recherches.js';
import {textDoc} from './test_fixtures_v2_3.mjs';
let n=0; const eq=(a,b,m)=>{ assert.deepEqual(a,b,m); n++; };
eq(APP_VERSION,'2.14.2','version');
eq(FIELD_DEFS.length,212,'aucune colonne ajoutée');
const page=`Évaluation
EVA-009991
Onglets
Détails
Statut
Analyse réalisée
Chargé de suivi d'opération
Sous-traitant externe
Performance thermique
Planchers hauts
OPE-009991
Les Fictifs
13000 FICTIVILLE
Statut du contrat 00009991 : En cours
Référentiel BEE Fictif - Version du 01/01/2025
Profil spécifique :
Aucun
Performance :
Voir Mentions
.
Maître d'ouvrage : BAILLEUR FICTIF
Société principale du MOA : GROUPE FICTIF`;
const v=freePasteValues(parseFreePaste(salesforceEvaluationToPaste(page).text)).find(x=>x.building==='').values;
eq([v.internal_code,v.evaluation_internal_code,v.contract_number,v.contract_status,v.evaluation_status],['OPE-009991','EVA-009991','00009991','En cours','Analyse réalisée'],'identifiants et statuts, sans écraser l’OPE');
eq([v.owner_company,v.owner_main_company,v.reference_version,v.specific_profile],['BAILLEUR FICTIF','GROUPE FICTIF','Version du 01/01/2025','Aucun'],'maître d’ouvrage et société principale distincts, version, profil');
// Recherche Sécurité.
const run=(txt,grid=SECURITY_GRID)=>{ const d=textDoc('c1','CCTP FICTIF.pdf',null,txt); d.status='ready'; const r=runSearchGrid(grid,[d]); return id=>searchCellValue(grid.criteria.find(c=>c.id===id),r.criteria[id]); };
eq(run('Portes palières\nBloc porte A2P BP1 avec serrure 3 points')('porte_a2p'),'Oui','A2P BP1 : conforme');
eq(run('Portes palières\nBloc porte BP2 certifié A2P')('porte_a2p'),'Oui','BP2 … A2P : conforme');
eq(run('Portes palières\nSerrure de porte certifiée A2P')('porte_a2p'),'Non conforme','A2P seul : non conforme');
eq(run('Portes palières\nBloc porte BP1')('porte_a2p'),'Non conforme','BP1 seul : non conforme');
eq(run('Installations de chantier\nClôture de chantier hauteur 2,00 m\n\nAménagements\nClôture rigide hauteur 1,20 m')('abords_cloture'),'Hors seuil (1.2 m)','clôture de chantier écartée, clôture définitive gardée');
eq(run('Barrière Heras\nClôture hauteur 2,00 m')('abords_cloture'),'','barrière de chantier à proximité : écartée');
// Grille déjà enregistrée (anciens mots-clés) : mise à jour au chargement, termes de l'utilisateur gardés.
const old=normalizeGrid({id:'securite-logements',name:'Sécurité',criteria:[{id:'porte_a2p',theme:'Portes',label:'A2P',keywords:['re:\\ba2p\\s*(?:bp\\s?[123]|\\*|[123]\\s*etoile)','re:\\bbp\\s?[123]\\b','re:\\ba2p\\b','porte blindée'],context:['porte']},{id:'abords_cloture',theme:'Abords',label:'Clôture',kind:'number',unit:'m',min:1.8,keywords:['cloture'],context:['hauteur']}]});
eq([old.criteria[0].keywords.includes('porte blindée'),old.criteria[0].keywords.includes('re:\\ba2p\\b'),old.criteria[0].weak.length,old.criteria[1].exclude.includes('chantier')],[true,false,2,true],'grille enregistrée mise à jour');
eq(run('Portes palières\nSerrure A2P',old)('porte_a2p'),'Non conforme','grille enregistrée : A2P seul non conforme');
console.log(`v2.14.2 — ${n} vérifications OK (données fictives)`);
