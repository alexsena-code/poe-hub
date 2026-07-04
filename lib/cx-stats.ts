import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeFillReport, type FillReport } from "@/lib/fills-report";

// Camada de dados da página de STATS do CX (substitui o Grafana aposentado).
// Server-only: as funções consultam o Postgres via Prisma DIRETO (sem self-fetch
// HTTP — o fallback quebra no deploy). Cada função é a fonte de uma seção da tela.

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- Executores (cx_executor) --------------------------------------------

export interface CxExecutorStat {
  executorId: string;
  pcName: string | null;
  league: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  pendingJobs: number;
}

/** Executores registrados + contagem de jobs pendentes (mesma lógica da API /api/cx/executors). */
export async function getCxExecutorStats(): Promise<CxExecutorStat[]> {
  const [executors, pending] = await Promise.all([
    prisma.cxExecutor.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.cxJob.groupBy({ by: ["executorId"], where: { status: "pending" }, _count: { _all: true } }),
  ]);
  const pendingByExec = new Map(pending.map((p) => [p.executorId, p._count._all]));
  return executors.map((e) => ({
    executorId: e.executorId,
    pcName: e.pcName,
    league: e.league,
    isOnline: e.isOnline,
    lastSeen: e.lastSeen ? e.lastSeen.toISOString() : null,
    pendingJobs: pendingByExec.get(e.executorId) ?? 0,
  }));
}

// ---- Fills (cx_fills): PnL realizado, velocidade, últimos ----------------

export interface RecentFill {
  id: string;
  item: string;
  base: string;
  status: string;
  buyRatio: number | null;
  sellRatio: number | null;
  qty: number | null;
  pnlChaos: number | null;
  pnlDiv: number | null;
  at: string | null;
}

export interface FillStats {
  report: FillReport;
  byDay: FillReport["byDay"]; // últimos 14 dias
  closedLast7: number;
  fillsPerDay: number;
  recent: RecentFill[];
}

/** Soma dos closed trades por dia dentro da janela (por data de calendário, não por índice). */
function tradesSince(byDay: FillReport["byDay"], days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = localDay(cutoff);
  return byDay.filter((d) => d.day >= cutoffStr).reduce((a, d) => a + d.trades, 0);
}

export async function getFillStats(league?: string): Promise<FillStats> {
  const where = league ? { league } : {};
  const [all, recentRows] = await Promise.all([
    prisma.fill.findMany({
      where,
      select: { item: true, status: true, pnlChaos: true, pnlDiv: true, sellFilledAt: true },
    }),
    prisma.fill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, item: true, base: true, status: true,
        buyRatio: true, sellRatio: true, buyQty: true, sellQty: true,
        pnlChaos: true, pnlDiv: true, buyPostedAt: true, sellFilledAt: true,
      },
    }),
  ]);

  const report = computeFillReport(
    all.map((f) => ({
      item: f.item,
      status: f.status,
      pnlChaos: num(f.pnlChaos),
      pnlDiv: num(f.pnlDiv),
      sellFilledAt: f.sellFilledAt,
    }))
  );
  const closedLast7 = tradesSince(report.byDay, 7);

  return {
    report,
    byDay: report.byDay.slice(-14),
    closedLast7,
    fillsPerDay: Math.round((closedLast7 / 7) * 10) / 10,
    recent: recentRows.map((f) => ({
      id: f.id,
      item: f.item,
      base: f.base,
      status: f.status,
      buyRatio: num(f.buyRatio),
      sellRatio: num(f.sellRatio),
      qty: num(f.sellQty ?? f.buyQty),
      pnlChaos: num(f.pnlChaos),
      pnlDiv: num(f.pnlDiv),
      at: (f.sellFilledAt ?? f.buyPostedAt)?.toISOString() ?? null,
    })),
  };
}

// ---- Plano atual (cx_order_plan): tabela do worker, lida por $queryRaw -----

export interface PlanOrder {
  priority: number;
  item: string;
  base: string;
  league: string;
  buyRatio: number;
  sellRatio: number;
  qty: number;
  expProfitDiv: number | null;
  pFill: number | null;
  slotClass: string;
}

interface PlanRawRow {
  league: string;
  item: string;
  base: string;
  buy_ratio: unknown;
  sell_ratio: unknown;
  qty: unknown;
  exp_profit_div: unknown;
  p_fill: unknown;
  priority: unknown;
  slot_class: string | null;
}

/**
 * Top ordens ativas do plano. cx_order_plan é tabela do worker cxw (NÃO é model
 * Prisma) -> $queryRaw parametrizado. Se a tabela não existir (worker nunca rodou
 * naquele ambiente) devolve lista vazia em vez de derrubar a página.
 */
export async function getPlanOrders(league?: string, limit = 20): Promise<PlanOrder[]> {
  try {
    const rows = league
      ? await prisma.$queryRaw<PlanRawRow[]>(Prisma.sql`
          select league, item, base, buy_ratio, sell_ratio, qty, exp_profit_div, p_fill, priority, slot_class
          from cx_order_plan where league = ${league} order by priority limit ${limit}`)
      : await prisma.$queryRaw<PlanRawRow[]>(Prisma.sql`
          select league, item, base, buy_ratio, sell_ratio, qty, exp_profit_div, p_fill, priority, slot_class
          from cx_order_plan order by priority limit ${limit}`);
    return rows.map((r) => ({
      priority: Number(r.priority),
      item: r.item,
      base: r.base,
      league: r.league,
      buyRatio: Number(r.buy_ratio),
      sellRatio: Number(r.sell_ratio),
      qty: Number(r.qty),
      expProfitDiv: r.exp_profit_div == null ? null : Number(r.exp_profit_div),
      pFill: r.p_fill == null ? null : Number(r.p_fill),
      slotClass: r.slot_class ?? "-",
    }));
  } catch {
    return [];
  }
}

// ---- Sinais (cx_signal): contagem por liga + frescor ---------------------

export interface SignalFreshness {
  league: string;
  count: number;
  lastCapturedAt: string | null;
}

/** Quantos sinais por liga e quando foi a captura mais recente (frescor do worker). */
export async function getSignalFreshness(): Promise<SignalFreshness[]> {
  const rows = await prisma.cxSignal.groupBy({
    by: ["league"],
    _count: { _all: true },
    _max: { capturedAt: true },
  });
  return rows
    .map((r) => ({
      league: r.league,
      count: r._count._all,
      lastCapturedAt: r._max.capturedAt ? r._max.capturedAt.toISOString() : null,
    }))
    .sort((a, b) => b.count - a.count);
}
