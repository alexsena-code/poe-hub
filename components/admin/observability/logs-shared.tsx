// Shared types + helpers + tiny presentational atoms used by the Logs tab
// and its PostDetail child. Extracted from the original logs/page.tsx to
// keep each file under the 500-line threshold.

export interface ScanEntry {
  id: number;
  scanType: string;
  keywordsFound: number;
  newKeywords: number;
  rejected: number;
  durationMs: number | null;
  runAt: string;
}

export interface LlmCosts {
  days: number;
  total: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  byNode: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
  byDay: Record<string, { calls: number; costUsd: number }>;
}

export interface KeybertStatus {
  workerOnline: boolean;
  taskHistory: Array<{
    task: { id: string; modules: string[] };
    result?: { summary: Record<string, unknown>; error?: string; durationMs?: number };
    dispatchedAt: string;
    completedAt?: string;
  }>;
}

export interface RecentLlmCall {
  id: number;
  provider: string;
  model: string;
  nodeName: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  createdAt: string;
}

export interface PostSection {
  sectionId: string;
  title: string;
  tokensUsed: number;
  hasContent: boolean;
  contentLengthPtBr: number;
  contentLengthEn: number;
}

export interface PostSummary {
  slug: string;
  title: { 'pt-br': string; en: string };
  template: string;
  status: string;
  phase: string;
  generatedAt: string;
  updatedAt: string;
  totalTokens: number;
  estimatedCost: number;
  sectionCount: number;
  sections: PostSection[];
  briefing: {
    skill?: string;
    ascendancy?: string;
    topic?: string;
    league?: string;
    templateName?: string;
  } | null;
  // dataSnapshot is arbitrary research JSON coming from the engine; typing as
  // Record<string, any> here is intentional and matches the original file.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSnapshot: Record<string, any>;
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function scanTypeLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function StatusBadge({ status, phase }: { status: string; phase: string }) {
  const label = phase || status;
  const colors: Record<string, string> = {
    published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    writing: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    draft: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    ready: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${colors[label] || colors.draft}`}>
      {label}
    </span>
  );
}

export function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold ${accent ? 'text-accent' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

export function Tag({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border">
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      <span className="text-xs text-foreground font-medium">{value}</span>
    </div>
  );
}
