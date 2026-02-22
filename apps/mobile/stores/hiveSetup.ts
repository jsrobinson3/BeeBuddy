import { create } from "zustand";
import type { HiveType, HiveSource } from "../services/api";

type HiveSetupState = {
  step: number;
  name: string;
  hiveType: HiveType | null;
  source: HiveSource | null;
  notes: string;
};

type HiveSetupActions = {
  setName: (name: string) => void;
  setHiveType: (hiveType: HiveType | null) => void;
  setSource: (source: HiveSource | null) => void;
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
  notes: "",
};

export const useHiveSetupStore = create<HiveSetupState & HiveSetupActions>()(
  (set) => ({
    ...initialState,

    setName: (name) => set({ name }),
    setHiveType: (hiveType) => set({ hiveType }),
    setSource: (source) => set({ source }),
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
