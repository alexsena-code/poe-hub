import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock next-auth before importing route
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// Mock prisma so we don't need DB data for these unit-style integration tests
vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: {
      findMany: vi.fn(),
    },
    dailyPrice: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "./route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

function getReq(url: string) {
  return new NextRequest(url);
}

const MOCK_LEAGUES = [
  {
    name: "Settlers",
    poeVersion: "poe1",
    startDate: new Date("2024-07-26"),
  },
  {
    name: "Necropolis",
    poeVersion: "poe1",
    startDate: new Date("2024-03-29"),
  },
];

const MOCK_DAILY_PRICES = [
  {
    date: new Date("2024-07-27"),
    league: "Settlers",
    median: "20.5",
    cnlPrice: "22.0",
  },
  {
    date: new Date("2024-07-28"),
    league: "Settlers",
    median: "21.0",
    cnlPrice: null,
  },
  {
    date: new Date("2024-03-30"),
    league: "Necropolis",
    median: "18.0",
    cnlPrice: "19.5",
  },
];

describe("GET /api/prices/daily/cross-league", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user", name: "admin", role: "admin" },
    } as never);
    vi.mocked(prisma.league.findMany).mockResolvedValue(MOCK_LEAGUES as never);
    vi.mocked(prisma.dailyPrice.findMany).mockResolvedValue(
      MOCK_DAILY_PRICES as never
    );
  });

  it("should return 401 without auth", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=Settlers"
      )
    );
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 400 when leagues param is missing", async () => {
    const res = await GET(
      getReq("http://localhost:3000/api/prices/daily/cross-league")
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("leagues parameter required");
  });

  it("should return 400 when leagues param is empty string", async () => {
    const res = await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues="
      )
    );
    expect(res.status).toBe(400);
  });

  it("should return correct structure with league data", async () => {
    const res = await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=Settlers,Necropolis"
      )
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("leagues");
    expect(body.leagues).toHaveLength(2);

    const settlers = body.leagues.find(
      (l: { name: string }) => l.name === "Settlers"
    );
    expect(settlers).toBeDefined();
    expect(settlers.poeVersion).toBe("poe1");
    expect(settlers.startDate).toBe("2024-07-26");
    expect(Array.isArray(settlers.data)).toBe(true);
  });

  it("should compute dayOfLeague correctly relative to startDate", async () => {
    const res = await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=Settlers"
      )
    );
    const body = await res.json();

    const settlers = body.leagues[0];
    // 2024-07-27 is day 2 of the league (startDate 2024-07-26 is day 1)
    const day2 = settlers.data.find((d: { dayOfLeague: number }) => d.dayOfLeague === 2);
    expect(day2).toBeDefined();
    expect(day2.median).toBeCloseTo(20.5);
  });

  it("should include cnlPrice in data points when available", async () => {
    const res = await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=Settlers"
      )
    );
    const body = await res.json();

    const settlers = body.leagues[0];
    const day2 = settlers.data.find((d: { dayOfLeague: number }) => d.dayOfLeague === 2);
    expect(day2.cnlPrice).toBeCloseTo(22.0);
  });

  it("should set cnlPrice to null when not present in source data", async () => {
    const res = await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=Settlers"
      )
    );
    const body = await res.json();

    const settlers = body.leagues[0];
    const day3 = settlers.data.find((d: { dayOfLeague: number }) => d.dayOfLeague === 3);
    expect(day3).toBeDefined();
    expect(day3.cnlPrice).toBeNull();
  });

  it("should return 400 when a requested league has no startDate", async () => {
    vi.mocked(prisma.league.findMany).mockResolvedValueOnce([
      { name: "NoDate", poeVersion: "poe1", startDate: null },
    ] as never);

    const res = await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=NoDate"
      )
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("NoDate");
  });

  it("should respect maxDays param and exclude data beyond it", async () => {
    // League starts 2024-07-26; day 2 = July 27, day 3 = July 28
    // maxDays=1 means only day 1 (league start day) is included; days 2 and 3 should be excluded
    const res = await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=Settlers&maxDays=1"
      )
    );
    const body = await res.json();

    const settlers = body.leagues[0];
    // Both mock rows are day 2 and 3 → all should be filtered out
    expect(settlers.data).toHaveLength(0);
  });

  it("should use default item=divine when item param is omitted", async () => {
    await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=Settlers"
      )
    );

    expect(prisma.dailyPrice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ item: "divine" }),
      })
    );
  });

  it("should use custom item param when provided", async () => {
    await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=Settlers&item=mirror"
      )
    );

    expect(prisma.dailyPrice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ item: "mirror" }),
      })
    );
  });

  it("should cap maxDays at 180", async () => {
    const res = await GET(
      getReq(
        "http://localhost:3000/api/prices/daily/cross-league?leagues=Settlers&maxDays=9999"
      )
    );
    // Should still succeed — the cap is internal, not an error
    expect(res.status).toBe(200);
  });
});
