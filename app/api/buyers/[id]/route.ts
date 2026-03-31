import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateBuyerSchema } from "@/lib/validations/sale";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const buyer = await prisma.buyer.findUnique({
    where: { id },
    include: { sales: true },
  });

  if (!buyer) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  return NextResponse.json(buyer);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.buyer.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateBuyerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.isCnl !== undefined) updateData.isCnl = data.isCnl;
  if (data.contact !== undefined) updateData.contact = data.contact ?? null;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;

  const buyer = await prisma.buyer.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(buyer);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.buyer.findUnique({
    where: { id },
    include: { _count: { select: { sales: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
  }

  if (existing._count.sales > 0) {
    return NextResponse.json(
      { error: "Cannot delete buyer with existing sales" },
      { status: 409 }
    );
  }

  await prisma.buyer.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
