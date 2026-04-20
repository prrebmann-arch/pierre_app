import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Disable the navigator.locks-based auth lock. By default, every
          // auth call (getSession, getUser, refreshToken, any query needing
          // the token) goes through a mutex. If a component unmounts while
          // holding the lock (e.g., user navigates mid-fetch on tab switch),
          // the lock orphans and every subsequent Supabase call waits 5000ms
          // before the library forcefully acquires it. Our client is a
          // singleton and we don't run concurrent auth ops within a single
          // tab, so the lock only hurts us.
          lock: <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn(),
        },
      }
    )
  }
  return client
}
