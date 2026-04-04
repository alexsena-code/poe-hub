import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const schema = z.object({
  name: z.string().min(1),
  league: z.string().min(1),
  durationWeeks: z.number().int().min(1).max(52),
  startDayOffset: z.number().int().min(0).default(0),
  leagueSources: z.array(z.string()).min(1).max(5),
  priceSource: z.enum(["median", "cnl"]).default("median"),
  defaultActiveBots: z.number().int().min(0).default(1),
  defaultDivinePerHour: z.number().min(0).default(0.5),
  defaultHoursPerDay: z.number().min(0).default(24),
});

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, league, durationWeeks, startDayOffset, leagueSources, priceSource,
    defaultActiveBots, defaultDivinePerHour, defaultHoursPerDay } = parsed.data;

  // Fetch league start dates
  const leagues = await prisma.league.findMany({
    where: { name: { in: leagueSources } },
    select: { name: true, startDate: true },
  });

  const leagueMap = new Map(leagues.map((l) => [l.name, l.startDate]));
  const missing = leagueSources.filter((n) => !leagueMap.get(n));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Leagues not found or missing startDate: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Fetch all daily prices for source leagues
  const dailyPrices = await prisma.dailyPrice.findMany({
    where: { item: "divine", league: { in: leagueSources } },
    orderBy: { date: "asc" },
  });

  // Sort source leagues by startDate descending (most recent first) for weighting
  const sortedSources = [...leagueSources].sort((a, b) => {
    const da = leagueMap.get(a)?.getTime() ?? 0;
    const db = leagueMap.get(b)?.getTime() ?? 0;
    return db - da;
  });

  // Weights: most recent = 50%, second = 30%, third = 20% (normalized if fewer)
  const WEIGHT_TABLE = [0.5, 0.3, 0.2];
  const weights = new Map<string, number>();
  const totalWeight = WEIGHT_TABLE.slice(0, sortedSources.length).reduce((a, b) => a + b, 0);
  sortedSources.forEach((name, i) => {
    weights.set(name, (WEIGHT_TABLE[i] ?? WEIGHT_TABLE[WEIGHT_TABLE.length - 1]) / totalWeight);
  });

  // Build dayOfLeague → { league, price }[] map
  const totalDays = durationWeeks * 7;
  const dayPrices = new Map<number, { league: string; price: number }[]>();

  for (const dp of dailyPrices) {
    const leagueName = dp.league;
    const startDate = leagueMap.get(leagueName);
    if (!startDate) continue;

    const dayOfLeague = Math.floor((dp.date.getTime() - startDate.getTime()) / 86400000) + 1;
    if (dayOfLeague < 2 || dayOfLeague > totalDays) continue; // Skip day 1 (too volatile)

    const price = priceSource === "cnl" && dp.cnlPrice
      ? Number(dp.cnlPrice)
      : Number(dp.median);
    if (isNaN(price) || price <= 0) continue;

    if (!dayPrices.has(dayOfLeague)) dayPrices.set(dayOfLeague, []);
    dayPrices.get(dayOfLeague)!.push({ league: leagueName, price });
  }

  // Compute 3 scenarios per day
  const scenarios: Record<string, Map<number, number>> = {
    optimistic: new Map(),
    expected: new Map(),
    pessimistic: new Map(),
  };

  for (const [day, entries] of dayPrices) {
    const prices = entries.map((e) => e.price);
    scenarios.optimistic.set(day, Math.max(...prices));
    scenarios.pessimistic.set(day, Math.min(...prices));

    // Weighted average for expected (recent leagues weigh more)
    let weightedSum = 0;
    let weightSum = 0;
    for (const e of entries) {
      const w = weights.get(e.league) ?? 0;
      weightedSum += e.price * w;
      weightSum += w;
    }
    scenarios.expected.set(day, weightSum > 0 ? weightedSum / weightSum : median(prices));
  }

  // Create 3 simulations
  const scenarioLabels = [
    { key: "optimistic", suffix: "Otimista" },
    { key: "expected", suffix: "Esperado" },
    { key: "pessimistic", suffix: "Pessimista" },
  ];

  // Fetch default cost config
  const defaultCostConfig = await prisma.globalCostConfig.findFirst({
    where: { isDefault: true },
  });

  const createdIds: string[] = [];

  for (const { key, suffix } of scenarioLabels) {
    const priceMap = scenarios[key];

    const sim = await prisma.simulation.create({
      data: {
        name: `${name} - ${suffix}`,
        league,
        status: "draft",
        durationWeeks,
        startDayOffset,
        // Snapshot default cost config
        ...(defaultCostConfig ? {
          costConfigName: defaultCostConfig.name,
          proxyCostPerBotMonthly: defaultCostConfig.proxyCostPerBotMonthly,
          levelingCostPerBot: defaultCostConfig.levelingCostPerBot,
          stashPackCostPerBot: defaultCostConfig.stashPackCostPerBot,
          expluginsKeyCostDaily: defaultCostConfig.expluginsKeyCostDaily,
          dpbKeyCostDaily: defaultCostConfig.dpbKeyCostDaily,
          costLinks: { create: { costConfigId: defaultCostConfig.id } },
        } : {}),
        weeks: {
          create: Array.from({ length: durationWeeks }, (_, wi) => {
            // Compute week average price for defaults
            const weekPrices: number[] = [];
            for (let d = 0; d < 7; d++) {
              const dayOfLeague = wi * 7 + d + 1;
              const p = priceMap.get(dayOfLeague);
              if (p) weekPrices.push(p);
            }
            const weekAvgPrice = weekPrices.length > 0
              ? weekPrices.reduce((a, b) => a + b, 0) / weekPrices.length
              : null;

            return {
              weekNumber: wi + 1,
              label: `Semana ${wi + 1}`,
              defaultActiveBots: wi === 0 ? 0 : defaultActiveBots,
              defaultDivinePerHour,
              defaultHoursPerDay,
              defaultDivinePriceBrl: weekAvgPrice?.toString() ?? null,
              days: {
                create: Array.from({ length: 7 }, (_, di) => {
                  const dayOfLeague = wi * 7 + di + 1;
                  const globalDayIndex = wi * 7 + di;
                  const price = priceMap.get(dayOfLeague);
                  const isBeforeStart = globalDayIndex < startDayOffset;

                  return {
                    dayNumber: di + 1,
                    divinePriceBrl: price?.toString() ?? null,
                    ...(isBeforeStart ? { activeBots: 0 } : {}),
                  };
                }),
              },
            };
          }),
        },
      },
    });

    createdIds.push(sim.id);
  }

  return NextResponse.json({
    success: true,
    ids: createdIds,
    scenarios: scenarioLabels.map((s, i) => ({ label: s.suffix, id: createdIds[i] })),
  }, { status: 201 });
}
