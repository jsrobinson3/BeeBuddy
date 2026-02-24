import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "../../../../components/Card";
import { ErrorDisplay } from "../../../../components/ErrorDisplay";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { useTreatment } from "../../../../hooks/useTreatments";
import type { Treatment } from "../../../../services/api";
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

function TreatmentDetailsCard({ treatment }: { treatment: Treatment }) {
  const styles = useStyles(createInfoStyles);
  return (
    <Card>
      <Text style={styles.sectionTitle}>Treatment Details</Text>
      <InfoRow label="Type" value={treatment.treatment_type} />
      {treatment.product_name && <InfoRow label="Product" value={treatment.product_name} />}
      {treatment.method && <InfoRow label="Method" value={treatment.method} />}
      {treatment.dosage && <InfoRow label="Dosage" value={treatment.dosage} />}
      <InfoRow label="Started" value={formatDate(treatment.started_at)} />
      {treatment.ended_at && <InfoRow label="Ended" value={formatDate(treatment.ended_at)} />}
      {treatment.follow_up_date && <InfoRow label="Follow-up" value={formatDate(treatment.follow_up_date)} />}
    </Card>
  );
}

function EffectivenessCard({ notes }: { notes: string }) {
  const styles = useStyles(createInfoStyles);
  return (
    <Card>
      <Text style={styles.sectionTitle}>Effectiveness Notes</Text>
      <Text style={styles.notesText}>{notes}</Text>
    </Card>
  );
}

export default function TreatmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: treatment, isLoading, error } = useTreatment(id!);
  const styles = useStyles(createActionStyles);

  if (isLoading) return <LoadingSpinner fullscreen />;

  if (error || !treatment) {
    return (
      <View style={styles.container}>
        <ErrorDisplay message={error?.message ?? "Failed to load treatment"} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        style={styles.editButton}
        onPress={() => router.push(`/treatment/edit?id=${id}` as any)}
      >
        <Text style={styles.editButtonText}>Edit Treatment</Text>
      </Pressable>
      <TreatmentDetailsCard treatment={treatment} />
      {treatment.effectiveness_notes && (
        <EffectivenessCard notes={treatment.effectiveness_notes} />
      )}
    </ScrollView>
  );
}
