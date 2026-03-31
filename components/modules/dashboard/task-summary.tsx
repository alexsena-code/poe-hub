"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TaskCounts {
  backlog: number;
  todo: number;
  in_progress: number;
  done: number;
}

const statusConfig: {
  key: keyof TaskCounts;
  label: string;
  color: string;
  badgeClass: string;
}[] = [
  {
    key: "backlog",
    label: "Backlog",
    color: "bg-zinc-500",
    badgeClass: "bg-zinc-600 text-white",
  },
  {
    key: "todo",
    label: "To Do",
    color: "bg-blue-500",
    badgeClass: "bg-blue-600 text-white",
  },
  {
    key: "in_progress",
    label: "Em Progresso",
    color: "bg-amber-500",
    badgeClass: "bg-amber-600 text-white",
  },
  {
    key: "done",
    label: "Concluido",
    color: "bg-emerald-500",
    badgeClass: "bg-emerald-600 text-white",
  },
];

export function TaskSummary({ counts }: { counts: TaskCounts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarefas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bar visualization */}
        {total > 0 && (
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {statusConfig.map(({ key, color }) => {
              const pct = (counts[key] / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={key}
                  className={`${color} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
        )}

        {/* Status breakdown */}
        <div className="grid grid-cols-2 gap-3">
          {statusConfig.map(({ key, label, badgeClass }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              <Badge className={badgeClass}>
                {counts[key].toLocaleString("pt-BR")}
              </Badge>
            </div>
          ))}
        </div>

        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString("pt-BR")} tarefas no total
          </p>
        )}
      </CardContent>
    </Card>
  );
}
