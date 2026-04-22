import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCostConfigSchema } from "@/lib/validations/simulation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const config = await prisma.globalCostConfig.findUnique({
    where: { id },
    include: {
      simulationLinks: {
        include: {
          simulation: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  if (!config) {
    return NextResponse.json({ error: "Cost config not found" }, { status: 404 });
  }

  return NextResponse.json(config);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.globalCostConfig.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Cost config not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateCostConfigSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.proxyCostPerBotMonthly !== undefined) updateData.proxyCostPerBotMonthly = data.proxyCostPerBotMonthly;
  if (data.levelingCostPerBot !== undefined) updateData.levelingCostPerBot = data.levelingCostPerBot;
  if (data.stashPackCostPerBot !== undefined) updateData.stashPackCostPerBot = data.stashPackCostPerBot;
  if (data.expluginsKeyCostDaily !== undefined) updateData.expluginsKeyCostDaily = data.expluginsKeyCostDaily;
  if (data.dpbKeyCostDaily !== undefined) updateData.dpbKeyCostDaily = data.dpbKeyCostDaily;
  if (data.customCosts !== undefined) updateData.customCosts = data.customCosts;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;

  // Handle isDefault toggle
  if (data.isDefault !== undefined) {
    if (data.isDefault) {
      await prisma.globalCostConfig.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    updateData.isDefault = data.isDefault;
  }

  const config = await prisma.globalCostConfig.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(config);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.globalCostConfig.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Cost config not found" }, { status: 404 });
  }

  // Check if linked to any simulations
  const linkCount = await prisma.simulationCostLink.count({
    where: { costConfigId: id },
  });

  if (linkCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete cost config that is linked to simulations",
        linkedSimulations: linkCount,
      },
      { status: 409 }
    );
  }

  await prisma.globalCostConfig.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
