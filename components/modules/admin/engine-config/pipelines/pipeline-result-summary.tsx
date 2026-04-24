'use client';

// Renders a structured summary grid + raw JSON toggle for a finished pipeline run.
// Stats are shaped per pipeline ID; falls back to generic top-level scalar keys.

import { useState } from 'react';

interface ResultStat {
  label: string;
  value: string;
}

function buildYoutubeStats(result: Record<string, unknown>): ResultStat[] {
  const stats: ResultStat[] = [];
  if (result.poe_videos !== undefined) stats.push({ label: 'PoE Videos', value: String(result.poe_videos) });
  if (result.channels_checked !== undefined) stats.push({ label: 'Channels', value: String(result.channels_checked) });
  const trending = result.trending_keywords;
  if (Array.isArray(trending)) stats.push({ label: 'Keywords', value: String(trending.length) });
  if (result.transcripts_fetched !== undefined) stats.push({ label: 'Transcripts', value: String(result.transcripts_fetched) });
  if (result.chunks_upserted !== undefined) stats.push({ label: 'Chunks', value: String(result.chunks_upserted) });
  const slang = result.slang_candidates;
  if (Array.isArray(slang) && slang.length) stats.push({ label: 'Slang', value: String(slang.length) });
  const usage = result.llm_usage as Record<string, unknown> | undefined;
  if (usage) {
    stats.push({ label: 'LLM Calls', value: String(usage.calls) });
    const costUsd = typeof usage.cost_usd === 'number' ? usage.cost_usd.toFixed(4) : '0';
    stats.push({ label: 'LLM Cost', value: `$${costUsd}` });
  }
  return stats;
}

function buildRedditStats(result: Record<string, unknown>): ResultStat[] {
  const stats: ResultStat[] = [];
  if (result.keywordsFound !== undefined) stats.push({ label: 'Keywords', value: String(result.keywordsFound) });
  if (result.newKeywords !== undefined) stats.push({ label: 'Novos', value: String(result.newKeywords) });
  if (result.rejected !== undefined) stats.push({ label: 'Rejeitados', value: String(result.rejected) });
  if (typeof result.durationMs === 'number') stats.push({ label: 'Duracao', value: `${(result.durationMs / 1000).toFixed(1)}s` });
  return stats;
}

function buildNinjaStats(result: Record<string, unknown>): ResultStat[] {
  const stats: ResultStat[] = [];
  if (result.total !== undefined) stats.push({ label: 'Total', value: String(result.total) });
  if (result.matched !== undefined) stats.push({ label: 'Matched', value: String(result.matched) });
  if (result.updated !== undefined) stats.push({ label: 'Updated', value: String(result.updated) });
  if (result.skipped !== undefined) stats.push({ label: 'Sem match', value: String(result.skipped) });
  if (typeof result.durationMs === 'number') stats.push({ label: 'Duracao', value: `${(result.durationMs / 1000).toFixed(1)}s` });
  return stats;
}

function buildGenericStats(result: Record<string, unknown>): ResultStat[] {
  // Generic: show all top-level non-object keys
  return Object.entries(result)
    .filter(([, val]) => typeof val !== 'object' || val === null)
    .map(([key, val]) => ({ label: key, value: String(val) }));
}

function buildStats(pipelineId: string, result: Record<string, unknown>): ResultStat[] {
  if (pipelineId === 'youtube-smart-scan') return buildYoutubeStats(result);
  if (pipelineId === 'reddit-keywords') return buildRedditStats(result);
  if (pipelineId === 'ninja-validation') return buildNinjaStats(result);
  return buildGenericStats(result);
}

interface PipelineResultSummaryProps {
  pipelineId: string;
  result: unknown;
}

export function PipelineResultSummary({ pipelineId, result }: PipelineResultSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  const safeResult = result !== null && typeof result === 'object' ? result as Record<string, unknown> : {};
  const stats = buildStats(pipelineId, safeResult);

  return (
    <div className="border-t border-border">
      {stats.length > 0 && (
        <div className="grid grid-cols-4 gap-2 p-3">
          {stats.slice(0, 8).map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              <div className="text-sm font-bold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-center py-1.5 text-[10px] text-muted-foreground hover:text-foreground border-t border-border"
      >
        {expanded ? 'Ocultar JSON' : 'Ver JSON completo'}
      </button>
      {expanded && (
        <pre className="p-3 text-[10px] text-foreground/70 font-mono max-h-64 overflow-y-auto whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
