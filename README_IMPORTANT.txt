IMPORTANT - RECUPERATION V2.1 CLOUD

1. NE PAS utiliser l'index.html du pack "ExtracTerre_modal_large_GitHub.zip".
   Il provenait de la mauvaise branche (v1.1.23) et a ecrase la V2.1 cloud.

2. Dans GitHub, restaurer index.html ET styles.css a leur version V2.1 cloud
   (commit juste avant le remplacement du pack fenetre large).

3. Une fois la V2.1 cloud restauree, ouvrir son styles.css et COLLER LE CONTENU
   de modal-wide-safe.css TOUT A LA FIN du fichier.

4. Ne remplacer aucun fichier JS, worker, Supabase, workflow ou index.html.

Ce correctif ne touche qu'a #betaErrorDialog / .beta-error-dialog et supprime
le defilement horizontal de la fenetre de correction/apprentissage.
