import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

import {
  useStyles,
  useTheme,
  typography,
  radii,
  type ThemeColors,
} from "../../theme";

const createButtonStyles = (c: ThemeColors) => ({
  button: {
    backgroundColor: c.primaryFill,
    borderRadius: radii.xl,
    padding: 16,
    alignItems: "center" as const,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: c.textOnPrimary,
    fontSize: 18,
    fontFamily: typography.families.bodySemiBold,
  },
});

interface AuthSubmitButtonProps {
  testID?: string;
  label: string;
  loading: boolean;
  onPress: () => void;
}

export function AuthSubmitButton({
  testID,
  label,
  loading,
  onPress,
}: AuthSubmitButtonProps) {
  const s = useStyles(createButtonStyles);
  const { colors } = useTheme();

  return (
    <Pressable
      testID={testID}
      style={[s.button, loading && s.buttonDisabled]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={colors.textOnPrimary} />
      ) : (
        <Text style={s.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}
