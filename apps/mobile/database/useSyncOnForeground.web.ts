/**
 * Web stub for useSyncOnForeground.
 *
 * WatermelonDB sync is not used on web — the app relies on TanStack Query
 * for all server-state management. This stub prevents the web bundle from
 * pulling in @nozbe/watermelondb/sync and related native modules.
 */

export function useSyncOnForeground(_enabled: boolean): void {
  // no-op on web
}
