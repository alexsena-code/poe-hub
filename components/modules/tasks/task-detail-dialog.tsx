"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { TASK_MODULES } from "@/lib/constants";
import { useUsers } from "@/hooks/use-users";
import type { Task } from "./task-card";

const taskUpdateSchema = z.object({
  title: z.string().min(1, "Titulo obrigatorio"),
  description: z.string().optional(),
  status: z.enum(["backlog", "todo", "in_progress", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  module: z
    .enum(["bots", "prices", "sales", "simulations", "infra", "other"])
    .optional(),
});

type TaskUpdateValues = z.infer<typeof taskUpdateSchema>;

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: TaskDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { users } = useUsers();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TaskUpdateValues>({
    resolver: zodResolver(taskUpdateSchema),
  });

  const status = watch("status");
  const priority = watch("priority");
  const module = watch("module");

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        assignedTo: task.assignedTo ?? "",
        dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
        module: task.module ?? undefined,
      });
      setConfirmDelete(false);
    }
  }, [task, reset]);

  async function onSubmit(data: TaskUpdateValues) {
    if (!task) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: data.title,
        status: data.status,
        priority: data.priority,
      };
      body.description = data.description || null;
      body.assignedTo = data.assignedTo || null;
      body.dueDate = data.dueDate || null;
      body.module = data.module || null;

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao atualizar tarefa");
      }

      toast.success("Tarefa atualizada");
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao atualizar tarefa"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao deletar tarefa");
      }

      toast.success("Tarefa deletada");
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao deletar tarefa"
      );
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes da Tarefa</DialogTitle>
          <DialogDescription>
            Criada em{" "}
            {new Date(task.createdAt).toLocaleDateString("pt-BR")}
            {task.creator && ` por ${task.creator.username}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="detail-title">Titulo</Label>
            <Input id="detail-title" {...register("title")} />
            {errors.title && (
              <p className="text-xs text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="detail-description">Descricao</Label>
            <textarea
              id="detail-description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              placeholder="Descricao da tarefa"
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setValue("status", v as TaskUpdateValues["status"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                  <SelectItem value="done">Concluido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(v) =>
                  setValue("priority", v as TaskUpdateValues["priority"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Modulo</Label>
              <Select
                value={module ?? ""}
                onValueChange={(v) =>
                  setValue(
                    "module",
                    (v || undefined) as TaskUpdateValues["module"]
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_MODULES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data limite</Label>
              <DatePicker
                value={watch("dueDate") ?? ""}
                onChange={(val) => setValue("dueDate", val)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsavel</Label>
            <Select
              value={watch("assignedTo") ?? ""}
              onValueChange={(v) => setValue("assignedTo", v || undefined)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-1 size-4" />
              {confirmDelete
                ? "Confirmar exclusao"
                : deleting
                  ? "Deletando..."
                  : "Deletar"}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
