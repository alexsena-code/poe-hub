import { prisma } from "@/lib/prisma";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Aggregate price entries into daily summaries.
 * Groups by date + item + league, calculates stats, upserts into DailyPrice.
 */
export async function aggregateDailyPrices(options?: {
  dateFrom?: Date;
  dateTo?: Date;
}) {
  // Fetch raw entries (only sells — buy prices distort the market view)
  const where: Record<string, unknown> = {};
  if (options?.dateFrom || options?.dateTo) {
    where.messageTimestamp = {};
    if (options?.dateFrom) (where.messageTimestamp as Record<string, unknown>).gte = options.dateFrom;
    if (options?.dateTo) (where.messageTimestamp as Record<string, unknown>).lte = options.dateTo;
  }

  const entries = await prisma.priceEntry.findMany({
    where,
    select: {
      price: true,
      isCnl: true,
      item: true,
      league: true,
      messageTimestamp: true,
      currency: true,
    },
    orderBy: { messageTimestamp: "asc" },
  });

  if (entries.length === 0) {
    console.log("No price entries found for aggregation");
    return 0;
  }

  // We need operation info — check rawMessage for buy/sell
  // For now, use all entries (the parser already classifies them)
  // We'll add an operation field to PriceEntry later if needed

  // Group by date + item + league
  const groups = new Map<string, typeof entries>();

  for (const entry of entries) {
    const date = entry.messageTimestamp.toISOString().split("T")[0];
    const item = entry.item || "divine";
    const league = entry.league || "unknown";
    const key = `${date}|${item}|${league}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  let upserted = 0;

  for (const [key, groupEntries] of groups) {
    const [dateStr, item, league] = key.split("|");
    const date = new Date(dateStr);

    const prices = groupEntries.map((e) => Number(e.price));
    const cnlEntries = groupEntries.filter((e) => e.isCnl);
    const cnlPrices = cnlEntries.map((e) => Number(e.price));

    // Use median of CNL prices as the CNL reference price for the day
    const cnlPrice = cnlPrices.length > 0 ? median(cnlPrices) : null;

    // Sell count: entries that are NOT from buy context
    // Since we don't have operation in PriceEntry, estimate from isCnl
    // CNL posts are buy offers (they buy from players), others are sell offers
    const sellCount = groupEntries.filter((e) => !e.isCnl).length;
    const buyCount = cnlEntries.length;

    await prisma.dailyPrice.upsert({
      where: {
        date_item_league_currency: {
          date,
          item,
          league: league === "unknown" ? "" : league,
          currency: "brl",
        },
      },
      update: {
        median: median(prices),
        mean: mean(prices),
        min: Math.min(...prices),
        max: Math.max(...prices),
        cnlPrice,
        sellCount,
        buyCount,
        totalOffers: groupEntries.length,
      },
      create: {
        date,
        item,
        league: league === "unknown" ? "" : league,
        currency: "brl",
        median: median(prices),
        mean: mean(prices),
        min: Math.min(...prices),
        max: Math.max(...prices),
        cnlPrice,
        sellCount,
        buyCount,
        totalOffers: groupEntries.length,
      },
    });

    upserted++;
  }

  return upserted;
}
