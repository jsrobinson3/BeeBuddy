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
  textOnGradient: string;
  textOnGradientMuted: string;

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
  textOnGradient: palette.comb.white,
  textOnGradientMuted: "rgba(250, 250, 247, 0.8)",

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
  bgPrimary: palette.dark.bg,
  bgSurface: palette.dark.bgElevated,
  bgElevated: palette.dark.bgSurface,
  bgInput: palette.dark.bgSurface,
  bgInputSoft: palette.dark.bgSurface,

  textPrimary: palette.comb.cream,
  textSecondary: palette.dark.textSecondary,
  textMuted: palette.dark.textMuted,
  textOnPrimary: palette.forest.DEFAULT,
  textOnDanger: palette.white,

  honey: palette.honey.DEFAULT,
  honeyLight: palette.honey.light,
  honeyPale: palette.dark.honeyPale,
  honeyDark: palette.honey.dark,
  forest: palette.forest.DEFAULT,
  forestLight: palette.forest.light,
  forestPale: palette.dark.forestPale,
  forestDark: palette.forest.dark,

  gradientStart: palette.dark.gradientStart,
  gradientEnd: palette.dark.gradientEnd,
  textOnGradient: palette.comb.white,
  textOnGradientMuted: "rgba(250, 250, 247, 0.8)",

  border: palette.forest.DEFAULT,
  borderLight: palette.dark.borderLight,
  borderFocus: palette.honey.DEFAULT,

  primaryFill: palette.honey.DEFAULT,
  primaryFillPressed: palette.honey.dark,
  secondaryFill: palette.transparent,
  selectedBg: palette.dark.selectedBg,
  selectedBorder: palette.honey.DEFAULT,
  selectedText: palette.honey.DEFAULT,

  success: palette.dark.success,
  warning: palette.dark.warning,
  danger: palette.dark.danger,
  info: palette.dark.info,

  shadowColor: palette.black,
  placeholder: palette.dark.placeholder,
  switchTrackFalse: palette.forest.DEFAULT,
  switchTrackTrue: palette.honey.DEFAULT,
  switchThumb: palette.comb.cream,

  tabBarBg: palette.dark.bg,
  tabBarActiveTint: palette.honey.DEFAULT,
  tabBarInactiveTint: palette.dark.tabBarInactiveTint,
  headerBackground: palette.dark.bg,
  headerTint: palette.comb.cream,
  statusBarStyle: "dark",
};
