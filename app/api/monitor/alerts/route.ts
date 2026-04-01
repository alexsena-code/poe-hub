import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alertFiltersSchema } from "@/lib/validations/monitor";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;

  const rawParams = {
    instanceId: searchParams.get("instanceId") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    severity: searchParams.get("severity") ?? undefined,
    acknowledged: searchParams.get("acknowledged") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  };

  const parsed = alertFiltersSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    instanceId,
    type,
    severity,
    acknowledged,
    dateFrom,
    dateTo,
    page,
    limit,
  } = parsed.data;

  const where: Prisma.BotAlertWhereInput = {};

  if (instanceId !== undefined) where.instanceId = instanceId;
  if (type !== undefined) where.type = type;
  if (severity !== undefined) where.severity = severity;
  if (acknowledged !== undefined) where.acknowledged = acknowledged;

  if (dateFrom !== undefined || dateTo !== undefined) {
    where.createdAt = {};
    if (dateFrom !== undefined) where.createdAt.gte = new Date(dateFrom);
    if (dateTo !== undefined) where.createdAt.lte = new Date(dateTo);
  }

  const [alerts, total] = await Promise.all([
    prisma.botAlert.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        instance: {
          select: { id: true, pcName: true, configName: true },
        },
      },
    }),
    prisma.botAlert.count({ where }),
  ]);

  const shaped = alerts.map((alert) => ({
    id: alert.id,
    instanceId: alert.instanceId,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    details: alert.details,
    acknowledged: alert.acknowledged,
    acknowledgedAt: alert.acknowledgedAt,
    createdAt: alert.createdAt,
    instance: {
      id: alert.instance.id,
      pcName: alert.instance.pcName,
      configName: alert.instance.configName,
    },
  }));

  return NextResponse.json({
    data: shaped,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
