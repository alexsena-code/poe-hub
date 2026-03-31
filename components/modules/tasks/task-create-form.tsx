"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
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
} from "@/components/ui/dialog";
import { TASK_MODULES } from "@/lib/constants";
import { useUsers } from "@/hooks/use-users";

const taskCreateSchema = z.object({
  title: z.string().min(1, "Titulo obrigatorio"),
  description: z.string().optional(),
  status: z.enum(["backlog", "todo", "in_progress", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  module: z.enum(["bots", "prices", "sales", "simulations", "infra", "other"]).optional(),
});

type TaskCreateValues = z.infer<typeof taskCreateSchema>;

interface TaskCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: "backlog" | "todo" | "in_progress" | "done";
  onCreated: () => void;
}

export function TaskCreateForm({
  open,
  onOpenChange,
  defaultStatus = "backlog",
  onCreated,
}: TaskCreateFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { users } = useUsers();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TaskCreateValues>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: {
      title: "",
      description: "",
      status: defaultStatus,
      priority: "medium",
      assignedTo: "",
      dueDate: "",
    },
  });

  const status = watch("status");
  const priority = watch("priority");
  const module = watch("module");

  async function onSubmit(data: TaskCreateValues) {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: data.title,
        status: data.status,
        priority: data.priority,
      };
      if (data.description) body.description = data.description;
      if (data.assignedTo) body.assignedTo = data.assignedTo;
      if (data.dueDate) body.dueDate = data.dueDate;
      if (data.module) body.module = data.module;

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar tarefa");
      }

      toast.success("Tarefa criada com sucesso");
      reset();
      setExpanded(false);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              placeholder="Titulo da tarefa"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setValue("status", v as TaskCreateValues["status"])
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
                  setValue("priority", v as TaskCreateValues["priority"])
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

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-1 size-4" />
                Menos campos
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 size-4" />
                Mais campos
              </>
            )}
          </Button>

          {expanded && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descricao</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                  placeholder="Descricao da tarefa"
                  {...register("description")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Modulo</Label>
                  <Select
                    value={module ?? ""}
                    onValueChange={(v) =>
                      setValue(
                        "module",
                        v as TaskCreateValues["module"]
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
                  <Label htmlFor="dueDate">Data limite</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    {...register("dueDate")}
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
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface QuickCreateInputProps {
  status: "backlog" | "todo" | "in_progress" | "done";
  onCreated: () => void;
}

export function QuickCreateInput({ status, onCreated }: QuickCreateInputProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: value.trim(),
          status,
          priority: "medium",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar tarefa");
      }

      toast.success("Tarefa criada");
      setValue("");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-1.5">
      <Input
        placeholder="Nova tarefa..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-xs"
        disabled={loading}
      />
      <Button type="submit" size="sm" variant="ghost" className="h-8 px-2" disabled={loading || !value.trim()}>
        <Plus className="size-4" />
      </Button>
    </form>
  );
}
