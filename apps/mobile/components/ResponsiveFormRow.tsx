import React from "react";
import { Platform, View } from "react-native";

import { useResponsive } from "../hooks/useResponsive";
import { spacing } from "../theme/tokens";

interface ResponsiveFormRowProps {
  children: React.ReactNode;
  gap?: number;
}

export function ResponsiveFormRow({
  children,
  gap = spacing.md,
}: ResponsiveFormRowProps) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <WebFormRow gap={gap}>{children}</WebFormRow>
  );
}

function FormCell({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

function WebFormRow({
  children,
  gap,
}: Required<Pick<ResponsiveFormRowProps, "gap">> & {
  children: React.ReactNode;
}) {
  const { isMobile } = useResponsive();

  if (isMobile) {
    return <>{children}</>;
  }

  const childArray = React.Children.toArray(children);

  return (
    <View style={{ flexDirection: "row" as const, gap }}>
      {childArray.map((child, i) => (
        <FormCell key={i}>{child}</FormCell>
      ))}
    </View>
  );
}
