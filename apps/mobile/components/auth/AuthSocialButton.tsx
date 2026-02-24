import React from "react";
import { Pressable, Text, View } from "react-native";

import { useStyles, typography, radii, type ThemeColors } from "../../theme";

const createSocialStyles = (c: ThemeColors) => ({
  dividerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1 as const,
    height: 1,
    backgroundColor: c.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textMuted,
  },
  socialRow: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: 16,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    backgroundColor: c.bgInputSoft,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  socialLabel: {
    fontSize: 18,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
});

function Divider() {
  const s = useStyles(createSocialStyles);
  return (
    <View style={s.dividerRow}>
      <View style={s.dividerLine} />
      <Text style={s.dividerText}>Or continue with</Text>
      <View style={s.dividerLine} />
    </View>
  );
}

function SocialButtons() {
  const s = useStyles(createSocialStyles);
  return (
    <View style={s.socialRow}>
      <Pressable style={s.socialButton}>
        <Text style={s.socialLabel}>G</Text>
      </Pressable>
      <Pressable style={s.socialButton}>
        <Text style={s.socialLabel}>A</Text>
      </Pressable>
    </View>
  );
}

export function AuthSocialSection() {
  return (
    <View>
      <Divider />
      <SocialButtons />
    </View>
  );
}
