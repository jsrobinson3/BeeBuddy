import { Redirect, Tabs, Slot, useSegments, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Home, ClipboardList, MessageCircle, Settings } from "lucide-react-native";

import { useAuthStore } from "../../stores/auth";
import { CustomTabBar } from "../../components/CustomTabBar";
import { HexIcon } from "../../components/HexIcon";
import { useResponsive } from "../../hooks/useResponsive";
import {
  useStyles,
  useTheme,
  typography,
  breakpoints,
  type ThemeColors,
} from "../../theme";

/* ------------------------------------------------------------------ */
/*  Nav metadata                                                       */
/* ------------------------------------------------------------------ */

type NavItem = {
  label: string;
  route: string;
  href: string;
  icon: React.ComponentType<{
    size: number;
    color: string;
    strokeWidth?: number;
  }>;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Apiaries", route: "home", href: "/home", icon: Home },
  { label: "Tasks", route: "tasks", href: "/tasks", icon: ClipboardList },
  {
    label: "Buddy",
    route: "chat",
    href: "/chat",
    icon: MessageCircle,
  },
  {
    label: "Settings",
    route: "settings",
    href: "/settings",
    icon: Settings,
  },
];

const HEX_SIZE = 34;
const ICON_SIZE = 18;

// useSegments() returns route segments, e.g. ["(tabs)", "tasks", "cadences"].
// This reliably identifies the active tab.
function isRouteActive(route: string, segments: string[]): boolean {
  return segments.includes(route);
}

/* ------------------------------------------------------------------ */
/*  Sidebar layout styles                                              */
/* ------------------------------------------------------------------ */

const createLayoutStyles = (c: ThemeColors) => ({
  wrapper: {
    flex: 1,
    flexDirection: "row" as const,
    backgroundColor: c.bgPrimary,
  },
  sidebar: {
    width: breakpoints.sidebarWidth,
    backgroundColor: c.bgSurface,
    borderRightWidth: 1,
    borderRightColor: c.borderLight,
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  logo: {
    ...typography.sizes.h3,
    fontFamily: typography.families.displayBold,
    color: c.honey,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  content: {
    flex: 1,
    position: "relative" as const,
  },
});

const createNavStyles = (c: ThemeColors) => ({
  navItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
    cursor: "pointer" as any,
  },
  navItemActive: {
    backgroundColor: c.selectedBg,
  },
  navLabel: {
    ...typography.sizes.body,
    fontFamily: typography.families.bodyMedium,
    color: c.textSecondary,
  },
  navLabelActive: {
    color: c.honey,
    fontFamily: typography.families.bodySemiBold,
  },
});

/* ------------------------------------------------------------------ */
/*  Sidebar nav item                                                   */
/* ------------------------------------------------------------------ */

function NavIcon({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const { colors } = useTheme();
  const iconColor = isActive
    ? colors.textOnPrimary
    : colors.tabBarInactiveTint;
  const IconComponent = item.icon;
  return (
    <HexIcon size={HEX_SIZE} filled={isActive}>
      <IconComponent size={ICON_SIZE} color={iconColor} strokeWidth={2} />
    </HexIcon>
  );
}

interface SidebarNavItemProps {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
}

function SidebarNavItem({ item, isActive, onPress }: SidebarNavItemProps) {
  const s = useStyles(createNavStyles);
  const itemStyle = [s.navItem, isActive && s.navItemActive];
  const labelStyle = [s.navLabel, isActive && s.navLabelActive];
  return (
    <Pressable style={itemStyle} onPress={onPress}>
      <NavIcon item={item} isActive={isActive} />
      <Text style={labelStyle}>{item.label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar nav list (extracted to keep nesting <= 4)                  */
/* ------------------------------------------------------------------ */

function buildNavItem(
  item: NavItem,
  segments: string[],
  router: ReturnType<typeof useRouter>,
) {
  const active = isRouteActive(item.route, segments);
  const go = () => router.replace(item.href as any);
  return <SidebarNavItem key={item.route} item={item} isActive={active} onPress={go} />;
}

function SidebarNav({ segments }: { segments: string[] }) {
  const router = useRouter();
  const items = NAV_ITEMS.map((i) => buildNavItem(i, segments, router));
  return <>{items}</>;
}

/* ------------------------------------------------------------------ */
/*  Desktop sidebar layout                                             */
/* ------------------------------------------------------------------ */

function DesktopLayout() {
  const s = useStyles(createLayoutStyles);
  const segments = useSegments();

  return (
    <View style={s.wrapper}>
      <View style={s.sidebar}>
        <Text style={s.logo}>BeeBuddy</Text>
        <SidebarNav segments={segments} />
      </View>
      <View style={s.content}>
        <Slot />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab bar layout (tablet / mobile on web)                            */
/* ------------------------------------------------------------------ */

const tabScreenOptions = { headerShown: false };

function TabLayout() {
  return (
    <Tabs
      screenOptions={tabScreenOptions}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ title: "Apiaries" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="chat" options={{ title: "Buddy" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export default function WebTabsLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isDesktop } = useResponsive();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return isDesktop ? <DesktopLayout /> : <TabLayout />;
}
