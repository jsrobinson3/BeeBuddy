import React from "react";
import Svg, { Circle, Ellipse, Path, Polygon } from "react-native-svg";

import { useTheme } from "../../theme";

interface Props {
  width?: number;
  height?: number;
}

/**
 * Stylized landscape scene with rolling hills, flowers, bees, and a sun.
 * Used on auth/onboarding screens.
 */
export function BeeScene({ width = 280, height = 180 }: Props) {
  const { colors } = useTheme();

  return (
    <Svg width={width} height={height} viewBox="0 0 280 180">
      {/* Sky background */}
      <Path d="M0 0 H280 V180 H0 Z" fill={colors.bgSurface} />

      {/* Sun — honey circle with short rays */}
      <Circle cx={240} cy={36} r={22} fill={colors.honey} opacity={0.9} />
      <Circle cx={240} cy={36} r={14} fill={colors.honeyLight} />

      {/* Far hill */}
      <Path
        d="M-10 140 Q70 70 160 110 Q220 80 290 105 V180 H-10 Z"
        fill={colors.forestLight}
      />

      {/* Near hill */}
      <Path
        d="M-10 155 Q60 110 140 135 Q200 115 290 140 V180 H-10 Z"
        fill={colors.forest}
      />

      {/* Flower 1 — left */}
      <Path
        d="M60 134 L60 115"
        stroke={colors.forestLight}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={60} cy={112} r={5} fill={colors.honey} />
      <Circle cx={60} cy={112} r={2.5} fill={colors.honeyDark} />

      {/* Flower 2 — center-left */}
      <Path
        d="M105 130 L105 108"
        stroke={colors.forestLight}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Polygon
        points="105,100 109,106 103,106"
        fill={colors.honeyLight}
      />
      <Circle cx={105} cy={105} r={4} fill={colors.honey} />

      {/* Flower 3 — right */}
      <Path
        d="M195 125 L195 105"
        stroke={colors.forestLight}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={195} cy={102} r={5} fill={colors.honeyPale} />
      <Circle cx={195} cy={102} r={2.5} fill={colors.honey} />

      {/* Bee 1 — body */}
      <Ellipse cx={130} cy={72} rx={7} ry={5} fill={colors.honey} />
      {/* Bee 1 — stripe */}
      <Path d="M126 72 L134 72" stroke={colors.forest} strokeWidth={1.5} />
      {/* Bee 1 — wings */}
      <Ellipse cx={134} cy={68} rx={5} ry={3} fill={colors.forestPale} opacity={0.7} />
      <Ellipse cx={128} cy={68} rx={4} ry={2.5} fill={colors.forestPale} opacity={0.7} />

      {/* Bee 2 — body (smaller, further away) */}
      <Ellipse cx={185} cy={55} rx={5} ry={3.5} fill={colors.honey} />
      {/* Bee 2 — stripe */}
      <Path d="M182 55 L188 55" stroke={colors.forest} strokeWidth={1} />
      {/* Bee 2 — wing */}
      <Ellipse cx={189} cy={52} rx={3.5} ry={2} fill={colors.forestPale} opacity={0.7} />
    </Svg>
  );
}
