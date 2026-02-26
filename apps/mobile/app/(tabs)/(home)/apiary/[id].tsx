import { useLocalSearchParams, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { FlatList, Pressable, Text, View } from "react-native";

import { Card } from "../../../../components/Card";
import { EmptyState } from "../../../../components/EmptyState";
import { ErrorDisplay } from "../../../../components/ErrorDisplay";
import { HexIcon } from "../../../../components/HexIcon";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { WeatherForecastCard } from "../../../../components/WeatherForecastCard";
import { useApiary } from "../../../../hooks/useApiaries";
import { useHives } from "../../../../hooks/useHives";
import { useWeatherForecast } from "../../../../hooks/useWeather";
import type { Hive } from "../../../../services/api";
import { useStyles, useTheme, typography, spacing, type ThemeColors } from "../../../../theme";

const createHeaderStyles = (c: ThemeColors) => ({
  header: { backgroundColor: c.bgSurface, padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTop: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  headerLeft: { flexDirection: "row" as const, alignItems: "center" as const, flex: 1 },
  colorSwatch: { width: 16, height: 16, borderRadius: 8, marginRight: 8 },
  headerName: {
    fontSize: 22, fontFamily: typography.families.displayBold,
    color: c.textPrimary, flexShrink: 1,
  },
  headerCity: {
    fontSize: 14, fontFamily: typography.families.body,
    color: c.textSecondary, marginTop: 4,
  },
  hiveBadge: {
    backgroundColor: c.selectedBg, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 12,
  },
  hiveCount: { fontSize: 14, color: c.honey, fontFamily: typography.families.bodyMedium },
});

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  ...createHeaderStyles(c),
  weatherSection: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  list: { padding: 16 },
  hiveRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
  hiveName: { fontSize: 16, fontFamily: typography.families.displaySemiBold, color: c.textPrimary, flex: 1 },
  badges: { flexDirection: "row" as const, gap: 6 },
  badge: { backgroundColor: c.bgPrimary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: typography.families.body, color: c.textSecondary },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 12, color: c.textOnDanger, fontFamily: typography.families.bodyMedium },
  fab: { position: "absolute" as const, right: 20, bottom: 20 },
  editButton: {
    backgroundColor: c.primaryFill, borderRadius: 16, padding: 14,
    alignItems: "center" as const, marginHorizontal: 16, marginTop: 12,
  },
  editButtonText: { color: c.textOnPrimary, fontSize: 16, fontFamily: typography.families.bodySemiBold },
});

function useStatusColor() {
  const { colors } = useTheme();
  return (status?: string) => {
    if (status === "active") return colors.success;
    if (status === "dead") return colors.danger;
    return colors.warning;
  };
}

function TypeBadge({ type }: { type: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{type}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const styles = useStyles(createStyles);
  const statusColor = useStatusColor();
  return (
    <View style={[styles.statusBadge, { backgroundColor: statusColor(status) }]}>
      <Text style={styles.statusText}>{status ?? "unknown"}</Text>
    </View>
  );
}

function HiveBadges({ hive }: { hive: Hive }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.badges}>
      {hive.hive_type && <TypeBadge type={hive.hive_type} />}
      <StatusBadge status={hive.status} />
    </View>
  );
}

function HiveCard({ hive, onPress }: { hive: Hive; onPress: () => void }) {
  const styles = useStyles(createStyles);
  return (
    <Card onPress={onPress}>
      <View style={styles.hiveRow}>
        <Text style={styles.hiveName}>{hive.name}</Text>
        <HiveBadges hive={hive} />
      </View>
    </Card>
  );
}

function HeaderNameRow({ name, hexColor }: { name?: string; hexColor?: string | null }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.headerLeft}>
      {hexColor && <View style={[styles.colorSwatch, { backgroundColor: hexColor }]} />}
      <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
    </View>
  );
}

function HiveCountBadge({ count }: { count: number }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.hiveBadge}>
      <Text style={styles.hiveCount}>
        {count} {count === 1 ? "hive" : "hives"}
      </Text>
    </View>
  );
}

function ApiaryHeader({
  name,
  hexColor,
  city,
  hiveCount,
}: {
  name?: string;
  hexColor?: string | null;
  city?: string | null;
  hiveCount: number;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <HeaderNameRow name={name} hexColor={hexColor} />
        <HiveCountBadge count={hiveCount} />
      </View>
      {city && <Text style={styles.headerCity}>{city}</Text>}
    </View>
  );
}

function AddHiveFab({ onPress }: { onPress: () => void }) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={styles.fab} onPress={onPress}>
      <HexIcon size={64} filled fillColor={colors.primaryFill}>
        <Plus size={28} color={colors.textOnPrimary} />
      </HexIcon>
    </Pressable>
  );
}

export default function ApiaryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: apiary, isLoading: apiaryLoading, error: apiaryError } = useApiary(id!);
  const { data: hives, isLoading: hivesLoading } = useHives(id);
  const { data: forecast } = useWeatherForecast(
    apiary?.latitude,
    apiary?.longitude,
  );
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

  function renderHive({ item }: { item: Hive }) {
    return (
      <HiveCard
        hive={item}
        onPress={() => router.push(`/hive/${item.id}` as any)}
      />
    );
  }

  const emptyState = (
    <EmptyState
      title="No hives yet"
      subtitle="Add your first hive to this apiary"
      actionLabel="Add Hive"
      onAction={() => router.push(`/hive/new?apiary_id=${id}` as any)}
    />
  );

  const weatherCard = forecast ? (
    <WeatherForecastCard daily={forecast.daily} city={apiary?.city} />
  ) : null;

  return (
    <View style={styles.container}>
      <ApiaryHeader
        name={apiary?.name}
        hexColor={apiary?.hex_color}
        city={apiary?.city}
        hiveCount={hiveCount}
      />
      {weatherCard && (
        <View style={styles.weatherSection}>{weatherCard}</View>
      )}
      <Pressable
        style={styles.editButton}
        onPress={() => router.push(`/apiary/edit?id=${id}` as any)}
      >
        <Text style={styles.editButtonText}>Edit Apiary</Text>
      </Pressable>
      <FlatList
        data={hives ?? []}
        keyExtractor={(item: Hive) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderHive}
        ListEmptyComponent={emptyState}
      />
      <AddHiveFab onPress={() => router.push(`/hive/new?apiary_id=${id}` as any)} />
    </View>
  );
}
