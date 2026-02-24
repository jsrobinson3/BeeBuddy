import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SegmentedControl } from "../../../components/SegmentedControl";
import {
  useCurrentUser,
  useUpdateUser,
  useUpdatePreferences,
} from "../../../hooks/useUser";
import { useAuthStore } from "../../../stores/auth";
import { useThemeStore } from "../../../stores/theme";
import { useStyles, typography, type ThemeColors } from "../../../theme";

const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const UNIT_OPTIONS = ["Metric", "Imperial"];
const HEMISPHERE_OPTIONS = ["Auto", "North", "South"];
const THEME_OPTIONS = ["System", "Light", "Dark"];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const createLayoutStyles = (c: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: typography.families.bodySemiBold,
    color: c.textSecondary,
    textTransform: "uppercase" as const,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  pressed: {
    opacity: 0.6,
  },
  logoutButton: {
    margin: 24,
    padding: 16,
    backgroundColor: c.bgElevated,
    borderRadius: 12,
    alignItems: "center" as const,
  },
  logoutText: {
    fontSize: 16,
    color: c.danger,
    fontFamily: typography.families.bodyMedium,
  },
});

const createItemStyles = (c: ThemeColors) => ({
  item: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    backgroundColor: c.bgElevated,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  controlItem: {
    backgroundColor: c.bgElevated,
    paddingTop: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  controlLabel: {
    fontSize: 16,
    fontFamily: typography.families.body,
    color: c.textPrimary,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: typography.families.body,
    color: c.textPrimary,
  },
  itemSubtitle: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: c.border,
  },
});

const createAppearanceStyles = (c: ThemeColors) => ({
  control: {
    backgroundColor: c.bgElevated,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  hint: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textMuted,
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
});

function SettingsItem({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const styles = useStyles(createItemStyles);
  const layout = useStyles(createLayoutStyles);
  const itemPressStyle = ({ pressed }: { pressed: boolean }) => [
    styles.item,
    pressed && layout.pressed,
  ];
  return (
    <Pressable style={itemPressStyle} onPress={onPress}>
      <View>
        <Text style={styles.itemTitle}>{title}</Text>
        {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.chevron}>{"\u203A"}</Text>
    </Pressable>
  );
}

function SettingsControl({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string;
  onChange: (val: string) => void;
}) {
  const styles = useStyles(createItemStyles);
  return (
    <View style={styles.controlItem}>
      <Text style={styles.controlLabel}>{label}</Text>
      <SegmentedControl options={options} selected={selected} onChange={onChange} />
    </View>
  );
}

function deriveExperience(level: string | null | undefined): string {
  if (!level) return "Beginner";
  return capitalize(level);
}

function deriveUnits(prefs: Record<string, unknown> | null | undefined): string {
  return (prefs?.units as string) === "imperial" ? "Imperial" : "Metric";
}

function deriveHemisphere(prefs: Record<string, unknown> | null | undefined): string {
  const val = prefs?.hemisphere as string | undefined;
  if (val === "north") return "North";
  if (val === "south") return "South";
  return "Auto";
}

function AppearanceSection() {
  const layout = useStyles(createLayoutStyles);
  const styles = useStyles(createAppearanceStyles);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const setColorScheme = useThemeStore((s) => s.setColorScheme);

  const selected =
    colorScheme === "system" ? "System" : colorScheme === "light" ? "Light" : "Dark";

  function handleChange(val: string) {
    setColorScheme(val === "System" ? "system" : val === "Light" ? "light" : "dark");
  }

  const hint =
    colorScheme === "system" ? "Following device setting" : `Using ${colorScheme} mode`;

  return (
    <View style={layout.section}>
      <Text style={layout.sectionTitle}>Appearance</Text>
      <View style={styles.control}>
        <SegmentedControl options={THEME_OPTIONS} selected={selected} onChange={handleChange} />
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

function AccountSection() {
  const layout = useStyles(createLayoutStyles);
  const { user: authUser } = useAuthStore();
  const { data: user } = useCurrentUser();
  const updateUser = useUpdateUser();
  const updatePreferences = useUpdatePreferences();
  const router = useRouter();

  const [experience, setExperience] = useState(() => deriveExperience(user?.experience_level));
  const [units, setUnits] = useState(() => deriveUnits(user?.preferences));
  const [hemisphere, setHemisphere] = useState(() => deriveHemisphere(user?.preferences));

  useEffect(() => {
    setExperience(deriveExperience(user?.experience_level));
  }, [user?.experience_level]);

  useEffect(() => {
    setUnits(deriveUnits(user?.preferences));
    setHemisphere(deriveHemisphere(user?.preferences));
  }, [user?.preferences]);

  function handleExperienceChange(val: string) {
    setExperience(val);
    updateUser.mutate({ experience_level: val.toLowerCase() });
  }

  function handleUnitsChange(val: string) {
    setUnits(val);
    updatePreferences.mutate({ units: val.toLowerCase() });
  }

  function handleHemisphereChange(val: string) {
    setHemisphere(val);
    // "Auto" means remove explicit preference — backend will infer from apiary latitude
    const value = val === "North" ? "north" : val === "South" ? "south" : null;
    updatePreferences.mutate({ hemisphere: value });
  }

  const profileSubtitle =
    user?.name ?? user?.email ?? authUser?.email ?? "Manage your account";

  return (
    <View style={layout.section}>
      <Text style={layout.sectionTitle}>Account</Text>
      <SettingsItem
        title="Profile"
        subtitle={profileSubtitle}
        onPress={() => router.push("/settings/profile" as any)}
      />
      <SettingsControl
        label="Experience Level"
        options={EXPERIENCE_LEVELS}
        selected={experience}
        onChange={handleExperienceChange}
      />
      <SettingsControl
        label="Units"
        options={UNIT_OPTIONS}
        selected={units}
        onChange={handleUnitsChange}
      />
      <SettingsControl
        label="Hemisphere"
        options={HEMISPHERE_OPTIONS}
        selected={hemisphere}
        onChange={handleHemisphereChange}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { logout } = useAuthStore();
  const layout = useStyles(createLayoutStyles);
  const router = useRouter();

  const logoutPressStyle = ({ pressed }: { pressed: boolean }) => [
    layout.logoutButton,
    pressed && layout.pressed,
  ];

  return (
    <ScrollView style={layout.container}>
      <AppearanceSection />
      <AccountSection />

      <View style={layout.section}>
        <Text style={layout.sectionTitle}>Notifications</Text>
        <SettingsItem title="Push Notifications" subtitle="Enabled" />
        <SettingsItem title="Inspection Reminders" subtitle="3 days before" />
      </View>

      <View style={layout.section}>
        <Text style={layout.sectionTitle}>Data</Text>
        <SettingsItem title="Sync Status" subtitle="Last synced: Just now" />
        <SettingsItem title="Export Data" subtitle="CSV, JSON" />
      </View>

      <View style={layout.section}>
        <Text style={layout.sectionTitle}>About</Text>
        <SettingsItem title="Version" subtitle="0.1.0" />
        <SettingsItem
          title="Open Source Licenses"
          onPress={() => router.push("/licenses" as any)}
        />
        <SettingsItem
          title="Privacy Policy"
          onPress={() => Linking.openURL("https://beebuddyai.com/legal/privacy/")}
        />
      </View>

      <View style={layout.section}>
        <Text style={layout.sectionTitle}>Danger Zone</Text>
        <SettingsItem
          title="Delete Account"
          subtitle="Permanently delete your account"
          onPress={() => router.push("/settings/delete-account" as any)}
        />
      </View>

      <Pressable style={logoutPressStyle} onPress={logout}>
        <Text style={layout.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}
