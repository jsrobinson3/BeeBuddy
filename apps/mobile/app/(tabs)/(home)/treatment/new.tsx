import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DatePickerField } from "../../../../components/DatePickerField";
import { FormInput } from "../../../../components/FormInput";
import { useCreateTreatment } from "../../../../hooks/useTreatments";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
  pickerStyles,
  errorStyles,
} from "../../../../theme";

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

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...pickerStyles(c),
  ...errorStyles(c),
  ...formSubmitStyles(c),
});

export default function CreateTreatmentScreen() {
  const { hive_id } = useLocalSearchParams<{ hive_id: string }>();
  const router = useRouter();
  const createTreatment = useCreateTreatment();
  const styles = useStyles(createStyles);

  const [treatmentType, setTreatmentType] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [method, setMethod] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [dosage, setDosage] = useState("");
  const [effectivenessNotes, setEffectivenessNotes] = useState("");
  const [typeError, setTypeError] = useState<string | undefined>();

  async function handleSubmit() {
    if (!treatmentType) {
      setTypeError("Treatment type is required");
      return;
    }
    setTypeError(undefined);

    try {
      await createTreatment.mutateAsync({
        hive_id: hive_id!,
        treatment_type: treatmentType,
        product_name: productName.trim() || undefined,
        method: method ?? undefined,
        started_at: startedAt ? startedAt.toISOString().split("T")[0] : undefined,
        dosage: dosage.trim() || undefined,
        effectiveness_notes: effectivenessNotes.trim() || undefined,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to create treatment");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pickerLabel}>Treatment Type *</Text>
        {typeError && <Text style={styles.errorText}>{typeError}</Text>}
        <View style={styles.pickerRow}>
          {TREATMENT_TYPES.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                treatmentType === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => {
                setTreatmentType(treatmentType === opt.value ? null : opt.value);
                if (typeError) setTypeError(undefined);
              }}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  treatmentType === opt.value && styles.pickerOptionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FormInput
          label="Product Name"
          value={productName}
          onChangeText={setProductName}
          placeholder="e.g. Apivar, Oxalic Acid"
        />

        <Text style={styles.pickerLabel}>Method</Text>
        <View style={styles.pickerRow}>
          {METHODS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                method === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => setMethod(method === opt.value ? null : opt.value)}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  method === opt.value && styles.pickerOptionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <DatePickerField
          label="Started At"
          value={startedAt}
          onChange={setStartedAt}
        />

        <FormInput
          label="Dosage"
          value={dosage}
          onChangeText={setDosage}
          placeholder="e.g. 2 strips per brood box"
        />

        <FormInput
          label="Effectiveness Notes"
          value={effectivenessNotes}
          onChangeText={setEffectivenessNotes}
          placeholder="Optional notes on treatment effectiveness..."
          multiline
          numberOfLines={4}
          style={{ textAlignVertical: "top", minHeight: 100 }}
        />

        <Pressable
          style={[styles.submitButton, createTreatment.isPending && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={createTreatment.isPending}
        >
          <Text style={styles.submitText}>
            {createTreatment.isPending ? "Creating..." : "Create Treatment"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
