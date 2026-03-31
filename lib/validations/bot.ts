import { z } from "zod/v4";

export const createBotSchema = z.object({
  nick: z.string().min(1, "Nick é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
  proxyIp: z.string().min(1, "IP do proxy é obrigatório"),
  proxyEol: z.string().datetime().nullable().optional(),
  status: z.enum(["active", "inactive", "banned", "maintenance"]).optional(),
  notes: z.string().nullable().optional(),
});

export const updateBotSchema = createBotSchema.partial();

export const updateBotStatusSchema = z.object({
  status: z.enum(["active", "inactive", "banned", "maintenance"]),
});

export type CreateBotInput = z.infer<typeof createBotSchema>;
export type UpdateBotInput = z.infer<typeof updateBotSchema>;
