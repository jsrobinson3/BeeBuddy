import { Platform } from "react-native";

function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (!configured) return "http://localhost:8000";

  // When the web page is served from localhost but the env var points to a
  // private/LAN IP (common in WSL2), rewrite to localhost so the API request
  // stays same-site and SameSite=Lax cookies are delivered.  If the page is
  // already on the LAN IP (e.g. start:wsl), keep the URL as-is so cookies
  // stay same-site with the page origin.
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const url = new URL(configured);
      const ip = url.hostname;
      const pageHost = window.location.hostname;
      if (
        pageHost === "localhost" &&
        /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip)
      ) {
        return `http://localhost:${url.port || "8000"}`;
      }
    } catch {
      // malformed URL — fall through
    }
  }

  return configured;
}

export const API_BASE_URL = resolveApiUrl();
