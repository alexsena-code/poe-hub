'use client';

// ---------------------------------------------------------------------------
// DbKeywordsTab — YouTube keywords imported into the SEO DB
// ---------------------------------------------------------------------------

import { useSort, SortHeader, Tip } from './primitives';
import { scoreColor, formatNumber, intentColor, viceColor, statusVariant } from './helpers';
import { StatusBadge } from '@/components/ui/status-badge';
import type { KeywordOpportunity } from './types';

interface Props {
  keywords: KeywordOpportunity[];
  loading: boolean;
}

export function DbKeywordsTab({ keywords, loading }: Props) {
  const { sorted, sortKey, sortDir, toggle } = useSort<KeywordOpportunity>(
    keywords,
    'trendingScore',
    'desc',
  );

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Loading keywords from database...</p>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">
          No YouTube keywords in database. Import trends data first or run a YouTube scan.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <th className="pb-2 pr-3 w-8">#</th>
            <SortHeader
              label="Keyword"
              active={sortKey === 'keyword'}
              dir={sortKey === 'keyword' ? sortDir : null}
              onToggle={() => toggle('keyword')}
              className="pb-2 pr-3"
              tip="Keyword imported from YouTube trends scan"
            />
            <SortHeader
              label="Cluster"
              active={sortKey === 'cluster'}
              dir={sortKey === 'cluster' ? sortDir : null}
              onToggle={() => toggle('cluster')}
              className="pb-2 pr-3"
              tip="Topic group (e.g. builds, crafting, league)"
            />
            <SortHeader
              label="Intent"
              active={sortKey === 'intent'}
              dir={sortKey === 'intent' ? sortDir : null}
              onToggle={() => toggle('intent')}
              className="pb-2 pr-3"
              tip="informational (learn), commercial (compare), transactional (buy/trade), navigational (find page)"
            />
            <SortHeader
              label="YT Views"
              active={sortKey === 'youtubeViews'}
              dir={sortKey === 'youtubeViews' ? sortDir : null}
              onToggle={() => toggle('youtubeViews')}
              className="pb-2 pr-3 text-right"
              tip="Total YouTube views across all videos about this keyword"
            />
            <SortHeader
              label="YT Videos"
              active={sortKey === 'youtubeCount'}
              dir={sortKey === 'youtubeCount' ? sortDir : null}
              onToggle={() => toggle('youtubeCount')}
              className="pb-2 pr-3 text-right"
              tip="Number of YouTube videos covering this keyword"
            />
            <SortHeader
              label="Trending"
              active={sortKey === 'trendingScore'}
              dir={sortKey === 'trendingScore' ? sortDir : null}
              onToggle={() => toggle('trendingScore')}
              className="pb-2 pr-3 text-right"
              tip="views × channels × videos / 1000. Higher = hotter topic"
            />
            <SortHeader
              label="VICE"
              active={sortKey === 'viceScore'}
              dir={sortKey === 'viceScore' ? sortDir : null}
              onToggle={() => toggle('viceScore')}
              className="pb-2 pr-3 text-right"
              tip="Volume, Intent, Competition, Effort — composite (0-5). Higher = better opportunity"
            />
            <SortHeader
              label="Status"
              active={sortKey === 'status'}
              dir={sortKey === 'status' ? sortDir : null}
              onToggle={() => toggle('status')}
              className="pb-2 pr-3"
              tip="new → approved → published (or rejected)"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((kw, i) => (
            <tr key={kw.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
              <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
              <td className="py-2 pr-3 font-medium text-foreground">{kw.keyword}</td>
              <td className="py-2 pr-3">
                {kw.cluster ? (
                  <span className="text-xs text-muted-foreground bg-surface-hover px-1.5 py-0.5 rounded">
                    {kw.cluster.replace(/_/g, ' ')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="py-2 pr-3">
                {kw.intent ? (
                  <span className={`text-xs ${intentColor(kw.intent)}`}>{kw.intent}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                {kw.youtubeViews != null ? formatNumber(kw.youtubeViews) : '-'}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                {kw.youtubeCount ?? '-'}
              </td>
              <td className={`py-2 pr-3 text-right tabular-nums ${scoreColor(kw.trendingScore ?? 0)}`}>
                {kw.trendingScore != null
                  ? kw.trendingScore.toLocaleString(undefined, { maximumFractionDigits: 1 })
                  : '-'}
              </td>
              <td className={`py-2 pr-3 text-right tabular-nums ${viceColor(kw.viceScore)}`}>
                {kw.viceScore != null ? kw.viceScore.toFixed(0) : '-'}
              </td>
              <td className="py-2 pr-3">
                <StatusBadge variant={statusVariant(kw.status)}>{kw.status}</StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
