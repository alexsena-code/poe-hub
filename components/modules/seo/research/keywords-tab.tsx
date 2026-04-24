'use client';

// All Keywords tab — server-sorted + paginated keyword table with expandable VICE detail row.
// Pagination and sorting are server-side (engine API); client handles row expansion only.

import React from 'react';
import { SortHeader } from '../shared/seo-primitives';
import { sourceVariant, intentColor, viceColor, clusterLabel, formatDateBR, API_URL } from '../shared/helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import type { KeywordOpportunity } from '../shared/types';

// ---------------------------------------------------------------------------
// VICE breakdown bar (per sub-metric inside the expandable detail row)
// ---------------------------------------------------------------------------

function ViceBar({
  label,
  score,
  weight,
  color,
  detail,
}: {
  label: string;
  score: number;
  weight: number;
  color: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-muted-foreground shrink-0">
        {label} ({(weight * 100).toFixed(0)}%)
      </span>
      <div className="flex-1 h-3 bg-black/30 rounded overflow-hidden">
        <div className={`h-full rounded ${color}`} style={{ width: `${Math.max(2, score)}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-muted-foreground">{score.toFixed(0)}</span>
      <span className="text-[10px] text-muted-foreground/60 w-48 truncate" title={detail}>
        {detail}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyword VICE + semantic evidence detail panel (fetched on first expand)
// ---------------------------------------------------------------------------

function KeywordDetailPanel({ kwId }: { kwId: number }) {
  const [details, setDetails] = React.useState<Record<string, unknown> | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(true);

  React.useEffect(() => {
    setLoadingDetail(true);
    fetch(`${API_URL}/seo/keywords/${kwId}/details`)
      .then((r) => r.json())
      .then((d) => { setDetails(d); setLoadingDetail(false); })
      .catch(() => setLoadingDetail(false));
  }, [kwId]);

  if (loadingDetail) return <div className="px-4 py-3 text-xs text-muted-foreground">Loading details...</div>;
  if (!details) return <div className="px-4 py-3 text-xs text-red-400">Failed to load details</div>;

  const b = details.viceBreakdown as Record<string, Record<string, unknown>>;
  const evidence = details.semanticEvidence as Record<string, Array<{ score: number; title: string; source_score?: number }>> | null;
  const discoveredAt = details.discoveredAt as string;

  return (
    <div className="px-4 py-3 bg-black/20 border-t border-border/30 space-y-3">
      {/* VICE Breakdown */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
          VICE Breakdown (final: {b.final as number})
        </div>
        <div className="space-y-1">
          <ViceBar
            label="V - Volume"
            score={b.volume.score as number}
            weight={b.volume.weight as number}
            color="bg-blue-500"
            detail={`${b.volume.source}${b.volume.trendingBoost ? ` +trend:${b.volume.trendingBoost}` : ''}${b.volume.sourceAdj ? ` src:${Number(b.volume.sourceAdj) > 0 ? '+' : ''}${b.volume.sourceAdj}` : ''}${b.volume.ninjaAdj ? ` ninja:${Number(b.volume.ninjaAdj) > 0 ? '+' : ''}${b.volume.ninjaAdj}` : ''}`}
          />
          <ViceBar
            label="I - Intent"
            score={b.intent.score as number}
            weight={b.intent.weight as number}
            color="bg-amber-500"
            detail={b.intent.value as string}
          />
          <ViceBar
            label="C - Competition"
            score={b.competition.score as number}
            weight={b.competition.weight as number}
            color="bg-emerald-500"
            detail={`${b.competition.wordCount} words${b.competition.positionBonus ? ` +pos:${b.competition.positionBonus}` : ''}`}
          />
          <ViceBar
            label="E - Effort"
            score={b.effort.score as number}
            weight={b.effort.weight as number}
            color="bg-purple-500"
            detail={b.effort.cluster as string}
          />
        </div>
      </div>

      {/* Semantic Evidence */}
      {evidence && Object.keys(evidence).length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Semantic Evidence
          </div>
          {Object.entries(evidence).map(([collection, hits]) => (
            <div key={collection} className="mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">{collection}:</span>
              <ul className="ml-3">
                {hits.map((h, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground/80">
                    <span className="font-mono text-sky-400/80">{h.score.toFixed(3)}</span>{' '}
                    {h.title}
                    {h.source_score != null && (
                      <span className="text-muted-foreground/50 ml-1">(score: {h.source_score})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Source & Ninja info */}
      <div className="flex gap-6 text-[10px] text-muted-foreground/70 flex-wrap">
        <span>Source: <span className="text-muted-foreground">{details.source as string}</span></span>
        {details.parentKeyword && (
          <span>Parent: <span className="text-muted-foreground">{details.parentKeyword as string}</span></span>
        )}
        {details.ninjaMatchName && (
          <span>
            Ninja match: <span className="text-muted-foreground">{details.ninjaMatchName as string}</span>
            {' '}({(details.ninjaPopularity as number)?.toFixed(2)})
          </span>
        )}
        <span>Discovered: <span className="text-muted-foreground">{formatDateBR(discoveredAt)}</span></span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KeywordsTab — main table component
// ---------------------------------------------------------------------------

interface KeywordsTabProps {
  keywords: KeywordOpportunity[];
  loading: boolean;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}

export function KeywordsTab({ keywords, loading, sortKey, sortDir, onSort }: KeywordsTabProps) {
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <SortHeader label="Keyword" active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} onToggle={() => onSort('keyword')} className="px-3 py-2" />
            <SortHeader label="VICE" active={sortKey === 'viceScore'} dir={sortKey === 'viceScore' ? sortDir : null} onToggle={() => onSort('viceScore')} className="px-3 py-2 w-16" tip="Volume 20% + Intent 30% + Competition 30% + Effort 20%. Higher = better opportunity" />
            <SortHeader label="Source" active={sortKey === 'source'} dir={sortKey === 'source' ? sortDir : null} onToggle={() => onSort('source')} className="px-3 py-2 w-20" tip="Where discovered: GSC, Suggest, YouTube, or Competitor" />
            <SortHeader label="Intent" active={sortKey === 'intent'} dir={sortKey === 'intent' ? sortDir : null} onToggle={() => onSort('intent')} className="px-3 py-2 w-24" tip="informational (how-to), commercial (best/compare), transactional (buy/sell), navigational" />
            <SortHeader label="Cluster" active={sortKey === 'cluster'} dir={sortKey === 'cluster' ? sortDir : null} onToggle={() => onSort('cluster')} className="px-3 py-2 w-28" tip="Content category: build guide, crafting, currency, tier list, atlas, league start, mechanic" />
            <SortHeader label="Imp" active={sortKey === 'impressions'} dir={sortKey === 'impressions' ? sortDir : null} onToggle={() => onSort('impressions')} className="px-3 py-2 w-16 text-right" tip="GSC impressions: how often this keyword appeared in Google search results" />
            <SortHeader label="Pos" active={sortKey === 'position'} dir={sortKey === 'position' ? sortDir : null} onToggle={() => onSort('position')} className="px-3 py-2 w-14 text-right" tip="Average Google position (1-100). Lower = better. 4-20 = striking distance" />
            <SortHeader label="CTR" active={sortKey === 'ctr'} dir={sortKey === 'ctr' ? sortDir : null} onToggle={() => onSort('ctr')} className="px-3 py-2 w-14 text-right" tip="clicks / impressions. Low CTR + high impressions = optimize title/meta" />
            <SortHeader label="YT Views" active={sortKey === 'youtubeViews'} dir={sortKey === 'youtubeViews' ? sortDir : null} onToggle={() => onSort('youtubeViews')} className="px-3 py-2 w-20 text-right" tip="Total YouTube views for videos about this topic" />
            <SortHeader label="Ninja" active={sortKey === 'ninjaPopularity'} dir={sortKey === 'ninjaPopularity' ? sortDir : null} onToggle={() => onSort('ninjaPopularity')} className="px-3 py-2 w-24" tip="poe.ninja build popularity (0-1). Higher = more builds use this skill/class" />
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Loading...</td></tr>
          ) : keywords.length === 0 ? (
            <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No keywords yet. Run a suggest scan or import GSC data.</td></tr>
          ) : (
            keywords.map((kw) => (
              <React.Fragment key={kw.id}>
                <tr
                  className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${expandedId === kw.id ? 'bg-surface-hover' : ''}`}
                  onClick={() => setExpandedId(expandedId === kw.id ? null : kw.id)}
                >
                  <td className="px-3 py-2">
                    <span className="text-foreground">{kw.keyword}</span>
                    {kw.isLongTail && <span className="ml-1.5 text-[9px] text-emerald-400 font-medium">LT</span>}
                    {kw.parentKeyword && (
                      <span className="block text-[10px] text-muted-foreground">from: {kw.parentKeyword}</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 font-mono text-xs ${viceColor(kw.viceScore)}`}>
                    {kw.viceScore != null ? kw.viceScore.toFixed(0) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge variant={sourceVariant(kw.source)}>{kw.source}</StatusBadge>
                  </td>
                  <td className={`px-3 py-2 text-xs ${intentColor(kw.intent)}`}>{kw.intent ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {kw.cluster ? clusterLabel(kw.cluster) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.impressions?.toLocaleString() ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.position?.toFixed(1) ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.ctr != null ? `${(kw.ctr * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {kw.youtubeViews?.toLocaleString() ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {kw.ninjaPopularity != null ? (
                      <span className="flex items-center gap-1">
                        <span
                          className={`font-mono ${kw.ninjaPopularity >= 0.7 ? 'text-green-400' : kw.ninjaPopularity >= 0.3 ? 'text-yellow-400' : 'text-muted-foreground'}`}
                        >
                          {kw.ninjaPopularity.toFixed(2)}
                        </span>
                        {kw.ninjaMatchName && (
                          <span
                            className="text-[10px] text-muted-foreground truncate max-w-[80px]"
                            title={kw.ninjaMatchName}
                          >
                            {kw.ninjaMatchName}
                          </span>
                        )}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
                {expandedId === kw.id && (
                  <tr><td colSpan={10} className="p-0"><KeywordDetailPanel kwId={kw.id} /></td></tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
