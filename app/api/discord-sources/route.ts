import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDiscordSourceSchema } from "@/lib/validations/price";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Suppress unused variable warning
  void request;

  const sources = await prisma.discordSource.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: sources });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createDiscordSourceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Check for duplicate server+channel combination
  const existing = await prisma.discordSource.findUnique({
    where: {
      serverId_channelId: {
        serverId: data.serverId,
        channelId: data.channelId,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Discord source with this server and channel already exists" },
      { status: 409 }
    );
  }

  const source = await prisma.discordSource.create({
    data: {
      serverId: data.serverId,
      serverName: data.serverName,
      channelId: data.channelId,
      channelName: data.channelName,
      isActive: data.isActive ?? true,
      cnlAuthorIds: data.cnlAuthorIds ?? [],
    },
  });

  return NextResponse.json(source, { status: 201 });
}
