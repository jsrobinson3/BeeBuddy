import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { syncDatabase } from "./sync";

/**
 * Triggers a sync when the app comes to the foreground and on mount.
 * Should be rendered inside the authenticated layout.
 */
export function useSyncOnForeground(): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
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
  }, []);
}
