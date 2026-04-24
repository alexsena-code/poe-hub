// Shared SEO types — consumed by /seo/research, /seo/opportunities, /seo/analysis
// Extracted from /seo/research/page.tsx (1289L god file) during S03.d split.

export interface KeywordOpportunity {
  id: number;
  keyword: string;
  source: string;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
  ctr: number | null;
  searchVolume: number | null;
  wordCount: number;
  intent: string | null;
  cluster: string | null;
  viceScore: number | null;
  isLongTail: boolean;
  status: string;
  parentKeyword: string | null;
  competitorDomain: string | null;
  youtubeViews: number | null;
  youtubeCount: number | null;
  trendingScore: number | null;
  ninjaMatchName: string | null;
  ninjaPopularity: number | null;
  ninjaBuilds: number | null;
  discoveredAt: string;
}

export interface StrikingKeyword {
  keyword: string;
  impressions: number;
  clicks: number;
  position: number;
  ctr: number;
  opportunityScore: number;
  action: string;
}

export interface DashboardData {
  totalKeywords: number;
  strikingDistance: { count: number; top5: StrikingKeyword[] };
  ctrProblems: { count: number; top5: StrikingKeyword[] };
  topLongTail: KeywordOpportunity[];
  competitors: Array<{
    domain: string;
    totalPages: number;
    categories: Record<string, number>;
    lastCrawled: string | null;
  }>;
}

export interface ScanResult {
  id: number;
  scanType: string;
  keywordsFound: number;
  newKeywords: number;
  rejected: number;
  durationMs: number | null;
  runAt: string;
}

export interface BlacklistEntry {
  term: string;
}

export interface RampingEntry {
  keyword: string;
  currentVice: number;
  previousVice: number;
  delta: number;
  direction: string;
  youtubeViews: number;
  source: string;
  cluster: string;
}

// SERP analysis result — from POST /api/engine/seo/serp/analyze
export interface SerpResult {
  position: number;
  url: string;
  title: string;
  domain: string;
  isUs: boolean;
  isCompetitor: boolean;
}

// Full SERP analysis snapshot returned by GET /api/engine/seo/serp/latest
export interface SerpSnapshot {
  found: boolean;
  analysis?: {
    id: number;
    keyword: string;
    capturedAt: string;
    serpResults: SerpResult[];
  };
}

// Competitor analysis result — from GET /api/engine/seo/analyze/keyword
export interface CompetitorAnalysis {
  ourPosition: number | null;
  serpResults: SerpResult[];
  avgWordCount: number;
  avgHeadings: number;
  gap: string;
  recommendations: string[];
  pageAnalyses: Array<{
    title: string;
    domain: string;
    wordCount: number;
    hasSchema: boolean;
    images: number;
    internalLinks: number;
    metaDescription: string | null;
    h2: string[];
    keywordDensity: Record<string, number>;
  }>;
  error?: string;
}

export type SortDir = 'asc' | 'desc' | null;
