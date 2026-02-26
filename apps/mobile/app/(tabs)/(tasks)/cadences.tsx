import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Switch, Text, TextInput, View } from "react-native";

import { ErrorDisplay } from "../../../components/ErrorDisplay";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import {
  useCadences,
  useCadenceCatalog,
  useGenerateCadenceTasks,
  useUpdateCadence,
} from "../../../hooks/useCadences";
import { useHives } from "../../../hooks/useHives";
import type TaskCadence from "../../../database/models/TaskCadence";
import type { CadenceTemplate } from "../../../services/api";
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

// ── Styles ───────────────────────────────────────────────────────────────────

const createLayoutStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  list: { padding: spacing.md, paddingBottom: 80 },
  header: { marginBottom: spacing.md },
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

const badgePad = { paddingHorizontal: spacing.sm + 2, paddingVertical: 2, borderRadius: radii.pill };

const createCardStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.bgElevated, borderRadius: radii.xl,
    padding: spacing.md, marginBottom: spacing.sm + 4, ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  cardTitleWrap: { flex: 1, marginRight: spacing.sm },
  cardTitle: {
    ...typography.sizes.body,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
  },
  cardTitleInactive: { color: c.textMuted },
  description: {
    ...typography.sizes.bodySm, fontFamily: typography.families.body,
    color: c.textSecondary, marginTop: spacing.xs,
  },
  descriptionInactive: { color: c.textMuted },
  metaRow: { flexDirection: "row" as const, marginTop: spacing.sm, gap: spacing.sm },
  badge: { ...badgePad, backgroundColor: c.honeyPale },
  badgeText: { ...typography.sizes.caption, fontFamily: typography.families.bodySemiBold, color: c.honey },
  dueBadge: { ...badgePad, backgroundColor: c.forestPale },
  dueBadgeText: { ...typography.sizes.caption, fontFamily: typography.families.body, color: c.forestLight },
  hiveBadge: { ...badgePad, backgroundColor: c.bgInputSoft },
  hiveBadgeText: { ...typography.sizes.caption, fontFamily: typography.families.bodySemiBold, color: c.textSecondary },
  sectionHeader: {
    ...typography.sizes.body,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});

const createEditStyles = (c: ThemeColors) => ({
  expandedArea: {
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: c.borderLight,
  },
  scheduleLabel: {
    ...typography.sizes.caption, color: c.textSecondary,
    fontFamily: typography.families.bodySemiBold, marginBottom: spacing.xs,
  },
  scheduleRow: {
    flexDirection: "row" as const, alignItems: "center" as const,
    gap: spacing.sm, marginBottom: spacing.sm,
  },
  scheduleInput: {
    flex: 1, backgroundColor: c.bgInputSoft, borderRadius: radii.lg,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    ...typography.sizes.bodySm, color: c.textPrimary,
    fontFamily: typography.families.body,
  },
  scheduleUnit: {
    ...typography.sizes.bodySm, color: c.textSecondary,
    fontFamily: typography.families.body,
  },
  saveButton: {
    backgroundColor: c.primaryFill, borderRadius: radii.lg,
    paddingVertical: spacing.xs + 2, alignItems: "center" as const,
  },
  saveButtonText: {
    ...typography.sizes.bodySm, color: c.textOnPrimary,
    fontFamily: typography.families.bodySemiBold,
  },
  scheduleInfo: {
    ...typography.sizes.caption, color: c.textMuted,
    fontFamily: typography.families.body, marginTop: spacing.xs,
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

function formatSchedule(cadence: TaskCadence, template: CadenceTemplate | undefined): string | null {
  if (!template) return null;
  if (template.category === "recurring") {
    const days = cadence.customIntervalDays ?? template.interval_days;
    return days ? `Every ${days} days` : null;
  }
  if (template.category === "seasonal") {
    const month = cadence.customSeasonMonth ?? template.season_month;
    const day = cadence.customSeasonDay ?? template.season_day;
    if (month) {
      const monthName = new Date(2000, month - 1).toLocaleString("default", { month: "long" });
      return `${monthName} ${day}`;
    }
  }
  return null;
}

function ScheduleEditor({
  cadence,
  template,
  onSave,
}: {
  cadence: TaskCadence;
  template: CadenceTemplate | undefined;
  onSave: (data: {
    custom_interval_days?: number | null;
    custom_season_month?: number | null;
    custom_season_day?: number | null;
  }) => void;
}) {
  const styles = useStyles(createEditStyles);
  const isRecurring = template?.category === "recurring";

  const [interval, setInterval] = useState(
    String(cadence.customIntervalDays ?? template?.interval_days ?? ""),
  );
  const [month, setMonth] = useState(
    String(cadence.customSeasonMonth ?? template?.season_month ?? ""),
  );
  const [day, setDay] = useState(
    String(cadence.customSeasonDay ?? template?.season_day ?? "1"),
  );

  function handleSave() {
    if (isRecurring) {
      const val = parseInt(interval, 10);
      onSave({ custom_interval_days: isNaN(val) ? null : val });
    } else {
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      onSave({
        custom_season_month: isNaN(m) ? null : m,
        custom_season_day: isNaN(d) ? null : d,
      });
    }
  }

  return (
    <View style={styles.expandedArea}>
      <Text style={styles.scheduleLabel}>
        {isRecurring ? "Custom Interval" : "Custom Date"}
      </Text>
      {isRecurring ? (
        <View style={styles.scheduleRow}>
          <TextInput
            style={styles.scheduleInput}
            value={interval}
            onChangeText={setInterval}
            keyboardType="number-pad"
            placeholder="days"
          />
          <Text style={styles.scheduleUnit}>days</Text>
        </View>
      ) : (
        <View style={styles.scheduleRow}>
          <TextInput
            style={styles.scheduleInput}
            value={month}
            onChangeText={setMonth}
            keyboardType="number-pad"
            placeholder="Month (1-12)"
          />
          <TextInput
            style={styles.scheduleInput}
            value={day}
            onChangeText={setDay}
            keyboardType="number-pad"
            placeholder="Day"
          />
        </View>
      )}
      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Schedule</Text>
      </Pressable>
    </View>
  );
}

function CardMeta({
  cadence,
  template,
  hiveName,
}: {
  cadence: TaskCadence;
  template: CadenceTemplate | undefined;
  hiveName: string | null;
}) {
  const styles = useStyles(createCardStyles);
  const editStyles = useStyles(createEditStyles);
  const season = template ? SEASON_LABELS[template.season] ?? template.season : null;
  const schedule = formatSchedule(cadence, template);

  return (
    <>
      <View style={styles.metaRow}>
        {hiveName && (
          <View style={styles.hiveBadge}>
            <Text style={styles.hiveBadgeText}>{hiveName}</Text>
          </View>
        )}
        {season && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{season}</Text>
          </View>
        )}
        {cadence.nextDueDate && cadence.isActive && (
          <View style={styles.dueBadge}>
            <Text style={styles.dueBadgeText}>{formatDueDate(cadence.nextDueDate)}</Text>
          </View>
        )}
      </View>
      {schedule && <Text style={editStyles.scheduleInfo}>{schedule}</Text>}
    </>
  );
}

function CadenceCard({
  cadence,
  template,
  hiveName,
  onToggle,
  isExpanded,
  onPress,
  onSaveSchedule,
}: {
  cadence: TaskCadence;
  template: CadenceTemplate | undefined;
  hiveName: string | null;
  onToggle: (active: boolean) => void;
  isExpanded: boolean;
  onPress: () => void;
  onSaveSchedule: (data: { custom_interval_days?: number | null; custom_season_month?: number | null; custom_season_day?: number | null }) => void;
}) {
  const styles = useStyles(createCardStyles);
  const { colors } = useTheme();

  const title = template?.title ?? cadence.cadenceKey;
  const description = template?.description ?? null;
  const inactive = !cadence.isActive;

  return (
    <Pressable style={styles.card} onPress={onPress}>
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
          value={cadence.isActive}
          onValueChange={onToggle}
          trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
          thumbColor={colors.switchThumb}
        />
      </View>
      {description && (
        <Text
          style={[styles.description, inactive && styles.descriptionInactive]}
          numberOfLines={isExpanded ? undefined : 3}
        >
          {description}
        </Text>
      )}
      <CardMeta cadence={cadence} template={template} hiveName={hiveName} />
      {isExpanded && (
        <ScheduleEditor cadence={cadence} template={template} onSave={onSaveSchedule} />
      )}
    </Pressable>
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

// ── Main Screen ──────────────────────────────────────────────────────────────

type SectionItem =
  | { type: "header"; title: string }
  | { type: "cadence"; cadence: TaskCadence; hiveName: string | null };

export default function CadencesScreen() {
  const { data: cadences, isLoading, error, refetch } = useCadences();
  const { data: catalog } = useCadenceCatalog();
  const { data: hives } = useHives();
  const updateCadence = useUpdateCadence();
  const styles = useStyles(createLayoutStyles);
  const cardStyles = useStyles(createCardStyles);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const templateMap = useMemo(
    () => new Map<string, CadenceTemplate>((catalog ?? []).map((t: CadenceTemplate) => [t.key, t])),
    [catalog],
  );

  const hiveMap = useMemo(
    () => new Map<string, string>((hives ?? []).map((h: { id: string; name: string }) => [h.id, h.name])),
    [hives],
  );

  // Auto-initialize cadences + generate tasks if none exist (runs once).
  // Uses useGenerateCadenceTasks (POST /cadences/generate) which also
  // ensures hive-scoped cadences are created for sync-created hives.
  const generateTasks = useGenerateCadenceTasks();
  const didAutoInit = useRef(false);
  useEffect(() => {
    if (!isLoading && cadences && cadences.length === 0 && !didAutoInit.current) {
      didAutoInit.current = true;
      generateTasks.mutate();
    }
  }, [isLoading, cadences, generateTasks]);

  const handleToggle = useCallback(
    (id: string, active: boolean) => {
      updateCadence.mutate({ id, data: { is_active: active } });
    },
    [updateCadence],
  );

  const handleSaveSchedule = useCallback(
    (id: string, data: { custom_interval_days?: number | null; custom_season_month?: number | null; custom_season_day?: number | null }) => {
      updateCadence.mutate({ id, data });
      setExpandedId(null);
    },
    [updateCadence],
  );

  const sections = useMemo(() => {
    const items = [...(cadences ?? [])].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.cadenceKey.localeCompare(b.cadenceKey);
    });
    const general = items.filter((c) => !c.hiveId);
    const perHive = items.filter((c) => !!c.hiveId);
    const result: SectionItem[] = [];
    if (general.length > 0) {
      result.push({ type: "header", title: "General" });
      general.forEach((c) => result.push({ type: "cadence", cadence: c, hiveName: null }));
    }
    if (perHive.length > 0) {
      result.push({ type: "header", title: "Per-Hive" });
      perHive.forEach((c) =>
        result.push({ type: "cadence", cadence: c, hiveName: hiveMap.get(c.hiveId!) ?? "Unknown" }),
      );
    }
    return result;
  }, [cadences, hiveMap]);

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

  if (!cadences || cadences.length === 0) {
    return <LoadingSpinner fullscreen />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sections}
        keyExtractor={(item, index) =>
          item.type === "header" ? `header-${item.title}` : item.cadence.id
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={<ListHeader />}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return <Text style={cardStyles.sectionHeader}>{item.title}</Text>;
          }
          const { cadence, hiveName } = item;
          return (
            <CadenceCard
              cadence={cadence}
              template={templateMap.get(cadence.cadenceKey)}
              hiveName={hiveName}
              onToggle={(active) => handleToggle(cadence.id, active)}
              isExpanded={expandedId === cadence.id}
              onPress={() => setExpandedId(expandedId === cadence.id ? null : cadence.id)}
              onSaveSchedule={(data) => handleSaveSchedule(cadence.id, data)}
            />
          );
        }}
      />
    </View>
  );
}
