"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { LlmLogsDailyChart } from "./llm-logs-chart";
import { LlmLogsTable } from "./llm-logs-table";
import {
  PERIODS,
  StatCard,
  daysAgoISO,
  fmt,
  type LogEntry,
  type LogsResponse,
  type Pagination,
  type StatsData,
} from "./llm-logs-shared";

// Extracted from the original /llm-logs page. Top-level "LLM" tab of the
// observability dashboard — shows overall stats, a daily cost/call chart,
// by-node breakdown, and a paginated filterable log entry table.

const API = '/api/engine';

export default function LlmLogsTab() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [period, setPeriod] = useState<number>(30);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);

  const [filterNode, setFilterNode] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterSuccess, setFilterSuccess] = useState<'' | 'true' | 'false'>('');

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const from = daysAgoISO(period);
      const res = await fetch(`${API}/llm/logs/stats?from=${from}`);
      if (!res.ok) throw new Error(`Stats API: ${res.status}`);
      setStats(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoadingStats(false);
    }
  }, [period]);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (filterNode) params.set('nodeName', filterNode);
      if (filterProvider) params.set('provider', filterProvider);
      if (filterSuccess) params.set('success', filterSuccess);
      const from = daysAgoISO(period);
      params.set('from', from);

      const res = await fetch(`${API}/llm/logs?${params}`);
      if (!res.ok) throw new Error(`Logs API: ${res.status}`);
      const data: LogsResponse = await res.json();
      setLogs(data.data);
      setPagination(data.pagination);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLoadingLogs(false);
    }
  }, [page, filterNode, filterProvider, filterSuccess, period]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page on filter change so operators don't get stranded on a page
  // that no longer exists under the new filter.
  useEffect(() => { setPage(1); }, [filterNode, filterProvider, filterSuccess, period]);

  const nodeNames = stats?.byNode?.map((n) => n.nodeName) ?? [];
  const providers = [...new Set(logs.map((l) => l.provider))].sort();
  const overall = stats?.overall ?? { totalCalls: 0, totalCost: 0, avgLatency: 0, errorRate: 0 };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Chamadas LLM detalhadas, custos e performance</p>
        <button
          onClick={() => { fetchStats(); fetchLogs(); }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPeriod(p.days)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors border ${
              period === p.days
                ? 'border-foreground text-foreground bg-surface'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loadingStats ? (
        <div className="text-muted-foreground text-sm">Loading stats...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Calls" value={overall.totalCalls} sub={`last ${period}d`} />
            <StatCard label="Total Cost" value={`$${fmt(overall.totalCost, 4)}`} sub={`last ${period}d`} />
            <StatCard label="Avg Latency" value={`${fmt(overall.avgLatency, 0)}ms`} />
            <StatCard label="Error Rate" value={`${fmt(overall.errorRate * 100, 1)}%`} />
          </div>

          {stats && <LlmLogsDailyChart daily={stats.daily} />}

          {stats?.byNode && stats.byNode.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">By Pipeline Node</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="py-2 pr-4">Node</th>
                      <th className="py-2 pr-4 text-right">Calls</th>
                      <th className="py-2 pr-4 text-right">Cost</th>
                      <th className="py-2 pr-4 text-right">Avg Latency</th>
                      <th className="py-2 text-right">Error Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byNode.map((n) => (
                      <tr key={n.nodeName} className="border-b border-border/50">
                        <td className="py-2 pr-4 text-foreground font-mono text-xs">{n.nodeName}</td>
                        <td className="py-2 pr-4 text-right text-foreground">{n.calls}</td>
                        <td className="py-2 pr-4 text-right text-emerald-400">${fmt(n.totalCost, 4)}</td>
                        <td className="py-2 pr-4 text-right text-muted-foreground">{fmt(n.avgLatency, 0)}ms</td>
                        <td className="py-2 text-right">
                          <span className={n.errorRate > 0 ? 'text-red-400' : 'text-muted-foreground'}>
                            {fmt(n.errorRate * 100, 1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <LlmLogsTable
        logs={logs}
        pagination={pagination}
        page={page}
        setPage={setPage}
        filterNode={filterNode}
        setFilterNode={setFilterNode}
        filterProvider={filterProvider}
        setFilterProvider={setFilterProvider}
        filterSuccess={filterSuccess}
        setFilterSuccess={setFilterSuccess}
        loading={loadingLogs}
        nodeNames={nodeNames}
        providers={providers}
      />
    </div>
  );
}
