import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";

import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  type ThemeColors,
} from "../theme";
import type { PendingAction } from "../services/api";

interface ConfirmationCardProps {
  action: PendingAction;
  onConfirm: (actionId: string) => Promise<unknown>;
  onReject: (actionId: string) => Promise<unknown>;
}

const createStyles = (c: ThemeColors) => ({
  container: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: c.honey,
  },
  containerResolved: {
    borderColor: c.border,
    opacity: 0.7,
  },
  summary: {
    fontFamily: typography.families.displaySemiBold,
    fontSize: 14,
    color: c.textPrimary,
    marginBottom: spacing.xs,
  },
  resourceType: {
    fontFamily: typography.families.body,
    fontSize: 12,
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  payloadContainer: {
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  payloadText: {
    fontFamily: typography.families.mono,
    fontSize: 12,
    color: c.textSecondary,
  },
  buttonRow: {
    flexDirection: "row" as const,
    gap: spacing.sm,
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: c.honey,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  confirmText: {
    fontFamily: typography.families.bodySemiBold,
    fontSize: 14,
    color: c.textOnPrimary,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  cancelText: {
    fontFamily: typography.families.bodySemiBold,
    fontSize: 14,
    color: c.textMuted,
  },
  statusText: {
    fontFamily: typography.families.bodyMedium,
    fontSize: 13,
    color: c.textMuted,
    textAlign: "center" as const,
  },
  confirmedText: {
    color: c.success,
  },
  rejectedText: {
    color: c.textMuted,
  },
});

function formatPayload(payload: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith("_id")) continue;
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
    if (typeof value === "object" && value !== null) {
      lines.push(`${label}:`);
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const subLabel = k.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
        lines.push(`  ${subLabel}: ${v}`);
      }
    } else {
      lines.push(`${label}: ${value}`);
    }
  }
  return lines.join("\n");
}

export function ConfirmationCard({ action, onConfirm, onReject }: ConfirmationCardProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const isResolved =
    action.status === "confirmed" ||
    action.status === "rejected" ||
    action.status === "expired";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(action.id);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await onReject(action.id);
    } finally {
      setLoading(false);
    }
  };

  const payloadPreview = formatPayload(action.payload);

  return (
    <View style={[styles.container, isResolved && styles.containerResolved]}>
      <Text style={styles.resourceType}>{action.resourceType}</Text>
      <Text style={styles.summary}>{action.summary}</Text>

      {payloadPreview ? (
        <View style={styles.payloadContainer}>
          <Text style={styles.payloadText}>{payloadPreview}</Text>
        </View>
      ) : null}

      {isResolved ? (
        <Text
          style={[
            styles.statusText,
            action.status === "confirmed" && styles.confirmedText,
            action.status === "rejected" && styles.rejectedText,
          ]}
        >
          {action.status === "confirmed"
            ? "Confirmed -- record saved"
            : action.status === "rejected"
              ? "Cancelled"
              : "Expired"}
        </Text>
      ) : (
        <View style={styles.buttonRow}>
          <Pressable
            style={styles.confirmButton}
            onPress={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <>
                <Check size={16} color={colors.textOnPrimary} />
                <Text style={styles.confirmText}>Confirm</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={styles.cancelButton}
            onPress={handleReject}
            disabled={loading}
          >
            <X size={16} color={colors.textMuted} />
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
