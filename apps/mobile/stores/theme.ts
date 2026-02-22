import { create } from "zustand";
import { Platform } from "react-native";

type ColorScheme = "system" | "light" | "dark";

const THEME_KEY = "beebuddy_color_scheme";
const isWeb = Platform.OS === "web";

const SecureStore: typeof import("expo-secure-store") | null = isWeb
  ? null
  : require("expo-secure-store");

interface ThemeState {
  colorScheme: ColorScheme;
  isHydrated: boolean;
  setColorScheme: (scheme: ColorScheme) => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  colorScheme: "system",
  isHydrated: false,

  setColorScheme: async (scheme: ColorScheme) => {
    set({ colorScheme: scheme });
    if (!isWeb && SecureStore) {
      await SecureStore.setItemAsync(THEME_KEY, scheme);
    }
  },

  hydrate: async () => {
    try {
      if (!isWeb && SecureStore) {
        const stored = await SecureStore.getItemAsync(THEME_KEY);
        if (
          stored === "light" ||
          stored === "dark" ||
          stored === "system"
        ) {
          set({ colorScheme: stored });
        }
      }
    } catch {
      // Default to system
    } finally {
      set({ isHydrated: true });
    }
  },
}));
