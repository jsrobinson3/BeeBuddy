import type { DayForecast } from "../services/weather";
import type { Task, Apiary } from "../services/api.types";

const GOOD_CONDITIONS = new Set(["sunny", "partly_cloudy"]);
const MIN_INSPECTION_TEMP_C = 15;
const MAX_INSPECTION_TEMP_C = 30;
const EXTREME_COLD_C = 10;
const EXTREME_HOT_C = 38;

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
  task: Task,
  apiaries: Apiary[],
): string | null {
  if (task.apiary_id) {
    const apiary = apiaries.find((a) => a.id === task.apiary_id);
    return apiary?.name ?? null;
  }
  return null;
}

export function generateInsights(
  daily: DayForecast[],
  tasks: Task[],
  apiaries: Apiary[],
  useFahrenheit?: boolean,
): string[] {
  if (daily.length === 0) return [];

  const insights: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Look at pending tasks with due dates in the forecast range
  const pendingTasks = tasks.filter((t) => !t.completed_at && t.due_date);

  for (const task of pendingTasks) {
    if (insights.length >= 3) break;

    const dayForecast = daily.find((d) => isSameDate(d.date, task.due_date!));
    if (!dayForecast) continue;

    const dayName = getDayName(dayForecast.date);
    const apiaryName = findApiaryName(task, apiaries);
    const locationSuffix = apiaryName ? ` at ${apiaryName}` : "";

    if (isDayGoodForInspection(dayForecast)) {
      insights.push(
        `${dayName} will be ${dayForecast.conditions === "sunny" ? "clear skies" : "fair weather"} \u2014 perfect for your upcoming ${task.title.toLowerCase()}${locationSuffix}`,
      );
    } else if (dayForecast.conditions === "rainy") {
      const betterDay = findBestDay(daily);
      if (betterDay) {
        const betterName = getDayName(betterDay.date);
        insights.push(
          `Rain expected ${dayName.toLowerCase()} \u2014 consider moving your ${task.title.toLowerCase()}${locationSuffix} to ${betterName.toLowerCase()}`,
        );
      } else {
        insights.push(
          `Rain expected ${dayName.toLowerCase()} for your ${task.title.toLowerCase()}${locationSuffix} \u2014 plan to reschedule`,
        );
      }
    }
  }

  // If no task-specific insights, provide general weather guidance
  if (insights.length === 0) {
    const todayForecast = daily[0];
    if (todayForecast) {
      if (todayForecast.temp_max_c < EXTREME_COLD_C) {
        insights.push(
          `Cold temperatures today (${formatTemp(todayForecast.temp_max_c, useFahrenheit)}) \u2014 avoid opening hives to keep the colony warm`,
        );
      } else if (todayForecast.temp_max_c > EXTREME_HOT_C) {
        insights.push(
          `Extreme heat today (${formatTemp(todayForecast.temp_max_c, useFahrenheit)}) \u2014 ensure hives have adequate ventilation and water`,
        );
      }
    }

    const bestDay = findBestDay(daily);
    if (bestDay) {
      const bestName = getDayName(bestDay.date);
      insights.push(
        `${bestName} looks ideal for hive inspections \u2014 ${formatTemp(bestDay.temp_max_c, useFahrenheit)} and ${bestDay.conditions === "sunny" ? "sunny" : "fair"}`,
      );
    }
  }

  return insights.slice(0, 3);
}
