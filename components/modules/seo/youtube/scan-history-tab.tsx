'use client';

// ---------------------------------------------------------------------------
// ScanHistoryTab — list of all scans with compare-two-scans feature
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect } from 'react';
import { useSort, SortHeader, Tip, YtBadge } from './primitives';
import { scoreColor, formatNumber, timeAgo, mapScanRecord } from './helpers';
import type { ScanRecord, CompareResult } from './types';

const API_URL = '/api/engine';

// ---------------------------------------------------------------------------
// CompareResults — rising / new / declining keyword breakdown between 2 scans
// ---------------------------------------------------------------------------

function CompareResults({
  result,
  scan1,
  scan2,
}: {
  result: CompareResult;
  scan1: number;
  scan2: number;
}) {
  const { rising, declining, newKeywords } = result;
  const risingSort = useSort<CompareResult['rising'][number]>(rising, 'delta', 'desc');
  const decliningSort = useSort<CompareResult['declining'][number]>(declining, 'delta', 'asc');

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground">
        Comparing scan #{scan1} vs #{scan2}
      </div>

      {/* Rising */}
      <div>
        <h3 className="text-sm font-bold text-emerald-400 mb-2">Rising ({rising.length})</h3>
        {rising.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rising keywords.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <SortHeader
                    label="Keyword"
                    active={risingSort.sortKey === 'keyword'}
                    dir={risingSort.sortKey === 'keyword' ? risingSort.sortDir : null}
                    onToggle={() => risingSort.toggle('keyword')}
                    className="pb-2 pr-3"
                  />
                  <SortHeader
                    label="Delta"
                    active={risingSort.sortKey === 'delta'}
                    dir={risingSort.sortKey === 'delta' ? risingSort.sortDir : null}
                    onToggle={() => risingSort.toggle('delta')}
                    className="pb-2 pr-3 text-right"
                    tip="Score change between scans"
                  />
                  <SortHeader
                    label="Current"
                    active={risingSort.sortKey === 'current'}
                    dir={risingSort.sortKey === 'current' ? risingSort.sortDir : null}
                    onToggle={() => risingSort.toggle('current')}
                    className="pb-2 pr-3 text-right"
                  />
                  <SortHeader
                    label="Previous"
                    active={risingSort.sortKey === 'previous'}
                    dir={risingSort.sortKey === 'previous' ? risingSort.sortDir : null}
                    onToggle={() => risingSort.toggle('previous')}
                    className="pb-2 pr-3 text-right"
                  />
                </tr>
              </thead>
              <tbody>
                {risingSort.sorted.map((kw) => (
                  <tr
                    key={kw.keyword}
                    className="border-b border-border/50 hover:bg-surface-hover transition-colors"
                  >
                    <td className="py-2 pr-3 font-medium text-foreground">{kw.keyword}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-400 font-medium">
                      +{kw.delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${scoreColor(kw.current)}`}>
                      {kw.current.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {kw.previous.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New */}
      <div>
        <h3 className="text-sm font-bold text-sky-400 mb-2">New ({newKeywords.length})</h3>
        {newKeywords.length === 0 ? (
          <p className="text-xs text-muted-foreground">No new keywords.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {newKeywords
              .sort((a, b) => b.score - a.score)
              .map((kw) => (
                <span
                  key={kw.keyword}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-900/20 border border-sky-900/30 text-sky-300 text-xs"
                >
                  {kw.keyword}
                  <span className={`tabular-nums text-[10px] ${scoreColor(kw.score)}`}>
                    {kw.score.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </span>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Declining */}
      <div>
        <h3 className="text-sm font-bold text-red-400 mb-2">Declining ({declining.length})</h3>
        {declining.length === 0 ? (
          <p className="text-xs text-muted-foreground">No declining keywords.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <SortHeader
                    label="Keyword"
                    active={decliningSort.sortKey === 'keyword'}
                    dir={decliningSort.sortKey === 'keyword' ? decliningSort.sortDir : null}
                    onToggle={() => decliningSort.toggle('keyword')}
                    className="pb-2 pr-3"
                  />
                  <SortHeader
                    label="Delta"
                    active={decliningSort.sortKey === 'delta'}
                    dir={decliningSort.sortKey === 'delta' ? decliningSort.sortDir : null}
                    onToggle={() => decliningSort.toggle('delta')}
                    className="pb-2 pr-3 text-right"
                    tip="Score change between scans"
                  />
                  <SortHeader
                    label="Current"
                    active={decliningSort.sortKey === 'current'}
                    dir={decliningSort.sortKey === 'current' ? decliningSort.sortDir : null}
                    onToggle={() => decliningSort.toggle('current')}
                    className="pb-2 pr-3 text-right"
                  />
                  <SortHeader
                    label="Previous"
                    active={decliningSort.sortKey === 'previous'}
                    dir={decliningSort.sortKey === 'previous' ? decliningSort.sortDir : null}
                    onToggle={() => decliningSort.toggle('previous')}
                    className="pb-2 pr-3 text-right"
                  />
                </tr>
              </thead>
              <tbody>
                {decliningSort.sorted.map((kw) => (
                  <tr
                    key={kw.keyword}
                    className="border-b border-border/50 hover:bg-surface-hover transition-colors"
                  >
                    <td className="py-2 pr-3 font-medium text-foreground">{kw.keyword}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-red-400 font-medium">
                      {kw.delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${scoreColor(kw.current)}`}>
                      {kw.current.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                      {kw.previous.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScanHistoryTab — main export
// ---------------------------------------------------------------------------

export function ScanHistoryTab() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const { sorted, sortKey, sortDir, toggle } = useSort<ScanRecord>(scans, 'date', 'desc');

  const fetchScans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/scans`);
      if (res.ok) {
        const raw = await res.json();
        setScans(Array.isArray(raw) ? raw.map(mapScanRecord) : []);
      }
    } catch { /* API offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) {
          // Replace the oldest selected with the new one
          const first = next.values().next().value;
          if (first !== undefined) next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
    // Clear previous comparison when selection changes
    setCompareResult(null);
    setCompareError(null);
  }

  async function runCompare() {
    const ids = Array.from(selected);
    if (ids.length !== 2) return;
    setComparing(true);
    setCompareError(null);
    setCompareResult(null);
    try {
      const res = await fetch(`${API_URL}/seo/youtube/compare?scan1=${ids[0]}&scan2=${ids[1]}`);
      if (res.ok) {
        setCompareResult(await res.json());
      } else {
        setCompareError('Compare failed: ' + (await res.text()));
      }
    } catch {
      setCompareError('Failed to connect to API');
    }
    setComparing(false);
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Loading scan history...
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No scans yet. Run a Quick Scan or Smart Scan first.</p>
      </div>
    );
  }

  const selectedIds = Array.from(selected);

  return (
    <div>
      {/* Selection controls */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-muted-foreground">
          {selected.size === 0 && 'Select 2 scans to compare'}
          {selected.size === 1 && 'Select 1 more scan to compare'}
          {selected.size === 2 && 'Ready to compare'}
        </span>
        {selected.size === 2 && (
          <button
            onClick={runCompare}
            disabled={comparing}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
          >
            {comparing ? 'Comparing...' : 'Compare'}
          </button>
        )}
        {selected.size > 0 && (
          <button
            onClick={() => {
              setSelected(new Set());
              setCompareResult(null);
              setCompareError(null);
            }}
            className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Scans table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="pb-2 pr-3 w-8" />
              <SortHeader
                label="ID"
                active={sortKey === 'id'}
                dir={sortKey === 'id' ? sortDir : null}
                onToggle={() => toggle('id')}
                className="pb-2 pr-3"
              />
              <SortHeader
                label="Type"
                active={sortKey === 'type'}
                dir={sortKey === 'type' ? sortDir : null}
                onToggle={() => toggle('type')}
                className="pb-2 pr-3"
                tip="quick = RSS only, smart = AI classification + transcripts"
              />
              <SortHeader
                label="Date"
                active={sortKey === 'date'}
                dir={sortKey === 'date' ? sortDir : null}
                onToggle={() => toggle('date')}
                className="pb-2 pr-3"
              />
              <SortHeader
                label="Videos"
                active={sortKey === 'videos'}
                dir={sortKey === 'videos' ? sortDir : null}
                onToggle={() => toggle('videos')}
                className="pb-2 pr-3 text-right"
                tip="Number of PoE videos found in this scan"
              />
              <SortHeader
                label="Keywords"
                active={sortKey === 'keywords'}
                dir={sortKey === 'keywords' ? sortDir : null}
                onToggle={() => toggle('keywords')}
                className="pb-2 pr-3 text-right"
                tip="Trending keywords extracted"
              />
              <SortHeader
                label="LLM Cost"
                active={sortKey === 'llmCost'}
                dir={sortKey === 'llmCost' ? sortDir : null}
                onToggle={() => toggle('llmCost')}
                className="pb-2 pr-3 text-right"
                tip="API cost for AI classification + keyword extraction"
              />
              <SortHeader
                label="Duration"
                active={sortKey === 'duration'}
                dir={sortKey === 'duration' ? sortDir : null}
                onToggle={() => toggle('duration')}
                className="pb-2 pr-3 text-right"
                tip="Total scan time in seconds"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((scan) => {
              const isSelected = selected.has(scan.id);
              return (
                <tr
                  key={scan.id}
                  onClick={() => toggleSelect(scan.id)}
                  className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${
                    isSelected ? 'bg-emerald-900/10 border-emerald-900/30' : ''
                  }`}
                >
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(scan.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded"
                    />
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-muted-foreground">{scan.id}</td>
                  <td className="py-2 pr-3">
                    <YtBadge
                      className={
                        scan.type === 'smart'
                          ? 'bg-purple-900/40 text-purple-300'
                          : 'bg-emerald-900/40 text-emerald-300'
                      }
                    >
                      {scan.type}
                    </YtBadge>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                    {timeAgo(scan.date)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                    {formatNumber(scan.videos)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                    {formatNumber(scan.keywords)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {scan.llmCost != null ? `$${scan.llmCost.toFixed(3)}` : '-'}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {scan.duration != null ? `${scan.duration}s` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {compareError && (
        <div className="text-sm text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg px-4 py-3 mb-4">
          {compareError}
        </div>
      )}

      {compareResult && (
        <CompareResults result={compareResult} scan1={selectedIds[0]} scan2={selectedIds[1]} />
      )}
    </div>
  );
}
