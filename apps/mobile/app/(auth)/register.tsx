import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GradientHeader } from "../../components/GradientHeader";
import { useAuthStore } from "../../stores/auth";
import {
  useStyles,
  useTheme,
  typography,
  radii,
  type ThemeColors,
} from "../../theme";

/* ---------- Header styles & component ---------- */

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
    color: "#fafaf7",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: typography.families.body,
    color: "rgba(250, 250, 247, 0.8)",
    marginTop: 8,
  },
});

function HeaderContent() {
  const s = useStyles(createHeaderStyles);
  return (
    <View style={s.content}>
      <Text style={s.logo}>
        <Text style={s.logoHoney}>Bee</Text>
        <Text style={s.logoLight}>Buddy</Text>
      </Text>
      <Text style={s.subtitle}>Create your account</Text>
    </View>
  );
}

/* ---------- Input styles & component ---------- */

const createInputStyles = (c: ThemeColors) => ({
  input: {
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.xl,
    padding: 16,
    fontSize: 16,
    fontFamily: typography.families.body,
    color: c.textPrimary,
    marginBottom: 12,
  },
});

function AuthInput(props: React.ComponentProps<typeof TextInput>) {
  const s = useStyles(createInputStyles);
  const { colors } = useTheme();
  return (
    <TextInput
      style={s.input}
      placeholderTextColor={colors.placeholder}
      {...props}
    />
  );
}

/* ---------- Button styles & component ---------- */

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

function SubmitButton({
  loading,
  onPress,
}: {
  loading: boolean;
  onPress: () => void;
}) {
  const s = useStyles(createButtonStyles);
  const { colors } = useTheme();
  const content = loading
    ? <ActivityIndicator color={colors.textOnPrimary} />
    : <Text style={s.buttonText}>Create Account</Text>;

  return (
    <TouchableOpacity
      style={[s.button, loading && s.buttonDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {content}
    </TouchableOpacity>
  );
}

/* ---------- Link styles & component ---------- */

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

function SignInLink({
  loading,
  onPress,
}: {
  loading: boolean;
  onPress: () => void;
}) {
  const s = useStyles(createLinkStyles);
  return (
    <TouchableOpacity
      style={s.link}
      onPress={onPress}
      disabled={loading}
    >
      <Text style={s.linkText}>
        Already have an account?{" "}
        <Text style={s.linkAccent}>Sign In</Text>
      </Text>
    </TouchableOpacity>
  );
}

/* ---------- Form section ---------- */

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
});

interface FormSectionProps {
  error: string;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  loading: boolean;
  onSubmit: () => void;
  onNavigate: () => void;
}

function FormSection(p: FormSectionProps) {
  const s = useStyles(createFormStyles);
  return (
    <View style={s.formArea}>
      {p.error ? <Text style={s.error}>{p.error}</Text> : null}
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
      <SubmitButton loading={p.loading} onPress={p.onSubmit} />
      <SignInLink loading={p.loading} onPress={p.onNavigate} />
    </View>
  );
}

/* ---------- Screen styles & component ---------- */

const createScreenStyles = (c: ThemeColors) => ({
  scrollContent: {
    flexGrow: 1 as const,
    backgroundColor: c.bgPrimary,
  },
});

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const s = useStyles(createScreenStyles);

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
    } catch (e: any) {
      setError(
        e.message || "Registration failed. Please try again."
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
        <HeaderContent />
      </GradientHeader>
      <FormSection
        error={error}
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
