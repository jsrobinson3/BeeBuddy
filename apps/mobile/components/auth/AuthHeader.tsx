import React from "react";
import { Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../../theme";

const createHeaderStyles = (c: ThemeColors) => ({
  content: {
    alignItems: "center" as const,
    paddingBottom: 40,
  },
  logo: {
    fontSize: 42,
    fontFamily: typography.families.display,
  },
  logoHoney: {
    color: c.honey,
  },
  logoLight: {
    color: c.textOnGradient,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: typography.families.body,
    color: c.textOnGradientMuted,
    marginTop: 8,
  },
});

interface AuthHeaderProps {
  subtitle: string;
}

export function AuthHeader({ subtitle }: AuthHeaderProps) {
  const s = useStyles(createHeaderStyles);
  return (
    <View style={s.content}>
      <Text style={s.logo}>
        <Text style={s.logoHoney}>Bee</Text>
        <Text style={s.logoLight}>Buddy</Text>
      </Text>
      <Text style={s.subtitle}>{subtitle}</Text>
    </View>
  );
}
