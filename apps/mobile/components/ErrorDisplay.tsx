import { Pressable, Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../theme";

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

const createStyles = (c: ThemeColors) => ({
  container: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 60,
  },
  heading: {
    fontSize: 18,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    textAlign: "center" as const,
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: c.honey,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: {
    color: c.honey,
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
  },
});

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}
