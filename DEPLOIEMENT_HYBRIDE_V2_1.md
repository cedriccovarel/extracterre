# Déploiement du mode hybride — ExtracTerre v2.1.0

Ce guide met à niveau l'infrastructure déjà validée avec ExtracTerre : bucket privé Supabase `extracterre-temp`, table `extracterre_jobs` et dépôt privé GitHub `extracterre-worker`.

## 1. Mettre à niveau la table Supabase

Dans **Supabase → SQL Editor**, exécuter une seule fois :

`SUPABASE_HYBRID_V2_1.sql`

La migration ajoute le propriétaire du job, le multi-parties, les options de lecture, le chemin de l'index distant et les métadonnées de nettoyage. Elle ne supprime aucune colonne existante.

## 2. Mettre à jour les Edge Functions

Les sources prêtes à copier sont dans `supabase/functions/`.

Déployer / remplacer :

- `extracterre-create-job` — **Verify JWT ON**
- `extracterre-start-job` — **Verify JWT ON**
- `extracterre-worker-bridge` — **Verify JWT OFF** ; authentification par `EXTRACTERRE_WORKER_SECRET`
- `extracterre-job-status` — **Verify JWT ON**
- `extracterre-finish-job` — **Verify JWT ON**

Secrets Supabase requis :

- `EXTRACTERRE_WORKER_SECRET`
- `GITHUB_WORKER_TOKEN`
- `GITHUB_WORKER_OWNER`
- `GITHUB_WORKER_REPO`

Les variables standard `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies côté Edge Functions par Supabase. Ne jamais placer la `service_role` dans le navigateur ou GitHub Pages.

## 3. Mettre à jour le dépôt GitHub `extracterre-worker`

Le dossier `worker-v2_1/` représente le contenu à mettre dans la racine du dépôt worker :

- `.github/workflows/run-extracterre-job.yml`
- `worker/extract_pdf.py`
- `README.md`

Le dépôt doit rester **privé**.

GitHub Actions — secret requis :

- `EXTRACTERRE_WORKER_SECRET`

GitHub Actions — variables requises :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Le workflow utilise un runner Linux standard, Poppler et Tesseract français/anglais.

## 4. Déployer le site V2.1

Déployer le contenu du ZIP ExtracTerre v2.1 sur le dépôt GitHub Pages habituel.

`js/cloud-config.js` contient uniquement l'URL Supabase et la **Publishable key**, jamais une clé privilégiée. Si le projet Supabase change, adapter ces deux valeurs ou utiliser la configuration avancée de la fenêtre Cloud.

## 5. Connexion utilisateur

Dans ExtracTerre :

1. ouvrir **Cloud** ;
2. se connecter avec un utilisateur Supabase Auth confirmé ;
3. laisser **Calcul = Hybride auto** pour l'usage normal.

Modes :

- **Hybride auto** : PDF ≥ 6 Mo ou OCR renforcé → serveur ; sinon local ; fallback local automatique si le Cloud échoue ;
- **Local** : aucun PDF n'est envoyé au serveur ;
- **Serveur** : tous les PDF admissibles passent au worker ; XML/Excel restent locaux.

## 6. Cycle d'un PDF distant

1. ExtracTerre crée un job authentifié.
2. Le PDF est découpé en blocs de 45 MiB si nécessaire et envoyé dans le bucket privé.
3. `extracterre-start-job` vérifie que toutes les parties sont présentes et déclenche GitHub Actions.
4. Le worker reconstitue le PDF, extrait le texte natif et lance l'OCR ciblé si nécessaire.
5. Le worker renvoie `read.json.gz`, pas le PDF.
6. Le bridge passe le job à `completed` et supprime les morceaux PDF bruts.
7. ExtracTerre récupère l'index compact, le décompresse et applique le moteur métier habituel des 167 champs.
8. `extracterre-finish-job` supprime l'index distant après récupération.

## 7. Test conseillé après déploiement

- choisir **Serveur** pour forcer un petit PDF neutre ;
- vérifier dans Supabase : `waiting → queued → processing → completed` ;
- vérifier dans GitHub Actions que `Analyse ExtracTerre distante` est vert ;
- vérifier qu'ExtracTerre remplit ensuite les résultats ;
- vérifier que les objets temporaires du job disparaissent du bucket après récupération.

## 8. Retour arrière immédiat

En cas de problème Cloud, choisir **Calcul → Local**. Aucun composant distant n'est nécessaire au moteur historique : ExtracTerre continue alors à fonctionner comme la base v1.1.23.
