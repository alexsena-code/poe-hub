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
  const leaguesParam = searchParams.get("leagues");
  const maxDays = Math.min(180, parseInt(searchParams.get("maxDays") || "90"));

  if (!leaguesParam) {
    return NextResponse.json({ error: "leagues parameter required" }, { status: 400 });
  }

  const leagueNames = leaguesParam.split(",").map((l) => l.trim()).filter(Boolean);
  if (leagueNames.length === 0) {
    return NextResponse.json({ error: "At least one league required" }, { status: 400 });
  }

  // Fetch league records for startDate
  const leagues = await prisma.league.findMany({
    where: { name: { in: leagueNames } },
    select: { name: true, startDate: true, poeVersion: true },
  });

  const leagueMap = new Map(leagues.map((l) => [l.name, l]));

  // Validate all leagues have startDate
  const missing = leagueNames.filter((n) => !leagueMap.get(n)?.startDate);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Leagues without start date: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Fetch all daily prices for these leagues in a single query
  const dailyPrices = await prisma.dailyPrice.findMany({
    where: {
      item,
      league: { in: leagueNames },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      league: true,
      median: true,
      cnlPrice: true,
    },
  });

  // Group by league and compute dayOfLeague
  const result = leagueNames.map((name) => {
    const league = leagueMap.get(name)!;
    const startDate = league.startDate!;
    const entries = dailyPrices.filter((dp) => dp.league === name);

    const data = entries
      .map((dp) => {
        const dayOfLeague = Math.floor(
          (dp.date.getTime() - startDate.getTime()) / 86400000
        ) + 1;
        return {
          dayOfLeague,
          median: Number(dp.median),
          cnlPrice: dp.cnlPrice ? Number(dp.cnlPrice) : null,
        };
      })
      .filter((d) => d.dayOfLeague >= 1 && d.dayOfLeague <= maxDays);

    return {
      name,
      poeVersion: league.poeVersion,
      startDate: startDate.toISOString().split("T")[0],
      data,
    };
  });

  return NextResponse.json({ leagues: result });
}
