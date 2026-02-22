/** Footer bar for wizard flows — Back / Skip / Next buttons. */
import React from "react";
import { Pressable, Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../theme";

interface WizardFooterProps {
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  isFirst?: boolean;
  isLast?: boolean;
  disabled?: boolean;
}

const createStyles = (c: ThemeColors) => ({
  container: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
    backgroundColor: c.bgPrimary,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 16,
    fontFamily: typography.families.bodyMedium,
    color: c.textSecondary,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textMuted,
  },
  nextButton: {
    backgroundColor: c.primaryFill,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  nextDisabled: {
    opacity: 0.5,
  },
  nextText: {
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
    color: c.textOnPrimary,
  },
  placeholder: {
    width: 60,
  },
});

function BackSection({ isFirst, onBack, styles }: {
  isFirst: boolean;
  onBack?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (isFirst) return <View style={styles.placeholder} />;
  return (
    <Pressable style={styles.backButton} onPress={onBack}>
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

function SkipSection({ onSkip, styles }: {
  onSkip?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!onSkip) return <View />;
  return (
    <Pressable style={styles.skipButton} onPress={onSkip}>
      <Text style={styles.skipText}>Skip</Text>
    </Pressable>
  );
}

export function WizardFooter({
  onBack,
  onNext,
  onSkip,
  nextLabel,
  isFirst = false,
  isLast = false,
  disabled = false,
}: WizardFooterProps) {
  const styles = useStyles(createStyles);
  const label = nextLabel ?? (isLast ? "Done" : "Next");

  return (
    <View style={styles.container}>
      <BackSection isFirst={isFirst} onBack={onBack} styles={styles} />
      <SkipSection onSkip={onSkip} styles={styles} />
      <Pressable
        style={[styles.nextButton, disabled && styles.nextDisabled]}
        onPress={onNext}
        disabled={disabled}
      >
        <Text style={styles.nextText}>{label}</Text>
      </Pressable>
    </View>
  );
}
