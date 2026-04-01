import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acknowledgeAlertSchema } from "@/lib/validations/monitor";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.botAlert.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = acknowledgeAlertSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const updated = await prisma.botAlert.update({
    where: { id },
    data: {
      acknowledged: true,
      acknowledgedAt: new Date(),
    },
    include: {
      instance: {
        select: { id: true, pcName: true, configName: true },
      },
    },
  });

  return NextResponse.json({
    id: updated.id,
    instanceId: updated.instanceId,
    type: updated.type,
    severity: updated.severity,
    title: updated.title,
    message: updated.message,
    details: updated.details,
    acknowledged: updated.acknowledged,
    acknowledgedAt: updated.acknowledgedAt,
    createdAt: updated.createdAt,
    instance: {
      id: updated.instance.id,
      pcName: updated.instance.pcName,
      configName: updated.instance.configName,
    },
  });
}
