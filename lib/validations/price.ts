import { z } from "zod/v4";

export const createPriceEntrySchema = z.object({
  discordMessageId: z.string().min(1, "Discord message ID é obrigatório"),
  discordChannelId: z.string().min(1, "Discord channel ID é obrigatório"),
  discordServerId: z.string().min(1, "Discord server ID é obrigatório"),
  authorDiscordId: z.string().min(1, "Author Discord ID é obrigatório"),
  authorName: z.string().min(1, "Author name é obrigatório"),
  isCnl: z.boolean().optional().default(false),
  price: z.union([z.string(), z.number()]).transform((v) => String(v)),
  currency: z.enum(["divine", "chaos", "usd", "brl", "other"]),
  item: z.string().nullable().optional(),
  rawMessage: z.string().min(1, "Raw message é obrigatório"),
  messageTimestamp: z.string().datetime(),
  league: z.string().nullable().optional(),
});

export const bulkCreatePriceEntriesSchema = z.object({
  entries: z.array(createPriceEntrySchema).min(1, "Pelo menos uma entrada é necessária"),
});

export const createDiscordSourceSchema = z.object({
  serverId: z.string().min(1, "Server ID é obrigatório"),
  serverName: z.string().min(1, "Server name é obrigatório"),
  channelId: z.string().min(1, "Channel ID é obrigatório"),
  channelName: z.string().min(1, "Channel name é obrigatório"),
  isActive: z.boolean().optional().default(true),
  cnlAuthorIds: z.array(z.string().min(1)).optional().default([]),
});

export const updateDiscordSourceSchema = createDiscordSourceSchema.partial();

export type CreatePriceEntryInput = z.infer<typeof createPriceEntrySchema>;
export type BulkCreatePriceEntriesInput = z.infer<typeof bulkCreatePriceEntriesSchema>;
export type CreateDiscordSourceInput = z.infer<typeof createDiscordSourceSchema>;
export type UpdateDiscordSourceInput = z.infer<typeof updateDiscordSourceSchema>;
