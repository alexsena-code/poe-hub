// ---------------------------------------------------------------------------
// Operations control center — action definitions
//
// Each Action describes one fire-and-forget endpoint the operator can trigger
// from the UI. `statusEndpoint`, when set, is polled every 2s while the
// action is "running" so we can surface live progress (Reddit/Ninja/KeyBERT).
// Other actions show only the immediate response toast + Recent Runs entry.
// ---------------------------------------------------------------------------

export type ActionCategory = 'crawl' | 'pipeline' | 'maintenance';

export interface Action {
  /** Stable id used as React key + state map key. */
  id: string;
  category: ActionCategory;
  title: string;
  description: string;
  /** Engine path under /api/engine (e.g. "/seo/cron/daily"). */
  endpoint: string;
  method: 'POST' | 'DELETE';
  /** Optional JSON body sent on trigger. */
  defaultBody?: Record<string, unknown>;
  /**
   * Optional GET endpoint that returns `{ running: boolean, ... }`. Polled
   * every 2s while the action is in "running" state. Reddit/Ninja/KeyBERT
   * expose this; the rest don't (caller relies on Recent Runs instead).
   */
  statusEndpoint?: string;
}

export const ACTIONS: Action[] = [
  // ---------------- Crawls ----------------
  {
    id: 'reddit-scan',
    category: 'crawl',
    title: 'Reddit scan',
    description: 'Crawl r/pathofexile + r/PathOfExile2 for recent posts.',
    endpoint: '/seo/scan/reddit',
    method: 'POST',
    defaultBody: { minScore: 50 },
    statusEndpoint: '/seo/scan/reddit/status',
  },
  {
    id: 'trends-fetch',
    category: 'crawl',
    title: 'Google Trends fetch',
    description: 'Fetch rising + top queries via the KeyBERT worker (or VPS fallback).',
    endpoint: '/seo/trends/fetch',
    method: 'POST',
  },
  {
    id: 'ninja-scan',
    category: 'crawl',
    title: 'poe.ninja validation',
    description: 'Cross-reference DB keywords with build meta on poe.ninja.',
    endpoint: '/seo/scan/ninja',
    method: 'POST',
    statusEndpoint: '/seo/scan/ninja/status',
  },
  {
    id: 'keybert-run',
    category: 'crawl',
    title: 'KeyBERT remote worker',
    description: 'Dispatch KeyBERT extraction task to the operator GPU worker.',
    endpoint: '/seo/keybert/run',
    method: 'POST',
    statusEndpoint: '/seo/keybert/status',
  },

  // ---------------- Pipelines ----------------
  {
    id: 'pipeline-full',
    category: 'pipeline',
    title: 'Full SEO pipeline',
    description: 'Extract → import → validate → expand → ingest → recalc → cross-ref. Skips crawls.',
    endpoint: '/seo/pipeline/full',
    method: 'POST',
  },
  {
    id: 'cron-daily',
    category: 'pipeline',
    title: 'Daily cron (manual)',
    description: 'Trigger the full nightly pipeline immediately (same as 0 6 UTC cron).',
    endpoint: '/seo/cron/daily',
    method: 'POST',
  },
  {
    id: 'trending-consolidate',
    category: 'pipeline',
    title: 'Recompute trending consolidation',
    description: 'Recalc TrendingTerm.consolidatedScore from last N days of KeywordOpportunity. Run BEFORE snapshot.',
    endpoint: '/seo/trending-terms/consolidate',
    method: 'POST',
    defaultBody: { days: 14 },
  },
  {
    id: 'snapshot',
    category: 'pipeline',
    title: 'Take keyword snapshot',
    description: 'Persist today’s editorial signals (striking/consol/predictedClicks30d/difficulty). Run AFTER consolidate.',
    endpoint: '/seo/keywords/snapshot',
    method: 'POST',
  },
  {
    id: 'llm-validate',
    category: 'pipeline',
    title: 'LLM research validation',
    description: 'Score keywords using Qdrant context + LLM judgement. Default limit 500.',
    endpoint: '/seo/keywords/llm-validate',
    method: 'POST',
    defaultBody: { limit: 500 },
  },

  // ---------------- Maintenance ----------------
  {
    id: 'bulk-classify',
    category: 'maintenance',
    title: 'Bulk classify',
    description: 'Run KeywordLlmClassifier across all keywords; updates intent/cluster/lang.',
    endpoint: '/seo/keywords/bulk-classify',
    method: 'POST',
    defaultBody: { scope: 'all' },
  },
  {
    id: 'bulk-cleanup',
    category: 'maintenance',
    title: 'Bulk cleanup',
    description: 'Reject trash keywords via LLM filter; reversible per row.',
    endpoint: '/seo/keywords/bulk-cleanup',
    method: 'POST',
    defaultBody: { scope: 'all' },
  },
  {
    id: 'dedup',
    category: 'maintenance',
    title: 'Dedup keywords',
    description: 'Semantic dedup (cosine ≥ 0.92) + drop outdated patch variants.',
    endpoint: '/seo/keywords/dedup',
    method: 'POST',
    defaultBody: { similarity: 0.92, dryRun: false },
  },
  {
    id: 'volume-enrich',
    category: 'maintenance',
    title: 'Volume enrichment',
    description: 'Enrich top keywords with Google Ads search volume data.',
    endpoint: '/seo/volume/enrich',
    method: 'POST',
    defaultBody: { limit: 50 },
  },
];

export interface PipelineRun {
  id: number;
  name: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface ActionStatus {
  running: boolean;
  step?: string;
  progress?: number;
  logs?: string[];
  result?: unknown;
}
