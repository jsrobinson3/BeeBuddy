import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "../../../../components/Card";
import { ErrorDisplay } from "../../../../components/ErrorDisplay";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { useEvent } from "../../../../hooks/useEvents";
import type { HiveEvent } from "../../../../services/api";
import { useStyles, typography, type ThemeColors } from "../../../../theme";
import { formatDate } from "../../../../utils/format";

const createInfoStyles = (c: ThemeColors) => ({
  sectionTitle: {
    fontSize: 16,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  infoLabel: { fontSize: 14, fontFamily: typography.families.body, color: c.textSecondary },
  infoValue: { fontSize: 14, color: c.textPrimary, fontFamily: typography.families.bodyMedium },
  notesText: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textPrimary,
    lineHeight: 20,
  },
});

const createActionStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  content: { padding: 16 },
  editButton: {
    backgroundColor: c.primaryFill,
    borderRadius: 16,
    padding: 14,
    alignItems: "center" as const,
    marginBottom: 8,
  },
  editButtonText: {
    color: c.textOnPrimary,
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
  },
});

const EVENT_TYPE_LABELS: Record<string, string> = {
  swarm: "Swarm",
  split: "Split",
  combine: "Combine",
  requeen: "Requeen",
  feed: "Feed",
  winter_prep: "Winter Prep",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles(createInfoStyles);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EventDetailsCard({ event }: { event: HiveEvent }) {
  const styles = useStyles(createInfoStyles);
  return (
    <Card>
      <Text style={styles.sectionTitle}>Event Details</Text>
      <InfoRow label="Type" value={EVENT_TYPE_LABELS[event.event_type] ?? event.event_type} />
      <InfoRow label="Occurred" value={formatDate(event.occurred_at)} />
    </Card>
  );
}

function NotesCard({ notes }: { notes: string }) {
  const styles = useStyles(createInfoStyles);
  return (
    <Card>
      <Text style={styles.sectionTitle}>Notes</Text>
      <Text style={styles.notesText}>{notes}</Text>
    </Card>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: event, isLoading, error } = useEvent(id!);
  const styles = useStyles(createActionStyles);

  if (isLoading) return <LoadingSpinner fullscreen />;

  if (error || !event) {
    return (
      <View style={styles.container}>
        <ErrorDisplay message={error?.message ?? "Failed to load event"} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        style={styles.editButton}
        onPress={() => router.push(`/event/edit?id=${id}` as any)}
      >
        <Text style={styles.editButtonText}>Edit Event</Text>
      </Pressable>
      <EventDetailsCard event={event} />
      {event.notes && <NotesCard notes={event.notes} />}
    </ScrollView>
  );
}
