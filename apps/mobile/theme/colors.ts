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
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;
