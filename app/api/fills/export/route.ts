import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildFillsWorkbook, type FillExportRow } from "@/lib/xlsx";

const num = (v: unknown) => (v == null ? null : Number(v));

// Exporta os fills (respeitando os filtros da tabela) como .xlsx.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const where: Record<string, unknown> = {};
  const league = searchParams.get("league");
  const item = searchParams.get("item");
  const status = searchParams.get("status");
  const mode = searchParams.get("mode");
  if (league) where.league = league;
  if (item) where.item = item;
  if (status) where.status = status;
  if (mode) where.mode = mode;

  const fills = await prisma.fill.findMany({ where, orderBy: { buyPostedAt: "desc" } });

  const rows: FillExportRow[] = fills.map((f) => ({
    item: f.item,
    base: f.base,
    mode: f.mode,
    status: f.status,
    buyRatio: num(f.buyRatio),
    buyQty: num(f.buyQty),
    buyPostedAt: f.buyPostedAt,
    buyFilledAt: f.buyFilledAt,
    sellRatio: num(f.sellRatio),
    sellQty: num(f.sellQty),
    sellFilledAt: f.sellFilledAt,
    buyQAhead: num(f.buyQAhead),
    sellQAhead: num(f.sellQAhead),
    fairAtEntry: num(f.fairAtEntry),
    pnlChaos: num(f.pnlChaos),
    pnlDiv: num(f.pnlDiv),
    league: f.league,
    source: f.source,
    notes: f.notes,
  }));

  const buffer = await buildFillsWorkbook(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="exchange-fills-${stamp}.xlsx"`,
    },
  });
}
