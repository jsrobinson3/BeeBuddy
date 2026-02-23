import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ScanText, Info } from "lucide-react-native";

import { parseNoteText } from "../../services/noteScanner/noteParser";
import { mapParsedToFormState, countParsedFields } from "../../services/noteScanner";
import type { ParsedInspection } from "../../services/noteScanner/types";
import type { FormState } from "../../app/(tabs)/(home)/inspection/fields";
import { useStyles, useTheme } from "../../theme";
import { createScannerStyles, createProcessingStyles } from "./styles";
import { SourcePickerModal } from "./SourcePickerModal";
import { ReviewModal } from "./ReviewModal";
import { TemplateModal } from "./TemplateModal";

type FormSetter = <K extends keyof FormState>(k: K, v: FormState[K]) => void;

interface NoteScannerProps {
  set: FormSetter;
}

// ─── Processing overlay ──────────────────────────────────────────────────────

function ProcessingCard() {
  const ps = useStyles(createProcessingStyles);
  const { colors } = useTheme();
  return (
    <View style={ps.card}>
      <ActivityIndicator size="large" color={colors.honey} />
      <Text style={ps.text}>Scanning notes...</Text>
    </View>
  );
}

function ProcessingOverlay({ visible }: { visible: boolean }) {
  const ps = useStyles(createProcessingStyles);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={ps.overlay}>
        <ProcessingCard />
      </View>
    </Modal>
  );
}

// ─── OCR logic ───────────────────────────────────────────────────────────────

async function runOcr(uri: string): Promise<string[] | null> {
  const { extractTextFromImage } = await import("expo-text-extractor");
  const lines = await extractTextFromImage(uri);
  if (!lines || lines.length === 0) return null;
  return lines;
}

async function pickImage(source: "camera" | "gallery") {
  const launcher =
    source === "camera"
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;
  return launcher({ mediaTypes: ["images"], quality: 0.8 });
}

// ─── Main component ──────────────────────────────────────────────────────────

const EMPTY_PARSED: ParsedInspection = {};

function useNoteScanner(set: FormSetter) {
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedInspection>(EMPTY_PARSED);

  async function handleScan(source: "camera" | "gallery") {
    setShowSourcePicker(false);
    const result = await pickImage(source);
    if (result.canceled || result.assets.length === 0) return;
    setProcessing(true);
    try {
      const lines = await runOcr(result.assets[0].uri);
      if (!lines) {
        Alert.alert("No Text Detected", "Try a clearer photo with better lighting.");
        return;
      }
      setRawText(lines.join("\n"));
      setParsed(parseNoteText(lines));
      setShowReview(true);
    } catch (err: any) {
      Alert.alert("Scan Failed", err.message ?? "Could not process the image");
    } finally {
      setProcessing(false);
    }
  }

  function handleApply() {
    const formState = mapParsedToFormState(parsed);
    for (const [key, value] of Object.entries(formState)) {
      set(key as keyof FormState, value as any);
    }
    setShowReview(false);
    setParsed(EMPTY_PARSED);
    setRawText("");
  }

  return {
    showSourcePicker, setShowSourcePicker, processing,
    showReview, setShowReview, showTemplate, setShowTemplate,
    rawText, parsed, handleScan, handleApply,
  };
}

export function NoteScanner({ set }: NoteScannerProps) {
  const styles = useStyles(createScannerStyles);
  const { colors } = useTheme();
  const s = useNoteScanner(set);

  return (
    <View style={styles.container}>
      <ScanButton onPress={() => s.setShowSourcePicker(true)} styles={styles} iconColor={colors.honey} />
      <InfoLink onPress={() => s.setShowTemplate(true)} styles={styles} iconColor={colors.textMuted} />
      <NoteScannerModals
        showSourcePicker={s.showSourcePicker}
        processing={s.processing}
        showReview={s.showReview}
        showTemplate={s.showTemplate}
        rawText={s.rawText}
        parsed={s.parsed}
        fieldCount={countParsedFields(s.parsed)}
        onScan={s.handleScan}
        onApply={s.handleApply}
        onCloseSource={() => s.setShowSourcePicker(false)}
        onCloseReview={() => s.setShowReview(false)}
        onRetry={() => { s.setShowReview(false); s.setShowSourcePicker(true); }}
        onCloseTemplate={() => s.setShowTemplate(false)}
      />
    </View>
  );
}

// ─── Modals container (keeps NoteScanner return shallow) ─────────────────────

interface ModalsProps {
  showSourcePicker: boolean;
  processing: boolean;
  showReview: boolean;
  showTemplate: boolean;
  rawText: string;
  parsed: ParsedInspection;
  fieldCount: number;
  onScan: (source: "camera" | "gallery") => void;
  onApply: () => void;
  onCloseSource: () => void;
  onCloseReview: () => void;
  onRetry: () => void;
  onCloseTemplate: () => void;
}

function NoteScannerModals(props: ModalsProps) {
  const {
    showSourcePicker, processing, showReview, showTemplate,
    rawText, parsed, fieldCount,
    onScan, onApply, onCloseSource, onCloseReview, onRetry, onCloseTemplate,
  } = props;
  return (
    <>
      <SourcePickerModal
        visible={showSourcePicker}
        onCamera={() => onScan("camera")}
        onGallery={() => onScan("gallery")}
        onClose={onCloseSource}
      />
      <ProcessingOverlay visible={processing} />
      <ReviewModal
        visible={showReview}
        rawText={rawText}
        parsed={parsed}
        fieldCount={fieldCount}
        onApply={onApply}
        onRetry={onRetry}
        onClose={onCloseReview}
      />
      <TemplateModal visible={showTemplate} onClose={onCloseTemplate} />
    </>
  );
}

// ─── Leaf components ─────────────────────────────────────────────────────────

function ScanButton({
  onPress,
  styles,
  iconColor,
}: {
  onPress: () => void;
  styles: ReturnType<typeof createScannerStyles>;
  iconColor: string;
}) {
  return (
    <Pressable style={styles.scanButton} onPress={onPress}>
      <ScanText size={18} color={iconColor} />
      <Text style={styles.scanButtonText}>Scan Handwritten Notes</Text>
    </Pressable>
  );
}

function InfoLink({
  onPress,
  styles,
  iconColor,
}: {
  onPress: () => void;
  styles: ReturnType<typeof createScannerStyles>;
  iconColor: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Pressable style={styles.infoButton} onPress={onPress}>
        <Info size={14} color={iconColor} />
        <Text style={styles.infoText}>Note format tips</Text>
      </Pressable>
    </View>
  );
}
