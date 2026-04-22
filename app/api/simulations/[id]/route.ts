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
  type CustomCostEntry,
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
  const linkedConfig = simulation.costLinks[0]?.costConfig ?? null;
  const costConfig: CostConfigData | null = linkedConfig
    ? {
        proxyCostPerBotMonthly: linkedConfig.proxyCostPerBotMonthly,
        levelingCostPerBot: linkedConfig.levelingCostPerBot,
        stashPackCostPerBot: linkedConfig.stashPackCostPerBot,
        expluginsKeyCostDaily: linkedConfig.expluginsKeyCostDaily,
        dpbKeyCostDaily: linkedConfig.dpbKeyCostDaily,
        customCosts: (linkedConfig.customCosts as CustomCostEntry[] | null) ?? null,
      }
    : null;

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

  // Direct cost overrides (editable from comparison UI without re-linking a config)
  if (data.proxyCostPerBotMonthly !== undefined) updateData.proxyCostPerBotMonthly = data.proxyCostPerBotMonthly;
  if (data.levelingCostPerBot !== undefined) updateData.levelingCostPerBot = data.levelingCostPerBot;
  if (data.stashPackCostPerBot !== undefined) updateData.stashPackCostPerBot = data.stashPackCostPerBot;
  if (data.expluginsKeyCostDaily !== undefined) updateData.expluginsKeyCostDaily = data.expluginsKeyCostDaily;
  if (data.dpbKeyCostDaily !== undefined) updateData.dpbKeyCostDaily = data.dpbKeyCostDaily;
  if (data.customCosts !== undefined) updateData.customCosts = data.customCosts;

  // Handle cost config: support both costConfigId (singular) and costConfigIds (array)
  const configId = (body as Record<string, unknown>).costConfigId as string | undefined;
  const costConfigIds = data.costConfigIds ?? (configId ? [configId] : undefined);

  if (costConfigIds !== undefined) {
    // Delete existing links and create new ones
    await prisma.simulationCostLink.deleteMany({
      where: { simulationId: id },
    });

    if (costConfigIds.length > 0) {
      const configs = await prisma.globalCostConfig.findMany({
        where: { id: { in: costConfigIds } },
      });
      if (configs.length !== costConfigIds.length) {
        return NextResponse.json(
          { error: "One or more cost config IDs not found" },
          { status: 404 }
        );
      }

      await prisma.simulationCostLink.createMany({
        data: costConfigIds.map((cid) => ({
          simulationId: id,
          costConfigId: cid,
        })),
      });

      // Snapshot cost config values into simulation
      const primaryConfig = configs[0];
      updateData.costConfigName = primaryConfig.name;
      updateData.proxyCostPerBotMonthly = Number(primaryConfig.proxyCostPerBotMonthly);
      updateData.levelingCostPerBot = Number(primaryConfig.levelingCostPerBot);
      updateData.stashPackCostPerBot = Number(primaryConfig.stashPackCostPerBot);
      updateData.expluginsKeyCostDaily = Number(primaryConfig.expluginsKeyCostDaily);
      updateData.dpbKeyCostDaily = Number(primaryConfig.dpbKeyCostDaily);
      updateData.customCosts = primaryConfig.customCosts ?? [];
    }
  }

  try {
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
  } catch (err) {
    console.error("Simulation PUT error:", err);
    return NextResponse.json(
      { error: "Failed to update simulation" },
      { status: 500 }
    );
  }
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
