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
import { useEvent, useUpdateEvent, useDeleteEvent } from "../../../../hooks/useEvents";
import type { EventType, UpdateEventInput } from "../../../../services/api";
import {
  useStyles,
  type ThemeColors,
  formContainerStyles,
  formSubmitStyles,
  formDeleteStyles,
} from "../../../../theme";
import { getErrorMessage } from "../../../../utils/getErrorMessage";

const EVENT_TYPES: { label: string; value: string }[] = [
  { label: "Swarm", value: "swarm" },
  { label: "Split", value: "split" },
  { label: "Combine", value: "combine" },
  { label: "Requeen", value: "requeen" },
  { label: "Feed", value: "feed" },
  { label: "Winter Prep", value: "winter_prep" },
];

const notesInputStyle = { textAlignVertical: "top" as const, minHeight: 100 };

const createStyles = (c: ThemeColors) => ({
  ...formContainerStyles(c),
  ...formSubmitStyles(c),
  ...formDeleteStyles(c),
});

interface FormState {
  eventType: string | null;
  occurredAt: Date | null;
  notes: string;
}

interface FieldsProps {
  s: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

function EventFields({ s, set }: FieldsProps) {
  return (
    <>
      <PickerField
        label="Event Type"
        options={EVENT_TYPES}
        selected={s.eventType}
        onSelect={(v) => set("eventType", v)}
      />
      <DatePickerField
        label="Occurred At"
        value={s.occurredAt}
        onChange={(v) => set("occurredAt", v)}
      />
      <FormInput
        label="Notes"
        value={s.notes}
        onChangeText={(v) => set("notes", v)}
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
      <EventFields s={props.s} set={props.set} />
      <SubmitButton isPending={props.isPending} onPress={props.onSubmit} />
      <Pressable style={styles.deleteButton} onPress={props.onDelete}>
        <Text style={styles.deleteText}>Delete Event</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: event, isLoading } = useEvent(id!);
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const styles = useStyles(createStyles);

  const [eventType, setEventType] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (event && !initialized) {
      setEventType(event.event_type);
      setOccurredAt(event.occurred_at ? new Date(event.occurred_at) : null);
      setNotes(event.notes ?? "");
      setInitialized(true);
    }
  }, [event, initialized]);

  if (isLoading || !initialized) {
    return <LoadingSpinner fullscreen />;
  }

  function handleDelete() {
    Alert.alert("Delete Event?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteEvent.mutateAsync(id!);
          router.back();
        },
      },
    ]);
  }

  async function handleSubmit() {
    try {
      const data: UpdateEventInput = {
        event_type: (eventType as EventType) ?? undefined,
        occurred_at: occurredAt ? occurredAt.toISOString().split("T")[0] : undefined,
        notes: notes.trim() || undefined,
      };
      await updateEvent.mutateAsync({ id: id!, data });
      router.back();
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    }
  }

  const setters: Record<string, (v: any) => void> = {
    eventType: setEventType,
    occurredAt: setOccurredAt,
    notes: setNotes,
  };

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setters[k](v);
  }

  const formState: FormState = { eventType, occurredAt, notes };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FormContent
        s={formState}
        set={set}
        isPending={updateEvent.isPending}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </KeyboardAvoidingView>
  );
}
