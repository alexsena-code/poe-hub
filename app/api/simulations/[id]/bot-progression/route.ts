import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { botProgressionSchema } from "@/lib/validations/simulation";

type Params = { params: Promise<{ id: string }> };

/**
 * Fills `activeBots` overrides across every day of the simulation, ramping
 * from `startBots` up by `incrementPerDay` per day until `maxBots`, then
 * holding at `maxBots` for the remaining days. Days before `startDay` are
 * left untouched.
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
        orderBy: { weekNumber: "asc" },
        include: { days: { orderBy: { dayNumber: "asc" } } },
      },
    },
  });

  if (!simulation) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = botProgressionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { maxBots, incrementPerDay } = parsed.data;
  const startBots = parsed.data.startBots ?? 1;
  const startDay = parsed.data.startDay ?? simulation.startDayOffset + 1;

  if (startBots > maxBots) {
    return NextResponse.json(
      { error: `Bots iniciais (${startBots}) excedem o máximo (${maxBots})` },
      { status: 400 }
    );
  }

  const updates: Array<{ id: string; activeBots: number }> = [];

  for (const week of simulation.weeks) {
    for (const day of week.days) {
      const globalDay = (week.weekNumber - 1) * 7 + day.dayNumber; // 1-based
      if (globalDay < startDay) continue;

      const daysSinceStart = globalDay - startDay;
      const bots = Math.min(startBots + daysSinceStart * incrementPerDay, maxBots);
      updates.push({ id: day.id, activeBots: bots });
    }
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: `Dia inicial ${startDay} está além da simulação` },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.simulationDay.update({
        where: { id: u.id },
        data: { activeBots: u.activeBots },
      })
    )
  );

  return NextResponse.json({
    success: true,
    daysUpdated: updates.length,
    startDay,
    startBots,
    maxBots,
    incrementPerDay,
    daysToMax: Math.ceil(Math.max(0, maxBots - startBots) / incrementPerDay),
  });
}
