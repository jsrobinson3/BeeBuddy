import { Text, View } from "react-native";
import { Users } from "lucide-react-native";

import { useStyles, useTheme, typography, type ThemeColors } from "../../theme";

const createStyles = (c: ThemeColors) => ({
  badge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: c.honeyPale,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  text: {
    fontSize: 11,
    fontFamily: typography.families.bodySemiBold,
    color: c.info,
  },
});

interface SharedBadgeProps {
  /** Number of collaborators (shown for owners) */
  count?: number;
  /** If true, shows "Shared" text instead of count */
  isSharedWithMe?: boolean;
}

export function SharedBadge({ count, isSharedWithMe }: SharedBadgeProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.badge}>
      <Users size={12} color={colors.info} />
      <Text style={styles.text}>
        {isSharedWithMe ? "Shared" : count}
      </Text>
    </View>
  );
}
