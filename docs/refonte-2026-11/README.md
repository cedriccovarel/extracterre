# Refonte ExtracTerre — novembre 2026

Livrables du prompt maître « Refonte de l'intelligence documentaire, fiabilisation des extractions et nettoyage du
référentiel des bâtiments » (démarré le 17/11/2026). Versions concernées : v2.41.0 → v2.44.2 (publiées ensemble en v3.0.0).

Corpus de mesure : 647 opérations, 21 317 documents lus (sessions du 17/11/2026), exports Salesforce « Suivi tous contrats »
(colonne « Total bâtiments ») et « Opérations (détails) » (fiches Évaluation, valeurs par bâtiment).

Les fichiers qui citent des opérations clientes ne sont **pas** dans ce dépôt public : ils sont sur le poste, dans
`~/ExtracTerre-import/qualite/refonte-2026-11-17/`.

## Index des livrables

| | Livrable | Où |
|---|---|---|
| A | Référentiel des données (tous les champs réellement exploités, 211) | `B-matrice-sources-par-donnee.csv` (colonnes 1-3) |
| B | Matrice de hiérarchisation (sources principales / secondaires / exclues, présence mesurée, concordance Salesforce, règle d'arrêt) | `B-matrice-sources-par-donnee.csv` |
| C | Dictionnaire de reconnaissance des documents | `C-dictionnaire-types-documents.csv` |
| D | Politiques d'absence | § D ci-dessous |
| E | Référentiel Salesforce (ce qui est lu, comment, priorité) | § E ci-dessous |
| F | Référentiel des bâtiments par opération | local : `F-H-referentiel-batiments-et-nettoyage.csv` |
| G | Table de correspondance des alias | local : `G-table-correspondance-alias.csv` ; dans l'appli : « ☁ Périmètre Salesforce · correspondances » |
| H | Rapport de nettoyage | local : `F-H-…csv` (avant / après, non rattachés, valeurs et corrections non affectées) |
| I | Configurations exploitables | § I |
| J | Architecture | § J |
| K | Tests automatisés | § K |
| L | Rapport comparatif avant / après | § L |
| M | Documentation technique | § J, § I et `CHANGELOG.md` |

## Règle fondamentale : Salesforce fait foi

- Une valeur Salesforce (export ou fiche collée) est **toujours** la valeur affichée et exportée. Aucun document ne la remplace.
- Elle est **confrontée** aux documents à chaque analyse (v2.44.0, `js/confrontation.js`) : statut Confirmée, Divergence
  documentaire, Non comparable, Non retrouvée, Vérification impossible ou Non vérifiée, avec la valeur et le fichier du document
  en cas d'écart (info-bulle de la cellule, résumé « ☁ Confrontation » de l'opération). Une valeur de document arrondie à la
  précision de Salesforce confirme (52 ↔ 52,3).
- Sans valeur Salesforce, la donnée vient des documents, avec sa source (fichier, page, extrait) ; elle n'est jamais présentée
  comme une valeur Salesforce.
- Deux valeurs saisies / Salesforce différentes sur un même bâtiment (après fusion) : Salesforce l'emporte, l'autre est
  montrée en info-bulle (règle C).

## Choix de la valeur documentaire (v2.42.0)

Dans l'ordre :
1. Rang de la source pour la donnée (matrice B : principale avant secondaire ; exclue jamais).
2. **Document d'ancrage (A)** : quand Salesforce donne Bbio et Cep d'un bâtiment, la version d'étude qui concorde devient la
   source prioritaire des autres données de ce bâtiment (DH, Tic, IC, Ubat…).
3. **Indice (B)** : à type égal, l'indice le plus élevé du nom de fichier (ind C > ind A, v1.8 > v1.6).
4. Date d'étude la plus récente. La date du nom de fichier n'est pas un critère.
5. **Sources sans résultat (D)** : 56 sources principales qui ne contiennent presque jamais la donnée passent en secondaire
   (`SOURCE_DEMOTIONS_V2`, 37 champs).

## Bâtiments (v2.43.0 – v2.44.2)

- Les bâtiments de référence sont ceux de Salesforce : noms de la fiche Évaluation, sinon le nombre « Total bâtiments »
  (ou la future colonne « Nombre de bâtiments »). 0 ou vide = 1. Les documents ne créent jamais de bâtiment.
- **Jamais plus de bâtiments que le total Salesforce.** Fiche qui nomme plus de bâtiments que le total → les premiers sont
  gardés, l'**incohérence interne Salesforce** est signalée (jamais tranchée par les documents).
- Nombre sans noms : les N noms des documents les mieux renseignés (un par identifiant : « Bât A » = « BATIMENT A » =
  « Bâtiment 1 ») ; groupe de maisons accolées = un bâtiment ; « Bât AB » = un bâtiment, « Bât 2 & 3 » = deux.
  Identités manquantes signalées.
- **Aucune valeur perdue** : valeur sans bâtiment ou d'une liste → chacun de ces bâtiments (sans remplacer une valeur propre) ;
  bâtiment non rattaché → valeurs et corrections manuelles « non affectées », proposées à vérifier sur chaque bâtiment.
- **Réversible** : rien n'est réécrit dans les données ; « Désactiver le périmètre Salesforce » rend tous les bâtiments
  des documents ; chaque rattachement se corrige dans la table de correspondance.

## D — Politiques d'absence

| Où | Règle |
|---|---|
| Colonnes (Thermique, Enveloppe, Équipements, Économie…) | Une donnée non lue reste **vide** (Non renseigné). Aucune inférence, aucune valeur par défaut, jamais 0 pour une donnée chiffrée. Décision du 17/11/2026. |
| Onglet Recherches (v2.44.1) | Chaque critère a sa politique « Si rien n'est trouvé » : **Indéterminé** (défaut, comportement d'avant) ; **Absent par inférence** si les documents nécessaires (mots du nom ou du type, ex. « CCTP ») ont été lus ; **Absence seulement si elle est écrite** (« sans climatisation »). Statuts : Présent (mention), Absent (mention explicite), Absent (par inférence), Indéterminé, Non applicable (thème non applicable ou décision « Sans objet »), Non renseigné (critère chiffré ou texte). Une valeur Salesforce reste prioritaire. |

Aucun critère existant n'a l'inférence activée : elle se règle critère par critère dans l'éditeur de grille.

## E — Référentiel Salesforce

| Source | Ce qui est lu | Effet |
|---|---|---|
| Export « Opérations (détails) » (.xls / .xlsx / .csv) | Contrat, code interne, statut d'évaluation, adresse, sections de la fiche Évaluation (Performance thermique « Bât A / Bbio = … », Parois, Chauffage…) | Valeurs par bâtiment et communes, prioritaires ; noms des bâtiments |
| Export « Suivi tous contrats » | « Total bâtiments » / « Nombre de bâtiments » | Nombre de bâtiments de référence ; colonne « Total bâtiments » seulement si le nombre est écrit |
| Fiche Évaluation collée (favori) | Comme l'export « Opérations (détails) » | Idem |

Rattachement des opérations par numéro de contrat (puis code interne). Un nouvel import est rejouable : il ne crée ni
bâtiment ni doublon (valeurs indexées par bâtiment et par donnée). Une valeur saisie à la main hors Salesforce est conservée
sauf option « Remplacer aussi les valeurs saisies ».

## I — Configurations exploitables

| Fichier | Contenu |
|---|---|
| `js/config.js` | `FIELD_DEFS` (211 données), `DEFAULT_SOURCE_RULES` (sources principales / secondaires / exclues), `SOURCE_DEMOTIONS_V2` |
| `js/engine.js` | consolidation : rang de source, document d'ancrage, indice, date d'étude |
| `js/sf-perimeter.js` | référentiel des bâtiments Salesforce, rapprochement des noms, groupes, plafond N |
| `js/confrontation.js` | statuts de confrontation Salesforce |
| `js/recherches.js` | grilles de critères, politiques d'absence |
| `js/sf-export.js` | lecture des exports Salesforce |

Les règles de sources restent modifiables dans l'onglet « Règles » de l'application.

## J — Architecture (modules du prompt → code)

| Module | Rôle | Code |
|---|---|---|
| A Référentiel Salesforce | import, priorité | `sf-export.js`, `collage-libre.js` (fiche), `app.js` `sfxImport` / `sfxApplyToProject` |
| B Classification | type, famille, version | `classifier.js`, `import-rules.js` |
| C Référentiel bâtiments | bâtiments de référence | `sf-perimeter.js` `sfPerimeter` |
| D Alias | correspondances | `sf-perimeter.js` `sfPerimeterMap`, `buildings.js` |
| E Orchestrateur | ordre des sources, choix de la valeur | `routing.js`, `engine.js` `consolidate` |
| F Parseurs | lecture par type | `parsers.js` et modules spécialisés |
| G Validation | cohérence | `coherence.js`, `sanity.js` |
| H Confrontation | statuts | `confrontation.js` |
| I Absences | politiques | `recherches.js` |
| J Traçabilité | source de chaque valeur (fichier, page, extrait, méthode), corrections de l'utilisateur, rattachements | occurrences (`detailed`), journal d'apprentissage `journal.js` (`recordLearningEvent`), table de correspondance (`sfBuildingMap`, sauvegardée) |
| K Cache | lectures conservées | `cachedOccurrences`, registre de l'import massif |

Ordre de traitement à chaque analyse : documents lus (cache) → **référentiel des bâtiments Salesforce et rapprochement
des noms** → affectation des valeurs aux bâtiments de référence → choix de la valeur → valeurs Salesforce et saisies →
confrontation → contrôles de cohérence. Le référentiel est donc appliqué avant l'affectation quel que soit l'ordre
d'arrivée des imports.

## K — Tests automatisés

`for f in test_*.mjs; do node $f; done` (131 fichiers, données fictives). Nouveaux : `test_v2_41_1`, `test_v2_42_0`
(règles A, B, D), `test_v2_43_0` (bâtiments, exécution réelle de `applySfPerimeter`, règle C), `test_v2_44_0`
(confrontation), `test_v2_44_1` (politiques d'absence).

## L — Rapport comparatif

| Mesure | Avant | Après |
|---|---|---|
| Bâtiments actifs (647 opérations) | 2 103 | 1 506 |
| Opérations au-delà du total Salesforce | 141 | 0 |
| Bâtiments fantômes « Bâtiment IMENT » | 55 opérations | 0 |
| Corrections manuelles rattachées | — | 38 811 / 40 319 (1 508 non affectées, conservées) |
| Cep,nr juste (bâtiments avec Bbio + Cep Salesforce, n = 20) | 60 % | 82 % |
| DH juste (idem) | 35 % | 60 % |
| Valeurs Salesforce confrontées | 0 | 33 584 : 15 342 confirmées, 6 156 divergences, 7 034 non retrouvées, 3 295 sans document pertinent, 1 770 non vérifiées, 7 non comparables |
| Incohérences internes Salesforce signalées | 0 | 25 opérations |

Temps : la lecture des textes coûte ~70 ms par document (~30 min pour 24 000 documents) ; l'essentiel du temps d'import est
l'OCR (54 150 pages), dont ~30 000 sur des versions anciennes d'études. La règle d'arrêt correspondante (lire les versions de
la plus récente à la plus ancienne, s'arrêter au document d'ancrage Salesforce) attend validation.

## Reste à faire

- Règle d'arrêt de l'OCR à l'import massif (en attente de validation).
- Activer l'inférence d'absence sur des critères choisis de l'onglet Recherches (à la demande).
