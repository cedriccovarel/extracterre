# ExtracTerre v2.2.9 — colonnes Excel plus souples

Cette version améliore le bouton **Coller depuis Excel**.

## Principe

ExtracTerre continue à privilégier les intitulés exacts historiques. Si un export change ses noms de colonnes, le moteur tente ensuite :

1. les alias connus entre ancien et nouvel export ;
2. une normalisation des préfixes métier (`Opération`, `Opportunité`, `Nom de la société`, etc.) ;
3. un rapprochement lexical conservateur uniquement quand le score est assez élevé et non ambigu.

Le moteur ne crée aucun nouveau champ métier à partir d’un intitulé inconnu. Une colonne sans équivalent fiable reste dans la liste **Non reconnus**.

Les rapprochements automatiques sont indiqués par **≈** dans l’aperçu du collage.
