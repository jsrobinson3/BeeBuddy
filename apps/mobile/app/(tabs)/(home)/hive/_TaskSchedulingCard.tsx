import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Card } from "../../../../components/Card";
import type TaskCadence from "../../../../database/models/TaskCadence";
import type { CadenceTemplate } from "../../../../services/api";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  type ThemeColors,
} from "../../../../theme";

// ── Styles ──────────────────────────────────────────────────────────────────

const createCadenceStyles = (c: ThemeColors) => ({
  title: {
    fontSize: 16,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginBottom: 12,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  rowHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  info: { flex: 1, marginRight: spacing.sm },
  cadenceTitle: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
  cadenceTitleInactive: { color: c.textMuted },
  schedule: {
    fontSize: 12,
    fontFamily: typography.families.body,
    color: c.textMuted,
    marginTop: 2,
  },
  empty: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textMuted,
    fontStyle: "italic" as const,
  },
});

const createEditStyles = (c: ThemeColors) => ({
  editor: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
  },
  label: {
    fontSize: 11,
    fontFamily: typography.families.bodySemiBold,
    color: c.textSecondary,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    fontSize: 13,
    color: c.textPrimary,
    fontFamily: typography.families.body,
  },
  unit: {
    fontSize: 13,
    color: c.textSecondary,
    fontFamily: typography.families.body,
  },
  saveButton: {
    backgroundColor: c.primaryFill,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs + 2,
    alignItems: "center" as const,
    marginTop: spacing.sm,
  },
  saveText: {
    fontSize: 13,
    color: c.textOnPrimary,
    fontFamily: typography.families.bodySemiBold,
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDueDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 0) return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 7) return `Due in ${diff} days`;
  return `Due ${d.toLocaleDateString()}`;
}

// ── Inline editor ──────────────────────────────────────────────────────────

function IntervalEditor({
  cadence,
  template,
  onSave,
}: {
  cadence: TaskCadence;
  template: CadenceTemplate | undefined;
  onSave: (data: { custom_interval_days?: number | null }) => void;
}) {
  const es = useStyles(createEditStyles);
  const defaultDays = cadence.customIntervalDays ?? template?.interval_days ?? "";
  const [value, setValue] = useState(String(defaultDays));

  function handleSave() {
    const parsed = parseInt(value, 10);
    onSave({ custom_interval_days: isNaN(parsed) || parsed < 1 ? null : parsed });
  }

  return (
    <View style={es.editor}>
      <Text style={es.label}>Custom Interval</Text>
      <View style={es.inputRow}>
        <TextInput
          style={es.input}
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          placeholder="days"
          selectTextOnFocus
        />
        <Text style={es.unit}>days</Text>
      </View>
      <Pressable style={es.saveButton} onPress={handleSave}>
        <Text style={es.saveText}>Save</Text>
      </Pressable>
    </View>
  );
}

// ── Cadence row ─────────────────────────────────────────────────────────────

function CadenceToggleRow({
  cadence,
  template,
  onToggle,
  isExpanded,
  onPress,
  onSaveSchedule,
}: {
  cadence: TaskCadence;
  template: CadenceTemplate | undefined;
  onToggle: (active: boolean) => void;
  isExpanded: boolean;
  onPress: () => void;
  onSaveSchedule: (data: { custom_interval_days?: number | null }) => void;
}) {
  const styles = useStyles(createCadenceStyles);
  const { colors } = useTheme();
  const title = template?.title ?? cadence.cadenceKey;
  const days = cadence.customIntervalDays ?? template?.interval_days;
  const schedule = days ? `Every ${days} days` : null;
  const due = cadence.isActive ? formatDueDate(cadence.nextDueDate) : null;
  const inactive = !cadence.isActive;
  const isRecurring = template?.category === "recurring";

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowHeader}>
        <View style={styles.info}>
          <Text
            style={[
              styles.cadenceTitle,
              inactive && styles.cadenceTitleInactive,
            ]}
          >
            {title}
          </Text>
          {schedule && <Text style={styles.schedule}>{schedule}</Text>}
          {due && <Text style={styles.schedule}>{due}</Text>}
        </View>
        <Switch
          value={cadence.isActive}
          onValueChange={onToggle}
          trackColor={{
            false: colors.switchTrackFalse,
            true: colors.switchTrackTrue,
          }}
          thumbColor={colors.switchThumb}
        />
      </View>
      {isExpanded && isRecurring && (
        <IntervalEditor
          cadence={cadence}
          template={template}
          onSave={onSaveSchedule}
        />
      )}
    </Pressable>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function TaskSchedulingCard({
  cadences,
  catalog,
  onToggle,
  onSaveSchedule,
}: {
  cadences: TaskCadence[] | undefined;
  catalog: CadenceTemplate[] | undefined;
  onToggle: (id: string, active: boolean) => void;
  onSaveSchedule: (id: string, data: { custom_interval_days?: number | null }) => void;
}) {
  const styles = useStyles(createCadenceStyles);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const templateMap = useMemo(
    () =>
      new Map(
        (catalog ?? []).map((t: CadenceTemplate) => [t.key, t]),
      ),
    [catalog],
  );

  if (!cadences || cadences.length === 0) {
    return (
      <Card>
        <Text style={styles.title}>Task Scheduling</Text>
        <Text style={styles.empty}>
          No scheduled tasks for this hive yet.
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.title}>Task Scheduling</Text>
      {cadences.map((c) => (
        <CadenceToggleRow
          key={c.id}
          cadence={c}
          template={templateMap.get(c.cadenceKey)}
          onToggle={(active) => onToggle(c.id, active)}
          isExpanded={expandedId === c.id}
          onPress={() => setExpandedId(expandedId === c.id ? null : c.id)}
          onSaveSchedule={(data) => {
            onSaveSchedule(c.id, data);
            setExpandedId(null);
          }}
        />
      ))}
    </Card>
  );
}
