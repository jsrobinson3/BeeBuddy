import { synchronize } from "@nozbe/watermelondb/sync";
import { database } from "./index";
import { api } from "../services/api";

let isSyncing = false;

export async function syncDatabase(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    await synchronize({
      database,
      sendCreatedAsUpdated: true,

      pullChanges: async ({ lastPulledAt }) => {
        const response = await api.syncPull(lastPulledAt);
        return {
          changes: response.changes,
          timestamp: response.timestamp,
        };
      },

      pushChanges: async ({ changes, lastPulledAt }) => {
        await api.syncPush(changes, lastPulledAt);
      },
    });
  } catch (error) {
    console.warn("Sync failed:", error);
  } finally {
    isSyncing = false;
  }
}
