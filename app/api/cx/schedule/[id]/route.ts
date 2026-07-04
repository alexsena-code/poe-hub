import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateScheduleSchema } from "@/lib/validations/cx";

type RouteContext = { params: Promise<{ id: string }> };

/** Atualiza parcialmente um agendamento (cx_schedule). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;

  const body = await request.json();
  const parsed = updateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const data: Prisma.CxScheduleUpdateInput = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.cron !== undefined) data.cron = d.cron;
  if (d.jobType !== undefined) data.jobType = d.jobType;
  if (d.payload !== undefined) data.payload = d.payload as Prisma.InputJsonValue;
  if (d.executorId !== undefined) data.executorId = d.executorId;
  if (d.enabled !== undefined) data.enabled = d.enabled;

  try {
    const schedule = await prisma.cxSchedule.update({ where: { id }, data });
    return NextResponse.json(schedule);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}

/** Remove um agendamento. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;

  try {
    await prisma.cxSchedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
