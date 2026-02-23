import { Pressable, Text, View } from "react-native";
import { Camera, Image as ImageIcon } from "lucide-react-native";

import { useStyles, useTheme } from "../../theme";
import { createSourceStyles } from "./styles";
import { ModalShell } from "./ModalShell";

interface Props {
  visible: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}

function SourceButtons({
  onCamera,
  onGallery,
}: {
  onCamera: () => void;
  onGallery: () => void;
}) {
  const ss = useStyles(createSourceStyles);
  const { colors } = useTheme();
  return (
    <View style={ss.buttonRow}>
      <Pressable style={ss.button} onPress={onCamera}>
        <Camera size={18} color={colors.honey} />
        <Text style={ss.buttonText}>Camera</Text>
      </Pressable>
      <Pressable style={ss.button} onPress={onGallery}>
        <ImageIcon size={18} color={colors.honey} />
        <Text style={ss.buttonText}>Gallery</Text>
      </Pressable>
    </View>
  );
}

export function SourcePickerModal({
  visible,
  onCamera,
  onGallery,
  onClose,
}: Props) {
  return (
    <ModalShell
      visible={visible}
      title="Choose Photo Source"
      onClose={onClose}
      animationType="fade"
    >
      <SourceButtons onCamera={onCamera} onGallery={onGallery} />
    </ModalShell>
  );
}
