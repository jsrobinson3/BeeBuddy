import { renderHook, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useLocation } from "../hooks/useLocation";

// ---------- mocks ----------

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  geocodeAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const Location = require("expo-location");

jest.spyOn(Alert, "alert").mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------- getLocation ----------

describe("useLocation – getLocation", () => {
  it("returns coordinates when permission is granted", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: -33.8688, longitude: 151.2093 },
    });

    const { result } = renderHook(() => useLocation());

    let coords: any;
    await act(async () => {
      coords = await result.current.getLocation();
    });

    expect(coords).toEqual({ latitude: -33.8688, longitude: 151.2093 });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.Balanced,
    });
  });

  it("returns null and shows alert when permission is denied", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    });

    const { result } = renderHook(() => useLocation());

    let coords: any;
    await act(async () => {
      coords = await result.current.getLocation();
    });

    expect(coords).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Location Permission",
      expect.stringContaining("location access"),
      expect.any(Array),
    );
  });

  it("returns null and shows alert when getCurrentPositionAsync throws", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("timeout"));

    const { result } = renderHook(() => useLocation());

    let coords: any;
    await act(async () => {
      coords = await result.current.getLocation();
    });

    expect(coords).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Location Error",
      expect.stringContaining("Could not determine"),
    );
  });

  it("sets loading true while fetching and false afterward", async () => {
    let resolvePermission!: (v: any) => void;
    Location.requestForegroundPermissionsAsync.mockReturnValue(
      new Promise((r) => { resolvePermission = r; }),
    );

    const { result } = renderHook(() => useLocation());
    expect(result.current.loading).toBe(false);

    let promise: Promise<any>;
    act(() => {
      promise = result.current.getLocation();
    });
    // loading should be true while awaiting
    expect(result.current.loading).toBe(true);

    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 0, longitude: 0 },
    });

    await act(async () => {
      resolvePermission({ status: "granted" });
      await promise;
    });

    expect(result.current.loading).toBe(false);
  });
});

// ---------- geocodeAddress ----------

describe("useLocation – geocodeAddress", () => {
  it("returns coordinates for a valid address", async () => {
    Location.geocodeAsync.mockResolvedValue([
      { latitude: 45.5152, longitude: -122.6784 },
    ]);

    const { result } = renderHook(() => useLocation());

    let coords: any;
    await act(async () => {
      coords = await result.current.geocodeAddress("Portland, OR");
    });

    expect(coords).toEqual({ latitude: 45.5152, longitude: -122.6784 });
    expect(Location.geocodeAsync).toHaveBeenCalledWith("Portland, OR");
  });

  it("returns null for empty/whitespace address without calling API", async () => {
    const { result } = renderHook(() => useLocation());

    let coords: any;
    await act(async () => {
      coords = await result.current.geocodeAddress("   ");
    });

    expect(coords).toBeNull();
    expect(Location.geocodeAsync).not.toHaveBeenCalled();
  });

  it("returns null and shows alert when no results found", async () => {
    Location.geocodeAsync.mockResolvedValue([]);

    const { result } = renderHook(() => useLocation());

    let coords: any;
    await act(async () => {
      coords = await result.current.geocodeAddress("xyznoplace");
    });

    expect(coords).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Not Found",
      expect.stringContaining("Could not find coordinates"),
    );
  });

  it("returns null and shows alert when geocoding throws", async () => {
    Location.geocodeAsync.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useLocation());

    let coords: any;
    await act(async () => {
      coords = await result.current.geocodeAddress("Portland, OR");
    });

    expect(coords).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Geocoding Error",
      expect.stringContaining("Could not look up"),
    );
  });

  it("sets geocoding true while running and false afterward", async () => {
    let resolveGeocode!: (v: any) => void;
    Location.geocodeAsync.mockReturnValue(
      new Promise((r) => { resolveGeocode = r; }),
    );

    const { result } = renderHook(() => useLocation());
    expect(result.current.geocoding).toBe(false);

    let promise: Promise<any>;
    act(() => {
      promise = result.current.geocodeAddress("Portland, OR");
    });
    expect(result.current.geocoding).toBe(true);

    await act(async () => {
      resolveGeocode([{ latitude: 45.5, longitude: -122.6 }]);
      await promise;
    });

    expect(result.current.geocoding).toBe(false);
  });

  it("trims the address before geocoding", async () => {
    Location.geocodeAsync.mockResolvedValue([
      { latitude: 0, longitude: 0 },
    ]);

    const { result } = renderHook(() => useLocation());

    await act(async () => {
      await result.current.geocodeAddress("  Portland, OR  ");
    });

    expect(Location.geocodeAsync).toHaveBeenCalledWith("Portland, OR");
  });
});
