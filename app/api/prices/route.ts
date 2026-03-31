import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bulkCreatePriceEntriesSchema } from "@/lib/validations/price";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const currency = searchParams.get("currency");
  const isCnl = searchParams.get("isCnl");
  const league = searchParams.get("league");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const channelId = searchParams.get("channelId");

  const where: Record<string, unknown> = {};

  if (currency) {
    where.currency = currency;
  }
  if (isCnl !== null && isCnl !== undefined && isCnl !== "") {
    where.isCnl = isCnl === "true";
  }
  if (league) {
    where.league = league;
  }
  if (channelId) {
    where.discordChannelId = channelId;
  }
  if (dateFrom || dateTo) {
    const messageTimestamp: Record<string, Date> = {};
    if (dateFrom) {
      messageTimestamp.gte = new Date(dateFrom);
    }
    if (dateTo) {
      messageTimestamp.lte = new Date(dateTo);
    }
    where.messageTimestamp = messageTimestamp;
  }

  const [entries, total] = await Promise.all([
    prisma.priceEntry.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { messageTimestamp: "desc" },
    }),
    prisma.priceEntry.count({ where }),
  ]);

  return NextResponse.json({
    data: entries,
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
  const parsed = bulkCreatePriceEntriesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { entries } = parsed.data;

  const result = await prisma.priceEntry.createMany({
    data: entries.map((entry) => ({
      discordMessageId: entry.discordMessageId,
      discordChannelId: entry.discordChannelId,
      discordServerId: entry.discordServerId,
      authorDiscordId: entry.authorDiscordId,
      authorName: entry.authorName,
      isCnl: entry.isCnl ?? false,
      price: entry.price,
      currency: entry.currency,
      item: entry.item ?? null,
      rawMessage: entry.rawMessage,
      messageTimestamp: new Date(entry.messageTimestamp),
      league: entry.league ?? null,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json(
    { created: result.count, total: entries.length },
    { status: 201 }
  );
}
