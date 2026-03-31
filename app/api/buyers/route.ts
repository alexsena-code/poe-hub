import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBuyerSchema } from "@/lib/validations/sale";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const buyers = await prisma.buyer.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: buyers });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createBuyerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const buyer = await prisma.buyer.create({
    data: {
      name: data.name,
      isCnl: data.isCnl,
      contact: data.contact ?? null,
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json(buyer, { status: 201 });
}
