# ExtracTerre 2.2.2 — correction directement dans le PDF

## Principe

Pour les PDF natifs, la fenêtre de correction affiche maintenant la page elle-même. PDF.js rend l'image du PDF et une couche texte transparente, sélectionnable, est superposée à la page.

1. choisir la pièce ;
2. choisir la page ;
3. sélectionner la bonne donnée directement dans la page PDF ;
4. cliquer sur `Utiliser le surlignage` ;
5. vérifier/corriger la valeur proposée ;
6. enregistrer la correction et l'apprentissage.

Le journal mémorise le texte, la page, le contexte et les rectangles normalisés du surlignage dans la page.

## OCR à la demande

Le bouton `OCR cette page` ne traite que la page affichée. Il est destiné aux scans ou aux PDF dont la couche texte native est mauvaise. Le bouton `Texte PDF` permet de revenir immédiatement à la couche texte native.

## Garde-fous

- pas d'OCR systématique pour les PDF natifs de bonne qualité ;
- aucune modification des parseurs spécialisés et de leurs listes blanches ;
- aucune modification du pipeline Cloud V2.1 ;
- fallback texte conservé pour les fichiers non PDF ou les fichiers restaurés sans binaire source.
