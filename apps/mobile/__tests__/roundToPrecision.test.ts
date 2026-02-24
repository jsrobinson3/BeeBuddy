import { roundToPrecision, type LocationPrecision } from "../hooks/useLocation";

describe("roundToPrecision", () => {
  const coord = 45.12345678;

  it("rounds to 4 decimal places for exact precision", () => {
    expect(roundToPrecision(coord, "exact")).toBe(45.1235);
  });

  it("rounds to 2 decimal places for approximate precision", () => {
    expect(roundToPrecision(coord, "approximate")).toBe(45.12);
  });

  it("rounds to 1 decimal place for general precision", () => {
    expect(roundToPrecision(coord, "general")).toBe(45.1);
  });

  it("handles negative coordinates (southern/western hemispheres)", () => {
    expect(roundToPrecision(-33.86882, "exact")).toBe(-33.8688);
    expect(roundToPrecision(-33.86882, "approximate")).toBe(-33.87);
    expect(roundToPrecision(-33.86882, "general")).toBe(-33.9);
  });

  it("handles zero", () => {
    expect(roundToPrecision(0, "exact")).toBe(0);
    expect(roundToPrecision(0, "approximate")).toBe(0);
    expect(roundToPrecision(0, "general")).toBe(0);
  });

  it("rounds up correctly at midpoint", () => {
    // 0.5 rounds up to 1 at the relevant decimal
    expect(roundToPrecision(45.00005, "exact")).toBe(45.0001);
    expect(roundToPrecision(45.005, "approximate")).toBe(45.01);
    expect(roundToPrecision(45.05, "general")).toBe(45.1);
  });

  it("preserves precision when value already matches target decimals", () => {
    expect(roundToPrecision(45.1234, "exact")).toBe(45.1234);
    expect(roundToPrecision(45.12, "approximate")).toBe(45.12);
    expect(roundToPrecision(45.1, "general")).toBe(45.1);
  });

  it("rounds each precision level independently", () => {
    // Demonstrate that the same coordinate yields different results per level
    const lat = 51.507351; // London
    const results: Record<LocationPrecision, number> = {
      exact: roundToPrecision(lat, "exact"),
      approximate: roundToPrecision(lat, "approximate"),
      general: roundToPrecision(lat, "general"),
    };
    expect(results.exact).toBe(51.5074);       // ~11m
    expect(results.approximate).toBe(51.51);    // ~1.1km
    expect(results.general).toBe(51.5);         // ~11km
  });
});
