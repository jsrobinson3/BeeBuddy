import { useWindowDimensions } from "react-native";
import { breakpoints } from "../theme/tokens";

export type ScreenClass = "mobile" | "tablet" | "desktop";

export interface ResponsiveInfo {
  width: number;
  screenClass: ScreenClass;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  columns: 1 | 2 | 3;
  contentMaxWidth: number | undefined;
}

export function useResponsive(): ResponsiveInfo {
  const { width } = useWindowDimensions();

  const screenClass: ScreenClass =
    width >= breakpoints.desktop
      ? "desktop"
      : width >= breakpoints.tablet
        ? "tablet"
        : "mobile";

  const isMobile = screenClass === "mobile";
  const isTablet = screenClass === "tablet";
  const isDesktop = screenClass === "desktop";

  const columns: 1 | 2 | 3 = isDesktop ? 3 : isTablet ? 2 : 1;

  const contentMaxWidth = isDesktop
    ? breakpoints.maxDesktopWidth
    : isTablet
      ? breakpoints.maxContentWidth
      : undefined;

  return {
    width,
    screenClass,
    isMobile,
    isTablet,
    isDesktop,
    columns,
    contentMaxWidth,
  };
}
