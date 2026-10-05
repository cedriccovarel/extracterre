# ExtracTerre 2.2.1 — Architecture des parseurs spécialisés

Chaque document doit être déposé dans sa famille documentaire. Le choix utilisateur est prioritaire sur la classification automatique.

## RSET / RSEE RE2020
Lecture structurée Chapitre 2, résultats détaillés, Chapitre 4, multi-bâtiments/multi-zones. Recherche systématique des surfaces/logements, Bbio/Bbio Max, Cep/Cep Max, Cepnr/Cepnr Max, DH/DHmax (même ligne du cas défavorable) ou Tic/Tic ref selon réglementation, enveloppe et systèmes.

## RSET RT2012
Branche séparée Th-BCE 2012 : Bbio/Bbio max, Cep/Cep max, Tic/Tic ref, surfaces, enveloppe, systèmes. Aucune confusion avec RE2020.

## THCex / RT Existant
Analyse avant/après : SHAB/SU/SURT/SRT selon présence, Ubat avant/après, Cep avant/après, enveloppe, chauffage, ECS, ventilation, refroidissement et ENR explicitement présents.

## RSENV / RSEE environnemental
Analyse ACV structurée, priorité niveau bâtiment. IC composants, chantier, énergie, lots 1 à 13 et postes énergie. Les tableaux zone/parcelle ne doivent pas remplacer les valeurs bâtiment.

## CCTP
Recherche exhaustive des caractéristiques explicites de structure/enveloppe, isolants/épaisseurs/R, menuiseries et systèmes CVC/ECS/ventilation/refroidissement/ENR. Les recommandations génériques ne deviennent pas des données projet.

## DPGF
Recherche par lots et désignations explicites des produits/équipements utiles aux 168 champs, sans utiliser automatiquement les montants comme données thermiques.

## 3CL
Route distincte des DPE : surface, état énergétique, systèmes réellement décrits, consommations et classes lorsque les libellés sont explicites. Les textes de recommandation ne sont pas considérés comme équipements présents.

## DPE
Extraction prioritaire des classes Énergie/GES avant/après lorsque la phase est explicite, plus données générales directement établies par le diagnostic. Les recommandations sont exclues du parseur systèmes générique.

## Analyse ACV
Extraction des indicateurs carbone et de leurs ventilations explicites ; compatible avec les structures RSENV lorsqu'elles sont présentes.

## Documents annexes
Conserve la classification automatique et l'ancien parseur polyvalent pour études thermiques non standardisées, contrats, notices, plans et autres pièces.

## Contrôle de complétude
Chaque famille spécialisée dispose d'une liste de champs attendus. Après parsing, l'interface affiche le nombre de champs attendus effectivement trouvés et permet d'identifier les manquants pour correction/apprentissage.


## V2.2.1 — listes blanches strictes
Chaque famille dispose maintenant d'une liste blanche de champs autorisés. Une occurrence hors périmètre est supprimée même si elle provient d'un tag générique, d'un patch ou d'un sous-parseur. Exemples : RSENV n'autorise pas DH/Bbio/Cep ; RSET RE2020 n'autorise pas Tic ni IC ; RT2012 n'autorise pas DH/Cepnr/IC ; CCTP et DPGF n'autorisent aucun indicateur réglementaire de performance.

### Analyse ACV — Stock C/m²
Le parseur ACV recherche explicitement `Stockage carbone Stock,C (par m²)` et restitue la valeur en kgC/m². Le Stock,C total en kgC est exclu.
