import { create } from "zustand";
import { Platform } from "react-native";
import { api } from "../services/api";
import { API_BASE_URL } from "../services/config";
import { queryClient } from "../services/queryClient";
import { database } from "../database";
import { syncDatabase } from "../database/sync";

const isWeb = Platform.OS === "web";

// Only import SecureStore on native — web uses HttpOnly cookies
const SecureStore: typeof import("expo-secure-store") | null = isWeb
  ? null
  : require("expo-secure-store");

const TOKEN_KEY = "beebuddy_access_token";
const REFRESH_TOKEN_KEY = "beebuddy_refresh_token";

export type User = {
  id: string;
  name: string | null;
  email: string;
  experience_level: string | null;
};

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
};

type AuthActions = {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string, name?: string | null) => Promise<void>;
  loginWithApple: (idToken: string, name?: string | null, email?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hydrate: () => Promise<void>;
  fetchUser: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Helpers extracted to keep store methods shallow (max nesting depth <= 4)
// ---------------------------------------------------------------------------

function parseUser(data: Record<string, unknown>): User {
  if (typeof data.id !== "string" || typeof data.email !== "string") {
    throw new Error("Invalid user data");
  }
  return {
    id: data.id,
    email: data.email,
    name: (data.name as string) ?? null,
    experience_level: (data.experience_level as string) ?? null,
  };
}

async function authFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  if (isWeb) {
    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "BeeBuddy",
        ...options.headers,
      },
    });
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/** Persist tokens into SecureStore (native only). */
async function saveTokens(access: string, refresh: string): Promise<void> {
  await SecureStore!.setItemAsync(TOKEN_KEY, access);
  await SecureStore!.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}

/** Remove tokens from SecureStore (native only). */
async function clearTokens(): Promise<void> {
  await SecureStore!.deleteItemAsync(TOKEN_KEY);
  await SecureStore!.deleteItemAsync(REFRESH_TOKEN_KEY);
}

/** Invalidate tokens server-side and clear SecureStore (native only). */
async function invalidateAndClearTokens(
  accessToken: string | null,
  refreshToken: string | null,
): Promise<void> {
  await authFetch("/api/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
  }).catch(() => {});
  await clearTokens();
}

/** Read tokens from SecureStore (native only). */
async function loadTokens(): Promise<{ token: string; refreshToken: string } | null> {
  const token = await SecureStore!.getItemAsync(TOKEN_KEY);
  const refreshToken = await SecureStore!.getItemAsync(REFRESH_TOKEN_KEY);
  if (token && refreshToken) return { token, refreshToken };
  return null;
}

/** Probe the /users/me endpoint (web only, cookies provide auth). */
async function probeSession(): Promise<User | null> {
  const res = await authFetch("/api/v1/users/me");
  if (!res.ok) return null;
  return parseUser(await res.json());
}

/** Fetch user profile with a Bearer token (native only). */
async function fetchUserWithToken(token: string): Promise<{ user: User | null; unauthorized: boolean }> {
  const res = await authFetch("/api/v1/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { user: null, unauthorized: res.status === 401 };
  return { user: parseUser(await res.json()), unauthorized: false };
}

/** Fetch user profile via cookies (web only). */
async function fetchUserWithCookie(): Promise<{ user: User | null; unauthorized: boolean }> {
  const res = await authFetch("/api/v1/users/me");
  if (!res.ok) return { user: null, unauthorized: res.status === 401 };
  return { user: parseUser(await res.json()), unauthorized: false };
}

/** Throw a typed error from a failed auth response. */
async function throwAuthError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.detail || fallback);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => {
  // Register refresh/logout callbacks so the API client can trigger them on 401
  api.setAuthCallbacks(
    () => get().refresh(),
    () => get().logout(),
  );

  return {
  token: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,

  login: async (email, password) => {
    const res = await authFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) await throwAuthError(res, "Login failed");

    if (!isWeb) {
      const data = await res.json();
      await saveTokens(data.access_token, data.refresh_token);
      api.setToken(data.access_token);
      set({ token: data.access_token, refreshToken: data.refresh_token });
    }

    set({ isAuthenticated: true });
    await get().fetchUser();
    if (!isWeb) syncDatabase();
  },

  register: async (name, email, password) => {
    const res = await authFetch("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: name || undefined, email, password }),
    });

    if (!res.ok) await throwAuthError(res, "Registration failed");

    if (!isWeb) {
      const data = await res.json();
      await saveTokens(data.access_token, data.refresh_token);
      api.setToken(data.access_token);
      set({ token: data.access_token, refreshToken: data.refresh_token });
    }

    set({ isAuthenticated: true });
    await get().fetchUser();
    if (!isWeb) syncDatabase();
  },

  loginWithGoogle: async (idToken, name) => {
    const res = await authFetch("/api/v1/auth/oauth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken, name: name || undefined }),
    });

    if (!res.ok) await throwAuthError(res, "Google sign-in failed");

    if (!isWeb) {
      const data = await res.json();
      await saveTokens(data.access_token, data.refresh_token);
      api.setToken(data.access_token);
      set({ token: data.access_token, refreshToken: data.refresh_token });
    }

    set({ isAuthenticated: true });
    await get().fetchUser();
    if (!isWeb) syncDatabase();
  },

  loginWithApple: async (idToken, name, email) => {
    const res = await authFetch("/api/v1/auth/oauth/apple", {
      method: "POST",
      body: JSON.stringify({
        id_token: idToken,
        name: name || undefined,
        email: email || undefined,
      }),
    });

    if (!res.ok) await throwAuthError(res, "Apple sign-in failed");

    if (!isWeb) {
      const data = await res.json();
      await saveTokens(data.access_token, data.refresh_token);
      api.setToken(data.access_token);
      set({ token: data.access_token, refreshToken: data.refresh_token });
    }

    set({ isAuthenticated: true });
    await get().fetchUser();
    if (!isWeb) syncDatabase();
  },

  logout: async () => {
    try {
      if (isWeb) {
        await authFetch("/api/v1/auth/logout", { method: "POST" });
      } else {
        await invalidateAndClearTokens(get().token, get().refreshToken);
      }
    } catch {
      // Network error or server down — still clear client state below
    } finally {
      api.setToken(undefined);
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
      queryClient.clear();
      if (!isWeb) {
        try {
          await database.write(() => database.unsafeResetDatabase());
        } catch {
          // Database reset failed — not critical
        }
      }
    }
  },

  refresh: async () => {
    if (isWeb) {
      const res = await authFetch("/api/v1/auth/refresh", { method: "POST" });
      if (!res.ok) { await get().logout(); throw new Error("Token refresh failed"); }
      return;
    }

    const currentRefreshToken = get().refreshToken;
    if (!currentRefreshToken) throw new Error("No refresh token available");

    const res = await authFetch("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: currentRefreshToken }),
    });

    if (!res.ok) { await get().logout(); throw new Error("Token refresh failed"); }

    const data = await res.json();
    await saveTokens(data.access_token, data.refresh_token);
    api.setToken(data.access_token);
    set({ token: data.access_token, refreshToken: data.refresh_token });
  },

  hydrate: async () => {
    try {
      if (isWeb) {
        const user = await probeSession();
        if (user) set({ isAuthenticated: true, user });
        return;
      }

      const stored = await loadTokens();
      if (!stored) return;
      api.setToken(stored.token);
      set({ token: stored.token, refreshToken: stored.refreshToken, isAuthenticated: true });
      await get().fetchUser();
    } catch {
      // Tokens invalid or expired — stay logged out
    } finally {
      set({ isHydrated: true });
    }
  },

  fetchUser: async () => {
    const result = isWeb
      ? await fetchUserWithCookie()
      : await fetchUserWithToken(get().token ?? "");

    if (result.unauthorized) { await get().logout(); return; }
    if (result.user) set({ user: result.user });
  },
};});
