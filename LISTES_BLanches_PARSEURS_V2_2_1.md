# ExtracTerre 2.2.1 — champs autorisés par parseur

Cette version applique une liste blanche stricte par famille documentaire. Les champs hors périmètre sont ignorés, y compris s'ils sont trouvés par un tag générique ou un patch.

## RSET / RSEE RE2020
Projet, opération, bâtiment, nombre de logements, surface bâtiment, DH, DH Max, logements traversants/non traversants, brasseurs d'air, structure/enveloppe, menuiseries, chauffage après, ECS après, refroidissement, ventilation, Bbio/Bbio Max/Gain, Cep/Cep Max/Gain, Cepnr/Cepnr Max/Gain, consommations Cep détaillées par poste/vecteur, ENR.

## RSET RT2012
Projet, opération, bâtiment, nombre de logements, surface bâtiment, Tic, Tic ref, structure/enveloppe, menuiseries, systèmes, Bbio/Bbio Max/Gain, Cep/Cep Max/Gain, consommations Cep détaillées, ENR. Pas de DH, pas de Cepnr, pas d'IC.

## THCex / RT Existant
Projet, opération, bâtiment, nombre de logements, surface, année de construction, enveloppe, systèmes avant/après, Ubat avant/après, Cep avant/après final, ENR.

## RSENV / RSEE environnemental
Projet, opération, bâtiment, IC composants bâtiment, IC chantier, lots 1 à 13, IC énergie bâtiment et ventilation énergie par poste. Aucun DH, Bbio, Cep, Cepnr, Tic, Ubat ou DPE.

## CCTP
Projet, opération, bâtiment, structure/enveloppe, isolants/épaisseurs/R, menuiseries, chauffage, ECS, refroidissement, ventilation, ENR. Aucun indicateur réglementaire Bbio/Cep/DH/Tic/IC/DPE.

## DPGF
Projet, opération, bâtiment, structure/enveloppe, isolants/épaisseurs/R, menuiseries, chauffage, ECS, refroidissement, ventilation, ENR. Les montants restent gérés par l'analyse économique dédiée. Aucun indicateur réglementaire.

## 3CL
Projet, opération, bâtiment, surface, année de construction, enveloppe, systèmes avant/après, ENR, classes DPE énergie/GES avant/après. Aucun Bbio/Cep/DH/Tic/IC.

## DPE
Projet, opération, bâtiment, surface, année de construction, classes DPE énergie/GES avant/après. Aucun Bbio/Cep/DH/Tic/IC.

## Analyse ACV
Projet, opération, bâtiment, IC composants, IC chantier, lots 1 à 13, IC énergie et postes énergie. Aucun Bbio/Cep/DH/Tic/DPE.

## Documents annexes
Pas de liste blanche spécialisée : l'ancien parseur polyvalent reste disponible pour les documents non standardisés.
