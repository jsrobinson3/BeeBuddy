import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { GradientHeader } from "../../components/GradientHeader";
import {
  AuthHeader,
  AuthInput,
  AuthLinkButton,
  AuthSocialSection,
  AuthSubmitButton,
} from "../../components/auth";
import { useAuthStore } from "../../stores/auth";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useStyles, typography, type ThemeColors } from "../../theme";

/* ---------- Styles ---------- */

const createFormStyles = (c: ThemeColors) => ({
  formArea: {
    flex: 1 as const,
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: c.bgPrimary,
  },
  error: {
    color: c.danger,
    fontSize: 14,
    fontFamily: typography.families.body,
    textAlign: "center" as const,
    marginBottom: 16,
  },
  scrollContent: {
    flexGrow: 1 as const,
    backgroundColor: c.bgPrimary,
  },
});

/* ---------- Field inputs (extracted to keep RegisterForm <= 50 lines) --- */

interface FieldsProps {
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  loading: boolean;
}

function RegisterFields(p: FieldsProps) {
  return (
    <>
      <AuthInput
        placeholder="Name (optional)"
        value={p.name}
        onChangeText={p.setName}
        autoCapitalize="words"
        editable={!p.loading}
      />
      <AuthInput
        placeholder="Email"
        value={p.email}
        onChangeText={p.setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!p.loading}
      />
      <AuthInput
        placeholder="Password"
        value={p.password}
        onChangeText={p.setPassword}
        secureTextEntry
        editable={!p.loading}
      />
      <AuthInput
        placeholder="Confirm Password"
        value={p.confirmPassword}
        onChangeText={p.setConfirmPassword}
        secureTextEntry
        editable={!p.loading}
      />
    </>
  );
}

/* ---------- Form sub-component (keeps JSX nesting <= 4) ---------- */

interface FormProps extends FieldsProps {
  error: string;
  onError: (msg: string) => void;
  onSubmit: () => void;
  onNavigate: () => void;
}

function RegisterForm(p: FormProps) {
  const s = useStyles(createFormStyles);
  return (
    <View style={s.formArea}>
      {p.error ? <Text style={s.error}>{p.error}</Text> : null}
      <RegisterFields
        name={p.name}
        setName={p.setName}
        email={p.email}
        setEmail={p.setEmail}
        password={p.password}
        setPassword={p.setPassword}
        confirmPassword={p.confirmPassword}
        setConfirmPassword={p.setConfirmPassword}
        loading={p.loading}
      />
      <AuthSubmitButton
        label="Create Account"
        loading={p.loading}
        onPress={p.onSubmit}
      />
      <AuthSocialSection onError={p.onError} disabled={p.loading} />
      <AuthLinkButton
        prompt="Already have an account?"
        action="Sign In"
        loading={p.loading}
        onPress={p.onNavigate}
      />
    </View>
  );
}

/* ---------- Screen ---------- */

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const s = useStyles(createFormStyles);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (err: unknown) {
      setError(
        getErrorMessage(err) || "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      <GradientHeader height={260}>
        <AuthHeader subtitle="Create your account" />
      </GradientHeader>
      <RegisterForm
        error={error}
        onError={setError}
        name={name}
        setName={setName}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        loading={loading}
        onSubmit={handleRegister}
        onNavigate={() => router.replace("/(auth)/login" as any)}
      />
    </ScrollView>
  );
}
