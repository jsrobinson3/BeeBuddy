/**
 * Web stub for useSyncOnReconnect.
 *
 * WatermelonDB sync is not used on web — the app relies on TanStack Query
 * for all server-state management. This stub prevents the web bundle from
 * pulling in @nozbe/watermelondb/sync and @react-native-community/netinfo.
 */

export function useSyncOnReconnect(_enabled: boolean): void {
  // no-op on web
}
