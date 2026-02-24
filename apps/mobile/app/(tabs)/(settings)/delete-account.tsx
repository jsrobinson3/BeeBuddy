import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { FormInput } from "../../../components/FormInput";
import { useDeleteAccount } from "../../../hooks/useUser";
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
  warningBanner: {
    backgroundColor: c.bgInputSoft,
    borderLeftWidth: 4,
    borderLeftColor: c.warning,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 16,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: typography.families.bodySemiBold,
    color: c.textSecondary,
    textTransform: "uppercase" as const,
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: c.bgElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionCardSelected: {
    borderColor: c.danger,
  },
  optionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.border,
    marginRight: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  radioSelected: {
    borderColor: c.danger,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.danger,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
    flex: 1,
  },
  optionDescription: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 8,
    marginLeft: 32,
    lineHeight: 18,
  },
  passwordSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  deleteButton: {
    backgroundColor: c.danger,
    borderRadius: 16,
    padding: 16,
    alignItems: "center" as const,
    marginTop: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: typography.families.bodySemiBold,
  },
});

type DeleteMode = "anonymize" | "full";

function OptionCard({
  selected,
  onPress,
  title,
  description,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  description: string;
}) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress}
    >
      <View style={styles.optionRow}>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
        <Text style={styles.optionTitle}>{title}</Text>
      </View>
      <Text style={styles.optionDescription}>{description}</Text>
    </Pressable>
  );
}

function DeleteAccountForm() {
  const styles = useStyles(createStyles);
  const deleteAccount = useDeleteAccount();
  const logout = useAuthStore((s) => s.logout);

  const [mode, setMode] = useState<DeleteMode>("anonymize");
  const [password, setPassword] = useState("");

  const canSubmit = password.length > 0 && !deleteAccount.isPending;

  async function handleDelete() {
    if (!password) return;

    Alert.alert(
      mode === "full"
        ? "Delete Account & All Data?"
        : "Delete Account?",
      mode === "full"
        ? "This will permanently delete your account and ALL beekeeping data after 30 days. This cannot be undone."
        : "This will remove your account after 30 days. Your beekeeping data will be kept anonymously.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount.mutateAsync({
                password,
                delete_data: mode === "full",
              });
              Alert.alert(
                "Account Scheduled for Deletion",
                "Your account will be deleted in 30 days. Check your email for a cancellation link.",
                [{ text: "OK", onPress: () => logout() }],
              );
            } catch (err: unknown) {
              Alert.alert("Error", getErrorMessage(err));
            }
          },
        },
      ],
    );
  }

  const buttonLabel = deleteAccount.isPending ? "Deleting..." : "Delete My Account";

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.warningBanner}>
        <Text style={styles.warningTitle}>30-Day Grace Period</Text>
        <Text style={styles.warningText}>
          After requesting deletion, your account will be deactivated
          immediately but not permanently deleted for 30 days. During this
          period, you can cancel the deletion using the link in your
          confirmation email.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Deletion Mode</Text>

      <OptionCard
        selected={mode === "anonymize"}
        onPress={() => setMode("anonymize")}
        title="Delete account"
        description="Your account and login will be removed but your beekeeping data (apiaries, hives, inspections) will be kept anonymously for research."
      />

      <OptionCard
        selected={mode === "full"}
        onPress={() => setMode("full")}
        title="Delete account & all data"
        description="Your account and ALL associated data will be permanently deleted. This cannot be undone."
      />

      <View style={styles.passwordSection}>
        <FormInput
          label="Confirm Your Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
        />
      </View>

      <Pressable
        style={[styles.deleteButton, !canSubmit && styles.deleteButtonDisabled]}
        onPress={handleDelete}
        disabled={!canSubmit}
      >
        <Text style={styles.deleteButtonText}>{buttonLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function DeleteAccountScreen() {
  const styles = useStyles(createStyles);
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <DeleteAccountForm />
    </KeyboardAvoidingView>
  );
}
