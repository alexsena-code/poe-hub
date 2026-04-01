import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instances = await prisma.botInstance.findMany({
    orderBy: [{ pcName: "asc" }, { configName: "asc" }],
    include: {
      bot: {
        select: { id: true, nick: true },
      },
    },
  });

  // Shape each instance — exclude internal Prisma relation object and expose only safe fields
  const shaped = instances.map((inst) => ({
    id: inst.id,
    pcName: inst.pcName,
    configName: inst.configName,
    characterName: inst.characterName,
    league: inst.league,
    currentArea: inst.currentArea,
    botVersion: inst.botVersion,
    isOnline: inst.isOnline,
    lastSeen: inst.lastSeen,
    connectedAt: inst.connectedAt,
    totalLogs: inst.totalLogs,
    errorCount: inst.errorCount,
    warnCount: inst.warnCount,
    botId: inst.botId,
    bot: inst.bot ? { id: inst.bot.id, nick: inst.bot.nick } : null,
    createdAt: inst.createdAt,
    updatedAt: inst.updatedAt,
  }));

  // Group by pcName
  const grouped: Record<
    string,
    {
      pcName: string;
      instances: typeof shaped;
    }
  > = {};

  for (const inst of shaped) {
    if (!grouped[inst.pcName]) {
      grouped[inst.pcName] = { pcName: inst.pcName, instances: [] };
    }
    grouped[inst.pcName].instances.push(inst);
  }

  return NextResponse.json({
    data: Object.values(grouped),
    total: instances.length,
  });
}
