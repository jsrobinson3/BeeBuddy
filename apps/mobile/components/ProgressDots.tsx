/** Step progress indicator — row of dots with the active one highlighted. */
import React from "react";
import { View } from "react-native";

import { useStyles, type ThemeColors } from "../theme";

interface ProgressDotsProps {
  total: number;
  current: number;
}

const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 24;

const createStyles = (c: ThemeColors) => ({
  row: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: c.borderLight,
  },
  dotActive: {
    width: DOT_ACTIVE_WIDTH,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: c.honey,
  },
});

function Dot({ active, styles }: { active: boolean; styles: ReturnType<typeof createStyles> }) {
  return <View style={[styles.dot, active && styles.dotActive]} />;
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  const styles = useStyles(createStyles);

  const dots = Array.from({ length: total }, (_, i) => (
    <Dot key={i} active={i === current} styles={styles} />
  ));

  return <View style={styles.row}>{dots}</View>;
}
