import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ResponsiveContainer } from "../../components/ResponsiveContainer";
import { useAdminStats } from "../../hooks/useAdmin";
import {
  useStyles,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../../theme";

const createCardStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    width: "47%" as unknown as number,
    ...shadows.card,
    shadowColor: c.shadowColor,
  },
  cardValue: {
    fontFamily: typography.families.displayBold,
    ...typography.sizes.h1,
    color: c.honey,
  },
  cardLabel: {
    fontFamily: typography.families.body,
    ...typography.sizes.bodySm,
    color: c.textSecondary,
    marginTop: spacing.xs,
  },
});

const createLayoutStyles = (c: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontFamily: typography.families.displayBold,
    ...typography.sizes.h2,
    color: c.forest,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  loading: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: spacing["3xl"],
  },
});

const createNavStyles = (c: ThemeColors) => ({
  section: {
    marginTop: spacing.xl,
  },
  title: {
    fontFamily: typography.families.displaySemiBold,
    ...typography.sizes.h4,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
    shadowColor: c.shadowColor,
  },
  buttonText: {
    fontFamily: typography.families.bodyMedium,
    ...typography.sizes.body,
    color: c.textPrimary,
  },
  buttonSub: {
    fontFamily: typography.families.body,
    ...typography.sizes.caption,
    color: c.textSecondary,
    marginTop: 2,
  },
});

function StatCard({ value, label }: { value: number; label: string }) {
  const styles = useStyles(createCardStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function StatsGrid({ stats }: { stats: NonNullable<ReturnType<typeof useAdminStats>["data"]> }) {
  const layout = useStyles(createLayoutStyles);
  return (
    <View style={layout.grid}>
      <StatCard value={stats.totalUsers} label="Total Users" />
      <StatCard value={stats.totalHives} label="Total Hives" />
      <StatCard value={stats.totalApiaries} label="Total Apiaries" />
      <StatCard value={stats.totalInspections} label="Inspections" />
      <StatCard value={stats.totalConversations} label="AI Conversations" />
      <StatCard value={stats.activeUsers7d} label="Active (7d)" />
      <StatCard value={stats.newUsers7d} label="New Users (7d)" />
      <StatCard value={stats.newUsers30d} label="New Users (30d)" />
    </View>
  );
}

function NavSection() {
  const nav = useStyles(createNavStyles);
  const layout = useStyles(createLayoutStyles);
  const router = useRouter();

  const navPressStyle = ({ pressed }: { pressed: boolean }) => [
    nav.button,
    pressed && layout.pressed,
  ];

  return (
    <View style={nav.section}>
      <Text style={nav.title}>Manage</Text>
      <Pressable style={navPressStyle} onPress={() => router.push("/admin/users" as any)}>
        <Text style={nav.buttonText}>Users</Text>
        <Text style={nav.buttonSub}>View and manage user accounts</Text>
      </Pressable>
      <Pressable style={navPressStyle} onPress={() => router.push("/admin/oauth-clients" as any)}>
        <Text style={nav.buttonText}>OAuth Clients</Text>
        <Text style={nav.buttonSub}>Manage OAuth2 client applications</Text>
      </Pressable>
      <Pressable style={navPressStyle} onPress={() => router.push("/admin/system" as any)}>
        <Text style={nav.buttonText}>System Info</Text>
        <Text style={nav.buttonSub}>API configuration and app details</Text>
      </Pressable>
    </View>
  );
}

export default function AdminDashboard() {
  const layout = useStyles(createLayoutStyles);
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <View style={layout.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={layout.container} contentContainerStyle={layout.content}>
      <ResponsiveContainer maxWidth={800}>
        <Text style={layout.title}>Dashboard</Text>
        {stats && <StatsGrid stats={stats} />}
        <NavSection />
      </ResponsiveContainer>
    </ScrollView>
  );
}
