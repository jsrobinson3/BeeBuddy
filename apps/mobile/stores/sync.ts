import { create } from "zustand";

interface SyncState {
  lastSyncedAt: number | null;
  setLastSyncedAt: (ts: number) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  lastSyncedAt: null,
  setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
}));
