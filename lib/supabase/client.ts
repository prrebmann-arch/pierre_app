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
            // Auto-abort any Supabase request that takes more than 10s
            // This prevents Safari frozen-tab promises from hanging forever
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 10000)

            // Merge with existing signal if any
            const existingSignal = options.signal
            if (existingSignal) {
              existingSignal.addEventListener('abort', () => controller.abort())
            }

            return fetch(url, { ...options, signal: controller.signal }).finally(() => {
              clearTimeout(timeout)
            })
          },
        },
      }
    )
  }
  return client
}
