import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFillSchema } from "@/lib/validations/fill";
import { deriveStatus, derivePnl } from "@/lib/fills";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const league = searchParams.get("league");
  const item = searchParams.get("item");
  const status = searchParams.get("status");
  const mode = searchParams.get("mode");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    where.buyPostedAt = dateFilter;
  }
  if (league) where.league = league;
  if (item) where.item = item;
  if (status) where.status = status;
  if (mode) where.mode = mode;
  if (search) {
    where.OR = [
      { item: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }

  const [fills, total] = await Promise.all([
    prisma.fill.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { buyPostedAt: "desc" },
      include: {
        botInstance: { select: { id: true, pcName: true } },
      },
    }),
    prisma.fill.count({ where }),
  ]);

  return NextResponse.json({
    data: fills,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createFillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // "Vou fazer essa order": se não veio a hora de entrada, assume agora.
  const buyPostedAt = d.buyPostedAt ? new Date(d.buyPostedAt) : new Date();

  const legs = {
    base: d.base,
    buyRatio: d.buyRatio ?? null,
    buyQty: d.buyQty ?? null,
    buyFilledAt: d.buyFilledAt ?? null,
    sellRatio: d.sellRatio ?? null,
    sellQty: d.sellQty ?? null,
    sellFilledAt: d.sellFilledAt ?? null,
  };
  const status = d.status ?? deriveStatus(legs);
  const pnl = derivePnl(legs);

  const fill = await prisma.fill.create({
    data: {
      league: d.league,
      item: d.item,
      base: d.base,
      mode: d.mode,
      source: d.source,
      status,
      buyRatio: d.buyRatio ?? null,
      buyQty: d.buyQty ?? null,
      buyPostedAt,
      buyFilledAt: d.buyFilledAt ? new Date(d.buyFilledAt) : null,
      buyQAhead: d.buyQAhead ?? null,
      sellRatio: d.sellRatio ?? null,
      sellQty: d.sellQty ?? null,
      sellPostedAt: d.sellPostedAt ? new Date(d.sellPostedAt) : null,
      sellFilledAt: d.sellFilledAt ? new Date(d.sellFilledAt) : null,
      sellQAhead: d.sellQAhead ?? null,
      fairAtEntry: d.fairAtEntry ?? null,
      pnlChaos: d.pnlChaos ?? pnl.pnlChaos,
      pnlDiv: d.pnlDiv ?? pnl.pnlDiv,
      botInstanceId: d.botInstanceId ?? null,
      notes: d.notes ?? null,
    },
    include: { botInstance: { select: { id: true, pcName: true } } },
  });

  return NextResponse.json(fill, { status: 201 });
}
