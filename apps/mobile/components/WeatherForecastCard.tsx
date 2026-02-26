import { Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { useUnits } from "../hooks/useUnits";
import type { DayForecast } from "../services/weather";
import { conditionsEmoji } from "../services/weather";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../theme";
import {
  GOOD_CONDITIONS,
  MIN_INSPECTION_TEMP_C,
  MAX_INSPECTION_TEMP_C,
} from "../utils/weatherConstants";

/* ---------- Styles ---------- */

const createCardStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "baseline" as const,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.sizes.h4,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
  },
  location: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodyMedium,
    color: c.textMuted,
  },
  daysRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: spacing.xs,
  },
});

const createDayStyles = (c: ThemeColors) => ({
  dayCol: {
    alignItems: "center" as const,
    flex: 1,
  },
  dayLabel: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodyMedium,
    color: c.textMuted,
    marginBottom: spacing.sm,
  },
  todayLabel: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
  emoji: { fontSize: 26, marginBottom: spacing.sm },
  temp: {
    ...typography.sizes.h4,
    fontFamily: typography.families.displayBold,
    color: c.textPrimary,
  },
});

const createBadgeStyles = (c: ThemeColors) => ({
  badgeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: spacing.md,
  },
  badge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: c.forestPale,
    borderRadius: radii.pill,
    paddingLeft: spacing.sm + 4,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  badgeText: {
    ...typography.sizes.caption,
    fontFamily: typography.families.bodySemiBold,
    color: c.success,
  },
});

/* ---------- Helpers ---------- */

function getDayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function hasIdealDay(days: DayForecast[]): boolean {
  return days.some(
    (d) =>
      GOOD_CONDITIONS.has(d.conditions) &&
      d.temp_max_c >= MIN_INSPECTION_TEMP_C &&
      d.temp_max_c <= MAX_INSPECTION_TEMP_C,
  );
}

/* ---------- Sub-components ---------- */

function DayColumn({
  day,
  index,
  toTemp,
  tempLabel,
}: {
  day: DayForecast;
  index: number;
  toTemp: (c: number) => number;
  tempLabel: string;
}) {
  const s = useStyles(createDayStyles);
  const temp = Math.round(toTemp(day.temp_max_c));
  const isToday = index === 0;
  return (
    <View style={s.dayCol}>
      <Text style={isToday ? s.todayLabel : s.dayLabel}>
        {getDayLabel(day.date, index)}
      </Text>
      <Text style={s.emoji}>{conditionsEmoji(day.conditions)}</Text>
      <Text style={s.temp}>
        {temp}
        {tempLabel}
      </Text>
    </View>
  );
}

function InspectionBadge() {
  const s = useStyles(createBadgeStyles);
  const { colors } = useTheme();
  return (
    <View style={s.badgeRow}>
      <View style={s.badge}>
        <Text style={s.badgeText}>Ideal for Inspection</Text>
        <ChevronRight size={14} color={colors.success} />
      </View>
    </View>
  );
}

/* ---------- Main ---------- */

export function WeatherForecastCard({
  daily,
  city,
}: {
  daily: DayForecast[];
  city?: string | null;
}) {
  const s = useStyles(createCardStyles);
  const units = useUnits();

  if (daily.length === 0) return null;

  const displayed = daily.slice(0, 5);
  const ideal = hasIdealDay(displayed);

  const days = displayed.map((day, i) => (
    <DayColumn
      key={day.date}
      day={day}
      index={i}
      toTemp={units.toDisplayTemp}
      tempLabel={units.tempLabel}
    />
  ));

  return (
    <View style={s.card}>
      <ForecastHeader city={city} />
      <View style={s.daysRow}>{days}</View>
      {ideal && <InspectionBadge />}
    </View>
  );
}

function ForecastHeader({ city }: { city?: string | null }) {
  const s = useStyles(createCardStyles);
  return (
    <View style={s.headerRow}>
      <Text style={s.title}>Weather Forecast</Text>
      {city && <Text style={s.location}>{city}</Text>}
    </View>
  );
}
