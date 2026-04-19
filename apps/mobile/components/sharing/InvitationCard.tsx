import { Pressable, Text, View } from "react-native";
import { MapPin, Box } from "lucide-react-native";

import { useStyles, useTheme, typography, type ThemeColors } from "../../theme";
import type { Share } from "../../services/api.types";

const createStyles = (c: ThemeColors) => ({
  card: {
    backgroundColor: c.bgSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  inviter: {
    fontSize: 15,
    fontFamily: typography.families.bodySemiBold,
    color: c.textPrimary,
  },
  resource: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: c.honeyPale,
  },
  roleText: {
    fontSize: 12,
    fontFamily: typography.families.bodySemiBold,
    color: c.textOnPrimary,
    textTransform: "capitalize" as const,
  },
  actions: {
    flexDirection: "row" as const,
    gap: 12,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: c.primaryFill,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center" as const,
  },
  acceptText: {
    fontFamily: typography.families.bodySemiBold,
    fontSize: 14,
    color: c.textOnPrimary,
  },
  declineBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center" as const,
    backgroundColor: c.bgInputSoft,
  },
  declineText: {
    fontFamily: typography.families.bodySemiBold,
    fontSize: 14,
    color: c.danger,
  },
});

interface InvitationCardProps {
  share: Share;
  onAccept: (shareId: string) => void;
  onDecline: (shareId: string) => void;
}

export function InvitationCard({ share, onAccept, onDecline }: InvitationCardProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const Icon = share.apiaryId ? MapPin : Box;
  const resourceName = share.apiaryName || share.hiveName || "Resource";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon size={20} color={colors.honey} />
        <View style={styles.headerText}>
          <Text style={styles.inviter}>{share.ownerName || "Someone"}</Text>
          <Text style={styles.resource}>
            Shared {share.apiaryId ? "apiary" : "hive"} "{resourceName}"
          </Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{share.role}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.declineBtn} onPress={() => onDecline(share.id)}>
          <Text style={styles.declineText}>Decline</Text>
        </Pressable>
        <Pressable style={styles.acceptBtn} onPress={() => onAccept(share.id)}>
          <Text style={styles.acceptText}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}
