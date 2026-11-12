# v2.24.5 — Import massif : archives, fichiers Box non téléchargés, reprise des erreurs

- Les contrats sont aussi cherchés dans « 00 - Certifications réalisées - Archivage » (`racinesSupplementaires` dans import.config.json).
  Si un contrat est à la fois à la racine et en archive, la racine prime. Sur la liste testée, 7 contrats « sans dossier » sur 7 sont maintenant trouvés.
- Service d'import : il est maintenant autorisé à télécharger les dossiers et fichiers Box qui ne sont pas encore sur le Mac
  (`MaterializeDatalessFiles`). Avant, ces dossiers étaient vus vides (« sans sous-dossier ») et ces fichiers renvoyaient « Unknown system error -11 ».
  **Réinstaller le service une fois** (`node installer-service.mjs`).
- Une lecture qui échoue pour cette raison est réessayée (attente de 2 à 30 s).
- Une opération qui contient des erreurs ou dont aucun sous-dossier n'a été retenu n'est plus marquée « complète » : elle est reprise
  au passage suivant.
- Un double clic sur « Lancer l'analyse » ne crée plus deux demandes.

# v2.24.4 — Suivi des sources : plus d'erreur « Failed to execute » à l'ouverture

- Après un rechargement de la page, Chrome redemande l'accès au dossier de travail. Cette demande doit venir d'un clic : elle était lancée
  automatiquement à l'ouverture de « Suivi des sources », et Chrome la refusait avec « Failed to execute 'requestPermission' ». Un bouton
  « Autoriser l'accès à « ExtracTerre-import » » s'affiche maintenant ; un seul clic suffit.
- Dossier Box (⟳ Box, Charger depuis Box) : un accès refusé ne provoque plus d'erreur. Le choix du dossier est proposé à la place.

# v2.24.3 — Économie : fichiers sources déchargeables ou supprimables

- Onglet Économie, encart « Fichiers sources » : questionnaire financier ou DPGF utilisés, avec deux boutons par fichier.
  **Décharger** : le fichier n'est plus utilisé pour l'économie mais reste dans l'opération ; le questionnaire suivant prend le relais ;
  **Réutiliser** le remet. **Supprimer** retire le document de l'opération, comme le ✕ de la liste des fichiers.
- **Effacer les saisies** : supprime les valeurs économiques saisies à la main.
- Le déchargement est sauvegardé et respecté par l'export Excel.

# v2.24.2 — Import massif : contrats et dossiers annulés mieux lus, racine Box rechoisie

- Noms « 76-008 - 1480 - CP - Fécamp » : le code « 008 » n'est plus pris pour le contrat n° 8. Il faut au moins 3 chiffres significatifs ;
  cela corrige 139 dossiers sur Box.
- Dossier annulé reconnu même quand « Annulé(e) » n'est pas en tête du nom (« 07-011 - 0386 - CP Annule - … », « 00000761 - 91 - Annulée - … ») :
  il n'est plus traité.
- ⟳ Box : si la racine mémorisée n'est pas « 1 BEE Contrats » (par exemple un dossier CCTP choisi autrefois), un bouton permet de la
  rechoisir, puis la comparaison se relance.

# v2.24.1 — Import massif : coller une liste de contrats

- Suivi des sources → onglet **📋 Nouvelle analyse**. On colle la colonne Excel des contrats (colonne « contrat » repérée, codes postaux et
  villes ignorés), puis on clique sur **Lancer l'analyse** ou **Vérifier la correspondance**. La demande est déposée dans le dossier de travail.
- **Service d'import** (`tools/import/watch.mjs`, LaunchAgent installé par `installer-service.mjs`) : il exécute les demandes une par une avec le
  script. L'avancement (`--statut`) est suivi dans l'appli : correspondance (sans dossier, en double, annulés), opérations, fichiers. Les
  opérations se chargent automatiquement à la fin.
- Phrase secrète lue dans le Trousseau macOS (service « extracterre-import ») : aucune saisie et rien en clair sur le disque.
- Un dossier de travail vide est accepté (première utilisation).
- Clé Supabase « secret » (`sb_secret_…`) acceptée, en plus de l'ancienne `service_role`.

# v2.24.0 — Import massif & suivi des sources

- **Écran d'accueil** à deux entrées : « Version actuelle » (inchangée : session, opérations, options) et « Import massif & suivi des
  sources » (`?espace=import`), qui a sa **propre base locale** : la session actuelle n'est jamais touchée. Bouton « ⇄ Espaces » pour revenir au choix.
- **Script `tools/import`** (Node, lecture seule sur Box) : sélection par numéros de contrat (`--contrats`, `--operation`), sous-dossiers
  CCTP / thermique / carbone à tout niveau, rapport de correspondance (`--check-only`), simulation (`--dry-run`), classement (dossier → XML →
  nom → 1re page), versions (indice, date, date de modification ; historique), extraction par **les parseurs de l'appli** (même code que le
  glisser-déposer), reprise après interruption, opérations inchangées sautées, fichiers connus (SHA-256) jamais relus, disparus marqués,
  option `--with-ai` (Ollama, propositions à valider). Configuration lisible `import.config.json`, README en français.
- **Registre Supabase chiffré** (migration `supabase/migrations/20261112_import_massif.sql`) : contenu AES-256-GCM avec une clé tirée de la
  phrase secrète de l'utilisateur, identifiants en HMAC, tables fermées aux clés publiques. Clé de service uniquement dans `tools/import/.env`.
- **Vue « Suivi des sources »** (espace import) : opérations, documents par famille, versions antérieures, disparus, comparaison avec le
  dossier Box (⟳ Box), liste « À vérifier » filtrable (corriger le type, valider, choisir la version, relancer, ignorer, propositions IA) ;
  choix enregistrés dans `decisions.json`, appliqués par le script. Les documents ajoutés à la main et les saisies restent prioritaires.
- `js/doc-pipeline.js` : classement d'un document lu partagé entre l'appli et le script (code déplacé, non modifié).

# v2.23.3 — Brasseur d'air : vraies présences retenues
- Opération à plusieurs bâtiments : un CCTP / descriptif qui prévoit des brasseurs pour toute l'opération (document sans bâtiment
  précisé) donne « Brasseur d'air : Oui » et le type à chaque bâtiment sans valeur propre ; le nombre n'est pas recopié.
  Avant : valeur « à attribuer manuellement », colonne vide.
- Installation décrite (« fourniture et pose », « F&P », « mise en œuvre / en place », « seront mis en œuvre / équipés »,
  « installation », « prévu ») acceptée aussi d'un document classé Contrat ou Descriptif du projet (CCTP ou notice mal classés) ;
  une simple mention ne l'est pas.
- « 0 brasseur » lu pour le bâtiment (RSET) prime sur un type lu pour toute l'opération.
- Rattrapage relancé une fois (marque `fanRead` = 2), y compris pour les documents déjà rattrapés en 2.23.2.
- Détection des bâtiments : une suite de phrase coupée en fin de ligne (« … les ouvrages du | bâtiment réalisés sur chantiers. »,
  « bâtiment à charge du VRD ») ou un en-tête de tableau (« Bâtiment Type de VMC Type de caisson Quantité », « Batiment A Batiment B
  Batiment C ») n'est plus un bâtiment. Les vrais titres restent : « Bâtiment A », « 1. Bâtiment B », « Bâtiment 1 Est »,
  « BATIMENT A - LA JOUGARELLE », « Batiment A2 et B », identifiant court en minuscules (« bâtiment A »).
- Rattrapage des opérations existantes (marque `bldRead`), sans relire le texte : les faux noms sont retirés de la liste des bâtiments
  du document et leurs lectures passent en « sans bâtiment précisé ». Jamais touchés : un nom utilisé dans un regroupement manuel de
  bâtiments, le seul bâtiment d'un document (identité de son bâtiment, ex. RSET), une valeur validée par l'utilisateur.
  Session réelle : 32 faux bâtiments retirés de 42 opérations, aucun identifiant court perdu, aucune valeur validée perdue ;
  784 des 785 valeurs portées par ces faux bâtiments existent déjà sur un vrai bâtiment de l'opération.
- Session réelle (simulation complète rattrapage + calcul) : 22 opérations « Oui » (51 avant 2.23.2, dont 42 fausses), 45 bâtiments,
  chaque « Oui » appuyé sur une installation décrite ou un nombre RSET. Une valeur validée par l'utilisateur (OCR ciblé) est gardée.

# v2.23.2 — Brasseur d'air : fin des faux « Oui » des RSET
- Le titre de rubrique « Brasseurs d'air » du RSET n'est plus lu comme une présence. Sur une session réelle (148 opérations),
  il apparaissait dans 76 RSET de 57 opérations et la rubrique était vide dans 249 cas sur 256 (suivie de « Données sur
  l'éclairage ») ; 50 des 59 bâtiments marqués « Brasseur d'air : Oui » l'étaient pour cette seule raison.
- « Nombre total de brasseurs d'air de la zone : N » (RSET) est lu : N > 0 → nombre et « Oui » ; 0 → « Non » (une autre zone du
  même bâtiment avec des brasseurs l'emporte).
- Ne sont plus une présence non plus : lignes de sommaire (« 5.5. BRASSEUR D'AIR ……… 29 », « 11.9.17 Brasseurs d'air 321 »),
  titres numérotés seuls, PSE (prestation supplémentaire éventuelle), variantes, suppressions (« BRASSEUR D'AIR + TELECOMMANDE
  (SUPPRESSION) » donnait aussi un nombre de 8).
- Rattrapage automatique des opérations déjà analysées (marque `fanRead` enregistrée avec le document) : au prochain démarrage,
  chaque document qui avait une lecture « brasseur » est relu une fois avec ces règles, seules ses lectures « brasseur » sont
  remplacées (autres colonnes et corrections manuelles inchangées). Simulé sur la session réelle : 106 documents relus (< 1 s
  chacun), 2 935 marqués sans relecture, aucune autre lecture modifiée ; opérations « Brasseur d'air : Oui » 51 → 9.

# v2.23.1 — Export de la session : témoin d'avancement
- « Exporter la session (.json) » affiche une carte d'avancement en bas à droite : étape (recalcul des opérations en attente,
  préparation des recherches, écriture des opérations, création du fichier), numéro de l'opération en cours et son nom,
  pourcentage, taille déjà écrite ; à la fin, nombre d'opérations et taille du fichier. Mouvement réduit respecté.
- Le bouton est désactivé pendant l'export (un second clic ne lance plus un second export).

# v2.23.0 — Recherches : « Rappel de colonne »
- Nouveau type de critère **Rappel de colonne** dans les Recherches : il reprend la valeur retenue d'une colonne (onglet Thermique,
  Enveloppe, Systèmes…) pour chaque bâtiment, avec sa source (document, page, extrait ; « Collage libre » ou « Valeur retenue (sans
  document) » le cas échéant). Aucun mot-clé, aucune valeur nouvelle : une colonne vide l'est aussi dans la recherche (« Colonne … vide
  pour ce projet »). Unité, Min et Max facultatifs (hors bornes → « Hors seuil »). La décision manuelle (Oui / Non / Sans objet) reste prioritaire.
- Éditeur : choix de la colonne dans la liste des données ExtracTerre ; mots-clés, contexte et exclusions masqués pour ce type.
- Les rappels fonctionnent aussi pour une opération sans document lu (valeurs collées depuis Salesforce) ; ils suivent l'export Excel
  (feuille de la grille + citations), l'export de session et l'observatoire des recherches (empreinte de cache recalculée quand une valeur change).
- Lecture « Refroidissement » corrigée (révélée par les rappels) : « Climatisation Non » donnait « Climatisation active » (→ « Aucun ») ;
  la définition du DH (« … l'on retire le système de climatisation. Le DH max est de 1250 °C.h »), les intitulés de lot
  (« Chauffage – ventilation – climatisation »), les indicateurs (besoins, consommations, IC, points, kWhEP), la régulation générique
  et les composants ACV sont écartés ; un mode de chauffage (« Poêle », « Chauffage électrique direct ») n'est plus pris comme
  refroidissement sans mention de réversibilité / mode froid. Mesuré sur une session réelle de 148 opérations.
- Lecture « Structure » : composants ACV, fondations et semelles, terrassements, stabilité au feu, interfaces entre lots (« joints …
  en liaison avec le Gros-Œuvre et ossature bois » d'un lot menuiseries), fourreaux, incorporations, liaisons de terre, escaliers,
  huisseries, protection des façades et sommaires ne donnent plus de structure (8 048 → 6 625 occurrences sur la même session).

# v2.22.3 — Favori Salesforce : règles du prompt de mise en forme RE2020
- Texte « libellé = valeur » au format du prompt (fiche Salesforce ou collage dans Données manuelles) : l'enveloppe est
  maintenant lue. « <Paroi> après travaux = structure + isolant épaisseur » et « R isolant <paroi> après travaux = R »
  remplissent structure, isolant, épaisseur et R (murs, planchers bas, planchers hauts / toiture terrasse / rampants) ; une seule
  paroi par famille, la première écrite ; ITI / ITE reconnus. Avant, toutes ces lignes restaient « non reconnues ».
- Libellés ajoutés : « ICC / ICE max 2025 (2028) », « Perméabilité Q4Pa-surf », « Menuiseries après travaux ».
- Isolants abrégés : LDB (laine de bois), LdV, LR, LM, PU (→ PUR). R absent mais épaisseur et λ écrits : R = e / λ arrondi à
  0,05, signalé dans les points à vérifier.
- Fiche Salesforce : « 6 MI » = 6 logements ; maison individuelle : un DH sans type de zone = zones traversantes ; vecteurs
  chauffage / ECS après travaux remplis à partir du générateur (PAC, thermodynamique, effet Joule → Électricité). Le mode de
  chauffage et l'ECS gardent le texte de la fiche (modèle compris), comme avant.
- Points à vérifier ajoutés : écart de gain recalculé > 0,1 point (avant 0,6), Bbio < 40 en collectif, eaux grises, chaudière
  murale dans un collectif, mentions « NC », « PS », « à justifier » des sections techniques (5 au plus).
- Rien n'est inventé : pas de colonne nouvelle, une ligne absente reste vide.

# v2.22.2 — Accueil : recherche par liste de contrats
- Le champ « Rechercher une opération » accepte une liste collée (une valeur par ligne depuis Excel ou un texte, ou séparée par
  des virgules / points-virgules) : elle devient « 4794, 4808, … » et les tuiles de tous les éléments trouvés s'affichent.
- Un nombre = numéro de contrat exact, zéros de tête ignorés (4794 → 00004794, mais pas 00047940) ; un autre terme (OPE-…,
  nom) cherche comme avant dans contrat, nom, code et maître d'ouvrage.
- Les éléments de la liste sans tuile sont affichés : « Non trouvé(s) (2) : 5868, 5990 ».
- Vérifié dans Chrome avec 25 opérations fictives et une liste de 22 contrats.

# v2.22.1 — Export / import de session pour les grosses sessions
- Export : progression « Export de la session… n / N », la page rend la main entre deux opérations (avant : ~2 min figée
  sans indication sur 351 opérations), message d'erreur si l'export échoue.
- Fichier : une opération par ligne, sans mise en forme (`"workspaceFormat": "lines-v1"`), ~15 % plus léger, toujours un
  JSON valide. L'import le relit en flux, ligne par ligne : une session n'est plus limitée par la taille maximale d'une
  chaîne de Chrome (~537 millions de caractères ; la session du 09/11, 351 opérations, en faisait 546 millions et ne pouvait
  plus être réimportée).
- Les anciens fichiers de session (indentés) sont aussi relus en flux, opération par opération, quelle que soit leur taille
  (l'export du 09/11, 550 Mo, devient importable).
- Test : `test_v2_22_1.mjs`.

# v2.22.0 — File d'analyse ; boutons pause et arrêt
- Carte « Analyse du projet » : bouton « ☰ File d'analyse » (avec le nombre de documents). La fenêtre liste les documents en
  cours d'analyse (étape : lecture, OCR, extraction, en pause…) et ceux en attente ; chaque document peut être retiré (✕) ou
  plusieurs à la fois (cases à cocher, « Retirer la sélection »). Un document en cours retiré est interrompu, un document en
  attente est sauté ; les valeurs déjà extraites d'un document restent conservées (comme le ✕ de la liste des fichiers).
- Pause et arrêt fonctionnent : les boutons ⏸ / ⏹ n'étaient reliés à rien. Ils apparaissent pendant l'analyse dans la carte,
  la barre des résultats et la file d'analyse. La pause agit entre deux pages d'un PDF (avant : seulement à la fin du document),
  le délai de 5 min est suspendu pendant la pause. L'arrêt interrompt les lectures en cours (documents remis « En attente »),
  garde les documents déjà lus et consolide leurs résultats.
- Vérifié dans Chrome avec 10 PDF fictifs de 300 pages : pause figée, retrait d'un document en cours et d'un en attente,
  reprise, arrêt à la page 6/300 du document en cours.
- Test : `test_v2_22_0.mjs`.

# v2.21.1 — Patchs d'amélioration pour les données manuelles collées
- Un patch JSON (Aide / FAQ › Patchs d'amélioration) peut contenir des règles `pasteRewrites` : « rechercher / remplacer »
  par expression régulière (`find`, `replace` avec $1, $2…, options `flags`, condition `when`), appliquées dans l'ordre au
  texte collé dans les données manuelles avant sa lecture. Patch déclaratif, expressions vérifiées au chargement, 60 règles max.
- Patch fourni à part : `ExtracTerre_PATCH_COLLAGE_PLOTS_RE2020_v1.json`. « PLOT A : BAT A1 : 1 MI » devient une section par plot
  (maisons accolées → Individuel groupé, maison seule → Individuel diffus) ; « Bbio : 78 / Bbiomax 78,8 (gain 1 %) » →
  valeur, max et gain (Bbio, Cep, Cep nr) ; « Ic construction : 689,76 / 735,3 max » → valeur et max. Aucune valeur ajoutée.
- Test : `test_v2_21_1.mjs`.

# v2.21.0 — Mémoire allégée ; analyses horodatées
- Le texte des documents est rangé à part dans la base locale du navigateur (magasin `documentReads`). Il n'est chargé que
  pour l'opération ouverte, ou le temps d'un calcul ou d'un export sur une autre opération, puis il est libéré. Rien n'est
  supprimé ni résumé : le texte reste enregistré tel quel et revient à l'identique à la réouverture.
- Migration automatique au premier démarrage, document par document. Un texte n'est jamais libéré avant d'avoir été
  enregistré ; un calcul ne se fait jamais sur un texte non chargé (il est rechargé d'abord).
- Le résultat consolidé ne garde plus la copie « occurrences », que « detailed » contient déjà avec son statut.
- Export de session écrit opération par opération (même contenu JSON).
- Base fictive de 280 opérations × 4 documents de 30 pages : mémoire JavaScript de 496 Mo à 80 Mo, démarrage de 15 s à
  5 s, résultats identiques pour les 280 opérations ; l'export de session contient toujours le texte de tous les documents.
- Chaque analyse est horodatée (sauvegarde locale). Accueil : « traitée(s) aujourd'hui » compte les opérations analysées
  ou importées depuis Salesforce dans la journée. Pas de date inventée pour les analyses d'avant cette version.
- Test : `test_v2_21_0.mjs` ; `test_v2_19_2.mjs` et `test_v2_20_7.mjs` mis à jour.

# v2.20.7 — Salesforce : bâtiments en rouge, compteur, opérations sans import
- Tableau des bâtiments : un bâtiment qui n'existe que par un import Salesforce (aucune donnée des documents ni d'un tableau
  collé) apparaît en rouge, avec l'étiquette « Salesforce ».
- Accueil : compteur des opérations dans ExtracTerre, remplies aujourd'hui, remplies (au moins un import Salesforce intégré)
  et remplies par les documents seuls. Chaque import Salesforce intégré est daté (sauvegarde locale) ; un import d'avant
  cette version est reconnu à sa source « Salesforce » mais n'a pas de date (compté dans « remplies », pas « aujourd'hui »).
- Liste dépliable et cliquable des opérations avec documents mais sans import Salesforce.
- Test : `test_v2_20_7.mjs`.

# v2.20.6 — Fichiers CSV, export d'étude carbone par composant
- Les fichiers .csv sont acceptés (dépôt, sélection, dossiers Box, mini-fenêtre). Lecture en UTF-8, sinon Windows-1252 ;
  séparateur « ; », tabulation ou « , ».
- Export CSV d'étude carbone RE2020 « composant par composant » (un fichier par bâtiment, ex. « BATIMENT B.csv » ; colonnes
  Designation / DetailsGES / NumFiche / CO2Inies…) : type « Étude carbone / ACV », bâtiment lu dans le nom du fichier.
  Repris : IC composants lots 1 à 13 et IC composants (contrôle : somme des lots = total), IC énergie et ses postes
  chauffage, ECS, refroidissement, auxiliaires ventilation et distribution (kg éq. CO2/m²).
- Seules les valeurs écrites sont reprises. Un contributeur « Chantier » entièrement à 0 n'est pas renseigné dans l'export :
  IC chantier n'est pas repris. Les lignes de produits ne sont pas lues une à une.
- Test : `test_v2_20_6.mjs` (CSV fictif).

# v2.20.5 — Import Salesforce : fenêtre de contrôle
- Le favori « → ExtracTerre » ouvre une fenêtre qui affiche directement le contrôle des données, au-dessus de Salesforce :
  projet ExtracTerre visé, nombre de valeurs et de bâtiments, remarques ⚠ de la fiche, puis par bâtiment chaque colonne,
  la ligne d'origine et la valeur ; ✕ / ↺ pour ignorer ou reprendre une ligne, clic sur la colonne pour la changer, lignes
  non reconnues à ranger. « Intégrer » ou « Ignorer l'import », puis la fenêtre confirme et se ferme.
- Les actions passent par l'onglet ExtracTerre ouvert (même navigateur, BroadcastChannel) et son aperçu « Données
  manuelles » : mêmes règles qu'en plein écran. Rien n'est stocké ni envoyé ailleurs.
- Favori déjà installé : la fenêtre s'agrandit d'elle-même. La mini-fenêtre affiche aussi le projet visé.
- Test : `test_v2_20_5.mjs`.

# v2.20.4 — Encart « Compléments » : boutons dans la carte
- Les boutons « Coller » et « Connexion Cloud » prenaient toute la largeur à côté du texte et sortaient de la carte de ~60 px :
  ils reprennent leur taille, le texte se replie à côté.
- Colonne de droite (Projet actuel, Compléments, Informations extraites) : entre 961 et 1180 px, une colonne de cartes à côté
  des résultats (avant : trois colonnes de 88 px illisibles) ; sous 960 px, sous les résultats sur toute la largeur
  (avant : colonne de 296 px gardée même à 700 px).
- Test : `test_v2_20_4.mjs`.

# v2.20.3 — Derniers projets ouverts
- Encart « Projet actuel » : liste cliquable des 5 derniers projets ouverts (hors projet affiché), avec contrat et code
  d'opération ; un clic ouvre le projet. La date d'ouverture est gardée dans la sauvegarde locale du navigateur.
- Test : `test_v2_20_3.mjs`.

# v2.20.2 — « Planchers hauts » : le matériau, plus le statut de la toiture
- « Planchers hauts » donne la structure / le matériau du plancher haut : Dalle béton, Poutrelles-hourdis, Prédalle,
  Plancher bois, Charpente bois, Charpente métallique, Bac acier (collaborant). Sans matériau écrit dans le document,
  aucune valeur (« Combles » seul n'est pas un matériau).
- Le statut de la toiture (« Toiture terrasse non accessible », « terrasse végétalisée », « toiture en pente »…) n'est plus
  proposé. XML RE2020 et Données techniques des RSET lisent le matériau dans le libellé de la paroi quand il y est ;
  « Toiture terrasse sur dalle béton » devient « Dalle béton ».
- Les opérations déjà analysées sont nettoyées au recalcul, sans relire les documents. Les saisies manuelles et le collage
  Salesforce restent tels quels.
- Jamais de valeur par défaut, dans aucune colonne : U48win sans ligne « REFROIDISSEMENT » ne donne plus « Cep refroidissement
  = 0 » ni « Aucun » ; les postes et énergies du Cep absents (Pléiades RT existant, U48win, tableau des postes) ne deviennent
  plus 0. Seules les valeurs écrites dans le document (ou déduites d'un chiffre écrit, ex. refroidissement = 0 → « Aucun ») restent.
- Test : `test_v2_20_2.mjs` ; `test_v2_3_8`, `test_v2_3_15` et `test_v2_3_17` mis à jour (plus de statut de toiture attendu).

# v2.20.1 — Contrôle de l'import Salesforce dans la mini-fenêtre
- Quand une fiche arrive par le favori Salesforce, la mini-fenêtre affiche le contrôle sans revenir sur l'onglet ExtracTerre :
  nombre de valeurs et de bâtiments, remarques ⚠ de la fiche, puis par bâtiment (et « Opération ») chaque colonne ExtracTerre,
  la ligne d'origine et la valeur. ✕ ignore une ligne (↺ la reprend), un clic sur la colonne permet d'en choisir une autre,
  les lignes non reconnues peuvent être rangées. « Intégrer » / « Ignorer l'import » restent visibles en bas.
- Les actions passent par l'aperçu « Données manuelles » de la page : mêmes règles, même résultat qu'en plein écran.
- Test : `test_v2_20_1.mjs`.

# v2.20.0 — Fenêtre étroite ou basse, mini-fenêtre flottante
- Mini-fenêtre (bouton « ⧉ Mini-fenêtre » en haut) : petite fenêtre qui reste au premier plan quand on passe sur un autre
  onglet (Salesforce…), avec le strict minimum : opération active (sélecteur), contrat / code, documents, bâtiments,
  complétude, état de l'analyse, zone de dépôt (PDF, XML, Excel…, ou clic pour choisir) et bouton d'analyse. Les fichiers
  déposés vont dans l'opération active, comme sur la page. Chrome / Edge (Picture-in-Picture de document) ; ailleurs, simple
  petite fenêtre séparée. Même page, même mémoire : rien n'est stocké ni envoyé.
- Fenêtre étroite : tuiles d'opérations qui tiennent dans la largeur (plus de débordement à 390 px), en-tête des opérations
  qui passe à la ligne ; menu collé en haut et compact (icônes seules sous 600 px, infobulle sur chaque entrée).
- Fenêtre basse : menu latéral resserré (logo du bas masqué) pour que toutes les entrées restent visibles.
- Test : `test_v2_20_0.mjs`.

# v2.19.4 — Observatoire des recherches : export .json, page qui le charge
- Nouveau bouton « Exporter l'observatoire des recherches (.json) » : calcule les recherches de chaque opération, une à la
  fois en rendant la main (progression dans l'indicateur de sauvegarde), et télécharge `ExtracTerre_observatoire_AAAA-MM-JJ.json`
  (identité, complétude, résultats des grilles ; ni citations ni texte des documents). Une opération dont rien n'a changé
  (documents et date d'analyse, grille, décisions, plans Ashton) reprend son dernier résultat sans relire ses documents.
  Bilan en fin d'export : opérations avec recherches / sans, et pourquoi.
- « Observatoire des recherches » ouvre seulement la page (avant : calcul de toutes les recherches de toutes les opérations
  à l'ouverture, ce qui figeait ExtracTerre). La page demande de charger le fichier exporté ; plusieurs fichiers s'ajoutent.
- Test : `test_v2_19_4.mjs`.

# v2.19.3 — « ExtracTerre ne répond pas »
- Mesuré sur une session réelle de 276 opérations (2 160 documents), en local : le recalcul de toutes les opérations prenait
  68 s, jusqu'à 14–17 s d'affilée pour une seule opération (page figée).
- Cause 1 : deux rattrapages (adresse « Opération » des RSET v2.10.1, type de zone du DH v2.12.1) devaient tourner une fois,
  mais leur marque n'était pas enregistrée : le texte des documents était relu, et certaines études reparsées, à chaque
  recalcul. Marques enregistrées avec le document ; l'adresse n'est cherchée que dans les RSET ; un document modifié par un
  rattrapage est sauvegardé une fois ; au démarrage, les rattrapages se font document par document en rendant la main.
- Cause 2 : le diagnostic et la complétude normalisaient le texte complet de chaque document à chaque recalcul ; le type est
  vérifié d'abord ; « PDF sans texte » et « rapport de saisie ClimaWin » sont détectés une fois et enregistrés : à partir du
  2e démarrage, le recalcul ne lit plus le texte des documents.
- `normalizeText` mémoïsé (lignes et fenêtres de lignes répétées par les analyseurs) : analyse d'une étude de 900 pages
  divisée par deux environ.
- Résultat sur la même session : recalcul complet < 1 s (opération la plus lourde 0,3 s) à partir du 2e démarrage ; le
  1er démarrage après mise à jour fait les rattrapages une dernière fois (~30 s en arrière-plan, document par document).
- Test : `test_v2_19_3.mjs` (données fictives).

# v2.19.2 — Démarrage fluide avec des centaines d'opérations
- Avant : écran blanc tant que tout n'était pas restauré (une transaction IndexedDB attendue par document, texte de chaque
  document découpé en lignes, puis recalcul de toutes les opérations avant le premier affichage).
- Écran de progression dès le démarrage (« Lecture des documents enregistrés… n / N »).
- Documents enregistrés lus dans une seule transaction ; texte préparé seulement à la première lecture (recherches, relecture).
- Le projet ouvert est recalculé d'abord, l'accueil s'affiche, les autres projets sont recalculés en arrière-plan par lots
  (« Recalcul des projets… n / N » dans l'indicateur de sauvegarde). Un projet ouvert avant son tour est recalculé à l'ouverture ;
  exports Excel, session JSON et observatoire des recherches recalculent d'abord ceux qui restent.
- Résumé de tuile (contrat, nom, complétude, compteurs) enregistré avec chaque projet : tuiles justes dès l'affichage.
- Mesure (280 opérations fictives, 4 documents chacune) : accueil utilisable en 0,5–1 s au lieu de 5 s.
- Test : `test_v2_19_2.mjs`.

# v2.19.1 — Recherches : sas sécurisé « Partiel »
- Grille Sécurité des logements, critère « Sas sécurisé » : Vigik (ou badge) + visiophone trouvés autour du sas, mais aucune
  platine IK08 (critère « Platine de rue anti-vandale IK08 ») → **Partiel (Vigik + visiophone, platine IK08 non trouvée)**,
  icône ◐. Partiel ne compte pas comme trouvé pour le thème Halls d'entrée. Avec IK08 : Oui, comme avant.
- Décision manuelle « Partiel » ajoutée au menu de ce critère ; règle rappelée sous le critère (grilles enregistrées comprises).
- **Observatoire des recherches bloqué** (12 opérations sur plus de 100) : le flux transmis contenait les citations et les noms
  de documents de chaque critère ; avec une centaine d'opérations il dépassait le stockage local, l'envoi échouait et
  l'observatoire gardait l'envoi précédent. Le flux ne contient plus que ce que l'observatoire lit (statut, valeur, thèmes).
  Le dernier résultat de chaque grille est gardé dans le projet (`searchCache`, sauvegardé) : une opération dont le texte des
  documents n'est plus en mémoire reste comptée. À l'ouverture, bilan : opérations transmises / non transmises et pourquoi.
- Test : `test_v2_19_1.mjs` (données fictives).

# v2.19.0 — Vecteur hybride, « Bâtiment 1 Est » regroupé, recherche des bâtiments
- **Vecteur énergétique hybride** (chauffage et ECS, avant et après travaux) : « Hybride Gaz/Électricité », vecteur PRINCIPAL
  d'abord, deux vecteurs au plus, libellés courts (« Hybride Bois/Fioul », « Hybride RCU/Gaz »). Nouveau module `js/vecteurs.js`.
  - Texte : seulement quand le document le dit (« PAC hybride », « bi-énergie », « bivalent », « PAC + chaudière gaz ») et que
    les deux vecteurs sont nommés dans les 90 caractères autour ; le générateur « en appoint / en relève / de secours » est le
    second, sinon l'ordre du texte. « VMC hybride », un sèche-serviettes électrique à côté d'une chaudière gaz : vecteur seul.
    « PAC hybride » sans second vecteur nommé : « Hybride » (rien d'inventé).
  - Calcul (consommations par énergie : XML RE2020, ClimaWin, U48Win, Th-C-E ex) : hybride si le second vecteur fait au moins
    30 % de l'usage, sinon le principal (avant : « Hybride » sans détail sous 60 % / 70 %).
- **Bâtiments** : « Bâtiment 1 Est », « Bât A aile nord » rejoignent automatiquement « Bâtiment 1 », « Bâtiment A » quand
  celui-ci existe seul (identifiant suivi de mots seulement). Une liste (« Bâtiment 1 2 10 », « B C »), « A1 » restent
  distincts. « 1 Est » et « 1 Ouest » sans « Bâtiment 1 » : rapprochement proposé (les identifiants identiques n'étaient
  jamais proposés).
- **Recherche manuelle** au-dessus du tableau des bâtiments : filtre les lignes (tous les mots, sans accents, « bât » ignoré),
  « Sélectionner les n résultats » les coche pour « Fusionner » ; « Tout cocher » ne coche que les lignes affichées ; nom
  proposé à la fusion : le RSET, sinon le plus court. Échap vide la recherche.
- Test : `test_v2_19_0.mjs` (données fictives).

# v2.18.3 — IC (et autres valeurs) lues « 2 903 » au lieu de 903
- L'exposant d'unité écrit en chiffre juste avant la valeur (« kgCO2/m2 903 », « [kg éq. CO2/m2] 903,15 », « m3 1 250 »)
  était pris pour le premier groupe d'un nombre à milliers : « m2 903 » donnait 2 903, « kgCO2/m2 903 » donnait 2.
- `stripUnitExponents` (utils) retire le « 2 » / « 3 » de m2, m3, km2… quand une valeur suit, et le « 2 » de CO2 : appliqué à
  `parseFrNumber`, à la lecture « libellé puis valeur » des études carbone, aux lecteurs RSET/RSEE CSTB, notice carbone,
  récap carbone, calculette BBCA, ClimaWin, DPE 3CL, notice rénovation, logiciels thermiques et aux recherches.
- Inchangés : valeur avant l'unité (« 903 kgCO2/m2 »), milliers (« 1 379,6 »), « m23 ». Test : `test_v2_18_3.mjs` (données fictives).

# v2.18.2 — « Vecteur ECS : Solaire » à tort
- Relevé dans les sessions : les 192 « Solaire » en vecteur ECS après travaux venaient de quatre tournures, aucune ne décrivant une
  installation solaire : « Présence composante solaire : Sans composante solaire » (RSET), critère « 16 a Production d'eau chaude
  sanitaire à partir d'un système … solaire thermique, Conforme », clause « … solaire validant la conformité et le bon
  fonctionnement », norme « NF P50-103 : Énergie solaire … ». Côté DPE (vecteur ECS avant travaux) : « Présence ECS solaire
  mesuré/observé : non » et l'intitulé « Stockage et Système solaire ».
- Dans ces tournures, « solaire » est ignoré pour le vecteur ECS (avant / après) et le mode ECS ; les autres énergies de la même
  ligne restent lues (« chaudière gaz … Sans composante solaire » → Gaz). Les vraies installations (CESI, chauffe-eau solaire,
  « Avec composante solaire », ECS solaire thermique) restent lues.

# v2.18.1 — Fiche Salesforce : bâtiments « * BAT 8 : (= bat E Rset) : x11 lgts collectifs : social LLS »
- **En-têtes de bâtiment avec remarques** : « BAT n : » suivi de remarques (« (= bat E Rset) », « social LLS ») ouvre bien un bloc,
  avec ou sans « : » final ; « x11 lgts » donne ses logements. Avant, seul le premier bâtiment était vu et les valeurs du deuxième
  passaient dans l'opération (le troisième était perdu). Les remarques restent affichées dans les notes de la fiche.
- **« SRT / SHAB : 913,11 / 728 »** : libellés et valeurs appariés, la SHAB est retenue comme surface du bâtiment.
- **Logements collectifs** de l'opération : somme des blocs « … lgts collectifs » (nombre de logements et de bâtiments), si la fiche
  ne les donne pas ailleurs.
- **Enveloppe propre à certains bâtiments** : « MUR / EXT bat 9 : … », « TERRASSE INACC bat 9 10 : … » ne valent que pour les
  bâtiments nommés (« bat 10 » ne désigne plus « BAT 1 ») ; une ligne qui nomme tous les bâtiments vaut aussi pour l'opération ;
  une ligne « + Doublage … » suit les bâtiments de la ligne précédente.
- « MUR … : Beton » seul = béton armé (comme « mur béton ») ; « Comblissimo » = laine de verre (soufflée).

# v2.18.0 · Ashton v0.7.1 — plan plein écran en mode outil dédié
- **Ashton** : ouvert depuis une ligne de la recherche, la barre « Nouvelles mesures » est masquée ; la grille de la page décalait
  alors ses rangées et la barre d'état du bas occupait la moitié de l'écran. Chaque zone a désormais sa rangée fixe : le plan
  prend toute la hauteur, la barre d'état est ramenée à 22 px.

# v2.18.0 — « Plan » choisi à la main, outils Ashton dédiés aux lignes de la recherche Sécurité
- **Liste des pièces** : nouveau choix **📐 Plan** dans le menu de chaque PDF. Le document n'est ni lu ni analysé (aucune donnée
  extraite) ; le bouton Ashton apparaît tout de suite, même avant « Analyser ». La ligne indique « non analysé (plan à mesurer
  dans Ashton) ». Revenir à une autre famille remet un plan jamais lu en attente : il sera lu au prochain « Analyser ».
- **Onglet Recherches** : bouton **Ashton** sur 7 lignes — accès observables depuis un logement (≥ 60 %), pas de communication
  entre bâtiments, renfoncements ≤ 1,20 m, cheminements ≥ 1,40 m, locaux aveugles non surveillés, hall non traversant, hall vitré.
  Plusieurs plans dans le projet : choix du plan avant l'ouverture. Aucun plan : bouton grisé (choisir « Plan » pour la pièce).
- **Ashton v0.7.0 — outil de vérification dédié** : ouvert depuis une ligne, Ashton n'offre que l'outil de ce point (comptage
  « observable / non observable », « communication », « local aveugle surveillé / non surveillé », « accès hall », profondeur de
  renfoncement, largeur de cheminement, surface du hall + menuiseries), plus Main, Flèche et Étalonner si des mètres sont
  nécessaires. Le panneau propose un verdict calculé sur les mesures ; l'évaluateur choisit Conforme / Non conforme, ajoute un
  commentaire et envoie la réponse. Les mesures de chaque outil sont gardées à part ; l'étalonnage déjà fait sur le plan est repris.
- La réponse d'Ashton fait foi sur la ligne (citation « Ashton (outil dédié) », date, commentaire), sauf décision manuelle Oui /
  Non / Sans objet ; « × » la retire. Hall vitré : le 44.2 reste cherché dans les documents. Réponses sauvegardées avec le projet
  (session, export JSON).

# v2.17.0 — tri des tuiles, recherche Sécurité plus précise (Ashton), valeurs étranges surlignées
- **Ashton v0.6.1–0.6.3** : boutons « Hall » et « Menuis. hall » dans la barre d’outils (outil + élément choisis d’un clic) ; Ashton intégré ouvert avec son numéro de version (plus d’ancienne version en cache) ; la barre d’outils de gauche défile quand la fenêtre est trop basse ; measure.js versionné, pour qu’un ancien fichier en cache ne masque plus les éléments « Hall » et « Menuiserie hall ».
- **Tuiles d'accueil** : tri par remplissage décroissant / croissant et par ordre alphabétique (nom de l'opération, sinon
  contrat), aussi pour les tuiles de maître d'ouvrage (remplissage moyen).
- **Recherche Sécurité — portes** : A2P **et** BP1 (ou BP2 / BP3) exigés dans le même bloc ; l'un sans l'autre = non conforme
  (« Serrure A2P* » seule ne suffit plus).
- **Hall vitré** : dans Ashton, surface « Hall » et largeur « Menuiserie hall » ; ExtracTerre calcule largeur × 2,20 m ÷ surface
  du hall et valide à 30 % ; le 44.2 reste cherché dans les documents (« À vérifier » s'il manque).
- **Hall non traversant** : nouvel outil **Accès** dans Ashton (v0.6.0, touche H) ; un seul accès compté = conforme, deux ou
  plus = non conforme. « Hall traversant » écrit dans un document devient un indice contraire.
- **Valeurs étranges surlignées en jaune** (jamais modifiées) : Tic < 24 °C, DH < 10 ou > 1 250, Cep / Cep,nr > 300
  (avant travaux > 800), fioul en vecteur chauffage ou ECS après travaux. Mêmes règles dans TotalRecoll.

# v2.16.1 — tuiles d'accueil : dossiers partiellement complétés
- Tuile de maître d'ouvrage : « x dossier(s) partiellement complété(s) » à côté des dossiers complets (opérations complétées à plus de 10 % et moins de 100 %).

# v2.16.0 — études RE2020 de BE (NRGYS / Perrenoud) lues en entier, favoris des tuiles d'accueil
- **Étude RE2020 « Synthèse thermique & carbone »** (dossier thermique et environnemental, « Mode constructif ») : classée Étude
  thermique et non plus DPE (la phrase « le DPE est effectué en fin de chantier » donnait 14 points au DPE). Sur une étude réelle de
  25 pages : 40 colonnes renseignées au lieu de 3, lecture en 3 s.
- **Mode constructif** : par paroi, structure (« Voile béton », « Dalle béton » → Béton armé, « Solive bois » → Plancher bois),
  isolant, épaisseur et R des planchers bas, parois verticales (extérieures seulement ; ITI / ITE) et planchers hauts.
- **BioMax** lu comme Bbio max ; **Ic Énergie max / Ic Construction / Ic Construction max** lus (le max n'est plus pris pour
  l'Ic Énergie) ; **SHAB** du tableau « Composition du projet ».
- Nouvelle valeur de mode de chauffage **« Hybride (PAC + gaz) »** : « PAC … + Chaudière gaz … », « PAC hybride ».
- **Favoris** : une étoile sur chaque tuile d'opération ; les favoris passent en tête des listes et une tuile « ★ Favoris »
  les regroupe au-dessus des maîtres d'ouvrage. Sauvegardés avec l'opération et dans l'export / import de session.

# v2.15.0 — plans mesurés dans Ashton (onglet Plans), fenêtre des doublons, pack du 02/11/2026
- **Plans** : un PDF dont la 1re page est en A2 ou plus (ou en A3 avec un nom de plan : « Plan », « Façades », « Coupe »,
  « RDC », « R+1 »…) est reconnu comme plan dès la lecture ; il n'est ni lu ni OCRisé, aucun parseur ne s'y applique. Une
  pièce écrite (CCTP, RSET, étude, notice, rapport…) n'est jamais un plan, quel que soit son format.
- Dans la liste des documents, un plan propose **Ashton** (pictogramme de kutch) à la place d'Aperçu / IA / Crible fin. Ashton (intégré
  dans `ashton/`, v0.5.0) s'ouvre en plein écran sur le plan ; sa **table de correspondance** regroupe les mesures par type
  (longueur, largeur, surface, quantité) et par référence : min / moy / max pour les longueurs, largeurs et surfaces, total
  pour les quantités. Une quantité se relie à une colonne ExtracTerre par un **menu déroulant** (Nombre de brasseurs d'air,
  Nombre de logements…). « Kutcher » (onglet Plans) rouvre le plan dans Ashton ; « Envoyer vers ExtracTerre » remplit le nouvel **onglet Plans** de l'opération.
- Onglet Plans : une table par plan, bâtiment d'affectation des quantités (celui du plan s'il n'en nomme qu'un, sinon toute
  l'opération), **mot-clé** modifiable pour chaque quantité (« Brasseur d'air » → Nombre de brasseurs d'air). Une quantité
  reliée renseigne sa colonne comme un document de type Plan (priorités de sources inchangées) : « Brasseur d'air » passe
  alors à Oui / Non dans les autres onglets. Les tables sont gardées dans la session (sauvegarde locale et export JSON).
- **Doublons** : quand un ajout (tableau d'opérations, fiche Salesforce, session JSON, Box…) crée une ou plusieurs opérations
  au même numéro de contrat, une fenêtre liste chaque contrat en double avec ses opérations (documents, bâtiments, valeurs,
  complétion) : la plus complète est cochée, les décochées sont retirées avec leurs documents ; au moins une est gardée par
  contrat. Les doublons déjà présents à l'ouverture restent signalés comme avant (tuiles « doublon »).
- **Pack d'amélioration du 02/11/2026** (4 290 événements depuis la v2.6.1, 17 signalements bêta) :
  - collage libre / fiche Salesforce : valeur hors plage physique non reportée (« Tic = 46165 », date Excel) — la ligne reste
    « non reconnue » ; « Profil = Visite » n'est plus un profil ;
  - CCTP : un ouvrage provisoire de chantier (« tunnel de protection provisoire… structure métallique ») n'est plus une structure
    de mur ; l'intitulé de lot « Chauffage, Ventilation, Climatisation et Désenfumage (CVCD) » n'est plus une climatisation ;
  - RSET Pléiades : « Nature de l'isolation des toitures » s'arrête avant la question suivante (« Autre » au lieu de
    « Autre végétalisée ? Non »).
  - analyses interrompues après 5 minutes : aucune dans le journal depuis la v2.10.1 ; 9 XML BETie / PEP (fiches produits)
    « illisibles » en v2.14.1 non traités (fichiers absents du pack).
- Non-régression : 65 fichiers de tests (dont `test_v2_15_0.mjs` et `test_ashton.mjs`), 149/149 auto-tests moteur,
  banc du pack : 55 signalements « valeur fausse » corrigés sur 59 (54 avant).

# v2.14.2 — favori Salesforce : bâtiments « Bâtiment n° 1 : A1-A2 »
- Dans « Performance thermique », un en-tête « Bâtiment n° 1 : A1-A2 » (ou « Bâtiment 3 : D1 - D2 ») ouvre un bâtiment
  nommé par ses cages (« Bâtiment A1 - A2 ») ; avant, toutes les valeurs tombaient dans un seul bâtiment.
- « Ubât = 0,552 / 0,895 » et « Tic = 0 / 30,38 » : la seconde valeur va en Ubat réf. et Tic réf. (comme Cep / Cep réf.).

# v2.14.1 — accueil : recherche d'une opération
- Barre de recherche au-dessus des tuiles de l'accueil : contrat, nom, code projet ou maître d'ouvrage, sans tenir compte
  des accents ni des majuscules. Les opérations trouvées s'affichent à plat (tous maîtres d'ouvrage confondus) ; Échap efface.

# v2.14.0 — favori Salesforce : statuts et code de l'évaluation ; recherche Sécurité : A2P / BP1 seuls, clôtures de chantier
- Fiche lue aussi pour des colonnes existantes : Évaluation: Code interne (EVA-…), Évaluation: Statut, Contrat: Statut,
  Société principale du MOA, Version du référentiel (« Version du 21/01/2025 »), Profil spécifique. Un champ vide dans
  Salesforce (libellé suivi d'un autre libellé) n'est jamais lu comme une valeur.
- Libellés réécrits sans ambiguïté : « Évaluation Code interne » n'écrase plus l'OPE, « Groupe MOA » n'écrase plus le maître d'ouvrage.
- Recherche « Sécurité des logements » : « A2P » seul ou « BP1 » seul n'est plus une validation — le critère passe en « Non
  conforme » (nouveau type de terme « insuffisant ») ; « A2P BP1 », « BP2 … A2P », « A2P * » restent conformes.
- Clôture ≥ 1,80 m : les clôtures et barrières de chantier (ligne ou ligne voisine : chantier, barrière, Heras, palissade) sont écartées.
- Grille Sécurité déjà enregistrée dans le navigateur : mise à jour à son chargement, les termes ajoutés par l'utilisateur sont gardés.

# v2.13.1 — favori Salesforce : « Commentaires pré-analyse » lus
- Blocs « BAT B / Cep initial = … / Cep projet = … / Cep référence = … / Tic = … < Tic réf = … / Ubat = … < Ubat base = … /
  Q4 = … » : Cep avant travaux, Cep et Cep après travaux final, Cep Ref, Tic, Tic ref, Ubat après travaux, Ubat Ref, Q4Pa-surf.
  Ils complètent « Performance thermique » (prioritaire) sans dédoubler un bâtiment ; « < » sépare deux valeurs d'une ligne.

# v2.13.0 — DPE 3CL d'immeuble par bâtiment : avant / après lus dans des documents séparés
- Rapport « 3CL non réglementaire » (Pléiades…) lu comme un DPE 2021 : classes énergie et GES recalculées depuis l'énergie
  totale, les émissions et la surface (seuils DPE 2021, étiquette = la plus défavorable). Bâtiment pris dans le nom du fichier
  (« Bâtiment J.pdf ») au lieu de « Bâtiment unique » ou de la légende « bâtiment extrêmement peu performant » ; noms de
  fichiers macOS (Unicode décomposé) et texte OCR accentué pris en compte.
- XML DPE de l'ADEME (« <dpe version=…> ») : classes énergie et GES lues par balises (surface et année en source secondaire).
- Phase par le chemin du fichier : « - EI », « état initial », « avant » = avant travaux ; « EF », « après » = après. Un DPE sans
  mention passe en après travaux quand un autre document du même bâtiment est explicitement l'état initial.
- Valeur au seuil de classe (rapport qui affiche des valeurs tronquées : 6,1 kgCO₂ affiché « 6 ») : classe mise à vérifier.
- Bâtiments parasites écartés : en-tête « Bâtiment J L M N O P Q Total », « bâtiment conforme », « Étiquette DPE »…

# v2.12.4 — données collées : jamais remplacées sans validation
- Accueil, « Coller un tableau » sur une opération existante : les lignes s'ajoutent à son tableau manuel au lieu de le
  remplacer (bâtiments, logements… étaient effacés sans avertir). Une valeur déjà collée qui changerait est listée et n'est
  remplacée qu'après « OK » ; une ligne sans bâtiment est comparée à chaque bâtiment. Le maître d'ouvrage n'est plus écrasé.
- Une opération remplie uniquement par collage libre n'est plus réutilisée comme opération vide après rechargement.
- Collage libre : valeurs définitives dès la consolidation (comme le tableau Excel) ; les colonnes déduites (Oui / Non,
  DH ZT / ZNT) partent de la valeur collée et non d'une valeur de document contraire.

# v2.12.3 — accueil : tableau « Code projet | Nom projet | Maître d’ouvrage | Groupe MOA »
- « Code projet » est reconnu comme code interne (OPE-…) et « Groupe MOA » comme société principale du maître d'ouvrage :
  sans colonne contrat ni code reconnue, aucune opération n'était créée. « Nom projet » donne le nom de la tuile.

# v2.12.2 — accueil : « Coller un tableau » crée bien les opérations
- Un tableau d'opérations à 2 colonnes (contrat + maître d'ouvrage, par ex.) était pris pour un collage libre et appliqué à
  l'opération ouverte : aucune tuile créée. Toute zone avec une colonne contrat ou code interne est lue comme un tableau.
- Une cellule Excel sur plusieurs lignes (commentaire, adresse) coupait sa rangée et faisait basculer le collage en collage
  libre : elle est remise sur une ligne.
- CCTP : les brasseurs d'air (type et nombre) sont lus et alimentent la colonne « Brasseur d’air » (Oui) ; « brasseur(s) d’air »
  avec apostrophe et au pluriel sont reconnus ; une attente, une option ou « sans objet » n'en est pas un ; un numéro d'article
  (« 4.2 Brasseurs d’air ») n'est plus pris pour un nombre.

# v2.12.1 — fiche Évaluation Salesforce : enveloppe appliquée à chaque bâtiment, nombres et DH fiabilisés
- Les valeurs de la fiche hors bloc de bâtiment (planchers hauts, parois verticales, planchers bas, menuiseries, systèmes,
  identité) s'appliquent à chaque bâtiment (sauf valeur propre au bâtiment) : elles partaient sur un « Bâtiment unique » à part
  quand l'opération avait déjà plusieurs bâtiments.
- Paroi : isolant, épaisseur et R viennent de la même ligne (plus de mélange entre deux lignes) ; « LM projetée » = laine minérale ;
  le sous-titre « Mur extérieur ITI : / ITE : » range les isolants qui suivent dans les colonnes ITI / ITE, et la première
  ligne du mur extérieur remplit aussi la colonne générale.
- « Sref = 1 780,20 » : espace des milliers gardé (lu 1 auparavant) ; « (Gain BBio = 30,4 %) » reconnu ;
  « IC Construction = … / IC Construction 2025 = … » : libellés de plusieurs mots séparés par « / ».
- « DH (Zones non traversantes) = Groupe … : 1 048,50 ; Groupe … : 1 175,20 » : groupe le plus défavorable (le premier auparavant).
- Favori depuis l'accueil : les onglets Salesforce ouverts (« 00005424 | Contrat ») ne servent plus à choisir l'opération ;
  l'OPE de la fiche prime sur le numéro de contrat.

# v2.12.0 — Charger depuis Box (Box Drive)
- Bouton **📦 Charger depuis Box** dans la zone de dépôt d'une opération. Le dossier « 2 PRODUCTION EVALUATION / 1 BEE Contrats »
  est choisi une fois (Chrome / Edge en gardent l'accès ; une autorisation d'un clic est redemandée à chaque session).
- Le dossier « 0000xxxx - … » du contrat de l'opération est retrouvé ; ses sous-dossiers d'Évaluation **CCTP**, **Étude carbone**
  et **Étude thermique** sont listés (sous-dossiers compris, PDF / XML / Excel / JSON / ZIP) dans une liste à cocher.
- Pré-cochage des plus récents : études = dernier envoi de chaque dossier (sous-dossiers datés « 2026 02 » = versions,
  « Old / Ancien / Archive » jamais cochés) ; CCTP = dernière version de chaque lot (indice / révision mis à part).
  Les documents déjà chargés sont grisés. Tout reste lu sur le poste.

# v2.11.4 — accueil « Coller un tableau » : nouvelles tuiles visibles
- Un tableau d'une seule opération collé depuis l'accueil remplissait l'opération ouverte en dernier (avec demande de
  remplacement de son tableau) au lieu de créer sa tuile : il crée maintenant sa tuile (ou met à jour celle du même contrat).
- Les opérations du dernier import sont marquées « nouvelle », et chaque tuile Maître d'ouvrage indique combien elle en
  a reçu : une opération ajoutée à un maître d'ouvrage existant ne passe plus inaperçue.

# v2.11.3 — fichiers déposés hors de la zone de dépôt
- Un fichier (XML, PDF, Excel…) lâché hors du cadre « Déposez ici », notamment sur l'accueil, était ignoré sans message.
  Depuis l'accueil il ouvre maintenant une opération (la vide en cours, sinon une nouvelle) et y est ajouté ; ailleurs, il
  rejoint l'opération ouverte.

# v2.11.2 — favori Salesforce : la fiche reçue s'ouvre aussi depuis l'accueil
- Depuis l'accueil, le texte envoyé par le favori « → ExtracTerre » ne donnait qu'une notification de quelques secondes.
  Il ouvre maintenant l'opération dont l'OPE ou le numéro de contrat figure dans la fiche (sinon une nouvelle opération)
  et affiche directement l'aperçu du collage.

# v2.11.1 — DH sans type de zone reporté en DH ZNT
- Un DH lu sans type de zone (ClimaWin, notices, « DH = … ») va en DH ZNT, sauf si le bâtiment n'a que des zones
  traversantes (DH ZT). L'alerte « DH lu sans type de zone » est retirée ; la traçabilité indique « reporté en DH ZNT ».

# v2.11.0 — DH ZT / DH ZNT à la place de DH ; colonnes ITE, ITI, Brasseur d'air, Climatisation active
- La colonne « DH » est remplacée, au même endroit, par « DH Zone traversante (DH ZT) » et « DH Zone non traversante (DH ZNT) ».
  Chacune garde le groupe le plus défavorable de son type de zone. Le type de zone vient de la colonne « Trav. » du tableau DH
  des RSET, de Is_Traversant dans les XML RE2020, et des libellés « DH ZT / DH ZNT / zones (non) traversantes » des fiches collées et Salesforce.
  DH (la zone la plus défavorable) reste lu et contrôlé en interne (cohérence avec DH max), mais n'est plus exporté (211 colonnes).
- 4 colonnes « Oui / Non » ajoutées en fin d'export, déduites des colonnes de détail (une saisie n'est jamais remplacée) :
  ITE et ITI (Oui si l'isolant de ce côté est décrit, Non si seul l'autre côté l'est), Brasseur d'air (Oui si des brasseurs
  sont lus, Non si leur nombre est 0), Climatisation active (Non si « Refroidissement » = Aucun, Oui pour un système actif).
- XML RE2020 : un groupe déclaré climatisé (Is_Climatise = 1) donne « Refroidissement = Climatisation active ».
- Corrections : « Le DH max est de 1250 °C.h » n'est plus lu comme un DH ; la phrase type des RSET sur les groupes
  climatisés (indicateur DH) n'est plus lue comme un système de refroidissement.
- Les documents déjà analysés qui portent un DH sont relus une fois pour récupérer le type de zone.
- **Importer une session (.json)** (menu latéral) : les opérations du fichier s'ajoutent à la liste et sont sauvegardées localement.
  L'export de session contient désormais les projets complets (documents lus, occurrences, saisies, collages, économie) : l'import
  restitue toutes les données, sans les fichiers sources (à redéposer seulement pour le surlignage PDF). Un export plus ancien
  restitue les valeurs retenues avec leur source, les saisies et les collages.
- **Doublons de numéro de contrat** : une alerte apparaît dès que plusieurs tuiles portent le même contrat (« 00004723 » = « 4723 ») ;
  les tuiles sont marquées « doublon » et chaque tuile Maître d'ouvrage indique combien de ses opérations sont concernées.

# v2.10.7 — fiche Évaluation Salesforce : en-têtes « BAT AB / Nbre logts = 14 / Q4 = 0,72 »
- Paires « libellé = valeur » sur l'en-tête de bâtiment, séparées par « / » (logements, Q4…).
- Paires séparées par « - » ; « Gain = … » seul prend le gain de la valeur qui précède.
- « DH ZT - T3 = … - T2 = … » : DH par zone et typologie, la plus défavorable est retenue.
- Enveloppe « BAT A & B / Combles : … » : rangée dans les bâtiments nommés ; émojis retirés des descriptions.
- Vocabulaire : Pregymax = PSE graphité ; « VR alu / PVC » = Volet roulant ; « flocage » = isolant.

# v2.10.6 — fiche Évaluation Salesforce : en-têtes « Bât A / 21 logts - SHAB = … »
- En-tête de bâtiment avec logements et SHAB sur la même ligne (Bât, Bâtiment, Immeuble, Plot, Cage, Ilot, Lot).
- Paires séparées par « ; » ; « Bbio max = 71,9 (Gain 20,6 %) » donne aussi le gain.
- Une valeur placée après une ligne vide sous les blocs (« Q4 = 0,8 ») vaut pour toute l'opération.

# v2.10.5 — fiche Évaluation Salesforce : en-têtes sans séparateur, paires groupées
- Bâtiments sous « Logement 1 à 6 » / « Logement 7 & 8 » (sans « : ») : nombre de logements déduit (6, 2).
- Plusieurs paires sur une ligne : « Bbio=33 Bbiomax=81,3 », « Cep,nr=65,4 Cep,nrmax=65,4 » ; IC vides ignorés.
- Fiche reconnue dès qu'elle contient « Performance thermique » et un Bbiomax, même sans code OPE.

# v2.10.4 — fiche Évaluation Salesforce : en-têtes à puce et valeurs groupées
- Bâtiments sous « * BEG-1/2 : x2 lgts indiv : » (le nombre de logements est lu dans l'en-tête).
- « Bbio : 84,4 / 91,8 / -8,1 % » = valeur / maximum / gain (idem Cep, Cepnr) ; « ICconstruction : 767,85 / 780,02 »
  = valeur / maximum (idem IC énergie) ; « DH : 713,9 et 625 » = zone la plus défavorable.
- En-tête de l'opération : le bloc « OPE-… » suivi d'un code postal (et non le premier « OPE-… » de la page).
- Enveloppe : une ligne avec R n'est un isolant que si elle le dit (« Brique … R=1,5 » = structure) ; « 120+10 mm » =
  120 mm d'isolant ; murs entre logements ignorés aussi en ligne ; chauffage « * PAC … : » retenu, émetteurs écartés.
- Vocabulaire : « VR manuel / électrique » = Volet roulant ; « Brique BGV » = Brique terre cuite.
- Vérifié sur trois fiches réelles (6, 5 et 10 bâtiments) ; test : test_v2_10_4.mjs (fiche fictive).

# v2.10.3 — fiche Évaluation Salesforce : autres mises en forme
- Bâtiments sous tout en-tête « Nom : » / « Nom = » (ILOT_1, Maison 1, Bât A…), remarque entre parenthèses signalée
  (« ILOT_4 : (ilot 5 sur ACV) ») ; paires « libellé = valeur » comme « libellé : valeur ».
- Libellés reconnus en plus : Bbiomax, IC Construction max 2025 / 2028, IC Energie max 2025 / 2028, Q4 Pa-surf,
  DH des zones traversantes / non traversantes (DH le plus défavorable, type de zone noté).
- Une sélection partielle de la fiche (sans l'en-tête OPE) est convertie dès qu'elle contient « Performance thermique ».
- Enveloppe : murs de refend / entre logements ignorés, contre-cloison rangée en ITI, R « ≥ » lu, renvois
  « > Lot 03 — Page 17 » ignorés ; menuiseries hors fenêtres de toit ; chauffage = générateurs seuls (émetteurs exclus) ;
  « SO » = pas d'ENR ; « Châssis en bois » = Bois.
- Test : test_v2_10_3.mjs (fiche fictive).

# v2.10.2 — fiche Évaluation Salesforce (favori) convertie par bâtiment
- Le texte envoyé par le favori « → ExtracTerre » depuis une fiche Évaluation (section « Performance thermique ») est
  réécrit en « libellé = valeur » avant lecture ; la zone de collage montre ce texte converti, modifiable.
- En-tête de l'opération : code OPE, nom, adresse, code postal, ville, département, contrat (« Statut du contrat … »),
  référentiel, maître d'ouvrage, total logements / bâtiments, mentions (BEE+ → Mention BEE+ = Oui), niveaux visés.
- Un bâtiment par bloc « Maison 1 = », « Maisons 2/3 = » : libellés Salesforce reconnus (Bbio max, Cepmax, Cepnrmax,
  ICconstruction, Icenergie, Q4, SHAB…) ; gains écrits en positif (convention ExtracTerre) ; « Maisons 2/3 » = 2 logements.
  Un gain incohérent avec la valeur et son maximum est signalé dans l'aperçu, jamais corrigé.
- Enveloppe et systèmes pour toute l'opération : planchers hauts / bas (isolant, épaisseur, R), parois (structure,
  doublage ITI / ITE dans les colonnes dédiées), menuiseries, chauffage, ECS, ventilation. Sous-sections « - Notes »
  (écarts RSET / CCTP, « NC ») ignorées ; références « §… p… CCTP » retirées.
- Collage libre : un libellé exact de colonne contenant « épaisseur » est désormais lu comme une paire.
- Test : test_v2_10_2.mjs (fiche fictive).

# v2.10.1 — adresse de l'opération lue dans les RSET PDF
- Constat : aucune adresse n'était remplie (0 opération sur 222 dans la session du 28/10) ; seuls les libellés
  « Adresse de l'opération / du projet… » et le XML RE2020 étaient lus, alors que les RSET PDF portent l'adresse sous
  un simple « Adresse », dans le bloc « Opération ».
- Les RSET PDF (RE2020, RSEE, RT2012 — cadre CSTB) donnent désormais l'adresse de la ligne « Adresse » du bloc
  « Opération » suivie de « Département » (cellule RT2012 sur trois lignes comprise). Les adresses du maître d'ouvrage,
  du maître d'œuvre et des bureaux sont ignorées. Cette lecture l'emporte sur les autres du même document.
- Projets déjà analysés : l'adresse est rattrapée à la prochaine analyse depuis le texte sauvegardé, sans recharger les fichiers.
- Vérifié sur 3 RSET réels (RT2012, RE2020, RSEE multi-bâtiments) ; test : test_v2_10_1.mjs (données fictives).

# v2.10.0 — parois verticales : isolation par l'intérieur (ITI) et par l'extérieur (ITE)
- 6 colonnes ajoutées en fin d'export (famille Enveloppe) : Parois verticales ITI type d'isolant / épaisseur isolant /
  R isolant, et les mêmes pour ITE. Les colonnes « Parois verticales … » générales sont conservées à l'identique.
- Chaque valeur d'isolant de mur lue par n'importe quel parseur est recopiée côté ITI ou ITE quand la ligne qui la porte
  le dit : mention explicite (ITE / ITI, « isolation par l'extérieur / l'intérieur », ETICS, enduit sur isolant, mur
  manteau) d'abord, indice ensuite (bardage, vêture → ITE ; doublage, contre-cloison → ITI). Ambigu ou muet : rien n'est
  rempli, jamais deviné.
- Mêmes sources prioritaires et mêmes bornes de cohérence que les parois verticales. Test : test_v2_10_0.mjs.
- Catalogue des champs régénéré (206) : il reprend aussi les sources secondaires ajoutées depuis sa dernière génération.

# v2.9.0 — adresse de l'opération et géolocalisation
- 7 colonnes ajoutées en fin d'export (groupe « Localisation ») : Adresse, Code postal, Ville, Code INSEE, Latitude,
  Longitude (WGS84, degrés décimaux), Géolocalisation (précision). Libellés identiques au tableau Tous contrats.
- Adresse lue dans le livret d'opération, le XML RE2020, les études ClimaWin et toute pièce qui cite explicitement
  « Adresse de l'opération / du projet / du chantier / du terrain… » suivie d'un code postal (jamais l'adresse d'un
  intervenant) ; aussi par collage Salesforce ou saisie.
- Géocodage automatique par la Géoplateforme IGN (Base Adresse Nationale) dès qu'une voie et un code postal ou une
  commune sont connus : position retenue seulement au numéro ou à la voie, dans le code postal lu (sinon « Non
  géolocalisée : motif ») ; réponse mise en cache dans le projet. Une latitude/longitude saisie n'est jamais remplacée.
- Revue : groupe « Localisation » et lien « Voir sur la carte » (photo aérienne Géoportail).

# v2.8.2 — critère « Statistiques » dans les Recherches
- Nouveau type de critère « Statistiques » (tableaux de surfaces) : une valeur par ligne trouvée (premier nombre
  isolé entre Min et Max ; n° de logement « A101 » et niveaux « R+2 » ignorés), puis nombre, min, moyenne, max,
  P10, P25, médiane, P75, P90 ; une colonne Excel par statistique.

# v2.8.1 — favori Salesforce vers l'onglet déjà ouvert, zone OCR au choix
- Le favori « → ExtracTerre » ouvre un petit relais (relay.html) qui transmet le texte à l'onglet ExtracTerre déjà
  ouvert et déverrouillé (documents conservés), puis se ferme ; l'onglet ExtracTerre signale « ● Salesforce reçu ».
  Sans onglet ouvert : « Réessayer » ou ouverture d'ExtracTerre avec le texte. L'ancien favori est à remplacer.
- Capture OCR : le sélecteur de Chrome s'ouvre sur les onglets (ExtracTerre exclu), puis la zone à lire se trace à
  la souris ; l'image est agrandie et passée en niveaux de gris avant lecture (captures collées comprises).

# v2.8.0 — Salesforce sans fichier, capture OCR, confirmation des données manuelles
- Bouton de favoris « → ExtracTerre » (à glisser dans la barre de favoris, depuis Données manuelles) : sur une fiche
  Salesforce, il envoie le texte de la page (ou la sélection) à ExtracTerre, qui ouvre l'aperçu du collage libre.
  Le texte passe par l'adresse de la page (fragment #, jamais envoyé au serveur) et en est effacé aussitôt.
- Collage libre : format Salesforce « libellé » puis « valeur » sur la ligne suivante (libellés reconnus exactement
  ou par alias uniquement ; textes d'aide « Modifier … » ignorés ; le reste de la page n'est pas lu comme un CCTP).
- « 📷 Capturer un onglet (OCR) » et collage direct d'une capture d'écran : lecture OCR en mémoire, sans fichier ;
  la provenance « Capture d'écran (OCR) » reste affichée dans la revue.
- Sécurité : toute modification ou suppression d'une valeur issue d'une donnée manuelle (revue, correction du tableau,
  correction par sélection, recherche libre, nouveau collage libre ou Excel) demande d'abord une validation.

# v2.7.6 — données manuelles définitives
- Une donnée saisie, validée ou collée (texte libre ou tableau Excel) est définitive : aucune analyse ni fusion de
  documents ne la remplace (y compris les règles DH le plus défavorable et RSET direct).
- Bâtiment fusionné : la donnée manuelle suit le bâtiment cible ; bâtiment absent de l'analyse : il est recréé
  (sauf s'il a été supprimé manuellement).
- Revue : bouton « Supprimer » sur chaque donnée manuelle pour rendre le champ à l'analyse documentaire ;
  « Vider » le collage efface aussi les valeurs du collage libre.

# v2.7.5 — collage libre : bâtiments toujours créés
- Les bâtiments d'un collage libre sont créés tels quels : jamais rattachés automatiquement à un bâtiment « maître »
  d'un RSET ni à un nom voisin (une fusion manuelle reste possible) ; un bâtiment supprimé lors d'un essai précédent
  est recréé s'il est collé de nouveau.
- Texte libre collé depuis l'accueil : refusé avec un message (il faut ouvrir l'opération concernée), pour ne pas
  l'appliquer à une autre opération.

# v2.7.4 — collage libre : bâtiments créés visibles
- Après « Intégrer au projet », le message liste les bâtiments créés et la Revue s'ouvre sur le premier bâtiment collé,
  filtre « Renseignés » (le filtre « À compléter » masquait les valeurs collées, qui semblaient absentes).
- Vérifié : opération avec documents (« Bâtiment unique ») + fiche de 3 maisons → 3 bâtiments créés et remplis.

# v2.7.3 — revue : validation des propositions
- Correctif : « Valider » / « Écarter » / « Voir » ne trouvaient pas la proposition des groupes repliables selon le profil
  (ex. Carbone d'une opération en rénovation) : la valeur n'était pas appliquée et la ligne restait « À vérifier ».
- La valeur validée est appliquée au champ de la ligne cliquée et au bâtiment affiché ; un message signale tout échec.

# v2.7.2 — collage libre : « toute l'opération » sur tous les bâtiments
- Les valeurs du texte descriptif (« Toute l'opération » dans l'aperçu) sont reportées sur **tous les bâtiments de
  l'analyse**, y compris ceux issus des documents ; une valeur collée dans la section d'un bâtiment reste prioritaire
  pour ce bâtiment.

# v2.7.1 — collage libre : fiches de synthèse (maisons, texte descriptif)
- En-têtes de section libres : « Maison 1-01 : », « Maisons 1-03 1-04 1-05 1-06 : », « Villa A : »… (ligne terminée par « : »
  avec un mot de bâtiment ou suivie de lignes « libellé = valeur ») ; une section répétée est fusionnée.
- Partie descriptive d'une fiche (Planchers hauts / Parois verticales / Planchers bas / Menuiseries / Chauffage / ECS /
  Renouvellement d'air / Énergies renouvelables) : lue par les parseurs CCTP d'ExtracTerre et par des règles de section
  (isolant, épaisseur et R de la ligne de l'isolant, structure, vitrage, occultations, VMC hygro B, ENR « sans objet »),
  appliquée à toutes les maisons collées (« Toute l'opération » dans l'aperçu). « libellé = » sans valeur est ignoré.
- Aperçu : choix du bâtiment de l'analyse qui reçoit chaque section (correspondance automatique ou nouveau bâtiment).

# v2.7.0 — Collage libre prioritaire, colonne Q4Pa-surf, export JSON de session, observatoire des recherches
- **Collage libre** dans « Coller » : texte « libellé = valeur » (ou « : », tabulation), regroupé par bâtiment
  (« Bâtiment G : », « Bat H »). Chaque ligne est rangée dans une colonne (libellés courts : Sref (ou Srt), Bbiomax,
  Cepnrmax, Gain Cep…), modifiable dans l'aperçu ; les lignes non reconnues peuvent être rangées par l'IA (Ollama en
  local) : elle ne choisit que la colonne, la valeur est relue dans la ligne collée. Les valeurs appliquées **priment sur
  toutes les données des documents** (corrections manuelles, source « Collage libre » tracée) et créent les bâtiments
  manquants. DH par type de zone : la zone la plus défavorable est retenue, zones traversantes / non traversantes notées.
- **Nouvelle colonne « Q4Pa-surf (m³/h.m²) »** en fin d'export (193 colonnes).
- **Export de la session (.json)** (barre de gauche) : opérations, identité, complétion, valeurs retenues avec leur source
  (document, page, extrait), saisies manuelles et collages, économie, résultats des recherches ; pas le contenu des documents.
- **Observatoire des recherches** (`observatoire.html`, ouvert depuis la barre de gauche) : compile les résultats de
  l'onglet Recherches par opération (fusion par contrat / code interne, sur ce poste) ; filtres grille / maître d'ouvrage /
  opération ; part d'opérations aux indices suffisants par thème ; taux d'indices trouvés / contraires par critère ;
  min / médiane / max des valeurs chiffrées ; tableau des opérations ; export CSV ; import d'une session JSON.

# v2.6.2 — fiche d'analyse pleine largeur
- La colonne « Projets » à gauche des résultats est retirée : les résultats occupent toute la largeur. On change
  d'opération par l'accueil (tuiles) ou le sélecteur ‹ › de la barre ; « ＋ Fichiers » reste dans la barre.

# v2.6.1 — écran d'accueil en tuiles, en-têtes de tableaux d'opérations
- **Écran d'accueil = uniquement les tuiles** : macro-tuiles par maître d'ouvrage → tuiles d'opérations → fiche de
  l'opération (dépôt des documents, analyse, résultats). « Accueil » et « ← Synthèse projets » ramènent aux tuiles.
  Tuiles d'action sur l'accueil : Nouvelle opération, Coller un tableau, Importer un Excel. Les opérations vides
  n'apparaissent pas.
- Import / collage d'un tableau d'opérations : « Numéro de contrat », « N° de contrat », « Contrat », « N° d'opération »,
  « Société », « Bailleur » sont reconnus (contrat, code interne, maître d'ouvrage). Alias d'en-têtes seulement : la
  lecture du texte des documents n'est pas modifiée.

# v2.6.0 — Tuiles d'opérations, export à la carte, recherches personnalisées, pack du 26/10/2026
- **Page principale en tuiles** : une tuile par opération (n° de contrat a minima, nom, code interne, taux de complétion,
  documents / bâtiments / valeurs / alertes). Dès qu'un maître d'ouvrage est connu, les opérations sont rangées dans des
  **macro-tuiles par maître d'ouvrage** (nombre d'opérations, dossiers complets, complétion moyenne) ; un clic ouvre ses
  opérations. Complétion = part des champs de la revue renseignés (profil neuf / rénovation), moyenne des bâtiments.
- **Tableau d'opérations importé ou collé** (Excel) : une opération par n° de contrat / code interne / nom d'opération,
  avec son maître d'ouvrage (colonne « Maître d'ouvrage » / « société ») ; une opération existante est mise à jour.
  Un classeur d'une seule opération reste lu comme avant.
- **Export Excel** : fenêtre à cases à cocher — opérations une à une, par maître d'ouvrage, ou tout ExtracTerre.
- **Onglet « Recherches »** : grilles de critères modifiables (thèmes et minimum de critères, critère obligatoire ou
  conditionnel, mots-clés / synonymes, contexte à proximité, exclusions, type Présence / Nombre (unité, bornes) / Texte,
  critère « indice contraire »), filtre sur les documents, import / export de grille (.json). Chaque résultat cite le
  document, la page et la ligne ; décision manuelle possible (Oui / Non / Sans objet). L'IA (Ollama en local) propose les
  mots-clés d'un critère ou crée une grille depuis une description, sans recevoir le contenu des documents.
  Grille fournie : **Sécurité des logements** (fenêtres de RDC, portes d'entrée, abords, halls, parkings, étages).
  Export : une feuille par grille utilisée + « Recherches — citations ».
- **Pack d'amélioration du 26/10/2026** (1 225 événements depuis la v2.4.0) :
  - classes DPE : une lettre A à G seulement (« 707 », « CO2 initial : 21,00 kgeqCO2/m² » rejetés) ;
  - refroidissement : un réseau de chaleur ou une chaudière n'est plus proposé ; Ubat Ref borné (83 au lieu de 0,83) ;
  - nouveaux motifs d'études : « Tic | 26.19 °C | 28.98 °C », « Groupe 1 26.14 °C 28.57 °C » (en-tête Projet / Référence),
    « Lettre étiquette D » (énergie / GES, avant / après selon le contexte), « Etat existant / projet … D F » ;
  - période de construction (avant / après 1948) déduite de l'année lue — proposition validée 46 fois sur 46 ;
  - réponse IA coupée par la limite de jetons : les propositions complètes sont gardées (toujours vérifiées).

# v2.5.0 — Données économiques : questionnaire financier Prestaterre, onglet Économie, 2e feuille Excel
- **Onglet « Économie »** à la suite de Général / Thermique / Carbone / Enveloppe (l'entrée « Données économiques » de la
  barre latérale est retirée). Il présente la nomenclature économique complète (321 colonnes), groupée : questionnaire &
  opération, synthèse financière, coûts par catégorie, postes de chaque catégorie, aides par catégorie / porteur / dispositif.
  « Colonnes renseignées » ou « Toutes les colonnes » ; chaque valeur est modifiable (saisie surlignée, vide = valeur lue).
- **Import de l'export du questionnaire** (source prioritaire) : le fichier `_questionnaire.json` (bouton « Exporter le
  questionnaire (.json) ») ou directement le paquet complet `.zip` (seul le JSON en est extrait : il reprend la synthèse et
  les DPGF joints). Montants exacts au centime, identifiants du catalogue des aides, et des données absentes du PDF :
  couverture du coût, postes manquants, coût final déclaré, commentaires, logements et aides par logement, loyer de
  référence de la marge locale, version de la notice, référentiel des aides, alertes (338 colonnes au total).
- **Lecture de la synthèse PDF du questionnaire financier MOA** (nouveau type « Questionnaire financier », famille
  « Financier ») : lignes de coûts validées (source, lot / poste, catégorie, montant HT), aides mobilisées (dispositif,
  porteur, calcul, montant, statut), identification (OPE, contrat, libellé, version, confirmation, habilitation, SIAP).
  Colonnes du tableau reconstruites par position, accents et espaces conservés (édition à lettres espacées).
- **Nomenclature** reprise du questionnaire : 12 catégories de coûts et leurs postes (lots de travaux rattachés par mots-clés,
  lignes à plusieurs postes en « non ventilé / postes groupés »), 41 dispositifs d'aide (montant + statut), 7 catégories
  d'aide, 9 niveaux de porteurs, marge locale bonifiée. Totaux, parts, fonds propres, montants sécurisés, premier financeur
  et stratégie dominante recalculés à partir des lignes (identiques à la synthèse PDF).
- **Export Excel** : 2e feuille « Données économiques » (une ligne par opération, « Code interne » et « Nom opération » en
  premières colonnes, repris de la 1re feuille) puis « Lignes financières » (détail des coûts et aides lus).
- Le code opération et le n° de contrat du questionnaire alimentent aussi « Code interne » et « Contrat : Numéro du contrat »
  (source secondaire). Sans questionnaire, les prix HT des DPGF restent lus et rattachés aux postes travaux.

# v2.4.2 — Assistance IA locale gratuite (Ollama), sans clé API
- Nouveau mode « IA locale gratuite, sans clé (Ollama sur cet ordinateur) » dans 🤖 IA : le texte des pages est traité
  par Ollama (`http://localhost:11434`, modèle par défaut `qwen2.5:7b`, modifiable) et n'est envoyé à aucun service
  extérieur. Mêmes garde-fous : citation vérifiée mot pour mot, confiance plafonnée à 85 %, validation ✓ / ✕.
- Bouton « Tester la connexion » (Ollama lancé ? modèle installé ?) et aide d'installation pas à pas dans les réglages
  (installation, `ollama pull qwen2.5:7b`, autorisation `OLLAMA_ORIGINS`). Messages clairs si Ollama est arrêté ou si
  le modèle manque.

# v2.4.1 — Analyse manuelle : recherche de champs
- **Barre de recherche** au-dessus des champs de l'analyse manuelle : « DH » affiche tous les champs dont le libellé
  (ou un synonyme) contient « DH » (DH, DH Max), dans toutes les familles ; casse et accents ignorés. Le filtre
  « À compléter » / « Tous les champs » s'applique aux résultats ; Entrée choisit le premier résultat, Échap efface.
- Après une saisie, « Passer au champ suivant » parcourt les résultats de la recherche en cours.

# v2.4.0 — Parseurs rénovation réécrits (RT existant / RSET / DPE / notices) : mesurés sur 38 documents réels
Mesuré par opération (tous les documents d'une opération analysés ensemble, 43 champs rénovation par bâtiment) :
Sully 60 → 87 %, Chalette 26 → 98 %, Rueil 40 → 93 %, Sartrouville 23 → 81 %, Patton 0 → 60 %, Vineuil 16 → 84 %,
Melleray 21 → 77 %, Bourg-la-Reine 10 → 71 %, résidence Pléiades K/M/C 82 → 91 %. Les champs restants sont absents des
documents (état initial non calculé, étiquettes DPE en image, études d'offre sans état initial). Autres documents réels :
valeurs identiques ou complétées (I3F LEPIC : 41 identiques + 8 équivalentes / 61 vérifiées, contre 37 + 12).
- **Ventilation avant / après travaux** : nouvelle colonne « Ventilation avant travaux » (`ventilation_before`, ajoutée
  en fin d'export : 186 colonnes, l'ordre des 185 précédentes est inchangé) ; « Ventilation » reste l'état après travaux.
  Lue dans Pléiades RT existant (système initial), fiches RSET, U48Win / Perrenoud (état initial), DPE de l'existant,
  notices et sorties BaO ; une ventilation conservée remplit les deux colonnes.
- **Cep Ref** : la colonne « Cep Max » s'appelle désormais « Cep Ref » (clé `cep_max` inchangée, les anciens en-têtes
  « Cep Max » restent reconnus à l'import).
- **Références de comparaison** (`applyComparisonBases`, engine.js) : en rénovation, Cep Ref / Ubat Ref / GES Ref = état
  initial (Cep / Ubat / GES avant travaux) quand il est calculé, sinon la référence du document ; en neuf, la référence.
  Les gains (Cep, Ubat, GES) sont recalculés sur cette base ; la référence du document reste en note et en revue ; une
  référence ou un gain saisis à la main ne sont jamais remplacés (règle rejouée après chaque correction).
- **Nouvelles colonnes** en fin d'export (192 colonnes) : « Ubat Ref », « Gain Ubat », « GES après travaux (kgCO2/m²) »,
  « GES avant travaux (kgCO2/m²) », « GES Ref », « Gain GES ». Lues dans Pléiades RT existant (Ubat de référence,
  étiquette CO2), ClimaWin (UBatref / UBatbase, émissions de CO2 par usage), U48Win / Perrenoud (« COEFFICIENT UBAT
  REF »), synthèses ClimaWin RTEx et notices (émissions de GES initial / projet).
- **Pléiades RT existant** (`js/pleiades-rtex.js`, Pléiades 5.x et 6.x) : un bâtiment par section « 1.N » (résultats),
  « 2.N » (enveloppe), « 5.N » (caractéristiques) ; colonne « initial » vide détectée (Cep / Ubat / consommations
  décalés) ; Tic du groupe le plus chaud ; deux postes du Cep sur une ligne ; logements, surfaces et zones traversantes
  par zone ; générations et ventilations rattachées au bâtiment qu'elles citent ; paroi rénovée choisie (parois
  « existant / non isolé / intérieures » écartées, « 10* » = paroi modifiée) ; baies « … (Baie) » ; ENR.
- **Fiche RSET RT existant** (`js/rset-rtex.js`, réécrite) : libellés comparés sans espaces (édition Pléiades en lettres
  espacées et titres en police sans table Unicode) ; « --non calcule-- » = colonne vide ; postes du Cep recalculés depuis
  l'énergie finale (kWh × 2,58 / SHON) ; isolants et vitrages des tableaux de parois ; volets « (avec VR) » ; PAC air/eau,
  chaudière à condensation, ECS.
- **ClimaWin rénovation** (`js/climawin-etude.js`) : étude « RT pour l'existant » (Cepinit / Cepproj / Cepref, Ubat, Tic,
  postes du Cep, parois « re. / ex. / av / ap », menuiseries, générateurs) et rapport de saisie d'une étude RT existante
  (jusqu'ici ignoré entièrement).
- **U48Win / Perrenoud** (`js/u48win-rtex.js`) : catalogues initial / projet, détails des parois, saisies par
  « BATIMENT : X », résultats par « Batiment n° k », résumé par bâtiment, éditions récentes et anciennes (« Modification
  n° 1 », « Variante 1 : Projet »).
- **DPE 2021 (3CL)** (`js/dpe-3cl.js`) : classes recalculées depuis l'énergie primaire et les émissions imprimées (double
  seuil) ; énergies du tableau des consommations ; les packs de travaux recommandés et la liste des solutions ENR ne sont
  plus lus comme l'existant ; « annexe DPE » d'étude = état projeté ; récapitulatif DPE par logement.
- **Notices de bureau d'études** (`js/notice-renovation.js`) : tableaux de synthèse par bâtiment, blocs de bilan
  « Batiment n° k », « Cep = 84,9 ≤ 195 », typologies, prose par phase (isolant, épaisseur, λ, R donné ou calculé
  e / λ ; menuiseries ; générateurs nommés, chaudière existante remplacée, production mixte ; ventilation). Complète
  aussi les parseurs dédiés (notice en chapitres, ClimaWin, U48Win) sur les seuls champs manquants.
- **Livret d'opération Prestaterre** (`js/livret-prestaterre.js`) : contrat, code opération, MOA, ouvrage, logements,
  référentiel, mentions, profil, département (les remarques d'évaluation ne sont plus lues comme le projet).
- **Cep max = Cep de référence** (exigence « Cep ≤ Cep ref » de la RT existant globale), convention des corrections
  validées, dans tous les parseurs rénovation ; gain = (Cep ref − Cep) / Cep ref ; le label visé et le Max(CH,ECS,FR)
  restent dans la note de provenance.
- **Bâtiments** : un « Logement 30 » (DPE, récapitulatif) rejoint le groupe « Logements 30 et 31 » qui le cite.
- **Sources** : le DPE devient source principale de l'énergie avant travaux ; l'étude RT existant, de la surface.
- **OCR** : une couche texte « chiffrée » (police sans table Unicode) déclenche l'OCR même si ses caractères ont l'air
  propres.
- **Interface** : onglet **Revue** par défaut (fiche par bâtiment champ par champ : valeur, état retenu / saisi / à vérifier /
  à compléter, source ; filtres et recherche ; saisie sur place, validation ou rejet des propositions, ouverture du document
  à la bonne page, copie d'une valeur vers les autres bâtiments, propositions déduites — avant / après 1948, gain Cep ;
  clavier ↑ ↓ / Entrée / D / V) ; **profil Neuf / Rénovation** (auto, modifiable) qui masque les champs sans objet (export
  complet inchangé) ; **analyse manuelle guidée** (champs à compléter d'abord, passage au champ suivant, propositions,
  ↑ ↓) ; accueil allégé (réglages repliables, une carte « Compléments ») ; police IBM Plex Sans chargée (la police
  « Inter » d'un poste n'existait qu'en Extra Bold) ; mise en page mobile de la barre de résultats et de la revue.
- Non-régression : 39 fichiers de tests (dont `test_v2_4_0.mjs`, 30 vérifications), auto-tests moteur, banc du pack inchangé.

# v2.3.21 — Rapports Pléiades RT existant (Th-C-E ex) : toutes les valeurs du rapport
Mesuré sur 6 rapports réels Pléiades 5.23 (« Simulation thermique dynamique » / « Résultats RT Existant suivant la
méthode THCE - Ex », un bâtiment par rapport) : **14 à 18 → 34 à 36 valeurs retenues par rapport**, sans changement
sur les autres documents réels (412 valeurs finales identiques) ni sur le banc du pack.
- **Tic / Tic réf** (« Exigence de resultat : Tic » → « Groupe 1 22.93 °C 33.69 °C »).
- **Postes du Cep projet** (« Decomposition du Cep … Projet ») : éclairage, auxiliaires de ventilation, auxiliaires de
  génération / distribution, refroidissement ; **Cep gaz / électricité** par somme des postes.
- **Vecteurs chauffage / ECS** lus dans le détail des consommations (électrique / bois / autres sources), « autres
  sources » nommées par le générateur décrit (chaudière gaz → Gaz) ; avant travaux : proposé « à vérifier », le rapport
  ne décrivant pas le générateur initial. Chaudière à condensation reconnue dans la bibliothèque d'équipements.
- **Menuiseries** : seules les fenêtres et portes-fenêtres comptent, valeur la plus fréquente (la première baie était
  une porte de placard « Bois » ; les volets roulants étaient ignorés).
- **Isolants** : couche dont le nom tient sur une ligne et les valeurs sur la suivante (« Ecorock Mono … » / « 13.4
  0.036 … 3.70 ») ; planchers « Paroi sur locaux non chauffés » ; marques ECOROCK / Rockwool (laine de roche) et
  EFIGREEN / Efisol / Utherm (PUR).
- **Année de construction** : « Annee deconstruction 1973 » (espace perdu à l'extraction).
- Non-régression : 38 fichiers de tests (dont `test_v2_3_21.mjs`, 35 vérifications).

# v2.3.20 — Audit des parseurs : nombres exacts, rapports U48Win (RT existant), bancs d'essai sur documents complets
Audit du code et mesure sur un vrai rapport U48Win de 148 pages (4 bâtiments, 61 valeurs vérifiées à la main) :
**6 → 49 valeurs justes**. Les 12 restantes sont contredites par le document lui-même (Cep électricité, Cep réf du
bâtiment F, chauffage initial A/B), relèvent d'une convention (ventilation : état après travaux) ou sont une étiquette
DPE en image.
- **Lecture des nombres (`parseFrNumber`)** — erreur silencieuse corrigée, utilisée par tous les parseurs :
  « 57,3 kWh/m2 » donnait 57,32 (le « 2 » de m2 collé), « 12,5 / 15 » donnait 12,515, « −4,6 » perdait son signe,
  « 0,25 W/m².K » ne donnait rien. Seul le premier nombre est lu ; espaces fines = milliers ; « − » = moins ;
  « Bâtiment - 12 » ne devient pas −12 ; « 1.250.000 » reste refusé (ambigu).
- **Rapports U48Win (Perrenoud, moteur Th-C-E ex)** :
  - classés « RT existant » même quand la signature n'apparaît qu'au résumé (au-delà des 120 000 premiers caractères) ;
  - lus par les motifs logiciel, plus par les heuristiques à fenêtre glissante qui se trompaient de bâtiment et prenaient
    l'Ubat de base pour l'Ubat initial ;
  - « BATIMENT : A/B » et « Batiment n° 01 : A/B » désignent le même bâtiment (« Bâtiment A/B ») ;
  - résumé : Cep et Ubat projet / référence / initial, gain imprimé, Tic ; « Coefficient Cep » à colonnes : Cep réf et gain ;
  - bilans par usage : Cep éclairage, auxiliaires, ventilateurs, gaz, électricité ; vecteurs chauffage / ECS avant et
    après selon l'énergie réellement consommée (un convecteur saisi mais non consommé ne compte pas) ;
  - période de construction, zones traversantes, logements par bâtiment ; ventilation de l'état projet (la phase
    « ETAT PROJET » vaut pour les pages suivantes).
- **Rapports de bureau d'études Th-C-E ex (CYPE « moteur THCEX », « règles Th-C existant »)** : classés « RT existant »
  (un rapport réel de 70 pages ne donnait que 3 valeurs, dont un Ubat projet rangé en initial ; il en donne 22) ;
  « Coefficient Cep Existant / Projet / Ref. / Gain(%) » ; Ubat seul d'une page « Etat projeté » = après travaux ;
  bilans « Gaz (kWh EF) 657 739,6 » (milliers séparés par une espace) ; SHAB ; étiquettes énergie / GES de l'étude
  (échelle d'avant 2021, à vérifier), le rappel de l'état existant sur la page projet étant écarté.
- **Garde-fous** : « Année de construction : Avant 1948 » ou « entre 1948 et 1974 » ne donnent plus l'année 1948
  (ce sont des périodes) ; les colonnes d'un tableau (« Batiment R1 - R2 0 0 7 14 7 28 2184 ») ne font plus partie
  du nom du bâtiment.
- **Routage** : une étude RT existant est source principale des zones traversantes ; les lignes explicites U48Win
  (période, logements) passent au-dessus du seuil de retenue au lieu de partir en revue.
- **Redondance** : le parseur réglementaire générique émettait chaque valeur 3 à 7 fois (une par ligne de sa fenêtre) ;
  une seule occurrence par champ, valeur, bâtiment et page. Rapport U48Win : 605 → 166 occurrences, 600 → 40 ms.
- **Outils** : `tools/doc_bench.mjs` lit de vrais PDF comme l'application (pdf.js + regroupement des lignes), les analyse
  avec le moteur et compare aux valeurs vérifiées d'un pack d'amélioration (identiques / équivalentes / différentes).
- Non-régression : 37 fichiers de tests (dont `test_v2_3_20.mjs`, 64 vérifications), 149/149 auto-tests, banc du pack inchangé,
  valeurs finales de 3 RSET réels identiques.

# v2.3.19 — Rénovation : Cep retenu, « Gain Cep » corrigé
Audit complet du projet des Andelys (5 études ClimaWin RT existant) :
- **Valeurs exactes restées en « à vérifier »** :
  - en rénovation, l'étude RT existant est l'étude réglementaire du projet ; elle devient source principale du Cep, du Cep max et du Gain Cep, classée après RSEE / RSET / RT2012 / étude thermique qui priment s'ils sont présents ;
  - les règles enregistrées dans le navigateur, si elles n'ont pas été personnalisées pour ces champs, suivent la nouvelle règle.
  - Résultat : le Cep de PISSARO, POUSSIN et SAUTIN, ainsi que le Cep max et le gain des 6 logements individuels, passent dans l'export. Le maître d'ouvrage lu dans la fiche standardisée aussi.
- **Erreur corrigée** : la colonne « Gain Cep » mesure l'écart au Cep max (1 − Cep / Cep max), comme le gain Bbio.
  - Les parseurs RT existant y écrivaient le gain sur l'état initial (50,1 % au lieu de 0 à 40 %) ; ce gain n'est plus écrit dans la colonne. Il se lit avec Cep avant / après.
  - Le vrai gain est calculé quand le Cep max est connu (note ClimaWin : 24,9 % ; rapport Pléiades Réaumur : 12,1 %).
- **Nouvelles valeurs** :
  - postes de consommation du projet de la note ClimaWin : éclairage, ventilation, auxiliaires, refroidissement ;
  - les notes « Synthèse d'étude RTEx » et dossiers de contrôle ClimaWin sont toujours classés en étude RT existant.
- Projet des Andelys : 4 bâtiments, 20 à 33 valeurs chacun, aucune valeur en attente. Non-régression : 932 → 934 (Cep max et gain du rapport Réaumur), banc du pack inchangé.

# v2.3.18 — Sorties ClimaWin RT existant : dossier de contrôle et synthèse d'étude RTEx
Les études RT existant ClimaWin d'un projet de 56 logements (3 collectifs, 6 individuels) ne donnaient aucune valeur exploitable. Le moteur générique créait aussi des bâtiments parasites (« OU ZONES », titres de chapitres) et classait les valeurs projet en « avant travaux ».
- **Dossier de contrôle** (fiche standardisée RT existant imprimée depuis ClimaWin) : reconnu via « Récapitulatif Standardisé d'Étude » et « Réglementation Thermique Existante ».
  - Titres de feuillets coupés sur deux lignes recollés ; bâtiments nommés sans « après travaux / OPTION / SOLUTION » (« Bat PISSARO après travaux OPTION BBC 2024 » → Bâtiment PISSARO).
  - État initial « non calculé » (« -- », « NaN ») : le Cep et le tableau d'énergie à une colonne sont lus comme valeurs projet, plus jamais comme « avant travaux ».
  - Parois opaques (« 14 4.4 Th-U 121.25 ») : épaisseur et R de la paroi la plus représentative pour les murs, la toiture (terrasse ou plancher sur comble) et le plancher bas (sur caves, terre-plein).
  - VMC simple flux précisée en hygro A / B ; pompe à chaleur du projet détectée dans les générateurs.
- **Note ClimaWin « Synthèse d'étude RTEx »** : nouveau parseur.
  - Ubat initial / projet ; Cep initial / projet / max et gain ; Tic.
  - Épaisseurs d'isolant (couches additionnées).
  - Menuiseries (matériau, vitrage, volets).
  - Vecteurs de chauffage et d'ECS avant / après, issus du « Détail des consommations ».
- Sur les 5 documents réels du projet : 4 bâtiments (6 logements individuels, PISSARO, POUSSIN, SAUTIN) avec 18 à 26 valeurs chacun. La note et le dossier du même bâtiment se complètent. Non-régression : 932 → 932, banc du pack inchangé.

# v2.3.17 — XML RSEE E+C- (RT2012 + ACV 2017-2020)
Les RSEE de l'expérimentation E+C- (`referentiel_ec`, RSET RT2012 + RSEnv 2017-2020) n'étaient lus qu'en partie : seule la thermique RT2012 sortait, soit environ 15 valeurs. En cause, des données rangées autrement que dans un RSEE RE2020. Désormais :
- **Données générales** : `Datas_Comp` est cherché sous `RSET`, puis complété par `RSEnv/data_comp`. Le nom d'opération (`name` / `nom`), l'adresse (`ligne`, `code_postal`, `ville`), le maître d'ouvrage et le logiciel (bloc `BET`) sont lus.
- **Carbone E+C-** :
  - indicateurs « Eges », « EgesPCE » et seuils C1 (Egesmax1, EgesPCE,max1), avec les seuils C2 et le niveau atteint indiqués dans la provenance ;
  - contributeurs énergie, eau et chantier rapportés à la SDP, seulement si PCE + énergie + eau + chantier redonne l'Eges déclaré (à 1 % près) ;
  - niveau carbone proposé en « à vérifier » (calcul, pas une mention de label).
- **Enveloppe RT2012** : codes `type_paroi` 1 (murs), 2 (planchers bas), 3 (planchers hauts) ; 4 (parois sur local non chauffé) est ignoré. Épaisseur, R, structure, vitrage et ventilation sont lus comme pour le RE2020.
- **Réseau de chaleur RT2012** (`O_Cef_reseau_chaleur_imp_*`) pris en compte pour les vecteurs de chauffage et d'ECS.
- Sur un RSEE E+C- réel : 36 valeurs retenues, contre 14. Les XML RE2020, les 24 documents de non-régression et le banc du pack sont inchangés.

# v2.3.16 — Thermique rénovation : notices en chapitres, fiches RT existant scannées ; bandeau compact, suppression de projet
- **Fiche standardisée RT existant imprimée en image** (RSET-RTex scanné, aucune couche texte) : le parseur de la v2.3.13 ne reconnaissait pas le texte OCR. Résultat : 0 valeur, l'analyse semblait bloquée. Il comprend désormais :
  - les puces OCR (« > », « BP », « P> ») et « (m?) » pour (m2) ;
  - les feuillets Pléiades « (Batiment 1) » et « (Batiment 1 -ID: 1) » ;
  - le Tic en « °c » et les murs « 0_Mur Pierre » ;
  - les générateurs sur plusieurs colonnes : le vecteur majoritaire est pris en nombre × puissance unitaire.

  Un tableau « Type d'énergie » à qui l'OCR a fait perdre une ligne passe en « à vérifier ». Sur une fiche réelle de 16 pages : 22 valeurs (Cep initial / projet, Ubat, Tic, surface, année, logements, vecteurs, ventilation, structure, menuiseries, département).
- **Notices thermiques RT existant rédigées en chapitres** « État existant » / « État projeté » (sans tableau standardisé). Nouveau parseur `parsePhasedThermalNotice` ; la phase vient du chapitre, jamais d'une supposition. Il lit :
  - le Cep de chaque état et le gain ;
  - l'étiquette DPE calculée (la classe GES est déduite des seuils si la notice ne donne qu'une lettre) ;
  - les parois projetées : isolant, épaisseur cm → mm, R, en rattachant chaque isolant à la désignation la plus proche ;
  - la structure des murs, les menuiseries (matériau, vitrage), les occultations ;
  - le générateur et le vecteur de chauffage de chaque état ;
  - l'ECS, décrite en clair (vecteur majoritaire en logements), la ventilation et le nombre de logements.

  Le bâtiment parasite « CONCERNE PAR LES TRAVAUX » n'apparaît plus. Sur une notice réelle : 25 valeurs exactes, contre des Cep projet classés en « avant travaux » auparavant.
- **Consolidation** : « VMC simple flux » (fiche RSET) est remplacée par « VMC Hygro A / B » quand une autre source le précise.
- **Interface** :
  - bandeau du haut ramené de 150 px à 60 px (logo 40 px, décor supprimé) ;
  - bouton **Supprimer** sur chaque projet, dans la liste « Projets », le tableau de synthèse et l'en-tête de projet. Une confirmation est demandée, les analyses du projet sont retirées et le journal d'amélioration est conservé ;
  - l'en-tête du tableau de synthèse ne masque plus la première ligne.
- Non-régression : 24 documents réels relancés, 932 → 932 valeurs retenues ; banc du pack inchangé.

# v2.3.15 — XML RE2020 (RSEE) : enveloppe, structure, menuiseries et ventilation
Un XML RSEE contient à lui seul une grande partie des données du tableur. En plus de la thermique et du carbone (Bbio, Cep, DH, Ic, lots, Stock C), sa partie Datas_Comp remplit désormais :
- le **nom du projet** (balise operation) ;
- l'**isolation des parois** (murs, toiture, plancher bas) : épaisseur d'isolant (cm → mm) et R, pris sur la paroi dominante, c'est-à-dire la plus grande surface cumulée toutes orientations. L'attribut `type_paroi` est lu : un plancher bas sur local non chauffé (400) n'est plus pris pour un mur. Les portes et coffres sont ignorés ;
- la **structure** : murs (ossature bois MOB / FOB, béton, brique…), toiture (terrasse, végétalisée, accessible, combles, pente), plancher bas (dalle béton, plancher bois) ;
- le **vitrage majoritaire** (DV 4_16_4 Argon → 4.16.4 Ar) et la menuiserie quand son libellé la précise (bois, PVC, alu) ;
- la **ventilation** : VMC simple flux hygro A / B, lue dans les groupes de ventilation des zones.

Sur un RSEE réel de 6 logements, 63 valeurs sont retenues (54 avant). Les 24 documents de non-régression et le banc du pack sont inchangés.

# v2.3.14 — Récapitulatif carbone RE2020 de BE, IC énergie dans « IC construction & seuils »
- Onglet Carbone : **IC énergie** est désormais affiché dans la rubrique « IC construction & seuils », avec IC énergie Max et Max 2028. La rubrique « IC énergie — postes » ne garde que les postes.
- Nouveau parseur `js/recap-carbone.js` pour les récapitulatifs « Étude d'impact réglementaire sur le changement climatique — Bilan carbone RE2020 » (ex. BE ACT « Récap Carbone ») :
  - Ic énergie + max, Ic construction + max + seuil 2028 (page « Conformité RE 2020 ») ;
  - lots 1 à 13 lus dans le graphique par lot, dont les valeurs accolées par l'export PDF (« 5,5840,27 ») sont séparées ;
  - Ic composants = Σ lots, contrôlé par Σ lots + Ic chantier = Ic construction ;
  - Ic chantier, stock de carbone biogénique, surface de référence (à vérifier) ;
  - le document est classé « Étude carbone / ACV » et non plus « RSET RE2020 ».
- Les pages de préconisations FDES ne sont plus lues : leurs descriptions de produits donnaient une ossature bois, un triple vitrage et un volet roulant qui n'étaient pas ceux du projet.

# v2.3.13 — RSET RT existant (fichier standardisé)
- Nouveau parseur `js/rset-rtex.js` pour le « Fichier standardisé des caractéristiques thermiques d'une construction Existante ». Son gabarit XSL est commun aux logiciels : BatiAudit / U48Win de Perrenoud, ClimaWin, Pléiades…
  - un bâtiment par feuillet (« Identifiant Bâtiment FULTON - (2) ») ;
  - par bâtiment : surface, année, logements, Cep initial / projet, Ubat initial / projet, Tic / Tic réf, structure du mur principal, matériau des menuiseries ;
  - feuillets équipement rattachés par la surface de zone : ventilation, et tableaux « Type d'énergie » oui / non (Initial / Projet) pour le chauffage et l'ECS ;
  - feuillet génération : générateurs de l'état initial et du projet ;
  - un « - » est traité comme « non renseigné ».
- Le moteur générique ne complète plus que les données administratives pour ce format. Il lisait :
  - « solaire non » comme un vecteur solaire ;
  - l'article 43 « coffres de volets roulants » comme une occultation ;
  - « Bâtiment ou zones du bâtiment desservies » comme un bâtiment.
- Document réel testé : 75 valeurs souvent fausses → 31 valeurs justes pour deux bâtiments. Les 24 autres documents réels sont inchangés.

# v2.3.12 — Entraînement sur le pack d'amélioration (journal du 07/10/2026)
Analyse du pack : 3 630 événements, 164 signalements bêta, 318 emplacements surlignés, 435 corrections, 1 040 décisions ✓/✕, 292 erreurs.
- **OCR « toujours »** (cause principale des analyses lentes et moins complètes) :
  - le journal montre des sorties logiciel de 70 à 150 pages entièrement OCRisées (20 à 30 min, 233 dépassements de délai) ;
  - les lignes OCR approximatives (« 3722 » pour « 372,2 ») étaient mêlées au vrai texte et faussaient le classement des documents ;
  - désormais une page à couche texte propre et dense, sans image significative, n'est plus OCRisée (les logos d'en-tête ne comptent pas) : 75 à 95 % de pages OCR en moins sur les sorties logiciel, aucun changement pour les PDF scannés ;
  - à la fusion PDF + OCR, seules les lignes OCR hors du texte PDF (tableau scanné, capture) sont ajoutées.
- **Garde-fous d'extraction** (`js/sanity.js`), appliqués avant la consolidation pour qu'une valeur fausse ne masque plus la bonne :
  - nombre collé à un libellé : « RT2012 », « Bat.1 », « m² », « T3 », « Cep-20% » ;
  - numéros de page de sommaire et de chapitre ;
  - plages physiques par champ : Cep = 0,904 (ratio), Tic = 9, épaisseur 88 160 mm, Cep électricité en kWh annuels ;
  - département nettoyé ; « Liens vers la CTA » n'est plus une CTA ;
  - 44 des 48 valeurs fausses signalées ne sortent plus.
- **Moteur générique** :
  - un libellé séparé de la valeur par un autre libellé (« CepMax | Ecart | 122,17 ») n'est plus lu ;
  - la phase avant / après travaux déduite du seul nom de fichier (« Rapport final ») reste à vérifier.
- **Sorties logiciel** (`js/logiciels-thermiques.js`) :
  - Perrenoud U-Win RT existant : Ubat initial / projet, Cep, Tic / Tic réf, ventilation, vecteurs, surface utile, période de construction, multi-bâtiments « Bâtiment n°X » ;
  - CYPE : comparaisons « projet <= référence » pour Ubat, Cep et Tic, Cep max, SHON, compositions de parois (isolant, épaisseur, R) ;
  - Pléiades RSET RT2012 : Cep / Cep max, Tic / Tic réf, Ubat, surface, énergie, tableaux verticaux Bbio / Bbio max ;
  - rapport Pléiades RT existant : Cep, Cep max, étiquettes énergie / CO2 équivalentes ;
  - emplacements surlignés retrouvés : 7 → 29.
- **Hiérarchie des sources apprise des décisions ✓/✕** :
  - « ENR » par simple présence (0/34) et mentions par présence dans les CCTP / documents non classés (2/24) ne sont plus proposés ;
  - la structure des parois devinée dans une étude RT existant (2/12) passe en bas de la file « à vérifier ».
- **Valeurs de référence** (Ubat réf, Cep réf) : proposées en « avant travaux » uniquement à vérifier, l'état initial n'étant pas donné par ces documents.
- `tools/pack_bench.mjs` : banc d'essai à relancer sur chaque nouveau pack (aucune donnée du pack n'est stockée dans le dépôt).
- Non-régression : 24 documents réels relancés, 930 → 932 valeurs retenues. Seule perte : un R de toiture de 0,12, physiquement impossible.

# v2.3.11 — Passe d'amélioration : Eges, rénovation (RT existant), BBCA Rénovation en PDF
- **12 colonnes Eges** ajoutées en fin d'export (onglet Carbone, groupe « Eges ») : Eges PCE, PCENA, énergie, chantier, eau, total et leurs seuils Max (kg CO2 eq/m² SDP). Elles sont remplies par :
  - les calculettes BBCA Rénovation ;
  - les notices ACV BBCA Rénovation ;
  - les notices ACV E+C- (Eges PCE et Eges total).
- **BBCA Rénovation** : la « fiche de synthèse » reproduite en annexe d'une notice ACV est lue par bâtiment (« Bâtiment sur rue : », « Bâtiment sur cour : »).
  - Lots coupés sur deux lignes, « Lot3. » et « Lot 9.Installations » reconnus ; Σ des lots contrôlée contre Eges PCE.
  - Le tableau « Résultats de l'ACV du bâtiment … » est lu (projet / seuil).
  - Les Eges ne sont plus recopiés dans les colonnes IC, car la méthode de calcul est différente.
  - Le bâtiment d'une calculette est tiré de « Nom du projet … bat. Cour » ou du nom de fichier.
- **Rénovation — études RT existant** (`js/renovation-thermique.js`) :
  - notice thermique de bureau d'études : Ubat / Cep avant et après travaux par bâtiment, isolants projetés par paroi (type, épaisseur, R), menuiseries, ventilation, chauffage et ECS ;
  - rapport Pléiades Th-C-E ex : Cep projet / initial, Ubat, année, logements, surface, compositions, baies, générateurs, ventilation. « Bâtiment 1 » est renommé d'après le fichier (« … bâtiment cour ») ;
  - plan de repérage des isolants : légende lue (isolant principal par paroi), classé « Étude thermique ».
- **Règles de sources** : l'étude RT existant devient une source principale de l'enveloppe (isolants, menuiseries) et une source secondaire du nombre de logements.
- **Bâtiments** : « Bâtiment sur cour », « Immeuble cour » et « bat. Cour » sont regroupés en « Bâtiment COUR ».
- **Consolidation** : un parseur dédié peut fixer son rang. La sortie logiciel l'emporte ainsi sur la description d'une notice, qui l'emporte sur un plan (ex. vitrage « 4.16.4 Ar » de Pléiades plutôt que « Double vitrage »).
- **DH max** des récapitulatifs CSTB : 1250 °C.h est retenu pour les bâtiments d'habitation (catégorie 1). Il reste à vérifier pour les autres usages.
- « Fibre de cellulose » est reconnue comme ouate de cellulose.
- Contrôle de non-régression : les 24 documents réels analysés depuis la v2.3.4 ont été relancés. Aucune valeur juste n'est perdue ; les nouveaux formats passent de 1–6 à 10–58 valeurs retenues par document.

# v2.3.10 — Calculette BBCA Rénovation, données projet des calculettes BBCA
- **Calculette BBCA Rénovation** (feuille « Résultats BBCA réno »), classeur Excel ou PDF :
  - lots 1 à 12 lus dans la colonne « Impact carbone du lot rénové » (les ratios par défaut voisins sont ignorés), lots non comptabilisés signalés, Σ des lots contrôlée contre Eges PCE ;
  - Eges PCE → IC composants, Eges chantier → IC chantier, Eges énergie → IC énergie (kg CO2 eq/m² SDP) ;
  - données projet : nom du projet → Nom opération, typologie de rénovation → Rénovation, typologie du bâtiment → Ouvrage, SDP → Surface bâtiment ;
  - label visé (« BBCA Performant », points) noté dans la mention BBCA.
- **Calculette BBCA (neuf)** : « Projet », « Client » et « Type de bâtiment » remplissent Nom opération, Maître d'ouvrage et Ouvrage.
- Moteur : un parseur dédié peut marquer une valeur précise comme source secondaire (`secondarySourceOk`). Les autres études carbone ne remplissent toujours pas ces champs administratifs, et une source interdite le reste.

# v2.3.9 — Calculette BBCA (PDF et classeur Excel)
- **Calculette BBCA V4.x** (`js/calculette-bbca.js`), exportée en PDF ou déposée telle quelle en `.xlsx` : un bâtiment par fichier (« Projet …_Bat A », sinon le nom du fichier).
  - **IC composants lots 1 à 13**, avec les sous-lots 2.1 / 2.2 / 2.3 additionnés et Σ lots contrôlée contre Ic composants.
  - Ic composants, Ic chantier, Ic construction (contrôle composants + chantier), Ic énergie et ses postes (chauffage, refroidissement, ECS, auxiliaires, déplacements).
  - Sref projet, nombre de logements et mention BBCA (« Oui »), avec en note le niveau visé d’après le score, Ic eau, Ic projet BBCA et les seuils BBCA.
- Les seuils BBCA ne sont pas des seuils RE2020 : ils ne remplissent pas les colonnes IC Max / Max 2028.
- Classeur Excel : valeurs affichées par SheetJS (« 3,000 m² » = 3000) correctement lues ; le classeur est classé « Étude carbone / ACV » et non plus « Entrée manuelle ».
- Règles de sources : l'étude carbone devient une source secondaire de la Sref, du nombre de logements et de la mention BBCA.

# v2.3.8 — RSEE imprimés en image, données techniques, systèmes Pléiades par bâtiment
- **OCR des pages sans couche texte** (RSEE / RSET imprimés depuis le navigateur) : rendu ≈ 216 dpi et segmentation Tesseract « colonne de blocs » (PSM 4). Les lignes de tableaux (Bbio, Cep / Cep,nr + max + gains, DH par groupe) sont désormais conservées : sur un RSEE de 55 pages entièrement en image, les valeurs lues sont identiques à la sortie logiciel du même projet.
- Fiche CSTB lue par OCR : séparateurs « | » ignorés, DH hors 0–2000 °C.h écarté (virgule perdue), libellé SRef déformé (« Srer », « She ») reconnu, logements et DH contrôlés.
- **Tableau « Données techniques »** (`js/donnees-techniques.js`) lu dans les fiches RSET / RSEE et les éditions environnementales Pléiades : structure, isolants des murs / planchers / toitures, type de plancher et de toiture, menuiseries, protections mobiles (libellés coupés et deux couples par ligne gérés).
- **Sortie thermique Pléiades** : générateur et ECS par bâtiment (« Chaudière granulés BAT B (Volume chauffé Bâtiment B) »), ventilation par bâtiment (simple / double flux, hygroréglable A / B).
- Règles de sources : le RSEnv est accepté (en dernier, avant la saisie manuelle) pour la nature de la structure et des isolants — pas pour les épaisseurs ni les R.

# v2.3.7 — Seuils Ic par période (RSEnv / rapport ACV Pléiades), synthèses Pléiades, documents retirés conservés
- **RSEnv 2024+** : tableaux « Respect des Icconstruction_max / Icenergie_max » (valeur, max, max 2022 / 2025 / **2028** / 2031) lus par bâtiment → IC construction, IC construction Max, **IC construction Max 2028**, IC énergie, IC énergie Max, **IC énergie Max 2028**. Bâtiment repéré par « Respect des exigences de l'arrêté pour le bâtiment : X ». Surface de référence et logements (Σ zones) lus dans « Données techniques, niveau bâtiment ». Valeur « … 532,36 max » / « Ic_construction 801,88 » sur deux lignes gérée.
- **Rapport ACV Pléiades** (`js/pleiades-rapports.js`) : « Ic construction max 2028 kg eq CO2/m² 624.37 » etc., par bâtiment ; blocs « Zone » ignorés.
- **Synthèse des prestations thermiques Pléiades** : tableau Résultats (Bbio, Cep, Cep,nr, Ic énergie + max) par bâtiment et générateur commun ; classée « Étude thermique ».
- **Synthèse des déperditions (NF EN 12831)** : plus de faux bâtiment (adresse du BET) ni de vitrage « 6.24.4 ».
- Le numéro de version d'un logiciel (« Pléiades, version 6.24.4.2 ») n'est plus lu comme un vitrage.
- Ic énergie Max : le RSEnv / l'étude carbone priment sur les sorties thermiques.
- **Suppression d'un document** : les valeurs qu'il a fournies sont conservées (avec la mention « document retiré ») et la consolidation est recalculée au lieu d'être effacée ; elles sont sauvegardées localement et remplacées si le même fichier est redéposé.
- Contrôle de plausibilité des surfaces lues par OCR (séparateur décimal perdu).
- Rappel : les **IC par lot (1 à 13)** ne figurent ni dans les PDF RSEnv « version courte » ni dans les rapports ACV Pléiades ; ils sont lus dans le **XML RSEE** et dans les notices carbone qui les détaillent.

# v2.3.6 — Notices de bureau d'études (carbone, thermique, biosourcé) et sorties Pléiades récentes
Validé sur un projet réel complet (XML RSET + 4 PDF) : les valeurs extraites des PDF sont identiques à celles du XML.
- **Notice carbone RE2020 / BBCA** (`js/notice-carbone.js`) : sections « EVALUATION DU BILAN CARBONE – BATIMENT X (CAGE n) » → Ic construction, Ic énergie, Ic composants, Ic chantier, lots 1–13 (sous-lots additionnés, Σ lots = Ic composants contrôlée), postes Ic énergie. Les seuils vont dans **IC construction Max 2028 / IC énergie Max 2028** quand la notice déclare viser le seuil 2028, sinon dans « Max » (à valider). Classée « Étude carbone / ACV » (et non plus RSET).
- **Notice thermique BE en colonnes** (`js/notice-thermique.js`) : tableaux « POSTE | BATIMENT A | BATIMENT B … » → Bbio, Cep, Cep,nr (+ max, gains rattachés au bon tableau), postes Cep, Ic énergie (+ max), logements, Sref, DH par bâtiment, ventilation par bâtiment. Articles de l'arrêté recopiés ignorés. Classée « Étude thermique » (et non plus DPE).
- **Notice label bâtiment biosourcé** : seule la démarche de labellisation (et le niveau 2012 visé) est relevée ; plus de faux bâtiments créés à partir des identifiants FDES.
- **Sortie Pléiades 6.26** : titres « .N Bâtiment » (sans numéro de chapitre), **Cible 2028 → IC énergie Max 2028**, SRT déclarée nulle → somme des surfaces utiles des groupes.
- Alertes « RSET incomplet — IC … absent » supprimées quand le RSET ne contient pas l'ACV.
- Source « Étude thermique » autorisée pour IC énergie Max.

# v2.3.5 — Colonnes IC construction / énergie, colonne Tags, 4 nouveaux formats de documents
**Schéma et export**
- 5 nouvelles colonnes Carbone, **ajoutées à la fin** de l'export (l'ordre des 168 colonnes historiques ne change pas) : IC construction, IC construction Max, IC construction Max 2028, IC énergie Max, IC énergie Max 2028 (IC énergie existait déjà). Schéma : 173 colonnes.
- Nouvelle colonne **Tags** en dernière position de la feuille « Données par bâtiment » : tags du projet (détectés + manuels), séparés par « ; ».
- XML RE2020 : Ic construction / Ic construction max / Ic énergie max lus dans les balises RSEnv.
- Copier-coller Excel : les en-têtes « IC énergie max », « IC construction max », « … 2028 » sont désormais reconnus.

**Nouveaux formats**
- **Sortie logiciel Pléiades — partie thermique** (`js/pleiades-sortie.js`) : bâtiments = titres « 1.N » ; Bbio / Bbiomax, Cep / Cepmax, Cep,nr / Cep,nrmax, Ic énergie / Ic énergie max, postes Cep et Ic énergie, DH du groupe le plus défavorable avec son DH max, SRT déclarée, logements, climatisation par groupe. Enveloppe / systèmes du moteur générique proposés à validation (rattachement au bâtiment non garanti).
- **Fiche RSET / RSEE CSTB « Récapitulatif standardisé »** (`js/rset-cstb.js`) : partie thermique (SRef, logements, Bbio, Cep et Cep,nr dans leurs colonnes — corrige Cep,nr = Cep —, gains, DH par groupe) et partie environnementale (Ic construction + max, Ic énergie + max, Ic composant, Ic chantier, stockage carbone), uniquement à l'échelle du bâtiment (zones et parcelle ignorées). Plus de faux bâtiments issus de lignes de tableau ; le texte des exigences de moyens n'est plus lu comme une description du projet ; les feuillets Génération (communs) sont proposés à validation.
- **PDF à police sans table Unicode** (ex. RSEE Pavillon Keller) : la couche texte « brouillée » est détectée et l'OCR prend le relais automatiquement. Valeurs OCR contrôlées : Ic ≤ max, Ic construction = Ic composant + Ic chantier ; une lecture incohérente part en « À vérifier ».
- **STD (simulation thermique dynamique)** : seule la variante de base est lue (pas de « climatisation active » issue d'une variante adiabatique / détente directe) ; BSO, triple vitrage, CTA et absence de rafraîchissement actif proposés à validation.
- Ligature « fi » perdue par PDF.js (« Coef\0cient ») restaurée.

# v2.3.4 — Fenêtre de correction et Analyse manuelle restaurées + notices ACV E+C-
**Régression corrigée** : la v2.3 avait été construite sur une base 2.2.3 antérieure aux versions 2.2.4 → 2.2.10. Les fonctions suivantes sont réintégrées (fusion à trois voies, sans perte des apports 2.3) :
- **Fenêtre de correction** (2.2.3 / 2.2.4) : deux colonnes (aperçu document à gauche, correction à droite), dimensionnée sur l'écran réel (`100dvh`), en-tête et pied toujours visibles, boutons **← Précédent / Suivant →** autour du sélecteur de page, champ « Valeur exacte » alimenté par le surlignage. Vérifiée à 1920×1080, 1366×768, 1280×640 et 390×844 (mobile).
- **Aperçu Excel** (2.2.5) : grille de tableur, clic sur une cellule = valeur reprise.
- **✦ Analyse manuelle** (2.2.6 → 2.2.10) : bouton dans « Analyse du projet » ; onglet par bâtiment, familles Généralités / Thermique / Carbone / Enveloppe, affectation par surlignage PDF, clic Excel ou saisie directe ; apprentissage d'emplacement (`parser_location_learning`).
- **Copier-coller Excel souple** (2.2.9) : alias d'en-têtes CRM/OPERATIONS et rapprochement prudent (≈).
- Le bouton d'import 2.3.2 est renommé **🛠 Moteur libre** pour ne plus être confondu avec l'outil ✦ Analyse manuelle.

**Notice ACV E+C- (annexe RSEnv Pléiades)** — `js/acv-ec.js`
- Détection : « Niveaux ENERGIE-CARBONE » / « Récapitulatif Energie Environnement » + Eges / Eges PCE.
- Extraits : Eges PCE → IC composants bâtiment (valeur précise de l'annexe, note E+C- ≠ RE2020), Niveau BEPOS → Niveau Énergie (E1–E4), niveaux E/C → Performance (« E3C1 », à valider), SRT du RSEnv (à vérifier si la notice indique une autre surface), tableau « Données générales » (structure, isolant de remplissage, plancher, ventilation, vecteurs et générateurs chauffage/ECS), PV saisi (ENR), département.
- Les graphiques par lot sont des images : aucune valeur de lot n'est inventée. En moteur libre, le moteur générique complète uniquement les champs non trouvés.

# v2.3.3 — Thermique : synthèses ClimaWin 2020, récap BE, versions multiples
**Cause des mauvais résultats thermiques** : types de documents erronés. « RTEx » (en-tête de colonne ClimaWin) déclenchait « RT Existant » ; la mention « classement DPE informatif » des récap BE les classait « DPE » ; les parseurs RE2020 ne tournaient donc jamais.
- **Classifieur** : signatures explicites synthèse ClimaWin (→ RSET RE2020), récap BE (→ Étude thermique), rapport de saisie ClimaWin ; « RT Existant » exige un libellé explicite dans le texte.
- **Synthèse ClimaWin (`js/climawin.js`)** : bâtiments = titres de section « N. Bâtiment X » (ni sommaire, ni lignes de tableau) ; par bâtiment : Bbio, Cep, Cep,nr (+ max, gains), Ic énergie, DH du groupe le plus défavorable (+ DH max du même groupe), Sref (tableau par entité), logements (Σ zones), traversant, PV présent / absent, postes Cep (« Tot EP »), vecteurs, enveloppe dominante (rangées de tableaux reconstituées par espacement vertical), vitrage et protection.
- **Récap BE** : performances et gains lus tels quels, systèmes (PAC, réversible, ECS, VMC, PV, volets). Valeurs de lot jamais recopiées sur chaque bâtiment ; légende des parois non lue.
- **Versions multiples** : l'étude la plus récente l'emporte (date d'étude), y compris pour le DH ; alerte « Plusieurs versions d'étude ».
- **Valeurs de niveau lot redondantes** écartées de « À vérifier » quand chaque bâtiment a la sienne.
- **Rapport de saisie ClimaWin** (300–700 p.) : non exploité (alerte d'information), plus de valeurs parasites ni de faux bâtiments.
- **Détection de bâtiments** : une ligne de tableau (« Bâtiment A 19.00 7.20 … ») n'est jamais un bâtiment.
- R dérivé (épaisseur / λ) proposé à validation (< 90 %), jamais retenu seul.
- Note : un RSET ClimaWin imprimé depuis le navigateur n'a pas de couche texte → OCR requis (lent) ; la synthèse suffit.

# v2.3.2 — Analyse manuelle visible + fenêtres adaptées à leur contenu
- **🛠 Analyse manuelle** : bouton dédié dans la zone de dépôt (à côté de « Ajouter des fichiers » et « Ajouter un dossier »). Moteur libre : classification automatique, tous les parseurs pertinents, **aucune liste blanche de champs** ; OCR ciblé, Crible fin et assistance IA restent disponibles. Les fichiers concernés portent le badge « 🛠 Analyse manuelle » et peuvent être basculés vers une famille précise depuis leur sélecteur (et inversement). Jamais d'alerte « ≠ détection » pour ce mode.
- **Fenêtre de réglages IA** : refonte en trois blocs (en-tête fixe, corps défilant, pied fixe). Le bouton *Enregistrer* et la case de consentement sont désormais toujours visibles, y compris sur un écran de 480 px de haut ou sur mobile ; champs Mode/Fournisseur/Modèle/Pages sur deux colonnes.
- **Fenêtres de revue (Crible fin, À vérifier, IA)** : hauteur calée sur l'écran réel (dvh), en-tête et pied fixes, liste défilante, texte long qui passe à la ligne, plus de débordement horizontal.
- Numéro de version corrigé dans la pastille d'en-tête et la fenêtre Cloud (affichaient encore 2.2.4).

# v2.3.1 — Assistance IA : ChatGPT et Gemini
- Choix du fournisseur dans les réglages 🤖 IA : **ChatGPT (OpenAI)** par défaut, **Gemini (Google)**, Claude (Anthropic) conservé en option.
- Modèles par défaut modifiables : `gpt-5.4-mini` (Chat Completions, sortie JSON forcée) et `gemini-3.5-flash` (generateContent, `responseMimeType: application/json`, température 0).
- Clé personnelle : une clé par fournisseur, en sessionStorage uniquement ; message clair si la clé manque ou est refusée.
- Edge Function `extracterre-llm-extract` multi-fournisseurs : secrets `OPENAI_API_KEY`, `GEMINI_API_KEY` (et `ANTHROPIC_API_KEY` optionnel) ; liste blanche de modèles optionnelle `EXTRACTERRE_LLM_MODELS`.
- Les garde-fous sont identiques quel que soit le fournisseur : citation mot pour mot, valeur présente dans la citation, confiance plafonnée à 85 %, validation ✓ / ✕ obligatoire.
- Correctif détecté par le test navigateur : la mémorisation du consentement IA.

# v2.3.0 — XML RE2020 natif, dropzone unique, cohérence métier, assistance IA vérifiée
**Import**
- Une seule zone de dépôt (fichiers ou dossier). La famille documentaire est détectée à la lecture et modifiable fichier par fichier (sélecteur « Auto / RSET RE2020 / RSEE thermique + carbone / RT2012 / THCex / Carbone / CCTP / DPGF / DPE-3CL / Annexe »). Changer la famille invalide le cache et réanalyse immédiatement le document.
- Un document peut porter plusieurs familles : un RSEE (ou un RSET contenant les sorties ACV) est traité en thermique ET en carbone.
- Familles fusionnées : LIBRE = ANNEXE ; 3CL = DPE ; RSENV + ACV = Carbone. Les anciennes clés restent reconnues (restauration des sessions v2.2).
- Alerte si la famille choisie contredit le type détecté (confiance ≥ 75 %).

**XML RE2020 (RSET + RSEnv + Datas_Comp) lu par balises** — `js/xml-re2020.js`
- Bbio, Cep, Cep,nr (+ max), DH / DH max du groupe le plus défavorable, logements, SHAB, traversant, climatisation, IC composants / chantier / énergie, lots 1–13, 6 postes énergie, Stock C, enveloppe (paroi principale par surface + vitrage majoritaire), multi-bâtiments par Index.
- Gains, Cep par poste et par vecteur calculés (Cef × 2,3 pour l'électricité) avec contrôle Σ vecteurs = Cep : pas d'émission si l'écart dépasse 3 %.
- Le texte conservé est une synthèse d'une page par bâtiment (l'arbre complet faisait jusqu'à 16 Mo). 16 Mo traités en < 2 s dans le navigateur.

**Correctifs de l'audit**
- DPE : lettre lue sur la ligne (plus de fenêtre qui prenait la première classe), énergie/GES distingués par le libellé, phase par section, mise en page éclatée gérée, DPE isolé = état existant (confiance 88 %, validation conseillée).
- DPE/3CL : sections recommandations / scénarios / préconisations ignorées pour les équipements ; équipements décrits = état existant.
- Consolidation : une valeur « Bâtiment unique » n'est plus recopiée sur tous les bâtiments pour les indicateurs propres à un bâtiment (performance, confort d'été, carbone, DPE, surface, logements) ; elle part en « À vérifier ». Une valeur attribuée au bâtiment l'emporte toujours sur une valeur générale.
- Apprentissage : le bonus ne peut plus être la seule raison du franchissement du seuil de 90 % (plafonné à 89,9 %).
- Stock C/m² : variantes reconnues par l'unité explicite kgC/m² (confiance 95 %).
- Lecture PDF : tri des fragments transitif, tolérance adaptée à la police ; OCR Tesseract géolocalisé (boîtes de mots reprojetées) et lignes OCR insérées à leur position verticale.
- Complétude par document alignée sur les listes blanches (« au moins un de » pour DPE avant/après).
- Source Stock C/m² : RSEE et RSENV ajoutés aux sources principales.

**Cohérence métier** — `js/coherence.js`
- Σ lots 1–13 = IC composants ; Σ postes énergie ≤ IC énergie ; Cep,nr ≤ Cep ; gains recalculés (ou calculés s'ils manquent) ; plages plausibles ; dépassements de seuils signalés.
- Une valeur incohérente quitte le tableau et rejoint « À vérifier » avec la raison. Les valeurs XML et validées ne sont jamais retirées (alerte « erreur » seulement).

**Assistance IA (désactivée par défaut)** — `js/llm-assist.js`, `supabase/functions/extracterre-llm-extract`
- Bouton 🤖 IA (réglages + consentement explicite) et bouton 🤖 IA par document.
- Envoie uniquement les pages qui mentionnent les champs manquants autorisés pour la famille du document.
- Proposition acceptée seulement si la citation est retrouvée mot pour mot dans la page ET contient la valeur ; confiance plafonnée à 85 % ; validation ✓ / ✕ obligatoire (fenêtre du Crible fin) ; rejets journalisés.
- Deux transports : Edge Function Supabase (clé dans les secrets serveur, session Cloud requise) ou clé personnelle conservée en sessionStorage.

**Sécurité** : `tools/compute_sri.py` épingle les scripts CDN et ajoute les empreintes SRI (à lancer une fois avec un accès internet).

# v2.2.4 — Stock C/m² ACV
- Ajout du champ **Stock C/m²** au volet Carbone et au schéma maître (168 champs).
- Extraction ACV stricte du libellé `Stockage carbone Stock,C (par m²)` avec unité `kgC/m²`.
- Premier apprentissage embarqué `acv:stock-c-per-m2-seed-v1`, testé sur les valeurs 50,4 / 80,5 / 77,0 / 55,1.
- Le Stock,C total en `kgC` est explicitement exclu.
- Champ disponible dans le repérage/correction manuel et le surlignage PDF.
- Cloud, OCR, listes blanches et autres parseurs inchangés.

# v2.2.2 — Surlignage direct dans le PDF

- correction/apprentissage directement dans la page PDF rendue par PDF.js ;
- couche texte native sélectionnable superposée au document ;
- bouton OCR à la demande, limité à la page courante ;
- coordonnées normalisées de chaque surlignage enregistrées dans le journal et la mémoire ;
- retour au texte PDF natif après OCR ;
- fallback texte conservé pour les pièces non-PDF ou restaurées sans fichier source ;
- aucune modification du pipeline Cloud, des parseurs spécialisés ou des listes blanches v2.2.1.

# v2.2.1 — Listes blanches par type documentaire

- filtrage strict des champs autorisés par famille documentaire ;
- séparation définitive RSET RE2020 / RSET RT2012 ;
- RSENV limité aux données carbone et métadonnées de rattachement ;
- suppression de RSENV des sources automatiques DH, systèmes, ENR et consommations thermiques ;
- nouveau test de non-régression `test_v2_2_1_whitelists.mjs`.

# v2.2.0 — Parseurs spécialisés par type de document

- Une dropzone dédiée par famille : RSET/RSEE, RT2012, THCex/RT Existant, RSENV, CCTP, DPGF, 3CL, DPE, Analyse ACV et Annexes.
- Le choix de la dropzone pilote le parseur et évite les croisements de règles entre familles.
- Contrôle de complétude par document avec champs attendus trouvés/manquants.
- Les documents annexes conservent l'ancien moteur de classification automatique.
- Cloud V2.1, mémoire d'apprentissage, patchs et 167 champs conservés.

# v2.1.1

- Correction du formulaire propriétaire de correction/apprentissage : suppression de la référence hors portée `missing` dans `submitBetaError()`.
- Cache-busting des assets en 2.1.1 pour garantir le chargement du bundle corrigé.
- Aucun changement du pipeline Cloud v2.1 ni du schéma des 167 champs.

# ExtracTerre v2.1.0

- Base réelle : v1.1.23 enrichie, sans suppression des fonctions existantes.
- Architecture hybride : navigateur + Supabase privé + worker GitHub Actions.
- Trois modes de calcul : Hybride auto, Local, Serveur.
- Déport de la lecture lourde PDF/OCR uniquement ; le moteur métier 167 champs reste commun côté ExtracTerre.
- Fallback local automatique en mode hybride si le Cloud est indisponible.
- Upload distant multi-parties de 45 MiB, reconstitution sur le runner, index `read.json.gz` en sortie.
- Suppression des PDF temporaires après traitement et suppression de l’index après récupération.
- Ajout des fonctions Supabase de création, démarrage, suivi, pont worker et nettoyage.
- Correction DH/DHmax U22Win : sélection couplée sur la ligne du DH maximal.
- Validation effective de `minAppVersion` pour les patchs.
- Catalogue maître inchangé : 167 champs, même ordre.
- Ajout de tests de non-régression V2.1 pour le routage hybride, DH/DHmax, compatibilité patchs et worker PDF/OCR.

# ExtracTerre v1.1.23

- Ajoute une mémoire d’apprentissage interne persistante dans un IndexedDB séparé.
- Regroupe les corrections par champ, type documentaire et contexte structurel plutôt que par numéro de page seul.
- Active une montée progressive de priorité après 2, 3 puis 5 confirmations concordantes, avec bonus plafonné à 0,08 de confiance.
- Ajoute des signaux négatifs pour mauvaise source, mauvais bâtiment et faux positif afin qu’un apprentissage puisse se corriger avec l’usage.
- Ajoute la vue Aide → Mémoire d’apprentissage du parseur avec compteurs, profils, fiabilité, désactivation et effacement local.
- Ajoute la synchronisation facultative de la mémoire via Supabase (`extracterre_learning_memory_pull`) sans exposer le journal complet.
- Ajoute `SUPABASE_MEMORY_V1_1_23.sql` pour migrer une base Supabase existante.
- Conserve le fonctionnement local si Supabase est absent ou si la migration distante n’est pas encore appliquée.

# ExtracTerre v1.1.22

- Ajoute la correction documentaire par surlignage depuis la croix propriétaire.
- La même action est disponible sur les cellules vides via un bouton +.
- La fenêtre liste toutes les pièces analysées, permet de choisir la page et d’ouvrir l’aperçu intégré.
- Le texte extrait de la page devient sélectionnable : le surlignage mémorise document, type, page, position relative, ligne, contexte avant/après et valeur sélectionnée.
- La valeur surlignée peut remplacer immédiatement la donnée fausse ou compléter la donnée manquante.
- Ajoute les événements `beta_missing_data_location` et `parser_location_learning` au journal d’amélioration.
- Le pack d’amélioration exporte désormais `apprentissage_emplacements.json` et synthétise les emplacements récurrents par champ et type documentaire.
- Met à jour le cache-busting de `index.html` en 1.1.22.

# v1.1.21

- Correctif moteur des patchs : un patch chargé est désormais réappliqué immédiatement aux documents déjà analysés à partir du texte conservé, sans relire ni OCRiser les PDF.
- Reclassification et reparsing des documents prêts lors du chargement d’un patch, puis reconsolidation immédiate des résultats.
- Correctif du patch RSET Surface : détection stricte de `Identifiant Bâtiment` et `S / usage principal` / `SRef / usage principal`; suppression de la détection trop large du mot « bâtiment ».
- Patch Surface RSET v2 intégré à la bibliothèque.

# v1.1.20 — analyse progressive + U22Win/Perrenoud multi-bâtiments

- Ajout des contrôles compacts ⏸ Pause / ⏹ Arrêt dans la barre sticky.
- Arrêt conservatif : les documents déjà terminés et leurs résultats restent disponibles.
- Remplissage progressif : consolidation/rendu des tableaux après chaque document terminé, pendant que les autres continuent.
- Nouveau patch générique RE2020 U22Win/Perrenoud pour RSET/RSEE, note de calcul et RSEnv multi-bâtiments.
- DH et DHmax : sélection du maximum (cas le plus défavorable) à l’échelle de chaque bâtiment.
- RSENV : mapping Bâtiment 1/2/... vers les noms réels détectés et lecture des IC composants lots 1 à 13 depuis la ligne Indicateur CO dynamique au niveau bâtiment.

# v1.1.18 — 14/09/2026

- Nouvelle UX résultats : barre sticky fine, navigateur projet latéral fixe, vue synthèse multi-projets et fiche détaillée d’un seul projet.
- Drop rapide dans le panneau résultats et navigation projet précédent/suivant sans remonter la page.
- Candidats : dès qu’une valeur est validée pour un champ/bâtiment, les candidats concurrents disparaissent immédiatement.
- Journal bêta v1.1.17 intégré comme corpus de non-régression.
- Tic/TicRef : lecture par paire sur les tableaux CE1/CE2 afin d’ignorer les numéros de groupe (ex. 9).
- Patch RT Existant CYPECAD renforcé pour limiter les vecteurs énergie hors contexte.

## v2.16.4 — 2026-11-02
- CCTP reconnus à leur structure (titre en page de garde ou en-tête « CCTP 04 - Lot … » répété) : un CCTP de rénovation n'est plus classé RT existant, Contrat ou RSET parce que ses clauses citent « existant », « contrat », « DPE » ou « RE2020 ».
- CCTP : lignes ignorées pour l'enveloppe et les systèmes — sommaire, références de normes (NF DTU, NF EN…), installation de chantier (palissade, portillon…), exigences acoustiques (LnAT, dB(A)), clauses conditionnelles (« Pour les installations… », « le cas échéant »), ventilation naturelle de locaux annexes ; le lot Démolition (ouvrages déposés) ne fournit aucune valeur.
- Délai d'analyse : 5 minutes sans aucune avancée (au lieu de 5 minutes au total) ; suspendu pendant l'attente dans la file OCR.

## v2.16.3 — 2026-11-02
- Archive .zip d’export RSEE / RSET (« Xml_RSEE_….xml.zip ») : le XML (et PDF) à la racine est extrait et analysé ; les fiches de composants des sous-dossiers sont ignorées. Auparavant, seul un paquet de questionnaire financier était lu et l’archive était écartée.

## v2.16.2 — 2026-11-02
- Accueil : tri des tuiles d’opérations par état du dossier (complets, partiellement complétés > 10 %, incomplets d’abord).

## v1.1.16 — Retours bêta + bibliothèque de patchs intégrée

- Intègre par défaut les patchs RT2012 Climawin, RSET/RSEE RE2020, RSENV/ACV, contrat Prestaterre et RT Existant CYPECAD par chapitres.
- Corrige les faux positifs Tic/Ticref = 2012 signalés dans le journal bêta.
- Durcit Bbio/Cep RT2012 pour ignorer numéros d’article, sommaires et identifiants Bât.1.
- Durcit le fallback Ubat pour ne plus lire un numéro de chapitre comme valeur.
- Conserve le moteur de patchs multi-bâtiments par section/chapter.

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

## v1.1.15 — Bibliothèque RT2012 & patchs d’amélioration
- Ajout d’un système de patchs JSON déclaratifs versionnés, sans exécution de JavaScript externe.
- Bouton « Charger un patch » dans Aide : import local persistant, liste et retrait des patchs locaux.
- Manifeste `data/patches/manifest.json` pour déployer des règles à toute l’équipe via GitHub.
- Premier patch `RT2012 Climawin / RSET 8100`, construit à partir du corpus Menton.
- Renforcement des signatures RT2012, Bbio/Bbiomax, Cep/Cepmax et nombre de logements.
- Conservation du parseur structuré des tableaux détaillés : Cep par poste et par énergie, avec priorité au tableau annuel réglementaire.


## v1.1.17 — parseur hiérarchique RT2012 / RE2020 / RSENV
- Branches réglementaires parallèles : RT2012/RT Existant et RE2020/RSET-RSEE/RSENV.
- Priorité par type de document puis chapitre/sous-chapitre/niveau (bâtiment, zone, lot).
- RT2012 : Chapitre 2 prioritaire pour Bbio/Cep/Tic ; sorties détaillées pour Cep par poste ; Chapitre 4 pour enveloppe et systèmes.
- RE2020 : Chapitre 2 prioritaire pour Bbio/Cep/Cep,nr/DH ; sorties détaillées pour postes énergie ; résultats carbone structurés séparément.
- RSENV : Chapitre 5 niveau bâtiment prioritaire pour Ic composant / chantier / énergie ; lots séparés du global.
- Une ACV libre qui recopie Bbio/Cep/Tic reste une source secondaire de contrôle.
- La consolidation tient désormais compte de `hierarchyRank` avant la confiance brute.
