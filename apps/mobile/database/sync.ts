import { synchronize } from "@nozbe/watermelondb/sync";
import NetInfo from "@react-native-community/netinfo";
import { database } from "./index";
import { api } from "../services/api";
import type { SyncChangesMap } from "../services/api.types";

let isSyncing = false;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable !== false);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pullChanges({ lastPulledAt }: { lastPulledAt: number | null }) {
  const response = await api.syncPull(lastPulledAt);
  return { changes: response.changes, timestamp: response.timestamp };
}

async function pushChanges({ changes, lastPulledAt }: { changes: SyncChangesMap; lastPulledAt: number | null }) {
  // lastPulledAt is always set after a successful pull
  await api.syncPush(changes, lastPulledAt!);
}

async function runSync(): Promise<void> {
  await synchronize({
    database,
    sendCreatedAsUpdated: true,
    pullChanges: ({ lastPulledAt }) => pullChanges({ lastPulledAt: lastPulledAt ?? null }),
    pushChanges: ({ changes, lastPulledAt }) =>
      pushChanges({ changes: changes as SyncChangesMap, lastPulledAt: lastPulledAt ?? null }),
  });
}

async function syncWithRetry(): Promise<void> {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      await runSync();
      return;
    } catch (error) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        console.warn(`Sync failed after ${attempt} attempts:`, error);
        return;
      }
      console.warn(`Sync attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`);
      await delay(RETRY_DELAY_MS);
      if (!(await isOnline())) {
        console.warn("Lost connectivity during sync retry, aborting.");
        return;
      }
    }
  }
}

export async function syncDatabase(): Promise<void> {
  if (isSyncing) return;
  if (!(await isOnline())) return;

  isSyncing = true;
  try {
    await syncWithRetry();
  } finally {
    isSyncing = false;
  }
}
