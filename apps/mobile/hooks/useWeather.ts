import { useQuery } from "@tanstack/react-query";
import {
  fetchCurrentWeather,
  fetchWeatherForecast,
} from "../services/weather";

export function useCurrentWeather(
  lat?: number | null,
  lng?: number | null,
) {
  return useQuery({
    queryKey: ["weather", "current", lat, lng],
    queryFn: () => fetchCurrentWeather(lat!, lng!),
    enabled: lat != null && lng != null,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useWeatherForecast(
  lat?: number | null,
  lng?: number | null,
  days = 7,
) {
  return useQuery({
    queryKey: ["weather", "forecast", lat, lng],
    queryFn: () => fetchWeatherForecast(lat!, lng!, days),
    enabled: lat != null && lng != null,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
