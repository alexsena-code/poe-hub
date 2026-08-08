import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectG2gSnapshot } from "@/lib/g2g-collector";
import { collectG2gSnapshotSchema } from "@/lib/validations/g2g";

/**
 * Preço da concorrência no G2G.
 *
 * GET  — série de snapshots para o gráfico.
 * POST — dispara uma coleta agora (o mesmo caminho que o cron usa).
 *
 * A coleta é síncrona: são 2 chamadas HTTP ao G2G, ~2s no total. Não vale o
 * aparato de SSE que o scraper do Discord precisava.
 */

const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

type SnapshotRow = {
  id: string;
  collectedAt: Date;
  item: string;
  league: string;
  median: unknown;
  mean: unknown;
  min: unknown;
  max: unknown;
  p25: unknown;
  p75: unknown;
  offerCount: number;
  rawOfferCount: number;
};

/**
 * Compara o segredo sem vazar o ponto de divergência pelo tempo de resposta.
 *
 * `timingSafeEqual` exige buffers do mesmo tamanho e lança se diferirem, então o
 * tamanho é conferido antes — essa checagem já vaza o comprimento, o que é
 * aceitável e inevitável.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Aceita sessão de operador OU `Authorization: Bearer $CRON_SECRET`.
 *
 * O segundo caminho existe para a Scheduled Task do Coolify, que roda dentro do
 * container e não tem cookie de sessão. Sem `CRON_SECRET` no ambiente o caminho
 * fica desligado — um secret vazio jamais autentica.
 */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const expected = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (expected && header?.startsWith("Bearer ")) {
    if (secretMatches(header.slice(7), expected)) return true;
  }
  return Boolean(await getServerSession(authOptions));
}

/** Decimal do Prisma não serializa em JSON — converte tudo na fronteira. */
function toJsonSnapshot(row: SnapshotRow) {
  return {
    id: row.id,
    collectedAt: row.collectedAt.toISOString(),
    item: row.item,
    league: row.league,
    median: Number(row.median),
    mean: Number(row.mean),
    min: Number(row.min),
    max: Number(row.max),
    p25: Number(row.p25),
    p75: Number(row.p75),
    offerCount: row.offerCount,
    rawOfferCount: row.rawOfferCount,
  };
}

/**
 * Ausente vira o default; presente é preso na faixa [1, MAX_LIMIT].
 *
 * O teste `null` precisa vir antes do `Number()`: `Number(null)` é 0, que passa
 * no `isFinite` e seria espremido para 1 pelo clamp — a série inteira viraria
 * um ponto só quando o parâmetro não fosse informado.
 */
function clampLimit(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const item = searchParams.get("item") || "Divine Orb";
  const league = searchParams.get("league");
  const days = Number(searchParams.get("days")) || DEFAULT_DAYS;
  const limit = clampLimit(searchParams.get("limit"));

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = {
    item,
    collectedAt: { gte: since },
    ...(league ? { league } : {}),
  };

  const snapshots = await prisma.g2gPriceSnapshot.findMany({
    where,
    orderBy: { collectedAt: "desc" },
    take: limit,
  });

  const rows = snapshots.map(toJsonSnapshot);
  return NextResponse.json({
    item,
    league: league ?? null,
    days,
    // Ordem crescente é o que o gráfico consome; a query desce para respeitar o limite.
    data: [...rows].reverse(),
    latest: rows[0] ?? null,
    count: rows.length,
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = collectG2gSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await collectG2gSnapshot(prisma, parsed.data);
    return NextResponse.json(
      {
        snapshotId: result.snapshotId,
        league: result.league,
        g2gLeague: result.g2gLeague,
        item: result.item,
        platform: result.platform,
        dryRun: result.dryRun,
        stats: result.stats,
        cheapestSample: result.cheapestSample,
        pagesFetched: result.pagesFetched,
      },
      { status: result.dryRun ? 200 : 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`[prices.g2g] coleta falhou: ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
