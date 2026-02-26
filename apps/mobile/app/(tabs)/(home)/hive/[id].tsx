import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "../../../../components/Card";
import { ErrorDisplay } from "../../../../components/ErrorDisplay";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import {
  useCadences,
  useCadenceCatalog,
  useUpdateCadence,
} from "../../../../hooks/useCadences";
import { useHive } from "../../../../hooks/useHives";
import { useQueens } from "../../../../hooks/useQueens";
import { useInspections } from "../../../../hooks/useInspections";
import { useTreatments } from "../../../../hooks/useTreatments";
import { useEvents } from "../../../../hooks/useEvents";
import { useHarvests } from "../../../../hooks/useHarvests";
import { useUnits } from "../../../../hooks/useUnits";
import type {
  Inspection,
  Queen,
  Treatment,
  HiveEvent,
  Harvest,
} from "../../../../services/api";
import {
  useStyles,
  typography,
  radii,
  type ThemeColors,
} from "../../../../theme";
import { formatDate } from "../../../../utils/format";
import { TaskSchedulingCard } from "./_TaskSchedulingCard";

// ── Layout styles ───────────────────────────────────────────────────────────

const createLayoutStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  content: { padding: 16 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 12,
  },
  editButton: {
    backgroundColor: c.primaryFill,
    borderRadius: radii.xl,
    padding: 14,
    alignItems: "center" as const,
    marginBottom: 8,
  },
  editButtonText: {
    color: c.textOnPrimary,
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: c.selectedBg,
    borderWidth: 1,
    borderColor: c.primaryFill,
  },
  addButtonText: {
    fontSize: 13,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
});

// ── Info & list styles ──────────────────────────────────────────────────────

const createInfoStyles = (c: ThemeColors) => ({
  infoRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: c.textPrimary,
    fontFamily: typography.families.bodyMedium,
  },
  noData: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textMuted,
    fontStyle: "italic" as const,
  },
});

const createListStyles = (c: ThemeColors) => ({
  listItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  listDate: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
  listDetail: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 2,
  },
  listNotes: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textMuted,
    marginTop: 2,
  },
});

// ── Subcomponents ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles(createInfoStyles);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InspectionItem({
  inspection,
  onPress,
}: {
  inspection: Inspection;
  onPress: () => void;
}) {
  const styles = useStyles(createListStyles);
  return (
    <Pressable style={styles.listItem} onPress={onPress}>
      <Text style={styles.listDate}>
        {formatDate(inspection.inspected_at)}
      </Text>
      {inspection.impression != null && (
        <Text style={styles.listDetail}>
          Impression: {inspection.impression}/5
        </Text>
      )}
      {inspection.notes && (
        <Text style={styles.listNotes} numberOfLines={2}>
          {inspection.notes}
        </Text>
      )}
    </Pressable>
  );
}

function TreatmentItem({
  treatment,
  onPress,
}: {
  treatment: Treatment;
  onPress: () => void;
}) {
  const styles = useStyles(createListStyles);
  return (
    <Pressable style={styles.listItem} onPress={onPress}>
      <Text style={styles.listDate}>{treatment.treatment_type}</Text>
      {treatment.product_name && (
        <Text style={styles.listDetail}>
          {treatment.product_name}
        </Text>
      )}
      <Text style={styles.listNotes}>
        {formatDate(treatment.started_at)}
        {treatment.ended_at
          ? ` - ${formatDate(treatment.ended_at)}`
          : ""}
      </Text>
    </Pressable>
  );
}

function EventItem({
  event,
  onPress,
}: {
  event: HiveEvent;
  onPress: () => void;
}) {
  const styles = useStyles(createListStyles);
  return (
    <Pressable style={styles.listItem} onPress={onPress}>
      <Text style={styles.listDate}>{event.event_type}</Text>
      <Text style={styles.listDetail}>
        {formatDate(event.occurred_at)}
      </Text>
      {event.notes && (
        <Text style={styles.listNotes} numberOfLines={2}>
          {event.notes}
        </Text>
      )}
    </Pressable>
  );
}

function HarvestItem({
  harvest,
  toDisplayWeight,
  weightLabel,
  onPress,
}: {
  harvest: Harvest;
  toDisplayWeight: (kg: number) => number;
  weightLabel: string;
  onPress: () => void;
}) {
  const styles = useStyles(createListStyles);
  return (
    <Pressable style={styles.listItem} onPress={onPress}>
      <Text style={styles.listDate}>
        {formatDate(harvest.harvested_at)}
      </Text>
      {harvest.weight_kg != null && (
        <Text style={styles.listDetail}>
          {toDisplayWeight(harvest.weight_kg)} {weightLabel}
        </Text>
      )}
      {harvest.honey_type && (
        <Text style={styles.listNotes}>{harvest.honey_type}</Text>
      )}
    </Pressable>
  );
}

function SectionHeader({
  title,
  onAdd,
}: {
  title: string;
  onAdd?: () => void;
}) {
  const layout = useStyles(createLayoutStyles);
  return (
    <View style={layout.sectionHeader}>
      <Text style={layout.sectionTitle}>{title}</Text>
      {onAdd && (
        <Pressable style={layout.addButton} onPress={onAdd}>
          <Text style={layout.addButtonText}>+ Add</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function HiveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    data: hive,
    isLoading: hiveLoading,
    error: hiveError,
  } = useHive(id!);
  const { data: queens, isLoading: queensLoading } = useQueens(id);
  const {
    data: inspections,
    isLoading: inspectionsLoading,
  } = useInspections(id);
  const {
    data: treatments,
    isLoading: treatmentsLoading,
  } = useTreatments(id);
  const { data: events, isLoading: eventsLoading } = useEvents(id);
  const {
    data: harvests,
    isLoading: harvestsLoading,
  } = useHarvests(id);
  const { data: cadences } = useCadences(id);
  const { data: catalog } = useCadenceCatalog();
  const updateCadence = useUpdateCadence();
  const units = useUnits();
  const layout = useStyles(createLayoutStyles);
  const info = useStyles(createInfoStyles);

  const handleToggle = useCallback(
    (cadenceId: string, active: boolean) => {
      updateCadence.mutate({
        id: cadenceId,
        data: { is_active: active },
      });
    },
    [updateCadence],
  );

  const handleSaveSchedule = useCallback(
    (cadenceId: string, data: { custom_interval_days?: number | null }) => {
      updateCadence.mutate({ id: cadenceId, data });
    },
    [updateCadence],
  );

  const isLoading =
    hiveLoading ||
    queensLoading ||
    inspectionsLoading ||
    treatmentsLoading ||
    eventsLoading ||
    harvestsLoading;

  if (isLoading) return <LoadingSpinner fullscreen />;

  if (hiveError) {
    return (
      <View style={layout.container}>
        <ErrorDisplay
          message={hiveError.message ?? "Failed to load hive"}
        />
      </View>
    );
  }

  const queen = queens?.[0] as Queen | undefined;
  const recentInspections = (inspections ?? []).slice(0, 5);
  const recentTreatments = (treatments ?? []).slice(0, 5);
  const recentEvents = (events ?? []).slice(0, 5);
  const recentHarvests = (harvests ?? []).slice(0, 5);

  return (
    <ScrollView
      style={layout.container}
      contentContainerStyle={layout.content}
    >
      <Pressable
        style={layout.editButton}
        onPress={() => router.push(`/hive/edit?id=${id}` as any)}
      >
        <Text style={layout.editButtonText}>Edit Hive</Text>
      </Pressable>

      <Card>
        <Text style={layout.sectionTitle}>Hive Info</Text>
        <InfoRow label="Type" value={hive?.hive_type ?? "N/A"} />
        <InfoRow label="Status" value={hive?.status ?? "N/A"} />
        <InfoRow label="Source" value={hive?.source ?? "N/A"} />
        <InfoRow
          label="Installed"
          value={formatDate(hive?.installation_date)}
        />
      </Card>

      <TaskSchedulingCard
        cadences={cadences}
        catalog={catalog}
        onToggle={handleToggle}
        onSaveSchedule={handleSaveSchedule}
      />

      <Card>
        <SectionHeader
          title="Queen"
          onAdd={
            !queen
              ? () => router.push(`/queen/new?hive_id=${id}` as any)
              : undefined
          }
        />
        {queen ? (
          <>
            <InfoRow
              label="Marking Color"
              value={queen.marking_color ?? "None"}
            />
            <InfoRow label="Status" value={queen.status ?? "N/A"} />
            <InfoRow label="Race" value={queen.race ?? "N/A"} />
          </>
        ) : (
          <Text style={info.noData}>No queen recorded</Text>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Recent Inspections"
          onAdd={() =>
            router.push(`/inspection/new?hive_id=${id}` as any)
          }
        />
        {recentInspections.length > 0 ? (
          recentInspections.map((item: Inspection) => (
            <InspectionItem
              key={item.id}
              inspection={item}
              onPress={() =>
                router.push(`/inspection/${item.id}` as any)
              }
            />
          ))
        ) : (
          <Text style={info.noData}>No inspections yet</Text>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Recent Treatments"
          onAdd={() =>
            router.push(`/treatment/new?hive_id=${id}` as any)
          }
        />
        {recentTreatments.length > 0 ? (
          recentTreatments.map((item: Treatment) => (
            <TreatmentItem
              key={item.id}
              treatment={item}
              onPress={() =>
                router.push(`/treatment/${item.id}` as any)
              }
            />
          ))
        ) : (
          <Text style={info.noData}>No treatments recorded</Text>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Recent Harvests"
          onAdd={() =>
            router.push(`/harvest/new?hive_id=${id}` as any)
          }
        />
        {recentHarvests.length > 0 ? (
          recentHarvests.map((item: Harvest) => (
            <HarvestItem
              key={item.id}
              harvest={item}
              toDisplayWeight={units.toDisplayWeight}
              weightLabel={units.weightLabel}
              onPress={() =>
                router.push(`/harvest/${item.id}` as any)
              }
            />
          ))
        ) : (
          <Text style={info.noData}>No harvests recorded</Text>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Recent Events"
          onAdd={() =>
            router.push(`/event/new?hive_id=${id}` as any)
          }
        />
        {recentEvents.length > 0 ? (
          recentEvents.map((item: HiveEvent) => (
            <EventItem
              key={item.id}
              event={item}
              onPress={() =>
                router.push(`/event/${item.id}` as any)
              }
            />
          ))
        ) : (
          <Text style={info.noData}>No events recorded</Text>
        )}
      </Card>
    </ScrollView>
  );
}
