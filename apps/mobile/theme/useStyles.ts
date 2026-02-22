import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useTheme } from "./ThemeContext";
import type { ThemeColors } from "./themes";

type StyleFactory<T extends StyleSheet.NamedStyles<T>> = (
  colors: ThemeColors,
) => T;

/**
 * Memoized style hook — re-creates StyleSheet only when theme changes.
 *
 * Usage:
 * ```ts
 * const createStyles = (c: ThemeColors) => ({
 *   container: { backgroundColor: c.bgPrimary },
 * });
 * function MyComponent() {
 *   const styles = useStyles(createStyles);
 *   ...
 * }
 * ```
 *
 * IMPORTANT: Define `createStyles` at module scope (not inline) so the
 * function reference is stable across renders.
 */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: StyleFactory<T>,
): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
