import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock next-auth before importing route
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", name: "admin", role: "admin" },
  }),
}));

// Mock prisma — create-projected only reads leagues/dailyPrices and inserts simulations
vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: {
      findMany: vi.fn(),
    },
    dailyPrice: {
      findMany: vi.fn(),
    },
    globalCostConfig: {
      findFirst: vi.fn(),
    },
    simulation: {
      create: vi.fn(),
    },
  },
}));

import { POST } from "./route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

function postReq(body: unknown) {
  return new NextRequest(
    "http://localhost:3000/api/simulations/create-projected",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

const BASE_PAYLOAD = {
  name: "Test Sim",
  league: "Settlers",
  durationWeeks: 2,
  startDayOffset: 0,
  leagueSources: ["Settlers"],
  priceSource: "median",
  defaultActiveBots: 5,
  defaultDivinePerHour: 0.5,
  defaultHoursPerDay: 24,
};

const MOCK_LEAGUES = [
  { name: "Settlers", startDate: new Date("2024-07-26") },
];

// Helper: build daily prices for N weeks worth of days starting from day 2 of league
function buildDailyPrices(
  leagueName: string,
  startDate: Date,
  durationWeeks: number,
  basePrice: number
) {
  const prices = [];
  const totalDays = durationWeeks * 7;
  for (let day = 2; day <= totalDays; day++) {
    const date = new Date(startDate.getTime() + (day - 1) * 86400000);
    prices.push({
      league: leagueName,
      date,
      item: "divine",
      median: String(basePrice + day * 0.1),
      cnlPrice: null,
    });
  }
  return prices;
}

describe("POST /api/simulations/create-projected", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user", name: "admin", role: "admin" },
    } as never);

    vi.mocked(prisma.league.findMany).mockResolvedValue(MOCK_LEAGUES as never);
    vi.mocked(prisma.dailyPrice.findMany).mockResolvedValue(
      buildDailyPrices("Settlers", new Date("2024-07-26"), 2, 20) as never
    );
    vi.mocked(prisma.globalCostConfig.findFirst).mockResolvedValue(null);

    let simCounter = 0;
    vi.mocked(prisma.simulation.create).mockImplementation(
      async ({ data }: { data: { name: string } }) => ({
        id: `sim-${++simCounter}`,
        name: data.name,
      })
    );
  });

  // ------------------------------------------------------------------
  // Auth
  // ------------------------------------------------------------------
  it("should return 401 without auth", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await POST(postReq(BASE_PAYLOAD));
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------
  it("should return 400 when name is missing", async () => {
    const { name: _name, ...rest } = BASE_PAYLOAD;
    const res = await POST(postReq(rest));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("should return 400 when league is missing", async () => {
    const { league: _league, ...rest } = BASE_PAYLOAD;
    const res = await POST(postReq(rest));
    expect(res.status).toBe(400);
  });

  it("should return 400 when durationWeeks is below 1", async () => {
    const res = await POST(postReq({ ...BASE_PAYLOAD, durationWeeks: 0 }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when leagueSources is empty", async () => {
    const res = await POST(postReq({ ...BASE_PAYLOAD, leagueSources: [] }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when a source league is not found in DB", async () => {
    vi.mocked(prisma.league.findMany).mockResolvedValueOnce([] as never);

    const res = await POST(postReq(BASE_PAYLOAD));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Leagues not found");
  });

  // ------------------------------------------------------------------
  // Happy path — creates 3 simulations
  // ------------------------------------------------------------------
  it("should create exactly 3 simulations (optimistic/expected/pessimistic)", async () => {
    const res = await POST(postReq(BASE_PAYLOAD));
    expect(res.status).toBe(201);

    expect(prisma.simulation.create).toHaveBeenCalledTimes(3);
  });

  it("should return ids and scenario labels in response", async () => {
    const res = await POST(postReq(BASE_PAYLOAD));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.ids).toHaveLength(3);
    expect(body.scenarios).toHaveLength(3);

    const labels = body.scenarios.map((s: { label: string }) => s.label);
    expect(labels).toContain("Otimista");
    expect(labels).toContain("Esperado");
    expect(labels).toContain("Pessimista");
  });

  it("should name simulations with the provided name + suffix", async () => {
    await POST(postReq({ ...BASE_PAYLOAD, name: "Liga Nova" }));

    const calls = vi.mocked(prisma.simulation.create).mock.calls;
    const names = calls.map((c) => (c[0] as { data: { name: string } }).data.name);

    expect(names).toContain("Liga Nova - Otimista");
    expect(names).toContain("Liga Nova - Esperado");
    expect(names).toContain("Liga Nova - Pessimista");
  });

  it("should create simulations with draft status", async () => {
    await POST(postReq(BASE_PAYLOAD));

    const calls = vi.mocked(prisma.simulation.create).mock.calls;
    for (const call of calls) {
      expect((call[0] as { data: { status: string } }).data.status).toBe("draft");
    }
  });

  it("should set durationWeeks correctly on each simulation", async () => {
    await POST(postReq({ ...BASE_PAYLOAD, durationWeeks: 4 }));

    const calls = vi.mocked(prisma.simulation.create).mock.calls;
    for (const call of calls) {
      expect((call[0] as { data: { durationWeeks: number } }).data.durationWeeks).toBe(4);
    }
  });

  // ------------------------------------------------------------------
  // Weighted average for expected scenario
  // ------------------------------------------------------------------
  it("should use weighted average for expected scenario when multiple sources", async () => {
    // Two source leagues with different prices for the same day of league
    const startA = new Date("2024-07-26");
    const startB = new Date("2024-03-29");

    vi.mocked(prisma.league.findMany).mockResolvedValueOnce([
      { name: "Settlers", startDate: startA },
      { name: "Necropolis", startDate: startB },
    ] as never);

    const pricesA = buildDailyPrices("Settlers", startA, 1, 20); // ~20.x
    const pricesB = buildDailyPrices("Necropolis", startB, 1, 10); // ~10.x
    vi.mocked(prisma.dailyPrice.findMany).mockResolvedValueOnce(
      [...pricesA, ...pricesB] as never
    );

    const res = await POST(
      postReq({
        ...BASE_PAYLOAD,
        leagueSources: ["Settlers", "Necropolis"],
        durationWeeks: 1,
      })
    );
    expect(res.status).toBe(201);

    // The expected scenario should exist and was created
    const calls = vi.mocked(prisma.simulation.create).mock.calls;
    const expectedCall = calls.find((c) =>
      (c[0] as { data: { name: string } }).data.name.includes("Esperado")
    );
    expect(expectedCall).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Cost config snapshot
  // ------------------------------------------------------------------
  it("should snapshot cost config fields when a default config exists", async () => {
    const mockConfig = {
      id: "cost-config-1",
      name: "Default Config",
      isDefault: true,
      proxyCostPerBotMonthly: "10.00",
      levelingCostPerBot: "5.00",
      stashPackCostPerBot: "2.00",
      expluginsKeyCostDaily: "0.50",
      dpbKeyCostDaily: "0.30",
    };
    vi.mocked(prisma.globalCostConfig.findFirst).mockResolvedValueOnce(
      mockConfig as never
    );

    await POST(postReq(BASE_PAYLOAD));

    const calls = vi.mocked(prisma.simulation.create).mock.calls;
    for (const call of calls) {
      const data = (call[0] as { data: Record<string, unknown> }).data;
      expect(data.costConfigName).toBe("Default Config");
      expect(data.proxyCostPerBotMonthly).toBe("10.00");
    }
  });

  it("should not include cost fields when no default config exists", async () => {
    vi.mocked(prisma.globalCostConfig.findFirst).mockResolvedValueOnce(null);

    await POST(postReq(BASE_PAYLOAD));

    const calls = vi.mocked(prisma.simulation.create).mock.calls;
    for (const call of calls) {
      const data = (call[0] as { data: Record<string, unknown> }).data;
      expect(data.costConfigName).toBeUndefined();
    }
  });

  // ------------------------------------------------------------------
  // startDayOffset — first N days should have activeBots=0
  // ------------------------------------------------------------------
  it("should set activeBots=0 for days before startDayOffset", async () => {
    await POST(postReq({ ...BASE_PAYLOAD, startDayOffset: 3, durationWeeks: 1 }));

    const calls = vi.mocked(prisma.simulation.create).mock.calls;
    // Check all 3 simulations (optimistic, expected, pessimistic)
    for (const call of calls) {
      const data = (call[0] as {
        data: { weeks: { create: Array<{ days: { create: Array<{ activeBots?: number }> } }> } };
      }).data;
      const week1Days = data.weeks.create[0].days.create;
      // Days 0, 1, 2 (globalDayIndex 0,1,2 < startDayOffset 3) should have activeBots=0
      expect(week1Days[0].activeBots).toBe(0);
      expect(week1Days[1].activeBots).toBe(0);
      expect(week1Days[2].activeBots).toBe(0);
      // Day 3+ should NOT have activeBots override
      expect(week1Days[3].activeBots).toBeUndefined();
    }
  });

  // ------------------------------------------------------------------
  // Week 1 bots default to 0 (launch week)
  // ------------------------------------------------------------------
  it("should set defaultActiveBots=0 for week 1 regardless of input", async () => {
    await POST(postReq({ ...BASE_PAYLOAD, defaultActiveBots: 10, durationWeeks: 2 }));

    const calls = vi.mocked(prisma.simulation.create).mock.calls;
    for (const call of calls) {
      const data = (call[0] as {
        data: { weeks: { create: Array<{ defaultActiveBots: number; weekNumber: number }> } };
      }).data;
      const week1 = data.weeks.create.find((w) => w.weekNumber === 1);
      expect(week1?.defaultActiveBots).toBe(0);

      const week2 = data.weeks.create.find((w) => w.weekNumber === 2);
      expect(week2?.defaultActiveBots).toBe(10);
    }
  });

  // ------------------------------------------------------------------
  // priceSource=cnl uses cnlPrice field when available
  // ------------------------------------------------------------------
  it("should use cnlPrice when priceSource=cnl and cnlPrice is available", async () => {
    const startDate = new Date("2024-07-26");
    const pricesWithCnl = [
      {
        league: "Settlers",
        date: new Date("2024-07-27"),
        item: "divine",
        median: "20.0",
        cnlPrice: "30.0",
      },
    ];
    vi.mocked(prisma.dailyPrice.findMany).mockResolvedValueOnce(
      pricesWithCnl as never
    );
    vi.mocked(prisma.league.findMany).mockResolvedValueOnce([
      { name: "Settlers", startDate },
    ] as never);

    const res = await POST(
      postReq({ ...BASE_PAYLOAD, priceSource: "cnl", durationWeeks: 1 })
    );
    expect(res.status).toBe(201);

    const calls = vi.mocked(prisma.simulation.create).mock.calls;
    // The optimistic scenario should have used 30.0 (cnlPrice), not 20.0 (median)
    const optimisticCall = calls.find((c) =>
      (c[0] as { data: { name: string } }).data.name.includes("Otimista")
    );
    expect(optimisticCall).toBeDefined();
    const week1Days = (
      optimisticCall![0] as {
        data: { weeks: { create: Array<{ days: { create: Array<{ divinePriceBrl: string | null }> } }> } };
      }
    ).data.weeks.create[0].days.create;
    // Day 2 of league (index 1 in week 1 days) should have price = "30"
    const day2 = week1Days[1];
    expect(day2.divinePriceBrl).toBe("30");
  });
});
