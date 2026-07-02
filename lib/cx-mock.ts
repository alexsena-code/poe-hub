// PONTO DE TROCA (mock -> real). As telas de Sinais (Câmbio) consomem só estas
// funções. Na Fase 2, trocar o corpo por queries Prisma no Postgres (cx_signal,
// cx_market_hourly, cx_book) — os TIPOS abaixo já são o contrato do dado real.
// Números de exemplo derivados do output real do `mmband`/`flip2` (liga Ancestors).

export interface CxSignal {
  item: string;
  base: string;
  league: string;
  // book
  bid: number | null;
  ask: number | null;
  spreadPct: number | null;
  mmBuy: number | null; // rung executável (banda + quantização)
  mmSell: number | null;
  mmSpreadPct: number | null;
  capDiv: number | null; // capacidade em divine
  // Tier 1
  fairVamp: number | null;
  obi: number | null; // -1..1, >0 = pressão de compra
  slipPct: number | null;
  halfLifeH: number | null;
  driftDay: number | null; // %/dia
  volPct: number | null; // %/h
  kelly: number | null; // fração 0..1
  markoutPct: number | null;
  liqPerH: number | null; // itens executados/h (cxapi)
  // fill-prob v0.1
  pFillBuy: number | null;
  pFillSell: number | null;
  pRoundtrip: number | null;
  eTFillH: number | null; // horas p/ encher a perna que trava
  qAheadBuy: number | null;
  qAheadSell: number | null;
  // validação cxapi + confiança
  cxapiLo: number | null;
  cxapiHi: number | null;
  cxapiOk: boolean | null;
  conf: "ok" | "fina" | "baixa";
  capturedAt: string; // ISO
}

export interface ArbRow {
  item: string;
  priceChaos: number; // preço direto (chaos/item)
  priceViaDivine: number; // preço via divine
  discPct: number; // discrepância %
  grainPct: number; // grão (ruído/quantização do mercado divine)
  edgePct: number; // disc que excede o grão
  volDivine: number;
  conf: "ALTA" | "media" | "baixa";
}

export interface ItemDetail {
  signal: CxSignal;
  priceSeries: { t: string; price: number; volume: number }[];
  book: { asks: { price: number; qty: number }[]; bids: { price: number; qty: number }[] };
  fillCurve: { depthPct: number; pFill: number; eTH: number }[];
}

const NOW = "2026-07-02T13:00:00.000Z";

// Helper p/ montar um sinal sem repetir todos os campos
function sig(p: Partial<CxSignal> & Pick<CxSignal, "item" | "conf">): CxSignal {
  return {
    base: "Chaos Orb", league: "Ancestors", capturedAt: NOW,
    bid: null, ask: null, spreadPct: null, mmBuy: null, mmSell: null, mmSpreadPct: null, capDiv: null,
    fairVamp: null, obi: null, slipPct: null, halfLifeH: null, driftDay: null, volPct: null,
    kelly: null, markoutPct: null, liqPerH: null,
    pFillBuy: null, pFillSell: null, pRoundtrip: null, eTFillH: null, qAheadBuy: null, qAheadSell: null,
    cxapiLo: null, cxapiHi: null, cxapiOk: null,
    ...p,
  };
}

const SIGNALS: CxSignal[] = [
  sig({ item: "Orb of Annulment", bid: 7, ask: 8, spreadPct: 14.3, mmBuy: 6, mmSell: 9, mmSpreadPct: 50,
    capDiv: 6.9, fairVamp: 7.5, obi: 0.18, slipPct: 2.1, halfLifeH: 31, driftDay: -0.8, volPct: 4.9,
    kelly: 0.12, markoutPct: 1.2, liqPerH: 5606, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.7,
    qAheadBuy: 612, qAheadSell: 155, conf: "ok" }),
  sig({ item: "Gemcutter's Prism", bid: 2.3, ask: 2.5, spreadPct: 8.7, mmBuy: 2.3, mmSell: 2.5, mmSpreadPct: 8.7,
    capDiv: 1.5, fairVamp: 2.4, obi: 0.05, slipPct: 0.8, halfLifeH: 44, driftDay: 0.2, volPct: 2.1,
    kelly: 0.06, markoutPct: 0.6, liqPerH: 13920, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.1,
    qAheadBuy: 40, qAheadSell: 20, conf: "ok" }),
  sig({ item: "Orb of Scouring", bid: 0.34, ask: 0.45, spreadPct: 32.4, mmBuy: 0.33, mmSell: 0.45, mmSpreadPct: 36.4,
    capDiv: 1.9, fairVamp: 0.39, obi: -0.1, slipPct: 3.0, halfLifeH: 20, driftDay: -0.3, volPct: 6.0,
    kelly: 0.08, markoutPct: 1.5, liqPerH: 4939, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.3,
    qAheadBuy: 200, qAheadSell: 80, conf: "ok" }),
  sig({ item: "Silver Coin", bid: 0.3, ask: 0.33, spreadPct: 10, mmBuy: 0.29, mmSell: 0.35, mmSpreadPct: 22.5,
    capDiv: 0.6, fairVamp: 0.32, obi: 0.22, slipPct: 1.1, halfLifeH: 28, driftDay: 0.1, volPct: 3.5,
    kelly: 0.05, markoutPct: 0.9, liqPerH: 3121, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.4,
    qAheadBuy: 348, qAheadSell: 40, cxapiLo: 0.2, cxapiHi: 0.4, cxapiOk: true, conf: "ok" }),
  sig({ item: "Essence of Horror", bid: 21, ask: 25, spreadPct: 19, mmBuy: 21, mmSell: 28, mmSpreadPct: 33.3,
    capDiv: 3.5, fairVamp: 23, obi: 0.0, slipPct: 2.5, halfLifeH: 36, driftDay: -1.1, volPct: 7.2,
    kelly: 0.04, markoutPct: 2.0, liqPerH: 1662, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.4,
    qAheadBuy: 51, qAheadSell: 51, cxapiLo: 11, cxapiHi: 15, cxapiOk: false, conf: "fina" }),
  sig({ item: "Prismatic Oil", bid: 310, ask: 400, spreadPct: 29, mmBuy: 310, mmSell: 400, mmSpreadPct: 29,
    capDiv: 3.0, fairVamp: 355, obi: -0.05, slipPct: 4.0, halfLifeH: 50, driftDay: 0.5, volPct: 3.0,
    kelly: 0.03, markoutPct: 1.8, liqPerH: 1365, pFillBuy: 0.9, pFillSell: 0.9, pRoundtrip: 0.81, eTFillH: 2.0,
    qAheadBuy: 6, qAheadSell: 6, cxapiLo: 380, cxapiHi: 384, cxapiOk: true, conf: "fina" }),
  sig({ item: "Faceted Fossil", bid: 80, ask: 170, spreadPct: 112.5, mmBuy: 80, mmSell: 170, mmSpreadPct: 112.5,
    capDiv: 2.5, fairVamp: 120, obi: 0.3, slipPct: 8.0, halfLifeH: 24, driftDay: -2.0, volPct: 12.0,
    kelly: 0.0, markoutPct: 4.0, liqPerH: 210, pFillBuy: 0.86, pFillSell: 0.86, pRoundtrip: 0.74, eTFillH: 6.0,
    qAheadBuy: 0, qAheadSell: 0, cxapiLo: 78, cxapiHi: 78, cxapiOk: false, conf: "fina" }),
  sig({ item: "Lucent Fossil", bid: 3, ask: 9, spreadPct: 200, mmBuy: 3, mmSell: 10, mmSpreadPct: 233.3,
    capDiv: 7.0, fairVamp: 5, obi: 0.1, slipPct: 6.0, halfLifeH: 18, driftDay: -0.5, volPct: 9.0,
    kelly: 0.0, markoutPct: 3.5, liqPerH: 22, pFillBuy: 1, pFillSell: 0.9, pRoundtrip: 0.9, eTFillH: 0.6,
    qAheadBuy: 5, qAheadSell: 5, cxapiLo: 3, cxapiHi: 8, cxapiOk: true, conf: "fina" }),
];

const ARB: ArbRow[] = [
  { item: "Orb of Annulment", priceChaos: 8.0, priceViaDivine: 8.6, discPct: 7.5, grainPct: 2.0, edgePct: 5.5, volDivine: 90, conf: "ALTA" },
  { item: "Exalted Orb", priceChaos: 42, priceViaDivine: 45, discPct: 7.1, grainPct: 3.0, edgePct: 4.1, volDivine: 210, conf: "ALTA" },
  { item: "Gemcutter's Prism", priceChaos: 2.5, priceViaDivine: 2.55, discPct: 2.0, grainPct: 2.5, edgePct: -0.5, volDivine: 60, conf: "baixa" },
  { item: "Prismatic Oil", priceChaos: 400, priceViaDivine: 415, discPct: 3.8, grainPct: 4.0, edgePct: -0.2, volDivine: 30, conf: "baixa" },
];

// Série de preço/volume horária de exemplo (chaos/item) p/ o detalhe
function fakeSeries(base: number, n = 48): { t: string; price: number; volume: number }[] {
  const out: { t: string; price: number; volume: number }[] = [];
  const start = Date.parse(NOW) - n * 3600 * 1000;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(i / 6) * base * 0.04 + Math.cos(i / 11) * base * 0.02;
    const price = Math.round((base + wave) * 100) / 100;
    const volume = Math.round(500 + 400 * Math.abs(Math.sin(i / 4)) + (i % 5) * 30);
    out.push({ t: new Date(start + i * 3600 * 1000).toISOString(), price, volume });
  }
  return out;
}

export function getSignals(): CxSignal[] {
  return SIGNALS;
}

export function getArb(): ArbRow[] {
  return ARB;
}

export function getItemDetail(item: string): ItemDetail | null {
  const signal = SIGNALS.find((s) => s.item.toLowerCase() === item.toLowerCase());
  if (!signal) return null;
  const mid = signal.fairVamp ?? signal.ask ?? 10;
  return {
    signal,
    priceSeries: fakeSeries(mid),
    book: {
      asks: [
        { price: 8, qty: 21 }, { price: 8.8, qty: 30 }, { price: 9, qty: 104 },
        { price: 10, qty: 520 }, { price: 11, qty: 4 },
      ],
      bids: [
        { price: 7, qty: 3 }, { price: 6.5, qty: 22 }, { price: 6, qty: 587 },
        { price: 5.5, qty: 100 }, { price: 1, qty: 6 },
      ],
    },
    fillCurve: [
      { depthPct: 0, pFill: 1.0, eTH: 0.1 },
      { depthPct: 5, pFill: 0.98, eTH: 0.3 },
      { depthPct: 12.5, pFill: 0.9, eTH: 0.7 },
      { depthPct: 25, pFill: 0.6, eTH: 2.5 },
      { depthPct: 40, pFill: 0.3, eTH: 8 },
    ],
  };
}
