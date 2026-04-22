import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSimulationSchema } from "@/lib/validations/simulation";
import {
  calculateSimulation,
  type RawWeek,
  type RawDay,
  type CostConfigData,
} from "@/lib/simulation-calculator";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const status = searchParams.get("status");
  const league = searchParams.get("league");
  const search = searchParams.get("search");
  const kind = searchParams.get("kind");

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }
  if (league) {
    where.league = league;
  }
  if (kind === "operational" || kind === "forecast") {
    where.kind = kind;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }

  const [simulations, total] = await Promise.all([
    prisma.simulation.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { weeks: true } },
        weeks: {
          orderBy: { weekNumber: "asc" },
          include: { days: { orderBy: { dayNumber: "asc" } } },
        },
        costLinks: {
          include: {
            costConfig: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.simulation.count({ where }),
  ]);

  // Calculate totals for each simulation
  const data = simulations.map((sim) => {
    const costConfig: CostConfigData | null =
      sim.proxyCostPerBotMonthly != null
        ? {
            proxyCostPerBotMonthly: Number(sim.proxyCostPerBotMonthly),
            levelingCostPerBot: Number(sim.levelingCostPerBot),
            expluginsKeyCostDaily: Number(sim.expluginsKeyCostDaily),
            dpbKeyCostDaily: Number(sim.dpbKeyCostDaily),
          }
        : null;

    const weeksForCalc = sim.weeks.map((week) => ({
      week: {
        weekNumber: week.weekNumber,
        label: week.label,
        defaultActiveBots: week.defaultActiveBots,
        defaultDivinePerHour: week.defaultDivinePerHour,
        defaultHoursPerDay: week.defaultHoursPerDay,
        defaultDivinePriceUsd: week.defaultDivinePriceUsd,
        defaultDivinePriceBrl: week.defaultDivinePriceBrl,
      } as RawWeek,
      days: week.days.map((d) => ({
        dayNumber: d.dayNumber,
        date: d.date,
        activeBots: d.activeBots,
        divinePerHour: d.divinePerHour,
        hoursPerDay: d.hoursPerDay,
        divinePriceUsd: d.divinePriceUsd,
        divinePriceBrl: d.divinePriceBrl,
      })) as RawDay[],
    }));

    const calc = calculateSimulation(weeksForCalc, costConfig);

    // Don't include weeks in list response (too heavy)
    const { weeks: _, ...simWithoutWeeks } = sim;

    // Return raw values — let the client handle conversion
    return {
      ...simWithoutWeeks,
      totals: {
        revenueUsd: calc.totalRevenueUsd ?? 0,
        revenueBrl: calc.totalRevenueBrl ?? 0,
        cost: calc.totalCostUsd,
        profit: calc.totalProfitUsd,
        roi: calc.roi,
      },
    };
  });

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSimulationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Validate cost config IDs if provided
  if (data.costConfigIds && data.costConfigIds.length > 0) {
    const configs = await prisma.globalCostConfig.findMany({
      where: { id: { in: data.costConfigIds } },
      select: { id: true },
    });
    if (configs.length !== data.costConfigIds.length) {
      return NextResponse.json(
        { error: "One or more cost config IDs not found" },
        { status: 404 }
      );
    }
  }

  const simulation = await prisma.simulation.create({
    data: {
      name: data.name,
      league: data.league,
      status: data.status,
      kind: data.kind,
      durationWeeks: data.durationWeeks,
      notes: data.notes ?? null,
      costLinks: data.costConfigIds?.length
        ? {
            create: data.costConfigIds.map((configId) => ({
              costConfigId: configId,
            })),
          }
        : undefined,
      weeks: {
        create: Array.from({ length: data.durationWeeks }, (_, i) => ({
          weekNumber: i + 1,
          label: `Semana ${i + 1}`,
          defaultActiveBots: 1,
          defaultDivinePerHour: 0.5,
          defaultHoursPerDay: 24,
          days: {
            create: Array.from({ length: 7 }, (_, d) => ({
              dayNumber: d + 1,
            })),
          },
        })),
      },
    },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: { orderBy: { dayNumber: "asc" } },
        },
      },
      costLinks: {
        include: {
          costConfig: true,
        },
      },
    },
  });

  return NextResponse.json(simulation, { status: 201 });
}
