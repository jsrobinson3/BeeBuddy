import { useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

import { Card } from "../../../../components/Card";
import { EmptyState } from "../../../../components/EmptyState";
import { ErrorDisplay } from "../../../../components/ErrorDisplay";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { useApiary } from "../../../../hooks/useApiaries";
import { useHives } from "../../../../hooks/useHives";
import type { Hive } from "../../../../services/api";
import { useStyles, useTheme, typography, type ThemeColors, shadows } from "../../../../theme";

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  header: {
    backgroundColor: c.bgSurface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerTop: { flexDirection: "row" as const, alignItems: "center" as const },
  colorSwatch: { width: 16, height: 16, borderRadius: 8, marginRight: 8 },
  headerName: { fontSize: 22, fontFamily: typography.families.displayBold, color: c.textPrimary },
  headerCity: { fontSize: 14, fontFamily: typography.families.body, color: c.textSecondary, marginTop: 4 },
  hiveCount: { fontSize: 14, color: c.honey, fontFamily: typography.families.bodyMedium, marginTop: 4 },
  list: { padding: 16 },
  hiveRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  hiveName: { fontSize: 16, fontFamily: typography.families.displaySemiBold, color: c.textPrimary, flex: 1 },
  badges: { flexDirection: "row" as const, gap: 6 },
  badge: { backgroundColor: c.bgPrimary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: typography.families.body, color: c.textSecondary },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 12, color: c.textOnDanger, fontFamily: typography.families.bodyMedium },
  fab: {
    position: "absolute" as const,
    right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: c.primaryFill,
    alignItems: "center" as const, justifyContent: "center" as const,
    ...shadows.fab,
  },
  fabText: { fontSize: 28, color: c.textOnPrimary, fontFamily: typography.families.body },
});

function HiveCard({ hive, onPress }: { hive: Hive; onPress: () => void }) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();

  function statusColor(status?: string) {
    if (status === "active") return colors.success;
    if (status === "dead") return colors.danger;
    return colors.warning;
  }

  return (
    <Card onPress={onPress}>
      <View style={styles.hiveRow}>
        <Text style={styles.hiveName}>{hive.name}</Text>
        <View style={styles.badges}>
          {hive.hive_type && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{hive.hive_type}</Text>
            </View>
          )}
          <View
            style={[styles.statusBadge, { backgroundColor: statusColor(hive.status) }]}
          >
            <Text style={styles.statusText}>{hive.status ?? "unknown"}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function ApiaryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: apiary, isLoading: apiaryLoading, error: apiaryError } = useApiary(id!);
  const { data: hives, isLoading: hivesLoading } = useHives(id);
  const styles = useStyles(createStyles);

  if (apiaryLoading || hivesLoading) return <LoadingSpinner fullscreen />;

  if (apiaryError) {
    return (
      <View style={styles.container}>
        <ErrorDisplay message={apiaryError.message ?? "Failed to load apiary"} />
      </View>
    );
  }

  const hiveCount = hives?.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {apiary?.hex_color && (
            <View style={[styles.colorSwatch, { backgroundColor: apiary.hex_color }]} />
          )}
          <Text style={styles.headerName}>{apiary?.name}</Text>
        </View>
        {apiary?.city && <Text style={styles.headerCity}>{apiary.city}</Text>}
        <Text style={styles.hiveCount}>
          {hiveCount} {hiveCount === 1 ? "hive" : "hives"}
        </Text>
      </View>

      <FlatList
        data={hives ?? []}
        keyExtractor={(item: Hive) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }: { item: Hive }) => (
          <HiveCard
            hive={item}
            onPress={() => router.push(`/hive/${item.id}` as any)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No hives yet"
            subtitle="Add your first hive to this apiary"
            actionLabel="Add Hive"
            onAction={() => router.push(`/hive/new?apiary_id=${id}` as any)}
          />
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push(`/hive/new?apiary_id=${id}` as any)}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}
