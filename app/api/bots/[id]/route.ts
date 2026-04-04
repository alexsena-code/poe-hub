import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { updateBotSchema } from "@/lib/validations/bot";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bot = await prisma.bot.findUnique({ where: { id } });
  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const revealSecrets = searchParams.get("reveal") === "true";
  const isAdmin = session.user?.role === "admin";

  return NextResponse.json({
    ...bot,
    password: revealSecrets && isAdmin ? decrypt(bot.password) : "••••••••",
  });
}

export async function PUT(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.bot.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const body = await _request.json();
  const parsed = updateBotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.nick !== undefined) updateData.nick = data.nick;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.password !== undefined) updateData.password = encrypt(data.password);
  if (data.proxyIp !== undefined) updateData.proxyIp = data.proxyIp;
  if (data.proxyEol !== undefined) updateData.proxyEol = data.proxyEol ? new Date(data.proxyEol) : null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;

  const bot = await prisma.bot.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    ...bot,
    password: "••••••••",
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.bot.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  await prisma.bot.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
