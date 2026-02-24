import { Text, View } from "react-native";

import { useCurrentWeather } from "../hooks/useWeather";
import { useUnits } from "../hooks/useUnits";
import type { CurrentWeather } from "../services/weather";
import { conditionsEmoji, conditionsLabel } from "../services/weather";
import {
  useStyles,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../theme";

const createStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    ...shadows.card,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  emoji: {
    fontSize: 32,
    marginRight: spacing.sm + 4,
  },
  tempText: {
    ...typography.sizes.h2,
    fontFamily: typography.families.displayBold,
    color: c.textPrimary,
  },
  conditionText: {
    ...typography.sizes.bodySm,
    fontFamily: typography.families.bodyMedium,
    color: c.textSecondary,
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: "row" as const,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  detailItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  detailLabel: {
    ...typography.sizes.caption,
    fontFamily: typography.families.body,
    color: c.textMuted,
    marginRight: 4,
  },
  detailValue: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodyMedium,
    color: c.textSecondary,
  },
  loadingText: {
    ...typography.sizes.caption,
    fontFamily: typography.families.body,
    color: c.textMuted,
    textAlign: "center" as const,
    paddingVertical: spacing.sm,
  },
});

function WeatherDetails({ weather }: { weather: CurrentWeather }) {
  const styles = useStyles(createStyles);
  const units = useUnits();

  const temp = units.toDisplayTemp(weather.temp_c);
  const wind = units.toDisplayWindSpeed(weather.wind_speed_kmh);

  return (
    <>
      <View style={styles.row}>
        <Text style={styles.emoji}>
          {conditionsEmoji(weather.conditions)}
        </Text>
        <View>
          <Text style={styles.tempText}>
            {Math.round(temp)}{units.tempLabel}
          </Text>
          <Text style={styles.conditionText}>
            {conditionsLabel(weather.conditions)}
          </Text>
        </View>
      </View>
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Humidity</Text>
          <Text style={styles.detailValue}>
            {weather.humidity_percent}%
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Wind</Text>
          <Text style={styles.detailValue}>
            {Math.round(wind)} {units.windSpeedLabel}
          </Text>
        </View>
      </View>
    </>
  );
}

export function WeatherCard({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const styles = useStyles(createStyles);
  const { data: weather, isLoading } = useCurrentWeather(lat, lng);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>Fetching weather...</Text>
      </View>
    );
  }

  if (!weather) return null;

  return (
    <View style={styles.card}>
      <WeatherDetails weather={weather} />
    </View>
  );
}
