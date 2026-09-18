# ExtracTerre v2.1.1 — correctif complet

Cette révision conserve l’architecture Cloud v2.1 et corrige le formulaire propriétaire de correction/apprentissage (`missing is not defined`). Le bundle a été reconstruit depuis la source corrigée. Les 167 champs, les patchs documentaires et le pipeline hybride restent inchangés.

# Release ExtracTerre v2.1.0

Base de départ vérifiée : `ExtracTerre_GitHub_v1_1_23(1).zip`.

## Fonctions conservées

Aucun fichier de la base v1.1.23 n'a été supprimé. La V2.1 conserve notamment : catalogue 167 champs, mémoire d'apprentissage, correction par surlignage, journal d'amélioration local/partagé, pack d'amélioration, patchs JSON, multi-bâtiments, Crible fin, pause/arrêt, reprise IndexedDB, exports et authentification existante.

## Évolutions principales

- calcul `Hybride auto / Local / Serveur` ;
- déport de la lecture PDF/OCR vers GitHub Actions ;
- Supabase privé comme sas temporaire ;
- un seul PDF distant simultané pour préserver le quota gratuit ;
- seuil auto distant : 6 MiB, plafond distant : 700 MiB, chunks : 45 MiB ;
- fallback local automatique en mode hybride ;
- index texte structuré compressé renvoyé au navigateur ;
- PDF bruts supprimés après traitement ; index distant supprimé après récupération ;
- nettoyage opportuniste des artefacts abandonnés de plus de 24 h ;
- DH/DHmax U22Win couplés sur la même ligne ;
- `minAppVersion` des patchs réellement contrôlé.

## Validation effectuée

- `runSelfTests()` : **149/149** ;
- `test_v1_1_22_learning.mjs` : OK ;
- `test_v1_1_23_memory.mjs` : OK ;
- `test_v2_1_hybrid.mjs` : OK ;
- 167 champs et ordre maître identiques dans config/catalogue/fichier colonnes : OK ;
- worker PDF natif : Poppler, 1 page, texte + positions extraits : OK ;
- worker PDF scanné : Tesseract fra+eng, OCR utilisé, texte + positions extraits : OK ;
- syntaxe JavaScript modules et bundle : OK ;
- bundle régénéré depuis les sources V2.1 : OK.

## Déploiement

Le ZIP du site contient `DEPLOIEMENT_HYBRIDE_V2_1.md`, la migration SQL et les 5 Edge Functions à déployer. Le worker est également fourni séparément pour le dépôt privé `extracterre-worker`.
