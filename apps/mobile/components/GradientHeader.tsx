/**
 * Gradient header with wave-shaped bottom edge.
 * Used on auth screens for visual warmth — forest-dark to honey-pale.
 */
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { View } from "react-native";

import { useStyles, useTheme, type ThemeColors } from "../theme";

interface GradientHeaderProps {
  height?: number;
  children?: React.ReactNode;
}

const createStyles = (c: ThemeColors) => ({
  waveCutout: {
    height: 30,
    backgroundColor: c.bgPrimary,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },
  gradient: {
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingTop: 40,
  },
});

function GradientBody({
  height,
  gradientColors,
  style,
  children,
}: {
  height: number;
  gradientColors: [string, string];
  style: Record<string, unknown>;
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ height }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function GradientHeader({ height = 280, children }: GradientHeaderProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View>
      <GradientBody
        height={height}
        gradientColors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.gradient}
      >
        {children}
      </GradientBody>
      <View style={styles.waveCutout} />
    </View>
  );
}
