import { z } from "zod/v4";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(200),
  description: z.string().nullable().optional(),
  status: z.enum(["backlog", "todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  league: z.string().nullable().optional(),
  module: z.enum(["bots", "prices", "sales", "simulations", "infra", "other"]).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const updateTaskStatusSchema = z.object({
  status: z.enum(["backlog", "todo", "in_progress", "done"]),
  position: z.number().int().min(0).optional(),
});

export const reorderTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["backlog", "todo", "in_progress", "done"]),
        position: z.number().int().min(0),
      })
    )
    .min(1, "Pelo menos uma task é necessária"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;
