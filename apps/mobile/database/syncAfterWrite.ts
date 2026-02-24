import { syncDatabase } from "./sync";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Trigger a sync after a local write, debounced to 500ms so rapid
 * mutations don't cause excessive network calls.
 */
export function syncAfterWrite(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncDatabase();
  }, 500);
}
