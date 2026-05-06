import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extrapolatePrice, type PriceRow } from "@/lib/price-extrapolation";
import { z } from "zod/v4";

type Params = { params: Promise<{ id: string }> };

const importPricesSchema = z.object({
  league: z.string().min(1),
  priceSource: z.enum(["median", "cnl"]).default("median"),
  startDayOffset: z.number().int().min(0).default(0),
});

/**
 * POST /api/simulations/[id]/import-prices
 *
 * Imports historical daily prices into the simulation's weeks/days.
 * Maps each simulation day to a real date based on the league start date,
 * then fills divinePriceBrl from DailyPrice data.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const simulation = await prisma.simulation.findUnique({
    where: { id },
    include: {
      weeks: {
        include: { days: true },
        orderBy: { weekNumber: "asc" },
      },
    },
  });

  if (!simulation) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = importPricesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { league, priceSource, startDayOffset } = parsed.data;

  // Fetch league dates
  const leagueData = await prisma.league.findUnique({ where: { name: league } });
  if (!leagueData || !leagueData.startDate) {
    return NextResponse.json({ error: "League not found or has no start date" }, { status: 404 });
  }

  // Fetch daily prices for this league
  const dailyPrices = await prisma.dailyPrice.findMany({
    where: { item: "divine", league },
    orderBy: { date: "asc" },
  });

  if (dailyPrices.length === 0) {
    return NextResponse.json({ error: "No price data for this league" }, { status: 404 });
  }

  // Sorted historical rows. Sim days past the last entry get extrapolated via
  // 10%/day compounded decay (see lib/price-extrapolation.ts) — keeps
  // long-horizon sims from collapsing to R$ 0 just because the league is still
  // running and we don't have data yet for the target date.
  const sortedRows: PriceRow[] = dailyPrices
    .map((dp) => ({
      date: dp.date.toISOString().split("T")[0],
      price:
        priceSource === "cnl" && dp.cnlPrice
          ? Number(dp.cnlPrice)
          : Number(dp.median),
    }))
    .filter((r) => r.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Reset all day overrides before reimporting so stale data is cleared
  const allDayIds = simulation.weeks.flatMap((w) => w.days.map((d) => d.id));
  await prisma.simulationDay.updateMany({
    where: { id: { in: allDayIds } },
    data: {
      divinePriceBrl: null,
      divinePriceUsd: null,
      date: null,
      activeBots: null,
    },
  });

  // Also reset week default prices
  const allWeekIds = simulation.weeks.map((w) => w.id);
  await prisma.simulationWeek.updateMany({
    where: { id: { in: allWeekIds } },
    data: {
      defaultDivinePriceBrl: null,
      defaultDivinePriceUsd: null,
    },
  });

  // Map simulation days to real dates starting from league day 1.
  // Days before startDayOffset get activeBots=0 (no production, prices for reference).
  const leagueStart = new Date(leagueData.startDate);
  let updatedDays = 0;
  let extrapolatedDays = 0;

  for (const week of simulation.weeks) {
    for (const day of week.days) {
      // Global day index (0-based) across the entire simulation
      const globalDayIndex = (week.weekNumber - 1) * 7 + (day.dayNumber - 1);
      const realDate = new Date(leagueStart);
      realDate.setDate(realDate.getDate() + globalDayIndex);
      const dateKey = realDate.toISOString().split("T")[0];

      const extrapolated = extrapolatePrice(sortedRows, dateKey);
      const isBeforeStart = globalDayIndex < startDayOffset;

      await prisma.simulationDay.update({
        where: { id: day.id },
        data: {
          date: realDate,
          ...(extrapolated && extrapolated.price > 0
            ? { divinePriceBrl: extrapolated.price.toString() }
            : {}),
          // Zero out bots for days before the chosen start day
          ...(isBeforeStart ? { activeBots: 0 } : {}),
        },
      });
      if (extrapolated && extrapolated.price > 0) {
        updatedDays++;
        if (!extrapolated.fromHistorical) extrapolatedDays++;
      }
    }

    // Update week default with the average price for that week
    const weekStartIndex = (week.weekNumber - 1) * 7;
    const weekPrices: number[] = [];
    for (let d = 0; d < 7; d++) {
      const realDate = new Date(leagueStart);
      realDate.setDate(realDate.getDate() + weekStartIndex + d);
      const dateKey = realDate.toISOString().split("T")[0];
      const extrapolated = extrapolatePrice(sortedRows, dateKey);
      if (extrapolated && extrapolated.price > 0) {
        weekPrices.push(extrapolated.price);
      }
    }

    if (weekPrices.length > 0) {
      const weekAvg = weekPrices.reduce((a, b) => a + b, 0) / weekPrices.length;
      await prisma.simulationWeek.update({
        where: { id: week.id },
        data: {
          defaultDivinePriceBrl: weekAvg.toString(),
        },
      });
    }
  }

  await prisma.simulation.update({ where: { id }, data: { startDayOffset } });

  return NextResponse.json({
    success: true,
    updatedDays,
    extrapolatedDays,
    totalDaysInSimulation: simulation.weeks.reduce((acc, w) => acc + w.days.length, 0),
    priceDataDays: dailyPrices.length,
    league,
    priceSource,
  });
}
