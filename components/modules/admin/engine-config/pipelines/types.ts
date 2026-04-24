// Shared types and static data for the Pipelines tab.
// Kept here so all sub-components import from one place instead of
// duplicating definitions across the module.

export const API = '/api/engine';

export interface PipelineLog {
  time: string;
  step: string;
  message: string;
}

export interface PipelineState {
  status: 'idle' | 'running' | 'done' | 'error';
  logs: PipelineLog[];
  startedAt?: number;
  finishedAt?: number;
  result?: unknown;
  error?: string;
  progress?: number;
  step?: string;
}

export interface PipelineCosts {
  total: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  byNode: Array<{ nodeName: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
  byDay: Array<{ date: string; calls: number; costUsd: number }>;
}

export interface PipelineConfigField {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'text';
  default: number | boolean | string;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  mode: 'fire' | 'poll' | 'sse';
  endpoint: string;
  statusEndpoint?: string | null;
  body?: Record<string, unknown>;
  configFields: PipelineConfigField[];
}

export const PIPELINES: PipelineDefinition[] = [
  {
    id: 'full-pipeline',
    name: 'Full Pipeline',
    description: 'Reddit extract → YT import → KeyBERT extraction → poe.ninja → Qdrant ingest → LLM Validate → VICE recalc → Semantic cross-ref (9 steps)',
    mode: 'fire',
    endpoint: '/seo/pipeline/full',
    configFields: [
      { key: 'maxSeeds', label: 'Max Seeds (suggest)', type: 'number', default: 10 },
    ],
  },
  {
    id: 'llm-keyword-validation',
    name: 'LLM Keyword Validation',
    description: 'Valida keywords via Qdrant context + LLM scoring (relevance, cluster)',
    mode: 'fire',
    endpoint: '/seo/keywords/llm-validate',
    configFields: [
      { key: 'limit', label: 'Max keywords', type: 'number', default: 500 },
    ],
  },
  {
    id: 'youtube-smart-scan',
    name: 'YouTube Smart Scan',
    description: 'RSS fetch + classificacao + transcripts + keywords LLM + scoring',
    mode: 'sse',
    endpoint: '/seo/youtube/smart-scan-stream',
    configFields: [
      { key: 'days', label: 'Dias', type: 'number', default: 30 },
      { key: 'maxTranscripts', label: 'Max Transcripts', type: 'number', default: 15 },
    ],
  },
  {
    id: 'reddit-crawl',
    name: 'Reddit Crawl (New)',
    description: 'Busca posts mais recentes dos subreddits PoE e salva no DB',
    mode: 'fire',
    endpoint: '/seo/reddit/crawl',
    body: { sort: 'new', time: 'day', maxPosts: 50, parallel: true },
    statusEndpoint: null,
    configFields: [],
  },
  {
    id: 'reddit-keywords',
    name: 'Reddit Keyword Scan',
    description: 'Extrai keywords dos posts Reddit via LLM (Gemini)',
    mode: 'poll',
    endpoint: '/seo/scan/reddit',
    statusEndpoint: '/seo/scan/reddit/status',
    configFields: [
      { key: 'minScore', label: 'Score minimo', type: 'number', default: 50 },
      { key: 'batchSize', label: 'Batch size', type: 'number', default: 60 },
      { key: 'regexOnly', label: 'Regex only (sem LLM)', type: 'boolean', default: false },
    ],
  },
  {
    id: 'suggest-scan',
    name: 'Google Suggest Expansion',
    description: 'Expande seed keywords via Google Suggest autocomplete',
    mode: 'fire',
    endpoint: '/seo/scan/suggest',
    configFields: [
      { key: 'seeds', label: 'Seeds (comma-separated)', type: 'text', default: 'poe builds,path of exile' },
    ],
  },
  {
    id: 'competitor-crawl',
    name: 'Competitor Sitemap Crawl',
    description: 'Crawl sitemaps de concorrentes para content gap analysis',
    mode: 'fire',
    endpoint: '/seo/competitors/crawl',
    configFields: [],
  },
  {
    id: 'gap-analysis',
    name: 'Competitor Gap Analysis',
    description: 'Cruza competitors com Qdrant + GSC + LLM para encontrar gaps de conteúdo',
    mode: 'fire',
    endpoint: '/seo/competitors/gap-analysis',
    configFields: [],
  },
  {
    id: 'youtube-monitor',
    name: 'YouTube Monitor (Quick)',
    description: 'Detecta novos uploads via RSS — sem transcripts, rapido',
    mode: 'fire',
    endpoint: '/seo/youtube/monitor',
    configFields: [],
  },
  {
    id: 'ninja-validation',
    name: 'poe.ninja Validation',
    description: 'Cruza keywords com dados de builds do poe.ninja (skills, classes, popularidade)',
    mode: 'poll',
    endpoint: '/seo/scan/ninja',
    statusEndpoint: '/seo/scan/ninja/status',
    configFields: [
      { key: 'force', label: 'Revalidar todos', type: 'boolean', default: false },
    ],
  },
  {
    id: 'semantic-crossref',
    name: 'Semantic Cross-Ref',
    description: 'Cruza keywords via Qdrant — valida YouTube keywords no Reddit e vice-versa',
    mode: 'fire',
    endpoint: '/seo/keywords/semantic-cross-ref',
    configFields: [
      { key: 'limit', label: 'Max keywords', type: 'number', default: 1100 },
      { key: 'minSimilarity', label: 'Min similarity', type: 'number', default: 0.80 },
    ],
  },
  {
    id: 'reddit-qdrant',
    name: 'Reddit → Qdrant',
    description: 'Ingere posts e comentários do Reddit no Qdrant (poe_reddit collection)',
    mode: 'fire',
    endpoint: '/knowledge/reddit/ingest',
    configFields: [
      { key: 'minScore', label: 'Score minimo', type: 'number', default: 5 },
      { key: 'limit', label: 'Max posts', type: 'number', default: 500 },
    ],
  },
  {
    id: 'youtube-qdrant',
    name: 'YouTube → Qdrant',
    description: 'Ingere vídeos e keywords do YouTube no Qdrant (poe_youtube_trends collection)',
    mode: 'fire',
    endpoint: '/knowledge/youtube/ingest',
    configFields: [
      { key: 'minViews', label: 'Views minimas', type: 'number', default: 100 },
    ],
  },
  {
    id: 'keyword-dedup',
    name: 'Keyword Dedup + Cleanup',
    description: 'Remove duplicate keywords (semantic similarity), outdated versions (<3.28), and PoE2 when focus is PoE1',
    mode: 'fire',
    endpoint: '/seo/keywords/dedup',
    configFields: [
      { key: 'similarity', label: 'Min similarity (0-1)', type: 'number', default: 0.92 },
      { key: 'dryRun', label: 'Dry run (just report)', type: 'boolean', default: false },
    ],
  },
  {
    id: 'daily-cron',
    name: 'Daily Pipeline (Cron)',
    description: 'Reddit 24h + YouTube 24h + Full keyword pipeline. Roda automaticamente as 06:00 UTC.',
    mode: 'fire',
    endpoint: '/seo/cron/daily',
    configFields: [],
  },
  {
    id: 'gsc-sync',
    name: 'Google Search Console Sync',
    description: 'Importa dados de queries, impressoes, clicks e posicoes do GSC',
    mode: 'fire',
    endpoint: '/seo/gsc/sync',
    configFields: [
      { key: 'days', label: 'Dias', type: 'number', default: 28 },
    ],
  },
];

// Maps SSE/poll step names to Tailwind color classes for the log viewer.
export const STEP_COLORS: Record<string, string> = {
  fetch: 'text-blue-400',
  classify: 'text-cyan-400',
  transcripts: 'text-purple-400',
  keywords: 'text-yellow-400',
  ingest: 'text-orange-400',
  validate: 'text-pink-400',
  scoring: 'text-green-400',
  report: 'text-emerald-400',
  done: 'text-green-300',
  start: 'text-muted-foreground',
  loading: 'text-blue-400',
  extracting: 'text-yellow-400',
  importing: 'text-cyan-400',
  error: 'text-red-400',
};
