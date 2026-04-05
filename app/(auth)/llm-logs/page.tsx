'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  ComposedChart, Area, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

const API = '/api/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogEntry {
  id: number;
  provider: string;
  model: string;
  nodeName: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface LogDetail extends LogEntry {
  systemPrompt: string | null;
  userMessage: string | null;
  response: string | null;
}

interface ByNodeStat {
  nodeName: string;
  calls: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
}

interface DailyStat {
  date: string;
  calls: number;
  cost: number;
  avgLatency: number;
  errorRate: number;
}

interface StatsOverall {
  totalCalls: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
}

interface StatsData {
  byNode: ByNodeStat[];
  daily: DailyStat[];
  overall: StatsOverall;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface LogsResponse {
  data: LogEntry[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function fmt(n: number | null | undefined, decimals = 2) {
  return (n != null && !isNaN(n)) ? n.toFixed(decimals) : '0';
}

function fmtTokens(n: number | null | undefined) {
  if (n == null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function ContentBlock({ label, content }: { label: string; content: string | null }) {
  if (!content) return null;
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <pre className="bg-background border border-border rounded-md p-3 text-xs text-foreground font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
        {content}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LlmLogsPage() {
  // Stats
  const [stats, setStats] = useState<StatsData | null>(null);
  const [period, setPeriod] = useState<number>(30);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);

  // Filters
  const [filterNode, setFilterNode] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterSuccess, setFilterSuccess] = useState<'' | 'true' | 'false'>('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<LogDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Loading states
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch stats ---
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

  // --- Fetch logs ---
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

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [filterNode, filterProvider, filterSuccess, period]);

  // --- Expand row ---
  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setExpandedDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API}/llm/logs/${id}`);
      if (!res.ok) throw new Error(`Detail API: ${res.status}`);
      setExpandedDetail(await res.json());
    } catch {
      // silent
    } finally {
      setLoadingDetail(false);
    }
  }

  // --- Distinct values for filter dropdowns ---
  const nodeNames = stats?.byNode?.map((n) => n.nodeName) ?? [];
  const providers = [...new Set(logs.map((l) => l.provider))].sort();

  // --- Chart data ---
  const chartData = (stats?.daily ?? []).map((d) => ({
    date: d.date.slice(5), // MM-DD
    cost: d.cost,
    calls: d.calls,
  }));

  const overall = stats?.overall ?? { totalCalls: 0, totalCost: 0, avgLatency: 0, errorRate: 0 };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">LLM Logs</h1>
          <p className="text-sm text-muted-foreground">Chamadas LLM detalhadas, custos e performance</p>
        </div>
        <button
          onClick={() => { fetchStats(); fetchLogs(); }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Period selector + Stats cards */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
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

          {/* Chart — Daily breakdown */}
          {chartData.length > 1 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Daily Breakdown</h2>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="cost"
                    orientation="left"
                    tick={{ fill: '#10b981', fontSize: 11 }}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <YAxis
                    yAxisId="calls"
                    orientation="right"
                    tick={{ fill: '#38bdf8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--surface))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    formatter={(value: number, name: string) =>
                      name === 'cost' ? [`$${value.toFixed(4)}`, 'Cost'] : [value, 'Calls']
                    }
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar
                    yAxisId="calls"
                    dataKey="calls"
                    fill="#38bdf8"
                    opacity={0.15}
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  />
                  <Area
                    yAxisId="cost"
                    type="monotone"
                    dataKey="cost"
                    stroke="#10b981"
                    fill="url(#colorCost)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* By Node breakdown */}
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

      {/* Logs table section */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">Log Entries</h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={filterNode}
            onChange={(e) => setFilterNode(e.target.value)}
            className="bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">All Nodes</option>
            {nodeNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">All Providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            value={filterSuccess}
            onChange={(e) => setFilterSuccess(e.target.value as '' | 'true' | 'false')}
            className="bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">All Status</option>
            <option value="true">Success</option>
            <option value="false">Errors</option>
          </select>
        </div>

        {loadingLogs ? (
          <div className="text-muted-foreground text-sm py-4">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-muted-foreground text-sm py-4">No log entries found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2 pr-3 w-6"></th>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Node</th>
                    <th className="py-2 pr-4">Provider / Model</th>
                    <th className="py-2 pr-4 text-right">Tokens In</th>
                    <th className="py-2 pr-4 text-right">Tokens Out</th>
                    <th className="py-2 pr-4 text-right">Cost</th>
                    <th className="py-2 pr-4 text-right">Latency</th>
                    <th className="py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-background/50 ${
                          !log.success ? 'bg-red-500/5' : ''
                        } ${expandedId === log.id ? 'bg-background/50' : ''}`}
                      >
                        <td className="py-2 pr-3 text-muted-foreground">
                          {expandedId === log.id ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground text-xs whitespace-nowrap">
                          {formatTime(log.createdAt)}
                        </td>
                        <td className="py-2 pr-4 text-foreground font-mono text-xs">{log.nodeName}</td>
                        <td className="py-2 pr-4 text-foreground font-mono text-xs">
                          {log.provider}/{log.model}
                        </td>
                        <td className="py-2 pr-4 text-right text-sky-400">{fmtTokens(log.inputTokens)}</td>
                        <td className="py-2 pr-4 text-right text-amber-400">{fmtTokens(log.outputTokens)}</td>
                        <td className="py-2 pr-4 text-right text-emerald-400">${fmt(log.costUsd, 5)}</td>
                        <td className="py-2 pr-4 text-right text-muted-foreground">{log.latencyMs}ms</td>
                        <td className="py-2 text-center">
                          {log.success ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 inline-block" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400 inline-block" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {expandedId === log.id && (
                        <tr>
                          <td colSpan={9} className="p-0">
                            <div className="bg-background/80 border-b border-border p-4 space-y-3">
                              {loadingDetail ? (
                                <div className="text-muted-foreground text-sm">Loading details...</div>
                              ) : expandedDetail ? (
                                <>
                                  {!expandedDetail.success && expandedDetail.errorMessage && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 text-sm text-red-400">
                                      <span className="font-semibold">Error:</span> {expandedDetail.errorMessage}
                                    </div>
                                  )}
                                  <ContentBlock label="System Prompt" content={expandedDetail.systemPrompt} />
                                  <ContentBlock label="User Message" content={expandedDetail.userMessage} />
                                  <ContentBlock label="Response" content={expandedDetail.response} />
                                </>
                              ) : (
                                <div className="text-muted-foreground text-sm">Failed to load details.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <div className="text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}
                {' '}-{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)}
                {' '}of {pagination.total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded border border-border text-foreground disabled:opacity-40 hover:bg-background transition-colors"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-muted-foreground">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="px-3 py-1 rounded border border-border text-foreground disabled:opacity-40 hover:bg-background transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
