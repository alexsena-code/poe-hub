import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSimulationSchema } from "@/lib/validations/simulation";
import {
  calculateWeek,
  calculateSimulation,
  type RawWeek,
  type RawDay,
  type CostConfigData,
} from "@/lib/simulation-calculator";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const simulation = await prisma.simulation.findUnique({
    where: { id },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: { orderBy: { dayNumber: "asc" } },
        },
      },
      costLinks: {
        include: { costConfig: true },
      },
    },
  });

  if (!simulation) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
  }

  // Get cost config for calculations (use first linked config)
  const costConfig: CostConfigData | null =
    simulation.costLinks.length > 0 ? simulation.costLinks[0].costConfig : null;

  // Calculate per-week results
  const weeksWithCalc = simulation.weeks.map((week) => {
    const rawWeek: RawWeek = {
      weekNumber: week.weekNumber,
      label: week.label,
      defaultActiveBots: week.defaultActiveBots,
      defaultDivinePerHour: week.defaultDivinePerHour,
      defaultHoursPerDay: week.defaultHoursPerDay,
      defaultDivinePriceUsd: week.defaultDivinePriceUsd,
      defaultDivinePriceBrl: week.defaultDivinePriceBrl,
    };
    const rawDays: RawDay[] = week.days.map((d) => ({
      dayNumber: d.dayNumber,
      date: d.date,
      activeBots: d.activeBots,
      divinePerHour: d.divinePerHour,
      hoursPerDay: d.hoursPerDay,
      divinePriceUsd: d.divinePriceUsd,
      divinePriceBrl: d.divinePriceBrl,
      overrideNotes: d.overrideNotes,
    }));

    const weekCalc = calculateWeek(rawWeek, rawDays, costConfig);

    return {
      ...week,
      calculated: {
        totalDivines: weekCalc.totalDivines,
        revenueUsd: weekCalc.revenueUsd,
        revenueBrl: weekCalc.revenueBrl,
        costUsd: weekCalc.costUsd,
        profitUsd: weekCalc.profitUsd,
        maxActiveBots: weekCalc.maxActiveBots,
      },
    };
  });

  // Calculate simulation totals
  const weeksForCalc = simulation.weeks.map((week) => ({
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
      overrideNotes: d.overrideNotes,
    })) as RawDay[],
  }));

  const simCalc = calculateSimulation(weeksForCalc, costConfig);

  return NextResponse.json({
    ...simulation,
    weeks: weeksWithCalc,
    calculated: {
      totalDivines: simCalc.totalDivines,
      totalRevenueUsd: simCalc.totalRevenueUsd,
      totalRevenueBrl: simCalc.totalRevenueBrl,
      totalCostUsd: simCalc.totalCostUsd,
      totalProfitUsd: simCalc.totalProfitUsd,
      roi: simCalc.roi,
      breakEvenWeek: simCalc.breakEvenWeek,
    },
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.simulation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSimulationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.league !== undefined) updateData.league = data.league;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;

  // Handle cost config links update
  if (data.costConfigIds !== undefined) {
    // Validate config IDs
    if (data.costConfigIds.length > 0) {
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

    // Delete existing links and create new ones
    await prisma.simulationCostLink.deleteMany({
      where: { simulationId: id },
    });

    if (data.costConfigIds.length > 0) {
      await prisma.simulationCostLink.createMany({
        data: data.costConfigIds.map((configId) => ({
          simulationId: id,
          costConfigId: configId,
        })),
      });
    }
  }

  const simulation = await prisma.simulation.update({
    where: { id },
    data: updateData,
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: { orderBy: { dayNumber: "asc" } },
        },
      },
      costLinks: {
        include: { costConfig: true },
      },
    },
  });

  return NextResponse.json(simulation);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.simulation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
  }

  await prisma.simulation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
