import { useState } from "react";
import { useRouter } from "expo-router";
import { Modal, Pressable, FlatList, Text, View } from "react-native";
import { Check, Plus } from "lucide-react-native";

import { DatePickerField } from "../../../components/DatePickerField";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorDisplay } from "../../../components/ErrorDisplay";
import { FormInput } from "../../../components/FormInput";
import { HexIcon } from "../../../components/HexIcon";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { useTasks, useCreateTask, useUpdateTask } from "../../../hooks/useTasks";
import type TaskModel from "../../../database/models/Task";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  shadows,
  formSubmitStyles,
  type ThemeColors,
} from "../../../theme";

// ── Styles ───────────────────────────────────────────────────────────────────

const createLayoutStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  list: { padding: 16 },
  fab: { position: "absolute" as const, right: 20, bottom: 20 },
  ...formSubmitStyles(c),
});

const createCardStyles = (c: ThemeColors) => ({
  card: {
    flexDirection: "row" as const, backgroundColor: c.bgElevated,
    borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  cardLeft: { marginRight: 12, paddingTop: 2 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontSize: 16, fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary, marginBottom: 4,
  },
  completedText: { textDecorationLine: "line-through" as const, color: c.textMuted },
  cardMeta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  dueDate: { fontSize: 13, fontFamily: typography.families.body, color: c.textSecondary },
  dueDateOverdue: { color: c.danger, fontFamily: typography.families.bodySemiBold },
  sourceBadge: {
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: radii.pill, backgroundColor: c.forestPale,
  },
  sourceBadgeText: {
    fontSize: 11, fontFamily: typography.families.bodySemiBold, color: c.forestLight,
  },
  cadencesButton: {
    flexDirection: "row" as const, alignItems: "center" as const,
    justifyContent: "center" as const, backgroundColor: c.bgElevated,
    borderRadius: 12, padding: 14, marginBottom: 16,
    shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  cadencesButtonText: {
    fontSize: 14, fontFamily: typography.families.bodySemiBold, color: c.honey,
  },
});

const createModalStyles = (c: ThemeColors) => ({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" as const },
  sheet: {
    backgroundColor: c.bgElevated, borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl, padding: spacing.md,
    paddingBottom: spacing.xl, ...shadows.card,
  },
  sheetTitle: {
    ...typography.sizes.h3, fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary, marginBottom: spacing.md,
  },
  label: {
    ...typography.sizes.bodySm, fontFamily: typography.families.bodyMedium,
    color: c.textPrimary, marginBottom: spacing.xs,
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDueLabel(dateStr: string | null): { text: string; overdue: boolean } {
  if (!dateStr) return { text: "No due date", overdue: false };
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: `Overdue by ${Math.abs(diff)}d`, overdue: true };
  if (diff === 0) return { text: "Due today", overdue: false };
  if (diff === 1) return { text: "Due tomorrow", overdue: false };
  if (diff <= 7) return { text: `Due in ${diff} days`, overdue: false };
  return { text: `Due ${d.toLocaleDateString()}`, overdue: false };
}

function isHiveInspectionTask(task: TaskModel): boolean {
  return !!task.hiveId && task.source?.toLowerCase() === "system";
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function TaskCheckbox({
  isCompleted,
  borderColor,
  onPress,
}: {
  isCompleted: boolean;
  borderColor: string;
  onPress: () => void;
}) {
  const s = useStyles(createCardStyles);
  const { colors } = useTheme();
  const boxStyle = [
    s.checkbox,
    {
      borderColor: isCompleted ? colors.success : borderColor,
      backgroundColor: isCompleted ? colors.success : "transparent",
    },
  ];
  const checkIcon = isCompleted ? <Check size={14} color={colors.bgElevated} /> : null;
  return (
    <Pressable style={s.cardLeft} onPress={onPress} hitSlop={8}>
      <View style={boxStyle}>{checkIcon}</View>
    </Pressable>
  );
}

function AutoBadge() {
  const s = useStyles(createCardStyles);
  return (
    <View style={s.sourceBadge}>
      <Text style={s.sourceBadgeText}>Auto</Text>
    </View>
  );
}

function TaskCardBody({
  task,
  due,
}: {
  task: TaskModel;
  due: { text: string; overdue: boolean };
}) {
  const s = useStyles(createCardStyles);
  const isCompleted = !!task.completedAt;
  const titleStyle = [s.cardTitle, isCompleted && s.completedText];
  const dateStyle = [s.dueDate, due.overdue && s.dueDateOverdue];
  return (
    <View style={s.cardContent}>
      <Text style={titleStyle} numberOfLines={2}>{task.title}</Text>
      <View style={s.cardMeta}>
        <Text style={dateStyle}>{due.text}</Text>
        {task.source?.toLowerCase() === "system" && <AutoBadge />}
      </View>
    </View>
  );
}

function TaskCard({
  task,
  onToggleComplete,
  onPress,
}: {
  task: TaskModel;
  onToggleComplete: () => void;
  onPress: () => void;
}) {
  const s = useStyles(createCardStyles);
  const { colors } = useTheme();
  const priorityColors: Record<string, string> = {
    urgent: colors.danger, high: colors.danger,
    medium: colors.warning, low: colors.success,
  };
  const priority = task.priority?.toLowerCase() ?? "medium";
  const borderColor = priorityColors[priority] ?? colors.textMuted;
  const due = formatDueLabel(task.dueDate);

  return (
    <Pressable style={s.card} onPress={onPress}>
      <TaskCheckbox
        isCompleted={!!task.completedAt}
        borderColor={borderColor}
        onPress={onToggleComplete}
      />
      <TaskCardBody task={task} due={due} />
    </Pressable>
  );
}

function CadencesLink() {
  const s = useStyles(createCardStyles);
  const router = useRouter();
  return (
    <Pressable
      style={s.cadencesButton}
      onPress={() => router.push("/(tasks)/cadences" as any)}
    >
      <Text style={s.cadencesButtonText}>Manage Task Cadences</Text>
    </Pressable>
  );
}

const PRIORITY_OPTIONS = ["low", "medium", "high"];

function CreateTaskModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const ms = useStyles(createModalStyles);
  const ss = useStyles(createLayoutStyles);
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");

  function handleCreate() {
    if (!title.trim()) return;
    createTask.mutate(
      {
        title: title.trim(),
        due_date: dueDate.trim() || undefined,
        priority: priority as "low" | "medium" | "high",
      },
      {
        onSuccess: () => {
          setTitle("");
          setDueDate("");
          setPriority("medium");
          onClose();
        },
      },
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable style={ms.sheet} onPress={() => {}}>
          <Text style={ms.sheetTitle}>New Task</Text>
          <FormInput label="Title" value={title} onChangeText={setTitle}
            placeholder="What needs to be done?" autoFocus />
          <FormInput label="Due Date" value={dueDate} onChangeText={setDueDate}
            placeholder="YYYY-MM-DD (optional)" />
          <Text style={ms.label}>Priority</Text>
          <SegmentedControl options={PRIORITY_OPTIONS} selected={priority} onChange={setPriority} />
          <Pressable
            style={[ss.submitButton, createTask.isPending && ss.submitDisabled]}
            onPress={handleCreate}
            disabled={createTask.isPending || !title.trim()}
          >
            <Text style={ss.submitText}>
              {createTask.isPending ? "Creating..." : "Create Task"}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function HexFab({ onPress }: { onPress: () => void }) {
  const s = useStyles(createLayoutStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={s.fab} onPress={onPress}>
      <HexIcon size={64} filled fillColor={colors.primaryFill}>
        <Plus size={28} color={colors.textOnPrimary} />
      </HexIcon>
    </Pressable>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const { data: tasks, isLoading, error, refetch } = useTasks();
  const updateTask = useUpdateTask();
  const router = useRouter();
  const s = useStyles(createLayoutStyles);
  const [modalVisible, setModalVisible] = useState(false);

  if (isLoading) return <LoadingSpinner fullscreen />;

  if (error) {
    return (
      <View style={s.container}>
        <ErrorDisplay message={error.message ?? "Failed to load tasks"} onRetry={refetch} />
      </View>
    );
  }

  function handleToggle(task: TaskModel) {
    const newCompletedAt = task.completedAt ? null : new Date().toISOString();
    updateTask.mutate({ id: task.id, data: { completed_at: newCompletedAt } });
  }

  function handlePress(task: TaskModel) {
    if (isHiveInspectionTask(task)) {
      router.push(`/inspection/new?hive_id=${task.hiveId}&task_id=${task.id}` as any);
    }
  }

  const sorted = [...(tasks ?? [])].sort((a, b) => {
    const aComplete = !!a.completedAt;
    const bComplete = !!b.completedAt;
    if (aComplete !== bComplete) return aComplete ? 1 : -1;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  return (
    <View style={s.container}>
      <FlatList
        data={sorted}
        keyExtractor={(item: TaskModel) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={<CadencesLink />}
        renderItem={({ item }: { item: TaskModel }) => (
          <TaskCard
            task={item}
            onToggleComplete={() => handleToggle(item)}
            onPress={() => handlePress(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState title="No tasks"
            subtitle="Tap + to create one, or set up cadences for recurring tasks." />
        }
      />
      <HexFab onPress={() => setModalVisible(true)} />
      <CreateTaskModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}
