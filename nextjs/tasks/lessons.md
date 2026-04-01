# Lessons Learned

[2026-03-31] | Supabase v2 type incompatibilities with `.catch()` on query builders | The newer `@supabase/supabase-js` returns `PostgrestFilterBuilder` (not a Promise) from `.insert()` etc., so `.catch(() => {})` fails at type-check. Remove the `.catch()` or use try/catch instead.

[2026-03-31] | Pre-existing type errors block build | Always run `npx tsc --noEmit` to verify new code doesn't introduce errors, but be aware pre-existing errors in other files may also surface during `npm run build`.

[2026-03-31] | `ReturnType<typeof createClient>` Supabase typing | When passing Supabase client as function param in API routes using `@supabase/supabase-js` directly (not the SSR wrapper), use `ReturnType<typeof createClient<any>>` to avoid generic type mismatch.
