import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { DatabaseProvider } from "@nozbe/watermelondb/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { database } from "../database";
import { useSyncOnForeground } from "../database/useSyncOnForeground";
import { queryClient } from "../services/queryClient";
import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";
import { ThemeProvider, useTheme, typography } from "../theme";

SplashScreen.preventAutoHideAsync();

const hiddenHeader = { headerShown: false };

const navFonts = {
  regular: { fontFamily: typography.families.body, fontWeight: "400" as const },
  medium: { fontFamily: typography.families.bodyMedium, fontWeight: "500" as const },
  bold: { fontFamily: typography.families.bodyBold, fontWeight: "700" as const },
  heavy: { fontFamily: typography.families.display, fontWeight: "800" as const },
};

function AppStack() {
  const { colors, isDark } = useTheme();

  const navTheme = useMemo(
    () => ({
      dark: isDark,
      colors: {
        primary: colors.honey,
        background: colors.bgPrimary,
        card: colors.bgSurface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.danger,
      },
      fonts: navFonts,
    }),
    [colors, isDark],
  );

  const screenOptions = {
    headerStyle: { backgroundColor: colors.headerBackground },
    headerTintColor: colors.headerTint,
    headerTitleStyle: { fontFamily: typography.families.displayBold },
    contentStyle: { backgroundColor: colors.bgPrimary },
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(auth)" options={hiddenHeader} />
        <Stack.Screen name="(tabs)" options={hiddenHeader} />
      </Stack>
    </NavigationThemeProvider>
  );
}

function SyncManager() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Only sync on native platforms where WatermelonDB is available
  if (Platform.OS !== "web" && isAuthenticated) {
    useSyncOnForeground();
  }
  return null;
}

function RootNav() {
  const { isDark } = useTheme();
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const isAuthHydrated = useAuthStore((s) => s.isHydrated);
  const hydrateTheme = useThemeStore(
    (s: { hydrate: () => Promise<void> }) => s.hydrate,
  );
  const isThemeHydrated = useThemeStore(
    (s: { isHydrated: boolean }) => s.isHydrated,
  );

  const [fontsLoaded] = useFonts({
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
    "JetBrainsMono-Regular": require("../assets/fonts/JetBrainsMono-Regular.ttf"),
  });

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
  }, [hydrateAuth, hydrateTheme]);

  useEffect(() => {
    if (fontsLoaded && isAuthHydrated && isThemeHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isAuthHydrated, isThemeHydrated]);

  if (!fontsLoaded || !isAuthHydrated || !isThemeHydrated) {
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SyncManager />
      <AppStack />
    </>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const inner = (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );

  // WatermelonDB only works on native platforms
  if (Platform.OS === "web") {
    return inner;
  }

  return <DatabaseProvider database={database}>{inner}</DatabaseProvider>;
}

export default function RootLayout() {
  return (
    <Providers>
      <RootNav />
    </Providers>
  );
}
