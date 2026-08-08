/**
 * Coletor de preço da concorrência no G2G.
 *
 * Entrypoint do cron e da execução manual. Diferente do scraper do Discord,
 * aqui não há `cron-runner.ts` separado: aquele existia para isolar o binário
 * externo do DiscordChatExporter, que travava. Este processo é uma chamada HTTP
 * e termina sozinho.
 *
 * Uso:
 *   npx tsx scripts/g2g-price-collector/index.ts
 *   npx tsx scripts/g2g-price-collector/index.ts --dry-run
 *   npx tsx scripts/g2g-price-collector/index.ts --league Allflame --item "Chaos Orb"
 *   npx tsx scripts/g2g-price-collector/index.ts --hardcore
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { collectG2gSnapshot } from "../../lib/g2g-collector";

type CliArgs = {
  league?: string;
  item?: string;
  platform?: string;
  hardcore: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const valueOf = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index !== -1 ? argv[index + 1] : undefined;
  };

  return {
    league: valueOf("--league"),
    item: valueOf("--item"),
    platform: valueOf("--platform"),
    hardcore: argv.includes("--hardcore"),
    dryRun: argv.includes("--dry-run"),
  };
}

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[g2g] ERRO: DATABASE_URL não definida.");
    process.exit(1);
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Preço unitário é da ordem de centavos — 4 casas ou o número vira 0,06. */
function usd(value: number): string {
  return `US$ ${value.toFixed(4)}`;
}

function report(result: Awaited<ReturnType<typeof collectG2gSnapshot>>): void {
  const { stats, league, g2gLeague, item, platform } = result;
  const discarded = stats.rawOfferCount - stats.offerCount;

  console.log(`[g2g] ${item} — ${league} (G2G: "${g2gLeague}", ${platform})`);
  console.log(
    `[g2g] mediana ${usd(stats.median)} | p25 ${usd(stats.p25)} | p75 ${usd(stats.p75)}`,
  );
  console.log(`[g2g] faixa ${usd(stats.min)} — ${usd(stats.max)}`);
  console.log(
    `[g2g] ${stats.offerCount} ofertas válidas de ${stats.rawOfferCount} ` +
      `(${discarded} descartadas como outlier), ${result.pagesFetched} página(s)`,
  );

  if (result.dryRun) {
    console.log("[g2g] --dry-run: nada gravado.");
    return;
  }
  console.log(`[g2g] snapshot ${result.snapshotId} gravado.`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const prisma = createPrisma();

  try {
    const result = await collectG2gSnapshot(prisma, args);
    report(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[g2g] coleta falhou: ${message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
