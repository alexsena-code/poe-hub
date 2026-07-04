import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commandFiltersSchema, createCommandSchema } from "@/lib/validations/cx";

/** Lista jobs da fila cx_job com filtros (executorId, status) e paginação. */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = commandFiltersSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { executorId, status, page, limit } = parsed.data;

  const where: Prisma.CxJobWhereInput = {};
  if (executorId) where.executorId = executorId;
  if (status) where.status = status;

  const [jobs, total] = await Promise.all([
    prisma.cxJob.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.cxJob.count({ where }),
  ]);

  return NextResponse.json({
    data: jobs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** Cria um cx_job (comando pro executor). O drain do ws-server envia quando online. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const job = await prisma.cxJob.create({
    data: {
      executorId: d.executorId,
      type: d.type,
      payload: d.payload as Prisma.InputJsonValue,
      priority: d.priority ?? 0,
      requestedBy: session.user?.id ?? null,
    },
  });

  return NextResponse.json(job, { status: 201 });
}
