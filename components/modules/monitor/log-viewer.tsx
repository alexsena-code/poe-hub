"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogEntry, LogLevel } from "./types";

const LOG_LEVEL_STYLES: Record<LogLevel, string> = {
  DEBUG: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  INFO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  WARN: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  ERROR: "bg-red-500/20 text-red-400 border-red-500/30",
};

const LOG_MESSAGE_STYLES: Record<LogLevel, string> = {
  DEBUG: "text-muted-foreground",
  INFO: "text-foreground",
  WARN: "text-yellow-300",
  ERROR: "text-red-300",
};

interface LogViewerProps {
  instanceName: string | null;
  logs: LogEntry[];
}

export function LogViewer({ instanceName, logs }: LogViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filter
    ? logs.filter(
        (l) =>
          l.message.toLowerCase().includes(filter.toLowerCase()) ||
          l.level.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  // Keep the last 300 lines
  const displayedLogs = filteredLogs.slice(-300);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayedLogs.length, autoScroll]);

  if (!instanceName) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Selecione um bot para ver os logs
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold truncate">{instanceName}</h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {displayedLogs.length} linhas
          </Badge>
        </div>
        <Button
          variant={autoScroll ? "default" : "outline"}
          size="sm"
          className="h-7 shrink-0 gap-1.5 text-xs"
          onClick={() => setAutoScroll((prev) => !prev)}
          title={autoScroll ? "Auto-scroll ativado" : "Auto-scroll desativado"}
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
          Auto-scroll
        </Button>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrar logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 rounded-md border border-border bg-black/30">
        <div className="p-2 font-mono text-xs space-y-0.5">
          {displayedLogs.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">
              {filter ? "Nenhum log encontrado para o filtro." : "Aguardando logs..."}
            </p>
          ) : (
            displayedLogs.map((log, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-2 rounded px-1.5 py-0.5 hover:bg-white/5",
                  log.level === "ERROR" && "bg-red-500/5",
                  log.level === "WARN" && "bg-yellow-500/5"
                )}
              >
                <span className="shrink-0 text-muted-foreground/60 tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                </span>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-[10px] px-1 py-0 leading-4", LOG_LEVEL_STYLES[log.level])}
                >
                  {log.level}
                </Badge>
                <span className={cn("break-all", LOG_MESSAGE_STYLES[log.level])}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
