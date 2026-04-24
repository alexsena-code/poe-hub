"use client";

/**
 * RunDetailSheet — slide-over panel for a single BenchmarkRun.
 *
 * Shows full requestBody, response, and telemetry events in collapsible
 * sections. Rendered inside the history-client island.
 *
 * Session 01 S01.benchmark-history.
 */

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTimeBr, formatCostUsd, formatDurationMs } from "@/lib/formatters";
import type { BenchmarkRunDetail } from "./history-types";

interface RunDetailSheetProps {
  run: BenchmarkRunDetail | null;
  open: boolean;
  onClose: () => void;
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="text-xs bg-muted/30 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-0 text-sm font-semibold text-foreground hover:bg-transparent"
        >
          {title}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function RunDetailSheet({ run, open, onClose }: RunDetailSheetProps) {
  if (!run) return null;

  const isError = run.error !== null || run.httpStatus >= 400;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Run Detail
            <Badge variant={isError ? "destructive" : "secondary"} className="font-mono text-xs">
              HTTP {run.httpStatus}
            </Badge>
            <Badge variant="outline" className="text-xs uppercase">
              {run.type.replace("_", " ")}
            </Badge>
          </SheetTitle>
          <SheetDescription asChild>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Criado:</span>{" "}
                {formatDateTimeBr(run.createdAt)}
              </div>
              <div className="flex gap-4 flex-wrap">
                <span>
                  <span className="font-medium">Custo:</span>{" "}
                  {formatCostUsd(run.totalCostUsd)}
                </span>
                <span>
                  <span className="font-medium">Duracao:</span>{" "}
                  {formatDurationMs(run.totalDurationMs)}
                </span>
                <span>
                  <span className="font-medium">LLM:</span> {run.llmCallCount}
                </span>
                <span>
                  <span className="font-medium">Qdrant:</span> {run.qdrantQueryCount}
                </span>
              </div>
              {run.preset && (
                <div>
                  <span className="font-medium">Preset:</span> {run.preset.name}
                </div>
              )}
              {Object.keys(run.modelOverrides).length > 0 && (
                <div>
                  <span className="font-medium">Model overrides:</span>{" "}
                  <code className="text-xs bg-muted px-1 rounded">
                    {JSON.stringify(run.modelOverrides)}
                  </code>
                </div>
              )}
              {run.error && (
                <div className="text-destructive">
                  <span className="font-medium">Erro:</span> {run.error}
                </div>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 divide-y divide-border/50">
          <CollapsibleSection title="Request Body" defaultOpen>
            <JsonBlock value={run.requestBody} />
          </CollapsibleSection>

          <div className="pt-2">
            <CollapsibleSection title="Response">
              <JsonBlock value={run.response} />
            </CollapsibleSection>
          </div>

          {run.evaluationsAsA.length > 0 || run.evaluationsAsB.length > 0 ? (
            <div className="pt-2">
              <CollapsibleSection title="Evaluations">
                <div className="space-y-1 text-sm">
                  {run.evaluationsAsA.map((ev) => (
                    <div key={ev.id} className="text-muted-foreground">
                      vs. run {ev.runBId?.slice(0, 8)}... — judge: {ev.judgeModel}
                    </div>
                  ))}
                  {run.evaluationsAsB.map((ev) => (
                    <div key={ev.id} className="text-muted-foreground">
                      vs. run {ev.runAId?.slice(0, 8)}... — judge: {ev.judgeModel}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
