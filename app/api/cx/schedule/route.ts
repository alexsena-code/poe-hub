import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createScheduleSchema } from "@/lib/validations/cx";

/** Lista agendamentos (cx_schedule). A EXECUÇÃO fica pra próxima fase — só CRUD. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedules = await prisma.cxSchedule.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ data: schedules });
}

/** Cria um agendamento. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const schedule = await prisma.cxSchedule.create({
    data: {
      name: d.name,
      cron: d.cron,
      jobType: d.jobType,
      payload: d.payload as Prisma.InputJsonValue,
      executorId: d.executorId ?? null,
      enabled: d.enabled,
    },
  });

  return NextResponse.json(schedule, { status: 201 });
}
