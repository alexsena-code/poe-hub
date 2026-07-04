import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logFiltersSchema } from "@/lib/validations/cx";

/** Lista logs dos executores (cx_log) — filtros executorId/level/since + paginação. */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = logFiltersSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { executorId, level, since, page, limit } = parsed.data;

  const where: Prisma.CxLogWhereInput = {};
  if (executorId) where.executorId = executorId;
  if (level) where.level = level;
  if (since) where.ts = { gte: new Date(since) };

  const [logs, total] = await Promise.all([
    prisma.cxLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { ts: "desc" },
    }),
    prisma.cxLog.count({ where }),
  ]);

  return NextResponse.json({
    data: logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
