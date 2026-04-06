# Lessons Learned

[2026-03-31] | Supabase v2 type incompatibilities with `.catch()` on query builders | The newer `@supabase/supabase-js` returns `PostgrestFilterBuilder` (not a Promise) from `.insert()` etc., so `.catch(() => {})` fails at type-check. Remove the `.catch()` or use try/catch instead.

[2026-03-31] | Pre-existing type errors block build | Always run `npx tsc --noEmit` to verify new code doesn't introduce errors, but be aware pre-existing errors in other files may also surface during `npm run build`.

[2026-03-31] | `ReturnType<typeof createClient>` Supabase typing | When passing Supabase client as function param in API routes using `@supabase/supabase-js` directly (not the SSR wrapper), use `ReturnType<typeof createClient<any>>` to avoid generic type mismatch.

[2026-03-31] | Data leak — unfiltered queries | Any query on shared tables (daily_reports, notifications, etc.) MUST filter by coach's athlete user_ids. Never query without a coach/user scope filter.

[2026-03-31] | Push notifications missing | Always use `notifyAthlete()` from `lib/push.ts` instead of raw `supabase.from('notifications').insert()` — ensures both DB notification AND Expo push are sent.

[2026-03-31] | Global CSS classes not ported to CSS modules | When migrating from vanilla JS to Next.js CSS modules, shared/global classes like `tr-body`, `tr-library` etc. must be explicitly added to the relevant `.module.css` file. A missing flex container class silently breaks layout without any build error.

[2026-03-31] | History view used inline styles instead of CSS module classes | When porting from vanilla JS HTML templates, always convert the original CSS classes (nh-*, ht-*) to camelCase CSS module equivalents. Inline styles break consistency and miss responsive breakpoints.

[2026-03-31] | DB column name mismatch: `exercises` vs `exercices_completes` | Original JS reads `log.exercices_completes` for workout log exercises. Always check both field names in parseLogExercises to handle schema variations.

[2026-03-31] | CSS module classes defined but not used in component | When porting from vanilla JS, always check if CSS module has pre-defined classes (like `.mens`, `.mensItem`) that should be used in the React component. Missing usage = invisible sections.

[2026-03-31] | setState during render via setTimeout is an anti-pattern | Use useEffect + useRef for initialization logic instead of setTimeout inside the render body. The setTimeout approach causes unnecessary re-renders and can lead to stale state.

[2026-03-31] | Login redirect race condition with React state | Never rely on setTimeout to wait for React state updates after async calls. Instead, return the data from the async function and use it directly for redirect logic.

[2026-03-31] | Vercel 404 despite successful build — framework detection | If Vercel shows `Builds: . [0ms]` and serves 404, it means the Framework Preset is wrong (e.g. "Other" instead of "Next.js"). Fix: add `"framework": "nextjs"` and `"buildCommand": "next build"` to `vercel.json`. Never rely on auto-detection alone.

[2026-03-31] | createClient() returns new object each render causing infinite loops | Supabase `createBrowserClient()` returns a new object each call. When stored in component state or used in useCallback/useEffect dependency arrays, it triggers infinite re-render loops. Fix: make `createClient()` a singleton (cache in module-level variable). Also remove `supabase` from dependency arrays in useCallback/useEffect — it is a stable singleton, not a reactive value.

[2026-03-31] | SSR browser client session hijack on signUp | `createBrowserClient` from `@supabase/ssr` syncs session to cookies. Calling `signUp` on it switches the coach's cookie-session to the new athlete. Use a disposable vanilla `createClient` from `@supabase/supabase-js` with `persistSession: false` for signUp, so the main SSR client is never touched.

[2026-03-31] | Object references in useCallback/useEffect deps cause re-render loops | Never use context-derived objects (selectedAthlete, user) as dependency array values. Use primitive fields instead (selectedAthlete?.id, user?.id). Also memoize context provider values with useMemo to prevent unnecessary consumer re-renders.

[2026-03-31] | Supabase queries referencing non-existent DB columns fail silently | Always verify column names against actual DB schema before writing `.select()` or `.update()` calls. The actual Stripe columns in coach_profiles are: stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled. Columns like stripe_secret_key, stripe_webhook_secret do NOT exist — coaches use Stripe Connect (platform key + stripeAccount option), not their own secret keys.

[2026-03-31] | useCallback used before definition in useEffect | If a useEffect calls a useCallback function, the useCallback MUST be declared before the useEffect in the component body. Also add it to the dependency array. Even though closures capture the variable, ordering matters for readability and lint rules.

[2026-03-31] | DB NOT NULL constraint violated by client-side upsert | Always check the DB schema for NOT NULL constraints before passing potentially null values in upserts. `stripe_customers.athlete_id` is NOT NULL — passing null crashes silently. Guard with an early return + user-facing error message.

[2026-03-31] | Querying non-existent DB columns (stripe_secret_key, stripe_webhook_secret) | The actual coach_profiles table only has stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled. All coach Stripe operations must use Stripe Connect (platform key + stripeAccount option), NOT individual coach secret keys.

[2026-03-31] | setLoading(true) without try/finally leaves UI stuck | Always wrap the body of async functions that call setLoading(true) in a try/finally block with setLoading(false) in finally. Without this, any thrown error leaves the UI in a permanent loading state.

[2026-03-31] | Old API paths referenced in component code | When renaming API routes, update all component fetch() calls to use the new paths directly, even if next.config.ts has redirects. Redirects add latency and can fail on POST requests (301/308 semantics).

[2026-03-31] | Next.js 16.2.1 Turbopack ENOENT on _buildManifest.js.tmp during production build | Turbopack build consistently fails with ENOENT on temp manifest files. Use `next build --webpack` as a workaround until fixed upstream.

[2026-03-31] | Stripe Checkout subscription mode cannot mix one-time and recurring line items | When using `mode: 'subscription'`, all line items must be recurring. For prorata billing, use `subscription_data.billing_cycle_anchor` only — Stripe calculates and charges the prorata automatically at checkout. Do NOT use `trial_end` (it means no charge) or add separate one-time line items.

[2026-03-31] | Stripe Connect webhook needs separate endpoint with its own secret | Connected account events are sent to a different webhook endpoint (registered via Stripe API for Connect). The handler must try both platform and connect secrets to verify signatures. Always log webhook hits before signature verification to diagnose delivery issues.

[2026-03-31] | BusinessDashboard queried stripe_customers with user_id instead of coach_id | The biz_clients table uses user_id, but stripe_customers and athlete_payment_plans use coach_id. Always check the correct column name per table before writing queries. The stripe_customers, athlete_payment_plans, and payment_history tables all use coach_id.

[2026-03-31] | Next.js redirects in next.config.ts intercept POST before route handlers | A `permanent: true` redirect causes a 308 on POST requests, which Stripe (and most webhook senders) will NOT follow. Never use config-level redirects for webhook paths — use a proxy route handler instead. Always verify webhook URLs return 400 (not 308/301) with an empty POST.

[2026-03-31] | AuthContext value not memoized = all consumers re-render constantly | Always useMemo the context value object in providers. Without it, every provider render creates a new object reference, triggering ALL useContext consumers to re-render even when values haven't changed.

[2026-03-31] | onAuthStateChange races with explicit signIn/signUp | Supabase fires onAuthStateChange synchronously during signIn. If both the listener AND the signIn caller set state, you get double renders and race conditions. Use a ref (signingInRef) to skip the listener during explicit auth calls.

[2026-03-31] | Missing try/finally on async init = permanent loading screen | Every async function that sets loading=true MUST use try/finally to guarantee setLoading(false) runs. A single uncaught error in init() can leave the entire app stuck on "Chargement..." forever. Add a safety timeout in layout as defense-in-depth.

[2026-03-31] | select('*') wastes bandwidth and slows queries | Always use explicit column lists in Supabase .select() calls. Reduces payload size significantly for tables with JSON/text columns (meals_data, exercices, etc.). Also add .limit() to any query that could return many rows.

[2026-04-03] | nutrition_logs meals_log structure: each meal has `foods[]` (with status/original/replacement) and `extras[]` | When building features on nutrition_logs, foods have `status: 'followed'|'replaced'|'pending'`, `original` (plan food), and `replacement` (athlete's choice). Extras are foods added by athlete outside the plan.

[2026-04-03] | payment_history table missing coach_id and currency columns — all webhook inserts failed silently | The stripe_migration.sql defined these columns but they were never applied to the live DB. Supabase returns HTTP 400 when inserting unknown columns, and the code did not check for errors. Always: (1) verify DB schema matches migration SQL after running it, (2) check `.error` on every Supabase insert, (3) never assume a migration was fully applied.

[2026-04-03] | Hardcoded athlete objective badge instead of dynamic roadmap phase | The infos page header badge showed `athletes.objectif` (static field) instead of querying `roadmap_phases` with `status='en_cours'`. Always prefer live roadmap data over static athlete fields for current phase display.

[2026-04-03] | useEffect with empty [] deps ignores useCallback changes | Training page had `useEffect(() => { loadData() }, [])` which never re-ran when `loadData` changed (e.g., when athleteId changed). Always use `[loadData]` as dependency when loadData is a useCallback.

[2026-04-03] | Early return in loadData without setLoading(false) leaves loading=true forever | Bilans page had `if (!selectedAthlete?.user_id) return` before `setLoading(true)`, but `loading` was initialized as `true`. The guard prevented data from loading AND prevented the loading state from being reset. Fix: combine loading and null checks so the UI shows skeleton until data is ready.

[2026-04-03] | Storing structured template variants in JSON column avoids DB migration | When DB columns can't be easily added (no psql access), store structured data variants (e.g. diete with training/rest, jour, repas) inside a JSON column with a discriminator field (template_type). Parse the shape at read time based on the type. Keeps the schema flat and avoids migration friction.

[2026-04-03] | useMemo(() => getPageCache()) blocks render with JSON.parse | useMemo runs during render — if the cached data is large (e.g. 500 workout logs with exercices_completes), JSON.parse blocks the main thread. Use useState(() => getPageCache()) instead — the lazy initializer only runs once at mount, not on re-renders.

[2026-04-03] | Storing heavy data in sessionStorage causes slow page loads | sessionStorage has a ~5MB limit and JSON.parse/stringify on large arrays (workout logs with nested exercises, photo URLs) blocks the main thread. Only cache lightweight reference data (programs, plans, phases). Always reload heavy/expiring data (logs, signed URLs) from the server.

[2026-04-03] | Loading 600 signed URLs at mount kills page load time | 200 bilans x 3 photos = 600 createSignedUrl requests. Load photos lazily on user interaction (e.g. when they click a photo button), not at page mount. This alone saves ~10-20 seconds of load time.

[2026-04-03] | Sequential queries avoidable via context data | Apercu page fetched athlete from DB just to get user_id, then ran 5 parallel queries. Since AthleteContext already has all athletes loaded, use `selectedAthlete.user_id` from context to skip the sequential fetch and run everything in parallel.

[2026-04-03] | SessionStorage cache pattern for instant tab loads | For each athlete tab page: (1) read cache at mount via useMemo (getPageCache), (2) initialize state from cache, (3) set loading=false if cache exists, (4) fetch fresh data in background, (5) write to cache after fetch. Cache key format: `athlete_{id}_{page}`. This makes tab switching feel instant while keeping data fresh.

[2026-04-03] | Pages relying solely on selectedAthlete block on context | Bilans page used `if (!selectedAthlete?.user_id) return` which blocked loading when context wasn't ready yet. Always use `params.id` as primary identifier and resolve user_id via context OR fallback DB query. Never gate loading on context-only data.
