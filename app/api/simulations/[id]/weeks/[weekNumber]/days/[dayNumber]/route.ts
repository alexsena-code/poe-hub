import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDaySchema } from "@/lib/validations/simulation";

type Params = {
  params: Promise<{ id: string; weekNumber: string; dayNumber: string }>;
};

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, weekNumber: weekNumberStr, dayNumber: dayNumberStr } = await params;
  const weekNumber = parseInt(weekNumberStr);
  const dayNumber = parseInt(dayNumberStr);

  if (isNaN(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Invalid week number" }, { status: 400 });
  }
  if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 7) {
    return NextResponse.json({ error: "Invalid day number" }, { status: 400 });
  }

  const week = await prisma.simulationWeek.findFirst({
    where: { simulationId: id, weekNumber },
  });

  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  const day = await prisma.simulationDay.findFirst({
    where: { simulationWeekId: week.id, dayNumber },
  });

  if (!day) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateDaySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.date !== undefined) updateData.date = data.date ? new Date(data.date) : null;
  if (data.activeBots !== undefined) updateData.activeBots = data.activeBots;
  if (data.divinePerHour !== undefined) updateData.divinePerHour = data.divinePerHour;
  if (data.hoursPerDay !== undefined) updateData.hoursPerDay = data.hoursPerDay;
  if (data.divinePriceUsd !== undefined) updateData.divinePriceUsd = data.divinePriceUsd;
  if (data.divinePriceBrl !== undefined) updateData.divinePriceBrl = data.divinePriceBrl;
  if (data.overrideNotes !== undefined) updateData.overrideNotes = data.overrideNotes;

  const updated = await prisma.simulationDay.update({
    where: { id: day.id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

/**
 * DELETE resets a day to week defaults by setting all override fields to null.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, weekNumber: weekNumberStr, dayNumber: dayNumberStr } = await params;
  const weekNumber = parseInt(weekNumberStr);
  const dayNumber = parseInt(dayNumberStr);

  if (isNaN(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Invalid week number" }, { status: 400 });
  }
  if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 7) {
    return NextResponse.json({ error: "Invalid day number" }, { status: 400 });
  }

  const week = await prisma.simulationWeek.findFirst({
    where: { simulationId: id, weekNumber },
  });

  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  const day = await prisma.simulationDay.findFirst({
    where: { simulationWeekId: week.id, dayNumber },
  });

  if (!day) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }

  const updated = await prisma.simulationDay.update({
    where: { id: day.id },
    data: {
      activeBots: null,
      divinePerHour: null,
      hoursPerDay: null,
      divinePriceUsd: null,
      divinePriceBrl: null,
      overrideNotes: null,
      date: null,
    },
  });

  return NextResponse.json(updated);
}
