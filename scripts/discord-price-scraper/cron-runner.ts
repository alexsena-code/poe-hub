/**
 * Discord Price Scraper — Cron Runner
 *
 * Orchestrates one full scrape cycle: runs index.ts pipeline for all active
 * Discord sources, then exits.  Designed to be invoked by a shell cron or
 * Docker-based cron scheduler.
 *
 * Usage:
 *   npx tsx scripts/discord-price-scraper/cron-runner.ts [--full]
 *
 * Exit codes:
 *   0  — cycle completed successfully (partial channel failures are logged but
 *         do NOT cause a non-zero exit unless every source failed)
 *   1  — fatal error (DB unreachable, no active sources, etc.)
 *
 * The script delegates the actual per-channel pipeline to index.ts via a
 * child process so that:
 *  - A crash inside one channel's export/parse loop cannot corrupt this
 *    process's Prisma state.
 *  - The exit code of each child is captured and surfaced in the summary.
 */

import { spawnSync } from "child_process";
import * as path from "path";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString();
}

function log(msg: string): void {
  console.log(`[${timestamp()}] ${msg}`);
}

function logError(msg: string): void {
  console.error(`[${timestamp()}] ERROR: ${msg}`);
}

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logError("DATABASE_URL not set.");
    process.exit(1);
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// ---------------------------------------------------------------------------
// Pre-flight check — verify DB connectivity and log active source count
// ---------------------------------------------------------------------------

async function preflight(): Promise<{ sourceCount: number }> {
  const prisma = createPrisma();
  try {
    const sourceCount = await prisma.discordSource.count({ where: { isActive: true } });
    await prisma.$disconnect();
    return { sourceCount };
  } catch (err) {
    await prisma.$disconnect();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Run scraper pipeline as child process
// ---------------------------------------------------------------------------

interface RunResult {
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
}

function runScraperProcess(extraArgs: string[] = []): RunResult {
  const indexPath = path.resolve(__dirname, "index.ts");
  const start = Date.now();

  const result = spawnSync(
    "npx",
    ["tsx", indexPath, ...extraArgs],
    {
      encoding: "utf-8",
      timeout: 3600000, // 1 hour hard limit per run
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env },
      shell: true,
    },
  );

  return {
    exitCode: result.status ?? 1,
    durationMs: Date.now() - start,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cycleStart = Date.now();
  const isFullRun = process.argv.includes("--full");

  log("=== Cron Runner — Cycle Start ===");
  log(`Mode: ${isFullRun ? "FULL HISTORY" : "INCREMENTAL"}`);

  // Pre-flight: confirm DB is reachable and there are sources to process.
  let sourceCount = 0;
  try {
    ({ sourceCount } = await preflight());
  } catch (err) {
    logError(`DB preflight failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (sourceCount === 0) {
    logError("No active Discord sources in DB. Configure sources via the UI at /prices/sources.");
    process.exit(1);
  }

  log(`Active Discord sources: ${sourceCount}`);

  // Delegate to the full pipeline.  We run a single child that handles all
  // channels in one pass (matching index.ts behaviour).  If more granular
  // per-channel isolation is needed in the future, split here.
  const extraArgs = isFullRun ? ["--full"] : [];
  log("Launching scraper pipeline...");

  const result = runScraperProcess(extraArgs);

  // Always echo child output so it surfaces in the cron log.
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const durationSec = (result.durationMs / 1000).toFixed(1);

  if (result.exitCode === 0) {
    log(`Pipeline completed successfully in ${durationSec}s.`);
  } else {
    logError(`Pipeline exited with code ${result.exitCode} after ${durationSec}s.`);
  }

  // Overall cycle summary
  const totalSec = ((Date.now() - cycleStart) / 1000).toFixed(1);
  log(`=== Cron Runner — Cycle End (${totalSec}s total) ===`);

  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error(`[${timestamp()}] FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
