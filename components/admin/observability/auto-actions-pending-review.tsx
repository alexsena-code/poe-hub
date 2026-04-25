"use client";

// Session 29: pending_review queue with approve/reject buttons. Calls
// the Server Action defined in app/(auth)/admin/auto-actions/actions.ts;
// the action revalidatePath's the page so the row falls out of this
// section once decided.

import { useTransition, useState } from "react";
import { decideOnLog } from "@/app/(auth)/admin/auto-actions/actions";

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
      <h2 className="text-sm font-semibold text-foreground p-4 uppercase tracking-wider">
        Pending review ({rows.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background border-y border-border text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Target</th>
              <th className="text-left p-3">Reason</th>
              <th className="text-right p-3">Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <PendingRowItem key={r.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PendingRowItem({ row }: { row: PendingRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handle = (decision: "applied" | "rejected") => {
    setError(null);
    startTransition(async () => {
      const res = await decideOnLog(row.id, decision);
      if (!res.ok) setError(res.error ?? "decision failed");
    });
  };

  return (
    <tr className="border-b border-border/50 hover:bg-background/40">
      <td className="p-3 text-muted-foreground whitespace-nowrap">{formatTime(row.createdAt)}</td>
      <td className="p-3 font-mono text-xs">{row.actionType}</td>
      <td className="p-3 font-mono text-xs">{row.targetId ?? "—"}</td>
      <td className="p-3 text-xs text-muted-foreground">
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

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
