"use client";

/**
 * ComparePickerDialog — lets the operator pick a second run to compare against.
 *
 * Filters to same type as baseRun. Disables the baseRun itself.
 * On confirm, navigates to /admin/benchmark/compare?a=<baseId>&b=<otherId>.
 *
 * Session 01 S01.benchmark-history.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatDateTimeBr, formatCostUsd, formatDurationMs } from "@/lib/formatters";
import type { BenchmarkRunListRow, BenchmarkType } from "./history-types";

interface ComparePickerDialogProps {
  baseRunId: string;
  baseType: BenchmarkType;
  open: boolean;
  onClose: () => void;
}

type RunsResponse = { runs: BenchmarkRunListRow[]; total: number };

async function fetchRuns(url: string): Promise<RunsResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

export function ComparePickerDialog({
  baseRunId,
  baseType,
  open,
  onClose,
}: ComparePickerDialogProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Only fetch when open — SWR will cache after first load.
  const { data, isLoading } = useSWR<RunsResponse>(
    open ? `/api/benchmark/runs?type=${baseType}&limit=50` : null,
    fetchRuns,
  );

  function handleCompare() {
    if (!selectedId) return;
    router.push(`/admin/benchmark/compare?a=${baseRunId}&b=${selectedId}`);
    onClose();
  }

  // Candidates exclude the base run itself.
  const candidates = (data?.runs ?? []).filter((r) => r.id !== baseRunId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comparar com outro run</DialogTitle>
          <DialogDescription>
            Selecione um run do mesmo tipo ({baseType.replace("_", " ")}) para
            comparar side-by-side.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          )}

          {!isLoading && candidates.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum outro run do tipo {baseType.replace("_", " ")} disponivel.
            </p>
          )}

          {!isLoading &&
            candidates.map((run) => {
              const isSelected = run.id === selectedId;
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedId(run.id)}
                  className={cn(
                    "w-full text-left rounded-md border p-3 transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/30",
                  )}
                  data-testid={`compare-candidate-${run.id}`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-mono text-muted-foreground">
                      {run.id.slice(0, 8)}...
                    </span>
                    <Badge variant="outline" className="text-xs">
                      HTTP {run.httpStatus}
                    </Badge>
                    {run.preset && (
                      <Badge variant="secondary" className="text-xs">
                        {run.preset.name}
                      </Badge>
                    )}
                    {run.error && (
                      <Badge variant="destructive" className="text-xs">
                        erro
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                    <span>{formatDateTimeBr(run.createdAt)}</span>
                    <span>{formatCostUsd(run.totalCostUsd)}</span>
                    <span>{formatDurationMs(run.totalDurationMs)}</span>
                  </div>
                </button>
              );
            })}
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCompare} disabled={!selectedId}>
            Comparar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
