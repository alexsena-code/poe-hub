'use client';

import React, { useState, useEffect } from 'react';

const API_URL = '/api/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageTotal {
  _sum: { costUsd: number | null; inputTokens: number | null; outputTokens: number | null };
  _count: number;
  _avg: { latencyMs: number | null };
}

interface UsageToday {
  _sum: { costUsd: number | null; inputTokens: number | null; outputTokens: number | null };
  _count: number;
}

interface ByModelEntry {
  provider: string;
  model: string;
  _sum: { costUsd: number | null };
  _count: number;
  _avg: { latencyMs: number | null };
}

interface ByNodeEntry {
  nodeName: string;
  _sum: { costUsd: number | null; inputTokens: number | null; outputTokens: number | null };
  _count: number;
  _avg: { latencyMs: number | null };
}

interface UsageData {
  total: UsageTotal;
  today: UsageToday;
  byModel: ByModelEntry[];
  byNode: ByNodeEntry[];
}

interface RecentCall {
  id: number;
  provider: string;
  model: string;
  nodeName: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Components
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LlmUsageTab() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [recent, setRecent] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [usageRes, recentRes] = await Promise.all([
          fetch(`${API_URL}/llm/usage`),
          fetch(`${API_URL}/llm/usage/recent?limit=50`),
        ]);
        if (!usageRes.ok) throw new Error(`Usage API: ${usageRes.status}`);
        if (!recentRes.ok) throw new Error(`Recent API: ${recentRes.status}`);
        setUsage(await usageRes.json());
        setRecent(await recentRes.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fmt = (n: number | null | undefined, decimals = 2) =>
    n != null ? n.toFixed(decimals) : '0';

  const fmtTokens = (n: number | null | undefined) => {
    if (n == null) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground mb-6">LLM Usage</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground mb-6">LLM Usage</h1>
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  const totalCost = usage?.total._sum.costUsd ?? 0;
  const todayCost = usage?.today._sum.costUsd ?? 0;
  const totalCalls = usage?.total._count ?? 0;
  const avgLatency = usage?.total._avg.latencyMs ?? 0;

  return (
    <div className="space-y-6 mt-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Cost" value={`$${fmt(totalCost, 4)}`} sub="all time" />
        <StatCard label="Today's Cost" value={`$${fmt(todayCost, 4)}`} sub="since midnight" />
        <StatCard label="Total Calls" value={totalCalls} />
        <StatCard label="Avg Latency" value={`${fmt(avgLatency, 0)}ms`} sub="across all calls" />
      </div>

      {/* By Model table */}
      {usage?.byModel && usage.byModel.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">By Model</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4 text-right">Calls</th>
                  <th className="py-2 pr-4 text-right">Cost</th>
                  <th className="py-2 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {usage.byModel.map((entry, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground">{entry.provider}</td>
                    <td className="py-2 pr-4 text-foreground font-mono text-xs">{entry.model}</td>
                    <td className="py-2 pr-4 text-right text-foreground">{entry._count}</td>
                    <td className="py-2 pr-4 text-right text-emerald-400">${fmt(entry._sum.costUsd, 4)}</td>
                    <td className="py-2 text-right text-muted-foreground">{fmt(entry._avg.latencyMs, 0)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Node table */}
      {usage?.byNode && usage.byNode.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">By Pipeline Node</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4">Node</th>
                  <th className="py-2 pr-4 text-right">Calls</th>
                  <th className="py-2 pr-4 text-right">Cost</th>
                  <th className="py-2 pr-4 text-right">Input Tokens</th>
                  <th className="py-2 pr-4 text-right">Output Tokens</th>
                  <th className="py-2 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {usage.byNode.map((entry, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground font-mono text-xs">{entry.nodeName}</td>
                    <td className="py-2 pr-4 text-right text-foreground">{entry._count}</td>
                    <td className="py-2 pr-4 text-right text-emerald-400">${fmt(entry._sum.costUsd, 4)}</td>
                    <td className="py-2 pr-4 text-right text-sky-400">{fmtTokens(entry._sum.inputTokens)}</td>
                    <td className="py-2 pr-4 text-right text-amber-400">{fmtTokens(entry._sum.outputTokens)}</td>
                    <td className="py-2 text-right text-muted-foreground">{fmt(entry._avg.latencyMs, 0)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent calls table */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">Recent Calls</h2>
        {recent.length === 0 ? (
          <div className="text-muted-foreground text-sm">No LLM calls recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Node</th>
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4 text-right">In</th>
                  <th className="py-2 pr-4 text-right">Out</th>
                  <th className="py-2 pr-4 text-right">Cost</th>
                  <th className="py-2 text-right">Latency</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((call) => (
                  <tr key={call.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(call.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-foreground font-mono text-xs">{call.nodeName}</td>
                    <td className="py-2 pr-4 text-foreground font-mono text-xs">
                      {call.provider}/{call.model}
                    </td>
                    <td className="py-2 pr-4 text-right text-sky-400">{fmtTokens(call.inputTokens)}</td>
                    <td className="py-2 pr-4 text-right text-amber-400">{fmtTokens(call.outputTokens)}</td>
                    <td className="py-2 pr-4 text-right text-emerald-400">${fmt(call.costUsd, 5)}</td>
                    <td className="py-2 text-right text-muted-foreground">{call.latencyMs}ms</td>
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
