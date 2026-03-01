import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
} from "react-native";

import { FormInput } from "../../../components/FormInput";
import { useCurrentUser, useUpdateUser } from "../../../hooks/useUser";
import { useAuthStore } from "../../../stores/auth";
import { useStyles, typography, type ThemeColors } from "../../../theme";
import { getErrorMessage } from "../../../utils/getErrorMessage";

const createStyles = (c: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  content: {
    padding: 16,
  },
  saveButton: {
    backgroundColor: c.primaryFill,
    borderRadius: 8,
    padding: 16,
    alignItems: "center" as const,
    marginTop: 8,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: c.textOnPrimary,
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
  },
});

function buildUpdateData(
  name: string,
  email: string,
  password: string,
  user: { name: string | null; email: string } | undefined,
): Record<string, string> {
  const data: Record<string, string> = {};
  if (name.trim() !== (user?.name ?? "")) data.name = name.trim();
  if (email.trim() !== user?.email) data.email = email.trim();
  if (password) data.password = password;
  return data;
}

function SaveButton({ label, isPending, onPress }: {
  label: string;
  isPending: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      style={[styles.saveButton, isPending && styles.saveDisabled]}
      onPress={onPress}
      disabled={isPending}
    >
      <Text style={styles.saveText}>{label}</Text>
    </Pressable>
  );
}

function ConfirmPasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <FormInput
      label="Confirm Password"
      value={value}
      onChangeText={onChange}
      placeholder="Re-enter new password"
      secureTextEntry
    />
  );
}

function ProfileForm() {
  const { data: user } = useCurrentUser();
  const updateUser = useUpdateUser();
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const router = useRouter();
  const styles = useStyles(createStyles);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();

  function handleEmailChange(text: string) {
    setEmail(text);
    if (emailError) setEmailError(undefined);
  }

  const saveLabel = updateUser.isPending ? "Saving..." : "Save";

  async function handleSave() {
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    setEmailError(undefined);

    if (password && password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    const data = buildUpdateData(name, email, password, user);
    if (Object.keys(data).length === 0) {
      router.back();
      return;
    }

    try {
      await updateUser.mutateAsync(data);
      await fetchUser();
      router.back();
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <FormInput
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        autoFocus
      />
      <FormInput
        label="Email"
        value={email}
        onChangeText={handleEmailChange}
        error={emailError}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FormInput
        label="New Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Leave blank to keep current"
        secureTextEntry
      />
      {password ? (
        <ConfirmPasswordField value={confirmPassword} onChange={setConfirmPassword} />
      ) : null}
      <SaveButton label={saveLabel} isPending={updateUser.isPending} onPress={handleSave} />
    </ScrollView>
  );
}

export default function EditProfileScreen() {
  const styles = useStyles(createStyles);
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ProfileForm />
    </KeyboardAvoidingView>
  );
}
