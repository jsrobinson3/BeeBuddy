import { Pressable, ScrollView, Text, View } from "react-native";
import { Check, AlertTriangle } from "lucide-react-native";

import type { Confidence, ParsedInspection } from "../../services/noteScanner/types";
import { useStyles, useTheme } from "../../theme";
import { createReviewStyles, createFieldRowStyles, FIELD_LABELS } from "./styles";
import { ModalShell } from "./ModalShell";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

// ─── Small leaf components ───────────────────────────────────────────────────

function ConfidenceIcon({ level }: { level: Confidence }) {
  const { colors } = useTheme();
  if (level === "low") return <AlertTriangle size={14} color={colors.warning} />;
  return <Check size={14} color={level === "high" ? colors.success : colors.honey} />;
}

interface FieldEntry {
  key: string;
  value: unknown;
  confidence: Confidence;
}

function ParsedFieldRow({ field }: { field: FieldEntry }) {
  const fs = useStyles(createFieldRowStyles);
  const badgeStyle =
    field.confidence === "high" ? fs.badgeHigh
      : field.confidence === "medium" ? fs.badgeMedium
        : fs.badgeLow;

  return (
    <View style={fs.row}>
      <ConfidenceIcon level={field.confidence} />
      <Text style={fs.name}>{FIELD_LABELS[field.key] ?? field.key}</Text>
      <View style={[fs.badge, badgeStyle]}>
        <Text style={fs.value}>{formatValue(field.value)}</Text>
      </View>
    </View>
  );
}

function RawTextSection({ text }: { text: string }) {
  const rs = useStyles(createReviewStyles);
  return (
    <>
      <Text style={rs.sectionLabel}>Recognized Text</Text>
      <ScrollView style={rs.rawTextBox} nestedScrollEnabled>
        <Text style={rs.rawText}>{text}</Text>
      </ScrollView>
    </>
  );
}

function NotesSection({ notes }: { notes: string }) {
  const rs = useStyles(createReviewStyles);
  return (
    <>
      <Text style={rs.sectionLabel}>Notes (unparsed text)</Text>
      <View style={rs.rawTextBox}>
        <Text style={rs.rawText}>{notes}</Text>
      </View>
    </>
  );
}

function ParsedFieldList({
  entries,
  fieldCount,
  notes,
}: {
  entries: [string, { value: unknown; confidence: Confidence }][];
  fieldCount: number;
  notes?: string;
}) {
  const rs = useStyles(createReviewStyles);
  return (
    <>
      <Text style={rs.sectionLabel}>
        Parsed Fields ({fieldCount} found)
      </Text>
      {entries.map(([key, f]) => (
        <ParsedFieldRow key={key} field={{ key, ...f }} />
      ))}
      {notes && <NotesSection notes={notes} />}
    </>
  );
}

function ReviewActions({
  onApply,
  onRetry,
}: {
  onApply: () => void;
  onRetry: () => void;
}) {
  const rs = useStyles(createReviewStyles);
  return (
    <View style={rs.actions}>
      <Pressable style={rs.applyButton} onPress={onApply}>
        <Text style={rs.applyText}>Apply to Form</Text>
      </Pressable>
      <Pressable style={rs.retryButton} onPress={onRetry}>
        <Text style={rs.retryText}>Retry Scan</Text>
      </Pressable>
    </View>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  rawText: string;
  parsed: ParsedInspection;
  fieldCount: number;
  onApply: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export function ReviewModal({
  visible,
  rawText,
  parsed,
  fieldCount,
  onApply,
  onRetry,
  onClose,
}: Props) {
  const rs = useStyles(createReviewStyles);

  const entries = Object.entries(parsed).filter(
    ([key, val]) => key !== "notes" && val !== undefined,
  ) as [string, { value: unknown; confidence: Confidence }][];

  return (
    <ModalShell visible={visible} title="Scan Results" onClose={onClose}>
      <ReviewContent
        rawText={rawText}
        entries={entries}
        fieldCount={fieldCount}
        notes={parsed.notes}
        contentStyle={rs.content}
      />
      <ReviewActions onApply={onApply} onRetry={onRetry} />
    </ModalShell>
  );
}

function ReviewContent({
  rawText,
  entries,
  fieldCount,
  notes,
  contentStyle,
}: {
  rawText: string;
  entries: [string, { value: unknown; confidence: Confidence }][];
  fieldCount: number;
  notes?: string;
  contentStyle: object;
}) {
  return (
    <ScrollView style={contentStyle}>
      <RawTextSection text={rawText} />
      <ParsedFieldList
        entries={entries}
        fieldCount={fieldCount}
        notes={notes}
      />
    </ScrollView>
  );
}
