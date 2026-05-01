/**
 * Cross-coach cache invalidation hub.
 *
 * Some modules use module-level caches (e.g. aliments_db, exercices_db)
 * to avoid refetching on every component mount. The downside: when a
 * coach logs out and another logs in within the same browser tab, those
 * caches still hold the previous coach's data.
 *
 * Each module that maintains a per-coach cache should `register` a
 * clear function here. `clearAllCaches()` is called from AuthContext
 * on signOut.
 */

const clearFns = new Set<() => void>()

export function registerCacheClearer(fn: () => void): void {
  clearFns.add(fn)
}

export function clearAllCaches(): void {
  for (const fn of clearFns) {
    try { fn() } catch { /* swallow per-cache failures */ }
  }
}
