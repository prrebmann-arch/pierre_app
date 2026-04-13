import { useEffect, useRef } from 'react'

/**
 * Re-triggers a fetch when the browser tab becomes visible again
 * and the component is still in a loading state.
 *
 * Safari freezes JS when switching apps — pending fetch promises
 * may never resolve. This hook detects that situation and retries.
 */
export function useRefetchOnResume(refetch: () => void, isLoading: boolean) {
  const loadingRef = useRef(isLoading)
  loadingRef.current = isLoading

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && loadingRef.current) {
        // Page came back visible while still loading — fetch likely froze
        refetch()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refetch])
}
