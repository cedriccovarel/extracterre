# ExtracTerre v2.2.3 — Stock C/m²

Nouveau champ canonique : **Stock C/m²** (`stock_c_per_m2`), unité `kgC/m²`, famille **Carbone**.

## Source automatique
Uniquement la dropzone **Analyse ACV** (et saisie/correction manuelle).

## Règle d'extraction initiale
Le parseur recherche strictement :

`Stockage carbone Stock,C (par m²) <valeur> kgC/m²`

Il ignore la ligne voisine `Stockage carbone Stock,C <valeur> kgC`, qui correspond au stockage carbone total et non à la valeur surfacique.

## Corpus initial validé
Étude ACV ClimaWin fournie :
- Bâtiment A : 50,4 kgC/m² — page 2
- Bâtiment B - 1 : 80,5 kgC/m² — page 15
- Bâtiment B - 2 : 77,0 kgC/m² — page 27
- Bâtiment C : 55,1 kgC/m² — page 39

Le repérage manuel, le surlignage direct PDF et l'OCR page restent disponibles pour corriger ou apprendre d'autres variantes documentaires.
