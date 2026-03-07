import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { ResponsiveContainer } from "../../components/ResponsiveContainer";
import { useAdminUsers } from "../../hooks/useAdmin";
import type { AdminUser } from "../../services/api";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  type ThemeColors,
} from "../../theme";

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  searchBar: {
    margin: spacing.md,
    backgroundColor: c.bgInputSoft,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.families.body,
    ...typography.sizes.body,
    color: c.textPrimary,
  },
  toggleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleLabel: {
    fontFamily: typography.families.body,
    ...typography.sizes.bodySm,
    color: c.textSecondary,
  },
  loading: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: spacing["3xl"],
  },
});

const createRowStyles = (c: ThemeColors) => ({
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: c.bgElevated,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: c.border,
  },
  rowLeft: { flex: 1 },
  rowName: {
    fontFamily: typography.families.bodyMedium,
    ...typography.sizes.body,
    color: c.textPrimary,
  },
  rowEmail: {
    fontFamily: typography.families.body,
    ...typography.sizes.caption,
    color: c.textSecondary,
    marginTop: 2,
  },
  rowMeta: {
    fontFamily: typography.families.body,
    ...typography.sizes.caption,
    color: c.textMuted,
    marginTop: 2,
  },
  badges: {
    flexDirection: "row" as const,
    gap: spacing.xs,
    alignItems: "center" as const,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  adminDot: { backgroundColor: c.honey },
  verifiedDot: { backgroundColor: c.success },
  deletedDot: { backgroundColor: c.danger },
  chevron: { fontSize: 20, color: c.border },
  pressed: { opacity: 0.6 },
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function UserRow({ user, onPress }: { user: AdminUser; onPress: () => void }) {
  const s = useStyles(createRowStyles);
  const pressStyle = ({ pressed }: { pressed: boolean }) => [
    s.row,
    pressed && s.pressed,
  ];

  const meta = `Joined ${formatDate(user.createdAt)} | ${user.hiveCount} hives`;

  return (
    <Pressable style={pressStyle} onPress={onPress}>
      <View style={s.rowLeft}>
        <Text style={s.rowName}>{user.name ?? "No name"}</Text>
        <Text style={s.rowEmail}>{user.email}</Text>
        <Text style={s.rowMeta}>{meta}</Text>
      </View>
      <View style={s.badges}>
        {user.isAdmin && <View style={[s.badgeDot, s.adminDot]} />}
        {user.emailVerified && <View style={[s.badgeDot, s.verifiedDot]} />}
        {user.deletedAt && <View style={[s.badgeDot, s.deletedDot]} />}
        <Text style={s.chevron}>{"\u203A"}</Text>
      </View>
    </Pressable>
  );
}

function SearchFilter({
  search,
  onSearchChange,
  includeDeleted,
  onDeletedToggle,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  includeDeleted: boolean;
  onDeletedToggle: (v: boolean) => void;
}) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View>
      <TextInput
        style={styles.searchBar}
        placeholder="Search users..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={onSearchChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show deleted users</Text>
        <Switch value={includeDeleted} onValueChange={onDeletedToggle} />
      </View>
    </View>
  );
}

export default function UsersScreen() {
  const styles = useStyles(createStyles);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useAdminUsers({
    search: debouncedSearch || undefined,
    includeDeleted,
  });
  const users = data?.items;

  const renderItem = useCallback(
    ({ item }: { item: AdminUser }) => (
      <UserRow
        user={item}
        onPress={() => router.push(`/admin/user-detail?id=${item.id}` as any)}
      />
    ),
    [router],
  );

  const keyExtractor = useCallback((item: AdminUser) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const filterProps = { search, onSearchChange: setSearch, includeDeleted, onDeletedToggle: setIncludeDeleted };

  return (
    <View style={styles.container}>
      <ResponsiveContainer maxWidth={800} fill>
        <SearchFilter {...filterProps} />
        <FlatList data={users ?? []} renderItem={renderItem} keyExtractor={keyExtractor} />
      </ResponsiveContainer>
    </View>
  );
}
