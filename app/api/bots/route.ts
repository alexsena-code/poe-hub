import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { createBotSchema } from "@/lib/validations/bot";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { nick: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [bots, total] = await Promise.all([
    prisma.bot.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.bot.count({ where }),
  ]);

  const safeBots = bots.map((bot) => ({
    ...bot,
    password: "••••••••",
  }));

  return NextResponse.json({
    data: safeBots,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createBotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const bot = await prisma.bot.create({
    data: {
      nick: data.nick,
      email: data.email,
      password: encrypt(data.password),
      proxyIp: data.proxyIp,
      proxyEol: data.proxyEol ? new Date(data.proxyEol) : null,
      status: data.status || "active",
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json(
    {
      ...bot,
      password: "••••••••",
    },
    { status: 201 }
  );
}
