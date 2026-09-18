# ExtracTerre Worker v2.1

Ce dossier remplace le contenu technique du dépôt privé `extracterre-worker`.

## GitHub Actions requis

Secrets :
- `EXTRACTERRE_WORKER_SECRET`

Variables :
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Le workflow télécharge les morceaux du PDF via des URL signées temporaires, reconstitue le PDF sur le runner, utilise Poppler/Tesseract pour la lecture lourde, compresse l'index documentaire en `read.json.gz`, le renvoie dans le bucket privé puis signale la fin du job.

Le PDF brut est supprimé de Supabase par `extracterre-worker-bridge` dès que le résultat est validé. Le résultat compressé est supprimé après récupération par ExtracTerre via `extracterre-finish-job`.
