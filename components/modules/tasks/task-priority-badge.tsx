"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

const priorityConfig: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  low: {
    label: "Baixa",
    className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  },
  medium: {
    label: "Média",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  high: {
    label: "Alta",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  urgent: {
    label: "Urgente",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export function TaskPriorityBadge({
  priority,
  className,
}: TaskPriorityBadgeProps) {
  const config = priorityConfig[priority];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
