import React, { useMemo } from "react";
import Svg, { Polygon } from "react-native-svg";

import { useTheme } from "../../theme";

interface Props {
  width?: number;
  height?: number;
}

/**
 * Flat-top hexagon helper: returns "x1,y1 x2,y2 ..." polygon points
 * for a regular hexagon centered at (cx, cy) with the given radius.
 */
function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

interface HexCellProps {
  cx: number;
  cy: number;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

function HexCell({ cx, cy, radius, fill, stroke, strokeWidth, opacity }: HexCellProps) {
  return (
    <Polygon
      points={hexPoints(cx, cy, radius)}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
    />
  );
}

/**
 * Decorative honeycomb pattern — a cluster of flat-top hexagons.
 * Suitable as a background decoration element.
 */
export function HexPattern({ width = 200, height = 200 }: Props) {
  const { colors } = useTheme();

  const R = 24;
  const H = R * Math.sqrt(3);

  const hexagons = useMemo(() => [
    { cx: 100, cy: 100, fill: colors.honey, strokeOnly: false },
    { cx: 100 + R * 1.5, cy: 100 - H / 2, fill: colors.honeyLight, strokeOnly: false },
    { cx: 100 + R * 1.5, cy: 100 + H / 2, fill: colors.honeyPale, strokeOnly: false },
    { cx: 100, cy: 100 - H, fill: colors.forestPale, strokeOnly: false },
    { cx: 100, cy: 100 + H, fill: colors.honeyPale, strokeOnly: false },
    { cx: 100 - R * 1.5, cy: 100 - H / 2, fill: "none", strokeOnly: true },
    { cx: 100 - R * 1.5, cy: 100 + H / 2, fill: colors.honeyLight, strokeOnly: false },
    { cx: 100 - R * 1.5, cy: 100 - H * 1.5, fill: "none", strokeOnly: true },
    { cx: 100 + R * 3, cy: 100, fill: "none", strokeOnly: true },
    { cx: 100 - R * 3, cy: 100, fill: colors.forestPale, strokeOnly: false },
  ], [colors, R, H]);

  const cells = hexagons.map((hex, i) => (
    <HexCell
      key={i}
      cx={hex.cx}
      cy={hex.cy}
      radius={R}
      fill={hex.strokeOnly ? "none" : hex.fill}
      stroke={colors.forest}
      strokeWidth={hex.strokeOnly ? 1.5 : 1}
      opacity={hex.strokeOnly ? 0.4 : 0.85}
    />
  ));

  return (
    <Svg width={width} height={height} viewBox="0 0 200 200">
      {cells}
    </Svg>
  );
}
