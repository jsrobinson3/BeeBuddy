import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "../../../../components/Card";
import { ErrorDisplay } from "../../../../components/ErrorDisplay";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { useHarvest } from "../../../../hooks/useHarvests";
import { useUnits } from "../../../../hooks/useUnits";
import type { Harvest } from "../../../../services/api";
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

function InfoRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles(createInfoStyles);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function HarvestDetailsCard({
  harvest,
  toDisplayWeight,
  weightLabel,
}: {
  harvest: Harvest;
  toDisplayWeight: (kg: number) => number;
  weightLabel: string;
}) {
  const styles = useStyles(createInfoStyles);
  return (
    <Card>
      <Text style={styles.sectionTitle}>Harvest Details</Text>
      <InfoRow label="Date" value={formatDate(harvest.harvested_at)} />
      {harvest.weight_kg != null && (
        <InfoRow label="Weight" value={`${toDisplayWeight(harvest.weight_kg)} ${weightLabel}`} />
      )}
      {harvest.moisture_percent != null && (
        <InfoRow label="Moisture" value={`${harvest.moisture_percent}%`} />
      )}
      {harvest.honey_type && <InfoRow label="Type" value={harvest.honey_type} />}
      {harvest.color && <InfoRow label="Color" value={harvest.color} />}
      {harvest.frames_harvested != null && (
        <InfoRow label="Frames" value={String(harvest.frames_harvested)} />
      )}
    </Card>
  );
}

function TextCard({ title, text }: { title: string; text: string }) {
  const styles = useStyles(createInfoStyles);
  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.notesText}>{text}</Text>
    </Card>
  );
}

export default function HarvestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: harvest, isLoading, error } = useHarvest(id!);
  const { toDisplayWeight, weightLabel } = useUnits();
  const styles = useStyles(createActionStyles);

  if (isLoading) return <LoadingSpinner fullscreen />;

  if (error || !harvest) {
    return (
      <View style={styles.container}>
        <ErrorDisplay message={error?.message ?? "Failed to load harvest"} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        style={styles.editButton}
        onPress={() => router.push(`/harvest/edit?id=${id}` as any)}
      >
        <Text style={styles.editButtonText}>Edit Harvest</Text>
      </Pressable>
      <HarvestDetailsCard
        harvest={harvest}
        toDisplayWeight={toDisplayWeight}
        weightLabel={weightLabel}
      />
      {harvest.flavor_notes && <TextCard title="Flavor Notes" text={harvest.flavor_notes} />}
      {harvest.notes && <TextCard title="Notes" text={harvest.notes} />}
    </ScrollView>
  );
}
