import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDiscordSourceSchema } from "@/lib/validations/price";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const source = await prisma.discordSource.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "Discord source not found" }, { status: 404 });
  }

  return NextResponse.json(source);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateDiscordSourceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const existing = await prisma.discordSource.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Discord source not found" }, { status: 404 });
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.serverId !== undefined) updateData.serverId = data.serverId;
  if (data.serverName !== undefined) updateData.serverName = data.serverName;
  if (data.channelId !== undefined) updateData.channelId = data.channelId;
  if (data.channelName !== undefined) updateData.channelName = data.channelName;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.cnlAuthorIds !== undefined) updateData.cnlAuthorIds = data.cnlAuthorIds;

  const source = await prisma.discordSource.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(source);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.discordSource.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Discord source not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Discord source deleted" });
}
