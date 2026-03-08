import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Send } from "lucide-react-native";
import Markdown from "react-native-markdown-display";

import type { ChatMessage } from "../services/api";
import { useConversation, useChatStream, useConversationFeedback } from "../hooks/useChat";
import { useConverseMode } from "../hooks/useConverseMode";
import { useTTSReadback } from "../hooks/useTTSReadback";
import { ConfirmationCard } from "./ConfirmationCard";
import { FeedbackButtons } from "./FeedbackButtons";
import { ResponsiveContainer } from "./ResponsiveContainer";
import { VoiceInputButton, type VoiceInputButtonHandle } from "./VoiceInputButton";
import { SleepyBee } from "./illustrations";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  type ThemeColors,
} from "../theme";

interface ChatViewProps {
  conversationId?: string;
}

interface DisplayMessage extends ChatMessage {
  serverIndex: number;
}

// ── Styles ────────────────────────────────────────────────────────────────

const createContainerStyles = (c: ThemeColors) => ({
  root: { flex: 1, backgroundColor: c.bgPrimary },
  list: { flex: 1 },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
});

const createBubbleStyles = (c: ThemeColors) => ({
  userRow: { flexDirection: "row" as const, justifyContent: "flex-end" as const, marginBottom: spacing.sm },
  assistantRow: { flexDirection: "row" as const, justifyContent: "flex-start" as const, marginBottom: spacing.sm },
  userBubble: {
    maxWidth: "80%" as const,
    backgroundColor: c.forest,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  assistantBubble: {
    maxWidth: "80%" as const,
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  userText: { fontFamily: typography.families.body, fontSize: 15, color: c.textOnGradient },
  assistantText: { fontFamily: typography.families.body, fontSize: 15, color: c.textPrimary },
  buzzText: { fontFamily: typography.families.bodyMedium, fontSize: 14, color: c.textMuted },
});

const createInputStyles = (c: ThemeColors) => ({
  bar: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    backgroundColor: c.bgElevated,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  input: {
    flex: 1,
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? spacing.sm : spacing.xs,
    fontFamily: typography.families.body,
    fontSize: 15,
    color: c.textPrimary,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: Platform.OS === "ios" ? 2 : 0,
  },
});

// ── Markdown Styles ───────────────────────────────────────────────────────

const createMarkdownStyles = (c: ThemeColors) => ({
  body: { fontFamily: typography.families.body, fontSize: 15, color: c.textPrimary },
  code_inline: {
    fontFamily: typography.families.mono,
    backgroundColor: c.bgInputSoft,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  fence: {
    fontFamily: typography.families.mono,
    backgroundColor: c.bgInputSoft,
    padding: 12,
    borderRadius: 8,
  },
  code_block: {
    fontFamily: typography.families.mono,
    backgroundColor: c.bgInputSoft,
    padding: 12,
    borderRadius: 8,
  },
  heading1: { fontFamily: typography.families.displaySemiBold, color: c.textPrimary },
  heading2: { fontFamily: typography.families.displaySemiBold, color: c.textPrimary },
  heading3: { fontFamily: typography.families.displaySemiBold, color: c.textPrimary },
  link: { color: c.honey },
  list_item: { marginBottom: 4 },
});

// ── Typing Indicator ──────────────────────────────────────────────────────

const BUZZ_PLACEHOLDER = "\u200B";

function TypingIndicator() {
  const styles = useStyles(createBubbleStyles);
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.Text style={[styles.buzzText, { opacity }]}>
      Buzzing...
    </Animated.Text>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────

function MessageBubble({
  message,
  conversationId,
  feedbackRating,
}: {
  message: DisplayMessage;
  conversationId?: string;
  feedbackRating?: -1 | 1;
}) {
  const styles = useStyles(createBubbleStyles);
  const mdStyles = useStyles(createMarkdownStyles);
  const isUser = message.role === "user";
  const isBuzzing = !isUser && message.content === BUZZ_PLACEHOLDER;
  const showFeedback = !isUser && !isBuzzing && !!conversationId && message.serverIndex >= 0;
  return (
    <View style={isUser ? styles.userRow : styles.assistantRow}>
      <View style={isUser ? styles.userBubble : styles.assistantBubble}>
        {isBuzzing ? <TypingIndicator /> : isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <Markdown style={mdStyles}>{message.content}</Markdown>
        )}
        {showFeedback && (
          <FeedbackButtons
            conversationId={conversationId}
            messageIndex={message.serverIndex}
            existingRating={feedbackRating}
          />
        )}
      </View>
    </View>
  );
}

// ── Converse-mode hint ───────────────────────────────────────────────────

const createHintStyles = (c: ThemeColors) => ({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    padding: spacing.md,
    backgroundColor: c.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.honey,
    gap: spacing.sm,
  },
  text: {
    fontFamily: typography.families.body,
    fontSize: 13,
    color: c.textSecondary,
  },
  actions: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    gap: spacing.md,
  },
  dismissText: {
    fontFamily: typography.families.bodySemiBold,
    fontSize: 13,
    color: c.textMuted,
  },
  foreverText: {
    fontFamily: typography.families.bodySemiBold,
    fontSize: 13,
    color: c.honey,
  },
});

function ConverseHint({ onDismiss, onDismissForever }: {
  onDismiss: () => void;
  onDismissForever: () => void;
}) {
  const styles = useStyles(createHintStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Hold the mic button for hands-free conversation mode
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={onDismiss} hitSlop={4}>
          <Text style={styles.dismissText}>Got it</Text>
        </Pressable>
        <Pressable onPress={onDismissForever} hitSlop={4}>
          <Text style={styles.foreverText}>Don't show again</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Chat Input ────────────────────────────────────────────────────────────

const VOICE_AUTO_SEND_DELAY = 1500;

function ChatInput({ onSend, disabled, onVoiceSend, converseMode, onConverseModeToggle, micRef }: {
  onSend: (text: string) => void;
  onVoiceSend?: () => void;
  disabled: boolean;
  converseMode: boolean;
  onConverseModeToggle: (on: boolean) => void;
  micRef: React.RefObject<VoiceInputButtonHandle | null>;
}) {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const { colors } = useTheme();
  const styles = useStyles(createInputStyles);
  const autoSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelAutoSend = useCallback(() => {
    if (autoSendTimer.current) {
      clearTimeout(autoSendTimer.current);
      autoSendTimer.current = null;
    }
  }, []);

  // Clean up timer on unmount
  useEffect(() => cancelAutoSend, [cancelAutoSend]);

  const handleSend = () => {
    cancelAutoSend();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== "web") return;
    const nativeEvent = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    if (nativeEvent.key === "Enter" && !nativeEvent.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Cancel auto-send when user starts editing manually; exit converse mode
  const handleChangeText = useCallback((value: string) => {
    cancelAutoSend();
    setText(value);
    if (converseMode) onConverseModeToggle(false);
  }, [cancelAutoSend, converseMode, onConverseModeToggle]);

  const handleTranscript = useCallback((transcript: string) => {
    cancelAutoSend();
    const finalText = transcript.trim();
    if (!finalText) return;
    setText(finalText);
    setIsListening(false);
    // Auto-send after delay — user can edit or tap Send to send immediately
    autoSendTimer.current = setTimeout(() => {
      onSend(finalText);
      onVoiceSend?.();
      setText("");
      autoSendTimer.current = null;
    }, VOICE_AUTO_SEND_DELAY);
  }, [cancelAutoSend, onSend, onVoiceSend]);

  const handlePartialTranscript = useCallback((partial: string) => {
    cancelAutoSend();
    setText(partial);
    setIsListening(true);
  }, [cancelAutoSend]);

  const hasFill = text.trim().length > 0 && !disabled;
  const placeholder = isListening
    ? "Listening..."
    : converseMode
      ? "Conversation mode"
      : "Ask about beekeeping...";

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={handleChangeText}
        multiline
        returnKeyType="default"
        editable={!disabled}
        onKeyPress={handleKeyPress}
      />
      <VoiceInputButton
        ref={micRef}
        onTranscript={handleTranscript}
        onPartialTranscript={handlePartialTranscript}
        disabled={disabled}
        converseMode={converseMode}
        onLongPress={() => onConverseModeToggle(true)}
        onConverseExit={() => onConverseModeToggle(false)}
      />
      <Pressable
        style={[styles.sendButton, { backgroundColor: hasFill ? colors.primaryFill : colors.bgInputSoft }]}
        onPress={handleSend}
        disabled={!hasFill}
      >
        <Send size={20} color={hasFill ? colors.textOnPrimary : colors.textMuted} />
      </Pressable>
    </View>
  );
}

// ── Waking Up Banner ─────────────────────────────────────────────────────

const createBannerStyles = (c: ThemeColors) => ({
  container: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: spacing.xl,
    gap: spacing.md,
  },
  text: {
    fontFamily: typography.families.displaySemiBold,
    ...typography.sizes.body,
    color: c.textMuted,
    textAlign: "center" as const,
  },
});

function WakingUpBanner() {
  const styles = useStyles(createBannerStyles);
  return (
    <View style={styles.container}>
      <SleepyBee />
      <Text style={styles.text}>Waking up our AI bee...</Text>
    </View>
  );
}

function FetchingDataBanner() {
  const styles = useStyles(createBannerStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Looking up your data...</Text>
    </View>
  );
}

const createErrorStyles = (c: ThemeColors) => ({
  container: {
    padding: spacing.sm,
    backgroundColor: "rgba(220,50,50,0.1)" as const,
    alignItems: "center" as const,
    gap: spacing.xs,
  },
  text: {
    fontFamily: typography.families.body,
    fontSize: 13,
    color: c.danger,
    textAlign: "center" as const,
  },
  newChatButton: {
    backgroundColor: c.primaryFill,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  newChatText: {
    fontFamily: typography.families.bodySemiBold,
    fontSize: 13,
    color: c.textOnPrimary,
  },
});

function StreamErrorBanner({
  message,
  errorCode,
  onNewChat,
}: {
  message: string;
  errorCode?: string | null;
  onNewChat?: () => void;
}) {
  const styles = useStyles(createErrorStyles);
  const isOverflow = errorCode === "conversation_too_long";
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {isOverflow
          ? "This conversation is too long for Buddy's memory."
          : message}
      </Text>
      {isOverflow && onNewChat && (
        <Pressable style={styles.newChatButton} onPress={onNewChat}>
          <Text style={styles.newChatText}>New Chat</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Main Chat View ────────────────────────────────────────────────────────

export function ChatView({ conversationId }: ChatViewProps) {
  const router = useRouter();
  const { height: kbHeight } = useReanimatedKeyboardAnimation();
  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: -kbHeight.value,
  }));
  const styles = useStyles(createContainerStyles);
  const listRef = useRef<FlatList<DisplayMessage>>(null);
  const isNearBottom = useRef(true);
  const lastContentHeight = useRef(0);
  const isStreamingRef = useRef(false);
  const userScrolledAway = useRef(false);
  const isSettling = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: conversation } = useConversation(conversationId);
  const { data: feedbackMap } = useConversationFeedback(conversationId);
  const {
    sendMessage, streamingContent, streamingState, error: streamError, errorCode,
    reset, conversationId: streamConvId, pendingActions, confirmAction, rejectAction,
  } = useChatStream();

  const [localMessages, setLocalMessages] = useState<DisplayMessage[]>([]);
  const isNewChat = !conversationId;

  // ── Extracted hooks ────────────────────────────────────────────────
  const converse = useConverseMode();
  const tts = useTTSReadback();
  const micRef = useRef<VoiceInputButtonHandle>(null);

  const handleConverseModeToggle = useCallback((on: boolean) => {
    converse.handleConverseModeToggle(on);
    if (!on) tts.lastSendWasVoice.current = false;
  }, [converse, tts]);

  // Seed local messages from loaded conversation (exclude internal tool messages).
  useEffect(() => {
    if (conversation?.messages) {
      lastContentHeight.current = 0;
      isNearBottom.current = true;
      isSettling.current = true;

      setLocalMessages(
        conversation.messages
          .map((m, i) => ({ ...m, serverIndex: i }))
          .filter((m) => m.role === "user" || m.role === "assistant"),
      );

      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        isSettling.current = false;
      }, 500);
    }
  }, [conversation]);

  // Build display list: local messages + streaming bubble.
  const isActive = streamingState !== "idle" && streamingState !== "error";
  const displayMessages: DisplayMessage[] = [
    ...localMessages.filter((m) => m.role === "user" || m.role === "assistant"),
    ...(isActive || streamingContent
      ? [{ role: "assistant" as const, content: streamingContent || "\u200B", serverIndex: -1 }]
      : []),
  ];

  const effectiveConvId = conversationId ?? streamConvId ?? undefined;

  const handleSend = useCallback(
    (text: string) => {
      tts.stop();
      const userMsg: DisplayMessage = { role: "user", content: text, serverIndex: -1 };
      const newMessages = [...localMessages, userMsg];
      setLocalMessages(newMessages);
      sendMessage(newMessages, effectiveConvId);
    },
    [localMessages, sendMessage, effectiveConvId, tts],
  );

  const handleVoiceSend = useCallback(() => {
    tts.markVoiceSend();
    converse.markVoiceSend();
  }, [tts, converse]);

  // When streaming completes, persist the assistant message locally
  useEffect(() => {
    if (streamingState === "idle" && streamingContent) {
      const shouldScroll = !userScrolledAway.current;
      setLocalMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === streamingContent) return prev;
        return [...prev, { role: "assistant" as const, content: streamingContent, serverIndex: -1 }];
      });
      reset();

      // Read response aloud if the user's last message was voice-initiated
      const onDone = converse.converseModeRef.current
        ? () => { micRef.current?.startListening(); }
        : undefined;
      tts.speakIfVoice(streamingContent, onDone);

      if (shouldScroll) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated: false });
        });
      }

      if (isNewChat && streamConvId) {
        router.replace(`/chat/${streamConvId}`);
      }
    }
  }, [streamingState, streamingContent, reset, isNewChat, streamConvId, router, tts, converse]);

  // Exit converse mode on streaming error
  useEffect(() => {
    if (streamError && converse.converseMode) {
      converse.handleConverseModeToggle(false);
    }
  }, [streamError, converse]);

  // Keep streaming ref in sync
  useEffect(() => {
    isStreamingRef.current = isActive;
    if (isActive) userScrolledAway.current = false;
  }, [isActive]);

  // Scroll to bottom when streaming begins
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [isActive]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (!isSettling.current) {
      isNearBottom.current = distanceFromBottom < 150;
    }
    if (isStreamingRef.current && distanceFromBottom > 300) {
      userScrolledAway.current = true;
    }
  }, []);

  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    const shouldScroll = isSettling.current
      || (isStreamingRef.current ? !userScrolledAway.current : isNearBottom.current);
    if (h > lastContentHeight.current && shouldScroll) {
      listRef.current?.scrollToEnd({ animated: false });
    }
    lastContentHeight.current = h;
  }, []);

  return (
    <ResponsiveContainer fill>
      <Reanimated.View style={[styles.root, keyboardStyle]}>
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={displayMessages}
          keyExtractor={(item, i) => (item as any).id ?? `msg-${i}`}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              conversationId={effectiveConvId}
              feedbackRating={feedbackMap?.get(item.serverIndex)}
            />
          )}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onContentSizeChange={handleContentSizeChange}
          keyboardShouldPersistTaps="handled"
        />
        {pendingActions.map((action) => (
          <ConfirmationCard
            key={action.id}
            action={action}
            onConfirm={confirmAction}
            onReject={rejectAction}
          />
        ))}
        {streamingState === "waking_up" && <WakingUpBanner />}
        {streamingState === "fetching_data" && <FetchingDataBanner />}
        {streamError && (
          <StreamErrorBanner
            message={streamError.message}
            errorCode={errorCode}
            onNewChat={() => { reset(); router.replace("/chat"); }}
          />
        )}
        {converse.showConverseHint && (
          <ConverseHint
            onDismiss={converse.handleDismissHint}
            onDismissForever={converse.handleDismissHintForever}
          />
        )}
        <ChatInput
          onSend={handleSend}
          onVoiceSend={handleVoiceSend}
          disabled={streamingState !== "idle" && streamingState !== "error"}
          converseMode={converse.converseMode}
          onConverseModeToggle={handleConverseModeToggle}
          micRef={micRef}
        />
      </Reanimated.View>
    </ResponsiveContainer>
  );
}
