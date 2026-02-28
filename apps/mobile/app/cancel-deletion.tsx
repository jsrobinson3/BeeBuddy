import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { GradientHeader } from "../components/GradientHeader";
import { API_BASE_URL } from "../services/config";
import { getErrorMessage } from "../utils/getErrorMessage";
import {
  useStyles,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../theme";

/* ---------- Style sub-factories ---------- */

const createLayoutStyles = (c: ThemeColors) => ({
  scrollContent: {
    flexGrow: 1 as const,
    backgroundColor: c.bgPrimary,
  },
  container: {
    flex: 1 as const,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: "center" as const,
    backgroundColor: c.bgPrimary,
  },
  card: {
    width: "100%" as const,
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: "center" as const,
    shadowColor: c.shadowColor,
    ...shadows.card,
  },
});

const createIconStyles = (c: ThemeColors) => ({
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: spacing.md,
  },
  iconCircleSuccess: { backgroundColor: c.success },
  iconCircleError: { backgroundColor: c.danger },
  iconText: { fontSize: 28, color: "#ffffff" },
});

const createTextStyles = (c: ThemeColors) => ({
  title: {
    fontFamily: typography.families.displaySemiBold,
    ...typography.sizes.h3,
    color: c.textPrimary,
    textAlign: "center" as const,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.families.body,
    ...typography.sizes.bodySm,
    color: c.textMuted,
    textAlign: "center" as const,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontFamily: typography.families.body,
    ...typography.sizes.bodySm,
    color: c.danger,
    textAlign: "center" as const,
    marginBottom: spacing.lg,
  },
  loadingText: {
    fontFamily: typography.families.body,
    ...typography.sizes.body,
    color: c.textMuted,
    textAlign: "center" as const,
    marginTop: spacing.md,
  },
});

const createButtonStyles = (c: ThemeColors) => ({
  button: {
    width: "100%" as const,
    backgroundColor: c.primaryFill,
    borderRadius: radii.xl,
    paddingVertical: 14,
    alignItems: "center" as const,
  },
  buttonText: {
    fontFamily: typography.families.displaySemiBold,
    ...typography.sizes.body,
    color: c.textOnPrimary,
  },
});

/* ---------- Shared sub-components ---------- */

function StatusIcon({ variant }: { variant: "success" | "error" }) {
  const icon = useStyles(createIconStyles);
  const bg =
    variant === "success"
      ? icon.iconCircleSuccess
      : icon.iconCircleError;
  const label = variant === "success" ? "\u2713" : "!";
  return (
    <View style={[icon.iconCircle, bg]}>
      <Text style={icon.iconText}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const btn = useStyles(createButtonStyles);
  return (
    <TouchableOpacity
      style={btn.button}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={btn.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- API helper ---------- */

async function cancelDeletion(token: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/users/me/cancel-deletion`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    },
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(
      data?.detail || `Cancellation failed (${res.status})`,
    );
  }
}

/* ---------- Card sub-components ---------- */

function LoadingCard() {
  const layout = useStyles(createLayoutStyles);
  const txt = useStyles(createTextStyles);
  return (
    <View style={layout.card}>
      <ActivityIndicator size="large" color={txt.loadingText.color} />
      <Text style={txt.loadingText}>
        Cancelling account deletion...
      </Text>
    </View>
  );
}

function SuccessCard({ onNavigate }: { onNavigate: () => void }) {
  const layout = useStyles(createLayoutStyles);
  const txt = useStyles(createTextStyles);
  return (
    <View style={layout.card}>
      <StatusIcon variant="success" />
      <Text style={txt.title}>Deletion Cancelled</Text>
      <Text style={txt.subtitle}>
        Your account deletion has been cancelled. Your account is safe.
      </Text>
      <ActionButton label="Go to Login" onPress={onNavigate} />
    </View>
  );
}

function ErrorCard({ message, onNavigate }: { message: string; onNavigate: () => void }) {
  const layout = useStyles(createLayoutStyles);
  const txt = useStyles(createTextStyles);
  return (
    <View style={layout.card}>
      <StatusIcon variant="error" />
      <Text style={txt.title}>Cancellation Failed</Text>
      <Text style={txt.errorText}>{message}</Text>
      <ActionButton label="Go to Login" onPress={onNavigate} />
    </View>
  );
}

/* ---------- Screen ---------- */

export default function CancelDeletionScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const layout = useStyles(createLayoutStyles);

  const [status, setStatus] = useState<
    "loading" | "success" | "error"
  >(token ? "loading" : "error");
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "Invalid cancellation link. No token provided.",
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    cancelDeletion(token)
      .then(() => {
        if (cancelled) return;
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMessage(
          getErrorMessage(err) ||
            "This link has expired or is invalid.",
        );
        setStatus("error");
      });

    return () => { cancelled = true; };
  }, [token]);

  const navigateToLogin = () => {
    router.replace("/(auth)/login" as any);
  };

  return (
    <ScrollView
      contentContainerStyle={layout.scrollContent}
      bounces={false}
    >
      <GradientHeader height={200} />
      <View style={layout.container}>
        {status === "loading" && <LoadingCard />}
        {status === "success" && (
          <SuccessCard onNavigate={navigateToLogin} />
        )}
        {status === "error" && (
          <ErrorCard
            message={errorMessage}
            onNavigate={navigateToLogin}
          />
        )}
      </View>
    </ScrollView>
  );
}
