"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskPriorityBadge, type TaskPriority } from "./task-priority-badge";
import { Calendar, GripVertical, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "in_progress" | "done";
  priority: TaskPriority;
  assignedTo: string | null;
  createdBy: string;
  dueDate: string | null;
  league: string | null;
  module: "bots" | "prices" | "sales" | "simulations" | "infra" | "other" | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: string; username: string } | null;
  creator?: { id: string; username: string };
}

const moduleLabels: Record<string, string> = {
  bots: "Bots",
  prices: "Preços",
  sales: "Vendas",
  simulations: "Simulações",
  infra: "Infra",
  other: "Outro",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function isOverdue(dateStr: string): boolean {
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
}

export function TaskCard({
  task,
  onClick,
  draggable = true,
  onDragStart,
}: TaskCardProps) {
  const assigneeName = task.assignee?.username ?? null;
  const initial = assigneeName ? assigneeName.charAt(0).toUpperCase() : null;
  const overdue = task.dueDate && task.status !== "done" && isOverdue(task.dueDate);

  return (
    <Card
      className={cn(
        "cursor-pointer gap-3 py-3 transition-colors hover:border-primary/50",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task)}
      onClick={() => onClick(task)}
    >
      <CardContent className="space-y-2 px-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{task.title}</p>
          {draggable && (
            <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <TaskPriorityBadge priority={task.priority} />
          {task.module && (
            <Badge variant="secondary" className="text-xs">
              {moduleLabels[task.module] ?? task.module}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {task.dueDate && (
              <span
                className={cn(
                  "flex items-center gap-1",
                  overdue && "text-red-400"
                )}
              >
                <Calendar className="size-3" />
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>

          {initial && (
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
              {initial}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
