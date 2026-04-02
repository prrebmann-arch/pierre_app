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
