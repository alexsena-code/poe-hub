import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCostConfigSchema } from "@/lib/validations/simulation";

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await prisma.globalCostConfig.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { simulationLinks: true } },
    },
  });

  return NextResponse.json({ data: configs });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCostConfigSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.globalCostConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const config = await prisma.globalCostConfig.create({
    data: {
      name: data.name,
      isDefault: data.isDefault,
      proxyCostPerBotMonthly: data.proxyCostPerBotMonthly,
      levelingCostPerBot: data.levelingCostPerBot,
      stashPackCostPerBot: data.stashPackCostPerBot ?? 0,
      expluginsKeyCostDaily: data.expluginsKeyCostDaily,
      dpbKeyCostDaily: data.dpbKeyCostDaily,
      customCosts: data.customCosts ?? [],
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json(config, { status: 201 });
}
