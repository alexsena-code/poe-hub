import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSaleSchema } from "@/lib/validations/sale";
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      buyer: { select: { id: true, name: true, isCnl: true } },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  return NextResponse.json(sale);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSaleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.date !== undefined) updateData.date = new Date(data.date);
  if (data.buyerId !== undefined) {
    const buyer = await prisma.buyer.findUnique({ where: { id: data.buyerId } });
    if (!buyer) {
      return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
    }
    updateData.buyerId = data.buyerId;
  }
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.divinePriceUsd !== undefined) updateData.divinePriceUsd = data.divinePriceUsd ?? null;
  if (data.divinePriceBrl !== undefined) updateData.divinePriceBrl = data.divinePriceBrl ?? null;
  if (data.totalUsd !== undefined) updateData.totalUsd = data.totalUsd ?? null;
  if (data.totalBrl !== undefined) updateData.totalBrl = data.totalBrl ?? null;
  if (data.league !== undefined) updateData.league = data.league;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;

  const sale = await prisma.sale.update({
    where: { id },
    data: updateData,
    include: {
      buyer: { select: { id: true, name: true, isCnl: true } },
    },
  });

  return NextResponse.json(sale);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  await prisma.sale.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
