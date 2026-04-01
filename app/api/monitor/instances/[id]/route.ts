import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkInstanceBotSchema } from "@/lib/validations/monitor";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const instance = await prisma.botInstance.findUnique({
    where: { id },
    include: {
      bot: { select: { id: true, nick: true } },
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: instance.id,
    pcName: instance.pcName,
    configName: instance.configName,
    characterName: instance.characterName,
    league: instance.league,
    currentArea: instance.currentArea,
    botVersion: instance.botVersion,
    isOnline: instance.isOnline,
    lastSeen: instance.lastSeen,
    connectedAt: instance.connectedAt,
    totalLogs: instance.totalLogs,
    errorCount: instance.errorCount,
    warnCount: instance.warnCount,
    botId: instance.botId,
    bot: instance.bot ? { id: instance.bot.id, nick: instance.bot.nick } : null,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.botInstance.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = linkInstanceBotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { botId } = parsed.data;

  // If a botId is provided, verify the Bot exists
  if (botId !== null && botId !== undefined) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }
  }

  const updated = await prisma.botInstance.update({
    where: { id },
    data: { botId: botId ?? null },
    include: {
      bot: { select: { id: true, nick: true } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    pcName: updated.pcName,
    configName: updated.configName,
    characterName: updated.characterName,
    league: updated.league,
    currentArea: updated.currentArea,
    botVersion: updated.botVersion,
    isOnline: updated.isOnline,
    lastSeen: updated.lastSeen,
    connectedAt: updated.connectedAt,
    totalLogs: updated.totalLogs,
    errorCount: updated.errorCount,
    warnCount: updated.warnCount,
    botId: updated.botId,
    bot: updated.bot ? { id: updated.bot.id, nick: updated.bot.nick } : null,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.botInstance.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  await prisma.botInstance.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
