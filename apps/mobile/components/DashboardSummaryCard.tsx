import { ActivityIndicator, Text, View } from "react-native";

import { useDashboardSummary } from "../hooks/useDashboardSummary";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../theme";

const createStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: spacing.sm,
  },
  emoji: { fontSize: 16, marginRight: spacing.xs },
  title: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodySemiBold,
    color: c.honeyDark,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  body: {
    ...typography.sizes.bodySm,
    fontFamily: typography.families.body,
    color: c.textPrimary,
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.sizes.bodySm,
    fontFamily: typography.families.body,
    color: c.textMuted,
  },
});

interface Props {
  hasInspections: boolean;
}

export function DashboardSummaryCard({ hasInspections }: Props) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const { data, isPending, isWarmingUp, isError } = useDashboardSummary(
    hasInspections,
  );

  if (!hasInspections) {
    return (
      <View style={styles.card}>
        <Header styles={styles} />
        <Text style={styles.body}>
          Log an inspection or two and a hive-by-hive recap will show up here.
        </Text>
      </View>
    );
  }

  if (isError) {
    return null;
  }

  if (isPending) {
    return (
      <View style={styles.card}>
        <Header styles={styles} />
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.honey} />
          <Text style={styles.loadingText}>
            {isWarmingUp
              ? "Warming things up — hang tight."
              : "Reading your hive notes…"}
          </Text>
        </View>
      </View>
    );
  }

  if (!data?.summary) return null;

  return (
    <View style={styles.card}>
      <Header styles={styles} />
      <Text style={styles.body}>{data.summary}</Text>
    </View>
  );
}

function Header({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.emoji}>{"\uD83D\uDCDD"}</Text>
      <Text style={styles.title}>What's Going On</Text>
    </View>
  );
}
