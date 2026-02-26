import { useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";
import { syncDatabase } from "./sync";

/**
 * Monitors network connectivity and triggers a sync whenever
 * the device transitions from offline → online.
 * This ensures local writes made while offline are pushed
 * to the API as soon as connectivity is restored.
 */
export function useSyncOnReconnect(enabled: boolean): void {
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected && state.isInternetReachable !== false;

      // Only sync on offline → online transitions (not on initial mount,
      // which is already handled by useSyncOnForeground)
      if (wasConnected.current === false && isConnected) {
        syncDatabase();
      }

      wasConnected.current = !!isConnected;
    });

    return () => unsubscribe();
  }, [enabled]);
}
