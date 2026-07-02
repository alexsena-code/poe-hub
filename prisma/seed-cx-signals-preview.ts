// Preview das tabelas de sinais de câmbio (cx_signal / cx_arb / cx_market_hourly
// / cx_book_level). Mantém a Uja de Sinais populada até o worker cxw publicar
// dados reais. Limpe com: npx tsx prisma/seed-cx-signals-preview.ts --clean
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const LEAGUE = "Ancestors";

type Sig = { item: string; conf: string; [k: string]: number | boolean | null | string };
const S = (item: string, conf: string, o: Record<string, number | boolean | null>): Sig => ({ item, conf, ...o });

const SIGNALS: Sig[] = [
  S("Orb of Annulment", "ok", { bid: 7, ask: 8, spreadPct: 14.3, mmBuy: 6, mmSell: 9, mmSpreadPct: 50, capDiv: 6.9, fairVamp: 7.5, obi: 0.18, slipPct: 2.1, halfLifeH: 31, driftDay: -0.8, volPct: 4.9, kelly: 0.12, markoutPct: 1.2, liqPerH: 5606, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.7, qAheadBuy: 612, qAheadSell: 155 }),
  S("Gemcutter's Prism", "ok", { bid: 2.3, ask: 2.5, spreadPct: 8.7, mmBuy: 2.3, mmSell: 2.5, mmSpreadPct: 8.7, capDiv: 1.5, fairVamp: 2.4, obi: 0.05, slipPct: 0.8, halfLifeH: 44, driftDay: 0.2, volPct: 2.1, kelly: 0.06, markoutPct: 0.6, liqPerH: 13920, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.1, qAheadBuy: 40, qAheadSell: 20 }),
  S("Orb of Scouring", "ok", { bid: 0.34, ask: 0.45, spreadPct: 32.4, mmBuy: 0.33, mmSell: 0.45, mmSpreadPct: 36.4, capDiv: 1.9, fairVamp: 0.39, obi: -0.1, slipPct: 3, halfLifeH: 20, driftDay: -0.3, volPct: 6, kelly: 0.08, markoutPct: 1.5, liqPerH: 4939, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.3, qAheadBuy: 200, qAheadSell: 80 }),
  S("Silver Coin", "ok", { bid: 0.3, ask: 0.33, spreadPct: 10, mmBuy: 0.29, mmSell: 0.35, mmSpreadPct: 22.5, capDiv: 0.6, fairVamp: 0.32, obi: 0.22, slipPct: 1.1, halfLifeH: 28, driftDay: 0.1, volPct: 3.5, kelly: 0.05, markoutPct: 0.9, liqPerH: 3121, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.4, qAheadBuy: 348, qAheadSell: 40, cxapiLo: 0.2, cxapiHi: 0.4, cxapiOk: true }),
  S("Essence of Horror", "fina", { bid: 21, ask: 25, spreadPct: 19, mmBuy: 21, mmSell: 28, mmSpreadPct: 33.3, capDiv: 3.5, fairVamp: 23, obi: 0, slipPct: 2.5, halfLifeH: 36, driftDay: -1.1, volPct: 7.2, kelly: 0.04, markoutPct: 2, liqPerH: 1662, pFillBuy: 1, pFillSell: 1, pRoundtrip: 1, eTFillH: 0.4, qAheadBuy: 51, qAheadSell: 51, cxapiLo: 11, cxapiHi: 15, cxapiOk: false }),
  S("Prismatic Oil", "fina", { bid: 310, ask: 400, spreadPct: 29, mmBuy: 310, mmSell: 400, mmSpreadPct: 29, capDiv: 3, fairVamp: 355, obi: -0.05, slipPct: 4, halfLifeH: 50, driftDay: 0.5, volPct: 3, kelly: 0.03, markoutPct: 1.8, liqPerH: 1365, pFillBuy: 0.9, pFillSell: 0.9, pRoundtrip: 0.81, eTFillH: 2, qAheadBuy: 6, qAheadSell: 6, cxapiLo: 380, cxapiHi: 384, cxapiOk: true }),
  S("Faceted Fossil", "fina", { bid: 80, ask: 170, spreadPct: 112.5, mmBuy: 80, mmSell: 170, mmSpreadPct: 112.5, capDiv: 2.5, fairVamp: 120, obi: 0.3, slipPct: 8, halfLifeH: 24, driftDay: -2, volPct: 12, kelly: 0, markoutPct: 4, liqPerH: 210, pFillBuy: 0.86, pFillSell: 0.86, pRoundtrip: 0.74, eTFillH: 6, qAheadBuy: 0, qAheadSell: 0, cxapiLo: 78, cxapiHi: 78, cxapiOk: false }),
  S("Lucent Fossil", "fina", { bid: 3, ask: 9, spreadPct: 200, mmBuy: 3, mmSell: 10, mmSpreadPct: 233.3, capDiv: 7, fairVamp: 5, obi: 0.1, slipPct: 6, halfLifeH: 18, driftDay: -0.5, volPct: 9, kelly: 0, markoutPct: 3.5, liqPerH: 22, pFillBuy: 1, pFillSell: 0.9, pRoundtrip: 0.9, eTFillH: 0.6, qAheadBuy: 5, qAheadSell: 5, cxapiLo: 3, cxapiHi: 8, cxapiOk: true }),
];

const ARB = [
  { item: "Orb of Annulment", priceChaos: 8, priceViaDivine: 8.6, discPct: 7.5, grainPct: 2, edgePct: 5.5, volDivine: 90, conf: "ALTA" },
  { item: "Exalted Orb", priceChaos: 42, priceViaDivine: 45, discPct: 7.1, grainPct: 3, edgePct: 4.1, volDivine: 210, conf: "ALTA" },
  { item: "Gemcutter's Prism", priceChaos: 2.5, priceViaDivine: 2.55, discPct: 2, grainPct: 2.5, edgePct: -0.5, volDivine: 60, conf: "baixa" },
  { item: "Prismatic Oil", priceChaos: 400, priceViaDivine: 415, discPct: 3.8, grainPct: 4, edgePct: -0.2, volDivine: 30, conf: "baixa" },
];

const BOOK = {
  ask: [[8, 21], [8.8, 30], [9, 104], [10, 520], [11, 4]],
  bid: [[7, 3], [6.5, 22], [6, 587], [5.5, 100], [1, 6]],
} as const;

async function main() {
  if (process.argv.includes("--clean")) {
    for (const t of [prisma.cxSignal, prisma.cxArb, prisma.cxMarketHourly, prisma.cxBookLevel]) {
      // @ts-expect-error delegate uniforme
      await t.deleteMany({});
    }
    console.log("Tabelas de sinais limpas.");
    return;
  }

  const now = new Date();
  for (const s of SIGNALS) {
    const item = s.item;
    await prisma.cxSignal.create({
      data: { league: LEAGUE, base: "Chaos Orb", capturedAt: now, ...s } as Prisma.CxSignalUncheckedCreateInput,
    });

    // série horária (48h) baseada no fair
    const mid = (s.fairVamp as number) ?? (s.ask as number) ?? 10;
    const rows = Array.from({ length: 48 }, (_, i) => {
      const wave = Math.sin(i / 6) * mid * 0.04 + Math.cos(i / 11) * mid * 0.02;
      return {
        league: LEAGUE, item, ts: new Date(now.getTime() - (48 - i) * 3600 * 1000),
        price: Math.round((mid + wave) * 100) / 100,
        volume: Math.round(500 + 400 * Math.abs(Math.sin(i / 4)) + (i % 5) * 30),
      };
    });
    await prisma.cxMarketHourly.createMany({ data: rows });

    // book (mesma escada de exemplo p/ todos)
    const levels = [
      ...BOOK.ask.map(([price, qty]) => ({ league: LEAGUE, item, side: "ask", price, qty, capturedAt: now })),
      ...BOOK.bid.map(([price, qty]) => ({ league: LEAGUE, item, side: "bid", price, qty, capturedAt: now })),
    ];
    await prisma.cxBookLevel.createMany({ data: levels });
  }

  await prisma.cxArb.createMany({ data: ARB.map((a) => ({ league: LEAGUE, capturedAt: now, ...a })) });
  console.log(`Preview inserido: ${SIGNALS.length} sinais, ${ARB.length} arb, séries + book.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
