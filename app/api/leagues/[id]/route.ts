import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

type Params = { params: Promise<{ id: string }> };

const updateLeagueSchema = z.object({
  name: z.string().min(1).optional(),
  poeVersion: z.enum(["poe1", "poe2"]).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isCurrent: z.boolean().optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const league = await prisma.league.findUnique({ where: { id } });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  return NextResponse.json(league);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.league.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateLeagueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.poeVersion !== undefined) updateData.poeVersion = data.poeVersion;
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.isCurrent !== undefined) updateData.isCurrent = data.isCurrent;

  const league = await prisma.league.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(league);
}
