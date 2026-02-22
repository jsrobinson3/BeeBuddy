import { Pressable, Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../theme";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const createStyles = (c: ThemeColors) => ({
  container: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 60,
  },
  title: {
    fontSize: 18,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 8,
    textAlign: "center" as const,
  },
  actionButton: {
    backgroundColor: c.primaryFill,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  actionText: {
    color: c.textOnPrimary,
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
  },
});

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Pressable style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
