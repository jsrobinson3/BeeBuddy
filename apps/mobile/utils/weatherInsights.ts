import type { DayForecast } from "../services/weather";
import {
  GOOD_CONDITIONS,
  MIN_INSPECTION_TEMP_C,
  MAX_INSPECTION_TEMP_C,
  EXTREME_COLD_C,
  EXTREME_HOT_C,
} from "./weatherConstants";

/** Minimal task shape used by weather insights — works with both API types and WatermelonDB models. */
export interface WeatherTask {
  title: string;
  completedAt: number | string | null;
  dueDate: string | null;
  apiaryId: string | null;
}

/** Minimal apiary shape used by weather insights. */
export interface WeatherApiary {
  id: string;
  name: string;
}

function formatTemp(celsius: number, useFahrenheit?: boolean): string {
  if (useFahrenheit) return `${Math.round(celsius * 9/5 + 32)}\u00b0F`;
  return `${Math.round(celsius)}\u00b0C`;
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function isSameDate(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function isDayGoodForInspection(day: DayForecast): boolean {
  return (
    GOOD_CONDITIONS.has(day.conditions) &&
    day.temp_max_c >= MIN_INSPECTION_TEMP_C &&
    day.temp_max_c <= MAX_INSPECTION_TEMP_C
  );
}

function findBestDay(daily: DayForecast[]): DayForecast | null {
  // Skip today, look at upcoming days
  const upcoming = daily.slice(1);
  const good = upcoming.filter(isDayGoodForInspection);
  if (good.length === 0) return null;
  // Prefer the sunniest day closest to ideal temp
  return good.sort((a, b) => {
    const aScore = a.conditions === "sunny" ? 1 : 0;
    const bScore = b.conditions === "sunny" ? 1 : 0;
    if (aScore !== bScore) return bScore - aScore;
    const idealTemp = 22;
    return Math.abs(a.temp_max_c - idealTemp) - Math.abs(b.temp_max_c - idealTemp);
  })[0];
}

function findApiaryName(
  task: WeatherTask,
  apiaries: WeatherApiary[],
): string | null {
  if (task.apiaryId) {
    const apiary = apiaries.find((a) => a.id === task.apiaryId);
    return apiary?.name ?? null;
  }
  return null;
}

function taskInsight(
  task: WeatherTask,
  dayForecast: DayForecast,
  daily: DayForecast[],
  apiaries: WeatherApiary[],
): string | null {
  const dayName = getDayName(dayForecast.date);
  const apiaryName = findApiaryName(task, apiaries);
  const suffix = apiaryName ? ` at ${apiaryName}` : "";
  const label = task.title.toLowerCase();

  if (isDayGoodForInspection(dayForecast)) {
    const sky = dayForecast.conditions === "sunny"
      ? "clear skies"
      : "fair weather";
    return (
      `${dayName} will be ${sky} \u2014 perfect for` +
      ` your upcoming ${label}${suffix}`
    );
  }

  if (dayForecast.conditions !== "rainy") return null;

  const betterDay = findBestDay(daily);
  const day = dayName.toLowerCase();
  if (betterDay) {
    const alt = getDayName(betterDay.date).toLowerCase();
    return (
      `Rain expected ${day} \u2014 consider moving` +
      ` your ${label}${suffix} to ${alt}`
    );
  }
  return (
    `Rain expected ${day} for your` +
    ` ${label}${suffix} \u2014 plan to reschedule`
  );
}

function extremeTempInsight(
  day: DayForecast,
  useFahrenheit?: boolean,
): string | null {
  const temp = formatTemp(day.temp_max_c, useFahrenheit);
  if (day.temp_max_c < EXTREME_COLD_C) {
    return (
      `Cold temperatures today (${temp})` +
      ` \u2014 avoid opening hives to keep the colony warm`
    );
  }
  if (day.temp_max_c > EXTREME_HOT_C) {
    return (
      `Extreme heat today (${temp}) \u2014 ensure` +
      ` hives have adequate ventilation and water`
    );
  }
  return null;
}

function bestDayInsight(
  daily: DayForecast[],
  useFahrenheit?: boolean,
): string | null {
  const bestDay = findBestDay(daily);
  if (!bestDay) return null;
  const name = getDayName(bestDay.date);
  const temp = formatTemp(bestDay.temp_max_c, useFahrenheit);
  const sky = bestDay.conditions === "sunny" ? "sunny" : "fair";
  return (
    `${name} looks ideal for hive inspections` +
    ` \u2014 ${temp} and ${sky}`
  );
}

export function generateInsights(
  daily: DayForecast[],
  tasks: WeatherTask[],
  apiaries: WeatherApiary[],
  useFahrenheit?: boolean,
): string[] {
  if (daily.length === 0) return [];

  const insights: string[] = [];
  const pendingTasks = tasks.filter(
    (t) => !t.completedAt && t.dueDate,
  );

  for (const task of pendingTasks) {
    if (insights.length >= 3) break;
    const forecast = daily.find(
      (d) => isSameDate(d.date, task.dueDate!),
    );
    if (!forecast) continue;
    const msg = taskInsight(task, forecast, daily, apiaries);
    if (msg) insights.push(msg);
  }

  // If no task-specific insights, provide general weather guidance
  if (insights.length === 0) {
    const todayForecast = daily[0];
    if (todayForecast) {
      const tempMsg = extremeTempInsight(todayForecast, useFahrenheit);
      if (tempMsg) insights.push(tempMsg);
    }
    const bestMsg = bestDayInsight(daily, useFahrenheit);
    if (bestMsg) insights.push(bestMsg);
  }

  return insights.slice(0, 3);
}
