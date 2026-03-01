import { Stack } from "expo-router";

export default function HomeWebLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="apiary/[id]" />
      <Stack.Screen name="apiary/new" />
      <Stack.Screen name="hive/[id]" />
      <Stack.Screen name="hive/new" />
      <Stack.Screen name="inspection/[id]" />
      <Stack.Screen name="inspection/new" />
      <Stack.Screen name="inspection/edit" />
      <Stack.Screen name="apiary/edit" />
      <Stack.Screen name="hive/edit" />
      <Stack.Screen name="treatment/new" />
      <Stack.Screen name="treatment/[id]" />
      <Stack.Screen name="treatment/edit" />
      <Stack.Screen name="queen/new" />
      <Stack.Screen name="harvest/new" />
      <Stack.Screen name="harvest/[id]" />
      <Stack.Screen name="harvest/edit" />
      <Stack.Screen name="event/new" />
      <Stack.Screen name="event/[id]" />
      <Stack.Screen name="event/edit" />
    </Stack>
  );
}
