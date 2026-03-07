import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { ResponsiveContainer } from "../../components/ResponsiveContainer";
import {
  useOAuth2Clients,
  useCreateOAuth2Client,
  useUpdateOAuth2Client,
} from "../../hooks/useAdmin";
import type { OAuth2Client } from "../../services/api";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../../theme";

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  content: { padding: spacing.md },
  title: {
    fontFamily: typography.families.displayBold,
    ...typography.sizes.h3,
    color: c.forest,
    marginBottom: spacing.md,
  },
  loading: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: spacing["3xl"],
  },
});

const createCardStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
    shadowColor: c.shadowColor,
  },
  cardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: spacing.sm,
  },
  cardName: {
    fontFamily: typography.families.bodyMedium,
    ...typography.sizes.body,
    color: c.textPrimary,
  },
  cardId: {
    fontFamily: typography.families.mono,
    ...typography.sizes.caption,
    color: c.textSecondary,
    marginTop: 2,
  },
  cardUris: {
    fontFamily: typography.families.body,
    ...typography.sizes.caption,
    color: c.textMuted,
    marginTop: spacing.xs,
  },
});

const createFormStyles = (c: ThemeColors) => ({
  formCard: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
    shadowColor: c.shadowColor,
  },
  formTitle: {
    fontFamily: typography.families.displaySemiBold,
    ...typography.sizes.h4,
    color: c.forest,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.families.body,
    ...typography.sizes.body,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
  submitButton: {
    backgroundColor: c.honey,
    borderRadius: radii.xl,
    paddingVertical: spacing.sm,
    alignItems: "center" as const,
    marginTop: spacing.xs,
  },
  submitText: {
    fontFamily: typography.families.bodyMedium,
    ...typography.sizes.body,
    color: c.textOnPrimary,
  },
  pressed: { opacity: 0.7 },
});

function ClientCard({ client }: { client: OAuth2Client }) {
  const s = useStyles(createCardStyles);
  const updateClient = useUpdateOAuth2Client();

  function handleToggle(val: boolean) {
    updateClient.mutate({ id: client.id, data: { isActive: val } });
  }

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardName}>{client.name}</Text>
        <Switch value={client.isActive} onValueChange={handleToggle} />
      </View>
      <Text style={s.cardId}>{client.clientId}</Text>
      <Text style={s.cardUris}>
        Redirects: {client.redirectUris.join(", ") || "None"}
      </Text>
    </View>
  );
}

function CreateForm() {
  const s = useStyles(createFormStyles);
  const { colors } = useTheme();
  const createClient = useCreateOAuth2Client();
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [redirectUris, setRedirectUris] = useState("");

  function resetForm() {
    setClientId("");
    setName("");
    setRedirectUris("");
  }

  function handleSubmit() {
    if (!clientId.trim() || !name.trim()) return;
    const uris = redirectUris
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    createClient.mutate(
      { clientId: clientId.trim(), name: name.trim(), redirectUris: uris },
      { onSuccess: resetForm },
    );
  }

  const submitPressStyle = ({ pressed }: { pressed: boolean }) => [
    s.submitButton,
    pressed && s.pressed,
  ];

  return (
    <View style={s.formCard}>
      <Text style={s.formTitle}>New Client</Text>
      <TextInput
        style={s.input}
        placeholder="Client ID"
        placeholderTextColor={colors.textMuted}
        value={clientId}
        onChangeText={setClientId}
        autoCapitalize="none"
      />
      <TextInput
        style={s.input}
        placeholder="Display Name"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={s.input}
        placeholder="Redirect URIs (comma-separated)"
        placeholderTextColor={colors.textMuted}
        value={redirectUris}
        onChangeText={setRedirectUris}
        autoCapitalize="none"
      />
      <Pressable style={submitPressStyle} onPress={handleSubmit}>
        <Text style={s.submitText}>Create Client</Text>
      </Pressable>
    </View>
  );
}

function ClientList({ clients }: { clients: OAuth2Client[] }) {
  return (
    <>
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} />
      ))}
    </>
  );
}

export default function OAuthClientsScreen() {
  const styles = useStyles(createStyles);
  const { data: clients, isLoading } = useOAuth2Clients();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResponsiveContainer maxWidth={800}>
        <Text style={styles.title}>OAuth Clients</Text>
        <CreateForm />
        <ClientList clients={clients ?? []} />
      </ResponsiveContainer>
    </ScrollView>
  );
}
