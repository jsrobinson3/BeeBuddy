import { useCallback } from "react";
import { FlatList, Linking, Pressable, Text, View } from "react-native";

import { useStyles, typography, type ThemeColors } from "../../../theme";

interface License {
  name: string;
  license: string;
  url: string;
}

const LICENSES: License[] = [
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "React Native", license: "MIT", url: "https://github.com/facebook/react-native" },
  { name: "Expo", license: "MIT", url: "https://github.com/expo/expo" },
  { name: "Expo Router", license: "MIT", url: "https://github.com/expo/router" },
  { name: "TanStack Query", license: "MIT", url: "https://github.com/TanStack/query" },
  { name: "Zustand", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "Lucide Icons", license: "ISC", url: "https://github.com/lucide-icons/lucide" },
  {
    name: "React Native SVG", license: "MIT",
    url: "https://github.com/software-mansion/react-native-svg",
  },
  {
    name: "React Native Reanimated", license: "MIT",
    url: "https://github.com/software-mansion/react-native-reanimated",
  },
  {
    name: "React Native Gesture Handler", license: "MIT",
    url: "https://github.com/software-mansion/react-native-gesture-handler",
  },
  {
    name: "React Native Screens", license: "MIT",
    url: "https://github.com/software-mansion/react-native-screens",
  },
  {
    name: "React Native Safe Area Context", license: "MIT",
    url: "https://github.com/th3rdwave/react-native-safe-area-context",
  },
  { name: "Expo Image", license: "MIT", url: "https://github.com/expo/expo/tree/main/packages/expo-image" },
  {
    name: "Expo Linear Gradient", license: "MIT",
    url: "https://github.com/expo/expo/tree/main/packages/expo-linear-gradient",
  },
  {
    name: "Expo Location", license: "MIT",
    url: "https://github.com/expo/expo/tree/main/packages/expo-location",
  },
  {
    name: "Expo Secure Store", license: "MIT",
    url: "https://github.com/expo/expo/tree/main/packages/expo-secure-store",
  },
  { name: "DateTimePicker", license: "MIT", url: "https://github.com/react-native-datetimepicker/datetimepicker" },
  { name: "FastAPI", license: "MIT", url: "https://github.com/tiangolo/fastapi" },
  { name: "SQLAlchemy", license: "MIT", url: "https://github.com/sqlalchemy/sqlalchemy" },
  { name: "Pydantic", license: "MIT", url: "https://github.com/pydantic/pydantic" },
];

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  list: { padding: 16, paddingBottom: 40 },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    backgroundColor: c.bgElevated,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  name: {
    fontSize: 15,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
    flex: 1,
  },
  badge: {
    backgroundColor: c.honeyPale,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
});

function LicenseRow({ item }: { item: License }) {
  const styles = useStyles(createStyles);
  return (
    <Pressable style={styles.row} onPress={() => Linking.openURL(item.url)}>
      <Text style={styles.name}>{item.name}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{item.license}</Text>
      </View>
    </Pressable>
  );
}

export default function LicensesScreen() {
  const styles = useStyles(createStyles);
  const renderItem = useCallback(
    ({ item }: { item: License }) => <LicenseRow item={item} />,
    [],
  );
  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={LICENSES}
      keyExtractor={(item) => item.name}
      renderItem={renderItem}
    />
  );
}
