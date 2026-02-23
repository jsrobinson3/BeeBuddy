import { ScrollView, Text } from "react-native";

import { useStyles } from "../../theme";
import { createReviewStyles, createTemplateStyles } from "./styles";
import { ModalShell } from "./ModalShell";

const NOTE_TEMPLATE = `For best results, write one field per line:

Queen Seen: YES / NO
Eggs: YES / NO
Population: WEAK / MEDIUM / STRONG
Honey: EMPTY / LOW / ADEQUATE / FULL
Temperament: CALM / NERVOUS / AGGRESSIVE
Brood Pattern: __/5
Frames of Bees: __
Varroa: __
Temp: __°F
Conditions: SUNNY / CLOUDY / RAINY
Impression: __/5
Needs Attention: YES / NO
Notes: _______________`;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function TemplateModal({ visible, onClose }: Props) {
  const rs = useStyles(createReviewStyles);
  const ts = useStyles(createTemplateStyles);

  return (
    <ModalShell
      visible={visible}
      title="Note Format Tips"
      onClose={onClose}
      sheetStyle={ts.sheet}
    >
      <ScrollView style={rs.content}>
        <Text style={ts.text}>{NOTE_TEMPLATE}</Text>
      </ScrollView>
    </ModalShell>
  );
}
