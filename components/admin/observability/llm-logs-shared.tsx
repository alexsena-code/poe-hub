// Shared types + helpers for the LLM Logs tab. Extracted from the original
// /llm-logs page to keep each sub-component under the 500-line threshold.

export interface LogEntry {
  id: number;
  provider: string;
  model: string;
  nodeName: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

export interface LogDetail extends LogEntry {
  systemPrompt: string | null;
  userMessage: string | null;
  response: string | null;
}

export interface ByNodeStat {
  nodeName: string;
  calls: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
}

export interface DailyStat {
  date: string;
  calls: number;
  cost: number;
  avgLatency: number;
  errorRate: number;
}

export interface StatsOverall {
  totalCalls: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
}

export interface StatsData {
  byNode: ByNodeStat[];
  daily: DailyStat[];
  overall: StatsOverall;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LogsResponse {
  data: LogEntry[];
  pagination: Pagination;
}

export const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

export function fmt(n: number | null | undefined, decimals = 2) {
  return (n != null && !isNaN(n)) ? n.toFixed(decimals) : '0';
}

export function fmtTokens(n: number | null | undefined) {
  if (n == null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export function ContentBlock({ label, content }: { label: string; content: string | null }) {
  if (!content) return null;
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <pre className="bg-background border border-border rounded-md p-3 text-xs text-foreground font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
        {content}
      </pre>
    </div>
  );
}
