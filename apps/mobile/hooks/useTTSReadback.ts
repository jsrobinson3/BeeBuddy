import { useCallback, useRef } from "react";
import * as Speech from "expo-speech";

/** Strip markdown formatting so TTS reads clean prose. */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")       // fenced code blocks
    .replace(/`([^`]+)`/g, "$1")           // inline code
    .replace(/!\[.*?\]\(.*?\)/g, "")       // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") // links -> text
    .replace(/^#{1,6}\s+/gm, "")           // headings
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2") // bold/italic
    .replace(/^\s*[-*+]\s+/gm, "")         // unordered lists
    .replace(/^\s*\d+\.\s+/gm, "")         // ordered lists
    .replace(/\n{2,}/g, ". ")              // paragraph breaks -> pause
    .replace(/\n/g, " ")
    .trim();
}

export interface TTSReadbackState {
  lastSendWasVoice: React.RefObject<boolean>;
  /** Mark that the current send originated from voice input. */
  markVoiceSend: () => void;
  /** Speak the response text if the last send was voice-initiated. */
  speakIfVoice: (text: string, onDone?: () => void) => void;
  /** Stop any ongoing TTS playback. */
  stop: () => void;
}

/**
 * Manages TTS readback of assistant responses when the user's
 * last message was voice-initiated.
 */
export function useTTSReadback(): TTSReadbackState {
  const lastSendWasVoice = useRef(false);

  const markVoiceSend = useCallback(() => {
    lastSendWasVoice.current = true;
  }, []);

  const stop = useCallback(() => {
    Speech.stop();
  }, []);

  const speakIfVoice = useCallback((text: string, onDone?: () => void) => {
    if (!lastSendWasVoice.current) return;
    lastSendWasVoice.current = false;

    const clean = stripMarkdown(text);
    if (!clean) {
      onDone?.();
      return;
    }
    Speech.stop();
    Speech.speak(clean, { language: "en-US", rate: 1.0, onDone });
  }, []);

  return { lastSendWasVoice, markVoiceSend, speakIfVoice, stop };
}
