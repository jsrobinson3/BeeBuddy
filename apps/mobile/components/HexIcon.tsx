/**
 * Hexagonal icon frame — wraps any child (typically a Lucide icon) in a
 * flat-top hexagon SVG clip. Used for tab bar icons, avatars, and badges.
 */
import React from "react";
import { View } from "react-native";
import Svg, { Polygon } from "react-native-svg";

import { useTheme } from "../theme";

interface HexIconProps {
  size?: number;
  filled?: boolean;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  children?: React.ReactNode;
}

/** Flat-top hexagon points for a given size. */
function hexPoints(s: number): string {
  const cx = s / 2;
  const cy = s / 2;
  const r = s / 2;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push(`${x},${y}`);
  }
  return pts.join(" ");
}

function HexBackground({
  size,
  fill,
  stroke,
  strokeWidth,
}: {
  size: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: "absolute" }}
    >
      <Polygon
        points={hexPoints(size)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HexIcon({
  size = 32,
  filled = false,
  fillColor,
  strokeColor,
  strokeWidth = 1.5,
  children,
}: HexIconProps) {
  const { colors } = useTheme();
  const fill = filled ? (fillColor ?? colors.honey) : "none";
  const stroke = strokeColor ?? colors.honey;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <HexBackground size={size} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {children}
    </View>
  );
}
