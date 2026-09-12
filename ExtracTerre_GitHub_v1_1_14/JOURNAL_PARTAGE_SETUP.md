# ExtracTerre — activer le journal partagé multi-ordinateurs

ExtracTerre fonctionne sans serveur : le journal local est toujours disponible et n'est pas supprimé par **Effacer la session**.
Pour cumuler automatiquement les observations de plusieurs ordinateurs, la v1.1.6 sait utiliser une petite base Supabase.

## Mise en service une seule fois

1. Créer un projet sur Supabase.
2. Ouvrir **SQL Editor** et exécuter intégralement `SUPABASE_JOURNAL_SETUP.sql`.
3. Dans **Project settings / API**, récupérer :
   - l'URL du projet ;
   - la clé `publishable` (ou la clé `anon` legacy sur un ancien projet).
4. Pour tester sans modifier GitHub : dans ExtracTerre, ouvrir **Journal partagé**, coller ces deux valeurs, enregistrer puis tester.
5. Pour que tous les ordinateurs utilisent automatiquement la même base, renseigner ces deux valeurs dans `js/journal-config.js`, puis publier cette version sur GitHub Pages.

L'URL Supabase et la clé anonyme/publishable sont prévues pour être présentes côté navigateur. Elles ne donnent pas un accès direct à la table : les règles RLS bloquent la table et les fonctions RPC exigent une preuve dérivée du mot de passe saisi à l'ouverture d'ExtracTerre.

## Ce qui est envoyé

Le journal partagé reçoit seulement des événements utiles à l'amélioration : type de document, champs trouvés, temps de traitement/OCR, erreurs, corrections manuelles, validations/rejets et courts extraits contextuels associés aux décisions utilisateur.

Les PDF originaux, leurs ArrayBuffer et l'index complet des pages ne sont jamais envoyés par ce mécanisme.

## Effacer la session

Le bouton **Effacer la session** efface uniquement l'espace de travail/checkpoints de ce navigateur. Il ne supprime ni le journal local d'amélioration, ni les événements déjà synchronisés dans Supabase.
