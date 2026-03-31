/**
 * Discord Price Scraper — Main CLI Script
 *
 * Reads DiscordChatExporter JSON files from an exports directory,
 * parses price entries, and inserts them into the database via Prisma.
 *
 * Usage:
 *   npx tsx scripts/discord-price-scraper/index.ts [--exports-dir ./exports] [--league "League Name"]
 *
 * Environment:
 *   DATABASE_URL — PostgreSQL connection string (loaded from .env)
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseExport, type DiscordExport, type ParsedPriceEntry } from "./parser";

// Load .env from project root
import "dotenv/config";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

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
  --exports-dir, -d <path>   Directory containing JSON export files (default: ./exports)
  --league, -l <name>        League name to tag entries with
  --help, -h                 Show this help message
`);
      process.exit(0);
    }
  }

  return { exportsDir, league };
}

// ---------------------------------------------------------------------------
// Prisma client setup
// ---------------------------------------------------------------------------

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// ---------------------------------------------------------------------------
// Main logic
// ---------------------------------------------------------------------------

async function main() {
  const { exportsDir, league } = parseArgs();

  console.log("=== Discord Price Scraper ===");
  console.log(`Exports directory: ${exportsDir}`);
  if (league) console.log(`League: ${league}`);
  console.log("");

  // Validate exports directory
  if (!fs.existsSync(exportsDir)) {
    console.error(`ERROR: Exports directory does not exist: ${exportsDir}`);
    process.exit(1);
  }

  // Find JSON files
  const jsonFiles = fs
    .readdirSync(exportsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(exportsDir, f));

  if (jsonFiles.length === 0) {
    console.log("No JSON files found in exports directory. Nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${jsonFiles.length} JSON file(s) to process.`);
  console.log("");

  // Initialize Prisma
  const prisma = createPrisma();

  try {
    // Fetch active Discord sources for CNL author classification
    const sources = await prisma.discordSource.findMany({
      where: { isActive: true },
    });

    console.log(`Loaded ${sources.length} active Discord source(s) from database.`);

    // Build channel-to-source mapping for CNL lookups
    const sourceMap = new Map<string, string[]>();
    for (const source of sources) {
      sourceMap.set(source.channelId, source.cnlAuthorIds);
    }

    // Process each JSON file
    let totalNew = 0;
    let totalSkipped = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;

    for (const filePath of jsonFiles) {
      const fileName = path.basename(filePath);
      console.log(`Processing: ${fileName}`);

      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data: DiscordExport = JSON.parse(raw);

        // Get CNL author IDs for this channel
        const cnlAuthorIds = sourceMap.get(data.channel.id) ?? [];

        // Check if this channel is in our sources
        if (!sourceMap.has(data.channel.id)) {
          console.log(
            `  WARNING: Channel ${data.channel.id} (${data.channel.name}) is not in configured sources. ` +
            `Processing anyway with no CNL classification.`
          );
        }

        // Parse the export
        const result = parseExport(data, cnlAuthorIds, league);

        console.log(
          `  Parsed: ${result.entries.length} price entries, ${result.skipped} skipped, ${result.errors.length} errors`
        );

        if (result.errors.length > 0) {
          for (const err of result.errors.slice(0, 5)) {
            console.log(`  ERROR: ${err}`);
          }
          if (result.errors.length > 5) {
            console.log(`  ... and ${result.errors.length - 5} more errors`);
          }
        }

        // Batch insert using createMany with skipDuplicates
        if (result.entries.length > 0) {
          const BATCH_SIZE = 500;
          let inserted = 0;

          for (let i = 0; i < result.entries.length; i += BATCH_SIZE) {
            const batch = result.entries.slice(i, i + BATCH_SIZE);
            const dbRecords = batch.map((entry: ParsedPriceEntry) => ({
              discordMessageId: entry.discordMessageId,
              discordChannelId: entry.discordChannelId,
              discordServerId: entry.discordServerId,
              authorDiscordId: entry.authorDiscordId,
              authorName: entry.authorName,
              isCnl: entry.isCnl,
              price: entry.price,
              currency: entry.currency,
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
          console.log(
            `  Inserted: ${inserted} new, ${duplicates} duplicates skipped`
          );

          totalNew += inserted;
          totalDuplicates += duplicates;
        }

        totalSkipped += result.skipped;
        totalErrors += result.errors.length;
      } catch (err) {
        console.error(
          `  FATAL ERROR processing ${fileName}: ${err instanceof Error ? err.message : String(err)}`
        );
        totalErrors++;
      }

      console.log("");
    }

    // Summary
    console.log("=== Summary ===");
    console.log(`Files processed:    ${jsonFiles.length}`);
    console.log(`New entries:        ${totalNew}`);
    console.log(`Duplicates skipped: ${totalDuplicates}`);
    console.log(`Messages skipped:   ${totalSkipped}`);
    console.log(`Errors:             ${totalErrors}`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(
      `FATAL: ${err instanceof Error ? err.message : String(err)}`
    );
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
