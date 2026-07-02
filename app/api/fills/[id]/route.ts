import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateFillSchema } from "@/lib/validations/fill";
import { deriveStatus, derivePnl } from "@/lib/fills";

type Params = { params: Promise<{ id: string }> };
const num = (v: unknown) => (v == null ? null : Number(v));

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const fill = await prisma.fill.findUnique({
    where: { id },
    include: { botInstance: { select: { id: true, pcName: true } } },
  });
  if (!fill) return NextResponse.json({ error: "Fill not found" }, { status: 404 });
  return NextResponse.json(fill);
}

// PATCH = atualização parcial (ex.: "marcar vendido" preenche a perna de venda).
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.fill.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Fill not found" }, { status: 404 });

  const body = await request.json();
  const parsed = updateFillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const upd: Record<string, unknown> = {};

  if (d.league !== undefined) upd.league = d.league;
  if (d.item !== undefined) upd.item = d.item;
  if (d.base !== undefined) upd.base = d.base;
  if (d.mode !== undefined) upd.mode = d.mode;
  if (d.source !== undefined) upd.source = d.source;
  if (d.buyRatio !== undefined) upd.buyRatio = d.buyRatio ?? null;
  if (d.buyQty !== undefined) upd.buyQty = d.buyQty ?? null;
  if (d.buyPostedAt !== undefined) upd.buyPostedAt = d.buyPostedAt ? new Date(d.buyPostedAt) : null;
  if (d.buyFilledAt !== undefined) upd.buyFilledAt = d.buyFilledAt ? new Date(d.buyFilledAt) : null;
  if (d.buyQAhead !== undefined) upd.buyQAhead = d.buyQAhead ?? null;
  if (d.sellRatio !== undefined) upd.sellRatio = d.sellRatio ?? null;
  if (d.sellQty !== undefined) upd.sellQty = d.sellQty ?? null;
  if (d.sellPostedAt !== undefined) upd.sellPostedAt = d.sellPostedAt ? new Date(d.sellPostedAt) : null;
  if (d.sellFilledAt !== undefined) upd.sellFilledAt = d.sellFilledAt ? new Date(d.sellFilledAt) : null;
  if (d.sellQAhead !== undefined) upd.sellQAhead = d.sellQAhead ?? null;
  if (d.fairAtEntry !== undefined) upd.fairAtEntry = d.fairAtEntry ?? null;
  if (d.botInstanceId !== undefined) upd.botInstanceId = d.botInstanceId ?? null;
  if (d.notes !== undefined) upd.notes = d.notes ?? null;

  // Estado derivado a partir da fusão do que existe + o que mudou.
  const legs = {
    base: (upd.base as string) ?? existing.base,
    buyRatio: d.buyRatio !== undefined ? d.buyRatio ?? null : num(existing.buyRatio),
    buyQty: d.buyQty !== undefined ? d.buyQty ?? null : num(existing.buyQty),
    buyFilledAt: (upd.buyFilledAt as Date | null) ?? existing.buyFilledAt,
    sellRatio: d.sellRatio !== undefined ? d.sellRatio ?? null : num(existing.sellRatio),
    sellQty: d.sellQty !== undefined ? d.sellQty ?? null : num(existing.sellQty),
    sellFilledAt: (upd.sellFilledAt as Date | null) ?? existing.sellFilledAt,
  };
  // status: respeita se veio explícito (ex.: cancelled), senão deriva.
  upd.status = d.status ?? (existing.status === "cancelled" ? "cancelled" : deriveStatus(legs));
  // pnl: recalcula salvo se veio explícito.
  const pnl = derivePnl(legs);
  if (d.pnlChaos !== undefined) upd.pnlChaos = d.pnlChaos ?? null;
  else if (pnl.pnlChaos !== null) upd.pnlChaos = pnl.pnlChaos;
  if (d.pnlDiv !== undefined) upd.pnlDiv = d.pnlDiv ?? null;
  else if (pnl.pnlDiv !== null) upd.pnlDiv = pnl.pnlDiv;

  const fill = await prisma.fill.update({
    where: { id },
    data: upd,
    include: { botInstance: { select: { id: true, pcName: true } } },
  });
  return NextResponse.json(fill);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.fill.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Fill not found" }, { status: 404 });
  await prisma.fill.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
