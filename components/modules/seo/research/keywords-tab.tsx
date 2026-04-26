'use client';

// All Keywords tab — server-sorted + paginated keyword table with expandable
// VICE detail row (legacy debug panel; the inline VICE column itself was
// retired in session 32 / Frontend A in favour of 4 separate signal columns:
// `Striking`, `Diff`, `Consol`, `Clicks30d`).
// Pagination and sorting are server-side (engine API); client handles row expansion only.

import React from 'react';
import { SortHeader } from '../shared/seo-primitives';
import { sourceVariant, intentColor, clusterLabel, formatDateBR, API_URL } from '../shared/helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import type { KeywordOpportunity } from '../shared/types';

// Session 32 (Frontend A): difficulty badge styling matches the
// `bg-<color>-500/15 text-<color>-300` pattern used by GapsTable
// (components/admin/competitor-gaps/gaps-table.tsx) and ActionBadge
// (components/seo/posts-recommended/action-badge.tsx) for SEO-surface
// consistency. Spec: easy=emerald, medium=amber, hard=orange, blocked=red.
const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-emerald-500/15 text-emerald-300',
  medium: 'bg-amber-500/15 text-amber-300',
  hard: 'bg-orange-500/15 text-orange-300',
  blocked: 'bg-red-500/15 text-red-300',
};

function DifficultyBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const style = DIFFICULTY_STYLES[value] ?? 'bg-slate-500/15 text-slate-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono ${style}`}>
      {value}
    </span>
  );
}

/**
 * Color-coded 0-100 quality score badge. Red <30 (skip), amber 30-60
 * (consider), emerald >60 (write). Mirrors the difficulty badge styling
 * for visual consistency with the rest of the SEO surface.
 */
function QualityBadge({ value }: { value: number | null | undefined }) {
  if (value == null || Number.isNaN(value)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const style =
    value >= 60
      ? 'bg-emerald-500/15 text-emerald-300'
      : value >= 30
        ? 'bg-amber-500/15 text-amber-300'
        : 'bg-red-500/15 text-red-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono ${style}`}>
      {value.toFixed(0)}
    </span>
  );
}

function NumericMaybe({
  value,
  fractionDigits = 0,
}: {
  value: number | null | undefined;
  fractionDigits?: number;
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span>
      {value.toLocaleString('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })}
    </span>
  );
}

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
  // Session 33 (BUG 3 fix): surfacing the underlying fetch error +
  // signal/total discrepancy turns the silent "No keywords yet" empty
  // state into an actionable diagnostic.
  keywordsError?: string | null;
  totalKeywords?: number;
  dashboardTotal?: number | null;
  showWithoutSignals?: boolean;
}

export function KeywordsTab({
  keywords,
  loading,
  sortKey,
  sortDir,
  onSort,
  keywordsError,
  totalKeywords,
  dashboardTotal,
  showWithoutSignals,
}: KeywordsTabProps) {
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  // Discrepancy detector — only meaningful when "show without signals" is OFF
  // and the engine has more rows than what the signal-gated query returns.
  const hasDiscrepancy =
    !showWithoutSignals &&
    typeof totalKeywords === 'number' &&
    typeof dashboardTotal === 'number' &&
    dashboardTotal > 0 &&
    totalKeywords < dashboardTotal;

  return (
    <div className="space-y-3">
      {keywordsError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          <strong className="font-semibold">Engine error:</strong> {keywordsError}
        </div>
      )}
      {hasDiscrepancy && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <strong className="font-semibold">Heads up:</strong> {dashboardTotal} keywords cadastradas no engine,
          mas só {totalKeywords} têm sinais (GSC / Reddit / YouTube / SERP). Ative <em>&quot;Show without signals&quot;</em>
          {' '}no header pra ver as keywords recém-importadas (suggest scan, GSC import) que ainda não tiveram cross-ref.
        </div>
      )}
      <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <SortHeader label="Keyword" active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} onToggle={() => onSort('keyword')} className="px-3 py-2" />
            <SortHeader label="Quality" active={sortKey === 'qualityScore'} dir={sortKey === 'qualityScore' ? sortDir : null} onToggle={() => onSort('qualityScore')} className="px-3 py-2 w-20 text-center" tip="Composite 0-100 ranker (Session 36 Phase F): 25% consolidated demand, 20% LLM relevance, 20% predicted clicks, 10% striking, 10% intent, 8% long-tail, 7% LLM confidence. Red <30 = skip, amber = consider, emerald >60 = write." />
            <SortHeader label="Source" active={sortKey === 'source'} dir={sortKey === 'source' ? sortDir : null} onToggle={() => onSort('source')} className="px-3 py-2 w-20" tip="Where discovered: GSC, Suggest, YouTube, or Competitor" />
            <SortHeader label="Intent" active={sortKey === 'intent'} dir={sortKey === 'intent' ? sortDir : null} onToggle={() => onSort('intent')} className="px-3 py-2 w-24" tip="informational (how-to), commercial (best/compare), transactional (buy/sell), navigational" />
            <SortHeader label="Cluster" active={sortKey === 'cluster'} dir={sortKey === 'cluster' ? sortDir : null} onToggle={() => onSort('cluster')} className="px-3 py-2 w-28" tip="Content category: build guide, crafting, currency, tier list, atlas, league start, mechanic" />
            <SortHeader label="Striking" active={sortKey === 'strikingOpportunity'} dir={sortKey === 'strikingOpportunity' ? sortDir : null} onToggle={() => onSort('strikingOpportunity')} className="px-3 py-2 w-20 text-right" tip="GSC-based opportunity score (higher = bigger CTR/position upside)" />
            <SortHeader label="Diff" active={sortKey === 'personalizedDifficulty'} dir={sortKey === 'personalizedDifficulty' ? sortDir : null} onToggle={() => onSort('personalizedDifficulty')} className="px-3 py-2 w-16" tip="Personalized difficulty (DA-aware): easy / medium / hard / blocked" />
            <SortHeader label="Consol" active={sortKey === 'consolidatedScore'} dir={sortKey === 'consolidatedScore' ? sortDir : null} onToggle={() => onSort('consolidatedScore')} className="px-3 py-2 w-16 text-right" tip="Community demand consolidation score (0..100, weighted across signals)" />
            <SortHeader label="Clicks30d" active={sortKey === 'predictedClicks30d'} dir={sortKey === 'predictedClicks30d' ? sortDir : null} onToggle={() => onSort('predictedClicks30d')} className="px-3 py-2 w-20 text-right" tip="Predicted monthly clicks if keyword reaches the target Google position" />
            <SortHeader label="Imp" active={sortKey === 'impressions'} dir={sortKey === 'impressions' ? sortDir : null} onToggle={() => onSort('impressions')} className="px-3 py-2 w-16 text-right" tip="GSC impressions: how often this keyword appeared in Google search results" />
            <SortHeader label="Pos" active={sortKey === 'position'} dir={sortKey === 'position' ? sortDir : null} onToggle={() => onSort('position')} className="px-3 py-2 w-14 text-right" tip="Average Google position (1-100). Lower = better. 4-20 = striking distance" />
            <SortHeader label="CTR" active={sortKey === 'ctr'} dir={sortKey === 'ctr' ? sortDir : null} onToggle={() => onSort('ctr')} className="px-3 py-2 w-14 text-right" tip="clicks / impressions. Low CTR + high impressions = optimize title/meta" />
            <SortHeader label="YT Views" active={sortKey === 'youtubeViews'} dir={sortKey === 'youtubeViews' ? sortDir : null} onToggle={() => onSort('youtubeViews')} className="px-3 py-2 w-20 text-right" tip="Total YouTube views for videos about this topic" />
            <SortHeader label="Ninja" active={sortKey === 'ninjaPopularity'} dir={sortKey === 'ninjaPopularity' ? sortDir : null} onToggle={() => onSort('ninjaPopularity')} className="px-3 py-2 w-24" tip="poe.ninja build popularity (0-1). Higher = more builds use this skill/class" />
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Loading...</td></tr>
          ) : keywords.length === 0 ? (
            <tr>
              <td colSpan={14} className="px-3 py-10 text-center text-sm text-muted-foreground">
                {hasDiscrepancy
                  ? `Sem keywords com sinais. Ative "Show without signals" pra ver as ${dashboardTotal ?? '?'} cadastradas.`
                  : 'No keywords yet. Run a suggest scan or import GSC data.'}
              </td>
            </tr>
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
                  <td className="px-3 py-2 text-center">
                    <QualityBadge value={kw.qualityScore} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge variant={sourceVariant(kw.source)}>{kw.source}</StatusBadge>
                  </td>
                  <td className={`px-3 py-2 text-xs ${intentColor(kw.intent)}`}>{kw.intent ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {kw.cluster ? clusterLabel(kw.cluster) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    <NumericMaybe value={kw.strikingOpportunity} />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <DifficultyBadge value={kw.personalizedDifficulty} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    <NumericMaybe value={kw.consolidatedScore} fractionDigits={1} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    <NumericMaybe value={kw.predictedClicks30d} />
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
                  <tr><td colSpan={14} className="p-0"><KeywordDetailPanel kwId={kw.id} /></td></tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
