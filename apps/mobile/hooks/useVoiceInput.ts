/**
 * Voice-to-text input using native speech recognition (iOS SFSpeechRecognizer
 * / Android SpeechRecognizer) via expo-speech-recognition.
 *
 * Manages permissions, recording lifecycle, and partial/final transcripts.
 */
import { useCallback, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

// ── Types ──────────────────────────────────────────────────────────────────

export type VoiceInputStatus =
  | "idle"
  | "starting"
  | "listening"
  | "processing"
  | "error";

export interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onPartialTranscript?: (text: string) => void;
}

export interface UseVoiceInputReturn {
  status: VoiceInputStatus;
  partialTranscript: string;
  finalTranscript: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  cancelListening: () => void;
}

// ── Permission alert (mirrors useLocation.ts pattern) ──────────────────────

const IOS_PERMISSION_BUTTONS = [
  { text: "Cancel", style: "cancel" as const },
  { text: "Open Settings", onPress: () => Linking.openSettings() },
];
const ANDROID_PERMISSION_BUTTONS = [{ text: "OK" }];

function showPermissionDeniedAlert(): void {
  Alert.alert(
    "Speech Recognition Permission",
    "BeeBuddy needs microphone and speech recognition access for voice input. You can enable it in Settings.",
    Platform.OS === "ios" ? IOS_PERMISSION_BUTTONS : ANDROID_PERMISSION_BUTTONS,
  );
}

// Beekeeping vocabulary hints for better recognition accuracy
const CONTEXTUAL_STRINGS = [
  "apiary", "hive", "brood", "queen", "drone", "worker",
  "varroa", "mite", "smoker", "super", "frame", "comb",
  "propolis", "pollen", "nectar", "swarm", "nuc", "requeen",
];

// ── Hook ───────────────────────────────────────────────────────────────────

export function useVoiceInput(options?: UseVoiceInputOptions): UseVoiceInputReturn {
  const [status, setStatus] = useState<VoiceInputStatus>("idle");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ── Event listeners ──────────────────────────────────────────────────

  useSpeechRecognitionEvent("start", () => {
    setStatus("listening");
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript ?? "";
    if (event.isFinal) {
      setFinalTranscript(transcript);
      setPartialTranscript(transcript);
      optionsRef.current?.onTranscript?.(transcript);
      setStatus("idle");
    } else {
      setPartialTranscript(transcript);
      optionsRef.current?.onPartialTranscript?.(transcript);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    const msg = event.message ?? event.error ?? "Speech recognition error";
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      showPermissionDeniedAlert();
      setStatus("idle");
    } else if (event.error === "no-speech") {
      // Silence timeout — not a real error, just stop gracefully
      setStatus("idle");
    } else {
      setError(msg);
      setStatus("error");
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setStatus((prev) => (prev === "processing" || prev === "listening" ? "idle" : prev));
  });

  // ── Actions ──────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (status === "listening" || status === "starting") return;

    setError(null);
    setPartialTranscript("");
    setFinalTranscript("");
    setStatus("starting");

    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      showPermissionDeniedAlert();
      setStatus("idle");
      return;
    }

    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      contextualStrings: CONTEXTUAL_STRINGS,
      requiresOnDeviceRecognition: false,
    });
  }, [status]);

  const stopListening = useCallback(() => {
    setStatus("processing");
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const cancelListening = useCallback(() => {
    ExpoSpeechRecognitionModule.abort();
    setStatus("idle");
    setPartialTranscript("");
    setError(null);
  }, []);

  return {
    status,
    partialTranscript,
    finalTranscript,
    error,
    startListening,
    stopListening,
    cancelListening,
  };
}
