# ExtracTerre v2.2.8 — apprentissage depuis l'analyse manuelle

L'outil **Analyse manuelle** alimente désormais la même mémoire d'apprentissage documentaire que la fenêtre de correction.

## Comportement
- Sélection d'un champ dans Thermique / Carbone / Enveloppe.
- Surlignage dans un PDF ou clic sur une cellule Excel.
- La valeur est affectée au champ et au bâtiment.
- L'emplacement documentaire est enregistré comme `parser_location_learning` puis renforcé dans la mémoire locale.
- Après plusieurs confirmations cohérentes, ce profil peut augmenter la priorité/confiance de candidats trouvés au même endroit ou dans un contexte similaire.

## Saisie au clavier
La saisie directe reste possible. Elle est journalisée comme apprentissage de correction, mais elle ne peut pas enseigner une localisation dans le document puisqu'aucune zone source n'est sélectionnée.
