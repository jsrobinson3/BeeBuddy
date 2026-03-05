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

const TEMPLATE_DISPLAY_NAMES: Record<string, string> = {
  beginner: "Quick Check",
  intermediate: "Routine Inspection",
  advanced: "Detailed Inspection",
  mite_assessment: "Mite Assessment",
  feed_bees: "Feed Bees",
  winterize: "Winterize",
  journal_entry: "Journal Entry",
};
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
      {obs.queenSeen != null && (
        <InfoRow label="Queen Spotted" value={obs.queenSeen ? "Yes" : "No"} />
      )}
      {obs.eggsSeen != null && (
        <InfoRow label="Eggs Spotted" value={obs.eggsSeen ? "Yes" : "No"} />
      )}
      {obs.larvaeSeen != null && (
        <InfoRow label="Larvae Spotted" value={obs.larvaeSeen ? "Yes" : "No"} />
      )}
      {obs.cappedBrood != null && (
        <InfoRow label="Capped Brood" value={obs.cappedBrood ? "Yes" : "No"} />
      )}
      {obs.populationEstimate && (
        <InfoRow label="Population" value={obs.populationEstimate} />
      )}
      {obs.temperament && <InfoRow label="Temperament" value={obs.temperament} />}
      {obs.honeyStores && <InfoRow label="Honey Stores" value={obs.honeyStores} />}
      {obs.pollenStores && <InfoRow label="Pollen Stores" value={obs.pollenStores} />}
    </>
  );
}

function DetailedObservationRows({ obs }: { obs: InspectionObservations }) {
  return (
    <>
      {obs.broodPatternScore != null && (
        <InfoRow label="Brood Pattern" value={`${obs.broodPatternScore}/5`} />
      )}
      {obs.framesOfBees != null && (
        <InfoRow label="Frames of Bees" value={String(obs.framesOfBees)} />
      )}
      {obs.framesOfBrood != null && (
        <InfoRow label="Frames of Brood" value={String(obs.framesOfBrood)} />
      )}
      {obs.numSupers != null && (
        <InfoRow label="Supers" value={String(obs.numSupers)} />
      )}
      {obs.varroaCount != null && (
        <InfoRow label="Varroa Count" value={String(obs.varroaCount)} />
      )}
      {obs.pestSigns && obs.pestSigns.length > 0 && (
        <InfoRow label="Pest Signs" value={obs.pestSigns.join(", ")} />
      )}
      {obs.diseaseSigns && obs.diseaseSigns.length > 0 && (
        <InfoRow label="Disease Signs" value={obs.diseaseSigns.join(", ")} />
      )}
      {(obs as any).miteMethod && (
        <InfoRow label="Mite Method" value={(obs as any).miteMethod} />
      )}
      {(obs as any).miteSampleSize != null && (
        <InfoRow label="Sample Size" value={`${(obs as any).miteSampleSize} bees`} />
      )}
      {(obs as any).feedType && (
        <InfoRow label="Feed Type" value={(obs as any).feedType} />
      )}
      {(obs as any).feedAmount != null && (
        <InfoRow
          label="Amount"
          value={`${(obs as any).feedAmount}${(obs as any).feedUnit ? ` ${(obs as any).feedUnit}` : ""}`}
        />
      )}
      {(obs as any).winterizeChecklist && (obs as any).winterizeChecklist.length > 0 && (
        <InfoRow label="Winterization" value={(obs as any).winterizeChecklist.join(", ")} />
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
      <InfoRow label="Date" value={formatDate(inspection.inspectedAt)} />
      {inspection.impression != null && (
        <InfoRow label="Impression" value={`${inspection.impression}/5`} />
      )}
      {inspection.attention != null && (
        <InfoRow label="Needs Attention" value={attentionLabel} />
      )}
      {inspection.durationMinutes != null && (
        <InfoRow label="Duration" value={`${inspection.durationMinutes} min`} />
      )}
      <InfoRow
        label="Type"
        value={
          TEMPLATE_DISPLAY_NAMES[inspection.experienceTemplate] ??
          inspection.experienceTemplate
        }
      />
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

function ReminderCard({ inspection }: { inspection: Inspection }) {
  const styles = useStyles(createStyles);
  if (!inspection.reminder && !inspection.reminderDate) return null;
  return (
    <Card>
      <Text style={styles.sectionTitle}>Reminder</Text>
      {inspection.reminderDate && (
        <InfoRow label="Date" value={formatDate(inspection.reminderDate)} />
      )}
      {inspection.reminder && (
        <Text style={styles.notesText}>{inspection.reminder}</Text>
      )}
    </Card>
  );
}

function EditButton({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const styles = useStyles(createStyles);
  return (
    <Pressable
      style={styles.editButton}
      onPress={() => router.push(`/home/inspection/edit?id=${inspectionId}` as any)}
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
      {inspection.aiSummary && <TextCard title="AI Summary" text={inspection.aiSummary} />}
      <ReminderCard inspection={inspection} />
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
