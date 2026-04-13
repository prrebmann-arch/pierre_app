import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: (url, options = {}) => {
            // 30s timeout — prevents Safari frozen-tab promises from hanging forever
            // without cutting legitimate slow requests (old value was 10s, too aggressive)
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 30000)
            return fetch(url, { ...options, signal: controller.signal })
              .catch((err) => {
                // Convert AbortError to empty response instead of crashing
                if (err.name === 'AbortError') {
                  return new Response(JSON.stringify({ data: null, error: 'Request timeout' }), {
                    status: 408,
                    headers: { 'Content-Type': 'application/json' },
                  })
                }
                throw err
              })
              .finally(() => clearTimeout(timeout))
          },
        },
      }
    )
  }
  return client
}
