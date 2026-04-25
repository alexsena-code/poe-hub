import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import {
  AutoActionsByDayChart,
  DiscoveriesByDayChart,
  type AutoActionDailyRow,
  type DiscoveriesDailyRow,
} from "@/components/admin/observability/auto-actions-chart";
import {
  AutoActionsPendingReview,
  type PendingRow,
} from "@/components/admin/observability/auto-actions-pending-review";

interface AutoActionLogRow {
  id: number;
  actionType: string;
  decision: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
}

interface AutoActionLogResponse {
  rows: AutoActionLogRow[];
  total: number;
  limit: number;
  offset: number;
  since: string;
}

const FETCH_LIMIT = 500;
const DAYS_WINDOW = 30;

async function fetchLog(): Promise<AutoActionLogResponse> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3001";
  const url = `${proto}://${host}/api/engine/seo/auto-actions/log?days=${DAYS_WINDOW}&limit=${FETCH_LIMIT}`;

  const res = await fetch(url, {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`auto-actions log fetch failed: ${res.status} (${url})`);
  }
  return res.json();
}

function bucketByDay(rows: AutoActionLogRow[]): AutoActionDailyRow[] {
  const map = new Map<string, AutoActionDailyRow>();
  for (const r of rows) {
    const date = r.createdAt.slice(5, 10); // MM-DD
    let entry = map.get(date);
    if (!entry) {
      entry = { date, applied: 0, pending_review: 0, skipped: 0 };
      map.set(date, entry);
    }
    if (r.decision === "applied") entry.applied++;
    else if (r.decision === "pending_review") entry.pending_review++;
    else if (r.decision === "skipped") entry.skipped++;
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function bucketDiscoveriesByDay(rows: AutoActionLogRow[]): DiscoveriesDailyRow[] {
  const map = new Map<string, DiscoveriesDailyRow>();
  for (const r of rows) {
    if (r.actionType !== "competitor_discover") continue;
    const date = r.createdAt.slice(5, 10);
    let entry = map.get(date);
    if (!entry) {
      entry = { date, applied: 0, pending_review: 0 };
      map.set(date, entry);
    }
    if (r.decision === "applied") entry.applied++;
    else if (r.decision === "pending_review") entry.pending_review++;
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export default async function AutoActionsPage() {
  let data: AutoActionLogResponse;
  try {
    data = await fetchLog();
  } catch (e) {
    return (
      <div className="p-6 max-w-[1800px] mx-auto">
        <PageHeader title="Auto-actions" description="SearxNG-driven keyword decisions" className="mb-6" />
        <div className="bg-surface border border-border rounded-lg p-4 text-sm text-destructive">
          Failed to load log: {(e as Error).message}
        </div>
      </div>
    );
  }

  const daily = bucketByDay(data.rows);
  const discoveries = bucketDiscoveriesByDay(data.rows);
  const pending: PendingRow[] = data.rows.filter(r => r.decision === "pending_review");

  return (
    <div className="p-6 max-w-[1800px] mx-auto space-y-6">
      <PageHeader
        title="Auto-actions"
        description={`SearxNG-driven keyword decisions — last ${DAYS_WINDOW} days, ${data.total} events logged`}
        className="mb-2"
      />

      <AutoActionsPendingReview rows={pending} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AutoActionsByDayChart daily={daily} />
        <DiscoveriesByDayChart daily={discoveries} />
      </div>

      <RecentTable rows={data.rows.slice(0, 50)} />
    </div>
  );
}

function RecentTable({ rows }: { rows: AutoActionLogRow[] }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <h2 className="text-sm font-semibold text-foreground p-4 uppercase tracking-wider">
        Recent decisions ({rows.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background border-y border-border text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Decision</th>
              <th className="text-left p-3">Target</th>
              <th className="text-left p-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-background/40">
                <td className="p-3 text-muted-foreground whitespace-nowrap">{formatTime(r.createdAt)}</td>
                <td className="p-3 font-mono text-xs">{r.actionType}</td>
                <td className="p-3"><DecisionBadge decision={r.decision} /></td>
                <td className="p-3 font-mono text-xs">{r.targetId ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{r.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const tone =
    decision === "applied" ? "bg-emerald-500/15 text-emerald-300"
    : decision === "pending_review" ? "bg-amber-500/15 text-amber-300"
    : "bg-slate-500/15 text-slate-300";
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${tone}`}>{decision}</span>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
