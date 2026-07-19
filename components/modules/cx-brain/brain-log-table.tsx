"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BrainLogEntry {
  id: string;
  ts: Date;
  action: string;
  pairKey: string | null;
  detail: unknown;
  positionId: string | null;
}

// Serialized version coming from Server Component props (dates as strings)
export interface BrainLogEntrySerialized {
  id: string;
  ts: string;
  action: string;
  pairKey: string | null;
  detail: unknown;
  positionId: string | null;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

const ACTION_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open_position: "default",
  close_position: "secondary",
  timeout: "destructive",
  adjust_aggression: "outline",
  cooldown_start: "destructive",
  cooldown_end: "outline",
};

export function BrainLogTable({ logs }: { logs: BrainLogEntrySerialized[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Brain Log (last 50)</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum log do brain ainda.</p>
        ) : (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead>Position</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <>
                      <TableRow
                        key={log.id}
                        className="cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <TableCell>
                          <ChevronRight
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {fmtTime(log.ts)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ACTION_VARIANT[log.action] ?? "secondary"}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.pairKey ?? "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.positionId ? log.positionId.slice(0, 8) : "-"}
                        </TableCell>
                      </TableRow>
                      {isExpanded && log.detail && (
                        <TableRow key={`${log.id}-detail`}>
                          <TableCell colSpan={5} className="bg-muted/30 p-3">
                            <pre className="text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
                              {JSON.stringify(log.detail, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
