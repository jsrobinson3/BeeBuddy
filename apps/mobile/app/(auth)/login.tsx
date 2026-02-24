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

/* ---------- Form sub-component (keeps JSX nesting <= 4) ---------- */

interface FormProps {
  error: string;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
  onSubmit: () => void;
  onNavigate: () => void;
}

function LoginForm(p: FormProps) {
  const s = useStyles(createFormStyles);
  return (
    <View style={s.formArea}>
      {p.error ? <Text style={s.error}>{p.error}</Text> : null}
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
      <AuthSubmitButton
        label="Sign In"
        loading={p.loading}
        onPress={p.onSubmit}
      />
      <AuthSocialSection />
      <AuthLinkButton
        prompt="Don't have an account?"
        action="Register"
        loading={p.loading}
        onPress={p.onNavigate}
      />
    </View>
  );
}

/* ---------- Screen ---------- */

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const s = useStyles(createFormStyles);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "Login failed. Please try again.");
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
        <AuthHeader subtitle="Your beekeeping companion" />
      </GradientHeader>
      <LoginForm
        error={error}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        loading={loading}
        onSubmit={handleLogin}
        onNavigate={() => router.replace("/(auth)/register" as any)}
      />
    </ScrollView>
  );
}
