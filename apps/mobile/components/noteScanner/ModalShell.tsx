import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { useStyles, useTheme } from "../../theme";
import { createShellStyles } from "./styles";

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  animationType?: "fade" | "slide";
  sheetStyle?: object;
  children: ReactNode;
}

function SheetOverlay({
  onPress,
  sheetStyle,
  children,
}: {
  onPress: () => void;
  sheetStyle?: object;
  children: ReactNode;
}) {
  const ss = useStyles(createShellStyles);
  return (
    <Pressable style={ss.overlay} onPress={onPress}>
      <View style={[ss.sheet, sheetStyle]}>{children}</View>
    </Pressable>
  );
}

function SheetHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  const ss = useStyles(createShellStyles);
  const { colors } = useTheme();
  return (
    <View style={ss.header}>
      <Text style={ss.title}>{title}</Text>
      <Pressable style={ss.closeButton} onPress={onClose}>
        <X size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

export function ModalShell({
  visible,
  title,
  onClose,
  animationType = "slide",
  sheetStyle,
  children,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType={animationType}>
      <SheetOverlay onPress={onClose} sheetStyle={sheetStyle}>
        <SheetHeader title={title} onClose={onClose} />
        {children}
      </SheetOverlay>
    </Modal>
  );
}
