import { Text, View } from "react-native";

import {
  useStyles,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../theme";

const createStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.honeyPale,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: spacing.sm,
  },
  headerEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  headerText: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodySemiBold,
    color: c.honeyDark,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  insight: {
    ...typography.sizes.bodySm,
    fontFamily: typography.families.body,
    color: c.textPrimary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
});

export function WeatherInsightCard({ insights }: { insights: string[] }) {
  const styles = useStyles(createStyles);

  if (insights.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>{"\uD83D\uDCA1"}</Text>
        <Text style={styles.headerText}>Weather Insights</Text>
      </View>
      {insights.map((text, i) => (
        <Text key={i} style={styles.insight}>
          {text}
        </Text>
      ))}
    </View>
  );
}
