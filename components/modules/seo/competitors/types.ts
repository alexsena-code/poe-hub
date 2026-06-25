// Competitor entity as returned by GET /seo/competitors (engine DB-backed).
// source 'yaml' = migrated from legacy config YAML; 'manual' = added via this UI;
// 'auto_discover' = surfaced by the engine's discovery pipeline.
export type CompetitorSource = 'manual' | 'yaml' | 'auto_discover';

export interface Competitor {
  domain: string;
  sitemapUrl: string | null;
  pathFilter: string | null;
  categories: Record<string, string>;
  source: CompetitorSource;
  isActive: boolean;
  addedBy: string | null;
  createdAt: string;
}

export interface AddCompetitorPayload {
  domain: string;
  sitemapUrl?: string;
  pathFilter?: string;
  categories?: Record<string, string>;
  addedBy?: string;
}

export interface EditCompetitorPayload {
  sitemapUrl?: string;
  pathFilter?: string;
  categories?: Record<string, string>;
}

// Engine API response for mutating operations.
export type MutationResult =
  | { ok: true; domain: string }
  | { error: string };

// ---------------------------------------------------------------------------
// Crawl run types — GET /seo/competitors/crawl-runs
// ---------------------------------------------------------------------------

export type CrawlRunStatus = 'running' | 'completed' | 'failed';

export interface CrawlRun {
  id: string;
  // domain is null when the run targets all competitors at once
  domain: string | null;
  status: CrawlRunStatus;
  urlsFound: number;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  thin: number;
  errors: string[];
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

// Crawl trigger response — POST /seo/competitors/crawl
export type CrawlStartResult = { status: 'started' } | { error: string };
