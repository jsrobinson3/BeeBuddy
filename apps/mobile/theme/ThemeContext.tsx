import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";

import { useThemeStore } from "../stores/theme";
import { darkTheme, lightTheme, type ThemeColors } from "./themes";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightTheme,
  mode: "light",
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const hookScheme = useColorScheme();
  const preference = useThemeStore((s) => s.colorScheme);

  // Fallback: Appearance API can be more reliable than the hook on Android
  const [systemScheme, setSystemScheme] = useState<"light" | "dark">(
    () => (hookScheme ?? Appearance.getColorScheme() ?? "light") === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    if (hookScheme) {
      setSystemScheme(hookScheme === "dark" ? "dark" : "light");
    }
  }, [hookScheme]);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, []);

  const resolvedMode: ThemeMode = useMemo(() => {
    if (preference === "system") {
      return systemScheme;
    }
    return preference;
  }, [preference, systemScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: resolvedMode === "dark" ? darkTheme : lightTheme,
      mode: resolvedMode,
      isDark: resolvedMode === "dark",
    }),
    [resolvedMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
