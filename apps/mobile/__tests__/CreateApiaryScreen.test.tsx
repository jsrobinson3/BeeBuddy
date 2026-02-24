import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

// ---------- mocks ----------

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack }) }));

const mockMutateAsync = jest.fn();
jest.mock("../../../../hooks/useApiaries", () => ({
  useCreateApiary: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}), { virtual: true });

// Resolve relative to the screen's own import path
jest.mock("../hooks/useApiaries", () => ({
  useCreateApiary: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

const mockGetLocation = jest.fn();
const mockGeocodeAddress = jest.fn();
jest.mock("../hooks/useLocation", () => {
  const actual = jest.requireActual("../hooks/useLocation");
  return {
    ...actual,
    useLocation: () => ({
      getLocation: mockGetLocation,
      geocodeAddress: mockGeocodeAddress,
      loading: false,
      geocoding: false,
    }),
  };
});

// Provide minimal theme stubs so the component renders
jest.mock("../theme", () => ({
  useStyles: (factory: any) => {
    // Return a plain object – styles aren't tested here
    try {
      return factory({
        bgPrimary: "#fff",
        bgSurface: "#fff",
        bgElevated: "#fff",
        bgInput: "#eee",
        bgInputSoft: "#eee",
        textPrimary: "#000",
        textSecondary: "#666",
        textMuted: "#999",
        textOnPrimary: "#fff",
        border: "#ccc",
        borderLight: "#ddd",
        borderFocus: "#aaa",
        honey: "#fdbc48",
        honeyLight: "#fee8b6",
        honeyPale: "#fff7e5",
        honeyDark: "#946000",
        selectedBg: "#fff7e5",
        selectedBorder: "#fdbc48",
        selectedText: "#946000",
        primaryFill: "#fdbc48",
        danger: "#c0392b",
        placeholder: "#bbb",
      });
    } catch {
      return {};
    }
  },
  useTheme: () => ({
    colors: { honey: "#fdbc48", textPrimary: "#000", placeholder: "#bbb" },
    mode: "light",
    isDark: false,
  }),
  typography: {
    families: {
      display: "System",
      displayBold: "System",
      body: "System",
      bodySemiBold: "System",
      bodyMedium: "System",
    },
  },
  formContainerStyles: () => ({
    container: { flex: 1 },
    content: { padding: 16 },
  }),
  formSubmitStyles: () => ({
    submitButton: {},
    submitDisabled: {},
    submitText: {},
  }),
}));

jest.spyOn(Alert, "alert").mockImplementation(() => {});

import CreateApiaryScreen from "../app/(tabs)/(home)/apiary/new";

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------- helpers ----------

function renderScreen() {
  return render(<CreateApiaryScreen />);
}

// ---------- basic rendering ----------

describe("CreateApiaryScreen", () => {
  it("renders form fields", () => {
    renderScreen();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("City")).toBeTruthy();
    expect(screen.getByText("Address or Place")).toBeTruthy();
    expect(screen.getByText("Latitude")).toBeTruthy();
    expect(screen.getByText("Longitude")).toBeTruthy();
    expect(screen.getByText("Location Precision")).toBeTruthy();
    expect(screen.getByText("Notes")).toBeTruthy();
  });

  it("renders precision picker options", () => {
    renderScreen();
    expect(screen.getByText("Exact (~11 m)")).toBeTruthy();
    expect(screen.getByText("Approximate (~1 km)")).toBeTruthy();
    expect(screen.getByText("General area (~11 km)")).toBeTruthy();
  });

  it("defaults precision to approximate", () => {
    renderScreen();
    // The hint text for approximate should be shown by default
    expect(
      screen.getByText(/Rounded to ~1 km/),
    ).toBeTruthy();
  });

  // ---------- validation ----------

  it("shows error when name is empty on submit", async () => {
    renderScreen();
    fireEvent.press(screen.getByText("Create Apiary"));

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeTruthy();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  // ---------- Use My Location ----------

  it("fills lat/lng when Use My Location succeeds", async () => {
    mockGetLocation.mockResolvedValue({ latitude: -33.8688, longitude: 151.2093 });
    renderScreen();

    fireEvent.press(screen.getByText("Use My Location"));

    await waitFor(() => {
      expect(mockGetLocation).toHaveBeenCalled();
    });

    // The inputs should contain the coordinates (as strings)
    const latInput = screen.getByPlaceholderText("e.g. -33.8688");
    const lngInput = screen.getByPlaceholderText("e.g. 151.2093");
    expect(latInput.props.value).toBe("-33.8688");
    expect(lngInput.props.value).toBe("151.2093");
  });

  it("does not fill lat/lng when Use My Location returns null", async () => {
    mockGetLocation.mockResolvedValue(null);
    renderScreen();

    fireEvent.press(screen.getByText("Use My Location"));

    await waitFor(() => {
      expect(mockGetLocation).toHaveBeenCalled();
    });

    const latInput = screen.getByPlaceholderText("e.g. -33.8688");
    expect(latInput.props.value).toBe("");
  });

  // ---------- Address Look Up ----------

  it("fills lat/lng when address Look Up succeeds", async () => {
    mockGeocodeAddress.mockResolvedValue({ latitude: 45.5152, longitude: -122.6784 });
    renderScreen();

    // Type an address
    const addressInput = screen.getByPlaceholderText("e.g. 123 Main St, Portland OR");
    fireEvent.changeText(addressInput, "Portland, OR");

    // Press Look Up
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => {
      expect(mockGeocodeAddress).toHaveBeenCalledWith("Portland, OR");
    });

    const latInput = screen.getByPlaceholderText("e.g. -33.8688");
    const lngInput = screen.getByPlaceholderText("e.g. 151.2093");
    expect(latInput.props.value).toBe("45.5152");
    expect(lngInput.props.value).toBe("-122.6784");
  });

  // ---------- precision applied on submit ----------

  it("rounds coordinates to approximate precision on submit", async () => {
    mockMutateAsync.mockResolvedValue({});
    renderScreen();

    // Fill required name
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Home Apiary"), "Test Apiary");

    // Fill coordinates with high precision
    fireEvent.changeText(screen.getByPlaceholderText("e.g. -33.8688"), "45.12345678");
    fireEvent.changeText(screen.getByPlaceholderText("e.g. 151.2093"), "-122.67891234");

    // Default precision is "approximate" (2 decimals)
    fireEvent.press(screen.getByText("Create Apiary"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Apiary",
          latitude: 45.12,      // rounded to 2 decimals
          longitude: -122.68,   // rounded to 2 decimals
        }),
      );
    });
  });

  it("rounds coordinates to exact precision when selected", async () => {
    mockMutateAsync.mockResolvedValue({});
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Home Apiary"), "Precise Apiary");
    fireEvent.changeText(screen.getByPlaceholderText("e.g. -33.8688"), "45.12345678");
    fireEvent.changeText(screen.getByPlaceholderText("e.g. 151.2093"), "-122.67891234");

    // Select exact precision
    fireEvent.press(screen.getByText("Exact (~11 m)"));

    fireEvent.press(screen.getByText("Create Apiary"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 45.1235,      // rounded to 4 decimals
          longitude: -122.6789,   // rounded to 4 decimals
        }),
      );
    });
  });

  it("rounds coordinates to general precision when selected", async () => {
    mockMutateAsync.mockResolvedValue({});
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Home Apiary"), "General Apiary");
    fireEvent.changeText(screen.getByPlaceholderText("e.g. -33.8688"), "45.12345678");
    fireEvent.changeText(screen.getByPlaceholderText("e.g. 151.2093"), "-122.67891234");

    // Select general precision
    fireEvent.press(screen.getByText("General area (~11 km)"));

    fireEvent.press(screen.getByText("Create Apiary"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 45.1,       // rounded to 1 decimal
          longitude: -122.7,    // rounded to 1 decimal
        }),
      );
    });
  });

  // ---------- precision hint text ----------

  it("shows correct hint text for each precision level", () => {
    renderScreen();

    // Default is approximate
    expect(screen.getByText(/Rounded to ~1 km/)).toBeTruthy();

    // Switch to exact
    fireEvent.press(screen.getByText("Exact (~11 m)"));
    expect(screen.getByText(/Full precision stored/)).toBeTruthy();

    // Switch to general
    fireEvent.press(screen.getByText("General area (~11 km)"));
    expect(screen.getByText(/Rounded to ~11 km/)).toBeTruthy();
  });

  // ---------- submit without coordinates ----------

  it("submits without coordinates when fields are empty", async () => {
    mockMutateAsync.mockResolvedValue({});
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Home Apiary"), "No Coords Apiary");
    fireEvent.press(screen.getByText("Create Apiary"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "No Coords Apiary",
          latitude: undefined,
          longitude: undefined,
        }),
      );
    });
  });

  // ---------- navigation ----------

  it("navigates back on successful creation", async () => {
    mockMutateAsync.mockResolvedValue({});
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Home Apiary"), "Backyard Bees");
    fireEvent.press(screen.getByText("Create Apiary"));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it("shows alert on creation error", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Server error"));
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Home Apiary"), "Fail Apiary");
    fireEvent.press(screen.getByText("Create Apiary"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Server error");
    });
  });
});
