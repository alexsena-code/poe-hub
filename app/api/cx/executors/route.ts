import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lista executores (cx_executor) com a contagem de jobs pendentes de cada um. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [executors, pendingCounts] = await Promise.all([
    prisma.cxExecutor.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.cxJob.groupBy({
      by: ["executorId"],
      where: { status: "pending" },
      _count: { _all: true },
    }),
  ]);

  const pendingByExecutor = new Map(
    pendingCounts.map((c) => [c.executorId, c._count._all])
  );

  return NextResponse.json({
    data: executors.map((e) => ({
      ...e,
      pendingJobs: pendingByExecutor.get(e.executorId) ?? 0,
    })),
  });
}
