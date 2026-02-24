import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
} from "react-native";

import { DatePickerField } from "../../../../components/DatePickerField";
import { FormInput } from "../../../../components/FormInput";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { PickerField } from "../../../../components/PickerField";
import { useTreatment, useUpdateTreatment, useDeleteTreatment } from "../../../../hooks/useTreatments";
import type { UpdateTreatmentInput } from "../../../../services/api";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
  formDeleteStyles,
} from "../../../../theme";
import { getErrorMessage } from "../../../../utils/getErrorMessage";

const TREATMENT_TYPES: { label: string; value: string }[] = [
  { label: "Varroa Treatment", value: "varroa_treatment" },
  { label: "Antibiotic", value: "antibiotic" },
  { label: "Feeding", value: "feeding" },
  { label: "Other", value: "other" },
];

const METHODS: { label: string; value: string }[] = [
  { label: "Strip", value: "strip" },
  { label: "Vapor", value: "vapor" },
  { label: "Drench", value: "drench" },
  { label: "Dusting", value: "dusting" },
  { label: "Other", value: "other" },
];

const notesInputStyle = { textAlignVertical: "top" as const, minHeight: 100 };

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...formSubmitStyles(c),
  ...formDeleteStyles(c),
});

interface FormState {
  treatmentType: string | null;
  productName: string;
  method: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  dosage: string;
  effectivenessNotes: string;
}

interface FieldsProps {
  s: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

function TreatmentFields({ s, set }: FieldsProps) {
  return (
    <>
      <PickerField
        label="Treatment Type"
        options={TREATMENT_TYPES}
        selected={s.treatmentType}
        onSelect={(v) => set("treatmentType", v)}
      />
      <FormInput
        label="Product Name"
        value={s.productName}
        onChangeText={(v) => set("productName", v)}
        placeholder="e.g. Apivar, Oxalic Acid"
      />
      <PickerField
        label="Method"
        options={METHODS}
        selected={s.method}
        onSelect={(v) => set("method", v)}
      />
    </>
  );
}

function DetailFields({ s, set }: FieldsProps) {
  return (
    <>
      <DatePickerField
        label="Started At"
        value={s.startedAt}
        onChange={(v) => set("startedAt", v)}
      />
      <DatePickerField
        label="Ended At"
        value={s.endedAt}
        onChange={(v) => set("endedAt", v)}
      />
      <FormInput
        label="Dosage"
        value={s.dosage}
        onChangeText={(v) => set("dosage", v)}
        placeholder="e.g. 2 strips per brood box"
      />
      <FormInput
        label="Effectiveness Notes"
        value={s.effectivenessNotes}
        onChangeText={(v) => set("effectivenessNotes", v)}
        placeholder="Optional notes..."
        multiline
        numberOfLines={4}
        style={notesInputStyle}
      />
    </>
  );
}

function SubmitButton({ isPending, onPress }: { isPending: boolean; onPress: () => void }) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      style={[styles.submitButton, isPending && styles.submitDisabled]}
      onPress={onPress}
      disabled={isPending}
    >
      <Text style={styles.submitText}>{isPending ? "Saving..." : "Save Changes"}</Text>
    </Pressable>
  );
}

function FormContent(
  props: FieldsProps & { isPending: boolean; onSubmit: () => void; onDelete: () => void },
) {
  const styles = useStyles(createStyles);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TreatmentFields s={props.s} set={props.set} />
      <DetailFields s={props.s} set={props.set} />
      <SubmitButton isPending={props.isPending} onPress={props.onSubmit} />
      <Pressable style={styles.deleteButton} onPress={props.onDelete}>
        <Text style={styles.deleteText}>Delete Treatment</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function EditTreatmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: treatment, isLoading } = useTreatment(id!);
  const updateTreatment = useUpdateTreatment();
  const deleteTreatment = useDeleteTreatment();
  const styles = useStyles(createStyles);

  const [treatmentType, setTreatmentType] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [method, setMethod] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [endedAt, setEndedAt] = useState<Date | null>(null);
  const [dosage, setDosage] = useState("");
  const [effectivenessNotes, setEffectivenessNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (treatment && !initialized) {
      setTreatmentType(treatment.treatment_type);
      setProductName(treatment.product_name ?? "");
      setMethod(treatment.method ?? null);
      setStartedAt(treatment.started_at ? new Date(treatment.started_at) : null);
      setEndedAt(treatment.ended_at ? new Date(treatment.ended_at) : null);
      setDosage(treatment.dosage ?? "");
      setEffectivenessNotes(treatment.effectiveness_notes ?? "");
      setInitialized(true);
    }
  }, [treatment, initialized]);

  if (isLoading || !initialized) {
    return <LoadingSpinner fullscreen />;
  }

  function handleDelete() {
    Alert.alert("Delete Treatment?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTreatment.mutateAsync(id!);
          router.back();
        },
      },
    ]);
  }

  async function handleSubmit() {
    try {
      const data: UpdateTreatmentInput = {
        treatment_type: treatmentType ?? undefined,
        product_name: productName.trim() || undefined,
        method: method ?? undefined,
        started_at: startedAt ? startedAt.toISOString().split("T")[0] : undefined,
        ended_at: endedAt ? endedAt.toISOString().split("T")[0] : undefined,
        dosage: dosage.trim() || undefined,
        effectiveness_notes: effectivenessNotes.trim() || undefined,
      };
      await updateTreatment.mutateAsync({ id: id!, data });
      router.back();
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    }
  }

  const setters: Record<string, (v: any) => void> = {
    treatmentType: setTreatmentType,
    productName: setProductName,
    method: setMethod,
    startedAt: setStartedAt,
    endedAt: setEndedAt,
    dosage: setDosage,
    effectivenessNotes: setEffectivenessNotes,
  };

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setters[k](v);
  }

  const formState: FormState = {
    treatmentType,
    productName,
    method,
    startedAt,
    endedAt,
    dosage,
    effectivenessNotes,
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FormContent
        s={formState}
        set={set}
        isPending={updateTreatment.isPending}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </KeyboardAvoidingView>
  );
}
