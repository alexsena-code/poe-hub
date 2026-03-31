"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TaskCard, type Task } from "./task-card";
import { TaskDetailDialog } from "./task-detail-dialog";
import { QuickCreateInput } from "./task-create-form";

type TaskStatus = "backlog" | "todo" | "in_progress" | "done";

interface Column {
  status: TaskStatus;
  label: string;
}

const columns: Column[] = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "Em Progresso" },
  { status: "done", label: "Concluido" },
];

interface KanbanBoardProps {
  filters?: {
    priority?: string;
    assignedTo?: string;
    module?: string;
  };
}

export function KanbanBoard({ filters }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (filters?.priority) params.set("priority", filters.priority);
      if (filters?.assignedTo) params.set("assignedTo", filters.assignedTo);
      if (filters?.module) params.set("module", filters.module);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar tarefas");

      const json = await res.json();
      setTasks(json.data ?? []);
    } catch {
      toast.error("Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  function getColumnTasks(status: TaskStatus): Task[] {
    return tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  async function handleDrop(e: React.DragEvent, newStatus: TaskStatus) {
    e.preventDefault();
    setDragOverColumn(null);

    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const columnTasks = getColumnTasks(newStatus);
    const newPosition = columnTasks.length > 0
      ? Math.max(...columnTasks.map((t) => t.position)) + 1
      : 0;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus, position: newPosition }
          : t
      )
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, position: newPosition }),
      });

      if (!res.ok) throw new Error("Erro ao mover tarefa");
    } catch {
      toast.error("Erro ao mover tarefa");
      fetchTasks(); // revert
    }
  }

  function handleCardClick(task: Task) {
    setSelectedTask(task);
    setDetailOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 pb-4">
        {columns.map((column) => {
          const columnTasks = getColumnTasks(column.status);
          const isDragOver = dragOverColumn === column.status;

          return (
            <div
              key={column.status}
              className={cn(
                "flex min-h-[300px] flex-col rounded-lg border bg-muted/30 p-3",
                isDragOver && "border-primary/50 bg-primary/5"
              )}
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {columnTasks.length}
                </Badge>
              </div>

              <div className="mb-3">
                <QuickCreateInput
                  status={column.status}
                  onCreated={fetchTasks}
                />
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={handleCardClick}
                    onDragStart={handleDragStart}
                  />
                ))}

                {columnTasks.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-md border border-dashed py-8 text-xs text-muted-foreground">
                    Arraste tarefas aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDetailDialog
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={fetchTasks}
        onDeleted={fetchTasks}
      />
    </>
  );
}
