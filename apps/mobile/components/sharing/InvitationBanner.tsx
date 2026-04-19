import { Pressable, Text, View } from "react-native";
import { Mail } from "lucide-react-native";

import { useStyles, useTheme, typography, type ThemeColors } from "../../theme";

const createStyles = (c: ThemeColors) => ({
  banner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: c.honeyPale,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.families.bodyMedium,
    color: c.textPrimary,
  },
  viewBtn: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
});

interface InvitationBannerProps {
  count: number;
  onPress: () => void;
}

export function InvitationBanner({ count, onPress }: InvitationBannerProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();

  if (count === 0) return null;

  return (
    <Pressable style={styles.banner} onPress={onPress}>
      <Mail size={20} color={colors.honey} />
      <Text style={styles.text}>
        {count} pending invitation{count !== 1 ? "s" : ""}
      </Text>
      <Text style={styles.viewBtn}>View</Text>
    </Pressable>
  );
}
