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
    select: { name: true, poeVersion: true },
  });
  const currentLeagueNames = currentLeagues.map((l) => l.name);

  const [
    activeBots,
    totalBots,
    sales30d,
    openTasks,
    tasksByStatus,
    recentSales,
    latestG2gPrice,
    g2gPrice7dAgo,
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

    // Preço mais recente do Divine na concorrência (G2G), nas ligas correntes
    prisma.g2gPriceSnapshot.findFirst({
      where: {
        item: "Divine Orb",
        ...(currentLeagueNames.length > 0
          ? { league: { in: currentLeagueNames } }
          : {}),
      },
      orderBy: { collectedAt: "desc" },
    }),

    // Última coleta anterior à janela de 7 dias, para a variação
    prisma.g2gPriceSnapshot.findFirst({
      where: {
        item: "Divine Orb",
        collectedAt: { lte: sevenDaysAgo },
        ...(currentLeagueNames.length > 0
          ? { league: { in: currentLeagueNames } }
          : {}),
      },
      orderBy: { collectedAt: "desc" },
    }),
  ]);

  // Fica null nas primeiras semanas: a G2G não expõe histórico, então a série
  // só existe a partir da primeira coleta nossa.
  let g2gChange7d: number | null = null;
  if (latestG2gPrice && g2gPrice7dAgo) {
    const current = Number(latestG2gPrice.median);
    const previous = Number(g2gPrice7dAgo.median);
    if (previous > 0) {
      g2gChange7d = ((current - previous) / previous) * 100;
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
    g2gDivinePrice: latestG2gPrice
      ? {
          median: Number(latestG2gPrice.median),
          p25: Number(latestG2gPrice.p25),
          offerCount: latestG2gPrice.offerCount,
          collectedAt: latestG2gPrice.collectedAt,
          league: latestG2gPrice.league,
        }
      : null,
    g2gChange7d,
    recentSales: recentSales.map((s) => ({
      id: s.id,
      date: s.date,
      buyerName: s.buyer.name,
      quantity: Number(s.quantity),
      unit: s.unit,
      totalBrl: s.totalBrl ? Number(s.totalBrl) : null,
      totalUsd: s.totalUsd ? Number(s.totalUsd) : null,
    })),
    currentLeagues: currentLeagues.map((l) => ({ name: l.name, poeVersion: l.poeVersion })),
  });
}
