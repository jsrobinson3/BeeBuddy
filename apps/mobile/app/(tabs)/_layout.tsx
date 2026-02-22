import { Redirect, Tabs } from "expo-router";

import { useAuthStore } from "../../stores/auth";
import { CustomTabBar } from "../../components/CustomTabBar";

const tabScreenOptions = {
  headerShown: false,
};

export default function TabsLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs screenOptions={tabScreenOptions} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="(home)" options={{ title: "Apiaries" }} />
      <Tabs.Screen name="(tasks)" options={{ title: "Tasks" }} />
      <Tabs.Screen name="(settings)" options={{ title: "Settings" }} />
    </Tabs>
  );
}
