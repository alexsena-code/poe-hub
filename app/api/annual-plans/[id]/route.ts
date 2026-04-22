import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAnnualPlanSchema } from "@/lib/validations/simulation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const plan = await prisma.annualPlan.findUnique({
    where: { id },
    include: {
      simulationLinks: {
        orderBy: { position: "asc" },
        include: {
          simulation: {
            include: {
              weeks: {
                orderBy: { weekNumber: "asc" },
                include: {
                  days: { orderBy: { dayNumber: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!plan) {
    return NextResponse.json({ error: "Annual plan not found" }, { status: 404 });
  }

  return NextResponse.json(plan);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.annualPlan.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Annual plan not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateAnnualPlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.year !== undefined) updateData.year = data.year;
  if (data.annualCustomCosts !== undefined) updateData.annualCustomCosts = data.annualCustomCosts;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;

  // Handle simulation links: replace-all semantics if provided
  if (data.simulationIds !== undefined) {
    await prisma.$transaction([
      prisma.annualPlanSimulation.deleteMany({ where: { annualPlanId: id } }),
      ...(data.simulationIds.length > 0
        ? [
            prisma.annualPlanSimulation.createMany({
              data: data.simulationIds.map((simulationId, index) => ({
                annualPlanId: id,
                simulationId,
                position: index,
              })),
            }),
          ]
        : []),
    ]);
  }

  const plan = await prisma.annualPlan.update({
    where: { id },
    data: updateData,
    include: {
      simulationLinks: {
        orderBy: { position: "asc" },
        include: { simulation: true },
      },
    },
  });

  return NextResponse.json(plan);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.annualPlan.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Annual plan not found" }, { status: 404 });
  }

  await prisma.annualPlan.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
