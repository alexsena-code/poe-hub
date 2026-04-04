/**
 * Discord Price Scraper — Automated Pipeline
 *
 * Full pipeline: Export → Parse → Insert → Resolve Leagues → Aggregate Daily
 *
 * First run:  exports full channel history
 * Next runs:  exports only since last known message (incremental)
 *
 * Usage:
 *   npx tsx scripts/discord-price-scraper/index.ts [options]
 *
 * Options:
 *   --full            Force full history export (ignore last known date)
 *   --dce-path <path> Path to DiscordChatExporter.Cli.exe
 *   --help
 *
 * Requires:
 *   DISCORD_TOKEN env var (user or bot token)
 *   DATABASE_URL env var
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseExport, type DiscordExport, type ParsedPrice } from "./llm-parser.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_DCE_PATH = "C:/Users/alexa/Downloads/DiscordChatExporter.Cli.win-x64/DiscordChatExporter.Cli.exe";
const EXPORTS_DIR = path.resolve(process.cwd(), "exports");
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Args {
  full: boolean;
  dcePath: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let full = false;
  let dcePath = process.env.DCE_PATH || DEFAULT_DCE_PATH;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--full") full = true;
    else if (args[i] === "--dce-path" && args[i + 1]) { dcePath = args[i + 1]; i++; }
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Discord Price Scraper — Automated Pipeline

Usage:
  npx tsx scripts/discord-price-scraper/index.ts [options]

Options:
  --full              Force full history export (ignore last message date)
  --dce-path <path>   Path to DiscordChatExporter.Cli.exe
  --help, -h          Show help

Environment:
  DISCORD_TOKEN       Discord token (user or bot)
  DATABASE_URL        PostgreSQL connection string
  DCE_PATH            Alternative to --dce-path
`);
      process.exit(0);
    }
  }

  return { full, dcePath };
}

// ---------------------------------------------------------------------------
// Prisma
// ---------------------------------------------------------------------------

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) { console.error("ERROR: DATABASE_URL not set."); process.exit(1); }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// ---------------------------------------------------------------------------
// DiscordChatExporter
// ---------------------------------------------------------------------------

function exportChannel(
  dcePath: string,
  token: string,
  channelId: string,
  outputPath: string,
  afterDate?: string,
): void {
  const args = [
    `"${dcePath}"`,
    "export",
    "--channel", channelId,
    "--token", `"${token}"`,
    "-f", "Json",
    "-o", `"${outputPath}"`,
    "--rate-limit", "true",
  ];

  if (afterDate) {
    args.push("--after", `"${afterDate}"`);
  }

  const cmd = args.join(" ");
  console.log(`  Running: DiscordChatExporter export --channel ${channelId}${afterDate ? ` --after ${afterDate}` : " (full history)"}`);

  try {
    execSync(cmd, { stdio: "pipe", timeout: 1800000, maxBuffer: 50 * 1024 * 1024 }); // 30min timeout
  } catch (err: unknown) {
    const error = err as { stderr?: Buffer; status?: number };
    const stderr = error.stderr?.toString() || "";
    if (stderr.includes("No messages found")) {
      console.log("  No new messages found.");
      return;
    }
    // If the file was created despite the error, continue processing
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100) {
      console.log(`  DCE exited with error but file exists (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)}MB) — processing anyway`);
      return;
    }
    throw new Error(`DCE failed: ${stderr.substring(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// League resolver
// ---------------------------------------------------------------------------

interface LeagueInfo {
  name: string;
  poeVersion: string;
  startDate: Date | null;
  endDate: Date | null;
}

function resolveLeague(messageDate: Date, leagues: LeagueInfo[], poeVersion: "poe1" | "poe2"): string {
  const filtered = leagues.filter((l) => l.poeVersion === poeVersion);
  for (const league of filtered) {
    if (!league.startDate) continue;
    if (messageDate >= league.startDate && (!league.endDate || messageDate <= league.endDate)) {
      return league.name;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Daily aggregation
// ---------------------------------------------------------------------------

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

async function aggregateDailyPrices(prisma: PrismaClient, entries: ParsedPrice[], leagues: LeagueInfo[]) {
  // Build set of league launch dates to skip (first day is too volatile)
  const launchDates = new Set<string>();
  for (const l of leagues) {
    if (l.startDate) {
      launchDates.add(l.startDate.toISOString().split("T")[0]);
    }
  }

  const groups = new Map<string, ParsedPrice[]>();

  for (const entry of entries) {
    const date = new Date(entry.messageTimestamp).toISOString().split("T")[0];

    // Skip first day of any league (prices are too volatile)
    if (launchDates.has(date)) continue;

    const key = `${date}|${entry.item}|${entry.league || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  let upserted = 0;

  for (const [key, group] of groups) {
    const [dateStr, item, league] = key.split("|");
    const date = new Date(dateStr);
    const sellEntries = group.filter((e) => e.operation === "sell" && !e.isSold);
    const prices = sellEntries.map((e) => e.price).filter((p) => !isNaN(p) && isFinite(p) && p > 0);
    if (prices.length === 0) continue;

    const cnlPrices = group.filter((e) => e.isCnl).map((e) => e.price).filter((p) => !isNaN(p) && isFinite(p) && p > 0);

    await prisma.dailyPrice.upsert({
      where: { date_item_league_currency: { date, item, league, currency: "brl" } },
      update: {
        median: median(prices), mean: mean(prices),
        min: Math.min(...prices), max: Math.max(...prices),
        cnlPrice: cnlPrices.length > 0 ? median(cnlPrices) : null,
        sellCount: sellEntries.length,
        buyCount: group.filter((e) => e.operation === "buy").length,
        totalOffers: group.length,
      },
      create: {
        date, item, league, currency: "brl",
        median: median(prices), mean: mean(prices),
        min: Math.min(...prices), max: Math.max(...prices),
        cnlPrice: cnlPrices.length > 0 ? median(cnlPrices) : null,
        sellCount: sellEntries.length,
        buyCount: group.filter((e) => e.operation === "buy").length,
        totalOffers: group.length,
      },
    });
    upserted++;
  }

  return upserted;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  const { full, dcePath } = parseArgs();

  const token = process.env.DISCORD_TOKEN;
  if (!token) { console.error("ERROR: DISCORD_TOKEN not set."); process.exit(1); }

  if (!fs.existsSync(dcePath)) {
    console.error(`ERROR: DiscordChatExporter not found at: ${dcePath}`);
    console.error("Set DCE_PATH env var or use --dce-path");
    process.exit(1);
  }

  console.log("=== Discord Price Scraper — Automated Pipeline ===");
  console.log(`Mode: ${full ? "FULL HISTORY" : "INCREMENTAL"}`);
  console.log();

  // Ensure temp dir
  if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  const prisma = createPrisma();

  try {
    // Load Discord sources
    const sources = await prisma.discordSource.findMany({ where: { isActive: true } });
    if (sources.length === 0) {
      console.error("ERROR: No active Discord sources configured.");
      console.error("Add sources via the UI at /prices/sources or seed them.");
      process.exit(1);
    }
    console.log(`Active sources: ${sources.length}`);

    // Load leagues for auto-resolution
    const leagues = await prisma.league.findMany({
      orderBy: { startDate: "desc" },
      select: { name: true, poeVersion: true, startDate: true, endDate: true },
    });
    console.log(`Leagues loaded: ${leagues.length}`);

    let totalNew = 0;
    let totalDuplicates = 0;
    let totalSkipped = 0;
    const allParsedEntries: ParsedPrice[] = [];

    for (let si = 0; si < sources.length; si++) {
      const source = sources[si];

      // Delay between channels to reduce detection risk (skip first)
      if (si > 0) {
        const delaySec = 30 + Math.floor(Math.random() * 30); // 30-60s
        console.log(`\n  Waiting ${delaySec}s before next channel...`);
        await new Promise((r) => setTimeout(r, delaySec * 1000));
      }

      console.log(`\n--- ${source.serverName} / ${source.channelName} (${source.channelId}) ---`);

      // Determine poeVersion from channel name
      const poeVersion: "poe1" | "poe2" = source.channelName.includes("2") ? "poe2" : "poe1";
      console.log(`  PoE version: ${poeVersion}`);

      // Find last known message timestamp for this channel (incremental)
      let afterDate: string | undefined;
      if (!full) {
        const lastEntry = await prisma.priceEntry.findFirst({
          where: { discordChannelId: source.channelId },
          orderBy: { messageTimestamp: "desc" },
          select: { messageTimestamp: true },
        });

        if (lastEntry) {
          // Go 1 hour back to catch any missed messages
          const since = new Date(lastEntry.messageTimestamp.getTime() - 3600000);
          afterDate = since.toISOString().split("T")[0];
          console.log(`  Incremental: since ${afterDate} (last entry: ${lastEntry.messageTimestamp.toISOString()})`);
        } else {
          console.log("  First run: exporting full history");
        }
      } else {
        console.log("  Full history export (--full flag)");
      }

      // Export (skip if file already exists and is > 1MB — reuse cached export)
      const outputFile = path.join(EXPORTS_DIR, `${source.channelId}.json`);
      if (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 1024 * 1024) {
        const sizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(1);
        console.log(`  Using cached export: ${outputFile} (${sizeMB}MB)`);
      } else {
        try {
          exportChannel(dcePath, token, source.channelId, outputFile, afterDate);
        } catch (err) {
          console.error(`  Export failed: ${err instanceof Error ? err.message : String(err)}`);
          continue;
        }

        if (!fs.existsSync(outputFile)) {
          console.log("  No export file generated (no new messages)");
          continue;
        }
      }

      // Parse
      const data: DiscordExport = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
      const cnlAuthorIds = new Set(source.cnlAuthorIds);
      const result = await parseExport(data, cnlAuthorIds);

      // Auto-resolve leagues
      for (const entry of result.entries) {
        if (!entry.league) {
          entry.league = resolveLeague(new Date(entry.messageTimestamp), leagues, poeVersion);
        }
      }

      console.log(`  Parsed: ${result.entries.length} prices, ${result.skipped} skipped`);
      allParsedEntries.push(...result.entries);

      // Insert
      if (result.entries.length > 0) {
        let inserted = 0;
        for (let i = 0; i < result.entries.length; i += BATCH_SIZE) {
          const batch = result.entries.slice(i, i + BATCH_SIZE);
          const dbRecords = batch
            .filter((e) => !isNaN(e.price) && e.price > 0)
            .map((e) => ({
            discordMessageId: e.discordMessageId,
            discordChannelId: e.discordChannelId,
            discordServerId: e.discordServerId,
            authorDiscordId: e.authorDiscordId,
            authorName: e.authorName,
            isCnl: e.isCnl,
            price: parseFloat(Number(e.price).toFixed(8)).toString(),
            currency: e.currency as "divine" | "chaos" | "usd" | "brl" | "other",
            item: e.item,
            rawMessage: e.rawMessage,
            messageTimestamp: e.messageTimestamp,
            league: e.league,
          }));

          try {
            const res = await prisma.priceEntry.createMany({ data: dbRecords, skipDuplicates: true });
            inserted += res.count;
          } catch (dbErr) {
            console.error(`    DB batch error (skipping batch): ${dbErr instanceof Error ? dbErr.message.substring(0, 100) : String(dbErr)}`);
          }
        }

        const dupes = result.entries.length - inserted;
        console.log(`  Inserted: ${inserted} new, ${dupes} duplicates`);
        totalNew += inserted;
        totalDuplicates += dupes;
      }

      totalSkipped += result.skipped;

      // Keep exported file for future re-processing
      console.log(`  Export saved: ${outputFile}`);
    }

    // Aggregate daily prices
    if (allParsedEntries.length > 0) {
      console.log("\n=== Aggregating Daily Prices ===");
      const days = await aggregateDailyPrices(prisma, allParsedEntries, leagues);
      console.log(`Aggregated ${days} daily price records`);
    }

    // Summary
    console.log("\n=== Summary ===");
    console.log(`Sources:    ${sources.length}`);
    console.log(`New:        ${totalNew}`);
    console.log(`Duplicates: ${totalDuplicates}`);
    console.log(`Skipped:    ${totalSkipped}`);
    console.log(`Total parsed: ${allParsedEntries.length}`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
