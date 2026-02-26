import React from "react";
import Svg, { Path } from "react-native-svg";

/* eslint-disable max-len */
const APPLE_BODY =
  "M18.71 19.5c-.98.95-2.05.88-3.08.4" +
  "-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4" +
  "C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74" +
  " 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65" +
  ".72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57" +
  " 1.5-1.31 2.99-2.54 4.09z";
const APPLE_LEAF =
  "M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25" +
  ".29 2.58-2.34 4.5-3.74 4.25z";
/* eslint-enable max-len */

interface AppleLogoProps {
  size?: number;
  color?: string;
}

/** Apple logo silhouette — color must be black or white per HIG. */
export function AppleLogo({
  size = 20,
  color = "#000000",
}: AppleLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d={APPLE_BODY} />
      <Path fill={color} d={APPLE_LEAF} />
    </Svg>
  );
}
