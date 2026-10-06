# ExtracTerre v2.2.4 — Analyse manuelle + ACV renforcée

## Analyse manuelle de document
- dropzone distincte `LIBRE` ;
- classification automatique ;
- moteur générique historique, sans whitelist spécialisée ;
- OCR ciblé, Crible fin, surlignage PDF et mémoire d’apprentissage conservés.

## ACV ClimaWin
Le parseur reconnaît les synthèses multi-bâtiments et rattache les valeurs au bon bâtiment :
- IC énergie bâtiment ;
- IC composants bâtiment ;
- IC chantier ;
- Stock C/m² ;
- IC composants lots 1 à 13 ;
- IC énergie chauffage, refroidissement, ECS, auxiliaires ventilation, auxiliaires distribution et déplacements.

Pour les bâtiments multi-zones, les postes énergie sont agrégés avec les Sref des zones lorsque ces surfaces sont disponibles.
