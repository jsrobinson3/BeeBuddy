import { useCallback, useMemo } from "react";
import { FlatList, Pressable, Switch, Text, View } from "react-native";

import { EmptyState } from "../../../components/EmptyState";
import { ErrorDisplay } from "../../../components/ErrorDisplay";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import {
  useCadences,
  useCadenceCatalog,
  useInitializeCadences,
  useUpdateCadence,
} from "../../../hooks/useCadences";
import type { Cadence, CadenceTemplate } from "../../../services/api";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../../../theme";

// ── Season labels ────────────────────────────────────────────────────────────

const SEASON_LABELS: Record<string, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
  year_round: "Year-round",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

// ── Styles ───────────────────────────────────────────────────────────────────

const createLayoutStyles = (c: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  list: {
    padding: spacing.md,
    paddingBottom: 80,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.sizes.h3,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
  },
  headerSubtitle: {
    ...typography.sizes.bodySm,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: spacing.xs,
  },
});

const createCardStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  cardTitleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.sizes.body,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
  },
  cardTitleInactive: {
    color: c.textMuted,
  },
  description: {
    ...typography.sizes.bodySm,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: spacing.xs,
  },
  descriptionInactive: {
    color: c.textMuted,
  },
  metaRow: {
    flexDirection: "row" as const,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: c.honeyPale,
  },
  badgeText: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
  dueBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: c.forestPale,
  },
  dueBadgeText: {
    ...typography.sizes.caption,
    fontFamily: typography.families.body,
    color: c.forestLight,
  },
});

const createInitStyles = (c: ThemeColors) => ({
  initButton: {
    backgroundColor: c.primaryFill,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center" as const,
    marginTop: spacing.md,
  },
  initButtonText: {
    ...typography.sizes.body,
    fontFamily: typography.families.bodySemiBold,
    color: c.textOnPrimary,
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return "No due date";
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 7) return `Due in ${diff} days`;
  return `Due ${d.toLocaleDateString()}`;
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function CadenceCard({
  cadence,
  template,
  onToggle,
}: {
  cadence: Cadence;
  template: CadenceTemplate | undefined;
  onToggle: (active: boolean) => void;
}) {
  const styles = useStyles(createCardStyles);
  const { colors } = useTheme();

  const title = template?.title ?? cadence.cadence_key;
  const description = template?.description ?? null;
  const season = template ? SEASON_LABELS[template.season] ?? template.season : null;
  const inactive = !cadence.is_active;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <Text
            style={[styles.cardTitle, inactive && styles.cardTitleInactive]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        <Switch
          value={cadence.is_active}
          onValueChange={onToggle}
          trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
          thumbColor={colors.switchThumb}
        />
      </View>
      {description && (
        <Text
          style={[styles.description, inactive && styles.descriptionInactive]}
          numberOfLines={3}
        >
          {description}
        </Text>
      )}
      <View style={styles.metaRow}>
        {season && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{season}</Text>
          </View>
        )}
        {cadence.next_due_date && cadence.is_active && (
          <View style={styles.dueBadge}>
            <Text style={styles.dueBadgeText}>{formatDueDate(cadence.next_due_date)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ListHeader() {
  const styles = useStyles(createLayoutStyles);
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Task Cadences</Text>
      <Text style={styles.headerSubtitle}>
        Manage your recurring and seasonal beekeeping reminders.
        Toggle cadences on or off to control which tasks are auto-generated.
      </Text>
    </View>
  );
}

function InitializePrompt({ onInit, loading }: { onInit: () => void; loading: boolean }) {
  const layout = useStyles(createLayoutStyles);
  const styles = useStyles(createInitStyles);
  return (
    <View style={layout.container}>
      <View style={layout.list}>
        <EmptyState
          title="No cadences set up"
          subtitle="Initialize your beekeeping task cadences to get seasonal and recurring reminders automatically."
        />
        <Pressable
          style={styles.initButton}
          onPress={onInit}
          disabled={loading}
        >
          <Text style={styles.initButtonText}>
            {loading ? "Setting up..." : "Set Up Cadences"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function CadencesScreen() {
  const { data: cadences, isLoading, error, refetch } = useCadences();
  const { data: catalog } = useCadenceCatalog();
  const initializeCadences = useInitializeCadences();
  const updateCadence = useUpdateCadence();
  const styles = useStyles(createLayoutStyles);

  const templateMap = useMemo(
    () => new Map((catalog ?? []).map((t) => [t.key, t])),
    [catalog],
  );

  const handleInit = useCallback(() => {
    initializeCadences.mutate();
  }, [initializeCadences]);

  const handleToggle = useCallback(
    (id: string, active: boolean) => {
      updateCadence.mutate({ id, data: { is_active: active } });
    },
    [updateCadence],
  );

  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorDisplay
          message={error.message ?? "Failed to load cadences"}
          onRetry={refetch}
        />
      </View>
    );
  }

  // If no cadences exist, show the initialization prompt
  if (!cadences || cadences.length === 0) {
    return (
      <InitializePrompt
        onInit={handleInit}
        loading={initializeCadences.isPending}
      />
    );
  }

  // Sort: active first, then by cadence_key
  const sorted = useMemo(
    () => [...cadences].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return a.cadence_key.localeCompare(b.cadence_key);
    }),
    [cadences],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(item: Cadence) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<ListHeader />}
        renderItem={({ item }: { item: Cadence }) => (
          <CadenceCard
            cadence={item}
            template={templateMap.get(item.cadence_key)}
            onToggle={(active) => handleToggle(item.id, active)}
          />
        )}
      />
    </View>
  );
}
