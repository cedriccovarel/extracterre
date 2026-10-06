# ExtracTerre v2.3 — guide rapide

## Importer
Déposez tout dans la zone unique. Chaque fichier affiche son type détecté, un sélecteur de famille (« Auto » par défaut) et sa complétude (`x/y attendus`). Si vous changez la famille, le document est réanalysé et la consolidation recalculée. Un ⚠ signale un choix contraire à la détection.

## Préférez le XML au PDF pour les RSET / RSEE
Le XML RE2020 est lu balise par balise : valeurs exactes, bâtiments identifiés par leur Index, aucun OCR. Méthodes tracées `xml:re2020:*` (rang hiérarchique 1). Correspondance des sous-contributeurs énergie : 1 chauffage, 2 ECS, 3 refroidissement, 4 éclairage (sans colonne), 5 auxiliaires ventilation, 6 auxiliaires distribution, 7 déplacements.

## Contrôles de cohérence
Visibles dans Diagnostics. Une valeur PDF incohérente (ex. Σ lots ≠ IC composants) passe dans « À vérifier » avec la raison ; une valeur XML incohérente reste mais est signalée en erreur (ex. ACV incomplète).

## Assistance IA (ChatGPT, Gemini ou Claude)
1. Bouton **🤖 IA** (barre d'analyse) → choisir le **mode**, le **fournisseur** et le modèle, cocher le consentement.
   - ChatGPT (OpenAI) : modèle par défaut `gpt-5.4-mini` ; clé créée sur platform.openai.com.
   - Gemini (Google) : modèle par défaut `gemini-3.5-flash` ; clé créée sur aistudio.google.com.
   - Les identifiants de modèles évoluent : remplacez-les dans le champ « Modèle » si le fournisseur en a retiré un.
2. **Mode clé personnelle** : la clé n'est gardée que pour l'onglet en cours (une par fournisseur).
3. **Mode serveur** (recommandé pour l'équipe, aucune clé dans le navigateur) :
   `supabase secrets set OPENAI_API_KEY=...` et/ou `supabase secrets set GEMINI_API_KEY=...`, puis `supabase functions deploy extracterre-llm-extract`. Optionnel : `EXTRACTERRE_LLM_MODELS="gpt-5.4-mini,gemini-3.5-flash"`. Connexion Cloud requise.
4. Bouton **🤖 IA** d'un document → propositions vérifiées mot pour mot → ✓ / ✕.
Rien n'est envoyé tant que le mode est « Désactivée ». Sans IA, toute l'extraction fonctionne normalement.

## SRI des scripts CDN
`python3 tools/compute_sri.py` (connexion internet requise), puis commit de `index.html`.
