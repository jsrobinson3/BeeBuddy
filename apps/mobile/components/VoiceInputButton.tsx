/**
 * Animated hex mic button for voice-to-text input.
 * Composes useVoiceInput for speech recognition lifecycle.
 *
 * Visual states:
 *  idle              → Outlined hex, Mic icon (textMuted)
 *  starting          → Outlined hex, ActivityIndicator
 *  listening         → Filled hex + pulse, Square icon (textOnPrimary)
 *  processing        → Filled hex, ActivityIndicator
 *  error             → Outlined hex (danger stroke), MicOff icon
 *  converse + idle   → Filled hex, Mic icon (honey)
 *
 * Long-press enters converse mode (continuous voice chat).
 */
import React, { useEffect, useImperativeHandle, useRef } from "react";
import { ActivityIndicator, Animated, Pressable } from "react-native";
import { Mic, MicOff, Square } from "lucide-react-native";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

import { HexIcon } from "./HexIcon";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useTheme } from "../theme";

export interface VoiceInputButtonHandle {
  startListening: () => Promise<void>;
}

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onPartialTranscript: (text: string) => void;
  disabled?: boolean;
  converseMode?: boolean;
  onLongPress?: () => void;
  onConverseExit?: () => void;
}

// ── Pulse animation (matches TypingIndicator in ChatView.tsx) ──────────────

function createPulseAnimation(scale: Animated.Value): Animated.CompositeAnimation {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.15, duration: 600, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]),
  );
}

function usePulse(active: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      const pulse = createPulseAnimation(scale);
      animRef.current = pulse;
      pulse.start();
    } else {
      animRef.current?.stop();
      scale.setValue(1);
    }
    return () => {
      animRef.current?.stop();
    };
  }, [active, scale]);

  return scale;
}

// ── Icon content per state ─────────────────────────────────────────────────

function ButtonIcon({ status, converseMode, colors }: {
  status: string;
  converseMode?: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  if (status === "starting" || status === "processing") {
    return <ActivityIndicator size={18} color={status === "processing" ? colors.textOnPrimary : colors.honey} />;
  }
  if (status === "error") {
    return <MicOff size={18} color={colors.danger} />;
  }
  if (status === "listening") {
    return <Square size={16} color={colors.textOnPrimary} fill={colors.textOnPrimary} />;
  }
  if (converseMode) {
    return <Mic size={18} color={colors.honey} />;
  }
  return <Mic size={18} color={colors.textMuted} />;
}

// ── Component ──────────────────────────────────────────────────────────────

export const VoiceInputButton = React.forwardRef<VoiceInputButtonHandle, VoiceInputButtonProps>(
  function VoiceInputButton(props, ref) {
    const { onTranscript, onPartialTranscript, disabled, converseMode, onLongPress, onConverseExit } = props;
    const { colors } = useTheme();
    const { status, startListening, stopListening, cancelListening } = useVoiceInput({
      onTranscript,
      onPartialTranscript,
    });

    useImperativeHandle(ref, () => ({ startListening }), [startListening]);

    const isListening = status === "listening";
    const isProcessing = status === "processing";
    const isError = status === "error";
    const isBusy = status === "starting" || isListening || isProcessing;
    const scale = usePulse(isListening);

    // Hide button on platforms without speech recognition (e.g. Firefox)
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      return null;
    }

    const handlePress = () => {
      if (disabled && !isBusy) return;
      if (isListening) {
        stopListening();
        if (converseMode) onConverseExit?.();
      } else if (isBusy) {
        cancelListening();
        if (converseMode) onConverseExit?.();
      } else if (converseMode) {
        onConverseExit?.();
      } else {
        startListening();
      }
    };

    const handleLongPress = () => {
      if (disabled) return;
      onLongPress?.();
      if (!isBusy) startListening();
    };

    const strokeColor = isError ? colors.danger : colors.honey;
    const filled = isListening || isProcessing || (converseMode === true && status === "idle");

    const icon = (
      <HexIcon size={40} filled={filled} strokeColor={strokeColor}>
        <ButtonIcon status={status} converseMode={converseMode} colors={colors} />
      </HexIcon>
    );

    const animatedIcon = (
      <Animated.View style={{ transform: [{ scale }] }}>
        {icon}
      </Animated.View>
    );

    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        disabled={disabled && !isBusy}
        hitSlop={8}
      >
        {animatedIcon}
      </Pressable>
    );
  },
);
