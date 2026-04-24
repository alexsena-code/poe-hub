// ---------------------------------------------------------------------------
// Types — YouTube Trends module
// ---------------------------------------------------------------------------

export interface TrendingKeyword {
  keyword: string;
  video_count: number;
  total_views: number;
  channels: string[];
  trending_score: number;
  qdrant_relevance?: number;
  from_transcript?: boolean;
}

export interface AggregatedKeyword {
  keyword: string;
  total_mentions: number;
  total_views: number;
  video_count: number;
  max_trending_score: number;
  avg_trending_score: number;
  channels: string[];
  channel_count: number;
  momentum: string[];
  first_seen: string;
  last_seen: string;
  scan_count: number;
  from_transcript: boolean;
  confirmed: boolean;
  qdrant_relevance: number | null;
  pg_match: boolean | null;
  pg_type: string | null;
  score_history: Array<{ scanId: number; date: string; score: number }>;
}

export interface AggregatedKeywordsResponse {
  keywords: AggregatedKeyword[];
  mode: 'aggregated' | 'single_scan';
  totalScans: number;
  totalUniqueKeywords?: number;
  scanId?: number;
}

export interface ActiveChannel {
  channel: string;
  videos: number;
}

export interface Video {
  id: string;
  title: string;
  channel: string;
  channel_id: string;
  views: number;
  published: string;
  url: string;
  is_live?: boolean;
  is_short?: boolean;
  duration?: number;
  tags?: string[];
}

export interface YouTubeTrendsData {
  total_videos: number;
  poe_videos: number;
  channels_checked: number;
  trending_keywords: TrendingKeyword[];
  active_channels: ActiveChannel[];
  scan_timestamp: string;
  videos: Video[];
}

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
  youtubeViews: number | null;
  youtubeCount: number | null;
  trendingScore: number | null;
  discoveredAt: string;
}

// Used internally in ScanHistoryTab — raw API shape before mapping
export interface ScanRecordRaw {
  id: number;
  scanType: string;
  createdAt: string;
  channelsChecked: number;
  totalVideos: number;
  poeVideos: number;
  transcriptsFetched: number;
  llmCostUsd: number | null;
  durationMs: number | null;
  _count: { videos: number; keywords: number };
}

export interface ScanRecord {
  id: number;
  type: string;
  date: string;
  videos: number;
  keywords: number;
  llmCost: number | null;
  duration: number | null;
}

export interface CompareResult {
  rising: Array<{ keyword: string; delta: number; current: number; previous: number }>;
  declining: Array<{ keyword: string; delta: number; current: number; previous: number }>;
  newKeywords: Array<{ keyword: string; score: number }>;
}

export interface NewUploadVideo {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  views: number;
  published: string;
  url: string;
  is_live: boolean;
  duration: number | null;
  detectedAt: string;
}

export interface MonitoredChannel {
  id: number;
  name: string;
  channelId: string;
  channel_id?: string;
  youtubeUrl: string;
  youtube_url?: string;
  createdAt: string;
  added_at?: string;
}

export type Tab =
  | 'trending'
  | 'top-videos'
  | 'channels'
  | 'videos'
  | 'new-uploads'
  | 'db-keywords'
  | 'scan-history'
  | 'manage-channels';

export type SortDir = 'asc' | 'desc' | null;

export type TimeRange = '24' | '48' | '168';
