import { prisma } from "@/lib/prisma";

let counter = 0;

export function buildPriceEntryInput(overrides: Record<string, unknown> = {}) {
  counter++;
  const now = new Date();
  return {
    discordMessageId: `msg-${counter}-${Date.now()}`,
    discordChannelId: "channel-001",
    discordServerId: "server-001",
    authorDiscordId: `author-${counter}`,
    authorName: `User ${counter}`,
    isCnl: false,
    price: "1.50",
    currency: "divine" as const,
    item: null,
    rawMessage: `WTS divine 1.50 USD`,
    messageTimestamp: now.toISOString(),
    league: "Settlers",
    ...overrides,
  };
}

export async function createPriceEntry(overrides: Record<string, unknown> = {}) {
  const input = buildPriceEntryInput(overrides);
  return prisma.priceEntry.create({
    data: {
      discordMessageId: input.discordMessageId as string,
      discordChannelId: input.discordChannelId as string,
      discordServerId: input.discordServerId as string,
      authorDiscordId: input.authorDiscordId as string,
      authorName: input.authorName as string,
      isCnl: input.isCnl as boolean,
      price: input.price as string,
      currency: input.currency as "divine" | "chaos" | "usd" | "brl" | "other",
      item: (input.item as string | null) ?? null,
      rawMessage: input.rawMessage as string,
      messageTimestamp: new Date(input.messageTimestamp as string),
      league: (input.league as string | null) ?? null,
    },
  });
}

export async function createDiscordSource(overrides: Record<string, unknown> = {}) {
  counter++;
  const defaults = {
    serverId: `server-${counter}-${Date.now()}`,
    serverName: `Test Server ${counter}`,
    channelId: `channel-${counter}-${Date.now()}`,
    channelName: `Test Channel ${counter}`,
    isActive: true,
    cnlAuthorIds: [] as string[],
    ...overrides,
  };

  return prisma.discordSource.create({
    data: {
      serverId: defaults.serverId as string,
      serverName: defaults.serverName as string,
      channelId: defaults.channelId as string,
      channelName: defaults.channelName as string,
      isActive: defaults.isActive as boolean,
      cnlAuthorIds: defaults.cnlAuthorIds as string[],
    },
  });
}

export async function cleanupPrices() {
  await prisma.priceEntry.deleteMany();
}

export async function cleanupDiscordSources() {
  await prisma.discordSource.deleteMany();
}
