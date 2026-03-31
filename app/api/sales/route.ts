import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSaleSchema } from "@/lib/validations/sale";
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
  const buyerId = searchParams.get("buyerId");
  const league = searchParams.get("league");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    where.date = dateFilter;
  }
  if (buyerId) {
    where.buyerId = buyerId;
  }
  if (league) {
    where.league = league;
  }
  if (search) {
    where.OR = [
      { notes: { contains: search, mode: "insensitive" } },
      { buyer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { date: "desc" },
      include: {
        buyer: { select: { id: true, name: true, isCnl: true } },
      },
    }),
    prisma.sale.count({ where }),
  ]);

  return NextResponse.json({
    data: sales,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSaleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Verify buyer exists
  const buyer = await prisma.buyer.findUnique({ where: { id: data.buyerId } });
  if (!buyer) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  // Auto-calculate totals if not provided
  let totalUsd = data.totalUsd ?? null;
  let totalBrl = data.totalBrl ?? null;

  if (totalUsd == null && data.divinePriceUsd != null) {
    totalUsd = data.quantity * data.divinePriceUsd;
  }
  if (totalBrl == null && data.divinePriceBrl != null) {
    totalBrl = data.quantity * data.divinePriceBrl;
  }

  const sale = await prisma.sale.create({
    data: {
      date: new Date(data.date),
      buyerId: data.buyerId,
      quantity: data.quantity,
      unit: data.unit,
      divinePriceUsd: data.divinePriceUsd ?? null,
      divinePriceBrl: data.divinePriceBrl ?? null,
      totalUsd,
      totalBrl,
      league: data.league,
      notes: data.notes ?? null,
    },
    include: {
      buyer: { select: { id: true, name: true, isCnl: true } },
    },
  });

  return NextResponse.json(sale, { status: 201 });
}
