# v1.1.14 — Mode bêta propriétaire et remontée d’erreurs champ par champ

- Mode bêta visible uniquement pour le rôle propriétaire.
- Ajout d’une croix ✕ sur chaque résultat renseigné pour signaler un résultat erroné.
- Fenêtre de retour avec valeur détectée, source/page/confiance, extrait source, type d’erreur, bonne valeur facultative et commentaire.
- La bonne valeur peut être appliquée immédiatement au résultat courant et enregistrée comme correction manuelle.
- Nouvel événement `beta_result_error` synchronisé dans le journal local/distant.
- Le pack d’amélioration contient désormais `erreurs_beta_proprietaire.json` et son prompt demande de traiter ces retours en priorité.
- Compteur des erreurs bêta ajouté dans Aide / FAQ uniquement pour le propriétaire.

# v1.1.13 — Bibliothèque documentaire stricte et réduction des faux positifs

- Routage strict : une source non autorisée ne peut plus remplir automatiquement un champ ; elle reste disponible dans « À vérifier ».
- Bibliothèque de signatures documentaires ajoutée (`data/document-signatures.json`) avec familles RSET RT2012, RE2020/RSEE, RSENV/ACV, RT Existant, études thermiques rénovation, Bao-like, DPE 2021 et tableaux de surfaces.
- Audit corpus multi-familles ajouté (`data/corpus-audit-v1.1.13.json`).
- Classification corrigée : une étude thermique contenant Q4Pa/perméabilité n'est plus classée comme rapport d'imperméabilité ; « Réglementation Thermique Existante » est reconnue comme RT Existant.
- Parseur de tags générique limité dans les documents techniques : les champs thermiques/carbone/systèmes sont réservés aux parseurs métier spécialisés.
- RSET/RE2020 : lecture compacte `Bbio / Bbio Max / Gain` renforcée ; `DH / DH max` corrigé.
- RT Existant : lecture Tic/TicRef depuis les lignes de tableau `Groupe ... °C`.
- Carbone : un simple titre `LOT : 08 - CVC` ne peut plus devenir une valeur `IC composants lot 8`.
- DPE : recommandations et critères (« étiquette D minimum », « si climatisation », exemples ENR) exclus des résultats.
- RSENV/ACV : lignes INIES de mise à disposition d'énergie exclues de la détection de systèmes.
- Vitrage : les numéros de section/date (`7.1.1`, `20.1.4`, `05-20-15`) ne sont plus interprétés comme compositions de vitrage.
- 141 tests moteur.

# v1.1.12 — stabilité CPU / interface réactive

- Correction du blocage « page ne répond pas » lors du lancement d’analyse.
- Regroupement des items PDF.js optimisé : suppression du parcours quadratique `lines.find()` par fragment.
- Tags des 167 champs précompilés et indexés par préfixe au lieu de retraiter 167 définitions sur chaque ligne.
- Recherche floue des isolants optimisée : fenêtres lexicales bornées au lieu d’un balayage Levenshtein de toutes les sous-chaînes.
- Consolidation indexée par champ + bâtiment, adaptée aux lots de plusieurs centaines de fichiers.
- Pauses coopératives entre lecture, classification, parsing et sauvegarde IndexedDB.
- Aucun chapitre spécifique Bao dans les résultats : les règles restent génériques aux études thermiques structurées.
- Cache-busting et numéro de version harmonisés en 1.1.12.

# v1.1.11 — stabilité analyse & généralisation études thermiques rénovation

- Suppression du bloc de résultats dédié « Compléments Bao Evolution » : aucune famille documentaire n'a désormais son propre chapitre d'affichage.
- Les règles apprises sur le rapport de référence sont intégrées aux parseurs génériques d'études thermiques de rénovation structurées.
- OCR automatique fortement allégé : les pages courtes mais propres (titres, graphiques, pages de transition) ne déclenchent plus Tesseract.
- OCR conservé sur les pages réellement critiques et incomplètes : Ubat, consommations par poste, GES, enveloppe, vitrages et systèmes.
- Yield navigateur entre chaque page PDF afin de garder l'interface réactive pendant les gros documents.
- Le fichier Bao Romorantin reste uniquement un jeu de non-régression, pas un chapitre ni un format de sortie spécial.

# v1.1.10

- Parseur dédié Bao Evolution / étude thermique rénovation.
- Lecture explicite Ubat avant/après depuis les blocs `COEFFICIENT UBAT`.
- Lecture des consommations d’énergie primaire par poste avant/après : chauffage, refroidissement, ECS, éclairage, auxiliaires, ventilateurs, autres usages et total.
- Mapping vers les colonnes 167 existantes quand une correspondance métier existe ; conservation séparée des postes sans colonne dédiée.
- Bilan GES conservé sous plusieurs formes (kgCO2e/m².an, tCO2e/an, kgCO2e/an du bloc évolution) sans faux mapping DPE/IC.
- Contrôles croisés : somme des postes vs total et récapitulatif final vs tableau détaillé.
- Détection des incohérences internes du rapport sans fusion silencieuse.
- Garde-fous : température intérieure ≠ Tic ; période de construction ≠ année exacte ; matériau du volet ≠ matériau de menuiserie ; listes d’exemples ≠ vecteur réel ; vitrage incomplet non inventé.
- OCR ciblé renforcé sur bilans énergie/GES, Ubat, vitrages, parois et systèmes Bao incomplets.
- Ajout du jeu de référence `data/bao-evolution-reference.json`.
- 133 auto-tests métier.

# v1.1.9

- Ajout d’un bouton **👁 Aperçu** sur chaque fichier chargé.
- Aperçu ouvert dans une fenêtre modale ExtracTerre, sans nouvel onglet ni nouvelle page.
- PDF affichés avec le lecteur PDF intégré du navigateur à partir d’une URL Blob locale.
- XML affichés comme texte, avec limite de sécurité mémoire à 500 000 caractères.
- Excel XLS/XLSX prévisualisés directement dans la fenêtre, avec choix de feuille et limite de 100 lignes × 40 colonnes.
- L’URL Blob PDF est révoquée à la fermeture de la fenêtre pour éviter une fuite mémoire.
- Après restauration IndexedDB, le bouton reste visible mais désactivé tant que le fichier brut n’a pas été redéposé.

# v1.1.8

- Configuration Supabase du journal partagé intégrée au site.
- Classification spécifique des rapports Bao Evolution.
- Extraction Ubat explicite depuis « COEFFICIENT UBAT » avec distinction état initial / après travaux.
- « Température intérieure » n’est jamais interprétée comme Tic.
- Systèmes rénovation contextualisés à l’échelle de la page pour éviter de mélanger avant et après travaux.
- Alias Bao ajoutés pour ECS électrique et ventilation Hygro-Gaz.
- Résultats simplifiés en 4 onglets métier sans répétition des mêmes champs.
- 117 auto-tests moteur.

# Changelog — ExtracTerre

## v1.1.7 — Journal déplacé dans Aide / FAQ
- Suppression de l’encart Journal d’amélioration de la colonne principale.
- Journal, synchronisation, export du pack et configuration distante regroupés dans Aide / FAQ.
- Aucun changement sur la collecte, les droits d’accès, le stockage local/distant ou le contenu du pack.

## v1.1.6 — Journal d’amélioration multi-ordinateurs

- Journal IndexedDB indépendant de l’espace de travail : **Effacer la session** ne le supprime pas.
- Enregistrement des analyses, performances, champs manquants, erreurs, corrections, validations/rejets et Cribles fins.
- Synchronisation distante optionnelle via Supabase avec déduplication par identifiant d’événement.
- Ajout d’un panneau Journal : compteur, état local/partagé, synchronisation manuelle, configuration et export.
- Ajout d’un export ZIP **Pack d’amélioration** avec prompt autonome pour reprendre le développement dans un nouveau chat à partir du dernier ZIP + journal.
- Gestion de deux profils d’accès sans mot de passe en clair ; export du pack direct pour le profil propriétaire et seconde autorisation requise pour le profil équipe.
- La base distante n’expose pas directement la table au rôle anonyme : accès uniquement via fonctions RPC sécurisées et preuves dérivées du mot de passe saisi.
- Ajout des fichiers de déploiement `SUPABASE_JOURNAL_SETUP.sql`, `JOURNAL_PARTAGE_SETUP.md` et `js/journal-config.js`.
- Conservation intégrale du moteur v1.1.5 : 167 colonnes, onglets métier, Crible fin, pool borné et export Excel complet.


## v1.1.5 — Écran d’accueil sécurisé

- Ajout d’un écran d’accueil verrouillé avant l’initialisation de l’application.
- Le secret d’accès n’est jamais stocké en clair dans les fichiers livrés ; seule une empreinte PBKDF2-SHA-256 salée est embarquée.
- L’accès est mémorisé uniquement dans `sessionStorage` pour la durée de la session du navigateur.
- Ajout d’une commande **Verrouiller** qui sauvegarde le projet puis revient immédiatement à l’écran d’accès.
- IndexedDB n’est restauré qu’après validation de l’accès.

## v1.1.4 — Onglets métier, vitrage normalisé et crible fin
- Répartition de la synthèse en six onglets métier : **Données générales**, **Thermique neuf**, **Thermique réno**, **Carbone neuf**, **Carbone réno** et **Structure & enveloppe**.
- Chaque onglet est lui-même découpé en petits tableaux thématiques pour éviter le tableau horizontal de 167 colonnes à l'écran.
- L'export Excel reste inchangé : la feuille principale conserve les **167 colonnes complètes dans l'ordre de référence**.
- `Menuiseries vitrage` privilégie désormais la composition technique lorsqu'elle est détectable : `4/16/4 Argon`, `4-16Ar-4` et `4.16.4 Ar` sont normalisés en **`4.16.4 Ar`**. Le triple vitrage composé est également reconnu.
- Le bouton par PDF est rétabli explicitement sous le nom **🔎 Crible fin** : OCR maximal du seul document choisi, sans relancer les autres fichiers, puis validation ✓ / ✕ avant intégration.
- Conservation des profils de parallélisme, de l'ETA et des checkpoints IndexedDB de v1.1.3.

## v1.1.3
- Ajout de trois profils d’analyse : Sécurisé (1 document / 1 OCR), Équilibré (3 / 1, défaut) et Rapide (5 / 2).
- Remplacement de la boucle strictement séquentielle par un pool borné de documents : seuls 1, 3 ou 5 fichiers sont ouverts simultanément selon le profil choisi.
- La file OCR reste indépendante du parsing PDF et respecte la limite 1 ou 2 workers selon le profil.
- Ajout d’une estimation dynamique de la durée totale, du temps restant et de l’heure de fin estimée. L’ETA apprend la vitesse réelle du lot en cours et réutilise prudemment l’historique local du même profil/OCR au lancement suivant.
- Progression enrichie : nombre de documents terminés, actifs et état de la file OCR.
- Conservation des garde-fous mémoire v1.1.2 : destruction PDF.js/canvas, index compact et checkpoint IndexedDB après chaque document.

## v1.1.2 — Sauvegarde locale et mode mémoire sécurisé
- Ajout de **IndexedDB** : checkpoint automatique après chaque document et restauration de la session au prochain chargement.
- Les PDF bruts ne sont jamais copiés dans IndexedDB ; seuls les résultats, occurrences, validations et un index texte compact sont conservés.
- Ajout du bouton **Effacer la session** pour supprimer les données locales du navigateur.
- Correction critique de consommation mémoire : suppression de l’analyse de tous les PDF via `Promise.all`. ExtracTerre traite désormais **1 document à la fois**.
- OCR limité à **1 worker Tesseract actif** en mode standard afin d’éviter les pointes RAM.
- Libération explicite après chaque page/document : canvas OCR réduit, `page.cleanup()`, `pdf.cleanup()` et `pdf.destroy()`.
- Suppression des copies inutiles `page.items`, `ocrText`, DOM XML et workbook SheetJS une fois l’index utile construit.
- Après parsing, conservation en RAM d’un **index texte compact** seulement ; la géométrie PDF détaillée n’est plus gardée.
- Les snapshots IndexedDB ne dupliquent plus le gros objet de consolidation ; il est recalculé à la restauration depuis les occurrences checkpointées.
- En cas de quota IndexedDB insuffisant, repli automatique vers une sauvegarde « résultats seulement ».
- **109/109 auto-tests métier** conservés après refactor mémoire.

## v1.1.1 — Dictionnaire métier 167 colonnes et moteur de sources stabilisé
- Schéma de sortie figé à **167 colonnes**, avec intitulés et ordre strictement identiques au référentiel transmis.
- Ajout d'un dictionnaire central `FIELD_DEFS` : clé stable, famille, type, tags/synonymes et indicateur de présence pour chaque colonne.
- Hiérarchie de sources appliquée dans la consolidation avant le score de confiance.
- Classification enrichie : Contrat, Livret d'opération, CR conception, CR environnemental, Choix des exigences, Descriptif projet, RSENV/RSNV, Diagnostic et rapport d'imperméabilité. RSET et RSEE sont désormais des sources distinctes pour le routage.
- Nouvel encart de **copier-coller Excel/Google Sheets** avec reconnaissance des en-têtes et provenance `Entrée manuelle`.
- Conservation des candidats **65–89 %** dans une file de validation ✓/✕ ; seuil automatique maintenu à 90 %.
- Contrôle de complétude RSET/RT2012/RSEE-ACV avec activation des 13 lots IC uniquement lorsque le contenu carbone est détecté.
- File OCR globale : **3 workers Tesseract maximum simultanément**, création paresseuse uniquement lorsqu'une page nécessite l'OCR.
- Export principal strictement limité aux 167 colonnes ; traçabilité, occurrences, regroupements et règles conservés dans des onglets séparés.
- Ajout de `data/field-catalog.json` et `COLONNES_EXTRACTERRE.txt`.
- Bundle autonome `file://` / GitHub Pages régénéré.
- **109/109 auto-tests réussis**.


## v1.0.19 — Stabilisation moteur + UX
- Retour au runtime métier v1.0.15, dernière base validée comme stable, avec la nouvelle DA ExtracTerre conservée.
- Suppression de la couche `ux.js` séparée : les contrôles visuels sont reconnectés directement aux commandes historiques de l’application.
- Aucun changement des parseurs métier, de la classification, du routage, de la consolidation, de l’OCR ou de l’export par rapport au socle stable.
- Conservation de la barre latérale verte, des raccourcis, du rail projet et du nouvel habillage.
- Recherche d’en-tête reconnectée à la recherche libre sans modifier le moteur.
- KPI du rail droit mis à jour directement par le runtime principal.
- Validation grandeur nature : 27 contrôles supplémentaires sur 5 PDF réels (RSET/RSEE RE2020, IC détaillés et étude RT existant), tous réussis.
# v1.0.15 — Identité ExtracTerre et ergonomie projets

- Nouveau nom officiel de l’application : **ExtracTerre**.
- Intégration du nouveau logo dans l’en-tête et renommage du titre navigateur.
- Monogramme CC discret en signature de marque dans l’en-tête.
- Chaque projet peut désormais être renommé indépendamment du nom de l’opération via le bouton ✎.
- Le nom personnalisé est repris dans l’export multi-projets.
- Le détail des documents analysés est déplacé sous la barre de progression.
- Les fichiers Excel exportés utilisent désormais le préfixe `ExtracTerre_`.

# Changelog

## 1.0.14 — Réanalyse OCR ciblée + IC détaillés
- Ajout d’un bouton **Réanalyse ciblée** sur chaque PDF déjà analysé.
- Réanalyse manuelle sans limite de temps, avec OCR Tesseract au niveau maximal (toutes les pages, rendu haute résolution).
- La réanalyse ne recherche que les champs encore vides du tableau et n’écrase jamais une valeur existante ou saisie manuellement.
- Les nouvelles valeurs sont présentées dans une fenêtre de validation avec bâtiment, intitulé, valeur, page, confiance, méthode et extrait source.
- Validation unitaire **✓ Accepter / ✕ Refuser** ; seules les valeurs explicitement acceptées sont ajoutées au projet.
- Les refus sont mémorisés afin de ne pas reproposer la même occurrence à la prochaine réanalyse ciblée.
- Une valeur acceptée est tracée comme `OCR maximal validé utilisateur` et devient prioritaire dans la consolidation.
- Nouveau parseur des sorties carbone RSEE/RSET : IC composants lots 1 à 13, IC composants bâtiment, IC chantier, IC énergie bâtiment et détail chauffage / ECS / refroidissement / auxiliaires ventilation / auxiliaires distribution / déplacements.
- Régression réelle validée sur un RSEE RE2020 : IC composants = 547,3 ; IC énergie = 56,35 ; chauffage = 28,12 ; ECS = 15,42 ; refroidissement = 2,53 ; auxiliaires ventilation = 3,80 ; auxiliaires distribution = 0,2530752 ; déplacements = 0,5061504 ; IC chantier = 7,55.
- **79/79 auto-tests**.

## 1.0.13
- Correction critique de la dropzone : suppression de la boucle de clic entre la zone et l'input fichier.
- Sélecteurs Finder fichiers et dossiers à nouveau indépendants.
- Import par glisser-déposer renforcé : File System Access API + fallback webkitGetAsEntry + DataTransfer.files.
- Parcours récursif des dossiers et sous-dossiers conservé.
- Gestion d'erreur et statut d'import visibles.
- Cache-busting des assets JS/CSS pour éviter un ancien bundle après mise à jour.

# v1.0.11

- Analyse des nouveaux fichiers en parallèle au lieu d’une boucle séquentielle.
- Un worker Tesseract.js dédié par PDF lorsque l’OCR est activé, sans plafond logiciel : N PDF = N workers OCR.
- Initialisation des workers OCR en parallèle avec le chargement PDF pour réduire le temps d’attente.
- Progression agrégée indiquant le nombre de fichiers parallèles et de workers OCR.
- Les workers sont terminés et libérés dès la fin de leur PDF.

# Changelog

## 1.0.8 — Cep RE2020, analyses incrémentales et tags projet

- Extraction renforcée de `Cep,nr`, `Cep,nr max` et des postes `Cep refroidissement`, `Cep éclairage`, `Cep auxiliaires ventilation`, `Cep auxiliaires distribution` et `Cep déplacements occupants`.
- Reconstruction des lignes bâtiment fragmentées par le PDF (`Bâtiment` / `(Batiment A)` / ligne de valeurs) dans les tableaux `Consommations annuelles par poste`.
- Correction d'un risque de contamination entre identifiants courts (`A`, `B`, etc.) : un simple article `à/a` ne peut plus être interprété comme un changement de bâtiment.
- Lecture prioritaire du tableau annuel par poste au niveau **bâtiment** ; le tableau par énergie reste utilisé comme secours et contrôle.
- Lecture directe des tableaux de coefficients `Cep / Cepmax / Cep,nr / Cep,nrmax`, ainsi que du tableau détaillé `Coefficient Cepmax / Coefficient Cep,nrmax` lorsqu'il est présent.
- Analyse incrémentale : après une première analyse, de nouveaux documents peuvent être ajoutés. Seuls les nouveaux documents sont lus et parsés ; les occurrences des documents déjà analysés sont réutilisées puis la consolidation globale est recalculée.
- L'interface indique le nombre de nouveaux documents analysés et de documents réutilisés sans nouvelle extraction.
- Nouvel encart **Tags projet**, volontairement exclu de l'export Excel. Détection documentaire automatique + ajout manuel depuis une bibliothèque de tags.
- Bibliothèque initiale de tags : eaux grises, eaux pluviales, biodiversité, végétalisation, habitat sénior/intergénérationnel/inclusif, QAI, biosourcé, réemploi, photovoltaïque, autoconsommation, réseau de chaleur, géothermie, brasseurs d'air, conception traversante, mobilité électrique, vélo et labels.
- Tags de performance calculés automatiquement lorsque les valeurs sont disponibles, par exemple `Performance CEP -60 %`.
- Régression réelle validée sur plusieurs RSET RE2020 multi-bâtiments, dont AVANNE et CHANCELADE : les coefficients et postes demandés sont rattachés au bon bâtiment.
- **61/61 auto-tests**.

## 1.0.6 — Découpage RSET multi-bâtiments renforcé

- Le nombre annoncé dans `Nombre de bâtiments/zones du projet` devient un contrôle de cohérence obligatoire.
- Le registre maître des bâtiments est construit **avant toute extraction** depuis `Chapitre 2 → Données générales sur le bâtiment → Identifiant Bâtiment`.
- Une ligne de synthèse / Excel est créée par identifiant bâtiment. Si le RSET annonce 4 bâtiments, l'application doit produire 4 lignes ; sinon une alerte bloquante de découpage est affichée.
- Les aliases (`Bat 100`, `Bâtiment 100`, identifiant long, etc.) sont réutilisés dans les chapitres 3/4, les feuillets équipements/génération et les sorties détaillées pour rattacher chaque valeur au bon bâtiment.
- Classification corrigée : un RSET standardisé RT2012 est traité comme **RT2012**, même si le nom du fichier contient `RSET`.
- SHAB : somme stricte des lignes de zones dans la colonne `Surface utile SU/SURT ou surf. hab. SHAB` du Chapitre 2, jamais depuis les tableaux DH/Tic ni les unités `m²` d'en-tête.
- Chapitre 4 : extraction bâtiment par bâtiment des parois opaques (structure, isolant, épaisseur, R) et sélection de la paroi représentative par la plus grande surface.
- Suppression des faux positifs issus des graphiques/tableaux pédagogiques du Chapitre 3.
- Menuiseries : regroupement par entrée de baie avant calcul de la valeur dominante (matériau, vitrage, occultation), pour éviter le surcomptage dû aux lignes PDF scindées.
- Reconnaissance du système constructif EASYTHERM comme bloc béton isolant.
- Feuillets génération/équipements : chauffage, vecteur, ECS, refroidissement et ventilation rattachés au bâtiment desservi.
- Sorties détaillées RT2012 : lecture directe en **énergie primaire** quand le tableau l'indique ; aucune reconversion électrique ×2,3 dans ce cas.
- Les typologies logement restent interdites comme source depuis un RSET, RT2012 compris.
- L'interface indique désormais le contrôle de découpage `bâtiments détectés / bâtiments annoncés` dans le dossier documentaire.

### Régression BREUILLET

Test réel sur `Xml_RSET_EC183200 BREUILLET V8.pdf` : 4 bâtiments annoncés → 4 lignes détectées (`Bat 100`, `Bat 200`, `Bat 300`, `Bat 400`), sans alerte de découpage. SHAB validées : 778,8 ; 687,3 ; 673,8 ; 3 035,3 m².

## 1.0.5 — SHAB Chapitre 2 + sorties détaillées RSET

- SHAB RSET : source prioritaire Chapitre 2 → colonne `Surface utile SU ou surf. hab. SHAB`.
- Lecture du chapitre `Résultats sorties détaillées` par bâtiment.
- Distinction énergie finale / énergie primaire selon la génération de RSET.
- Noms de bâtiments descriptifs conservés.

## 1.0.4 — Bibliothèque isolants

- Bibliothèque de 173 variantes produit / épaisseur / R, dont 150 variantes cœur.
- Fallback bibliothèque uniquement si produit + épaisseur sont suffisamment identifiés.
- Valeur documentaire directe toujours prioritaire.

## 1.0.3

- Élargissement du vocabulaire métier et maintien du seuil de fiabilité à 90 %.

## 1.0.7 — Regroupement des bâtiments
- Consolidation automatique des variantes évidentes de libellé : `Bât A`, `Bâtiment A`, `BAT A`, `Bât. A`, etc.
- Le registre RSET reste la référence lorsqu'un identifiant bâtiment explicite existe.
- Les identifiants proches mais ambigus (`B` / `B1`, par exemple) ne sont jamais fusionnés automatiquement.
- Ajout de cases à cocher dans la synthèse et du bouton **Fusionner les bâtiments sélectionnés**.
- Après fusion, toutes les occurrences sont remappées puis la consolidation métier est rejouée : les données complémentaires des anciennes lignes alimentent une seule ligne finale.
- Les arbitrages existants restent actifs en cas de conflit : source directe RSET, routage, confiance >= 90 %, puis meilleure occurrence.
- Ajout des rapprochements potentiels cliquables dans l'interface.
- Ajout de `Nom bâtiment source` dans la traçabilité et les occurrences.
- Ajout de la feuille Excel **Regroupement bâtiments** pour conserver la table d'alias.
- 47/47 auto-tests.

## 1.0.10 — OCR open source

- Ajout de Tesseract.js 7 (Apache-2.0) comme OCR navigateur.
- Mode OCR Automatique / Renforcé / Désactivé.
- Détection de pages nécessitant un OCR selon quantité de texte, qualité alphanumérique, caractères illisibles et fragmentation.
- Rendu PDF en image plafonné en pixels pour limiter la mémoire.
- Worker OCR réutilisé sur toutes les pages d'un même PDF puis libéré.
- Fusion intelligente texte PDF.js + OCR ; le texte numérique fiable reste prioritaire.
- Progression OCR visible pendant l'analyse et nombre de pages OCRisées visible par document.
- Langues OCR : français + anglais (`fra+eng`).

## 1.0.12
- Timeout automatique de 5 minutes par fichier pendant l'analyse standard.
- Les fichiers dépassant 5 minutes passent en statut « À relancer » sans bloquer les autres documents.
- Relance manuelle d'un fichier en échec de délai, sans aucune limite de temps.
- Dépôt récursif de dossiers complets dans la dropzone, sous-dossiers inclus.
- Bouton « + Ajouter un dossier » basé sur le sélecteur natif du navigateur.
- Gestion multi-projets : bouton « + Ajouter un projet », conservation des projets précédents et nouveau dossier documentaire vide.
- Affichage des projets à la suite dans la synthèse, avec réduction/agrandissement de chaque projet.
- Un projet archivé peut être rouvert pour retrouver les mêmes options de correction, fusion et complément documentaire.
- Les fichiers binaires déjà analysés sont déchargés lors de la création d'un nouveau projet, tandis que les résultats et occurrences restent en mémoire.
- Export Excel multi-projets : toutes les lignes bâtiment et économiques sont regroupées dans le même classeur avec une colonne Projet.
## v1.0.19 — Consolidation première passe
- Stabilisation de la mise en page pendant l’analyse pour éviter les sauts liés aux statuts et textes variables.
- Simplification des commandes de l’interface sans modifier la DA générale.
- Renforcement de la première passe SHAB, Cep détaillés et IC composants / IC énergie sur RSET, RSEE et RSENV.
- Correction des faux bâtiments issus d’intitulés génériques RE2020 / Consommations.
- Les identifiants réglementaires RE2020, RE 2020, RT2012 et RT 2012 sont masqués avant toute extraction numérique.
- Les millésimes de niveaux IC 2025 / 2028 / 2031 et versions logicielles ne sont plus interprétés comme valeurs IC/Cep.
- La réanalyse ciblée avec validation ✓ / ✕ reste inchangée.

## v1.0.20 — Surface bâtiment & Recherche libre
- Généralisation du champ Surface bâtiment : SHAB/Shab, SRef/SRéf, surface habitable, surface du bâtiment, surface réglementaire, surface thermique, surface totale du bâtiment, SU/SURT/SRT/SHONRT et surface de plancher.
- Priorité à la SHAB explicite et à la valeur la plus précise lorsqu’un même document contient une valeur synthétique arrondie et une valeur détaillée.
- Recherche libre élargie autour des tableaux PDF éclatés, avec filtrage renforcé des faux positifs de surface (façades, parois, ratios, indicateurs exprimés par m²).
- Ajout du bouton « Intégrer au résultat » dans chaque résultat de recherche libre, avec choix du champ, du bâtiment, correction de la valeur et traçabilité document/page/extrait.
- Déduplication des valeurs validées manuellement dans l’onglet Occurrences.
- Bundle navigateur régénéré à partir des sources v1.0.20.
