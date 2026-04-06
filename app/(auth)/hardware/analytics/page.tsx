"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, BarChart3, TrendingUp, RefreshCw, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SummaryItem {
  item_name: string;
  source?: string;
  min_price: number;
  avg_price: number;
  max_price: number;
  count?: number;
  total_deals?: number;
}

interface Deal {
  id: number;
  item_name: string;
  title: string;
  price: number;
  source: string;
  url: string;
  location: string;
  found_at: string;
  category: string;
}

interface PriceHistoryEntry {
  source: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  deal_count: number;
  recorded_at: string;
}

interface PriceCompItem {
  item_name: string;
  category: string;
  max_price: number;
  olx_min: number | null;
  olx_avg: number | null;
  olx_count: number;
  price_new: number | null;
  price_aliexpress: number | null;
  savings_pct: number | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const LINE_COLORS = [
  "#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24",
  "#fb923c", "#60a5fa", "#e879f9", "#4ade80", "#f87171",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HardwareAnalyticsPage() {
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistoryEntry[]>>({});
  const [priceComparison, setPriceComparison] = useState<PriceCompItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistItem, setSelectedDistItem] = useState("");
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState("avg_price");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const itemNames = useMemo(
    () => [...new Set(summary.map((s) => s.item_name))].sort(),
    [summary]
  );

  // ---- Fetch ----
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sumRes, dealsRes, compRes] = await Promise.all([
          fetch(`${HARDWARE_API}/api/deals/summary`),
          fetch(`${HARDWARE_API}/api/deals?limit=2000`),
          fetch(`${HARDWARE_API}/api/analytics/price-comparison`).catch(() => null),
        ]);
        if (sumRes.ok) {
          const data: SummaryItem[] = await sumRes.json();
          setSummary(data);
          if (data.length > 0) {
            setSelectedDistItem(data[0].item_name);
            setSelectedHistoryItems([data[0].item_name]);
          }
        }
        if (dealsRes.ok) setDeals(await dealsRes.json());
        if (compRes?.ok) setPriceComparison(await compRes.json());
      } catch {
        toast.error("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedHistoryItems.length === 0) return;
    async function fetchHistory() {
      const newHistory: Record<string, PriceHistoryEntry[]> = {};
      await Promise.all(
        selectedHistoryItems.map(async (name) => {
          if (priceHistory[name]) {
            newHistory[name] = priceHistory[name];
            return;
          }
          try {
            const res = await fetch(
              `${HARDWARE_API}/api/price-history/${encodeURIComponent(name)}?days=60`
            );
            if (res.ok) newHistory[name] = await res.json();
          } catch { /* ignore */ }
        })
      );
      setPriceHistory((prev) => ({ ...prev, ...newHistory }));
    }
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHistoryItems]);

  // ---- Aggregated summary ----
  const aggregated = useMemo(() => {
    const map = new Map<string, { item_name: string; min_price: number; avg_price: number; max_price: number; count: number }>();
    for (const s of summary) {
      const cnt = s.count ?? s.total_deals ?? 1;
      const existing = map.get(s.item_name);
      if (existing) {
        existing.min_price = Math.min(existing.min_price, s.min_price);
        existing.max_price = Math.max(existing.max_price, s.max_price);
        existing.count += cnt;
        existing.avg_price = (existing.avg_price * (existing.count - cnt) + s.avg_price * cnt) / existing.count;
      } else {
        map.set(s.item_name, { item_name: s.item_name, min_price: s.min_price, avg_price: s.avg_price, max_price: s.max_price, count: cnt });
      }
    }
    return [...map.values()].sort((a, b) => b.avg_price - a.avg_price);
  }, [summary]);

  // ---- Used vs New comparison chart data ----
  const comparisonChartData = useMemo(() => {
    return priceComparison
      .filter((p) => p.olx_min || p.price_new)
      .map((p) => ({
        item: p.item_name,
        olx_min: p.olx_min ?? 0,
        olx_avg: p.olx_avg ?? 0,
        new_price: p.price_new ?? 0,
        max_price: p.max_price,
        savings_pct: p.savings_pct,
      }));
  }, [priceComparison]);

  // ---- Distribution ----
  const distributionData = useMemo(() => {
    const filtered = deals.filter((d) => d.item_name === selectedDistItem);
    if (filtered.length === 0) return [];
    const prices = filtered.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return [{ range: fmt(min), count: prices.length }];
    const bucketCount = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(prices.length))));
    const step = (max - min) / bucketCount;
    const buckets: { range: string; count: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const lo = min + step * i;
      const hi = lo + step;
      const count = prices.filter((p) => (i === bucketCount - 1 ? p >= lo && p <= hi : p >= lo && p < hi)).length;
      buckets.push({ range: `R$${lo.toFixed(0)}`, count });
    }
    return buckets;
  }, [deals, selectedDistItem]);

  // ---- History chart ----
  const historyChartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    for (const name of selectedHistoryItems) {
      for (const e of priceHistory[name] ?? []) {
        const date = new Date(e.recorded_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (!dateMap.has(date)) dateMap.set(date, {});
        dateMap.get(date)![name] = e.avg_price;
      }
    }
    return [...dateMap.entries()]
      .sort((a, b) => {
        const [da, ma] = a[0].split("/").map(Number);
        const [db, mb] = b[0].split("/").map(Number);
        return ma * 100 + da - (mb * 100 + db);
      })
      .map(([date, values]) => ({ date, ...values }));
  }, [priceHistory, selectedHistoryItems]);

  // ---- Stats table ----
  const statsWithSpread = useMemo(() => {
    return aggregated.map((item) => {
      const prices = deals.filter((d) => d.item_name === item.item_name).map((d) => d.price).sort((a, b) => a - b);
      return {
        ...item,
        spread: item.max_price - item.min_price,
        suggestedBuy: prices.length > 0 ? prices[Math.floor(prices.length * 0.25)] : item.min_price,
      };
    });
  }, [aggregated, deals]);

  const sortedStats = useMemo(() => {
    const col = sortColumn as keyof (typeof statsWithSpread)[0];
    return [...statsWithSpread].sort((a, b) => {
      const va = a[col] as number;
      const vb = b[col] as number;
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [statsWithSpread, sortColumn, sortDir]);

  function toggleSort(col: string) {
    if (sortColumn === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(col); setSortDir("desc"); }
  }

  function toggleHistoryItem(name: string) {
    setSelectedHistoryItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  // ---- Render ----
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Price Analytics</h1>
          <p className="text-muted-foreground text-sm">Loading data...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-6">
              <div className="h-6 w-48 bg-border/50 rounded animate-pulse mb-4" />
              <div className="h-64 w-full bg-border/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Price Analytics
        </h1>
        <p className="text-muted-foreground text-sm">
          Compare prices and track trends across hardware items.
        </p>
      </div>

      {/* Used vs New Price Comparison */}
      {comparisonChartData.length > 0 && (
        <section className="bg-surface border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Usado vs Novo
          </h2>
          <p className="text-muted-foreground text-xs mb-4">
            OLX (usado) vs lojas (novo) — economia comprando usado
          </p>
          <ResponsiveContainer width="100%" height={Math.max(250, comparisonChartData.length * 50)}>
            <BarChart
              data={comparisonChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.4} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
                stroke="#666"
                tick={{ fill: "#aaa", fontSize: 11 }}
                axisLine={{ stroke: "#333" }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="item"
                width={130}
                stroke="#666"
                tick={{ fill: "#aaa", fontSize: 11 }}
                axisLine={{ stroke: "#333" }}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [fmt(Number(value)), String(name)]}
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#eee", borderRadius: "8px", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#aaa" }} />
              <Bar dataKey="olx_min" name="OLX Min" fill="#22d3ee" radius={[0, 4, 4, 0]} barSize={16} />
              <Bar dataKey="new_price" name="Novo" fill="#a78bfa" radius={[0, 4, 4, 0]} barSize={16} />
              <Bar dataKey="max_price" name="Target" fill="#333" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>

          {/* Savings badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {priceComparison.filter((p) => p.savings_pct !== null).map((p) => (
              <span
                key={p.item_name}
                className={`px-2 py-1 text-xs rounded border ${
                  (p.savings_pct ?? 0) > 30
                    ? "bg-emerald-900/30 text-emerald-300 border-emerald-800/40"
                    : (p.savings_pct ?? 0) > 0
                    ? "bg-yellow-900/30 text-yellow-300 border-yellow-800/40"
                    : "bg-red-900/30 text-red-300 border-red-800/40"
                }`}
              >
                {p.item_name}: {(p.savings_pct ?? 0) > 0 ? `-${p.savings_pct}%` : `+${Math.abs(p.savings_pct ?? 0)}%`}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* OLX Price Overview */}
      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">OLX Price Overview</h2>
        {aggregated.length === 0 ? (
          <p className="text-muted-foreground text-sm">No deals data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(250, aggregated.length * 45)}>
            <BarChart
              data={aggregated}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.4} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
                stroke="#666"
                tick={{ fill: "#aaa", fontSize: 11 }}
                axisLine={{ stroke: "#333" }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="item_name"
                width={130}
                stroke="#666"
                tick={{ fill: "#aaa", fontSize: 11 }}
                axisLine={{ stroke: "#333" }}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [fmt(Number(value)), String(name)]}
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#eee", borderRadius: "8px", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#aaa" }} />
              <Bar dataKey="min_price" name="Min" fill="#10b981" radius={[0, 3, 3, 0]} barSize={14} />
              <Bar dataKey="avg_price" name="Avg" fill="#eab308" radius={[0, 3, 3, 0]} barSize={14} />
              <Bar dataKey="max_price" name="Max" fill="#ef4444" radius={[0, 3, 3, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Distribution */}
        <section className="bg-surface border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Price Distribution</h2>
          <Select value={selectedDistItem} onValueChange={setSelectedDistItem}>
            <SelectTrigger className="w-full mt-1 mb-4 bg-background border-border">
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              {itemNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {distributionData.length === 0 ? (
            <p className="text-muted-foreground text-sm">No deals for this item.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distributionData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.4} />
                <XAxis
                  dataKey="range"
                  angle={-30}
                  textAnchor="end"
                  height={60}
                  stroke="#666"
                  tick={{ fill: "#aaa", fontSize: 10 }}
                  axisLine={{ stroke: "#333" }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#666"
                  tick={{ fill: "#aaa", fontSize: 11 }}
                  axisLine={{ stroke: "#333" }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#eee", borderRadius: "8px" }} />
                <Bar dataKey="count" name="Deals" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Price History */}
        <section className="bg-surface border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Price History
          </h2>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {itemNames.map((name) => (
              <Badge
                key={name}
                variant={selectedHistoryItems.includes(name) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleHistoryItem(name)}
              >
                {name}
              </Badge>
            ))}
          </div>
          {historyChartData.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No history data yet. Tracking starts after the scheduler runs a few price snapshots.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={historyChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  stroke="#666"
                  tick={{ fill: "#aaa", fontSize: 11 }}
                  axisLine={{ stroke: "#333" }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#666"
                  tick={{ fill: "#aaa", fontSize: 11 }}
                  tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
                  axisLine={{ stroke: "#333" }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [fmt(Number(value)), String(name)]}
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#eee", borderRadius: "8px" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#aaa" }} />
                {selectedHistoryItems.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* Stats Table */}
      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Deal Stats</h2>
        {sortedStats.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Item</th>
                  {[
                    { key: "count", label: "Deals" },
                    { key: "min_price", label: "Min" },
                    { key: "avg_price", label: "Avg" },
                    { key: "max_price", label: "Max" },
                    { key: "spread", label: "Spread" },
                    { key: "suggestedBuy", label: "Buy (P25)" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="text-right py-2 px-3 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((row) => (
                  <tr key={row.item_name} className="border-b border-border/50 hover:bg-border/10 transition-colors">
                    <td className="py-2 px-3 font-medium text-foreground">{row.item_name}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{row.count}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">{fmt(row.min_price)}</td>
                    <td className="py-2 px-3 text-right text-yellow-400">{fmt(row.avg_price)}</td>
                    <td className="py-2 px-3 text-right text-red-400">{fmt(row.max_price)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{fmt(row.spread)}</td>
                    <td className="py-2 px-3 text-right">
                      <span className="px-2 py-0.5 text-xs rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800/40 font-mono">
                        {fmt(row.suggestedBuy)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
