import { prisma } from "@/lib/prisma";

// Provider REAL dos sinais de câmbio: lê o Postgres (tabelas alimentadas pelo
// worker cxw). Substitui o antigo lib/cx-mock.ts. As telas consomem só isto.
// Os tipos são o contrato entre o worker (Python) e a UI.

export interface CxSignal {
  item: string;
  base: string;
  league: string;
  bid: number | null;
  ask: number | null;
  spreadPct: number | null;
  mmBuy: number | null;
  mmSell: number | null;
  mmSpreadPct: number | null;
  capDiv: number | null;
  fairVamp: number | null;
  obi: number | null;
  slipPct: number | null;
  halfLifeH: number | null;
  driftDay: number | null;
  volPct: number | null;
  kelly: number | null;
  markoutPct: number | null;
  liqPerH: number | null;
  pFillBuy: number | null;
  pFillSell: number | null;
  pRoundtrip: number | null;
  eTFillH: number | null;
  qAheadBuy: number | null;
  qAheadSell: number | null;
  cxapiLo: number | null;
  cxapiHi: number | null;
  cxapiOk: boolean | null;
  conf: "ok" | "fina" | "baixa";
  capturedAt: string;
}

export interface ArbRow {
  item: string;
  priceChaos: number;
  priceViaDivine: number;
  discPct: number;
  grainPct: number;
  edgePct: number;
  volDivine: number;
  conf: "ALTA" | "media" | "baixa";
}

export interface ItemDetail {
  signal: CxSignal;
  priceSeries: { t: string; price: number; volume: number }[];
  book: { asks: { price: number; qty: number }[]; bids: { price: number; qty: number }[] };
  fillCurve: { depthPct: number; pFill: number; eTH: number }[];
}

type SignalRow = Awaited<ReturnType<typeof prisma.cxSignal.findFirst>>;

function toSignal(r: NonNullable<SignalRow>): CxSignal {
  return {
    item: r.item, base: r.base, league: r.league,
    bid: r.bid, ask: r.ask, spreadPct: r.spreadPct,
    mmBuy: r.mmBuy, mmSell: r.mmSell, mmSpreadPct: r.mmSpreadPct, capDiv: r.capDiv,
    fairVamp: r.fairVamp, obi: r.obi, slipPct: r.slipPct,
    halfLifeH: r.halfLifeH, driftDay: r.driftDay, volPct: r.volPct,
    kelly: r.kelly, markoutPct: r.markoutPct, liqPerH: r.liqPerH,
    pFillBuy: r.pFillBuy, pFillSell: r.pFillSell, pRoundtrip: r.pRoundtrip, eTFillH: r.eTFillH,
    qAheadBuy: r.qAheadBuy, qAheadSell: r.qAheadSell,
    cxapiLo: r.cxapiLo, cxapiHi: r.cxapiHi, cxapiOk: r.cxapiOk,
    conf: (r.conf as CxSignal["conf"]) ?? "baixa",
    capturedAt: r.capturedAt.toISOString(),
  };
}

// Último sinal por item (rodada mais recente).
export async function getSignals(league?: string): Promise<CxSignal[]> {
  const rows = await prisma.cxSignal.findMany({
    where: league ? { league } : {},
    orderBy: [{ item: "asc" }, { capturedAt: "desc" }],
    distinct: ["item"],
  });
  return rows.map(toSignal);
}

export async function getArb(league?: string): Promise<ArbRow[]> {
  const rows = await prisma.cxArb.findMany({
    where: league ? { league } : {},
    orderBy: [{ item: "asc" }, { capturedAt: "desc" }],
    distinct: ["item"],
  });
  return rows.map((r) => ({
    item: r.item, priceChaos: r.priceChaos, priceViaDivine: r.priceViaDivine,
    discPct: r.discPct, grainPct: r.grainPct, edgePct: r.edgePct, volDivine: r.volDivine,
    conf: (r.conf as ArbRow["conf"]) ?? "baixa",
  }));
}

export async function getItemDetail(item: string): Promise<ItemDetail | null> {
  const row = await prisma.cxSignal.findFirst({ where: { item }, orderBy: { capturedAt: "desc" } });
  if (!row) return null;
  const signal = toSignal(row);

  const series = await prisma.cxMarketHourly.findMany({ where: { item }, orderBy: { ts: "asc" } });
  const bookRows = await prisma.cxBookLevel.findMany({ where: { item }, orderBy: { capturedAt: "desc" } });
  const latest = bookRows[0]?.capturedAt.getTime();
  const book = bookRows.filter((b) => b.capturedAt.getTime() === latest);

  return {
    signal,
    priceSeries: series.map((s) => ({ t: s.ts.toISOString(), price: s.price, volume: s.volume })),
    book: {
      asks: book.filter((b) => b.side === "ask").sort((a, b) => a.price - b.price).map((b) => ({ price: b.price, qty: b.qty })),
      bids: book.filter((b) => b.side === "bid").sort((a, b) => b.price - a.price).map((b) => ({ price: b.price, qty: b.qty })),
    },
    fillCurve: buildFillCurve(signal),
  };
}

// Curva de fill-prob por profundidade derivada do sinal (heurística v0 até o
// worker publicar a curva calibrada). P cai e E[T] sobe com a profundidade.
function buildFillCurve(s: CxSignal): { depthPct: number; pFill: number; eTH: number }[] {
  const base = s.pRoundtrip ?? s.pFillSell ?? 1;
  const et0 = s.eTFillH ?? 0.5;
  return [0, 5, 12.5, 25, 40].map((d) => ({
    depthPct: d,
    pFill: Math.max(0, Math.min(1, base * Math.exp(-d / 25))),
    eTH: Math.round(et0 * Math.exp(d / 25) * 10) / 10,
  }));
}
