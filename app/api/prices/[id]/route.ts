import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const entry = await prisma.priceEntry.findUnique({ where: { id } });
  if (!entry) {
    return NextResponse.json({ error: "Price entry not found" }, { status: 404 });
  }

  return NextResponse.json(entry);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.priceEntry.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Price entry not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Price entry deleted" });
}
