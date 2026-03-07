import { useCallback, useState } from "react";
import { Animated, Pressable, TextInput, View } from "react-native";
import { ThumbsUp, ThumbsDown, Send } from "lucide-react-native";

import { useSubmitFeedback, useDeleteFeedback } from "../hooks/useChat";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  type ThemeColors,
} from "../theme";

interface FeedbackButtonsProps {
  conversationId: string;
  messageIndex: number;
  existingRating?: -1 | 1;
}

const createStyles = (c: ThemeColors) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  button: {
    padding: spacing.xs,
    borderRadius: radii.md,
  },
  buttonActive: {
    backgroundColor: c.bgInputSoft,
  },
  thanksText: {
    fontFamily: typography.families.body,
    fontSize: 11,
    color: c.textMuted,
    marginLeft: spacing.xs,
  },
  correctionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  correctionInput: {
    flex: 1,
    fontFamily: typography.families.body,
    fontSize: 13,
    color: c.textPrimary,
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxHeight: 60,
  },
  sendButton: {
    padding: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: c.primaryFill,
  },
});

function ThumbButton({
  Icon,
  active,
  color,
  onPress,
}: {
  Icon: typeof ThumbsUp;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      style={[styles.button, active && styles.buttonActive]}
      onPress={onPress}
      hitSlop={8}
    >
      <Icon size={14} color={color} strokeWidth={2} />
    </Pressable>
  );
}

function SendButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={styles.sendButton} onPress={onPress}>
      <Send size={14} color={colors.textOnPrimary} strokeWidth={2} />
    </Pressable>
  );
}

function CorrectionRow({
  correction,
  onChangeText,
  onSubmit,
}: {
  correction: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
}) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const showSend = correction.trim().length > 0;
  return (
    <View style={styles.correctionRow}>
      <TextInput
        style={styles.correctionInput}
        placeholder="What should the answer have been?"
        placeholderTextColor={colors.textMuted}
        value={correction}
        onChangeText={onChangeText}
        multiline
        maxLength={4000}
      />
      {showSend && <SendButton onPress={onSubmit} />}
    </View>
  );
}

export function FeedbackButtons({
  conversationId,
  messageIndex,
  existingRating,
}: FeedbackButtonsProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const { mutate: submitFeedback } = useSubmitFeedback();
  const { mutate: deleteFeedback } = useDeleteFeedback();

  const [rating, setRating] = useState<-1 | 1 | null>(existingRating ?? null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState("");
  const [showThanks, setShowThanks] = useState(false);
  const [thanksOpacity] = useState(() => new Animated.Value(0));

  const flashThanks = useCallback(() => {
    setShowThanks(true);
    thanksOpacity.setValue(1);
    Animated.timing(thanksOpacity, {
      toValue: 0,
      duration: 1500,
      useNativeDriver: true,
    }).start(() => setShowThanks(false));
  }, [thanksOpacity]);

  const handleRate = useCallback(
    (value: -1 | 1) => {
      if (rating === value) {
        setRating(null);
        setShowCorrection(false);
        deleteFeedback({ conversationId, messageIndex });
        return;
      }
      setRating(value);
      submitFeedback({ conversationId, messageIndex, data: { rating: value } });
      flashThanks();
      setShowCorrection(value === -1);
      if (value !== -1) setCorrection("");
    },
    [rating, conversationId, messageIndex, submitFeedback, deleteFeedback, flashThanks],
  );

  const handleSendCorrection = useCallback(() => {
    const trimmed = correction.trim();
    if (!trimmed) return;
    submitFeedback({
      conversationId,
      messageIndex,
      data: { rating: -1, correction: trimmed },
    });
    setShowCorrection(false);
    flashThanks();
  }, [correction, conversationId, messageIndex, submitFeedback, flashThanks]);

  const upColor = rating === 1 ? colors.success : colors.textMuted;
  const downColor = rating === -1 ? colors.danger : colors.textMuted;

  return (
    <View style={styles.container}>
      <ThumbButton Icon={ThumbsUp} active={rating === 1} color={upColor} onPress={() => handleRate(1)} />
      <ThumbButton Icon={ThumbsDown} active={rating === -1} color={downColor} onPress={() => handleRate(-1)} />
      {showThanks && <Animated.Text style={[styles.thanksText, { opacity: thanksOpacity }]}>Thanks!</Animated.Text>}
      {showCorrection && (
        <CorrectionRow correction={correction} onChangeText={setCorrection} onSubmit={handleSendCorrection} />
      )}
    </View>
  );
}
