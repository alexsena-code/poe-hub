import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const original = await prisma.simulation.findUnique({
    where: { id },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: { orderBy: { dayNumber: "asc" } },
        },
      },
      costLinks: true,
    },
  });

  if (!original) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
  }

  const duplicate = await prisma.simulation.create({
    data: {
      name: `${original.name} (cópia)`,
      league: original.league,
      status: "draft",
      durationWeeks: original.durationWeeks,
      startDayOffset: original.startDayOffset,
      notes: original.notes,
      costConfigName: original.costConfigName,
      proxyCostPerBotMonthly: original.proxyCostPerBotMonthly,
      levelingCostPerBot: original.levelingCostPerBot,
      stashPackCostPerBot: original.stashPackCostPerBot,
      expluginsKeyCostDaily: original.expluginsKeyCostDaily,
      dpbKeyCostDaily: original.dpbKeyCostDaily,
      costLinks: original.costLinks.length > 0
        ? {
            create: original.costLinks.map((link) => ({
              costConfigId: link.costConfigId,
            })),
          }
        : undefined,
      weeks: {
        create: original.weeks.map((week) => ({
          weekNumber: week.weekNumber,
          label: week.label,
          defaultActiveBots: week.defaultActiveBots,
          defaultDivinePerHour: week.defaultDivinePerHour,
          defaultHoursPerDay: week.defaultHoursPerDay,
          defaultDivinePriceUsd: week.defaultDivinePriceUsd,
          defaultDivinePriceBrl: week.defaultDivinePriceBrl,
          days: {
            create: week.days.map((day) => ({
              dayNumber: day.dayNumber,
              date: day.date,
              activeBots: day.activeBots,
              divinePerHour: day.divinePerHour,
              hoursPerDay: day.hoursPerDay,
              divinePriceUsd: day.divinePriceUsd,
              divinePriceBrl: day.divinePriceBrl,
              overrideNotes: day.overrideNotes,
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
        include: { costConfig: true },
      },
    },
  });

  return NextResponse.json(duplicate, { status: 201 });
}
