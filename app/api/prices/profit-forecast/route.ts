import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decomposeDailyCost, type CustomCostEntry } from "@/lib/daily-cost";
import {
  buildDecayCurve,
  curveToPoints,
  DEFAULT_REFERENCE_DAY,
  type LeagueSeries,
} from "@/lib/league-price-curve";

/**
 * Material da calculadora rápida de profit.
 *
 * Devolve o preço de hoje, a curva de queda das ligas passadas e os custos
 * diários já decompostos. O cálculo em si roda no cliente: os controles
 * (divines/hora, horas, bots) precisam responder na hora, e ir ao servidor a
 * cada tecla só adicionaria latência a uma conta trivial.
 */

/** Abaixo disso a mediana entre ligas não significa muito; ampliamos a amostra. */
const MIN_LEAGUES_FOR_CURVE = 2;

const MS_PER_DAY = 86_400_000;

function dayOfLeague(date: Date, startDate: Date): number {
  return Math.floor((date.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
}

/**
 * Séries históricas por liga, em dia-de-liga.
 *
 * Prefere ligas da mesma versão do jogo — PoE1 e PoE2 têm economias distintas.
 * Se não houver ligas suficientes, cai para todas: uma curva de outra versão
 * ainda descreve melhor a queda do que preço constante.
 */
async function loadHistoricalSeries(
  poeVersion: "poe1" | "poe2",
  excludeLeague: string,
): Promise<{ series: LeagueSeries[]; usedFallback: boolean }> {
  const leagues = await prisma.league.findMany({
    where: { startDate: { not: null }, name: { not: excludeLeague } },
    select: { name: true, startDate: true, poeVersion: true },
  });

  const build = async (pool: typeof leagues): Promise<LeagueSeries[]> => {
    if (pool.length === 0) return [];
    const rows = await prisma.dailyPrice.findMany({
      where: { item: "divine", league: { in: pool.map((l) => l.name) } },
      orderBy: { date: "asc" },
      select: { league: true, date: true, median: true },
    });

    const startByLeague = new Map(pool.map((l) => [l.name, l.startDate!]));
    const byLeague = new Map<string, LeagueSeries>();

    for (const row of rows) {
      const start = startByLeague.get(row.league);
      if (!start) continue;
      const entry = byLeague.get(row.league) ?? { league: row.league, points: [] };
      entry.points.push({
        dayOfLeague: dayOfLeague(row.date, start),
        price: Number(row.median),
      });
      byLeague.set(row.league, entry);
    }
    return Array.from(byLeague.values());
  };

  const sameVersion = await build(leagues.filter((l) => l.poeVersion === poeVersion));
  if (sameVersion.length >= MIN_LEAGUES_FOR_CURVE) {
    return { series: sameVersion, usedFallback: false };
  }

  const all = await build(leagues);
  return { series: all, usedFallback: all.length > sameVersion.length };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueParam = request.nextUrl.searchParams.get("league");

  const league = leagueParam
    ? await prisma.league.findUnique({ where: { name: leagueParam } })
    : await prisma.league.findFirst({ where: { isCurrent: true, poeVersion: "poe1" } });

  if (!league) {
    return NextResponse.json(
      { error: leagueParam ? `Liga não encontrada: ${leagueParam}` : "Nenhuma liga atual" },
      { status: 404 },
    );
  }

  const [snapshot, costConfigs, historical] = await Promise.all([
    prisma.g2gPriceSnapshot.findFirst({
      where: { item: "Divine Orb", league: league.name },
      orderBy: { collectedAt: "desc" },
    }),
    prisma.globalCostConfig.findMany({ orderBy: { createdAt: "asc" } }),
    loadHistoricalSeries(league.poeVersion, league.name),
  ]);

  const curve = buildDecayCurve(historical.series, DEFAULT_REFERENCE_DAY);

  // Sem startDate não dá para situar o dia atual na curva; a UI cai para preço
  // constante em vez de projetar sobre um dia inventado.
  const currentDayOfLeague = league.startDate
    ? dayOfLeague(new Date(), league.startDate)
    : null;

  return NextResponse.json({
    league: {
      name: league.name,
      poeVersion: league.poeVersion,
      startDate: league.startDate,
      currentDayOfLeague,
    },
    basePrice: snapshot
      ? {
          medianUsd: Number(snapshot.median),
          p25Usd: Number(snapshot.p25),
          offerCount: snapshot.offerCount,
          collectedAt: snapshot.collectedAt,
        }
      : null,
    curve: curve
      ? {
          referenceDay: curve.referenceDay,
          leaguesUsed: curve.leaguesUsed,
          maxDay: curve.maxDay,
          usedOtherGameVersion: historical.usedFallback,
          points: curveToPoints(curve),
        }
      : null,
    costConfigs: costConfigs.map((config) => {
      const parts = decomposeDailyCost({
        proxyCostPerBotMonthly: config.proxyCostPerBotMonthly,
        levelingCostPerBot: config.levelingCostPerBot,
        stashPackCostPerBot: config.stashPackCostPerBot,
        expluginsKeyCostDaily: config.expluginsKeyCostDaily,
        dpbKeyCostDaily: config.dpbKeyCostDaily,
        customCosts: (config.customCosts as CustomCostEntry[] | null) ?? null,
      });
      return {
        id: config.id,
        name: config.name,
        isDefault: config.isDefault,
        parts,
      };
    }),
  });
}
