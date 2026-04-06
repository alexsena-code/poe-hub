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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, BarChart3, TrendingUp } from "lucide-react";
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
  currency: string;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CHART_COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#60a5fa",
  "#e879f9",
  "#4ade80",
  "#f87171",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HardwareAnalyticsPage() {
  // Data state
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [priceHistory, setPriceHistory] = useState<
    Record<string, PriceHistoryEntry[]>
  >({});

  // UI state
  const [loading, setLoading] = useState(true);
  const [selectedDistItem, setSelectedDistItem] = useState<string>("");
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<string[]>(
    []
  );
  const [sortColumn, setSortColumn] = useState<string>("avg_price");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Derived: unique item names from summary
  const itemNames = useMemo(
    () =>
      [...new Set(summary.map((s) => s.item_name))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [summary]
  );

  // ---- Fetch data on mount ----
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sumRes, dealsRes] = await Promise.all([
          fetch(`${HARDWARE_API}/api/deals/summary`),
          fetch(`${HARDWARE_API}/api/deals?limit=2000`),
        ]);
        if (sumRes.ok) {
          const data: SummaryItem[] = await sumRes.json();
          setSummary(data);
          if (data.length > 0) {
            setSelectedDistItem(data[0].item_name);
            setSelectedHistoryItems([data[0].item_name]);
          }
        }
        if (dealsRes.ok) {
          setDeals(await dealsRes.json());
        }
      } catch (err) {
        toast.error("Failed to load hardware analytics data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Fetch price history when selected items change
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
              `${HARDWARE_API}/api/price-history/${encodeURIComponent(name)}?days=30`
            );
            if (res.ok) {
              newHistory[name] = await res.json();
            }
          } catch {
            // ignore individual failures
          }
        })
      );
      setPriceHistory((prev) => ({ ...prev, ...newHistory }));
    }
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHistoryItems]);

  // ---- Aggregated summary per item (merge sources) ----
  const aggregated = useMemo(() => {
    const map = new Map<
      string,
      { item_name: string; min_price: number; avg_price: number; max_price: number; count: number }
    >();
    for (const s of summary) {
      const existing = map.get(s.item_name);
      const cnt = s.count ?? s.total_deals ?? 1;
      if (existing) {
        existing.min_price = Math.min(existing.min_price, s.min_price);
        existing.max_price = Math.max(existing.max_price, s.max_price);
        existing.count += cnt;
        // weighted avg
        existing.avg_price =
          (existing.avg_price * (existing.count - cnt) + s.avg_price * cnt) /
          existing.count;
      } else {
        map.set(s.item_name, {
          item_name: s.item_name,
          min_price: s.min_price,
          avg_price: s.avg_price,
          max_price: s.max_price,
          count: cnt,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.avg_price - a.avg_price);
  }, [summary]);

  // ---- Price distribution histogram ----
  const distributionData = useMemo(() => {
    const filtered = deals.filter((d) => d.item_name === selectedDistItem);
    if (filtered.length === 0) return [];
    const prices = filtered.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return [{ range: fmt(min), count: prices.length, rangeStart: min }];
    const bucketCount = Math.min(15, Math.max(5, Math.ceil(Math.sqrt(prices.length))));
    const step = (max - min) / bucketCount;
    const buckets: { range: string; count: number; rangeStart: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const lo = min + step * i;
      const hi = lo + step;
      const count = prices.filter((p) => (i === bucketCount - 1 ? p >= lo && p <= hi : p >= lo && p < hi)).length;
      buckets.push({
        range: `${fmt(lo)} - ${fmt(hi)}`,
        count,
        rangeStart: lo,
      });
    }
    return buckets;
  }, [deals, selectedDistItem]);

  // ---- Price history line chart data ----
  const historyChartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    for (const name of selectedHistoryItems) {
      const entries = priceHistory[name] ?? [];
      for (const e of entries) {
        const date = new Date(e.recorded_at).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
        if (!dateMap.has(date)) dateMap.set(date, {});
        dateMap.get(date)![name] = e.avg_price;
      }
    }
    return [...dateMap.entries()]
      .sort(
        (a, b) =>
          new Date(a[0].split("/").reverse().join("-")).getTime() -
          new Date(b[0].split("/").reverse().join("-")).getTime()
      )
      .map(([date, values]) => ({ date, ...values }));
  }, [priceHistory, selectedHistoryItems]);

  // ---- Stats table with sorting ----
  const statsWithSpread = useMemo(() => {
    return aggregated.map((item) => {
      const itemDeals = deals.filter((d) => d.item_name === item.item_name);
      const prices = itemDeals.map((d) => d.price).sort((a, b) => a - b);
      const p25 =
        prices.length > 0
          ? prices[Math.floor(prices.length * 0.25)]
          : item.min_price;
      return {
        ...item,
        spread: item.max_price - item.min_price,
        suggestedBuy: p25,
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
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("desc");
    }
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
          <h1 className="text-2xl font-bold">Price Analytics</h1>
          <p className="text-muted-foreground">Loading data...</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Price Analytics
        </h1>
        <p className="text-muted-foreground">
          Compare prices and track trends across hardware items.
        </p>
      </div>

      {/* Section 1: Price Comparison Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Price Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {aggregated.length === 0 ? (
            <p className="text-muted-foreground text-sm">No summary data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, aggregated.length * 40)}>
              <BarChart
                data={aggregated}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="item_name"
                  width={180}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tick={{ fill: "hsl(var(--foreground))" }}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [fmt(Number(value)), String(name)]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                <Bar dataKey="min_price" name="Min" fill="#22c55e" radius={[0, 2, 2, 0]} />
                <Bar dataKey="avg_price" name="Avg" fill="#eab308" radius={[0, 2, 2, 0]} />
                <Bar dataKey="max_price" name="Max" fill="#ef4444" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section 2: Price Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Price Distribution</CardTitle>
            <Select value={selectedDistItem} onValueChange={setSelectedDistItem}>
              <SelectTrigger className="w-full mt-2">
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {itemNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {distributionData.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No deals found for this item.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={distributionData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="range"
                    angle={-35}
                    textAnchor="end"
                    height={80}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="count" name="Deals" fill="#60a5fa" radius={[4, 4, 0, 0]}>
                    {distributionData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Price History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Price History
            </CardTitle>
            <div className="flex flex-wrap gap-1.5 mt-2">
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
          </CardHeader>
          <CardContent>
            {historyChartData.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No history data yet. Price tracking will appear here after a few days of scraping.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={historyChartData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [fmt(Number(value)), String(name)]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend />
                  {selectedHistoryItems.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Deal Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deal Stats</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedStats.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    {[
                      { key: "count", label: "Deals" },
                      { key: "min_price", label: "Min" },
                      { key: "avg_price", label: "Avg" },
                      { key: "max_price", label: "Max" },
                      { key: "spread", label: "Spread" },
                      { key: "suggestedBuy", label: "Buy Price (P25)" },
                    ].map((col) => (
                      <TableHead
                        key={col.key}
                        className="cursor-pointer select-none text-right"
                        onClick={() => toggleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStats.map((row) => (
                    <TableRow key={row.item_name}>
                      <TableCell className="font-medium">{row.item_name}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right text-green-500">
                        {fmt(row.min_price)}
                      </TableCell>
                      <TableCell className="text-right text-yellow-500">
                        {fmt(row.avg_price)}
                      </TableCell>
                      <TableCell className="text-right text-red-500">
                        {fmt(row.max_price)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmt(row.spread)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {fmt(row.suggestedBuy)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
