import { ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";

import { ResponsiveContainer } from "../../components/ResponsiveContainer";
import { API_BASE_URL } from "../../services/config";
import {
  useStyles,
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
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
    shadowColor: c.shadowColor,
  },
  cardTitle: {
    fontFamily: typography.families.displaySemiBold,
    ...typography.sizes.h4,
    color: c.forest,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderLight,
  },
  label: {
    fontFamily: typography.families.bodySemiBold,
    ...typography.sizes.bodySm,
    color: c.textSecondary,
  },
  value: {
    fontFamily: typography.families.mono,
    ...typography.sizes.bodySm,
    color: c.textPrimary,
    flexShrink: 1,
    textAlign: "right" as const,
    marginLeft: spacing.sm,
  },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ApiCard({ apiBaseUrl, environment }: { apiBaseUrl: string; environment: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>API</Text>
      <InfoRow label="Base URL" value={apiBaseUrl} />
      <InfoRow label="Environment" value={environment} />
    </View>
  );
}

function AppCard({ version, sdkVersion }: { version: string; sdkVersion: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>App</Text>
      <InfoRow label="Version" value={version} />
      <InfoRow label="Expo SDK" value={sdkVersion} />
    </View>
  );
}

export default function SystemScreen() {
  const styles = useStyles(createStyles);
  const appVersion = Constants.expoConfig?.version ?? "0.1.0";
  const environment = __DEV__ ? "development" : "production";

  const sdkVersion = Constants.expoConfig?.sdkVersion ?? "N/A";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResponsiveContainer maxWidth={800}>
        <Text style={styles.title}>System Info</Text>
        <ApiCard apiBaseUrl={API_BASE_URL} environment={environment} />
        <AppCard version={appVersion} sdkVersion={sdkVersion} />
      </ResponsiveContainer>
    </ScrollView>
  );
}
