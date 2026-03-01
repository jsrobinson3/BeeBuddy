import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Text as SvgText } from "react-native-svg";

import { useTheme } from "../../theme";

interface Props {
  width?: number;
  height?: number;
}

/**
 * Sleeping bee illustration for cold-start / "waking up" states.
 * A cartoon bee resting on a flower with floating Zzz.
 * The whole illustration gently pulses opacity to suggest sleep.
 */

function BeeFlower({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <>
      <Line
        x1={100} y1={130} x2={100} y2={170}
        stroke={colors.forestLight} strokeWidth={3} strokeLinecap="round"
      />
      <Path d="M100 150 Q115 142 112 155 Q108 160 100 155" fill={colors.forestLight} />
      <Circle cx={88} cy={122} r={10} fill={colors.honeyPale} />
      <Circle cx={112} cy={122} r={10} fill={colors.honeyPale} />
      <Circle cx={88} cy={138} r={10} fill={colors.honeyPale} />
      <Circle cx={112} cy={138} r={10} fill={colors.honeyPale} />
      <Circle cx={80} cy={130} r={10} fill={colors.honeyPale} />
      <Circle cx={120} cy={130} r={10} fill={colors.honeyPale} />
      <Circle cx={100} cy={130} r={10} fill={colors.honey} />
    </>
  );
}

function BeeBody({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <>
      {/* Wings (behind body) */}
      <Ellipse cx={88} cy={100} rx={14} ry={8} fill={colors.honeyLight} opacity={0.5} transform="rotate(-20 88 100)" />
      <Ellipse cx={112} cy={100} rx={14} ry={8} fill={colors.honeyLight} opacity={0.5} transform="rotate(20 112 100)" />
      {/* Body with stripes */}
      <Ellipse cx={100} cy={112} rx={16} ry={11} fill={colors.honey} />
      <Path d="M90 108 Q100 106 110 108" fill="none" stroke={colors.forest} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M88 113 Q100 111 112 113" fill="none" stroke={colors.forest} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M90 118 Q100 116 110 118" fill="none" stroke={colors.forest} strokeWidth={2.5} strokeLinecap="round" />
      {/* Head with closed eyes and droopy antennae */}
      <Circle cx={100} cy={98} r={9} fill={colors.honey} />
      <Path d="M94 97 Q96 99 98 97" fill="none" stroke={colors.forest} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M102 97 Q104 99 106 97" fill="none" stroke={colors.forest} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M96 92 Q90 84 88 88" fill="none" stroke={colors.forest} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M104 92 Q110 84 112 88" fill="none" stroke={colors.forest} strokeWidth={1.5} strokeLinecap="round" />
      {/* Zzz */}
      <SvgText x={125} y={80} fontSize={14} fontWeight="bold" fill={colors.textMuted} opacity={0.7}>z</SvgText>
      <SvgText x={133} y={68} fontSize={17} fontWeight="bold" fill={colors.textMuted} opacity={0.5}>z</SvgText>
      <SvgText x={143} y={54} fontSize={21} fontWeight="bold" fill={colors.textMuted} opacity={0.3}>z</SvgText>
    </>
  );
}

function createPulseAnimation(value: Animated.Value) {
  const config = { duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true };
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, { ...config, toValue: 1 }),
      Animated.timing(value, { ...config, toValue: 0.3 }),
    ]),
  );
}

export function SleepyBee({ width = 200, height = 180 }: Props) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = createPulseAnimation(pulse);
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }}>
      <Svg width={width} height={height} viewBox="0 0 200 180">
        <BeeFlower colors={colors} />
        <BeeBody colors={colors} />
      </Svg>
    </Animated.View>
  );
}
