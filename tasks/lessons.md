# Lessons Learned

[2026-03-31] | Supabase v2 type incompatibilities with `.catch()` on query builders | The newer `@supabase/supabase-js` returns `PostgrestFilterBuilder` (not a Promise) from `.insert()` etc., so `.catch(() => {})` fails at type-check. Remove the `.catch()` or use try/catch instead.

[2026-03-31] | Pre-existing type errors block build | Always run `npx tsc --noEmit` to verify new code doesn't introduce errors, but be aware pre-existing errors in other files may also surface during `npm run build`.

[2026-03-31] | Data leak — unfiltered queries | Any query on shared tables (daily_reports, notifications, etc.) MUST filter by coach's athlete user_ids. Never query without a coach/user scope filter.

[2026-03-31] | Object references in useCallback/useEffect deps cause re-render loops | Never use context-derived objects (selectedAthlete, user) as dependency array values. Use primitive fields instead (selectedAthlete?.id, user?.id). Also memoize context provider values with useMemo to prevent unnecessary consumer re-renders.

[2026-03-31] | setLoading(true) without try/finally leaves UI stuck | Always wrap the body of async functions that call setLoading(true) in a try/finally block with setLoading(false) in finally.

[2026-03-31] | select('*') wastes bandwidth and slows queries | Always use explicit column lists in Supabase .select() calls. Add .limit() to any query that could return many rows.

[2026-04-03] | Heavy JSON columns (meals_data) kill list view performance | Don't fetch large JSON columns in list queries. Only fetch them on demand.

[2026-04-03] | Sequential queries avoidable via context data | Use AthleteContext data (already loaded) instead of re-querying the DB for athlete info.

[2026-04-13] | NEVER wrapper le fetch global de Supabase | Le wrapper AbortController + fake 408 Response a cassé le refresh de token auth. Toutes les requêtes retournaient vide. Le client Supabase doit rester VANILLA. Pour les timeouts Safari, utiliser useRefetchOnResume (hook composant).

[2026-04-13] | revalidateOnFocus:true sur SWR = cascade de re-fetch | Chaque switch d'onglet/app relançait 3 requêtes AthleteContext. Toujours mettre revalidateOnFocus:false.

[2026-04-13] | setLoading(true) inconditionnel = skeleton flash sur refetch | Pattern correct : `if (!data.length) setLoading(true)` — skeleton uniquement au premier chargement, pas sur les refetch.

[2026-04-13] | useCallback deps sur user (objet) au lieu de user?.id (string) | L'objet user change de référence à chaque auth event, relançant tous les useCallback/useEffect qui en dépendent.

[2026-04-13] | Toujours npm run build avant push | Plusieurs commits pushés sans vérification ont cassé le site en prod.

[2026-04-20] | Ouvrir la console AVANT de patcher un bug | J'ai passé 2h à patcher des symptômes (wake handler, timeouts, watchdog) pour le bug tab-switch avant que le user ouvre enfin la console qui montrait directement `React error #418` puis `@supabase/gotrue-js: Lock was not released within 5000ms`. Règle : premier réflexe sur un bug client = demander console + Network, pas deviner.

[2026-04-20] | Hydration mismatch (React #418) = UI gelée en skeleton | Lire localStorage/window/typeof document pendant le render initial fait diverger SSR et client. React bail, UI reste dans l'état SSR = skeleton infini. Pattern correct : initial state identique SSR+client (null, false, defaults), lire les APIs browser dans useEffect post-hydration. Fichiers typiques : Context providers, layouts, useState lazy initializers.

[2026-04-20] | Safari tab background + Supabase auto-refresh = orphan lock | @supabase/auth-js wrap chaque opération auth dans un mutex navigator.locks. Safari gèle les fetch dans les tabs en arrière-plan. Si auto-refresh fire en background → fetch gelé EN tenant le lock → orphan. Fix officiel : `supabase.auth.stopAutoRefresh()` sur hidden, `startAutoRefresh()` sur visible. PAS de await, PAS de getSession/getUser dans le handler. Doc : https://supabase.com/docs/reference/javascript/auth-startautorefresh

[2026-04-20] | getSession() ne fait AUCUN call réseau | Contrairement à ce qu'on peut croire, `supabase.auth.getSession()` lit juste le localStorage. Pour vraiment tester la connexion Supabase, utiliser `getUser()` (hit /auth/v1/user) ou un plain fetch REST. MAIS : getUser() acquiert aussi le lock → risque d'orphan. Pour un vrai ping sans lock, plain `fetch(supabaseUrl + '/rest/v1/')`.

[2026-04-20] | Chercher les issues GitHub de la lib AVANT de patcher un bug profond | Le bug Safari + Supabase était déjà documenté dans supabase-js#2111, #1594, #2013 avec le fix officiel. J'ai empilé 4 patches symptomatiques (no-op lock, wake ping, watchdog reload, reload on timeout) avant de faire la recherche. Règle : dès qu'un bug touche à une lib tierce (auth, fetch, lock), grep les issues GitHub de la lib en priorité absolue.

[2026-04-20] | Watchdog reload-on-stuck MASQUE les bugs et peut les aggraver | J'avais ajouté un watchdog qui reload la page si loading stuck >10s. Ça donne l'illusion que ça marche mais : (1) le user voit un reload inexpliqué, (2) le nouveau client peut re-deadlock instantanément, (3) ça masque la vraie cause racine. Règle : fix la cause, jamais un watchdog reload en prod.

[2026-04-20] | Preview Vercel ≠ prod pour tester RSC | Les preview URLs Vercel ont Deployment Protection (SSO) activé → les prefetches RSC échouent en 401 → Next.js fallback en full page reload = nav lente. Sur prod avec custom domain, pas de SSO, RSC marche. Pour tester vraiment la nav App Router, utiliser la prod (ou désactiver SSO sur preview).

[2026-04-20] | Colonnes DB : vérifier les SELECT contre le schéma réel | Une query `select('id, athlete_id, coach_id, reason, status, ...')` sur `cancellation_requests` retournait 400 silencieusement pendant des semaines parce que la colonne est `coach_note`, pas `reason`. Les 400 Supabase ne throw pas — ils retournent `{ data: null, error }` et le code continue avec data vide. Toujours grep les SQL migrations pour vérifier les colonnes existantes.

[2026-04-20] | Empty string '' vers colonne DATE Postgres = 400 | `date_naissance: ""` dans un UPDATE fail avec `22007 — invalid input syntax for type date`. Toujours normaliser les champs optionnels en `null` avant un update Supabase : `for (const k of Object.keys(data)) if (data[k] === '') data[k] = null`.

[2026-04-20] | Supabase client MUST be module-scope singleton | Si createClient() est appelé dans le body d'un component et retourne un nouveau client à chaque fois, chaque render crée un holder du lock auth sans libérer le précédent = orphan garanti. Pattern correct : `let client = null; export function createClient() { if (!client) client = createBrowserClient(...); return client }`. Notre code l'a déjà mais c'est fragile, à garder en tête.

[2026-04-20] | Les erreurs "Fetch API cannot load ... due to access control checks" sur preview Vercel = SSO, pas CORS | Pattern spécifique aux Vercel preview URLs avec Deployment Protection. Pas réparable côté code sauf à désactiver le SSO. Ne pas chercher des heures côté CORS ou headers — c'est juste Vercel.

[2026-04-21] | Une branche feature non mergée = fix perdu | Le fix "empty string → null" avait été fait sur `feature/debug-bilan-save-error` qui n'a jamais été mergée vers develop. 6h plus tard, user redécouvre le même bug. Règle : vérifier l'état des branches ouvertes à la fin d'une session (`gh pr list --author @me`) et soit merger, soit fermer avec raison. Sinon les fixes meurent.

[2026-04-21] | Toast d'erreur générique masque la cause | `toast('Erreur lors de la sauvegarde', 'error')` empêche le user de voir le vrai message Postgres. Toujours : `toast(\`Erreur: ${error.message}\`, 'error')` + `console.error('[ctx]', error, 'payload:', data)`. Le user peut copier/coller la vraie erreur au lieu de deviner.

[2026-04-24] | Convention nom/name mélangée dans la DB = bugs silencieux | Certaines tables utilisent `nom` (training_templates, nutrition_templates) et d'autres `name` (onboarding_workflows). Un SELECT avec le mauvais column name retourne 400 silencieusement, l'UI affiche une liste vide. Toujours vérifier le schéma (grep les autres queries sur la même table) avant d'écrire un SELECT. Ajouter systématiquement `if (error) console.error('[ctx]', error)` sur toutes les queries Supabase.
