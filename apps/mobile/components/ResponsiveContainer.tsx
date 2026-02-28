import React from "react";
import { Platform, View } from "react-native";

import { useResponsive } from "../hooks/useResponsive";

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
  /** When true, adds flex: 1 so scrollable content (FlatList/ScrollView) fills the container. */
  fill?: boolean;
}

export function ResponsiveContainer({
  children,
  maxWidth,
  fill,
}: ResponsiveContainerProps) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return <WebContainer maxWidth={maxWidth} fill={fill}>{children}</WebContainer>;
}

function WebContainer({
  children,
  maxWidth,
  fill,
}: ResponsiveContainerProps) {
  const { contentMaxWidth } = useResponsive();
  const resolvedMax = maxWidth ?? contentMaxWidth;

  if (!resolvedMax) {
    return <>{children}</>;
  }

  return (
    <View
      style={{
        width: "100%" as any,
        maxWidth: resolvedMax,
        alignSelf: "center" as const,
        ...(fill && { flex: 1 }),
      }}
    >
      {children}
    </View>
  );
}
