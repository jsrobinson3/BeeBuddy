import { useMemo } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import {
  Warehouse,
  Hexagon,
  ListChecks,
  ClipboardCheck,
  MapPin,
  Plus,
} from "lucide-react-native";

import { EmptyState } from "../../../components/EmptyState";
import { ErrorDisplay } from "../../../components/ErrorDisplay";
import { HexIcon } from "../../../components/HexIcon";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useApiaries } from "../../../hooks/useApiaries";
import { useHives } from "../../../hooks/useHives";
import { useTasks } from "../../../hooks/useTasks";
import type { Apiary, Hive } from "../../../services/api";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../../../theme";

// ── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ── Style factories (each <=50 lines) ────────────────────────────────────────

const createLayoutStyles = (c: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  list: {
    padding: spacing.md,
    paddingBottom: 80,
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.sizes.h4,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
  },
  fab: {
    position: "absolute" as const,
    right: 20,
    bottom: 20,
    ...shadows.fab,
  },
});

const createHeaderStyles = (c: ThemeColors) => ({
  headerSection: {
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.sizes.h1,
    fontFamily: typography.families.display,
    color: c.textPrimary,
  },
  summary: {
    ...typography.sizes.bodySm,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: "row" as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    alignItems: "center" as const,
    ...shadows.card,
  },
  statValue: {
    ...typography.sizes.h3,
    fontFamily: typography.families.displayBold,
    color: c.textPrimary,
    marginTop: spacing.sm,
  },
  statLabel: {
    ...typography.sizes.caption,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 2,
  },
});

const createQuickInspectStyles = (c: ThemeColors) => ({
  quickActions: {
    marginBottom: spacing.lg,
  },
  hiveCard: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.sm,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    ...shadows.card,
  },
  hiveName: {
    ...typography.sizes.bodySm,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  inspectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.pill,
    backgroundColor: c.honey,
  },
  inspectButtonText: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodySemiBold,
    color: c.textOnPrimary,
  },
});

const createApiaryCardStyles = (c: ThemeColors) => ({
  apiaryCard: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    ...shadows.card,
  },
  apiaryInfo: {
    flex: 1,
    marginLeft: spacing.sm + 4,
  },
  apiaryName: {
    ...typography.sizes.body,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
  },
  apiaryLocation: {
    ...typography.sizes.caption,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 2,
  },
  hiveBadge: {
    backgroundColor: c.honeyPale,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  hiveBadgeText: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
});

// ── Sub-components ───────────────────────────────────────────────────────────

/** Small hex-framed icon used inside stat cards. Extracted to keep nesting <= 4. */
function StatHexIcon({
  icon: Icon,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
}) {
  const { colors } = useTheme();
  return (
    <HexIcon size={28} filled fillColor={colors.honeyPale}>
      <Icon size={14} color={colors.honey} />
    </HexIcon>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  const s = useStyles(createHeaderStyles);
  return (
    <View style={s.statCard}>
      {icon}
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function StatsRow({
  apiaryCount,
  totalHives,
  pendingTasks,
}: {
  apiaryCount: number;
  totalHives: number;
  pendingTasks: number;
}) {
  const s = useStyles(createHeaderStyles);
  return (
    <View style={s.statsRow}>
      <StatCard
        icon={<StatHexIcon icon={Warehouse} />}
        value={apiaryCount}
        label="Apiaries"
      />
      <StatCard
        icon={<StatHexIcon icon={Hexagon} />}
        value={totalHives}
        label="Total Hives"
      />
      <StatCard
        icon={<StatHexIcon icon={ListChecks} />}
        value={pendingTasks}
        label="Pending Tasks"
      />
    </View>
  );
}

function DashboardHeader({
  apiaryCount,
  totalHives,
  pendingTasks,
}: {
  apiaryCount: number;
  totalHives: number;
  pendingTasks: number;
}) {
  const s = useStyles(createHeaderStyles);
  const greeting = useMemo(() => getGreeting(), []);

  const apiaryLabel = apiaryCount === 1 ? "apiary" : "apiaries";
  const hiveLabel = totalHives === 1 ? "hive" : "hives";
  const summaryText =
    apiaryCount === 0
      ? "Add your first apiary to get started"
      : `You have ${apiaryCount} ${apiaryLabel} with ${totalHives} ${hiveLabel}`;

  return (
    <View style={s.headerSection}>
      <Text style={s.greeting}>{greeting}</Text>
      <Text style={s.summary}>{summaryText}</Text>
      <StatsRow
        apiaryCount={apiaryCount}
        totalHives={totalHives}
        pendingTasks={pendingTasks}
      />
    </View>
  );
}

function QuickInspectRow({
  hive,
  onPress,
}: {
  hive: Hive;
  onPress: () => void;
}) {
  const s = useStyles(createQuickInspectStyles);
  return (
    <View style={s.hiveCard}>
      <Text style={s.hiveName} numberOfLines={1}>
        {hive.name}
      </Text>
      <Pressable style={s.inspectButton} onPress={onPress}>
        <Text style={s.inspectButtonText}>Inspect</Text>
      </Pressable>
    </View>
  );
}

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
}) {
  const s = useStyles(createLayoutStyles);
  const { colors } = useTheme();
  return (
    <View style={s.sectionHeader}>
      <Icon size={18} color={colors.textPrimary} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function QuickActions({
  hives,
  onInspect,
}: {
  hives: Hive[];
  onInspect: (hiveId: string) => void;
}) {
  const s = useStyles(createQuickInspectStyles);
  const recent = hives.filter((h) => h.status === "active").slice(0, 5);
  if (recent.length === 0) return null;

  const rows = recent.map((hive) => (
    <QuickInspectRow
      key={hive.id}
      hive={hive}
      onPress={() => onInspect(hive.id)}
    />
  ));

  return (
    <View style={s.quickActions}>
      <SectionHeading icon={ClipboardCheck} title="Quick Inspection" />
      {rows}
    </View>
  );
}

function ApiaryCardIcon() {
  const { colors } = useTheme();
  return (
    <HexIcon size={40} filled fillColor={colors.honeyPale}>
      <MapPin size={20} color={colors.honey} />
    </HexIcon>
  );
}

function ApiaryCardInfo({ name, city }: { name: string; city: string | null }) {
  const s = useStyles(createApiaryCardStyles);
  return (
    <View style={s.apiaryInfo}>
      <Text style={s.apiaryName} numberOfLines={1}>{name}</Text>
      {city != null && (
        <Text style={s.apiaryLocation} numberOfLines={1}>{city}</Text>
      )}
    </View>
  );
}

function HiveBadge({ count }: { count: number }) {
  const s = useStyles(createApiaryCardStyles);
  const label = count === 1 ? "hive" : "hives";
  return (
    <View style={s.hiveBadge}>
      <Text style={s.hiveBadgeText}>
        {count} {label}
      </Text>
    </View>
  );
}

function ApiaryCard({
  apiary,
  onPress,
}: {
  apiary: Apiary;
  onPress: () => void;
}) {
  const s = useStyles(createApiaryCardStyles);
  return (
    <Pressable style={s.apiaryCard} onPress={onPress}>
      <ApiaryCardIcon />
      <ApiaryCardInfo name={apiary.name} city={apiary.city} />
      <HiveBadge count={apiary.hive_count} />
    </Pressable>
  );
}

function HexFab({ onPress }: { onPress: () => void }) {
  const s = useStyles(createLayoutStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={s.fab} onPress={onPress}>
      <HexIcon size={56} filled fillColor={colors.primaryFill}>
        <Plus size={26} color={colors.textOnPrimary} />
      </HexIcon>
    </Pressable>
  );
}

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const s = useStyles(createLayoutStyles);
  return (
    <View style={s.container}>
      <ErrorDisplay message={message} onRetry={onRetry} />
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ApiariesScreen() {
  const router = useRouter();
  const { data: apiaries, isLoading, error, refetch } = useApiaries();
  const { data: hives } = useHives();
  const { data: tasks } = useTasks();
  const s = useStyles(createLayoutStyles);

  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  if (error) {
    return (
      <ErrorScreen
        message={error.message ?? "Failed to load apiaries"}
        onRetry={refetch}
      />
    );
  }

  const allHives = hives ?? [];
  const allApiaries = apiaries ?? [];
  const allTasks = tasks ?? [];
  const pendingTasks = allTasks.filter((t) => !t.completed_at).length;

  function handleInspect(hiveId: string) {
    router.push(`/inspection/new?hive_id=${hiveId}` as any);
  }

  const header = (
    <>
      <DashboardHeader
        apiaryCount={allApiaries.length}
        totalHives={allHives.length}
        pendingTasks={pendingTasks}
      />
      <QuickActions hives={allHives} onInspect={handleInspect} />
      {allApiaries.length > 0 && (
        <SectionHeading icon={MapPin} title="Your Apiaries" />
      )}
    </>
  );

  const empty = (
    <EmptyState
      title="No apiaries yet"
      subtitle="Tap the + button to add your first apiary"
      actionLabel="Add Apiary"
      onAction={() => router.push("/apiary/new" as any)}
    />
  );

  function renderApiary({ item }: { item: Apiary }) {
    return (
      <ApiaryCard
        apiary={item}
        onPress={() => router.push(`/apiary/${item.id}` as any)}
      />
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={allApiaries}
        keyExtractor={(item: Apiary) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={header}
        renderItem={renderApiary}
        ListEmptyComponent={empty}
      />
      <HexFab onPress={() => router.push("/apiary/new" as any)} />
    </View>
  );
}
