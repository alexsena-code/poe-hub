import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const item = searchParams.get("item") || "divine";
  const league = searchParams.get("league");
  const channelId = searchParams.get("channelId");

  const now = new Date();
  const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Filter by item field (new data) or legacy currency field (old data)
  const itemFilter = {
    OR: [
      { item },
      ...(["divine", "chaos"].includes(item)
        ? [{ currency: item as "divine" | "chaos", item: null }]
        : []),
    ],
  };

  const baseWhere: Record<string, unknown> = {
    ...itemFilter,
    ...(league ? { league } : {}),
    ...(channelId ? { discordChannelId: channelId } : {}),
  };

  // Current CNL price (most recent CNL entry)
  const latestCnl = await prisma.priceEntry.findFirst({
    where: { ...baseWhere, isCnl: true },
    orderBy: { messageTimestamp: "desc" },
    select: { price: true },
  });

  // Avg CNL 7d
  const avgCnl7d = await prisma.priceEntry.aggregate({
    where: { ...baseWhere, isCnl: true, messageTimestamp: { gte: days7Ago } },
    _avg: { price: true },
  });

  // Avg CNL 30d
  const avgCnl30d = await prisma.priceEntry.aggregate({
    where: { ...baseWhere, isCnl: true, messageTimestamp: { gte: days30Ago } },
    _avg: { price: true },
  });

  // Avg Market 7d (non-CNL)
  const avgMarket7d = await prisma.priceEntry.aggregate({
    where: { ...baseWhere, isCnl: false, messageTimestamp: { gte: days7Ago } },
    _avg: { price: true },
  });

  const toNumber = (v: unknown): number | null =>
    v !== null && v !== undefined ? Number(v) : null;

  const currentCnlPrice = toNumber(latestCnl?.price ?? null);
  const avgCnl7dVal = toNumber(avgCnl7d._avg.price);
  const avgCnl30dVal = toNumber(avgCnl30d._avg.price);
  const avgMarket7dVal = toNumber(avgMarket7d._avg.price);

  // Spread: CNL vs Market (7d)
  let spreadCnlVsMarket: number | null = null;
  if (avgCnl7dVal !== null && avgMarket7dVal !== null && avgMarket7dVal !== 0) {
    spreadCnlVsMarket = Number(
      (((avgCnl7dVal - avgMarket7dVal) / avgMarket7dVal) * 100).toFixed(2)
    );
  }

  return NextResponse.json({
    item,
    league: league ?? null,
    currentCnlPrice,
    avgCnl7d: avgCnl7dVal,
    avgCnl30d: avgCnl30dVal,
    avgMarket7d: avgMarket7dVal,
    spreadCnlVsMarket,
  });
}
