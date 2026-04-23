// Shared types + helpers for the Analytics tab. Split out from the
// original 600+ line analytics-tab.tsx to keep each sub-panel focused.

export interface MomentumItem {
  keyword: string;
  delta: number;
  score: number;
  prevScore: number;
}

export interface NewKeyword {
  keyword: string;
  score: number;
  views?: number;
}

export interface CompareResult {
  rising: MomentumItem[];
  declining: MomentumItem[];
  newKeywords: NewKeyword[];
}

export interface ScanSummary {
  id: number;
  scanType: string;
  createdAt: string;
  _count?: { keywords: number; videos: number };
}

export interface KeywordHistoryPoint {
  scanId: number;
  scanDate: string;
  score: number;
}

export interface CrossSourceKeyword {
  keyword: string;
  source: string;
  trendingScore?: number | null;
  viceScore?: number | null;
  youtubeViews?: number | null;
}

export interface GscKeyword {
  keyword: string;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
  ctr: number | null;
  viceScore: number | null;
}

export interface PipelineCosts {
  total: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  byDay: Record<string, { calls: number; costUsd: number }>;
}

export function truncate(s: string, len: number) {
  return s.length > len ? s.slice(0, len) + '...' : s;
}

export function AnalyticsStatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold ${color} truncate`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const s = source.toLowerCase();
  let label = source;
  let classes = 'bg-gray-800 text-gray-300';

  if (s.includes('youtube') || s === 'yt') {
    label = 'YT';
    classes = 'bg-red-900/40 text-red-300';
  } else if (s.includes('reddit')) {
    label = 'Reddit';
    classes = 'bg-orange-900/40 text-orange-300';
  } else if (s.includes('gsc') || s.includes('google')) {
    label = 'GSC';
    classes = 'bg-blue-900/40 text-blue-300';
  } else if (s.includes('suggest')) {
    label = 'Suggest';
    classes = 'bg-purple-900/40 text-purple-300';
  }

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${classes}`}>
      {label}
    </span>
  );
}
