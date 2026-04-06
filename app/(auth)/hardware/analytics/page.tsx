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
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowUpDown,
  BarChart3,
  TrendingUp,
  ShoppingCart,
  RefreshCw,
  History,
} from "lucide-react";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

// Types
interface SummaryItem {
  item_name: string;
  min_price: number;
  avg_price: number;
  max_price: number;
  count?: number;
  total_deals?: number;
}

interface Deal {
  id: number;
  item_name: string;
  price: number;
  found_at: string;
}

interface PriceCompItem {
  item_name: string;
  category: string;
  max_price: number;
  olx_min: number | null;
  olx_avg: number | null;
  olx_count: number;
  price_new: number | null;
  savings_pct: number | null;
  notes: string | null;
}

interface StoreHistoryPoint {
  product_name: string;
  date: string;
  price: number;
  merchant: string;
  category: string;
}

interface StoreStats {
  category: string;
  count: number;
  oldest_sync: string | null;
  newest_sync: string | null;
}

// Helpers
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLORS = [
  "#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24",
  "#fb923c", "#60a5fa", "#e879f9", "#4ade80", "#f87171",
];

type Tab = "comparison" | "history" | "deals";

export default function HardwareAnalyticsPage() {
  const [tab, setTab] = useState<Tab>("comparison");
  const [loading, setLoading] = useState(true);

  // Data
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [comparison, setComparison] = useState<PriceCompItem[]>([]);
  const [storeHistory, setStoreHistory] = useState<StoreHistoryPoint[]>([]);
  const [storeStats, setStoreStats] = useState<StoreStats[]>([]);

  // UI
  const [historyCategory, setHistoryCategory] = useState("gpu");
  const [historySearch, setHistorySearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [distItem, setDistItem] = useState("");
  const [sortCol, setSortCol] = useState("avg_price");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const itemNames = useMemo(
    () => [...new Set(summary.map((s) => s.item_name))].sort(),
    [summary]
  );

  // Fetch on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sumRes, dealsRes, compRes, statsRes] = await Promise.all([
          fetch(`${HARDWARE_API}/api/deals/summary`).then((r) => r.json()).catch(() => []),
          fetch(`${HARDWARE_API}/api/deals?limit=2000`).then((r) => r.json()).catch(() => []),
          fetch(`${HARDWARE_API}/api/analytics/price-comparison`).then((r) => r.json()).catch(() => []),
          fetch(`${HARDWARE_API}/api/store-stats`).then((r) => r.json()).catch(() => []),
        ]);
        setSummary(Array.isArray(sumRes) ? sumRes : []);
        setDeals(Array.isArray(dealsRes) ? dealsRes : []);
        setComparison(Array.isArray(compRes) ? compRes : []);
        setStoreStats(Array.isArray(statsRes) ? statsRes : []);
        if (sumRes.length > 0) setDistItem(sumRes[0].item_name);
      } catch {
        toast.error("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Available products for the selected category (from store_products DB)
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // Fetch history + available products when tab/category changes
  useEffect(() => {
    if (tab !== "history") return;
    async function loadHistory() {
      try {
        const [histRes, productsRes] = await Promise.all([
          fetch(`${HARDWARE_API}/api/new-prices-history/${historyCategory}?days=180`).then((r) => r.json()).catch(() => []),
          fetch(`${HARDWARE_API}/api/new-prices/${historyCategory}?limit=500`).then((r) => r.json()).catch(() => []),
        ]);
        setStoreHistory(Array.isArray(histRes) ? histRes : []);
        const names = [...new Set((productsRes as { name: string }[]).map((p) => p.name))].sort();
        setAvailableProducts(names);
        setSelectedProducts([]);
      } catch {
        setStoreHistory([]);
        setAvailableProducts([]);
      }
    }
    loadHistory();
  }, [tab, historyCategory]);

  const handleImportHistory = async () => {
    setImporting(true);
    try {
      const res = await fetch(`${HARDWARE_API}/api/import-price-history/${historyCategory}`, { method: "POST" });
      const data = await res.json();
      toast.success(`Imported ${data.imported || 0} history points for ${historyCategory}`);
      // Reload
      const histRes = await fetch(`${HARDWARE_API}/api/new-prices-history/${historyCategory}?days=180`).then((r) => r.json());
      setStoreHistory(Array.isArray(histRes) ? histRes : []);
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  // Products available for selection (from store_products, filtered by search)
  const filteredProducts = useMemo(() => {
    const names = availableProducts.length > 0
      ? availableProducts
      : [...new Set(storeHistory.map((p) => p.product_name))].sort();
    if (historySearch) {
      const q = historySearch.toLowerCase();
      return names.filter((n) => n.toLowerCase().includes(q));
    }
    return names;
  }, [availableProducts, storeHistory, historySearch]);

  // History chart data
  const historyChartData = useMemo(() => {
    if (selectedProducts.length === 0) return [];
    const dateMap = new Map<string, Record<string, number>>();
    for (const p of storeHistory) {
      if (!selectedProducts.includes(p.product_name)) continue;
      if (!dateMap.has(p.date)) dateMap.set(p.date, {});
      dateMap.get(p.date)![p.product_name] = p.price;
    }
    return [...dateMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({ date, ...values }));
  }, [storeHistory, selectedProducts]);

  // Comparison chart
  const compChartData = useMemo(() => {
    return comparison
      .filter((p) => p.olx_min || p.price_new)
      .map((p) => ({
        item: p.item_name,
        "OLX Min": p.olx_min ?? 0,
        "Novo": p.price_new ?? 0,
        "Target": p.max_price,
      }));
  }, [comparison]);

  // Aggregated summary
  const aggregated = useMemo(() => {
    const map = new Map<string, { item_name: string; min_price: number; avg_price: number; max_price: number; count: number }>();
    for (const s of summary) {
      const cnt = s.count ?? s.total_deals ?? 1;
      const ex = map.get(s.item_name);
      if (ex) {
        ex.min_price = Math.min(ex.min_price, s.min_price);
        ex.max_price = Math.max(ex.max_price, s.max_price);
        ex.count += cnt;
        ex.avg_price = (ex.avg_price * (ex.count - cnt) + s.avg_price * cnt) / ex.count;
      } else {
        map.set(s.item_name, { item_name: s.item_name, min_price: s.min_price, avg_price: s.avg_price, max_price: s.max_price, count: cnt });
      }
    }
    return [...map.values()];
  }, [summary]);

  // Distribution
  const distData = useMemo(() => {
    const prices = deals.filter((d) => d.item_name === distItem).map((d) => d.price);
    if (prices.length === 0) return [];
    const min = Math.min(...prices), max = Math.max(...prices);
    if (min === max) return [{ range: `R$${min.toFixed(0)}`, count: prices.length }];
    const n = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(prices.length))));
    const step = (max - min) / n;
    return Array.from({ length: n }, (_, i) => {
      const lo = min + step * i, hi = lo + step;
      return {
        range: `R$${lo.toFixed(0)}`,
        count: prices.filter((p) => i === n - 1 ? p >= lo && p <= hi : p >= lo && p < hi).length,
      };
    });
  }, [deals, distItem]);

  // Stats table
  const statsData = useMemo(() => {
    const data = aggregated.map((item) => {
      const prices = deals.filter((d) => d.item_name === item.item_name).map((d) => d.price).sort((a, b) => a - b);
      return { ...item, spread: item.max_price - item.min_price, buy: prices.length > 0 ? prices[Math.floor(prices.length * 0.25)] : item.min_price };
    });
    const col = sortCol as keyof (typeof data)[0];
    return [...data].sort((a, b) => {
      const va = a[col] as number, vb = b[col] as number;
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [aggregated, deals, sortCol, sortDir]);

  function toggleProduct(name: string) {
    setSelectedProducts((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "comparison", label: "Usado vs Novo" },
    { id: "history", label: "Price History" },
    { id: "deals", label: "OLX Deals" },
  ];

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div><h1 className="text-2xl font-bold">Price Analytics</h1></div>
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Price Analytics
        </h1>
        <p className="text-muted-foreground text-sm">Compare prices and track trends.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== TAB: Usado vs Novo ========== */}
      {tab === "comparison" && (
        <section className="space-y-4">
          {compChartData.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No comparison data. Run a sync first.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={compChartData} margin={{ left: 10, right: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                  <XAxis dataKey="item" angle={-25} textAnchor="end" height={60} stroke="#666" tick={{ fill: "#aaa", fontSize: 11 }} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => `R$${v}`} stroke="#666" tick={{ fill: "#aaa", fontSize: 11 }} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#eee", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="OLX Min" fill="#22d3ee" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Novo" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Target" fill="#444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Savings */}
              <div className="flex flex-wrap gap-2">
                {comparison.filter((p) => p.savings_pct !== null).map((p) => (
                  <span key={p.item_name} className={`px-2 py-1 text-xs rounded border ${
                    (p.savings_pct ?? 0) > 30 ? "bg-emerald-900/30 text-emerald-300 border-emerald-800/40"
                    : (p.savings_pct ?? 0) > 0 ? "bg-yellow-900/30 text-yellow-300 border-yellow-800/40"
                    : "bg-red-900/30 text-red-300 border-red-800/40"
                  }`}>
                    {p.item_name}: {(p.savings_pct ?? 0) > 0 ? `-${p.savings_pct}%` : `+${Math.abs(p.savings_pct ?? 0)}%`}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ========== TAB: Price History ========== */}
      {tab === "history" && (
        <section className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={historyCategory} onValueChange={setHistoryCategory}>
              <SelectTrigger className="w-40 border-border text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["gpu", "cpu", "ram", "motherboard", "ssd", "psu", "monitor"].map((c) => (
                  <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="text"
              placeholder="Search products..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="px-3 py-1.5 text-sm bg-background border border-border rounded-md w-60"
            />
            <span className="text-xs text-muted-foreground">
              {filteredProducts.length} products, {storeHistory.length} data points
            </span>
            {storeHistory.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleImportHistory}
                disabled={importing}
                className="border-border text-xs"
              >
                {importing ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <History className="h-3 w-3 mr-1" />}
                Import 3-month history
              </Button>
            )}
          </div>

          {/* Product selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value="__pick__"
              onValueChange={(v) => { if (v !== "__pick__") toggleProduct(v); }}
            >
              <SelectTrigger className="w-72 border-border text-sm">
                <SelectValue placeholder="Add product to compare..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__pick__" disabled>Add product to compare...</SelectItem>
                {filteredProducts.map((name) => (
                  <SelectItem key={name} value={name}>
                    {selectedProducts.includes(name) ? `✓ ${name}` : name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProducts.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setSelectedProducts([])}>
                Clear all
              </Button>
            )}
          </div>
          {/* Selected products as removable badges */}
          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProducts.map((name, i) => (
                <Badge
                  key={name}
                  className="cursor-pointer text-xs gap-1"
                  style={{ backgroundColor: COLORS[i % COLORS.length] + "30", color: COLORS[i % COLORS.length], borderColor: COLORS[i % COLORS.length] + "50" }}
                  onClick={() => toggleProduct(name)}
                >
                  {name} ✕
                </Badge>
              ))}
            </div>
          )}

          {/* Chart */}
          {selectedProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Select products above to compare price history.</p>
          ) : historyChartData.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No history data yet. Run a sync to populate.</p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={historyChartData} margin={{ left: 10, right: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                <XAxis dataKey="date" stroke="#666" tick={{ fill: "#aaa", fontSize: 11 }} tickLine={false} />
                <YAxis stroke="#666" tick={{ fill: "#aaa", fontSize: 11 }} tickFormatter={(v: number) => `R$${v}`} tickLine={false} />
                <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#eee", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {selectedProducts.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Sync stats */}
          {storeStats.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-2">
              {storeStats.map((s) => (
                <div key={s.category} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{s.category}</span>: {s.count} products
                  {s.newest_sync && <span> (synced {new Date(s.newest_sync).toLocaleDateString("pt-BR")})</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========== TAB: OLX Deals (Distribution + Stats) ========== */}
      {tab === "deals" && (
        <section className="space-y-6">
          {/* Stats table */}
          {statsData.length > 0 && (
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
                      { key: "buy", label: "Buy (P25)" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="text-right py-2 px-3 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground"
                        onClick={() => { if (sortCol === col.key) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col.key); setSortDir("desc"); } }}
                      >
                        <span className="inline-flex items-center gap-1">{col.label} <ArrowUpDown className="h-3 w-3 opacity-50" /></span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statsData.map((row) => (
                    <tr
                      key={row.item_name}
                      className={`border-b border-border/50 hover:bg-border/10 cursor-pointer ${distItem === row.item_name ? "bg-border/10" : ""}`}
                      onClick={() => setDistItem(row.item_name)}
                    >
                      <td className="py-2 px-3 font-medium">{row.item_name}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{row.count}</td>
                      <td className="py-2 px-3 text-right text-emerald-400">{fmt(row.min_price)}</td>
                      <td className="py-2 px-3 text-right text-yellow-400">{fmt(row.avg_price)}</td>
                      <td className="py-2 px-3 text-right text-red-400">{fmt(row.max_price)}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{fmt(row.spread)}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="px-2 py-0.5 text-xs rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800/40 font-mono">{fmt(row.buy)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Distribution chart for selected item */}
          {distItem && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Price Distribution — {distItem}
              </h3>
              {distData.length === 0 ? (
                <p className="text-muted-foreground text-xs py-4 text-center">No deals for this item.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={distData} margin={{ left: 10, right: 10, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                    <XAxis dataKey="range" angle={-30} textAnchor="end" height={50} stroke="#666" tick={{ fill: "#aaa", fontSize: 10 }} tickLine={false} />
                    <YAxis stroke="#666" tick={{ fill: "#aaa", fontSize: 11 }} allowDecimals={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#eee", borderRadius: 8 }} />
                    <Bar dataKey="count" name="Deals" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
