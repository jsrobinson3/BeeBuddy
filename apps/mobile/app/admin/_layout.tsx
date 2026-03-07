import { Redirect, Stack } from "expo-router";

import { useAuthStore } from "../../stores/auth";
import { useTheme, typography } from "../../theme";

const hiddenHeader = { headerShown: false };

export default function AdminLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const { colors } = useTheme();

  if (!isAuthenticated || !user?.isAdmin) {
    return <Redirect href="/" />;
  }

  const screenOptions = {
    headerStyle: { backgroundColor: colors.headerBackground },
    headerTintColor: colors.headerTint,
    headerTitleStyle: { fontFamily: typography.families.displayBold },
    contentStyle: { backgroundColor: colors.bgPrimary },
  };

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: "Admin" }} />
      <Stack.Screen name="users" options={{ title: "Users" }} />
      <Stack.Screen name="user-detail" options={{ title: "User Detail" }} />
      <Stack.Screen name="oauth-clients" options={{ title: "OAuth Clients" }} />
      <Stack.Screen name="system" options={{ title: "System Info" }} />
    </Stack>
  );
}
