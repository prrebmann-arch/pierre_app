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

[2026-04-03] | Performance optimization broke site with React hydration errors | Adding useMemo/useCallback/React.memo to existing components causes "rendered more hooks than previous render" errors. sessionStorage caching with JSON.parse/stringify blocks the main thread. SAFE optimizations are: .limit() on Supabase queries, optimizePackageImports in next.config, loading.tsx files, and parallelizing independent queries with Promise.all. Never touch hooks, contexts, or component logic for perf.
