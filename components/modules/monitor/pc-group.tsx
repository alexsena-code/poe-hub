"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { BotCard } from "./bot-card";
import type { InstanceInfo } from "./types";

interface PcGroupProps {
  pcName: string;
  instances: InstanceInfo[];
  selectedInstanceId: string | null;
  onSelectInstance: (id: string) => void;
}

export function PcGroup({
  pcName,
  instances,
  selectedInstanceId,
  onSelectInstance,
}: PcGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  const onlineCount = instances.filter((i) => i.online).length;
  const total = instances.length;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/40 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )}
        <Monitor className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">{pcName}</span>
        <span
          className={cn(
            "shrink-0 tabular-nums",
            onlineCount === total
              ? "text-green-500"
              : onlineCount === 0
                ? "text-red-500"
                : "text-yellow-500"
          )}
        >
          {onlineCount}/{total}
        </span>
      </button>

      {!collapsed && (
        <div className="ml-2 space-y-1.5 border-l border-border pl-3">
          {instances.map((instance) => (
            <BotCard
              key={instance.id}
              instance={instance}
              selected={selectedInstanceId === instance.id}
              onClick={() => onSelectInstance(instance.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
