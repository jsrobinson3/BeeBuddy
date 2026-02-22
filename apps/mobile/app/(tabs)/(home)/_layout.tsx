import { Stack } from "expo-router";

import { useTheme, typography } from "../../../theme";

export default function HomeLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.headerTint,
        headerTitleStyle: { fontFamily: typography.families.displayBold },
        contentStyle: { backgroundColor: colors.bgPrimary },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Apiaries" }} />
      <Stack.Screen name="apiary/[id]" options={{ title: "Apiary Details" }} />
      <Stack.Screen name="apiary/new" options={{ title: "New Apiary" }} />
      <Stack.Screen name="hive/[id]" options={{ title: "Hive Details" }} />
      <Stack.Screen name="hive/new" options={{ title: "New Hive" }} />
      <Stack.Screen name="inspection/[id]" options={{ title: "Inspection" }} />
      <Stack.Screen name="inspection/new" options={{ title: "New Inspection" }} />
      <Stack.Screen name="inspection/edit" options={{ title: "Edit Inspection" }} />
      <Stack.Screen name="treatment/new" options={{ title: "New Treatment" }} />
      <Stack.Screen name="queen/new" options={{ title: "New Queen" }} />
      <Stack.Screen name="harvest/new" options={{ title: "New Harvest" }} />
      <Stack.Screen name="event/new" options={{ title: "New Event" }} />
    </Stack>
  );
}
