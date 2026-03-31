import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

type Params = { params: Promise<{ id: string }> };

const importPricesSchema = z.object({
  league: z.string().min(1),
  priceSource: z.enum(["median", "cnl"]).default("median"),
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

  const { league, priceSource } = parsed.data;

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

  // Build a date→price map
  const priceMap = new Map<string, number>();
  for (const dp of dailyPrices) {
    const dateKey = dp.date.toISOString().split("T")[0];
    const price = priceSource === "cnl" && dp.cnlPrice
      ? Number(dp.cnlPrice)
      : Number(dp.median);
    priceMap.set(dateKey, price);
  }

  // Map simulation days to real dates starting from league start
  const leagueStart = new Date(leagueData.startDate);
  let updatedDays = 0;

  for (const week of simulation.weeks) {
    for (const day of week.days) {
      // Calculate the real date for this simulation day
      const dayOffset = (week.weekNumber - 1) * 7 + (day.dayNumber - 1);
      const realDate = new Date(leagueStart);
      realDate.setDate(realDate.getDate() + dayOffset);
      const dateKey = realDate.toISOString().split("T")[0];

      const price = priceMap.get(dateKey);
      if (price !== undefined) {
        await prisma.simulationDay.update({
          where: { id: day.id },
          data: {
            divinePriceBrl: price.toString(),
            date: realDate,
          },
        });
        updatedDays++;
      }
    }

    // Also update week default with the average price for that week
    const weekStart = (week.weekNumber - 1) * 7;
    const weekPrices: number[] = [];
    for (let d = 0; d < 7; d++) {
      const realDate = new Date(leagueStart);
      realDate.setDate(realDate.getDate() + weekStart + d);
      const dateKey = realDate.toISOString().split("T")[0];
      const price = priceMap.get(dateKey);
      if (price !== undefined) weekPrices.push(price);
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

  return NextResponse.json({
    success: true,
    updatedDays,
    totalDaysInSimulation: simulation.weeks.reduce((acc, w) => acc + w.days.length, 0),
    priceDataDays: dailyPrices.length,
    league,
    priceSource,
  });
}
