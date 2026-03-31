import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateBotStatusSchema } from "@/lib/validations/bot";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, { params }: Params) {
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
  const parsed = updateBotStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const bot = await prisma.bot.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ id: bot.id, status: bot.status });
}
