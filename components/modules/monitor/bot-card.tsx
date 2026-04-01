"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, XCircle, TriangleAlert } from "lucide-react";
import type { InstanceInfo } from "./types";

interface BotCardProps {
  instance: InstanceInfo;
  selected: boolean;
  onClick: () => void;
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function BotCard({ instance, selected, onClick }: BotCardProps) {
  const borderColor = instance.hasRecentAlert
    ? "border-yellow-500/60"
    : instance.online
      ? "border-green-500/60"
      : "border-red-500/60";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border-l-4 border border-border bg-card px-3 py-2.5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        borderColor,
        selected && "bg-accent"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">
            {instance.configName}
          </p>
          {instance.characterName && (
            <p className="truncate text-xs text-muted-foreground">
              {instance.characterName}
            </p>
          )}
          {instance.currentArea && (
            <p className="truncate text-xs text-muted-foreground/60 mt-0.5">
              {instance.currentArea}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {instance.online ? (
            <Badge
              variant="outline"
              className="border-green-500/50 bg-green-500/10 text-green-500 text-[10px] px-1.5 py-0"
            >
              Online
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-red-500/50 bg-red-500/10 text-red-500 text-[10px] px-1.5 py-0"
            >
              Offline
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatUptime(instance.uptime)}
        </span>
        {instance.errors > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle className="h-3 w-3" />
            {instance.errors}
          </span>
        )}
        {instance.warns > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <TriangleAlert className="h-3 w-3" />
            {instance.warns}
          </span>
        )}
        {instance.hasRecentAlert && (
          <span className="flex items-center gap-1 text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            Alerta
          </span>
        )}
      </div>
    </button>
  );
}
