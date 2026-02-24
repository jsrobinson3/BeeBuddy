import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "../../../../components/Card";
import { ErrorDisplay } from "../../../../components/ErrorDisplay";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { PhotoPicker } from "../../../../components/PhotoPicker";
import { useInspection } from "../../../../hooks/useInspections";
import type {
  Inspection,
  InspectionObservations,
} from "../../../../services/api";
import { useStyles, typography, type ThemeColors } from "../../../../theme";
import { formatDate } from "../../../../utils/format";

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  content: { padding: 16 },
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
  editButton: {
    backgroundColor: c.primaryFill,
    borderRadius: 8,
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
  const styles = useStyles(createStyles);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function BasicObservationRows({ obs }: { obs: InspectionObservations }) {
  return (
    <>
      {obs.queen_seen != null && (
        <InfoRow label="Queen Spotted" value={obs.queen_seen ? "Yes" : "No"} />
      )}
      {obs.eggs_seen != null && (
        <InfoRow label="Eggs Spotted" value={obs.eggs_seen ? "Yes" : "No"} />
      )}
      {obs.larvae_seen != null && (
        <InfoRow label="Larvae Spotted" value={obs.larvae_seen ? "Yes" : "No"} />
      )}
      {obs.capped_brood != null && (
        <InfoRow label="Capped Brood" value={obs.capped_brood ? "Yes" : "No"} />
      )}
      {obs.population_estimate && (
        <InfoRow label="Population" value={obs.population_estimate} />
      )}
      {obs.temperament && <InfoRow label="Temperament" value={obs.temperament} />}
      {obs.honey_stores && <InfoRow label="Honey Stores" value={obs.honey_stores} />}
      {obs.pollen_stores && <InfoRow label="Pollen Stores" value={obs.pollen_stores} />}
    </>
  );
}

function DetailedObservationRows({ obs }: { obs: InspectionObservations }) {
  return (
    <>
      {obs.brood_pattern_score != null && (
        <InfoRow label="Brood Pattern" value={`${obs.brood_pattern_score}/5`} />
      )}
      {obs.frames_of_bees != null && (
        <InfoRow label="Frames of Bees" value={String(obs.frames_of_bees)} />
      )}
      {obs.frames_of_brood != null && (
        <InfoRow label="Frames of Brood" value={String(obs.frames_of_brood)} />
      )}
      {obs.num_supers != null && (
        <InfoRow label="Supers" value={String(obs.num_supers)} />
      )}
      {obs.varroa_count != null && (
        <InfoRow label="Varroa Count" value={String(obs.varroa_count)} />
      )}
      {obs.pest_signs && obs.pest_signs.length > 0 && (
        <InfoRow label="Pest Signs" value={obs.pest_signs.join(", ")} />
      )}
      {obs.disease_signs && obs.disease_signs.length > 0 && (
        <InfoRow label="Disease Signs" value={obs.disease_signs.join(", ")} />
      )}
    </>
  );
}

function DetailsCard({ inspection }: { inspection: Inspection }) {
  const styles = useStyles(createStyles);
  const attentionLabel = inspection.attention ? "Yes" : "No";
  return (
    <Card>
      <Text style={styles.sectionTitle}>Inspection Details</Text>
      <InfoRow label="Date" value={formatDate(inspection.inspected_at)} />
      {inspection.impression != null && (
        <InfoRow label="Impression" value={`${inspection.impression}/5`} />
      )}
      {inspection.attention != null && (
        <InfoRow label="Needs Attention" value={attentionLabel} />
      )}
      {inspection.duration_minutes != null && (
        <InfoRow label="Duration" value={`${inspection.duration_minutes} min`} />
      )}
      <InfoRow label="Template" value={inspection.experience_template} />
    </Card>
  );
}

function ObservationsCard({ obs }: { obs: InspectionObservations }) {
  const styles = useStyles(createStyles);
  return (
    <Card>
      <Text style={styles.sectionTitle}>Observations</Text>
      <BasicObservationRows obs={obs} />
      <DetailedObservationRows obs={obs} />
    </Card>
  );
}

function TextCard({ title, text }: { title: string; text: string }) {
  const styles = useStyles(createStyles);
  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.notesText}>{text}</Text>
    </Card>
  );
}

function EditButton({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const styles = useStyles(createStyles);
  return (
    <Pressable
      style={styles.editButton}
      onPress={() => router.push(`/inspection/edit?id=${inspectionId}` as any)}
    >
      <Text style={styles.editButtonText}>Edit Inspection</Text>
    </Pressable>
  );
}

function InspectionContent({
  inspection,
  id,
}: {
  inspection: Inspection;
  id: string;
}) {
  const styles = useStyles(createStyles);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <EditButton inspectionId={id} />
      <DetailsCard inspection={inspection} />
      {inspection.observations && <ObservationsCard obs={inspection.observations} />}
      {inspection.notes && <TextCard title="Notes" text={inspection.notes} />}
      {inspection.ai_summary && <TextCard title="AI Summary" text={inspection.ai_summary} />}
      <Card>
        <Text style={styles.sectionTitle}>Photos</Text>
        <PhotoPicker inspectionId={id} />
      </Card>
    </ScrollView>
  );
}

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles(createStyles);
  const {
    data: inspection,
    isLoading,
    error,
  } = useInspection(id!);

  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  if (error || !inspection) {
    const msg = error?.message ?? "Failed to load inspection";
    return (
      <View style={styles.container}>
        <ErrorDisplay message={msg} />
      </View>
    );
  }

  return <InspectionContent inspection={inspection} id={id!} />;
}
