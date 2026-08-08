/**
 * Orquestra uma coleta de preço do G2G: busca, resume e persiste.
 *
 * Vive em `lib/` porque tem dois chamadores — o cron
 * (`scripts/g2g-price-collector/`) e a rota de disparo manual
 * (`app/api/prices/g2g/`). A regra de precificação mora aqui uma vez só.
 */

import type { PrismaClient } from "@prisma/client";
import { fetchG2gOffers } from "./g2g-client";
import { summarizeOffers, type G2gOffer, type G2gPriceStats } from "./g2g-stats";

/** Quantas das ofertas mais baratas ficam guardadas para auditoria. */
const CHEAPEST_SAMPLE_SIZE = 10;

export type CollectG2gOptions = {
  /** Ausente = resolve a liga marcada como atual no banco. */
  league?: string;
  item?: string;
  platform?: string;
  hardcore?: boolean;
  /** Coleta e calcula, mas não grava. */
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
};

export type CollectG2gResult = {
  snapshotId: string | null;
  league: string;
  g2gLeague: string;
  item: string;
  platform: string;
  stats: G2gPriceStats;
  cheapestSample: CheapestOffer[];
  rawResultCount: number;
  pagesFetched: number;
  dryRun: boolean;
};

type CheapestOffer = {
  priceUsd: number;
  availableQty: number;
  minQty: number;
  sellerName: string;
};

/**
 * Nome da liga PoE1 marcada como atual.
 *
 * Só PoE1: o G2G lista PoE2 sob outro `seo_term`, então uma liga de PoE2 aqui
 * produziria zero ofertas e um erro confuso lá na frente.
 */
export async function resolveCurrentLeague(prisma: PrismaClient): Promise<string> {
  const league = await prisma.league.findFirst({
    where: { isCurrent: true, poeVersion: "poe1" },
    select: { name: true },
  });

  if (!league) {
    throw new Error(
      "nenhuma liga poe1 com isCurrent=true (esperado exatamente uma; rode `npx prisma db seed`)",
    );
  }
  return league.name;
}

/** As N ofertas mais baratas já filtradas, para conferir uma mediana suspeita. */
function pickCheapest(offers: G2gOffer[]): CheapestOffer[] {
  return [...offers]
    .sort((a, b) => a.priceUsd - b.priceUsd)
    .slice(0, CHEAPEST_SAMPLE_SIZE)
    .map(({ priceUsd, availableQty, minQty, sellerName }) => ({
      priceUsd,
      availableQty,
      minQty,
      sellerName,
    }));
}

/**
 * Coleta o preço atual e grava um snapshot.
 *
 * @example
 * const result = await collectG2gSnapshot(prisma, { dryRun: true });
 * console.log(result.stats.median);
 */
export async function collectG2gSnapshot(
  prisma: PrismaClient,
  options: CollectG2gOptions = {},
): Promise<CollectG2gResult> {
  const {
    item = "Divine Orb",
    platform = "PC",
    hardcore = false,
    dryRun = false,
    fetchImpl,
  } = options;

  const league = options.league ?? (await resolveCurrentLeague(prisma));
  const found = await fetchG2gOffers({ league, item, platform, hardcore, fetchImpl });
  const stats = summarizeOffers(found.offers);

  if (!stats) {
    throw new Error(
      `G2G não devolveu nenhuma oferta de "${item}" em "${found.g2gLeague}" (${platform}) ` +
        `— ${found.rawResultCount} linhas vieram, nenhuma casou; confira o nome da liga`,
    );
  }

  const cheapestSample = pickCheapest(found.offers);

  let snapshotId: string | null = null;
  if (!dryRun) {
    const saved = await prisma.g2gPriceSnapshot.create({
      data: {
        item,
        league,
        g2gLeague: found.g2gLeague,
        platform,
        currency: "usd",
        median: stats.median,
        mean: stats.mean,
        min: stats.min,
        max: stats.max,
        p25: stats.p25,
        p75: stats.p75,
        offerCount: stats.offerCount,
        rawOfferCount: stats.rawOfferCount,
        cheapestSample,
      },
      select: { id: true },
    });
    snapshotId = saved.id;
  }

  return {
    snapshotId,
    league,
    g2gLeague: found.g2gLeague,
    item,
    platform,
    stats,
    cheapestSample,
    rawResultCount: found.rawResultCount,
    pagesFetched: found.pagesFetched,
    dryRun,
  };
}
