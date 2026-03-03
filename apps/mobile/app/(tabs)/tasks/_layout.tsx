import { Stack } from "expo-router";

import { useTheme, typography } from "../../../theme";

export default function TasksLayout() {
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
      <Stack.Screen name="index" options={{ title: "Tasks" }} />
      <Stack.Screen name="cadences" options={{ title: "Task Cadences" }} />
    </Stack>
  );
}
