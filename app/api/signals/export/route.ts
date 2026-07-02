import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSignals } from "@/lib/cx-signals";
import { buildSignalsWorkbook, type SignalExportRow } from "@/lib/xlsx";

// Export dos sinais de mercado. Lê o provider (mock agora, Postgres na Fase 2).
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows: SignalExportRow[] = (await getSignals()).map((s) => ({
    item: s.item, conf: s.conf, bid: s.bid, ask: s.ask, spreadPct: s.spreadPct,
    mmBuy: s.mmBuy, mmSell: s.mmSell, mmSpreadPct: s.mmSpreadPct, fairVamp: s.fairVamp,
    obi: s.obi, slipPct: s.slipPct, halfLifeH: s.halfLifeH, driftDay: s.driftDay, volPct: s.volPct,
    kelly: s.kelly, markoutPct: s.markoutPct, liqPerH: s.liqPerH,
    pFillBuy: s.pFillBuy, pFillSell: s.pFillSell, pRoundtrip: s.pRoundtrip, eTFillH: s.eTFillH,
    capDiv: s.capDiv, cxapiLo: s.cxapiLo, cxapiHi: s.cxapiHi, league: s.league,
  }));

  const buffer = await buildSignalsWorkbook(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cambio-sinais-${stamp}.xlsx"`,
    },
  });
}
