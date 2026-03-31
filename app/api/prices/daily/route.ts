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
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const limit = Math.min(365, parseInt(searchParams.get("limit") || "90"));

  const where: Record<string, unknown> = { item };
  if (league) where.league = league;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
  }

  const dailyPrices = await prisma.dailyPrice.findMany({
    where,
    orderBy: { date: "asc" },
    take: limit,
  });

  const data = dailyPrices.map((dp) => ({
    date: dp.date.toISOString().split("T")[0],
    item: dp.item,
    league: dp.league,
    median: Number(dp.median),
    mean: Number(dp.mean),
    min: Number(dp.min),
    max: Number(dp.max),
    cnlPrice: dp.cnlPrice ? Number(dp.cnlPrice) : null,
    sellCount: dp.sellCount,
    buyCount: dp.buyCount,
    totalOffers: dp.totalOffers,
  }));

  return NextResponse.json(data);
}
