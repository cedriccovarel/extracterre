# ExtracTerre — import massif et suivi des sources

Ce script lit les dossiers d'opérations (Box) **en lecture seule**. Il ne parcourt que les sous-dossiers CCTP, thermique et carbone / ACV / RSEE. Il classe les documents, choisit la version courante et l'extrait avec **les mêmes parseurs que l'appli**. Les résultats sont donc identiques à ceux d'un glisser-déposer.

Il garde ensuite un registre des documents, pour ne retraiter que les fichiers nouveaux ou modifiés.

Les résultats s'ouvrent dans ExtracTerre, depuis l'écran d'accueil, avec **« Import massif & suivi des sources »**. Cet espace est séparé : la version actuelle et sa session ne sont jamais touchées.

## 1. Installation (une fois)

Node.js est déjà installé dans `~/.local/node/bin`.

```bash
cd ~/Documents/GitHub/extracterre/tools/import
export PATH=$HOME/.local/node/bin:$PATH
npm install
cp .env.example .env
```

Ouvrez ensuite `.env` et collez vous-même la clé **service_role** du projet Supabase. Vous la trouvez dans Supabase, rubrique Project Settings → API Keys. Cette clé reste sur cet ordinateur et n'est jamais envoyée au navigateur.

Sans `.env`, le script fonctionne quand même, mais avec un registre local seulement.

**Supabase (une fois).** La migration `supabase/migrations/20261112_import_massif.sql` crée trois tables :
- `extracterre_import_keys` ;
- `extracterre_import_files` ;
- `extracterre_import_operations`.

**Confidentialité.**
- Tout ce qui part vers Supabase est chiffré sur votre ordinateur, en AES-256-GCM, avec une clé tirée de votre **phrase secrète**. Cette phrase n'est envoyée nulle part.
- Les numéros de contrat, les chemins et les empreintes de fichier sont remplacés par des codes illisibles (HMAC).
- Les tables refusent tout accès par les clés publiques.
- Sans la phrase secrète, personne ne peut relire ces données : ni Supabase, ni quelqu'un qui détiendrait la clé de service.

> ⚠️ Conservez la phrase secrète (12 caractères minimum), par exemple dans votre gestionnaire de mots de passe. Si vous la perdez, le registre Supabase devient illisible. Le registre local et les résultats restent utilisables, et un nouveau registre peut être recréé.

## 2. Préparer le fichier de contrats

- **TXT** : un numéro par ligne. Les zéros en tête, les espaces et les tirets sont tolérés (`5361`, `00005361`, `0000-5361`).
- **CSV** : séparateur `;` ou `,`. La 1re colonne est lue par défaut ; pour une autre colonne, ajoutez `--colonne "Numéro de contrat"` ou `--colonne 3`.
- Les lignes commençant par `#` sont ignorées.

**Lecture des numéros de contrat.** Le numéro est lu **en tête du nom de dossier** (`00005361 - 70 - VILLE - NOM`), puis comparé par valeur :
- `0153` ne correspond pas à `01534`, ni à `00015340` ;
- un dossier qui porte plusieurs contrats (`00001629 ET 00001630 - …`, `00001807, 1808, 1806 - …`) est rattaché à chacun ;
- un contrat présent dans **plusieurs dossiers** n'est pas traité : il passe « à vérifier » ;
- les dossiers `Annule - …` ne sont pas traités.

## 3. Modifier les familles de sous-dossiers

Tout se règle dans `import.config.json`, sans toucher au code :

| Réglage | Rôle |
|---|---|
| `families[].synonyms` | Mots qui désignent un sous-dossier CCTP, thermique ou carbone. Les accents, majuscules, numéros de tête (« 03 - », « 3_ ») et pluriels sont ignorés. |
| `notFamily` | Dossiers « conteneurs », comme *Évaluation thermique* : leurs fichiers directs sont pris, leurs sous-dossiers seulement s'ils correspondent eux-mêmes à une famille (CCTP oui, Plans ou DQE non). |
| `skipFolders` | Dossiers jamais parcourus. |
| `archiveFolders` | Dossiers d'archives : leurs fichiers passent après les autres pour le choix de la version courante. |
| `ignoreExtensions`, `ignoreFilePrefixes`, `ignoreFileNames` | Fichiers inutiles (images, DWG, `~$…`, `.DS_Store`…). |
| `versionPatterns`, `versionWords` | Indices et versions (`indA`, `ind_B`, `-C`, `v2`, `rev1`), mots retirés du nom (final, def, copie…). |
| `incompleteBelow` | Part minimale des champs attendus. En dessous, le document passe « à vérifier ». |
| `parallelisme`, `ia` | Nombre de documents lus en même temps ; modèle et plafond de l'IA locale. |

Le rapport **`sous-dossiers-ignores.csv`** classe par fréquence les noms de dossiers non retenus. Il sert à repérer une variante oubliée, à ajouter dans `synonyms`.

## 4. Lancer

```bash
cd ~/Documents/GitHub/extracterre/tools/import
export PATH=$HOME/.local/node/bin:$PATH

# a. Correspondance seulement : contrats ↔ dossiers, sous-dossiers retenus, rien n'est lu
node extracterre-import.mjs --contrats ~/Desktop/contrats.csv --check-only

# b. Simulation : classement, versions, statut prévu, sans extraction ni registre
node extracterre-import.mjs --contrats ~/Desktop/contrats.csv --dry-run

# c. Test sur un contrat
node extracterre-import.mjs --operation 00005361

# d. Traitement réel (relancer la même commande reprend là où ça s'était arrêté)
node extracterre-import.mjs --contrats ~/Desktop/contrats.csv

# e. Suivi : relancer régulièrement. Seuls les fichiers nouveaux ou modifiés sont relus.
node extracterre-import.mjs --contrats ~/Desktop/contrats.csv
```

Autres options : `--all-subfolders`, `--with-ai`, `--max-ia 20`, `--parallelisme 2`, `--reextraire` (après une mise à jour des parseurs), `--local`, `--sans-contenu`, `--dossier-travail <dossier>`, `--racine <dossier>`. L'aide complète s'affiche avec `--aide`.

**Dossier de travail** (`~/ExtracTerre-import` par défaut) :

| Contenu | Rôle |
|---|---|
| `rapports/<date>_<mode>/` | `correspondance.csv`, `sous-dossiers-ignores.csv`, `simulation.csv` (en simulation), `rapport-final.csv` |
| `registre.json` | Registre local, lu par l'appli |
| `resultats/<empreinte>.json.gz` | Document lu et extrait : texte compacté et occurrences, comme après un glisser-déposer |
| `decisions.json` | Vos choix faits dans l'appli (liste « À vérifier ») |

## 5. Règles appliquées

**Classement d'un document**, dans cet ordre (la méthode retenue est enregistrée) :
1. Famille du sous-dossier.
2. Structure XML : RSET ou RSEE RE2020, ou DPE.
3. Nom du fichier.
4. Texte de la 1re page.

Si les indices se contredisent, ou si aucun ne permet de classer le fichier, le document passe « à vérifier ». Les PDF sans texte (scans) sont signalés : faites l'OCR dans l'appli, par glisser-déposer.

**Choix de la version courante** :
1. Indice ou numéro le plus élevé.
2. Puis la date dans le nom ou le dossier (`AAAA-MM-JJ`, `AAAAMMJJ`, `JJ-MM-AAAA`, `JJ MM AAAA`).
3. Puis la date de modification.

Un indice présent d'un seul côté, ou deux versions indiscernables, mettent le document « à vérifier ». Les anciennes versions restent dans le registre comme historique.

**Fichiers déjà connus.** Un fichier dont l'empreinte (SHA-256) est connue n'est jamais relu : son résultat est réutilisé. Un fichier disparu du dossier est marqué « disparu », jamais supprimé du registre. Une opération inchangée est sautée.

**IA.** Il n'y a jamais d'appel automatique. Avec `--with-ai`, l'IA locale (Ollama, `qwen2.5:7b`) ne regarde que les documents incomplets. Ses propositions sont vérifiées mot pour mot dans le document et plafonnées à 85 %. Vous les validez une par une (✓ / ✕) dans l'appli, avec le bouton 🤖 IA de la liste « À vérifier ».

**Hiérarchie des sources.** Les documents importés entrent dans l'opération comme des documents glissés-déposés. Les collages Excel, le collage libre, Salesforce et les saisies gardent leur priorité. Les documents ajoutés à la main ne sont jamais retirés par une mise à jour.

## 6. Dans l'appli

1. Écran d'accueil → **Import massif & suivi des sources**.
2. Bouton **📂 Suivi des sources** → choisissez le dossier de travail (une fois).
3. **Charger toutes les opérations** : une opération par contrat, mise à jour à chaque nouveau passage du script.
4. Onglet **À vérifier** : vous pouvez filtrer par motif, corriger le type, valider tel quel, choisir la version, relancer, ignorer ou ouvrir les propositions de l'IA. Ces choix sont pris en compte au prochain lancement du script.
5. **⟳ Box** : compare le dossier Box de l'opération au registre (nouveaux, modifiés, disparus). Cette fonction n'existe que dans Chrome et Edge.

## 7. Tests

```bash
cd ~/Documents/GitHub/extracterre && node test_v2_24_0.mjs
```

Ce test vérifie, sur des noms fictifs :
- la correspondance des numéros de contrat ;
- les sous-dossiers ;
- les fichiers ignorés ;
- les versions ;
- le classement ;
- le chiffrement ;
- la vue de suivi.
