/**
 * Process existing JSON files from .scraper-temp without calling DCE
 */
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseExport, type DiscordExport, type ParsedPrice } from "./parser.js";

const TEMP_DIR = path.resolve(process.cwd(), ".scraper-temp");
const BATCH_SIZE = 500;

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

interface LeagueInfo { name: string; poeVersion: string; startDate: Date | null; endDate: Date | null }

function resolveLeague(date: Date, leagues: LeagueInfo[], poeVersion: "poe1" | "poe2"): string {
  for (const l of leagues.filter(l => l.poeVersion === poeVersion)) {
    if (l.startDate && date >= l.startDate && (!l.endDate || date <= l.endDate)) return l.name;
  }
  return "";
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Clear existing data for clean reimport
  await prisma.dailyPrice.deleteMany();
  await prisma.priceEntry.deleteMany();
  console.log("Cleared existing price data");

  const sources = await prisma.discordSource.findMany({ where: { isActive: true } });
  const sourceMap = new Map(sources.map(s => [s.channelId, s]));
  console.log(`Sources: ${sources.length}`);

  const leagues = await prisma.league.findMany({ orderBy: { startDate: "desc" } });
  console.log(`Leagues: ${leagues.length}`);

  const jsonFiles = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith(".json"));
  console.log(`JSON files: ${jsonFiles.length}\n`);

  const allEntries: ParsedPrice[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(TEMP_DIR, file);
    const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);
    console.log(`Processing: ${file} (${sizeMB}MB)`);

    const data: DiscordExport = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const source = sourceMap.get(data.channel.id);
    const cnlIds = new Set(source?.cnlAuthorIds ?? []);
    const poeVersion: "poe1" | "poe2" = data.channel.name.includes("2") ? "poe2" : "poe1";

    console.log(`  Channel: ${data.channel.name} (${poeVersion}), Messages: ${data.messages.length}`);

    const result = parseExport(data, cnlIds);

    // Resolve leagues
    for (const entry of result.entries) {
      if (!entry.league) {
        entry.league = resolveLeague(new Date(entry.messageTimestamp), leagues, poeVersion);
      }
    }

    console.log(`  Parsed: ${result.entries.length} prices, ${result.skipped} skipped`);
    allEntries.push(...result.entries);

    // Insert in batches
    let inserted = 0;
    for (let i = 0; i < result.entries.length; i += BATCH_SIZE) {
      const batch = result.entries.slice(i, i + BATCH_SIZE);
      const res = await prisma.priceEntry.createMany({
        data: batch.map(e => ({
          discordMessageId: e.discordMessageId,
          discordChannelId: e.discordChannelId,
          discordServerId: e.discordServerId,
          authorDiscordId: e.authorDiscordId,
          authorName: e.authorName,
          isCnl: e.isCnl,
          price: e.price,
          currency: e.currency as "divine" | "chaos" | "usd" | "brl" | "other",
          item: e.item,
          rawMessage: e.rawMessage,
          messageTimestamp: e.messageTimestamp,
          league: e.league,
        })),
        skipDuplicates: true,
      });
      inserted += res.count;
    }
    console.log(`  Inserted: ${inserted}\n`);
  }

  // Aggregate daily
  console.log("=== Aggregating Daily Prices ===");
  const groups = new Map<string, ParsedPrice[]>();
  for (const e of allEntries) {
    const date = new Date(e.messageTimestamp).toISOString().split("T")[0];
    const key = `${date}|${e.item}|${e.league || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  let days = 0;
  for (const [key, group] of groups) {
    const [dateStr, item, league] = key.split("|");
    const sells = group.filter(e => e.operation === "sell" && !e.isSold);
    const prices = sells.map(e => e.price);
    if (prices.length === 0) continue;
    const cnlPrices = group.filter(e => e.isCnl).map(e => e.price);

    await prisma.dailyPrice.upsert({
      where: { date_item_league_currency: { date: new Date(dateStr), item, league, currency: "brl" } },
      update: { median: median(prices), mean: mean(prices), min: Math.min(...prices), max: Math.max(...prices), cnlPrice: cnlPrices.length > 0 ? median(cnlPrices) : null, sellCount: sells.length, buyCount: group.filter(e => e.operation === "buy").length, totalOffers: group.length },
      create: { date: new Date(dateStr), item, league, currency: "brl", median: median(prices), mean: mean(prices), min: Math.min(...prices), max: Math.max(...prices), cnlPrice: cnlPrices.length > 0 ? median(cnlPrices) : null, sellCount: sells.length, buyCount: group.filter(e => e.operation === "buy").length, totalOffers: group.length },
    });
    days++;
  }

  console.log(`Aggregated: ${days} daily records`);
  console.log(`\n=== DONE ===`);
  console.log(`Total entries: ${allEntries.length}`);
  console.log(`Daily records: ${days}`);

  await prisma.$disconnect();
}

main();
