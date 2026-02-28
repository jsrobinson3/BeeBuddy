import { Redirect, Tabs, Slot, usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Home, ClipboardList, Settings } from "lucide-react-native";

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
  { label: "Apiaries", route: "(home)", href: "/", icon: Home },
  { label: "Tasks", route: "(tasks)", href: "/(tasks)", icon: ClipboardList },
  {
    label: "Settings",
    route: "(settings)",
    href: "/(settings)",
    icon: Settings,
  },
];

const HEX_SIZE = 34;
const ICON_SIZE = 18;

const HOME_PREFIXES = [
  "/apiary", "/hive", "/inspection",
  "/treatment", "/harvest", "/event", "/queen",
];

function isRouteActive(route: string, pathname: string): boolean {
  if (route === "(home)") {
    return pathname === "/"
      || HOME_PREFIXES.some((p) => pathname.startsWith(p));
  }
  if (route === "(tasks)") {
    return pathname.startsWith("/tasks") || pathname === "/cadences";
  }
  if (route === "(settings)") {
    return pathname.startsWith("/settings") || pathname === "/licenses";
  }
  return false;
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
    backgroundColor: c.bgElevated,
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
  pathname: string,
  router: ReturnType<typeof useRouter>,
) {
  const active = isRouteActive(item.route, pathname);
  const go = () => router.push(item.href as any);
  return <SidebarNavItem key={item.route} item={item} isActive={active} onPress={go} />;
}

function SidebarNav({ pathname }: { pathname: string }) {
  const router = useRouter();
  const items = NAV_ITEMS.map((i) => buildNavItem(i, pathname, router));
  return <>{items}</>;
}

/* ------------------------------------------------------------------ */
/*  Desktop sidebar layout                                             */
/* ------------------------------------------------------------------ */

function DesktopLayout() {
  const s = useStyles(createLayoutStyles);
  const pathname = usePathname();

  return (
    <View style={s.wrapper}>
      <View style={s.sidebar}>
        <Text style={s.logo}>BeeBuddy</Text>
        <SidebarNav pathname={pathname} />
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
      <Tabs.Screen name="(home)" options={{ title: "Apiaries" }} />
      <Tabs.Screen name="(tasks)" options={{ title: "Tasks" }} />
      <Tabs.Screen name="(settings)" options={{ title: "Settings" }} />
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
