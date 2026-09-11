# ExtracTerre v1.1.5

Version stabilisée du moteur métier ExtracTerre : schéma 167 colonnes, routage par sources, saisie manuelle tracée, sauvegarde locale IndexedDB et analyse mémoire sécurisée.


## v1.1.5 — Écran d’accueil sécurisé

ExtracTerre affiche désormais un écran d’accès avant de charger l’espace de travail. Le secret n’est pas présent en clair dans les fichiers du site : la vérification repose sur PBKDF2-SHA-256 avec sel et l’autorisation ne reste active que pour la session courante du navigateur. Le menu **Verrouiller** permet de sauvegarder puis de fermer immédiatement l’accès sans supprimer les données IndexedDB.

## v1.1.4 — Onglets métier, vitrage technique et Crible fin

- Synthèse écran répartie en **Données générales**, **Thermique neuf**, **Thermique réno**, **Carbone neuf**, **Carbone réno** et **Structure & enveloppe**. Chaque onglet contient plusieurs tableaux courts afin d'éviter une grille de 167 colonnes à l'écran.
- L'export Excel ne change pas : la feuille `Données par bâtiment` conserve les **167 colonnes** dans l'ordre de référence.
- `Menuiseries vitrage` privilégie la composition technique et normalise notamment `4/16/4 Argon`, `4-16Ar-4` et `4.16.4 Ar` en **`4.16.4 Ar`**.
- Chaque PDF analysé affiche **🔎 Crible fin**. Le document choisi est seul relu en OCR maximal ; les propositions restent soumises à validation ✓ / ✕. Après restauration IndexedDB, le bouton reste visible et indique qu'il faut redéposer le PDF brut si celui-ci a été déchargé.
- Les profils Sécurisé / Équilibré / Rapide, l'ETA globale et les checkpoints IndexedDB restent inchangés.
- **112/112 auto-tests métier** réussis.

## v1.1.3 — Parallélisme borné, ETA et sauvegarde locale

ExtracTerre sauvegarde automatiquement un checkpoint après chaque document dans **IndexedDB**, directement dans le navigateur. Les PDF bruts ne sont pas copiés : la sauvegarde contient les occurrences extraites, validations, données manuelles, métadonnées et un index texte compact. En cas de fermeture ou de plantage, la session peut être restaurée sans retraiter les documents déjà terminés.

Pour éviter les écrans blancs liés à la saturation mémoire sans pénaliser les gros lots, l’analyse utilise désormais un **pool borné**. Le profil par défaut Équilibré ouvre au maximum **3 documents simultanément et 1 OCR actif** ; le profil Sécurisé reste à 1/1 et le profil Rapide monte à 5/2. Après chaque page et chaque PDF, les canvases OCR, caches PDF.js et objets lourds sont explicitement libérés avant de faire entrer le fichier suivant dans le pool.

Le résultat consolidé complet n’est pas dupliqué dans IndexedDB : il est recalculé à la restauration à partir des occurrences sauvegardées. Cela réduit fortement les copies mémoire au moment des checkpoints.



## v1.1.1 — Schéma métier stabilisé, priorités de sources et saisie Excel

- **167 colonnes métier exactes** : la feuille principale Excel reprend strictement les intitulés et l'ordre du référentiel ExtracTerre.
- Chaque colonne possède une **clé stable**, une **liste de tags/synonymes** et une **hiérarchie de sources**. Le catalogue complet est disponible dans `data/field-catalog.json`.
- L'ordre des sources est désormais réel : à niveau de validation suffisant, la première source prioritaire gagne avant le score de confiance. Exemple : un Contrat peut primer sur un Livret d'opération, et un RSET sur un CCTP selon le champ.
- Nouvelles familles documentaires reconnues : Contrat, Livret d'opération, CR de conception, CR environnemental, Choix des exigences, Descriptif du projet, RSENV/RSNV, Diagnostic et rapport d'imperméabilité. **RSET et RSEE sont distingués dans le routage** afin de respecter l'ordre de priorité propre à chaque champ, tout en partageant les parseurs techniques compatibles.
- Nouvel encart **Données manuelles** : copier-coller direct depuis Excel/Google Sheets avec ligne d'en-têtes. Les en-têtes exacts et leurs variantes sont reconnus automatiquement. Cette source reste tracée comme `Entrée manuelle` et respecte l'ordre de priorité défini ; une correction manuelle de cellule reste, elle, prioritaire.
- Les candidats entre **65 et 89 %** sont conservés dans une file de vérification ✓/✕ au lieu d'être jetés silencieusement. Le seuil de remplissage automatique reste **90 %**.
- Contrôle de **complétude par document réglementaire** et affichage `Analyse technique terminée / Complétude`.
- OCR Tesseract limité selon le profil choisi. Le profil Équilibré utilise **3 documents parallèles / 1 worker OCR** et reste le mode recommandé pour les gros lots.
- **109/109 auto-tests** réussis, dont des tests contractuels sur les 167 colonnes, les tags, les en-têtes et l'ordre des sources.

Application 100 % navigateur pour l'extraction structurée de données bâtiment depuis PDF / XML / Excel.

## v1.0.20 — Surface bâtiment + intégration depuis Recherche libre

- Le champ **Surface bâtiment** accepte désormais les libellés explicites `SHAB`, `Shab`, `SRef/SRéf`, `surface habitable`, `surface du bâtiment`, `surface réglementaire`, `surface thermique`, `surface totale du bâtiment`, `surface utile`, `SU`, `SURT`, `SRT`, `SHONRT` et `surface de plancher`.
- La priorité reste donnée à une **SHAB explicite** lorsqu’elle est disponible. Une valeur précise du type `Shab m² 5 110,25` prime sur une synthèse arrondie `SHAB/SU : 5110 m²`.
- La recherche libre utilise une fenêtre de contexte plus large pour les tableaux éclatés, tout en filtrant les surfaces de façade/paroi, les ratios et les unités du type `kWhep/m²shab`.
- Chaque résultat de **Recherche libre** dispose d’un bouton **Intégrer au résultat**. L’utilisateur choisit le champ et le bâtiment, vérifie la valeur puis valide. La donnée est conservée avec le document, la page et l’extrait d’origine et devient une valeur utilisateur à 100 % de confiance.
- Les valeurs intégrées manuellement ne sont pas dupliquées dans la traçabilité lors des rerenders.

## Principe RSET multi-bâtiments

Pour un RSET/RSEE, l'application ne raisonne plus `1 document = 1 bâtiment`.

1. Elle lit d'abord `Nombre de bâtiments/zones du projet`.
2. Elle construit le registre maître depuis chaque `Identifiant Bâtiment` du Chapitre 2.
3. Elle crée **une ligne par bâtiment**.
4. Elle rattache ensuite les Chapitres 3/4, équipements, générations et sorties détaillées à cet identifiant.
5. Si le nombre de lignes ne correspond pas au nombre annoncé par le RSET, une alerte de découpage est générée.

## Règles de fiabilité

- Seuil final : **90 % minimum**.
- Une donnée sous 90 % n'alimente ni la synthèse ni l'Excel.
- Une donnée directement présente dans le RSET est prioritaire sur toute bibliothèque ou déduction.
- Les valeurs issues de la bibliothèque isolants sont explicitement tracées.
- Les indicateurs non applicables à une réglementation ne sont pas inventés.

## RT2012 / RE2020

Les deux générations de RSET ont des parseurs distincts :

- **RT2012** : Bbio, Cep, Tic/Tic ref, SRT/SURT/SHAB, enveloppe, équipements et sorties détaillées généralement en énergie primaire.
- **RE2020** : Bbio, Cep/Cepnr, DH, SHAB/SRef, enveloppe, équipements, carbone et sorties détaillées selon l'unité déclarée dans le document.

## Test réel BREUILLET

Le fichier `Xml_RSET_EC183200 BREUILLET V8.pdf` annonce 4 bâtiments. La v1.0.8 produit 4 lignes distinctes : Bat 100, 200, 300 et 400, avec les SHAB et indicateurs réglementaires rattachés à chacun.

## Installation

Le dossier peut être publié tel quel sur GitHub Pages. Le runtime `js/app.bundle.js` permet aussi l'ouverture locale de `index.html`.

### Regroupement des lignes bâtiment
La synthèse normalise automatiquement les variantes typographiques évidentes d'un même bâtiment. Pour les rapprochements ambigus, cochez les lignes concernées puis cliquez sur **Fusionner les bâtiments sélectionnés**. Le moteur relance alors toute la consolidation sur le groupe choisi, sans abaisser le seuil de confiance de 90 %. Les libellés d'origine restent consultables dans l'onglet Occurrences et dans la feuille Excel `Regroupement bâtiments`.


## Analyse incrémentale

Après une première analyse, vous pouvez ajouter de nouveaux PDF/XML/Excel sans repartir de zéro. Les documents déjà analysés conservent leurs occurrences en mémoire ; seuls les nouveaux fichiers sont lus et extraits. La consolidation est ensuite rejouée avec l'ensemble des occurrences afin que les nouvelles pièces complètent les lignes bâtiment existantes.

Le bouton indique automatiquement **Analyser N nouveaux documents et compléter** lorsqu'une analyse existe déjà.

## Cep / Cep,nr et postes détaillés

Pour les RSET RE2020, le moteur cible en priorité les tableaux structurés du bâtiment :

- `Cep / Cepmax / Cep,nr / Cep,nrmax` ;
- `Consommations annuelles par poste` ;
- `Consommations annuelles par poste et par énergie` ;
- tableau détaillé `Coefficient Cepmax / Coefficient Cep,nrmax`.

Les lignes PDF éclatées sur plusieurs lignes sont reconstruites avant interprétation. Les postes refroidissement, éclairage, auxiliaires de ventilation, auxiliaires de distribution et déplacements sont ainsi rattachés à la bonne ligne bâtiment.

## Tags projet — hors Excel

La synthèse comporte un encart **Tags projet** séparé du tableau exportable. Il repère des signaux descriptifs dans les pièces (eaux grises, biodiversité, habitat sénior, qualité de l'air intérieur, biosourcé, réemploi, ENR, mobilité, labels, etc.) et génère aussi des tags de performance lorsque les indicateurs réglementaires le permettent. Vous pouvez compléter la bibliothèque par des tags manuels. Ces tags ne sont pas intégrés aux feuilles Excel.

## OCR open source — Tesseract.js

La v1.0.10 ajoute un secours OCR open source basé sur **Tesseract.js 7 / Tesseract OCR** (licence Apache-2.0), exécuté dans le navigateur.

Trois modes sont disponibles dans la zone d'import :

- **Automatique** (recommandé) : PDF.js lit d'abord la couche texte ; seules les pages trop pauvres, scannées ou manifestement mal décodées passent par l'OCR.
- **Renforcé · toutes les pages** : chaque page est aussi contrôlée par OCR, utile pour des scans ou des tableaux dont la couche texte est mauvaise ; ce mode est nettement plus lent.
- **Désactivé** : lecture PDF.js uniquement.

Le résultat est hybride : le moteur conserve la couche PDF lorsqu'elle est meilleure, bascule vers l'OCR si celui-ci est nettement plus exploitable, ou ajoute uniquement les lignes OCR nouvelles. Les pages OCRisées sont indiquées dans la liste des documents. L'OCR utilise `fra+eng` afin de mieux gérer le vocabulaire technique, les marques et les nombres.


## OCR et mémoire contrôlés — v1.1.3

Les nouveaux documents passent dans un **pool borné** : 1, 3 ou 5 documents maximum selon le mode choisi. La file OCR est indépendante et plafonnée à 1 ou 2 workers. Un worker n’est créé que lorsqu’une page nécessite réellement l’OCR, puis il est terminé à la fin du document. Les pages PDF.js et canvases OCR sont explicitement nettoyés au fil de la lecture.

Les documents déjà analysés restent réutilisés sans être relus lors d’une analyse incrémentale ; leur checkpoint compact est conservé dans IndexedDB.

### Multi-projets et imports lourds (v1.0.13)
- Chaque analyse standard dispose d'un délai maximum de 5 minutes par fichier. Un document trop long est mis de côté et peut être relancé manuellement sans limite de temps.
- La dropzone accepte les dossiers complets et parcourt récursivement leurs sous-dossiers pour récupérer les PDF, XML, XLS et XLSX compatibles.
- Le bouton **+ Ajouter un projet** ferme visuellement le projet courant, décharge ses fichiers binaires déjà analysés et ouvre un nouveau projet vide. Les résultats précédents restent visibles sous forme de blocs repliables.
- Chaque projet peut être rouvert et complété ultérieurement sans réanalyser les documents déjà traités.
- L'export Excel consolide tous les projets présents dans la session. La feuille principale conserve strictement les 167 colonnes métier ; le champ `Projet` fait partie de ce schéma et les métadonnées techniques restent dans les onglets de traçabilité.


## Import Finder v1.0.13
La dropzone accepte les fichiers unitaires et les dossiers complets. Le bouton Ajouter des fichiers et le bouton Ajouter un dossier utilisent des sélecteurs Finder indépendants. Le dépôt d'un dossier parcourt récursivement les sous-dossiers et conserve uniquement PDF, XML, XLS et XLSX.


## Crible fin (anciennement Réanalyse OCR ciblée) — v1.0.14

Chaque PDF déjà analysé dispose désormais du bouton **🔎 Crible fin** (fonction introduite en v1.0.14 sous le nom Réanalyse ciblée). Ce mode est volontairement manuel et complémentaire à l’analyse normale : il relit uniquement le fichier choisi avec le niveau OCR maximal, sans timeout, puis compare les occurrences trouvées aux cellules actuellement vides.

Aucune proposition n’est injectée automatiquement. Une fenêtre affiche pour chaque donnée candidate le bâtiment, le champ, la nouvelle valeur, la page, le score du parseur, la méthode et un extrait. L’utilisateur choisit **✓** pour accepter ou **✕** pour refuser. Les valeurs acceptées sont conservées avec leur provenance et prennent la priorité comme valeurs explicitement validées par l’utilisateur. Les valeurs déjà présentes et les corrections manuelles ne sont jamais remplacées par ce mode.

## IC détaillés RSEE / RSET — v1.0.14

Le moteur lit désormais les tableaux carbone détaillés des RSEE/RSET :

- IC composants bâtiment et **lots 1 à 13** ;
- IC chantier ;
- IC énergie bâtiment ;
- IC énergie chauffage, ECS, refroidissement ;
- IC énergie auxiliaires ventilation et distribution ;
- IC énergie déplacements / ascenseurs / parking.

Le parseur exploite les blocs `COMPOSANTS`, `ENERGIE (CE)` et leurs lignes `Total` / `Total Lot`, avec rattachement au bâtiment courant.


## v1.0.15
Les projets peuvent être renommés depuis leur en-tête sans modifier le nom d’opération. Le détail des fichiers analysés est affiché sous la progression.


## Profils d’analyse v1.1.3
ExtracTerre propose trois niveaux de parallélisme : Sécurisé (1 document et 1 OCR), Équilibré (3 documents et 1 OCR, profil par défaut) et Rapide (5 documents et 2 OCR). Le parallélisme reste borné : l’application n’ouvre jamais l’ensemble d’un lot de centaines de PDF simultanément. Une ETA globale est recalculée en continu à partir du débit réellement observé et affiche la durée totale estimée, le temps restant et une heure de fin approximative.
