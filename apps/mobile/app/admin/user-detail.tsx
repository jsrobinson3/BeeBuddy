import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from "react-native";
import { Pressable } from "react-native";

import { ResponsiveContainer } from "../../components/ResponsiveContainer";
import { useAdminUser, useUpdateAdminUser, useRestoreUser } from "../../hooks/useAdmin";
import type { AdminUser } from "../../services/api";
import {
  useStyles,
  typography,
  spacing,
  radii,
  shadows,
  type ThemeColors,
} from "../../theme";

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  content: { padding: spacing.md },
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
    shadowColor: c.shadowColor,
  },
  cardTitle: {
    fontFamily: typography.families.displaySemiBold,
    ...typography.sizes.h4,
    color: c.forest,
    marginBottom: spacing.sm,
  },
  field: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderLight,
  },
  fieldLabel: {
    fontFamily: typography.families.bodySemiBold,
    ...typography.sizes.bodySm,
    color: c.textSecondary,
  },
  fieldValue: {
    fontFamily: typography.families.body,
    ...typography.sizes.bodySm,
    color: c.textPrimary,
  },
});

const createActionStyles = (c: ThemeColors) => ({
  deletedBanner: {
    backgroundColor: c.danger,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: "center" as const,
  },
  deletedText: {
    fontFamily: typography.families.bodySemiBold,
    ...typography.sizes.body,
    color: c.textOnDanger,
  },
  restoreButton: {
    marginTop: spacing.sm,
    backgroundColor: c.bgElevated,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  restoreText: {
    fontFamily: typography.families.bodyMedium,
    ...typography.sizes.bodySm,
    color: c.textPrimary,
  },
  pressed: { opacity: 0.7 },
  loading: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: spacing["3xl"],
  },
});

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

function InfoField({ label, value }: { label: string; value: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function ToggleField({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} />
    </View>
  );
}

function DeletedBanner({ user, onRestore }: { user: AdminUser; onRestore: () => void }) {
  const actionStyles = useStyles(createActionStyles);
  const restorePressStyle = ({ pressed }: { pressed: boolean }) => [
    actionStyles.restoreButton,
    pressed && actionStyles.pressed,
  ];
  return (
    <View style={actionStyles.deletedBanner}>
      <Text style={actionStyles.deletedText}>
        Deleted {formatDate(user.deletedAt)}
      </Text>
      <Pressable style={restorePressStyle} onPress={onRestore}>
        <Text style={actionStyles.restoreText}>Restore User</Text>
      </Pressable>
    </View>
  );
}

function ProfileCard({ user }: { user: AdminUser }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Profile</Text>
      <InfoField label="Name" value={user.name ?? "Not set"} />
      <InfoField label="Email" value={user.email} />
      <InfoField label="Experience" value={user.experienceLevel ?? "Not set"} />
      <InfoField label="User ID" value={user.id} />
    </View>
  );
}

function PermissionsCard({
  user,
  onToggleAdmin,
  onToggleVerified,
}: {
  user: AdminUser;
  onToggleAdmin: (v: boolean) => void;
  onToggleVerified: (v: boolean) => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Permissions</Text>
      <ToggleField label="Admin" value={user.isAdmin} onToggle={onToggleAdmin} />
      <ToggleField label="Email Verified" value={user.emailVerified} onToggle={onToggleVerified} />
    </View>
  );
}

function ActivityCard({ user }: { user: AdminUser }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Activity</Text>
      <InfoField label="Joined" value={formatDate(user.createdAt)} />
      <InfoField label="Last Login" value={formatDate(user.lastLoginAt)} />
      <InfoField label="Apiaries" value={String(user.apiaryCount)} />
      <InfoField label="Hives" value={String(user.hiveCount)} />
    </View>
  );
}

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles(createStyles);
  const actionStyles = useStyles(createActionStyles);
  const { data: user, isLoading } = useAdminUser(id ?? "");
  const updateUser = useUpdateAdminUser();
  const restoreUser = useRestoreUser();

  if (isLoading || !user) {
    return (
      <View style={actionStyles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  function handleToggleAdmin(val: boolean) {
    Alert.alert(
      val ? "Grant Admin" : "Revoke Admin",
      `${val ? "Grant" : "Revoke"} admin access for ${user!.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => updateUser.mutate({ id: user!.id, data: { isAdmin: val } }) },
      ],
    );
  }

  function handleToggleVerified(val: boolean) {
    updateUser.mutate({ id: user!.id, data: { emailVerified: val } });
  }

  function handleRestore() {
    restoreUser.mutate(user!.id);
  }

  const permissionProps = { user, onToggleAdmin: handleToggleAdmin, onToggleVerified: handleToggleVerified };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResponsiveContainer maxWidth={800}>
        {user.deletedAt && <DeletedBanner user={user} onRestore={handleRestore} />}
        <ProfileCard user={user} />
        <PermissionsCard {...permissionProps} />
        <ActivityCard user={user} />
      </ResponsiveContainer>
    </ScrollView>
  );
}
