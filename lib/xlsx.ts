import ExcelJS from "exceljs";

// Interface fina sobre o exceljs (regra de dependências do CLAUDE.md).
// Gera um .xlsx a partir de linhas já normalizadas (números/datas puros).

export interface FillExportRow {
  item: string;
  base: string;
  mode: string;
  status: string;
  buyRatio: number | null;
  buyQty: number | null;
  buyPostedAt: Date | null;
  buyFilledAt: Date | null;
  sellRatio: number | null;
  sellQty: number | null;
  sellFilledAt: Date | null;
  buyQAhead: number | null;
  sellQAhead: number | null;
  fairAtEntry: number | null;
  pnlChaos: number | null;
  pnlDiv: number | null;
  league: string;
  source: string;
  notes: string | null;
}

const COLUMNS: { header: string; key: keyof FillExportRow; width: number }[] = [
  { header: "Item", key: "item", width: 26 },
  { header: "Base", key: "base", width: 12 },
  { header: "Modo", key: "mode", width: 8 },
  { header: "Status", key: "status", width: 10 },
  { header: "Compra (base/un)", key: "buyRatio", width: 16 },
  { header: "Qtd compra", key: "buyQty", width: 12 },
  { header: "Entrada", key: "buyPostedAt", width: 18 },
  { header: "Compra encheu", key: "buyFilledAt", width: 18 },
  { header: "Venda (base/un)", key: "sellRatio", width: 16 },
  { header: "Qtd venda", key: "sellQty", width: 12 },
  { header: "Venda encheu (saída)", key: "sellFilledAt", width: 18 },
  { header: "Fila compra", key: "buyQAhead", width: 12 },
  { header: "Fila venda", key: "sellQAhead", width: 12 },
  { header: "Fair na entrada", key: "fairAtEntry", width: 14 },
  { header: "PnL chaos", key: "pnlChaos", width: 12 },
  { header: "PnL divine", key: "pnlDiv", width: 12 },
  { header: "Liga", key: "league", width: 16 },
  { header: "Origem", key: "source", width: 8 },
  { header: "Notas", key: "notes", width: 30 },
];

export async function buildFillsWorkbook(rows: FillExportRow[]): Promise<Buffer> {
  return sheetToBuffer("Exchange", COLUMNS, rows);
}

// Sinais de mercado (Tier 1 + fill-prob). Shape independente do provider (mock/real).
export interface SignalExportRow {
  item: string;
  conf: string;
  bid: number | null;
  ask: number | null;
  spreadPct: number | null;
  mmBuy: number | null;
  mmSell: number | null;
  mmSpreadPct: number | null;
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
  capDiv: number | null;
  cxapiLo: number | null;
  cxapiHi: number | null;
  league: string;
}

const SIGNAL_COLUMNS: { header: string; key: keyof SignalExportRow; width: number }[] = [
  { header: "Item", key: "item", width: 26 },
  { header: "Conf", key: "conf", width: 8 },
  { header: "Bid", key: "bid", width: 10 },
  { header: "Ask", key: "ask", width: 10 },
  { header: "Spread %", key: "spreadPct", width: 10 },
  { header: "MM buy", key: "mmBuy", width: 10 },
  { header: "MM sell", key: "mmSell", width: 10 },
  { header: "MM spread %", key: "mmSpreadPct", width: 12 },
  { header: "VAMP (fair)", key: "fairVamp", width: 12 },
  { header: "OBI", key: "obi", width: 8 },
  { header: "Slip %", key: "slipPct", width: 8 },
  { header: "Meia-vida (h)", key: "halfLifeH", width: 12 },
  { header: "Drift %/dia", key: "driftDay", width: 12 },
  { header: "Vol %/h", key: "volPct", width: 10 },
  { header: "Kelly", key: "kelly", width: 8 },
  { header: "Markout %", key: "markoutPct", width: 10 },
  { header: "Liq/h", key: "liqPerH", width: 10 },
  { header: "P(fill buy)", key: "pFillBuy", width: 10 },
  { header: "P(fill sell)", key: "pFillSell", width: 10 },
  { header: "P(round-trip)", key: "pRoundtrip", width: 12 },
  { header: "E[T] fill (h)", key: "eTFillH", width: 12 },
  { header: "Cap (div)", key: "capDiv", width: 10 },
  { header: "cxapi lo", key: "cxapiLo", width: 10 },
  { header: "cxapi hi", key: "cxapiHi", width: 10 },
  { header: "Liga", key: "league", width: 16 },
];

export async function buildSignalsWorkbook(rows: SignalExportRow[]): Promise<Buffer> {
  return sheetToBuffer("Sinais", SIGNAL_COLUMNS, rows);
}

async function sheetToBuffer<T extends object>(
  name: string,
  cols: { header: string; key: keyof T; width: number }[],
  rows: T[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PoE Hub — Câmbio";
  const ws = wb.addWorksheet(name);
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key as string, width: c.width }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
