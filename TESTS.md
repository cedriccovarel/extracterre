# v1.1.14 — tests mode bêta propriétaire

- Vérifier que la croix ✕ est rendue uniquement avec `role=owner`.
- Vérifier qu’un profil équipe ne voit aucun contrôle bêta.
- Vérifier qu’un signalement sans bonne valeur crée un événement `beta_result_error`.
- Vérifier qu’un signalement avec bonne valeur peut appliquer la correction au tableau.
- Vérifier que la source, la page, la confiance et l’extrait sont enregistrés dans le journal.
- Vérifier que le pack contient `erreurs_beta_proprietaire.json`.
- Vérifier que le journal partagé reçoit les événements via le même mécanisme de synchronisation.

# v1.1.13 — tests anti-faux-positifs

Le banc interne contient désormais 143 tests, notamment : numéro d'article RT2012 ≠ Bbio, recommandations DPE ≠ ENR/refroidissement installé, titre de lot ACV ≠ IC lot, source non routée ≠ résultat final, Bbio Max compact, DH/DH Max, Tic/TicRef RT Existant et compositions vitrage plausibles.

# Tests — ExtracTerre v1.1.12

Les auto-tests sont exécutés au chargement et visibles dans **Diagnostics**.

État attendu : **117/117 auto-tests**.



## Régressions v1.1.6

- journal IndexedDB dans un store distinct de `workspaces` / `documents` ;
- `clearWorkspaceSnapshot()` ne touche pas au store du journal ;
- événements de correction, validation/rejet, Crible fin, analyse et erreur instrumentés ;
- synchronisation Supabase bornée par lots et déduplication par ID ;
- export du pack avec `PROMPT_NOUVEAU_CHAT.md` et fichiers JSON spécialisés ;
- profils propriétaire/équipe conservés uniquement sous forme d’empreintes PBKDF2 ;
- seconde autorisation du pack conservée uniquement sous forme d’empreinte ;
- aucune des clés d’accès fournies ne doit apparaître en clair dans les fichiers livrés ;
- schéma métier toujours fixé à 167 colonnes ;
- auto-tests moteur historiques toujours intégralement passants.

## Régressions v1.1.5

- écran d’accès présent avant initialisation de l’application ;
- vérification PBKDF2-SHA-256 salée, sans secret en clair dans le dépôt ;
- restauration IndexedDB déclenchée seulement après déverrouillage ;
- verrouillage manuel sans suppression du projet ;
- session d’accès limitée à `sessionStorage`.

## Régressions v1.1.4

- normalisation `4/16/4 Argon` -> `4.16.4 Ar` ;
- normalisation `4-16Ar-4` -> `4.16.4 Ar` ;
- priorité de la composition technique dans le parseur `Menuiseries vitrage` ;
- présence du bouton **Crible fin** sur les PDF analysés ;
- export Excel principal toujours basé sur les 167 champs, indépendamment des onglets d'affichage.

## Contrats v1.1.1

En plus des régressions historiques, la v1.1.1 vérifie automatiquement :

- exactement **167 champs** dans `FIELD_DEFS` ;
- au moins un tag/synonyme par champ ;
- reconnaissance de chacun des 167 intitulés exacts comme en-tête ;
- extraction générique de champs administratifs (`Code interne`, `Nom opération`) depuis un Contrat ;
- priorité de l'ordre des sources sur le score de confiance (`Contrat` avant `Livret d'opération` lorsque la règle le demande) ;
- maintien du seuil automatique à 90 % et conservation séparée des candidats intermédiaires ;
- classification `RSENV/RSNV` distincte ;
- plafond OCR global fixé à 1 worker dans le runtime ;
- syntaxe valide des modules et du bundle final.


Cas couverts notamment :

- Bbio / Bbio Max / Cep / Cep Max / Cepnr / Cepnr Max ;
- DH RE2020 et Tic/Tic ref RT2012 ;
- SHAB issue exclusivement du Chapitre 2 / colonne SU-SURT-SHAB ;
- aucun calcul SHAB depuis les tableaux DH/Tic ;
- registre maître multi-bâtiments : `4 bâtiments annoncés = 4 lignes export` ;
- noms de bâtiments courts et descriptifs conservés ;
- sorties détaillées RT2012 déjà en kWhEP : **pas de reconversion ×2,3** ;
- sorties détaillées RE2020 en kWhEF : conversion uniquement lorsque nécessaire ;
- détail Cep chauffage/refroidissement/ECS/éclairage/auxiliaires + ventilation par énergie ;
- routage interdisant les typologies depuis un RSET ;
- seuil 89 % rejeté / 90 % retenu ;
- séparation stricte façade / plancher bas / plancher haut ;
- bibliothèque isolants 150 variantes cœur + 23 variantes PUR ;
- fallback bibliothèque uniquement en absence de valeur R directe ;
- priorité aux données documentaires directes du RSET ;
- tolérance contrôlée aux variantes / fautes légères de produits ;
- absence de R inventé si l'épaisseur n'est pas identifiable.

## Régression réelle BREUILLET

Document : `Xml_RSET_EC183200 BREUILLET V8.pdf`.

Attendus validés :

| Bâtiment | Logements | SHAB | Bbio / Max | Cep / Max | Tic / Tic ref |
| --- | ---: | ---: | --- | --- | --- |
| Bat 100 | 15 | 778,8 | 52 / 72 | 56,2 / 74,8 | 26,3 / 31 |
| Bat 200 | 12 | 687,3 | 68,9 / 72 | 62,6 / 71,5 | 26 / 30,8 |
| Bat 300 | 11 | 673,8 | 53,6 / 72 | 51,5 / 69,3 | 26 / 30,8 |
| Bat 400 | 52 | 3 035,3 | 46,2 / 72 | 62,6 / 74,1 | 28,7 / 30,1 |

La régression vérifie aussi les parois représentatives, les menuiseries, la génération gaz/chaudière condensation, la VMC Hygro B, l'absence de refroidissement et les postes Cep détaillés par bâtiment.

### Regroupement bâtiments v1.0.7
- `Bât A`, `Bâtiment A`, `BAT A` -> fusion automatique sur le maître RSET.
- `B` et `B1` -> restent séparés automatiquement et sont proposés comme rapprochement à vérifier.
- Fusion manuelle `B + B1` -> une seule ligne finale contenant les données complémentaires des deux lignes.
- Total auto-tests de la v1.0.7 : 47/47.


### Cep détaillés, incrémental et tags — v1.0.8
- reconstruction des lignes `Bâtiment / (nom) / valeurs` éclatées par les extracteurs PDF ;
- `Cep,nr` et `Cep,nr max` directs ;
- Cep refroidissement / éclairage / auxiliaires ventilation / auxiliaires distribution / déplacements ;
- séparation stricte de bâtiments A/B avec identifiants courts ;
- réutilisation du cache d'un document déjà analysé ;
- analyse d'un seul nouveau document lorsqu'il complète un corpus déjà traité ;
- tags eaux grises / biodiversité / habitat sénior / QAI ;
- tag dynamique de gain Cep.

Régressions réelles réalisées sur les sorties détaillées RE2020 AVANNE et CHANCELADE, en complément de BREUILLET RT2012.

**Total v1.0.8 : 61/61 auto-tests.**

## OCR v1.0.10

- page PDF vide / sans couche texte => OCR automatique requis ;
- page numérique dense et propre => OCR automatique non requis ;
- mode `always` => OCR forcé ;
- mode `off` => aucun OCR ;
- conservation de la couche PDF lorsque sa qualité est supérieure ;
- worker OCR réutilisé puis terminé en fin de document ;
- syntaxe du bundle final contrôlée par `node --check`.


## Mémoire et OCR — garde-fou introduit en v1.1.2 (historique)

- Aucun `Promise.all` n’est utilisé pour ouvrir les documents à analyser : **1 document à la fois**.
- `readPdf` crée son worker Tesseract uniquement à la première page nécessitant réellement l’OCR.
- Une file globale limite strictement Tesseract à **1 worker actif** en analyse standard.
- Chaque canvas OCR est détruit après la page ; chaque page PDF.js reçoit `cleanup()` ; le PDF reçoit `cleanup()` puis `destroy()` en fin de document.
- `page.items`, la copie OCR brute, le workbook SheetJS et le DOM XML ne sont pas conservés après extraction.
- Après parsing, le document est réduit à un index texte compact avant checkpoint IndexedDB.
- Le snapshot de session n’embarque pas une seconde copie de l’objet consolidé complet.
- L’analyse incrémentale ne relit pas les documents déjà checkpointés.

> Historique : v1.0.11 ouvrait un worker par PDF ; v1.1.1 plafonnait l’OCR mais ouvrait encore tous les PDF en parallèle. v1.1.2 supprime cette dernière source majeure de saturation mémoire.

## v1.0.12
- Vérification syntaxique des modules `app.js`, `readers.js`, `exporter.js` et du bundle final.
- Vérification de non-régression métier : 67/67 auto-tests.
- Vérification statique de la présence du timeout 5 minutes, du statut `timeout`, de la relance illimitée, du parcours récursif des dossiers, du bouton nouveau projet et de l'export multi-projets.


## v1.0.13 — régression import
- clic sur le fond de la dropzone : un seul appel au sélecteur fichier, sans récursion ;
- clic Ajouter des fichiers : aucun déclenchement du sélecteur dossier ;
- clic Ajouter un dossier : aucun déclenchement du sélecteur fichier ;
- dépôt de fichiers : fallback DataTransfer.files ;
- dépôt de dossiers : API FileSystemHandle ou webkitGetAsEntry, parcours récursif.


## v1.0.14 — réanalyse ciblée et carbone détaillé
- OCR maximal manuel : toutes les pages, résolution renforcée, sans timeout.
- Filtrage : une proposition n’est créée que pour un champ actuellement vide et non corrigé manuellement.
- Validation utilisateur : ✓ ajoute l’occurrence à 100 % de priorité ; ✕ mémorise le refus.
- Aucun écrasement automatique d’une donnée déjà consolidée.
- Extraction IC composants lots 1 à 13 à partir des tableaux récapitulatifs RSEE.
- Extraction IC énergie : chauffage, ECS, refroidissement, auxiliaires ventilation, auxiliaires distribution, déplacements et total bâtiment.
- Extraction IC chantier.
- Régression réelle `Etude Projet - LOT A.pdf` : IC composants 547,3 ; IC énergie 56,35 ; chauffage 28,12 ; ECS 15,42 ; refroidissement 2,53 ; aux. ventilation 3,80 ; aux. distribution 0,2530752 ; déplacements 0,5061504 ; chantier 7,55.
- **79/79 auto-tests métier**.


## v1.0.15 — contrôles UI
- Titre et identité ExtracTerre présents dans l’en-tête.
- Bouton ✎ de renommage présent sur chaque projet.
- Le nom personnalisé est prioritaire dans l’export.
- Le détail des fichiers se trouve après la barre de progression dans le DOM.

## Régression réelle v1.0.19
27/27 contrôles réussis sur 5 documents réels :
- RSEE Roubaix multi-bâtiments : Cepnr/Cepnr max, Cep refroidissement, éclairage, auxiliaires ventilation et SHAB.
- RSET Chancelade : bâtiments A/B, Cepnr max, Cep détaillés, isolation toiture.
- RSEE/RSET Avanne : bâtiments A/B, Cepnr/Cepnr max, Cep éclairage et auxiliaires distribution.
- RSEE étude projet : IC énergie détaillé chauffage, ECS, refroidissement, auxiliaires ventilation/distribution et déplacements.
- Étude RT existant : classification, laine de roche, épaisseur 140 mm, R 3,95 et chaudière condensation.

Les fichiers de test ne sont pas inclus dans le dépôt GitHub.

## v1.0.20 — contrôles ajoutés
- 101/101 auto-tests moteur.
- Surface bâtiment depuis `SRef / usage principal`, `Sref :`, `Surface du bâtiment`, `Surface habitable`, `SHAB/SU`, `Shab m²`, `SRT` scindée et autres libellés explicites.
- Aucune surface issue d’un ratio 1/6, d’une surface de façade/paroi ou d’un indicateur exprimé en kWh/m²shab.
- Recherche libre : SRef/SHAB retrouvés, `RE2020` jamais interprété comme 2020 et valeurs IC/Cep de tableaux éclatés recherchables.
- Régression réelle sur l’étude thermique Beccaria : **Shab = 5 110,25 m²** retenue au lieu de la valeur de synthèse arrondie 5 110 m².
- Régressions réelles conservées : BREUILLET 4 bâtiments (778,8 / 687,3 / 673,8 / 3 035,3 m²), ROUBAIX (1 138,5 / 695,4 m²), CHANCELADE (1 169,1 / 1 323,3 m²), AVANNE (1 518,2 / 1 391,9 m²) et RSEE LOT A (Sref 330,8 m² + IC détaillés).
- Contrôle structurel UI : 42 hooks statiques présents, aucun ID dupliqué, 6 vues correctement raccordées.
- Contrôle syntaxique `node --check` sur le bundle et les modules principaux.


## v1.1.3 — parallélisme borné et ETA
- Vérifier que le mode Équilibré est sélectionné par défaut et annonce 3 documents / 1 OCR.
- Vérifier qu’un lot supérieur à 3 fichiers n’a jamais plus de 3 documents en état `reading` en mode Équilibré.
- Vérifier les modes Sécurisé (1/1) et Rapide (5/2).
- Vérifier que le compteur affiche terminés / actifs / file OCR pendant l’analyse.
- Vérifier qu’après quelques secondes l’interface affiche durée totale estimée, temps restant et heure de fin estimée.
- Vérifier que l’estimation se termine par « Analyse terminée en … ».
- Vérifier que le checkpoint IndexedDB reste écrit après chaque document dans les trois modes.


## Tests v1.1.8
- Bao Evolution classé comme étude thermique.
- Ubat état initial et après travaux.
- Température intérieure non confondue avec Tic.
- Vitrage « Double +15mm » normalisé sans inventer 4.x.4.
- Régression globale : 117/117 tests.



## Tests v1.1.10 — Bao Evolution approfondi

Le moteur vérifie désormais les scénarios spécifiques suivants : Ubat avant/après via le parseur Bao dédié ; Cep total avant/après ; consommations d’énergie primaire par poste ; GES conservé sans faux mapping DPE/IC ; contrôle de somme des postes ; Cep électrique mono-énergie ; reconstitution `Double +15mm` sans invention de composition ; absence de confusion entre aluminium du volet et matériau de menuiserie ; rejet des listes d’exemples comme vecteur réel ; rejet d’une période de construction comme année exacte ; OCR ciblé d’un tableau énergie ou Ubat incomplet ; déduction d’un bâtiment collectif unique.

Jeu de référence : `data/bao-evolution-reference.json`. Résultat attendu du lot d’auto-tests : **133/133**.

## Tests v1.1.9 — Aperçu intégré
- bouton `👁 Aperçu` présent pour chaque fichier encore disponible en mémoire ;
- aucun appel à `window.open` pour l’aperçu ;
- PDF rendu dans `#filePreviewDialog` via une URL Blob locale ;
- révocation de l’URL Blob à la fermeture ;
- XML limité à 500 000 caractères pour éviter une forte consommation mémoire ;
- Excel limité à 100 lignes × 40 colonnes avec sélection de feuille ;
- aperçu désactivé après restauration IndexedDB tant que le fichier brut n’est pas redéposé ;
- Crible fin, analyse et suppression du document restent fonctionnels.


## Tests v1.1.11
- aucune section de résultats dédiée Bao ;
- page courte propre => pas d’OCR automatique ;
- page critique Ubat/énergie incomplète => OCR ciblé conservé ;
- jeu Romorantin conservé comme fixture de non-régression uniquement.


## Tests v1.1.12 — réactivité

- Les 133 auto-tests métier existants doivent rester au vert.
- Benchmark de référence sur le rapport thermique rénovation Romorantin : le parsing synchrone doit être réduit d’un ordre de grandeur par rapport à la v1.1.11, sans perte d’occurrences.
- Test de charge de consolidation : 30 000 occurrences / 300 bâtiments doivent être consolidables sans blocage multi-secondes du thread principal.
- Vérifier que le bundle et les ressources sont bien cache-bustés en `1.1.12`.
