import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateWeekSchema } from "@/lib/validations/simulation";
import {
  calculateWeek,
  type RawWeek,
  type RawDay,
  type CostConfigData,
  type CustomCostEntry,
} from "@/lib/simulation-calculator";

type Params = { params: Promise<{ id: string; weekNumber: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, weekNumber: weekNumberStr } = await params;
  const weekNumber = parseInt(weekNumberStr);

  if (isNaN(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Invalid week number" }, { status: 400 });
  }

  const week = await prisma.simulationWeek.findFirst({
    where: {
      simulationId: id,
      weekNumber,
    },
    include: {
      days: { orderBy: { dayNumber: "asc" } },
      simulation: {
        include: {
          costLinks: {
            include: { costConfig: true },
          },
        },
      },
    },
  });

  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  const linkedConfig = week.simulation.costLinks[0]?.costConfig ?? null;
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

  // Remove nested simulation from response
  const { simulation: _sim, ...weekData } = week;

  return NextResponse.json({
    ...weekData,
    calculated: {
      totalDivines: weekCalc.totalDivines,
      revenueUsd: weekCalc.revenueUsd,
      revenueBrl: weekCalc.revenueBrl,
      costUsd: weekCalc.costUsd,
      profitUsd: weekCalc.profitUsd,
      maxActiveBots: weekCalc.maxActiveBots,
    },
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, weekNumber: weekNumberStr } = await params;
  const weekNumber = parseInt(weekNumberStr);

  if (isNaN(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Invalid week number" }, { status: 400 });
  }

  const week = await prisma.simulationWeek.findFirst({
    where: { simulationId: id, weekNumber },
  });

  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateWeekSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.label !== undefined) updateData.label = data.label;
  if (data.defaultActiveBots !== undefined) updateData.defaultActiveBots = data.defaultActiveBots;
  if (data.defaultDivinePerHour !== undefined) updateData.defaultDivinePerHour = data.defaultDivinePerHour;
  if (data.defaultHoursPerDay !== undefined) updateData.defaultHoursPerDay = data.defaultHoursPerDay;
  if (data.defaultDivinePriceUsd !== undefined) updateData.defaultDivinePriceUsd = data.defaultDivinePriceUsd ?? null;
  if (data.defaultDivinePriceBrl !== undefined) updateData.defaultDivinePriceBrl = data.defaultDivinePriceBrl ?? null;

  const updated = await prisma.simulationWeek.update({
    where: { id: week.id },
    data: updateData,
    include: {
      days: { orderBy: { dayNumber: "asc" } },
    },
  });

  return NextResponse.json(updated);
}
