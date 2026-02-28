import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";

// ---------- mocks (must come before component import) ----------

const mockReplace = jest.fn();
let mockToken: string | undefined = "valid-token-123";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ token: mockToken }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("../../services/config", () => ({
  API_BASE_URL: "https://test.api",
}));

jest.mock("../../components/GradientHeader", () => {
  const { View } = require("react-native");
  return {
    GradientHeader: ({ children }: { children?: React.ReactNode }) => (
      <View testID="gradient-header">{children}</View>
    ),
  };
});

// Provide minimal theme stubs so the component renders
jest.mock("../../theme", () => {
  const stubColors: Record<string, unknown> = {
    bgPrimary: "#fff",
    bgSurface: "#fff",
    bgElevated: "#fff",
    bgInput: "#eee",
    bgInputSoft: "#eee",
    textPrimary: "#000",
    textSecondary: "#666",
    textMuted: "#999",
    textOnPrimary: "#fff",
    textOnDanger: "#fff",
    border: "#ccc",
    borderLight: "#ddd",
    borderFocus: "#aaa",
    honey: "#fdbc48",
    honeyLight: "#fee8b6",
    honeyPale: "#fff7e5",
    honeyDark: "#946000",
    forest: "#3f4a30",
    forestLight: "#5a6b45",
    forestPale: "#e8ecdf",
    forestDark: "#2a3220",
    gradientStart: "#2a3220",
    gradientEnd: "#fff7e5",
    textOnGradient: "#fff",
    textOnGradientMuted: "rgba(250,250,247,0.8)",
    selectedBg: "#fff7e5",
    selectedBorder: "#fdbc48",
    selectedText: "#946000",
    primaryFill: "#fdbc48",
    primaryFillPressed: "#946000",
    secondaryFill: "transparent",
    success: "#27ae60",
    warning: "#f39c12",
    danger: "#c0392b",
    info: "#2980b9",
    shadowColor: "#3f4a30",
    placeholder: "#bbb",
    switchTrackFalse: "#ddd",
    switchTrackTrue: "#fdbc48",
    switchThumb: "#fff",
    tabBarBg: "#fff",
    tabBarActiveTint: "#fdbc48",
    tabBarInactiveTint: "#5a6b45",
    headerBackground: "#3f4a30",
    headerTint: "#fff",
    statusBarStyle: "light",
  };

  return {
    useStyles: (factory: (c: Record<string, unknown>) => Record<string, unknown>) => {
      try {
        return factory(stubColors);
      } catch {
        return {};
      }
    },
    useTheme: () => ({
      colors: stubColors,
      mode: "light",
      isDark: false,
    }),
    typography: {
      families: {
        display: "System",
        displayBold: "System",
        displaySemiBold: "System",
        body: "System",
        bodyMedium: "System",
        bodySemiBold: "System",
        bodyBold: "System",
        mono: "System",
      },
      sizes: {
        h1: { fontSize: 32, lineHeight: 38 },
        h2: { fontSize: 26, lineHeight: 33 },
        h3: { fontSize: 20, lineHeight: 26 },
        h4: { fontSize: 16, lineHeight: 22 },
        body: { fontSize: 16, lineHeight: 24 },
        bodySm: { fontSize: 14, lineHeight: 21 },
        caption: { fontSize: 12, lineHeight: 17 },
        overline: { fontSize: 11, lineHeight: 18 },
      },
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    radii: { sm: 6, md: 8, lg: 12, xl: 16 },
    shadows: {
      card: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      },
    },
  };
});

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------- import component after mocks ----------

import VerifyEmailScreen from "../../app/verify-email";

// ---------- test helpers ----------

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = "valid-token-123";
});

function renderScreen() {
  return render(<VerifyEmailScreen />);
}

// ---------- tests ----------

describe("VerifyEmailScreen", () => {
  it("renders loading state when token is present", () => {
    // Keep fetch pending so the screen stays in loading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    renderScreen();

    expect(screen.getByText("Verifying your email...")).toBeTruthy();
  });

  it("shows error when no token provided", () => {
    mockToken = undefined;

    renderScreen();

    expect(screen.getByText("Verification Failed")).toBeTruthy();
    expect(
      screen.getByText("Invalid verification link. No token provided."),
    ).toBeTruthy();
  });

  it("shows success card after successful API call", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ email: "bee@keeper.com" }),
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Email Verified!")).toBeTruthy();
    });

    expect(screen.getByText("bee@keeper.com")).toBeTruthy();
    expect(
      screen.getByText("Your email has been successfully verified."),
    ).toBeTruthy();

    // Verify fetch was called with correct URL and body
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.api/api/v1/auth/verify-email",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "valid-token-123" }),
      }),
    );
  });

  it("shows error card when API call fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: "Token expired" }),
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Verification Failed")).toBeTruthy();
    });

    expect(screen.getByText("Token expired")).toBeTruthy();
  });

  it("shows fallback error when API returns non-JSON error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Verification Failed")).toBeTruthy();
    });

    expect(screen.getByText("Verification failed (500)")).toBeTruthy();
  });

  it('"Go to Login" button navigates to login', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ email: "bee@keeper.com" }),
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Go to Login")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Go to Login"));

    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  it('"Go to Login" button on error card navigates to login', () => {
    mockToken = undefined;

    renderScreen();

    fireEvent.press(screen.getByText("Go to Login"));

    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });
});
