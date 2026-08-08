import { z } from "zod/v4";

export const collectG2gSnapshotSchema = z.object({
  league: z.string().min(1, "League não pode ser vazia").optional(),
  item: z.string().min(1, "Item não pode ser vazio").optional(),
  platform: z.string().min(1, "Platform não pode ser vazia").optional(),
  hardcore: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
});

export type CollectG2gSnapshotInput = z.infer<typeof collectG2gSnapshotSchema>;
