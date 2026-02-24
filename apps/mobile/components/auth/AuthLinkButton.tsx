import React from "react";
import { Pressable, Text } from "react-native";

import { useStyles, typography, type ThemeColors } from "../../theme";

const createLinkStyles = (c: ThemeColors) => ({
  link: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: "center" as const,
  },
  linkText: {
    color: c.textSecondary,
    fontSize: 14,
    fontFamily: typography.families.body,
  },
  linkAccent: {
    color: c.honey,
    fontFamily: typography.families.bodySemiBold,
  },
});

interface AuthLinkButtonProps {
  prompt: string;
  action: string;
  loading: boolean;
  onPress: () => void;
}

export function AuthLinkButton({
  prompt,
  action,
  loading,
  onPress,
}: AuthLinkButtonProps) {
  const s = useStyles(createLinkStyles);
  return (
    <Pressable style={s.link} onPress={onPress} disabled={loading}>
      <Text style={s.linkText}>
        {prompt}{" "}
        <Text style={s.linkAccent}>{action}</Text>
      </Text>
    </Pressable>
  );
}
