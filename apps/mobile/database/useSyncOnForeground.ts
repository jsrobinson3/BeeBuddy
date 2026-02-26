import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { syncDatabase } from "./sync";

/**
 * Triggers a sync when the app comes to the foreground and on mount.
 * No-ops on web or when not authenticated.
 */
export function useSyncOnForeground(enabled: boolean): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;

    // Sync on mount (e.g., after login)
    syncDatabase();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        syncDatabase();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [enabled]);
}
