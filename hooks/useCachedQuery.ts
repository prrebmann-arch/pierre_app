'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Stale-while-revalidate pattern:
 * Returns cached data instantly from sessionStorage, then refreshes in background.
 */
export function useCachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [data, setData] = useState<T | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem(key)
      return cached ? (JSON.parse(cached) as T) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(!data)
  const fetchingRef = useRef(false)

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const fresh = await queryFn()
      setData(fresh)
      setLoading(false)
      try {
        sessionStorage.setItem(key, JSON.stringify(fresh))
      } catch {
        // sessionStorage full — ignore
      }
    } catch {
      setLoading(false)
    } finally {
      fetchingRef.current = false
    }
  // queryFn is expected to be a stable callback (useCallback) from the caller
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (enabled) {
      refresh()
    }
  }, [enabled, refresh])

  return { data, loading, refresh }
}
