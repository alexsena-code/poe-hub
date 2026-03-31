import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get current leagues
  const currentLeagues = await prisma.league.findMany({
    where: { isCurrent: true },
    select: { name: true },
  });
  const currentLeagueNames = currentLeagues.map((l) => l.name);

  const [
    activeBots,
    totalBots,
    sales30d,
    openTasks,
    tasksByStatus,
    recentSales,
    latestDivinePrice,
    divinePrice7dAgo,
    priceHistory30d,
  ] = await Promise.all([
    // Active bots count
    prisma.bot.count({ where: { status: "active" } }),

    // Total bots count
    prisma.bot.count(),

    // Sales aggregation for last 30 days
    prisma.sale.aggregate({
      where: { date: { gte: thirtyDaysAgo } },
      _count: true,
      _sum: { totalUsd: true, totalBrl: true },
    }),

    // Open tasks (not done)
    prisma.task.count({ where: { status: { not: "done" } } }),

    // Tasks grouped by status
    prisma.task.groupBy({
      by: ["status"],
      _count: true,
    }),

    // Recent 5 sales
    prisma.sale.findMany({
      take: 5,
      orderBy: { date: "desc" },
      include: {
        buyer: { select: { name: true } },
      },
    }),

    // Latest divine price for current leagues
    prisma.dailyPrice.findFirst({
      where: {
        item: "divine",
        ...(currentLeagueNames.length > 0
          ? { league: { in: currentLeagueNames } }
          : {}),
      },
      orderBy: { date: "desc" },
    }),

    // Divine price ~7 days ago
    prisma.dailyPrice.findFirst({
      where: {
        item: "divine",
        date: { lte: sevenDaysAgo },
        ...(currentLeagueNames.length > 0
          ? { league: { in: currentLeagueNames } }
          : {}),
      },
      orderBy: { date: "desc" },
    }),

    // Price history last 30 days for divine
    prisma.dailyPrice.findMany({
      where: {
        item: "divine",
        date: { gte: thirtyDaysAgo },
        ...(currentLeagueNames.length > 0
          ? { league: { in: currentLeagueNames } }
          : {}),
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        median: true,
        cnlPrice: true,
        league: true,
      },
    }),
  ]);

  // Calculate 7d change percentage
  let divineChange7d: number | null = null;
  if (latestDivinePrice && divinePrice7dAgo) {
    const current = Number(latestDivinePrice.median);
    const previous = Number(divinePrice7dAgo.median);
    if (previous > 0) {
      divineChange7d = ((current - previous) / previous) * 100;
    }
  }

  // Format task counts by status
  const taskCounts: Record<string, number> = {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    done: 0,
  };
  for (const group of tasksByStatus) {
    taskCounts[group.status] = group._count;
  }

  return NextResponse.json({
    activeBots,
    totalBots,
    sales30d: {
      count: sales30d._count,
      totalUsd: sales30d._sum.totalUsd ? Number(sales30d._sum.totalUsd) : 0,
      totalBrl: sales30d._sum.totalBrl ? Number(sales30d._sum.totalBrl) : 0,
    },
    openTasks,
    taskCounts,
    currentDivinePrice: latestDivinePrice
      ? {
          median: Number(latestDivinePrice.median),
          cnlPrice: latestDivinePrice.cnlPrice
            ? Number(latestDivinePrice.cnlPrice)
            : null,
          date: latestDivinePrice.date,
          league: latestDivinePrice.league,
        }
      : null,
    divineChange7d,
    recentSales: recentSales.map((s) => ({
      id: s.id,
      date: s.date,
      buyerName: s.buyer.name,
      quantity: Number(s.quantity),
      unit: s.unit,
      totalBrl: s.totalBrl ? Number(s.totalBrl) : null,
      totalUsd: s.totalUsd ? Number(s.totalUsd) : null,
    })),
    priceHistory30d: priceHistory30d.map((p) => ({
      date: p.date,
      median: Number(p.median),
      cnlPrice: p.cnlPrice ? Number(p.cnlPrice) : null,
      league: p.league,
    })),
  });
}
