import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { GradientHeader } from "../components/GradientHeader";
import { API_BASE_URL } from "../services/config";
import { getErrorMessage } from "../utils/getErrorMessage";
import { useStyles, useTheme, typography, spacing, radii, shadows, type ThemeColors } from "../theme";

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
    marginBottom: spacing.md,
  },
});

const createInputStyles = (c: ThemeColors) => ({
  input: {
    width: "100%" as const,
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: typography.families.body,
    ...typography.sizes.body,
    color: c.textPrimary,
    marginBottom: spacing.md,
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: typography.families.displaySemiBold,
    ...typography.sizes.body,
    color: c.textOnPrimary,
  },
});

/* ---------- Shared sub-components ---------- */

function StatusIcon({ variant }: { variant: "success" | "error" }) {
  const icon = useStyles(createIconStyles);
  const bg = variant === "success" ? icon.iconCircleSuccess : icon.iconCircleError;
  const label = variant === "success" ? "\u2713" : "!";
  return (
    <View style={[icon.iconCircle, bg]}>
      <Text style={icon.iconText}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const btn = useStyles(createButtonStyles);
  return (
    <TouchableOpacity
      style={[btn.button, disabled && btn.buttonDisabled]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <Text style={btn.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- API helper ---------- */

async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, new_password: newPassword }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail || `Reset failed (${res.status})`);
  }
}

/* ---------- Validation helper ---------- */

function validatePasswords(password: string, confirm: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

/* ---------- Card sub-components ---------- */

function ResetForm({ onSuccess, token }: { onSuccess: () => void; token: string }) {
  const layout = useStyles(createLayoutStyles);
  const txt = useStyles(createTextStyles);
  const inp = useStyles(createInputStyles);
  const { colors } = useTheme();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    const validationError = validatePasswords(password, confirm);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      await resetPassword(token, password);
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={layout.card}>
      <Text style={txt.title}>Reset Password</Text>
      <Text style={txt.subtitle}>Enter your new password below.</Text>
      {error ? <Text style={txt.errorText}>{error}</Text> : null}
      <TextInput
        style={inp.input}
        placeholder="New password"
        placeholderTextColor={colors.placeholder}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        autoCapitalize="none"
      />
      <TextInput
        style={inp.input}
        placeholder="Confirm password"
        placeholderTextColor={colors.placeholder}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        editable={!loading}
        autoCapitalize="none"
      />
      <ActionButton label={loading ? "Resetting..." : "Reset Password"} onPress={handleSubmit} disabled={loading} />
    </View>
  );
}

function SuccessCard({ onNavigate }: { onNavigate: () => void }) {
  const layout = useStyles(createLayoutStyles);
  const txt = useStyles(createTextStyles);
  return (
    <View style={layout.card}>
      <StatusIcon variant="success" />
      <Text style={txt.title}>Password Reset!</Text>
      <Text style={txt.subtitle}>Your password has been successfully reset.</Text>
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
      <Text style={txt.title}>Invalid Link</Text>
      <Text style={txt.errorText}>{message}</Text>
      <ActionButton label="Go to Login" onPress={onNavigate} />
    </View>
  );
}

/* ---------- Screen ---------- */

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const layout = useStyles(createLayoutStyles);

  const [status, setStatus] = useState<"form" | "success" | "error">(token ? "form" : "error");
  const [errorMessage] = useState(token ? "" : "Invalid reset link. No token provided.");

  const navigateToLogin = () => router.replace("/(auth)/login" as any);

  return (
    <ScrollView contentContainerStyle={layout.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
      <GradientHeader height={200} />
      <View style={layout.container}>
        {status === "form" && token && <ResetForm token={token} onSuccess={() => setStatus("success")} />}
        {status === "success" && <SuccessCard onNavigate={navigateToLogin} />}
        {status === "error" && <ErrorCard message={errorMessage} onNavigate={navigateToLogin} />}
      </View>
    </ScrollView>
  );
}
