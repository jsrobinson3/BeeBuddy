import { create } from "zustand";
import type { HiveType, HiveSource, HiveInstallKind } from "../services/api";

type HiveSetupState = {
  step: number;
  name: string;
  hiveType: HiveType | null;
  source: HiveSource | null;
  installKind: HiveInstallKind | null;
  installationDate: Date | null;
  initialFrames: number | null;
  queenIntroduced: boolean;
  notes: string;
};

type HiveSetupActions = {
  setName: (name: string) => void;
  setHiveType: (hiveType: HiveType | null) => void;
  setSource: (source: HiveSource | null) => void;
  setInstallKind: (installKind: HiveInstallKind | null) => void;
  setInstallationDate: (installationDate: Date | null) => void;
  setInitialFrames: (initialFrames: number | null) => void;
  setQueenIntroduced: (queenIntroduced: boolean) => void;
  setNotes: (notes: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
};

const TOTAL_STEPS = 3;

const initialState: HiveSetupState = {
  step: 0,
  name: "",
  hiveType: null,
  source: null,
  installKind: null,
  installationDate: null,
  initialFrames: null,
  queenIntroduced: false,
  notes: "",
};

export const useHiveSetupStore = create<HiveSetupState & HiveSetupActions>()(
  (set) => ({
    ...initialState,

    setName: (name) => set({ name }),
    setHiveType: (hiveType) => set({ hiveType }),
    setSource: (source) => set({ source }),
    setInstallKind: (installKind) => set({ installKind }),
    setInstallationDate: (installationDate) => set({ installationDate }),
    setInitialFrames: (initialFrames) => set({ initialFrames }),
    setQueenIntroduced: (queenIntroduced) => set({ queenIntroduced }),
    setNotes: (notes) => set({ notes }),

    nextStep: () =>
      set((state) => ({
        step: Math.min(state.step + 1, TOTAL_STEPS - 1),
      })),

    prevStep: () =>
      set((state) => ({
        step: Math.max(state.step - 1, 0),
      })),

    reset: () => set(initialState),
  }),
);
