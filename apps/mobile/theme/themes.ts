/** Light and dark theme definitions — resolved semantic color maps. */

import { palette } from "./colors";

export type ThemeColors = {
  // Backgrounds
  bgPrimary: string;
  bgSurface: string;
  bgElevated: string;
  bgInput: string;
  bgInputSoft: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  textOnDanger: string;

  // Brand
  honey: string;
  honeyLight: string;
  honeyPale: string;
  honeyDark: string;
  forest: string;
  forestLight: string;
  forestPale: string;
  forestDark: string;

  // Gradient
  gradientStart: string;
  gradientEnd: string;

  // Borders
  border: string;
  borderLight: string;
  borderFocus: string;

  // Interactive
  primaryFill: string;
  primaryFillPressed: string;
  secondaryFill: string;
  selectedBg: string;
  selectedBorder: string;
  selectedText: string;

  // Semantic
  success: string;
  warning: string;
  danger: string;
  info: string;

  // Specific
  shadowColor: string;
  placeholder: string;
  switchTrackFalse: string;
  switchTrackTrue: string;
  switchThumb: string;

  // Navigation
  tabBarBg: string;
  tabBarActiveTint: string;
  tabBarInactiveTint: string;
  headerBackground: string;
  headerTint: string;
  statusBarStyle: "light" | "dark";
};

export const lightTheme: ThemeColors = {
  bgPrimary: palette.comb.white,
  bgSurface: palette.comb.cream,
  bgElevated: palette.white,
  bgInput: palette.white,
  bgInputSoft: palette.forest.pale,

  textPrimary: palette.forest.DEFAULT,
  textSecondary: palette.forest.light,
  textMuted: "#8a8e82",
  textOnPrimary: palette.forest.DEFAULT,
  textOnDanger: palette.white,

  honey: palette.honey.DEFAULT,
  honeyLight: palette.honey.light,
  honeyPale: palette.honey.pale,
  honeyDark: palette.honey.dark,
  forest: palette.forest.DEFAULT,
  forestLight: palette.forest.light,
  forestPale: palette.forest.pale,
  forestDark: palette.forest.dark,

  gradientStart: palette.forest.dark,
  gradientEnd: palette.honey.pale,

  border: "#ddd8cc",
  borderLight: "#eae7df",
  borderFocus: palette.honey.DEFAULT,

  primaryFill: palette.honey.DEFAULT,
  primaryFillPressed: palette.honey.dark,
  secondaryFill: palette.transparent,
  selectedBg: palette.honey.pale,
  selectedBorder: palette.honey.DEFAULT,
  selectedText: palette.honey.dark,

  success: palette.semantic.success,
  warning: palette.semantic.warning,
  danger: palette.semantic.danger,
  info: palette.semantic.info,

  shadowColor: palette.forest.DEFAULT,
  placeholder: "#8a8e82",
  switchTrackFalse: "#ddd8cc",
  switchTrackTrue: palette.honey.DEFAULT,
  switchThumb: palette.white,

  tabBarBg: palette.white,
  tabBarActiveTint: palette.honey.DEFAULT,
  tabBarInactiveTint: palette.forest.light,
  headerBackground: palette.forest.DEFAULT,
  headerTint: palette.comb.white,
  statusBarStyle: "light",
};

export const darkTheme: ThemeColors = {
  bgPrimary: "#1a1e15",
  bgSurface: "#252b1e",
  bgElevated: "#2f3727",
  bgInput: "#2f3727",
  bgInputSoft: "#2f3727",

  textPrimary: palette.comb.cream,
  textSecondary: "#b3b99f",
  textMuted: "#7a7f6e",
  textOnPrimary: palette.forest.DEFAULT,
  textOnDanger: palette.white,

  honey: palette.honey.DEFAULT,
  honeyLight: palette.honey.light,
  honeyPale: "#3a3520",
  honeyDark: palette.honey.dark,
  forest: palette.forest.DEFAULT,
  forestLight: palette.forest.light,
  forestPale: "#353d29",
  forestDark: palette.forest.dark,

  gradientStart: "#0f1209",
  gradientEnd: "#3a3520",

  border: palette.forest.DEFAULT,
  borderLight: "#353d29",
  borderFocus: palette.honey.DEFAULT,

  primaryFill: palette.honey.DEFAULT,
  primaryFillPressed: palette.honey.dark,
  secondaryFill: palette.transparent,
  selectedBg: "#3a3520",
  selectedBorder: palette.honey.DEFAULT,
  selectedText: palette.honey.DEFAULT,

  success: "#5a9c4f",
  warning: "#c8890a",
  danger: "#e04a3a",
  info: "#5b8ab5",

  shadowColor: "#000000",
  placeholder: "#7a7f6e",
  switchTrackFalse: palette.forest.DEFAULT,
  switchTrackTrue: palette.honey.DEFAULT,
  switchThumb: palette.comb.cream,

  tabBarBg: "#1a1e15",
  tabBarActiveTint: palette.honey.DEFAULT,
  tabBarInactiveTint: "#b3b99f",
  headerBackground: "#1a1e15",
  headerTint: palette.comb.cream,
  statusBarStyle: "dark",
};
