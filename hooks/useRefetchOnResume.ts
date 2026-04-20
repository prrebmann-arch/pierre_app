import { useEffect, useRef } from 'react'

/**
 * Three safety nets for data fetching to survive Safari tab suspension:
 *
 * 1. Wake refetch: listens to the `coach:wake` custom event (dispatched by
 *    AuthContext after getSession has revived the Supabase connection) and
 *    refetches. This guarantees that by the time refetch runs, the HTTP/2
 *    connection is healthy again.
 *
 * 2. Resume-while-loading: if a fetch was in flight when the tab was hidden,
 *    also refetch on plain visibility change (fallback for edge cases).
 *
 * 3. Loading watchdog: if loading stays true for LOADING_WATCHDOG_MS after a
 *    wake, force a full page reload. Guarantees we never show an infinite
 *    skeleton if the refetch itself also hangs.
 */

const LOADING_RETRY_MS = 6000
const LOADING_WATCHDOG_MS = 10000

export function useRefetchOnResume(refetch: () => void, isLoading: boolean) {
  const loadingRef = useRef(isLoading)
  loadingRef.current = isLoading

  // Safety net 1+2: refetch on wake event or on visibility resume while loading
  useEffect(() => {
    const handleWake = () => refetch()
    const handleVisibility = () => {
      // Only fallback: if still loading when visibility comes back, refetch
      if (document.visibilityState === 'visible' && loadingRef.current) refetch()
    }
    window.addEventListener('coach:wake', handleWake)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('coach:wake', handleWake)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refetch])

  // Safety net 3a: retry once if loading takes more than LOADING_RETRY_MS
  const retriedRef = useRef(false)
  useEffect(() => {
    if (!isLoading) {
      retriedRef.current = false
      return
    }
    if (retriedRef.current) return
    const timer = setTimeout(() => {
      retriedRef.current = true
      refetch()
    }, LOADING_RETRY_MS)
    return () => clearTimeout(timer)
  }, [isLoading, refetch])

  // Safety net 3b: watchdog — if loading stays true too long, full reload
  useEffect(() => {
    if (!isLoading) return
    const timer = setTimeout(() => {
      if (loadingRef.current && typeof window !== 'undefined') {
        window.location.reload()
      }
    }, LOADING_WATCHDOG_MS)
    return () => clearTimeout(timer)
  }, [isLoading])
}
