# Audit ExtracTerre v2.1.1

- Bug correction/apprentissage `missing is not defined` corrigé dans `js/app.js` puis bundle reconstruit.
- 149/149 auto-tests moteur OK.
- Tests apprentissage v1.1.22+ et mémoire v1.1.23 OK.
- Test hybride v2.1 OK : 167 champs, routage Cloud, minAppVersion, DH/DHmax même ligne.
- Test de non-régression v2.1.1 du formulaire bêta OK.
- 9/9 patchs documentaires présents dans `data/patches/manifest.json` et dans `data/patches/`.
- Familles vérifiées : RT2012 Climawin, RSET/RSEE RE2020, RSENV/ACV, Contrat Prestaterre, RT Existant CYPECAD, U22Win/Perrenoud, Pleiades RE2020, Pleiades RT2012, Surface RSET Chapitre 2.
- Chaîne Cloud cliente présente : create-job -> upload signé -> start-job -> job-status -> téléchargement index -> finish-job.
- Bridge worker documenté et workflow worker V2.1 vérifié séparément ; script Python worker compile sans erreur.
- Favicon intégré.
- Fenêtre de correction/apprentissage élargie sans supprimer les styles Cloud.
