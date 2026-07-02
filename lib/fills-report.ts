// Agregações puras do log de Exchange para os relatórios. Sem I/O — testável.

export interface ReportFill {
  item: string;
  status: string;
  pnlChaos: number | null;
  pnlDiv: number | null;
  sellFilledAt: Date | null;
}

export interface FillReport {
  totals: {
    closed: number;
    open: number;
    holding: number;
    cancelled: number;
    pnlChaos: number;
    pnlDiv: number;
    winRate: number | null; // fração de fechados com lucro (0..1)
    avgPnlChaos: number | null; // PnL chaos médio por trade fechado
  };
  byItem: { item: string; trades: number; pnlChaos: number; pnlDiv: number }[];
  byDay: { day: string; pnlChaos: number; pnlDiv: number; trades: number }[];
}

function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function computeFillReport(fills: ReportFill[]): FillReport {
  const closed = fills.filter((f) => f.status === "closed");
  const pnlChaos = sum(closed.map((f) => f.pnlChaos ?? 0));
  const pnlDiv = sum(closed.map((f) => f.pnlDiv ?? 0));
  const wins = closed.filter((f) => (f.pnlChaos ?? 0) > 0 || (f.pnlDiv ?? 0) > 0).length;

  return {
    totals: {
      closed: closed.length,
      open: fills.filter((f) => f.status === "open").length,
      holding: fills.filter((f) => f.status === "holding").length,
      cancelled: fills.filter((f) => f.status === "cancelled").length,
      pnlChaos,
      pnlDiv,
      winRate: closed.length ? wins / closed.length : null,
      avgPnlChaos: closed.length ? pnlChaos / closed.length : null,
    },
    byItem: aggregateByItem(fills),
    byDay: aggregateByDay(closed),
  };
}

function aggregateByItem(fills: ReportFill[]): FillReport["byItem"] {
  const map = new Map<string, { trades: number; pnlChaos: number; pnlDiv: number }>();
  for (const f of fills) {
    const e = map.get(f.item) ?? { trades: 0, pnlChaos: 0, pnlDiv: 0 };
    if (f.status === "closed") e.trades += 1;
    e.pnlChaos += f.pnlChaos ?? 0;
    e.pnlDiv += f.pnlDiv ?? 0;
    map.set(f.item, e);
  }
  return [...map.entries()]
    .map(([item, e]) => ({ item, ...e }))
    .sort((a, b) => b.pnlChaos - a.pnlChaos);
}

function aggregateByDay(closed: ReportFill[]): FillReport["byDay"] {
  const map = new Map<string, { pnlChaos: number; pnlDiv: number; trades: number }>();
  for (const f of closed) {
    if (!f.sellFilledAt) continue;
    const day = localDay(f.sellFilledAt);
    const e = map.get(day) ?? { pnlChaos: 0, pnlDiv: 0, trades: 0 };
    e.pnlChaos += f.pnlChaos ?? 0;
    e.pnlDiv += f.pnlDiv ?? 0;
    e.trades += 1;
    map.set(day, e);
  }
  return [...map.entries()]
    .map(([day, e]) => ({ day, ...e }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
