import { z } from "zod/v4";

export const createConversationSchema = z.object({
  title: z.string().max(200).nullable().optional(),
});

export const createMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Content is required"),
  layers: z.any().optional(),
  tokenEstimate: z.number().int().optional(),
  latencyMs: z.number().int().optional(),
  detectedPageType: z.string().optional(),
  cost: z.any().optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
