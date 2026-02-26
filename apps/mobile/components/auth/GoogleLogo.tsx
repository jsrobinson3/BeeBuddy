import React from "react";
import Svg, { Path } from "react-native-svg";

/**
 * Official Google "G" logo — paths extracted from Google's branded sign-in
 * asset kit (android_light_rd_na.svg). Colors per brand guidelines.
 */

/* eslint-disable max-len */
const BLUE =
  "M29.6 20.227c0-.709-.064-1.39-.182-2.045H20v3.868h5.382" +
  "a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z";
const GREEN =
  "M20 30c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509" +
  "c-.895.6-2.04.959-3.386.959-2.605 0-4.81-1.76-5.596-4.123h-3.34v2.59" +
  "C12.71 27.76 16.09 30 20 30z";
const YELLOW =
  "M14.404 21.905c-.2-.6-.314-1.24-.314-1.905 0-.66.114-1.3.314-1.9" +
  "v-2.59h-3.34A10 10 0 0010 20c0 1.614.386 3.141 1.064 4.49l3.34-2.586z";
const RED =
  "M20 13.977c1.468 0 2.786.505 3.823 1.495l2.868-2.868" +
  "C24.96 10.991 22.695 10 20 10c-3.91 0-7.29 2.24-8.936 5.51l3.34 2.59" +
  "c.786-2.363 2.99-4.122 5.596-4.122z";
/* eslint-enable max-len */

interface GoogleLogoProps {
  size?: number;
}

/** Standard multicolor Google "G" — must always use brand colors. */
export function GoogleLogo({ size = 20 }: GoogleLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="10 10 20 20">
      <Path fill="#4285F4" d={BLUE} />
      <Path fill="#34A853" d={GREEN} />
      <Path fill="#FBBC04" d={YELLOW} />
      <Path fill="#EA4335" d={RED} />
    </Svg>
  );
}
