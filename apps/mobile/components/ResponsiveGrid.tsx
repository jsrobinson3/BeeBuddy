import React from "react";
import { Platform, View } from "react-native";

import { useResponsive } from "../hooks/useResponsive";
import { spacing } from "../theme/tokens";

interface ResponsiveGridProps {
  children: React.ReactNode;
  minColumnWidth?: number;
  gap?: number;
}

export function ResponsiveGrid({
  children,
  minColumnWidth = 300,
  gap = spacing.md,
}: ResponsiveGridProps) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <WebGrid minColumnWidth={minColumnWidth} gap={gap}>
      {children}
    </WebGrid>
  );
}

function GridCell({
  children,
  minWidth,
  gap,
}: {
  children: React.ReactNode;
  minWidth: number;
  gap: number;
}) {
  return (
    <View
      style={{
        minWidth,
        flexBasis: "50%" as any,
        flexGrow: 1,
        paddingHorizontal: gap / 2,
        marginBottom: gap,
      }}
    >
      {children}
    </View>
  );
}

function WebGrid({
  children,
  minColumnWidth,
  gap,
}: Required<Pick<ResponsiveGridProps, "minColumnWidth" | "gap">> & {
  children: React.ReactNode;
}) {
  const { isMobile } = useResponsive();

  if (isMobile) {
    return <>{children}</>;
  }

  const childArray = React.Children.toArray(children);

  return (
    <View
      style={{
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        marginHorizontal: -(gap / 2),
      }}
    >
      {childArray.map((child, i) => (
        <GridCell key={i} minWidth={minColumnWidth} gap={gap}>
          {child}
        </GridCell>
      ))}
    </View>
  );
}
