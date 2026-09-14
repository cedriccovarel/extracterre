ExtracTerre - mini mise a jour moteur de patchs par chapitres

Pourquoi ?
Le chargeur de patchs v1.1.15 savait appliquer une regex au document entier, mais ne savait pas rattacher dynamiquement une valeur au chapitre Batiment A/B/C/... correspondant. Cette mini mise a jour ajoute :
- sectionStartRegex : delimitation d un chapitre
- sectionBuildingGroup : nom dynamique du batiment capture dans l en-tete
- selection=max/min + selectionGroup : selection du groupe thermique le plus defavorable
- constantValue : valeur explicite comme 0 lorsque le tableau indique un poste absent

Installation GitHub (une seule fois) :
1. Remplacer index.html par celui fourni.
2. Remplacer js/app.bundle.js par celui fourni.
3. Facultatif : remplacer js/patches.js si vous conservez les sources non bundlees sur GitHub.
4. Recharger le site avec Cmd+Shift+R.
5. Dans Aide > Patchs d amelioration, charger ExtracTerre_PATCH_RT_EXISTANT_CYPECAD_CHAPITRES_v1.json.

Les futurs patchs utilisant la lecture par chapitre pourront ensuite etre charges en JSON sans nouvelle mise a jour moteur.
