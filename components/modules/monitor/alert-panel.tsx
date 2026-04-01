"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCheck, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotAlert, AlertSeverity } from "./types";

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  critical: "bg-red-700/30 text-red-300 border-red-700/40",
};

const SEVERITY_BORDER: Record<AlertSeverity, string> = {
  info: "border-l-blue-500/60",
  warning: "border-l-yellow-500/60",
  error: "border-l-red-500/60",
  critical: "border-l-red-700/80",
};

interface AlertPanelProps {
  alerts: BotAlert[];
  onAcknowledge: (alertId: string) => void;
  onAcknowledgeAll: () => void;
  onSelectInstance: (instanceId: string) => void;
}

export function AlertPanel({
  alerts,
  onAcknowledge,
  onAcknowledgeAll,
  onSelectInstance,
}: AlertPanelProps) {
  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Alertas</h3>
          {unacknowledged.length > 0 && (
            <Badge
              variant="outline"
              className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0"
            >
              {unacknowledged.length}
            </Badge>
          )}
        </div>
        {unacknowledged.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onAcknowledgeAll}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Confirmar todos
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 rounded-md border border-border">
        <div className="p-2 space-y-2">
          {alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum alerta
            </p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border border-border border-l-4 bg-card px-3 py-2.5 transition-colors",
                  SEVERITY_BORDER[alert.severity],
                  alert.acknowledged && "opacity-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 uppercase",
                          SEVERITY_STYLES[alert.severity]
                        )}
                      >
                        {alert.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {alert.type}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium text-muted-foreground hover:text-foreground text-left truncate block max-w-full"
                      onClick={() => onSelectInstance(alert.instanceId)}
                    >
                      {alert.instanceName}
                    </button>
                    <p className="text-xs break-words">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {new Date(alert.timestamp).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {!alert.acknowledged && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-green-500"
                      title="Confirmar alerta"
                      onClick={() => onAcknowledge(alert.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
