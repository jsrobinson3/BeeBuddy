/**
 * Open-Meteo weather API client.
 * Free, no API key required, works cross-platform.
 */

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CurrentWeather {
  temp_c: number;
  humidity_percent: number;
  wind_speed_kmh: number;
  conditions: string;
  weather_code: number;
}

export interface DayForecast {
  date: string; // "YYYY-MM-DD"
  weather_code: number;
  conditions: string;
  temp_max_c: number;
  temp_min_c: number;
}

export interface WeatherForecast {
  current: CurrentWeather;
  daily: DayForecast[];
}

// ── WMO weather code mapping ─────────────────────────────────────────────────

/**
 * Maps WMO weather interpretation codes to the app's condition strings.
 * See https://open-meteo.com/en/docs — "WMO Weather interpretation codes"
 */
export function mapWeatherCode(code: number): string {
  if (code === 0 || code === 1) return "sunny";
  if (code === 2) return "partly_cloudy";
  if (code === 3) return "cloudy";
  if (code >= 51 && code <= 67) return "rainy"; // drizzle + rain
  if (code >= 71 && code <= 77) return "cloudy"; // snow → cloudy
  if (code >= 80 && code <= 82) return "rainy"; // rain showers
  if (code >= 85 && code <= 86) return "cloudy"; // snow showers
  if (code >= 95 && code <= 99) return "rainy"; // thunderstorms
  // Fog (45, 48) and other
  if (code === 45 || code === 48) return "cloudy";
  return "partly_cloudy";
}

export function conditionsLabel(conditions: string): string {
  switch (conditions) {
    case "sunny": return "Sunny";
    case "partly_cloudy": return "Partly Cloudy";
    case "cloudy": return "Cloudy";
    case "rainy": return "Rainy";
    case "windy": return "Windy";
    default: return conditions;
  }
}

export function conditionsEmoji(conditions: string): string {
  switch (conditions) {
    case "sunny": return "\u2600\uFE0F";
    case "partly_cloudy": return "\u26C5";
    case "cloudy": return "\u2601\uFE0F";
    case "rainy": return "\uD83C\uDF27\uFE0F";
    case "windy": return "\uD83C\uDF2C\uFE0F";
    default: return "\uD83C\uDF24\uFE0F";
  }
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  days = 7,
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: String(days),
  });

  const response = await fetch(`${BASE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();

  const currentCode: number = data.current.weather_code;

  const current: CurrentWeather = {
    temp_c: data.current.temperature_2m,
    humidity_percent: data.current.relative_humidity_2m,
    wind_speed_kmh: data.current.wind_speed_10m,
    conditions: mapWeatherCode(currentCode),
    weather_code: currentCode,
  };

  const daily: DayForecast[] = (data.daily.time as string[]).map(
    (date: string, i: number) => {
      const code: number = data.daily.weather_code[i];
      return {
        date,
        weather_code: code,
        conditions: mapWeatherCode(code),
        temp_max_c: data.daily.temperature_2m_max[i],
        temp_min_c: data.daily.temperature_2m_min[i],
      };
    },
  );

  return { current, daily };
}

export async function fetchCurrentWeather(
  lat: number,
  lng: number,
): Promise<CurrentWeather> {
  const forecast = await fetchWeatherForecast(lat, lng, 1);
  return forecast.current;
}
