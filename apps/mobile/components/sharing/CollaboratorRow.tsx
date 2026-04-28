import { Pressable, Text, View } from "react-native";
import { Trash2 } from "lucide-react-native";

import { useStyles, useTheme, typography, type ThemeColors } from "../../theme";
import type { Share } from "../../services/api.types";

const createStyles = (c: ThemeColors) => ({
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.honeyPale,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
  email: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 1,
  },
  roleBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: c.bgInputSoft,
  },
  roleText: {
    fontSize: 12,
    fontFamily: typography.families.bodySemiBold,
    color: c.textSecondary,
    textTransform: "capitalize" as const,
  },
  removeBtn: {
    padding: 8,
  },
});

interface CollaboratorRowProps {
  share: Share;
  canManage?: boolean;
  onRemove?: (shareId: string) => void;
}

export function CollaboratorRow({ share, canManage, onRemove }: CollaboratorRowProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const displayName = share.sharedWithName || share.inviteEmail || "Unknown";
  const displayEmail = share.sharedWithName ? (share.inviteEmail || "") : "";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        {displayEmail ? (
          <Text style={styles.email} numberOfLines={1}>{displayEmail}</Text>
        ) : null}
      </View>
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{share.role}</Text>
      </View>
      {canManage && onRemove ? (
        <Pressable style={styles.removeBtn} onPress={() => onRemove(share.id)}>
          <Trash2 size={18} color={colors.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}
