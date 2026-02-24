/** Raw color palette — single source of truth for all hex values. */

export const palette = {
  honey: {
    DEFAULT: "#fdbc48",
    light: "#fee8b6",
    pale: "#fff7e5",
    dark: "#946000",
  },
  forest: {
    DEFAULT: "#3f4a30",
    light: "#5c6b47",
    pale: "#eef0eb",
    dark: "#2b331f",
  },
  comb: {
    white: "#fafaf7",
    cream: "#f5f2ea",
  },
  semantic: {
    success: "#4a7c3f",
    warning: "#8b5a00",
    danger: "#c0392b",
    info: "#3b638a",
  },
  dark: {
    bg: "#1a1e15",
    bgElevated: "#252b1e",
    bgSurface: "#2f3727",
    textSecondary: "#b3b99f",
    textMuted: "#7a7f6e",
    honeyPale: "#3a3520",
    forestPale: "#353d29",
    gradientStart: "#0f1209",
    gradientEnd: "#3a3520",
    borderLight: "#353d29",
    selectedBg: "#3a3520",
    success: "#5a9c4f",
    warning: "#c8890a",
    danger: "#e04a3a",
    info: "#5b8ab5",
    placeholder: "#7a7f6e",
    tabBarInactiveTint: "#b3b99f",
  },
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;
