import { describe, it, expect } from "vitest";
import {
  extrapolatePrice,
  PRICE_DECAY_PER_DAY,
  type PriceRow,
} from "./price-extrapolation";

const rows: PriceRow[] = [
  { date: "2026-01-01", price: 100 },
  { date: "2026-01-02", price: 90 },
  { date: "2026-01-05", price: 80 },
];

describe("extrapolatePrice", () => {
  it("returns null when input is empty", () => {
    expect(extrapolatePrice([], "2026-01-01")).toBeNull();
  });

  it("returns null when targetDate is malformed", () => {
    expect(extrapolatePrice(rows, "01/01/2026")).toBeNull();
    expect(extrapolatePrice(rows, "2026-13-40")).not.toBeNull();
  });

  it("returns the row's price as-is on direct hit", () => {
    const out = extrapolatePrice(rows, "2026-01-02");
    expect(out).toEqual({ price: 90, fromHistorical: true });
  });

  it("decays compoundedly after the last known date", () => {
    const out = extrapolatePrice(rows, "2026-01-07");
    expect(out?.fromHistorical).toBe(false);
    // 80 * 0.9^2 = 64.8
    expect(out?.price).toBeCloseTo(64.8, 5);
  });

  it("decays inside a gap from the last anchor before targetDate", () => {
    const out = extrapolatePrice(rows, "2026-01-04");
    // Anchor is 2026-01-02 (90), 2 days back → 90 * 0.9^2 = 72.9
    expect(out).toEqual({ price: 72.9, fromHistorical: false });
  });

  it("returns the first known price (no reverse decay) before the series starts", () => {
    const out = extrapolatePrice(rows, "2025-12-25");
    expect(out).toEqual({ price: 100, fromHistorical: false });
  });

  it("respects a custom decayPerDay", () => {
    const out = extrapolatePrice(rows, "2026-01-06", 0.5);
    // Anchor is 2026-01-05 (80), 1 day → 80 * 0.5 = 40
    expect(out?.price).toBeCloseTo(40, 5);
  });

  it("throws for invalid decayPerDay", () => {
    expect(() => extrapolatePrice(rows, "2026-01-01", 1)).toThrow(/bad decayPerDay/);
    expect(() => extrapolatePrice(rows, "2026-01-01", -0.1)).toThrow(/bad decayPerDay/);
  });

  it("uses the documented default decay of 10%", () => {
    const out = extrapolatePrice(rows, "2026-01-06");
    expect(out?.price).toBeCloseTo(80 * (1 - PRICE_DECAY_PER_DAY), 5);
  });

  it("handles single-row series across direct/before/after cases", () => {
    const single: PriceRow[] = [{ date: "2026-02-10", price: 50 }];
    expect(extrapolatePrice(single, "2026-02-10")).toEqual({
      price: 50,
      fromHistorical: true,
    });
    expect(extrapolatePrice(single, "2026-02-09")).toEqual({
      price: 50,
      fromHistorical: false,
    });
    const after = extrapolatePrice(single, "2026-02-13");
    expect(after?.fromHistorical).toBe(false);
    // 50 * 0.9^3 = 36.45
    expect(after?.price).toBeCloseTo(36.45, 5);
  });
});
