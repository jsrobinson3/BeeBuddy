import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useGoogleAuth, signInWithApple } from "../../services/oauth";
import { useAuthStore } from "../../stores/auth";
import { useTheme, typography, radii, type ThemeColors } from "../../theme";
import { useStyles } from "../../theme";
import { AppleLogo } from "./AppleLogo";
import { GoogleLogo } from "./GoogleLogo";

/* ------------------------------------------------------------------ */
/*  Brand-specific colours (from official guidelines)                  */
/* ------------------------------------------------------------------ */

const GOOGLE = {
  light: { bg: "#FFFFFF", border: "#747775", text: "#1F1F1F" },
  dark: { bg: "#131314", border: "#8E918F", text: "#E3E3E3" },
} as const;

const APPLE = {
  light: { bg: "#000000", text: "#FFFFFF" },
  dark: { bg: "#FFFFFF", border: "#E3E3E3", text: "#000000" },
} as const;

/* ------------------------------------------------------------------ */
/*  Shared styles (theme-aware)                                        */
/* ------------------------------------------------------------------ */

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
  socialStack: {
    gap: 12,
  },
});

/* ------------------------------------------------------------------ */
/*  Static styles (not theme-dependent)                                */
/* ------------------------------------------------------------------ */

const base = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: radii.xl,
    paddingHorizontal: 16,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontFamily: typography.families.bodyMedium,
    marginLeft: 12,
  },
});

/* ------------------------------------------------------------------ */
/*  Divider                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Button content helpers                                             */
/* ------------------------------------------------------------------ */

function GoogleButtonContent({ textColor }: { textColor: string }) {
  return (
    <>
      <GoogleLogo size={20} />
      <Text style={[base.label, { color: textColor }]}>
        Continue with Google
      </Text>
    </>
  );
}

function AppleButtonContent({ textColor }: { textColor: string }) {
  return (
    <>
      <AppleLogo size={20} color={textColor} />
      <Text style={[base.label, { color: textColor }]}>
        Continue with Apple
      </Text>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Google button                                                      */
/* ------------------------------------------------------------------ */

interface BrandButtonProps {
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}

function GoogleButton({ loading, disabled, onPress }: BrandButtonProps) {
  const { isDark } = useTheme();
  const t = isDark ? GOOGLE.dark : GOOGLE.light;
  const brandStyle = { backgroundColor: t.bg, borderWidth: 1, borderColor: t.border };
  const content = loading
    ? <ActivityIndicator size="small" color={t.text} />
    : <GoogleButtonContent textColor={t.text} />;

  return (
    <Pressable
      style={[base.btn, brandStyle, disabled && base.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      {content}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  Apple button                                                       */
/* ------------------------------------------------------------------ */

function AppleButton({ loading, disabled, onPress }: BrandButtonProps) {
  const { isDark } = useTheme();
  const t = isDark ? APPLE.dark : APPLE.light;
  const hasBorder = isDark;
  const brandStyle = {
    backgroundColor: t.bg,
    borderWidth: hasBorder ? 1 : 0,
    borderColor: hasBorder ? APPLE.dark.border : "transparent",
  };
  const content = loading
    ? <ActivityIndicator size="small" color={t.text} />
    : <AppleButtonContent textColor={t.text} />;

  return (
    <Pressable
      style={[base.btn, brandStyle, disabled && base.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
    >
      {content}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  Button stack                                                       */
/* ------------------------------------------------------------------ */

interface ButtonStackProps {
  googleLoading: boolean;
  appleLoading: boolean;
  googleDisabled: boolean;
  allDisabled: boolean;
  onGoogle: () => void;
  onApple: () => void;
}

function SocialButtonStack(p: ButtonStackProps) {
  const s = useStyles(createSocialStyles);
  const appleButton = Platform.OS === "ios" ? (
    <AppleButton
      loading={p.appleLoading}
      disabled={p.allDisabled}
      onPress={p.onApple}
    />
  ) : null;

  return (
    <View style={s.socialStack}>
      <GoogleButton
        loading={p.googleLoading}
        disabled={p.googleDisabled || p.allDisabled}
        onPress={p.onGoogle}
      />
      {appleButton}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Composite section (public API — unchanged interface)               */
/* ------------------------------------------------------------------ */

interface AuthSocialSectionProps {
  onError?: (message: string) => void;
  disabled?: boolean;
}

export function AuthSocialSection({
  onError,
  disabled,
}: AuthSocialSectionProps) {
  const loginWithGoogle = useAuthStore((st) => st.loginWithGoogle);
  const loginWithApple = useAuthStore((st) => st.loginWithApple);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const [request, response, promptAsync] = useGoogleAuth();

  useEffect(() => {
    if (!response) return;
    if (response.type === "error") {
      onError?.(response.error?.message || "Google sign-in failed");
      return;
    }
    if (response.type !== "success") return;
    const idToken = response.params?.id_token;
    if (!idToken) return;
    setGoogleLoading(true);
    loginWithGoogle(idToken)
      .catch((e: Error) => onError?.(e.message || "Google sign-in failed"))
      .finally(() => setGoogleLoading(false));
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApple = useCallback(async () => {
    setAppleLoading(true);
    try {
      const result = await signInWithApple();
      await loginWithApple(result.idToken, result.name, result.email);
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (e.code !== "ERR_REQUEST_CANCELED") {
        onError?.(e.message || "Apple sign-in failed");
      }
    } finally {
      setAppleLoading(false);
    }
  }, [loginWithApple, onError]);

  const isLoading = googleLoading || appleLoading || !!disabled;

  return (
    <View>
      <Divider />
      <SocialButtonStack
        googleLoading={googleLoading}
        appleLoading={appleLoading}
        googleDisabled={!request}
        allDisabled={isLoading}
        onGoogle={() => promptAsync()}
        onApple={handleApple}
      />
    </View>
  );
}
