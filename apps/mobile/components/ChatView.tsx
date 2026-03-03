import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";
import { useRouter } from "expo-router";
import { Send } from "lucide-react-native";
import Markdown from "react-native-markdown-display";

import type { ChatMessage } from "../services/api";
import { useConversation, useChatStream } from "../hooks/useChat";
import { ConfirmationCard } from "./ConfirmationCard";
import { ResponsiveContainer } from "./ResponsiveContainer";
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const styles = useStyles(createBubbleStyles);
  const mdStyles = useStyles(createMarkdownStyles);
  const isUser = message.role === "user";
  const isBuzzing = !isUser && message.content === BUZZ_PLACEHOLDER;
  return (
    <View style={isUser ? styles.userRow : styles.assistantRow}>
      <View style={isUser ? styles.userBubble : styles.assistantBubble}>
        {isBuzzing ? <TypingIndicator /> : isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <Markdown style={mdStyles}>{message.content}</Markdown>
        )}
      </View>
    </View>
  );
}

// ── Chat Input ────────────────────────────────────────────────────────────

function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const { colors } = useTheme();
  const styles = useStyles(createInputStyles);

  const handleSend = () => {
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

  const hasFill = text.trim().length > 0 && !disabled;

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        placeholder="Ask about beekeeping..."
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={setText}
        multiline
        returnKeyType="default"
        editable={!disabled}
        onKeyPress={handleKeyPress}
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
  },
  text: {
    fontFamily: typography.families.body,
    fontSize: 13,
    color: c.danger,
    textAlign: "center" as const,
  },
});

function StreamErrorBanner({ message }: { message: string }) {
  const styles = useStyles(createErrorStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

// ── Main Chat View ────────────────────────────────────────────────────────

export function ChatView({ conversationId }: ChatViewProps) {
  const router = useRouter();
  const styles = useStyles(createContainerStyles);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottom = useRef(true);
  const lastContentHeight = useRef(0);
  const isStreamingRef = useRef(false);
  const userScrolledAway = useRef(false);
  const isSettling = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: conversation } = useConversation(conversationId);
  const {
    sendMessage, streamingContent, streamingState, error: streamError, reset,
    conversationId: streamConvId, pendingActions, confirmAction, rejectAction,
  } = useChatStream();

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const isNewChat = !conversationId;

  // Seed local messages from loaded conversation (exclude internal tool messages).
  // Enter "settling" mode so handleContentSizeChange keeps scrolling to bottom
  // while FlatList incrementally lays out all the messages.
  useEffect(() => {
    if (conversation?.messages) {
      lastContentHeight.current = 0;
      isNearBottom.current = true;
      isSettling.current = true;

      setLocalMessages(
        conversation.messages.filter((m) => m.role === "user" || m.role === "assistant"),
      );

      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        isSettling.current = false;
      }, 500);
    }
  }, [conversation]);

  // Build display list: local messages + streaming bubble (filter out tool messages).
  // Include the bubble as soon as we enter any streaming phase (even before content
  // arrives) so the FlatList item count stays stable — prevents scroll-to-top on web.
  const isActive = streamingState !== "idle" && streamingState !== "error";
  const displayMessages: ChatMessage[] = [
    ...localMessages.filter((m) => m.role === "user" || m.role === "assistant"),
    ...(isActive || streamingContent
      ? [{ role: "assistant" as const, content: streamingContent || "\u200B" }]
      : []),
  ];

  // Use server-assigned conversation ID for subsequent messages in new chats
  const effectiveConvId = conversationId ?? streamConvId ?? undefined;

  const handleSend = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      const newMessages = [...localMessages, userMsg];
      setLocalMessages(newMessages);
      sendMessage(newMessages, effectiveConvId);
    },
    [localMessages, sendMessage, effectiveConvId],
  );

  // When streaming completes, persist the assistant message locally
  useEffect(() => {
    if (streamingState === "idle" && streamingContent) {
      const shouldScroll = !userScrolledAway.current;
      setLocalMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === streamingContent) return prev;
        return [...prev, { role: "assistant", content: streamingContent }];
      });
      reset();

      if (shouldScroll) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated: false });
        });
      }

      // For new chats, navigate to the created conversation using the
      // server-assigned ID (no more guessing from the conversation list)
      if (isNewChat && streamConvId) {
        router.replace(`/chat/${streamConvId}`);
      }
    }
  }, [streamingState, streamingContent, reset, isNewChat, streamConvId, router]);

  // Keep streaming ref in sync so callbacks can read it without stale closures
  useEffect(() => {
    isStreamingRef.current = isActive;
    if (isActive) {
      userScrolledAway.current = false;
    }
  }, [isActive]);

  // Scroll to bottom when streaming begins so the response is always visible
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [isActive]);

  // Track whether user is near the bottom of the chat.
  // During settling (initial load) or streaming, don't let intermediate scroll
  // events from FlatList layout kill auto-scroll.
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

  // Auto-scroll when content grows.
  // During settling (initial load): always scroll — FlatList is still laying out items.
  // During streaming: always scroll unless user deliberately scrolled away.
  // When idle: scroll only if user is near the bottom.
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
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={displayMessages}
          keyExtractor={(item, i) => (item as any).id ?? `msg-${i}`}
          renderItem={({ item }) => <MessageBubble message={item} />}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onContentSizeChange={handleContentSizeChange}
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
        {streamError && <StreamErrorBanner message={streamError.message} />}
        <ChatInput onSend={handleSend} disabled={streamingState !== "idle" && streamingState !== "error"} />
      </KeyboardAvoidingView>
    </ResponsiveContainer>
  );
}
