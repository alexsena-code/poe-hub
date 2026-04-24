// ---------------------------------------------------------------------------
// Helpers — YouTube Trends module
// Pure formatter / classifier functions — no React, no state.
// ---------------------------------------------------------------------------

import type { ScanRecordRaw, ScanRecord } from './types';

export function scoreColor(score: number): string {
  if (score >= 5000) return 'text-emerald-400 font-bold';
  if (score >= 1000) return 'text-emerald-300';
  if (score >= 500) return 'text-amber-300';
  if (score >= 100) return 'text-amber-400';
  return 'text-muted-foreground';
}

export function channelColor(channel: string): string {
  // Deterministic color based on channel name
  const colors = [
    'bg-blue-900/40 text-blue-300',
    'bg-emerald-900/40 text-emerald-300',
    'bg-red-900/40 text-red-300',
    'bg-amber-900/40 text-amber-300',
    'bg-purple-900/40 text-purple-300',
    'bg-pink-900/40 text-pink-300',
    'bg-cyan-900/40 text-cyan-300',
    'bg-indigo-900/40 text-indigo-300',
  ];
  let hash = 0;
  for (let i = 0; i < channel.length; i++) {
    hash = channel.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-';
  if (seconds >= 3600) {
    return `${Math.floor(seconds / 3600)}h${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;
  }
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}

export function intentColor(intent: string | null): string {
  switch (intent) {
    case 'informational': return 'text-sky-400';
    case 'commercial': return 'text-amber-400';
    case 'transactional': return 'text-red-400';
    case 'navigational': return 'text-purple-400';
    default: return 'text-muted-foreground';
  }
}

export function viceColor(score: number | null): string {
  if (!score) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-400 font-bold';
  if (score >= 60) return 'text-emerald-300';
  if (score >= 40) return 'text-amber-300';
  return 'text-red-300';
}

export function statusColor(status: string): string {
  switch (status) {
    case 'new': return 'bg-sky-900/40 text-sky-300';
    case 'approved': return 'bg-emerald-900/40 text-emerald-300';
    case 'rejected': return 'bg-red-900/40 text-red-300';
    case 'published': return 'bg-purple-900/40 text-purple-300';
    default: return 'bg-surface text-muted-foreground';
  }
}

export function mapScanRecord(raw: ScanRecordRaw): ScanRecord {
  return {
    id: raw.id,
    type: raw.scanType,
    date: raw.createdAt,
    videos: raw._count?.videos ?? raw.poeVideos ?? 0,
    keywords: raw._count?.keywords ?? 0,
    llmCost: raw.llmCostUsd,
    duration: raw.durationMs,
  };
}

// Known PoE entities used for keyword extraction from video titles in ChannelsTab
export const POE_ENTITIES = [
  'righteous fire', 'cyclone', 'tornado shot', 'lightning arrow', 'lightning strike',
  'boneshatter', 'spark', 'arc', 'ball lightning', 'essence drain', 'toxic rain',
  'detonate dead', 'spectral helix', 'flicker strike', 'kinetic blast', 'glacial cascade',
  'explosive arrow', 'holy relic', 'storm brand', 'penance brand', 'shock nova',
  'chieftain', 'deadeye', 'necromancer', 'elementalist', 'pathfinder', 'juggernaut',
  'slayer', 'gladiator', 'champion', 'assassin', 'trickster', 'inquisitor', 'guardian',
  'hierophant', 'berserker', 'saboteur', 'occultist',
  'atlas', 'mapping', 'crafting', 'delve', 'heist', 'harvest', 'ritual',
  'league start', 'mirage', 'currency', 'bleed bow', 'void shockwave',
] as const;

/** Extract PoE entities present in a video title (case-insensitive substring match). */
export function extractVideoKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  return POE_ENTITIES.filter((e) => lower.includes(e));
}
