/**
 * Discord Price Scraper — Main CLI Script
 *
 * Reads DiscordChatExporter JSON files, parses prices, inserts into DB,
 * and aggregates daily price summaries.
 *
 * Usage:
 *   npx tsx scripts/discord-price-scraper/index.ts [--exports-dir ./exports] [--league "Mirage"]
 */

import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseExport, type DiscordExport, type ParsedPrice } from "./parser.js";

function parseArgs(): { exportsDir: string; league: string | null } {
  const args = process.argv.slice(2);
  let exportsDir = path.resolve(process.cwd(), "exports");
  let league: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--exports-dir" || args[i] === "-d") && args[i + 1]) {
      exportsDir = path.resolve(args[i + 1]);
      i++;
    } else if ((args[i] === "--league" || args[i] === "-l") && args[i + 1]) {
      league = args[i + 1];
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Discord Price Scraper

Usage:
  npx tsx scripts/discord-price-scraper/index.ts [options]

Options:
  --exports-dir, -d <path>   Directory with JSON export files (default: ./exports)
  --league, -l <name>        League name to tag entries with
  --help, -h                 Show help
`);
      process.exit(0);
    }
  }

  return { exportsDir, league };
}

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL not set.");
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

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

async function aggregateDailyPrices(prisma: PrismaClient, allEntries: ParsedPrice[]) {
  // Group by date + item + league
  const groups = new Map<string, ParsedPrice[]>();

  for (const entry of allEntries) {
    const date = new Date(entry.messageTimestamp).toISOString().split("T")[0];
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

    const sellEntries = groupEntries.filter((e) => e.operation === "sell" && !e.isSold);
    const buyEntries = groupEntries.filter((e) => e.operation === "buy");
    const cnlEntries = groupEntries.filter((e) => e.isCnl);

    // Use sell prices for market stats (buy prices are lower, different context)
    const prices = sellEntries.map((e) => e.price);
    if (prices.length === 0) continue;

    const cnlPrices = cnlEntries.map((e) => e.price);
    const cnlPrice = cnlPrices.length > 0 ? median(cnlPrices) : null;

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
        sellCount: sellEntries.length,
        buyCount: buyEntries.length,
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
        sellCount: sellEntries.length,
        buyCount: buyEntries.length,
        totalOffers: groupEntries.length,
      },
    });

    upserted++;
  }

  return upserted;
}

async function main() {
  const { exportsDir, league } = parseArgs();

  console.log("=== Discord Price Scraper ===");
  console.log(`Exports: ${exportsDir}`);
  if (league) console.log(`League: ${league}`);
  console.log();

  if (!fs.existsSync(exportsDir)) {
    console.error(`ERROR: Directory not found: ${exportsDir}`);
    process.exit(1);
  }

  const jsonFiles = fs
    .readdirSync(exportsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(exportsDir, f));

  if (jsonFiles.length === 0) {
    console.log("No JSON files found.");
    process.exit(0);
  }

  console.log(`Found ${jsonFiles.length} JSON file(s)`);
  console.log();

  const prisma = createPrisma();

  try {
    // Fetch Discord sources for CNL classification
    const sources = await prisma.discordSource.findMany({ where: { isActive: true } });
    const sourceMap = new Map<string, string[]>();
    for (const source of sources) {
      sourceMap.set(source.channelId, source.cnlAuthorIds);
    }
    console.log(`Loaded ${sources.length} Discord source(s)`);

    let totalNew = 0;
    let totalSkipped = 0;
    let totalDuplicates = 0;
    const allParsedEntries: ParsedPrice[] = [];

    for (const filePath of jsonFiles) {
      const fileName = path.basename(filePath);
      console.log(`\nProcessing: ${fileName}`);

      try {
        const data: DiscordExport = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const cnlAuthorIds = new Set(sourceMap.get(data.channel.id) ?? []);

        if (!sourceMap.has(data.channel.id)) {
          console.log(`  ⚠ Channel ${data.channel.id} not in sources — no CNL classification`);
        }

        const result = parseExport(data, cnlAuthorIds, league ?? undefined);
        console.log(`  Parsed: ${result.entries.length} prices, ${result.skipped} skipped`);

        allParsedEntries.push(...result.entries);

        if (result.entries.length > 0) {
          const BATCH_SIZE = 500;
          let inserted = 0;

          for (let i = 0; i < result.entries.length; i += BATCH_SIZE) {
            const batch = result.entries.slice(i, i + BATCH_SIZE);
            const dbRecords = batch.map((entry) => ({
              discordMessageId: entry.discordMessageId,
              discordChannelId: entry.discordChannelId,
              discordServerId: entry.discordServerId,
              authorDiscordId: entry.authorDiscordId,
              authorName: entry.authorName,
              isCnl: entry.isCnl,
              price: entry.price,
              currency: entry.currency as "divine" | "chaos" | "usd" | "brl" | "other",
              item: entry.item,
              rawMessage: entry.rawMessage,
              messageTimestamp: entry.messageTimestamp,
              league: entry.league,
            }));

            const createResult = await prisma.priceEntry.createMany({
              data: dbRecords,
              skipDuplicates: true,
            });
            inserted += createResult.count;
          }

          const duplicates = result.entries.length - inserted;
          console.log(`  Inserted: ${inserted} new, ${duplicates} duplicates`);
          totalNew += inserted;
          totalDuplicates += duplicates;
        }

        totalSkipped += result.skipped;
      } catch (err) {
        console.error(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Aggregate daily prices
    console.log("\n=== Aggregating Daily Prices ===");
    const daysAggregated = await aggregateDailyPrices(prisma, allParsedEntries);
    console.log(`Aggregated ${daysAggregated} daily price records`);

    // Summary
    console.log("\n=== Summary ===");
    console.log(`Files:      ${jsonFiles.length}`);
    console.log(`New:        ${totalNew}`);
    console.log(`Duplicates: ${totalDuplicates}`);
    console.log(`Skipped:    ${totalSkipped}`);
    console.log(`Daily agg:  ${daysAggregated}`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
