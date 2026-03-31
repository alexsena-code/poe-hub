/**
 * Re-aggregate DailyPrice from existing PriceEntry data.
 * Does NOT re-import — just recalculates daily stats from what's in the DB.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  // Clear existing daily prices
  const deleted = await prisma.dailyPrice.deleteMany();
  console.log(`Cleared ${deleted.count} daily prices`);

  // Fetch all price entries
  const entries = await prisma.priceEntry.findMany({
    select: { price: true, isCnl: true, item: true, league: true, messageTimestamp: true },
    orderBy: { messageTimestamp: "asc" },
  });
  console.log(`Loaded ${entries.length} price entries`);

  // Load league launch dates to skip
  const leagues = await prisma.league.findMany({ select: { startDate: true } });
  const launchDates = new Set(leagues.filter(l => l.startDate).map(l => l.startDate!.toISOString().split("T")[0]));

  // Group by date + item + league
  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const date = e.messageTimestamp.toISOString().split("T")[0];
    if (launchDates.has(date)) continue; // skip launch days
    const key = `${date}|${e.item || "divine"}|${e.league || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  let upserted = 0;
  for (const [key, group] of groups) {
    const [dateStr, item, league] = key.split("|");
    const date = new Date(dateStr);

    // Use all non-CNL as "sell", CNL as "buy"
    const sellPrices = group.filter(e => !e.isCnl).map(e => Number(e.price)).filter(p => !isNaN(p) && p > 0);
    if (sellPrices.length === 0) continue;

    const cnlPrices = group.filter(e => e.isCnl).map(e => Number(e.price)).filter(p => !isNaN(p) && p > 0);

    await prisma.dailyPrice.upsert({
      where: { date_item_league_currency: { date, item, league, currency: "brl" } },
      update: {
        median: median(sellPrices), mean: mean(sellPrices),
        min: Math.min(...sellPrices), max: Math.max(...sellPrices),
        cnlPrice: cnlPrices.length > 0 ? median(cnlPrices) : null,
        sellCount: sellPrices.length, buyCount: cnlPrices.length,
        totalOffers: group.length,
      },
      create: {
        date, item, league, currency: "brl",
        median: median(sellPrices), mean: mean(sellPrices),
        min: Math.min(...sellPrices), max: Math.max(...sellPrices),
        cnlPrice: cnlPrices.length > 0 ? median(cnlPrices) : null,
        sellCount: sellPrices.length, buyCount: cnlPrices.length,
        totalOffers: group.length,
      },
    });
    upserted++;
  }

  console.log(`Aggregated: ${upserted} daily price records`);
  await prisma.$disconnect();
}

main();
