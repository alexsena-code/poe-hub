import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAnnualPlanSchema } from "@/lib/validations/simulation";

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plans = await prisma.annualPlan.findMany({
    orderBy: [{ year: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: { select: { simulationLinks: true } },
    },
  });

  return NextResponse.json({ data: plans });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createAnnualPlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const plan = await prisma.annualPlan.create({
    data: {
      name: data.name,
      year: data.year,
      annualCustomCosts: data.annualCustomCosts ?? [],
      notes: data.notes ?? null,
      simulationLinks: data.simulationIds
        ? {
            create: data.simulationIds.map((simulationId, index) => ({
              simulationId,
              position: index,
            })),
          }
        : undefined,
    },
    include: {
      simulationLinks: { include: { simulation: true } },
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
