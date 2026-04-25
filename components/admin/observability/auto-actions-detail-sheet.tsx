"use client";

// Session 33 (BUG 2 fix): detail sheet that opens when the operator clicks
// a pending_review row. Surfaces the metadata JSON, full reason, and a
// human-readable description of the actionType — everything that's hidden
// in the table cells. Approve/Reject duplicated in the footer for symmetry
// with the row-level buttons.

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { decideOnLog } from "@/app/(auth)/admin/auto-actions/actions";
import {
  actionTypeLabel,
  actionTypeDescription,
} from "./action-type-glossary";

export interface AutoActionDetailRow {
  id: number;
  actionType: string;
  decision: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
}

interface AutoActionsDetailSheetProps {
  row: AutoActionDetailRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoActionsDetailSheet({
  row,
  open,
  onOpenChange,
}: AutoActionsDetailSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(decision: "applied" | "rejected") {
    if (!row) return;
    setError(null);
    startTransition(async () => {
      const result = await decideOnLog(row.id, decision);
      if (!result.ok) {
        setError(result.error ?? "decision failed");
        toast.error(`Decisão falhou: ${result.error ?? "erro desconhecido"}`);
        return;
      }
      toast.success(decision === "applied" ? "Aprovado" : "Rejeitado");
      onOpenChange(false);
    });
  }

  if (!row) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg" />
      </Sheet>
    );
  }

  const metadataJson = formatMetadata(row.metadata);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">#{row.id}</span>
            <span>{actionTypeLabel(row.actionType)}</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            {actionTypeDescription(row.actionType)}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-4 text-sm">
          <DetailRow label="Time" value={formatTime(row.createdAt)} />
          <DetailRow label="Action type" value={row.actionType} mono />
          <DetailRow label="Decision" value={row.decision} mono />
          <DetailRow label="Target type" value={row.targetType ?? "—"} mono />
          <DetailRow label="Target id" value={row.targetId ?? "—"} mono breakAll />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Reason
            </div>
            <div className="text-sm text-foreground">{row.reason ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Metadata
            </div>
            <pre className="text-xs bg-background border border-border rounded p-3 overflow-x-auto whitespace-pre-wrap">
              {metadataJson}
            </pre>
          </div>
          {error && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        {row.decision === "pending_review" && (
          <SheetFooter className="gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => handle("rejected")}
              className="text-rose-300 border-rose-500/30 hover:bg-rose-500/10"
            >
              Reject
            </Button>
            <Button
              variant="default"
              disabled={isPending}
              onClick={() => handle("applied")}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Approve
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
  label,
  value,
  mono,
  breakAll,
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground w-24 shrink-0">
        {label}
      </div>
      <div
        className={`text-sm text-foreground ${mono ? "font-mono text-xs" : ""} ${breakAll ? "break-all" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return "{}";
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}
