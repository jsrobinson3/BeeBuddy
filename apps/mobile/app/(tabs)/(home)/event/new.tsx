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
import { useCreateEvent } from "../../../../hooks/useEvents";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
  pickerStyles,
  errorStyles,
} from "../../../../theme";

type EventType = "swarm" | "split" | "combine" | "requeen" | "feed" | "winter_prep";

const EVENT_TYPES: { label: string; value: EventType }[] = [
  { label: "Swarm", value: "swarm" },
  { label: "Split", value: "split" },
  { label: "Combine", value: "combine" },
  { label: "Requeen", value: "requeen" },
  { label: "Feed", value: "feed" },
  { label: "Winter Prep", value: "winter_prep" },
];

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...pickerStyles(c),
  ...errorStyles(c),
  ...formSubmitStyles(c),
});

export default function CreateEventScreen() {
  const { hive_id } = useLocalSearchParams<{ hive_id: string }>();
  const router = useRouter();
  const createEvent = useCreateEvent();
  const styles = useStyles(createStyles);

  const [eventType, setEventType] = useState<EventType | null>(null);
  const [occurredAt, setOccurredAt] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [typeError, setTypeError] = useState<string | undefined>();

  async function handleSubmit() {
    if (!eventType) {
      setTypeError("Event type is required");
      return;
    }
    setTypeError(undefined);

    try {
      await createEvent.mutateAsync({
        hive_id: hive_id!,
        event_type: eventType,
        occurred_at: occurredAt ? occurredAt.toISOString().split("T")[0] : undefined,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to create event");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pickerLabel}>Event Type *</Text>
        {typeError && <Text style={styles.errorText}>{typeError}</Text>}
        <View style={styles.pickerRow}>
          {EVENT_TYPES.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pickerOption,
                eventType === opt.value && styles.pickerOptionSelected,
              ]}
              onPress={() => {
                setEventType(eventType === opt.value ? null : opt.value);
                if (typeError) setTypeError(undefined);
              }}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  eventType === opt.value && styles.pickerOptionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <DatePickerField
          label="Occurred At"
          value={occurredAt}
          onChange={setOccurredAt}
        />

        <FormInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes..."
          multiline
          numberOfLines={4}
          style={{ textAlignVertical: "top", minHeight: 100 }}
        />

        <Pressable
          style={[styles.submitButton, createEvent.isPending && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={createEvent.isPending}
        >
          <Text style={styles.submitText}>
            {createEvent.isPending ? "Creating..." : "Create Event"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
