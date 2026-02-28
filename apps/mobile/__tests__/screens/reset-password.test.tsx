import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

// ---------- mocks (must come before component import) ----------

const mockReplace = jest.fn();
let mockToken: string | undefined = "valid-reset-token";

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

import ResetPasswordScreen from "../../app/reset-password";

// ---------- test helpers ----------

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = "valid-reset-token";
});

function renderScreen() {
  return render(<ResetPasswordScreen />);
}

// ---------- tests ----------

describe("ResetPasswordScreen", () => {
  it("shows form when token is present", () => {
    renderScreen();

    // "Reset Password" appears as both a card title and the submit button label
    const resetTexts = screen.getAllByText("Reset Password");
    expect(resetTexts.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Enter your new password below.")).toBeTruthy();
    expect(screen.getByPlaceholderText("New password")).toBeTruthy();
    expect(screen.getByPlaceholderText("Confirm password")).toBeTruthy();
  });

  it("shows error when no token provided", () => {
    mockToken = undefined;

    renderScreen();

    expect(screen.getByText("Invalid Link")).toBeTruthy();
    expect(
      screen.getByText("Invalid reset link. No token provided."),
    ).toBeTruthy();
  });

  it("validates password length (min 8 chars)", async () => {
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText("New password"), "short");
    fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "short");

    // The button text is "Reset Password" in the form
    const buttons = screen.getAllByText("Reset Password");
    // The ActionButton is the pressable one
    fireEvent.press(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 8 characters."),
      ).toBeTruthy();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("validates password match", async () => {
    renderScreen();

    fireEvent.changeText(
      screen.getByPlaceholderText("New password"),
      "password123",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Confirm password"),
      "different456",
    );

    const buttons = screen.getAllByText("Reset Password");
    fireEvent.press(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("submits successfully and shows success card", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    renderScreen();

    fireEvent.changeText(
      screen.getByPlaceholderText("New password"),
      "newpassword123",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Confirm password"),
      "newpassword123",
    );

    const buttons = screen.getAllByText("Reset Password");
    fireEvent.press(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("Password Reset!")).toBeTruthy();
    });

    expect(
      screen.getByText("Your password has been successfully reset."),
    ).toBeTruthy();

    // Verify fetch was called correctly
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.api/api/v1/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "valid-reset-token",
          new_password: "newpassword123",
        }),
      }),
    );
  });

  it("shows error on failed submission", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: "Token has expired" }),
    });

    renderScreen();

    fireEvent.changeText(
      screen.getByPlaceholderText("New password"),
      "newpassword123",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Confirm password"),
      "newpassword123",
    );

    const buttons = screen.getAllByText("Reset Password");
    fireEvent.press(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("Token has expired")).toBeTruthy();
    });
  });

  it("shows fallback error when API returns non-JSON error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    renderScreen();

    fireEvent.changeText(
      screen.getByPlaceholderText("New password"),
      "newpassword123",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Confirm password"),
      "newpassword123",
    );

    const buttons = screen.getAllByText("Reset Password");
    fireEvent.press(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("Reset failed (500)")).toBeTruthy();
    });
  });

  it('"Go to Login" button navigates to login after success', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    renderScreen();

    fireEvent.changeText(
      screen.getByPlaceholderText("New password"),
      "newpassword123",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Confirm password"),
      "newpassword123",
    );

    const buttons = screen.getAllByText("Reset Password");
    fireEvent.press(buttons[buttons.length - 1]);

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
