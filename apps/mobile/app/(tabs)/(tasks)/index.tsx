import { useRouter } from "expo-router";
import { Pressable, FlatList, Text, View } from "react-native";

import { EmptyState } from "../../../components/EmptyState";
import { ErrorDisplay } from "../../../components/ErrorDisplay";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useTasks, useUpdateTask } from "../../../hooks/useTasks";
import type { Task } from "../../../services/api";
import { useStyles, useTheme, typography, type ThemeColors } from "../../../theme";
import { formatDate } from "../../../utils/format";

const createStyles = (c: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: "row" as const,
    backgroundColor: c.bgElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardLeft: {
    marginRight: 12,
    paddingTop: 4,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: "line-through" as const,
    color: c.textMuted,
  },
  cardMeta: {
    flexDirection: "row" as const,
  },
  dueDate: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textSecondary,
  },
  cadencesButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: c.bgElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cadencesButtonText: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
});

function TaskCard({
  task,
  onToggleComplete,
}: {
  task: Task;
  onToggleComplete: () => void;
}) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();

  const priorityColors: Record<string, string> = {
    urgent: colors.danger,
    high: colors.danger,
    medium: colors.warning,
    low: colors.success,
  };

  const isCompleted = !!task.completed_at;
  return (
    <Pressable style={styles.card} onPress={onToggleComplete}>
      <View style={styles.cardLeft}>
        <View
          style={[
            styles.priorityDot,
            { backgroundColor: priorityColors[task.priority] ?? colors.textMuted },
          ]}
        />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, isCompleted && styles.completedText]}>
          {task.title}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={styles.dueDate}>{formatDate(task.due_date)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CadencesLink() {
  const styles = useStyles(createStyles);
  const router = useRouter();
  return (
    <Pressable
      style={styles.cadencesButton}
      onPress={() => router.push("/(tasks)/cadences" as any)}
    >
      <Text style={styles.cadencesButtonText}>Manage Task Cadences</Text>
    </Pressable>
  );
}

export default function TasksScreen() {
  const { data: tasks, isLoading, error, refetch } = useTasks();
  const updateTask = useUpdateTask();
  const styles = useStyles(createStyles);

  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorDisplay
          message={error.message ?? "Failed to load tasks"}
          onRetry={refetch}
        />
      </View>
    );
  }

  function handleToggle(task: Task) {
    const newCompletedAt = task.completed_at ? null : new Date().toISOString();
    updateTask.mutate({
      id: task.id,
      data: { completed_at: newCompletedAt },
    });
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks ?? []}
        keyExtractor={(item: Task) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<CadencesLink />}
        renderItem={({ item }: { item: Task }) => (
          <TaskCard task={item} onToggleComplete={() => handleToggle(item)} />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No tasks"
            subtitle="You're all caught up!"
          />
        }
      />
    </View>
  );
}
