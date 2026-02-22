import React from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { useTheme } from "../../theme";

interface Props {
  width?: number;
  height?: number;
}

/**
 * Friendly empty-state illustration of a Langstroth beehive box
 * with a dotted path suggesting the user should add something.
 */
export function EmptyHiveIllustration({ width = 200, height = 180 }: Props) {
  const { colors } = useTheme();

  return (
    <Svg width={width} height={height} viewBox="0 0 200 180">
      {/* Ground line */}
      <Path
        d="M30 155 Q100 148 170 155"
        fill="none"
        stroke={colors.forestPale}
        strokeWidth={2}
      />

      {/* Hive roof — pointed triangle */}
      <Path
        d="M68 60 L100 40 L132 60 Z"
        fill={colors.forest}
      />

      {/* Hive body — top box (super) */}
      <Rect
        x={72}
        y={60}
        width={56}
        height={26}
        rx={2}
        fill={colors.honey}
        stroke={colors.forest}
        strokeWidth={1.5}
      />

      {/* Hive body — bottom box (brood) */}
      <Rect
        x={72}
        y={88}
        width={56}
        height={30}
        rx={2}
        fill={colors.honeyLight}
        stroke={colors.forest}
        strokeWidth={1.5}
      />

      {/* Hive entrance */}
      <Rect
        x={90}
        y={112}
        width={20}
        height={6}
        rx={1}
        fill={colors.forest}
      />

      {/* Landing board */}
      <Line
        x1={78}
        y1={118}
        x2={122}
        y2={118}
        stroke={colors.forest}
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Stand legs */}
      <Line x1={82} y1={118} x2={82} y2={155} stroke={colors.forest} strokeWidth={2} />
      <Line x1={118} y1={118} x2={118} y2={155} stroke={colors.forest} strokeWidth={2} />

      {/* Dotted path — curved arrow suggesting "add here" */}
      <Path
        d="M148 90 Q165 70 158 50 Q152 35 140 45"
        fill="none"
        stroke={colors.honey}
        strokeWidth={2}
        strokeDasharray="5,4"
        strokeLinecap="round"
      />

      {/* Arrow tip */}
      <Path
        d="M143 40 L140 45 L145 46"
        fill="none"
        stroke={colors.honey}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Small plus circle */}
      <Circle
        cx={155}
        cy={90}
        r={10}
        fill={colors.honeyPale}
        stroke={colors.honey}
        strokeWidth={1.5}
      />
      <Line
        x1={155}
        y1={85}
        x2={155}
        y2={95}
        stroke={colors.honey}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line
        x1={150}
        y1={90}
        x2={160}
        y2={90}
        stroke={colors.honey}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
