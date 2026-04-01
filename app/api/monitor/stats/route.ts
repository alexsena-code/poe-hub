import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Start of today in UTC
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    instances,
    totalAlertsToday,
    errorCountToday,
  ] = await Promise.all([
    prisma.botInstance.findMany({
      select: {
        id: true,
        pcName: true,
        configName: true,
        isOnline: true,
        errorCount: true,
      },
      orderBy: [{ pcName: "asc" }, { configName: "asc" }],
    }),
    prisma.botAlert.count({
      where: {
        acknowledged: false,
        createdAt: { gte: todayStart },
      },
    }),
    prisma.botAlert.count({
      where: {
        type: "error",
        createdAt: { gte: todayStart },
      },
    }),
  ]);

  const totalInstances = instances.length;
  const onlineCount = instances.filter((i) => i.isOnline).length;
  const offlineCount = totalInstances - onlineCount;

  // Group by pcName with per-PC bot counts
  const pcMap: Record<
    string,
    { pcName: string; total: number; online: number; offline: number }
  > = {};

  for (const inst of instances) {
    if (!pcMap[inst.pcName]) {
      pcMap[inst.pcName] = {
        pcName: inst.pcName,
        total: 0,
        online: 0,
        offline: 0,
      };
    }
    pcMap[inst.pcName].total += 1;
    if (inst.isOnline) {
      pcMap[inst.pcName].online += 1;
    } else {
      pcMap[inst.pcName].offline += 1;
    }
  }

  return NextResponse.json({
    totalInstances,
    onlineCount,
    offlineCount,
    totalAlertsToday,
    errorCountToday,
    pcs: Object.values(pcMap),
  });
}
