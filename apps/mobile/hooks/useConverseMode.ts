import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Speech from "expo-speech";

const SecureStoreModule: typeof import("expo-secure-store") | null =
  Platform.OS === "web" ? null : require("expo-secure-store");

const CONVERSE_HINT_KEY = "beebuddy_converse_hint_dismissed";

export interface ConverseModeState {
  converseMode: boolean;
  converseModeRef: React.RefObject<boolean>;
  showConverseHint: boolean;
  handleConverseModeToggle: (on: boolean) => void;
  handleDismissHint: () => void;
  handleDismissHintForever: () => void;
  /** Call when a voice message is sent (shows hint if not dismissed). */
  markVoiceSend: () => void;
}

/**
 * Manages converse mode (continuous voice chat) state, including
 * the "did you know" hint with persistent dismissal via SecureStore.
 */
export function useConverseMode(): ConverseModeState {
  const [converseMode, setConverseMode] = useState(false);
  const converseModeRef = useRef(false);
  converseModeRef.current = converseMode;

  const [showConverseHint, setShowConverseHint] = useState(false);
  const hintDismissedRef = useRef(false);

  // Load persisted hint dismissal on mount
  useEffect(() => {
    if (!SecureStoreModule) return;
    SecureStoreModule.getItemAsync(CONVERSE_HINT_KEY)
      .then((val) => { if (val === "true") hintDismissedRef.current = true; })
      .catch(() => { /* default to showing hint */ });
  }, []);

  const handleConverseModeToggle = useCallback((on: boolean) => {
    setConverseMode(on);
    if (on) {
      setShowConverseHint(false);
    } else {
      Speech.stop();
    }
  }, []);

  const handleDismissHint = useCallback(() => {
    setShowConverseHint(false);
  }, []);

  const handleDismissHintForever = useCallback(async () => {
    setShowConverseHint(false);
    hintDismissedRef.current = true;
    try {
      if (SecureStoreModule) {
        await SecureStoreModule.setItemAsync(CONVERSE_HINT_KEY, "true");
      }
    } catch { /* best-effort */ }
  }, []);

  const markVoiceSend = useCallback(() => {
    if (!hintDismissedRef.current && !converseModeRef.current) {
      setShowConverseHint(true);
    }
  }, []);

  return {
    converseMode,
    converseModeRef,
    showConverseHint,
    handleConverseModeToggle,
    handleDismissHint,
    handleDismissHintForever,
    markVoiceSend,
  };
}
