/**
 * Custom hexagonal tab bar for BeeBuddy.
 *
 * Each tab icon is a Lucide icon wrapped in a HexIcon frame.
 * Active tabs get a filled hex background with forest-coloured icons;
 * inactive tabs get an unfilled outline with muted icons.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, ClipboardList, Settings } from "lucide-react-native";

import { HexIcon } from "./HexIcon";
import { useStyles, useTheme, typography, type ThemeColors } from "../theme";

/* ------------------------------------------------------------------ */
/*  Tab metadata                                                      */
/* ------------------------------------------------------------------ */

type TabMeta = {
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
};

const TAB_META: Record<string, TabMeta> = {
  "(home)": { label: "Apiaries", icon: Home },
  "(tasks)": { label: "Tasks", icon: ClipboardList },
  "(settings)": { label: "Settings", icon: Settings },
};

const HEX_SIZE = 34;
const ICON_SIZE = 18;

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function TabItem({
  meta,
  isFocused,
  onPress,
  onLongPress,
}: {
  meta: TabMeta;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const IconComponent = meta.icon;

  const iconColor = isFocused ? colors.textOnPrimary : colors.tabBarInactiveTint;
  const labelColor = isFocused ? colors.honey : colors.tabBarInactiveTint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : undefined}
      accessibilityLabel={meta.label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
    >
      <HexIcon size={HEX_SIZE} filled={isFocused}>
        <IconComponent size={ICON_SIZE} color={iconColor} strokeWidth={2} />
      </HexIcon>
      <Text style={[styles.label, { color: labelColor }]}>{meta.label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function useTabItems(state: BottomTabBarProps["state"], navigation: BottomTabBarProps["navigation"]) {
  return state.routes.map((route, index) => {
    const meta = TAB_META[route.name];
    if (!meta) return null;

    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation.emit({ type: "tabLongPress", target: route.key });
    };

    return (
      <TabItem
        key={route.key}
        meta={meta}
        isFocused={isFocused}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(createStyles);
  const tabs = useTabItems(state, navigation);

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {tabs}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const createStyles = (c: ThemeColors) => ({
  bar: {
    flexDirection: "row" as const,
    backgroundColor: c.tabBarBg,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
  },
  label: {
    fontFamily: typography.families.bodyMedium,
    fontSize: typography.sizes.caption.fontSize,
    lineHeight: typography.sizes.caption.lineHeight,
  },
});
