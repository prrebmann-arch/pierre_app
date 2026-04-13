import { useEffect, useRef } from 'react'

/**
 * Two safety nets for data fetching:
 *
 * 1. Visibility resume: when the browser tab becomes visible again and the
 *    component is still loading, re-trigger the fetch. Handles Safari freezing
 *    JS on app switch (pending fetch promises never resolve).
 *
 * 2. Loading timeout: if loading takes more than 12s, retry once. Handles
 *    any scenario where a fetch silently fails (network issue, frozen tab,
 *    Supabase timeout, etc.). Only retries once to avoid infinite loops.
 */
export function useRefetchOnResume(refetch: () => void, isLoading: boolean) {
  const loadingRef = useRef(isLoading)
  loadingRef.current = isLoading

  // Safety net 1: re-fetch when tab becomes visible while still loading
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && loadingRef.current) {
        refetch()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refetch])

  // Safety net 2: retry once if loading takes more than 12s
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
    }, 20000)
    return () => clearTimeout(timer)
  }, [isLoading, refetch])
}
