"use client";

// Session 29: pending_review queue with approve/reject buttons. Calls
// the Server Action defined in app/(auth)/admin/auto-actions/actions.ts;
// the action revalidatePath's the page so the row falls out of this
// section once decided.
//
// Session 33 (BUG 2 fix): added multi-select + bulk approve/reject +
// reject-all-pending + detail sheet. With 128 pending rows the row-by-row
// flow was unworkable; the bulk path drains the queue in one operator
// click while preserving the per-row escape hatch.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  bulkDecideAction,
  decideOnLog,
  rejectAllPendingAction,
} from "@/app/(auth)/admin/auto-actions/actions";
import {
  AutoActionsDetailSheet,
  type AutoActionDetailRow,
} from "./auto-actions-detail-sheet";

export interface PendingRow {
  id: number;
  actionType: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
}

export function AutoActionsPendingReview({ rows }: { rows: PendingRow[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeRow, setActiveRow] = useState<AutoActionDetailRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isBulkPending, startBulk] = useTransition();
  const [isRejectAllPending, startRejectAll] = useTransition();

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const selectedCount = selectedIds.size;

  const validIds = useMemo(
    () => rows.map(r => r.id).filter(id => selectedIds.has(id)),
    [rows, selectedIds],
  );

  function toggleAll() {
    if (allSelected || someSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map(r => r.id)));
    }
  }

  function toggleOne(id: number, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openDetail(row: PendingRow) {
    setActiveRow({ ...row, decision: "pending_review" });
    setSheetOpen(true);
  }

  function handleBulk(decision: "applied" | "rejected") {
    if (validIds.length === 0) return;
    startBulk(async () => {
      const result = await bulkDecideAction(validIds, decision);
      if (!result.ok && result.error) {
        toast.error(`Falha bulk: ${result.error}`);
        return;
      }
      const failedSuffix = result.failed ? ` · ${result.failed} falharam` : "";
      toast.success(
        `${decision === "applied" ? "Aprovados" : "Rejeitados"}: ${result.succeeded ?? 0}${failedSuffix}`,
      );
      setSelectedIds(new Set());
    });
  }

  function handleRejectAll() {
    startRejectAll(async () => {
      const result = await rejectAllPendingAction();
      if (!result.ok) {
        toast.error(`Falha reject-all: ${result.error ?? "erro desconhecido"}`);
        return;
      }
      toast.success(`Rejeitados: ${result.rejected ?? 0}`);
      setSelectedIds(new Set());
    });
  }

  if (rows.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">
          Pending review (0)
        </h2>
        <div className="text-sm text-muted-foreground">
          No edge-case decisions waiting — auto-actions either applied or skipped them all.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-amber-500/30 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Pending review ({rows.length})
          {selectedCount > 0 && (
            <span className="ml-3 text-xs font-normal text-muted-foreground normal-case tracking-normal">
              {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            disabled={selectedCount === 0 || isBulkPending}
            onClick={() => handleBulk("applied")}
            className="text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            Approve {selectedCount > 0 ? selectedCount : ""}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedCount === 0 || isBulkPending}
            onClick={() => handleBulk("rejected")}
            className="text-rose-300 border-rose-500/30 hover:bg-rose-500/10"
          >
            Reject {selectedCount > 0 ? selectedCount : ""}
          </Button>
          <RejectAllDialog
            count={rows.length}
            disabled={isRejectAllPending}
            onConfirm={handleRejectAll}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background border-y border-border text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left p-3 w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Target</th>
              <th className="text-left p-3">Reason</th>
              <th className="text-right p-3">Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <PendingRowItem
                key={r.id}
                row={r}
                selected={selectedIds.has(r.id)}
                onToggle={checked => toggleOne(r.id, checked)}
                onOpen={() => openDetail(r)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <AutoActionsDetailSheet row={activeRow} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}

interface PendingRowItemProps {
  row: PendingRow;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onOpen: () => void;
}

function PendingRowItem({ row, selected, onToggle, onOpen }: PendingRowItemProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handle = (decision: "applied" | "rejected") => {
    setError(null);
    startTransition(async () => {
      const res = await decideOnLog(row.id, decision);
      if (!res.ok) {
        setError(res.error ?? "decision failed");
        toast.error(`Decisão falhou: ${res.error ?? "erro desconhecido"}`);
      } else {
        toast.success(decision === "applied" ? "Aprovado" : "Rejeitado");
      }
    });
  };

  return (
    <tr
      className={`border-b border-border/50 hover:bg-background/40 ${selected ? "bg-amber-500/5" : ""}`}
    >
      <td className="p-3 align-middle" onClick={e => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={checked => onToggle(checked === true)}
          aria-label={`Select ${row.id}`}
        />
      </td>
      <td className="p-3 text-muted-foreground whitespace-nowrap cursor-pointer" onClick={onOpen}>
        {formatTime(row.createdAt)}
      </td>
      <td className="p-3 font-mono text-xs cursor-pointer" onClick={onOpen}>
        {row.actionType}
      </td>
      <td className="p-3 font-mono text-xs cursor-pointer break-all max-w-[260px]" onClick={onOpen}>
        {row.targetId ?? "—"}
      </td>
      <td className="p-3 text-xs text-muted-foreground cursor-pointer" onClick={onOpen}>
        {row.reason ?? ""}
        {error && <div className="text-destructive mt-1">{error}</div>}
      </td>
      <td className="p-3 text-right whitespace-nowrap">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handle("applied")}
          className="px-2 py-1 rounded text-xs bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 mr-2"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handle("rejected")}
          className="px-2 py-1 rounded text-xs bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"
        >
          Reject
        </button>
      </td>
    </tr>
  );
}

function RejectAllDialog({
  count,
  disabled,
  onConfirm,
}: {
  count: number;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          className="text-rose-300 border-rose-500/40 hover:bg-rose-500/10"
        >
          Reject all pending
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rejeitar todas as {count} pendências?</AlertDialogTitle>
          <AlertDialogDescription>
            Marca cada uma das {count} decisões pending_review como rejected. Operação reversível
            apenas via DB direto. Use quando o queue está dominado por sinal fraco que você não
            quer revisar manualmente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Rejeitar todas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
