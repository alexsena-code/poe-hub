"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import {
  RefreshCw,
  ExternalLink,
  Search,
  Package,
  Cpu,
  MemoryStick,
  Monitor,
  ArrowUpDown,
  Edit2,
  Save,
  X,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

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

interface SummaryItem {
  item_name: string;
  category: string;
  total_deals: number;
  min_price: number;
  avg_price: number;
  max_price: number;
}

interface ConfigItem {
  id: number;
  name: string;
  keywords: string[];
  max_price: number;
  category: string;
  specs: Record<string, number | string>;
  scrape_enabled: boolean;
}

interface ManualPrice {
  item_name: string;
  price_new: number | null;
  price_aliexpress: number | null;
  price_reference: number | null;
  notes: string;
}

type SortField = "price" | "found_at" | "title" | "source" | "location";
type SortDir = "asc" | "desc";

export default function HardwarePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [manualPrices, setManualPrices] = useState<ManualPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [activeTab, setActiveTab] = useState<"deals" | "manual-prices" | "items">(
    "deals"
  );

  // Filters
  const [filterName, setFilterName] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("found_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Manual prices editing
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ManualPrice>>({});

  // Items tab state
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingConfigItem, setEditingConfigItem] = useState<ConfigItem | null>(null);
  const [itemFormName, setItemFormName] = useState("");
  const [itemFormCategory, setItemFormCategory] = useState("gpu");
  const [itemFormMaxPrice, setItemFormMaxPrice] = useState("");
  const [itemFormKeywords, setItemFormKeywords] = useState<string[]>([]);
  const [itemFormKeywordInput, setItemFormKeywordInput] = useState("");
  const [itemFormSpecs, setItemFormSpecs] = useState<Record<string, string>>({});
  const [itemFormScrapeEnabled, setItemFormScrapeEnabled] = useState(true);
  const [showSpecs, setShowSpecs] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dealsRes, summaryRes, itemsRes, pricesRes] = await Promise.all([
        fetch(`${HARDWARE_API}/api/deals`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/deals/summary`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/items`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/manual-prices`)
          .then((r) => r.json())
          .catch(() => []),
      ]);
      setDeals(Array.isArray(dealsRes) ? dealsRes : []);
      setSummary(Array.isArray(summaryRes) ? summaryRes : []);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      setManualPrices(Array.isArray(pricesRes) ? pricesRes : []);
    } catch (error) {
      console.error("Error fetching hardware data:", error);
      toast.error("Failed to connect to Hardware API");
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch(`${HARDWARE_API}/api/scrape`, { method: "POST" });
      if (res.ok) {
        toast.success("Scrape started successfully");
        setTimeout(() => fetchAll(), 5000);
      } else {
        toast.error("Failed to start scrape");
      }
    } catch (error) {
      toast.error("Failed to connect to Hardware API");
    } finally {
      setScraping(false);
    }
  };

  const handleSaveManualPrice = async (itemName: string) => {
    try {
      const res = await fetch(`${HARDWARE_API}/api/manual-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: itemName, ...editValues }),
      });
      if (res.ok) {
        toast.success(`Price updated for ${itemName}`);
        setEditingItem(null);
        setEditValues({});
        fetchAll();
      } else {
        toast.error("Failed to save price");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleDeleteManualPrice = async (itemName: string) => {
    try {
      const res = await fetch(
        `${HARDWARE_API}/api/manual-prices/${encodeURIComponent(itemName)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success(`Deleted ${itemName}`);
        fetchAll();
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleClearAllDeals = async () => {
    if (!window.confirm("Are you sure you want to delete ALL scraped deals? This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`${HARDWARE_API}/api/deals/all`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("All deals cleared");
        fetchAll();
      } else {
        toast.error("Failed to clear deals");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm("Delete this item? Its deals will also be removed.")) {
      return;
    }
    try {
      const res = await fetch(`${HARDWARE_API}/api/items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Item deleted");
        fetchAll();
      } else {
        toast.error("Failed to delete item");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const [scrapingItemId, setScrapingItemId] = useState<number | null>(null);

  const handleScrapeItem = async (itemId: number, itemName: string) => {
    setScrapingItemId(itemId);
    try {
      const res = await fetch(`${HARDWARE_API}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });
      if (res.ok) {
        toast.success(`Scraping ${itemName}...`);
        setTimeout(() => {
          fetchAll();
          setScrapingItemId(null);
        }, 10000);
      } else {
        toast.error("Failed to start scrape");
        setScrapingItemId(null);
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
      setScrapingItemId(null);
    }
  };

  const handleDeleteDeal = async (dealId: number) => {
    try {
      const res = await fetch(`${HARDWARE_API}/api/deals/${dealId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== dealId));
        toast.success("Deal removed");
      } else {
        toast.error("Failed to delete deal");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  // --- Items tab helpers ---

  const generateKeywords = (name: string): string[] => {
    const lower = name.toLowerCase();
    const keywords = [lower];
    const noSpaces = lower.replace(/\s+/g, '');
    if (noSpaces !== lower) keywords.push(noSpaces);
    const parts = lower.split(' ');
    if (parts.length > 1) {
      keywords.push(parts.slice(1).join(' '));
    }
    return [...new Set(keywords)];
  };

  const specsFieldsForCategory = (cat: string): { key: string; label: string }[] => {
    switch (cat) {
      case "gpu":
        return [
          { key: "vram_gb", label: "VRAM (GB)" },
          { key: "tdp_w", label: "TDP (W)" },
          { key: "cuda_cores", label: "CUDA Cores" },
        ];
      case "cpu-kit":
        return [
          { key: "cores", label: "Cores" },
          { key: "threads", label: "Threads" },
          { key: "base_clock_ghz", label: "Base Clock (GHz)" },
          { key: "boost_clock_ghz", label: "Boost Clock (GHz)" },
        ];
      case "ram":
        return [
          { key: "capacity_gb", label: "Capacity (GB)" },
          { key: "type", label: "Type" },
        ];
      default:
        return [];
    }
  };

  const resetItemForm = () => {
    setItemFormName("");
    setItemFormCategory("gpu");
    setItemFormMaxPrice("");
    setItemFormKeywords([]);
    setItemFormKeywordInput("");
    setItemFormSpecs({});
    setItemFormScrapeEnabled(true);
    setShowSpecs(false);
    setEditingConfigItem(null);
  };

  const handleItemFormNameChange = (name: string) => {
    setItemFormName(name);
    if (!editingConfigItem) {
      setItemFormKeywords(generateKeywords(name));
    }
  };

  const handleAddKeyword = () => {
    const kw = itemFormKeywordInput.trim().toLowerCase();
    if (kw && !itemFormKeywords.includes(kw)) {
      setItemFormKeywords([...itemFormKeywords, kw]);
    }
    setItemFormKeywordInput("");
  };

  const handleRemoveKeyword = (kw: string) => {
    setItemFormKeywords(itemFormKeywords.filter((k) => k !== kw));
  };

  const handleSaveItem = async () => {
    if (!itemFormName.trim()) {
      toast.error("Item name is required");
      return;
    }
    const maxPrice = parseFloat(itemFormMaxPrice);
    if (isNaN(maxPrice) || maxPrice <= 0) {
      toast.error("Valid max price is required");
      return;
    }

    const specs: Record<string, number | string> = {};
    for (const [key, val] of Object.entries(itemFormSpecs)) {
      if (val.trim()) {
        const num = parseFloat(val);
        specs[key] = isNaN(num) ? val.trim() : num;
      }
    }

    const payload = {
      name: itemFormName.trim(),
      category: itemFormCategory,
      max_price: maxPrice,
      keywords: itemFormKeywords,
      specs,
      scrape_enabled: itemFormScrapeEnabled,
    };

    try {
      const url = editingConfigItem
        ? `${HARDWARE_API}/api/items/${editingConfigItem.id}`
        : `${HARDWARE_API}/api/items`;
      const method = editingConfigItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(editingConfigItem ? "Item updated" : "Item added");
        resetItemForm();
        setShowItemForm(false);
        fetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || "Failed to save item");
      }
    } catch {
      toast.error("Failed to connect to Hardware API");
    }
  };

  const handleEditConfigItem = (item: ConfigItem) => {
    setEditingConfigItem(item);
    setItemFormName(item.name);
    setItemFormCategory(item.category);
    setItemFormMaxPrice(String(item.max_price));
    setItemFormKeywords(item.keywords || []);
    setItemFormSpecs(
      Object.fromEntries(
        Object.entries(item.specs || {}).map(([k, v]) => [k, String(v)])
      )
    );
    setShowSpecs(Object.keys(item.specs || {}).length > 0);
    setItemFormScrapeEnabled(item.scrape_enabled !== false);
    setShowItemForm(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredDeals = useMemo(() => {
    let result = [...deals];

    if (filterName !== "all") {
      result = result.filter((d) => d.item_name === filterName);
    }
    if (filterSource !== "all") {
      result = result.filter((d) => d.source === filterSource);
    }
    if (filterCategory !== "all") {
      result = result.filter((d) => d.category === filterCategory);
    }
    if (filterMinPrice) {
      const min = parseFloat(filterMinPrice);
      if (!isNaN(min)) {
        result = result.filter((d) => d.price >= min);
      }
    }
    if (filterMaxPrice) {
      const max = parseFloat(filterMaxPrice);
      if (!isNaN(max)) {
        result = result.filter((d) => d.price <= max);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.item_name.toLowerCase().includes(q) ||
          d.location?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "price":
          cmp = a.price - b.price;
          break;
        case "found_at":
          cmp =
            new Date(a.found_at).getTime() - new Date(b.found_at).getTime();
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "source":
          cmp = a.source.localeCompare(b.source);
          break;
        case "location":
          cmp = (a.location || "").localeCompare(b.location || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    deals,
    filterName,
    filterSource,
    filterCategory,
    filterMinPrice,
    filterMaxPrice,
    searchQuery,
    sortField,
    sortDir,
  ]);

  const categorySummary = useMemo(() => {
    const validCategories = ["gpu", "cpu-kit", "ram", "psu", "ssd", "motherboard"];
    const cats: Record<
      string,
      { total: number; best: number; avg: number; label: string }
    > = {};
    for (const s of summary) {
      const cat = s.category || "other";
      if (!validCategories.includes(cat)) continue;
      if (!cats[cat]) {
        cats[cat] = { total: 0, best: Infinity, avg: 0, label: cat };
      }
      cats[cat].total += s.total_deals;
      cats[cat].best = Math.min(cats[cat].best, s.min_price);
      cats[cat].avg += s.avg_price * s.total_deals;
    }
    for (const cat of Object.values(cats)) {
      cat.avg = cat.total > 0 ? cat.avg / cat.total : 0;
      if (cat.best === Infinity) cat.best = 0;
    }
    return cats;
  }, [summary]);

  const uniqueNames = useMemo(
    () => Array.from(new Set(deals.map((d) => d.item_name))).sort(),
    [deals]
  );
  const uniqueSources = useMemo(
    () => Array.from(new Set(deals.map((d) => d.source))).sort(),
    [deals]
  );
  const uniqueCategories = useMemo(
    () => Array.from(new Set(deals.map((d) => d.category))).sort(),
    [deals]
  );

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case "gpu":
        return <Monitor className="h-4 w-4" />;
      case "cpu-kit":
        return <Cpu className="h-4 w-4" />;
      case "ram":
        return <MemoryStick className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "gpu":
        return "GPU";
      case "cpu-kit":
        return "CPU Kit";
      case "ram":
        return "RAM";
      default:
        return cat.toUpperCase();
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Hardware Deals</h1>
          <p className="text-muted-foreground">Monitor used hardware prices from OLX and eBay.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold">Hardware Deals</h1>
        <p className="text-muted-foreground">Monitor used hardware prices from OLX and eBay.</p>
      </div>

      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("deals")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "deals"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            Deals
          </button>
          <button
            onClick={() => setActiveTab("manual-prices")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "manual-prices"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            Manual Prices
          </button>
          <button
            onClick={() => setActiveTab("items")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "items"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            Items
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAll}
            className="border-border"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleScrape}
            disabled={scraping}
            className="bg-primary text-primary-foreground"
          >
            {scraping ? (
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-1" />
            )}
            {scraping ? "Scraping..." : "Scrape Now"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearAllDeals}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>
      </div>

      {activeTab === "deals" && (
        <>

          {/* Filters + Deals Table */}
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-0">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search deals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background border-border"
                  />
                </div>
                <Select value={filterName} onValueChange={setFilterName}>
                  <SelectTrigger className="w-[180px] bg-background border-border">
                    <SelectValue placeholder="Item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    {uniqueNames.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger className="w-[140px] bg-background border-border">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {uniqueSources.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filterCategory}
                  onValueChange={setFilterCategory}
                >
                  <SelectTrigger className="w-[140px] bg-background border-border">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {categoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Min R$"
                  type="number"
                  value={filterMinPrice}
                  onChange={(e) => setFilterMinPrice(e.target.value)}
                  className="w-[100px] bg-background border-border"
                />
                <Input
                  placeholder="Max R$"
                  type="number"
                  value={filterMaxPrice}
                  onChange={(e) => setFilterMaxPrice(e.target.value)}
                  className="w-[100px] bg-background border-border"
                />
              </div>
              <p className="text-xs text-muted-foreground mb-3">{filteredDeals.length} deals found</p>
              <div className="rounded-md border border-border overflow-hidden">
                <div className="max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-none">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow className="border-border hover:bg-transparent">
                      <SortHeader field="title">Title</SortHeader>
                      <TableHead>Item</TableHead>
                      <SortHeader field="price">Price</SortHeader>
                      <SortHeader field="source">Source</SortHeader>
                      <SortHeader field="location">Location</SortHeader>
                      <SortHeader field="found_at">Found</SortHeader>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeals.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          No deals found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDeals.slice(0, 100).map((deal) => (
                        <TableRow
                          key={deal.id}
                          className="border-border hover:bg-foreground/5"
                        >
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm truncate text-card-foreground">
                              {deal.title}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-xs whitespace-nowrap"
                            >
                              {deal.item_name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-500 whitespace-nowrap">
                              {formatPrice(deal.price)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                deal.source === "olx"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {deal.source.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                            {deal.location || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(deal.found_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <a
                                href={deal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                onClick={() => handleDeleteDeal(deal.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "manual-prices" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">
              Manual Reference Prices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>New Price</TableHead>
                    <TableHead>AliExpress</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const mp = manualPrices.find(
                      (p) => p.item_name === item.name
                    );
                    const isEditing = editingItem === item.name;

                    return (
                      <TableRow
                        key={item.name}
                        className="border-border hover:bg-foreground/5"
                      >
                        <TableCell className="font-medium text-card-foreground">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {categoryLabel(item.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="number"
                              className="w-24 h-8 bg-background border-border"
                              defaultValue={mp?.price_new ?? ""}
                              onChange={(e) =>
                                setEditValues((v) => ({
                                  ...v,
                                  price_new: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                }))
                              }
                            />
                          ) : (
                            <span className="text-sm">
                              {mp?.price_new ? formatPrice(mp.price_new) : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="number"
                              className="w-24 h-8 bg-background border-border"
                              defaultValue={mp?.price_aliexpress ?? ""}
                              onChange={(e) =>
                                setEditValues((v) => ({
                                  ...v,
                                  price_aliexpress: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                }))
                              }
                            />
                          ) : (
                            <span className="text-sm">
                              {mp?.price_aliexpress
                                ? formatPrice(mp.price_aliexpress)
                                : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="number"
                              className="w-24 h-8 bg-background border-border"
                              defaultValue={mp?.price_reference ?? ""}
                              onChange={(e) =>
                                setEditValues((v) => ({
                                  ...v,
                                  price_reference: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                }))
                              }
                            />
                          ) : (
                            <span className="text-sm">
                              {mp?.price_reference
                                ? formatPrice(mp.price_reference)
                                : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              className="w-32 h-8 bg-background border-border"
                              defaultValue={mp?.notes ?? ""}
                              onChange={(e) =>
                                setEditValues((v) => ({
                                  ...v,
                                  notes: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                              {mp?.notes || "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleSaveManualPrice(item.name)
                                }
                                className="h-7 w-7 p-0"
                              >
                                <Save className="h-3.5 w-3.5 text-green-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingItem(null);
                                  setEditValues({});
                                }}
                                className="h-7 w-7 p-0"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingItem(item.name);
                                  setEditValues({
                                    price_new: mp?.price_new ?? null,
                                    price_aliexpress:
                                      mp?.price_aliexpress ?? null,
                                    price_reference: mp?.price_reference ?? null,
                                    notes: mp?.notes ?? "",
                                  });
                                }}
                                className="h-7 w-7 p-0"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              {mp && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteManualPrice(item.name)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteItem(item.id)}
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-500"
                                title="Delete item from DB"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "items" && (
        <div className="space-y-4">
          {/* Add Item button */}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                if (showItemForm && !editingConfigItem) {
                  setShowItemForm(false);
                } else {
                  resetItemForm();
                  setShowItemForm(true);
                }
              }}
              className="bg-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>

          {/* Add/Edit form */}
          {showItemForm && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-card-foreground">
                  {editingConfigItem ? `Edit: ${editingConfigItem.name}` : "Add New Item"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Item Name</label>
                    <Input
                      placeholder="e.g. RTX 3060 12GB"
                      value={itemFormName}
                      onChange={(e) => handleItemFormNameChange(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Category</label>
                    <Select value={itemFormCategory} onValueChange={setItemFormCategory}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpu">GPU</SelectItem>
                        <SelectItem value="cpu-kit">CPU Kit</SelectItem>
                        <SelectItem value="ram">RAM</SelectItem>
                        <SelectItem value="psu">PSU (Fonte)</SelectItem>
                        <SelectItem value="ssd">SSD</SelectItem>
                        <SelectItem value="motherboard">Placa Mae</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Max Price */}
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Max Price (R$)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 1500"
                      value={itemFormMaxPrice}
                      onChange={(e) => setItemFormMaxPrice(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                {/* Keywords */}
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Keywords</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {itemFormKeywords.map((kw) => (
                      <Badge
                        key={kw}
                        variant="secondary"
                        className="text-xs gap-1 pr-1"
                      >
                        {kw}
                        <button
                          onClick={() => handleRemoveKeyword(kw)}
                          className="ml-0.5 hover:text-red-400 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {itemFormKeywords.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Type an item name above to auto-generate keywords
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom keyword..."
                      value={itemFormKeywordInput}
                      onChange={(e) => setItemFormKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                      }}
                      className="bg-background border-border flex-1 max-w-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddKeyword}
                      className="border-border"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Specs (collapsible) */}
                <div className="space-y-1.5">
                  <button
                    onClick={() => setShowSpecs(!showSpecs)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSpecs ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    Specs (optional)
                  </button>
                  {showSpecs && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                      {specsFieldsForCategory(itemFormCategory).map((field) => (
                        <div key={field.key} className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            {field.label}
                          </label>
                          <Input
                            placeholder={field.label}
                            value={itemFormSpecs[field.key] || ""}
                            onChange={(e) =>
                              setItemFormSpecs((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            className="bg-background border-border h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Scrape toggle */}
                <div className="flex items-center gap-2 pt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemFormScrapeEnabled}
                      onChange={(e) => setItemFormScrapeEnabled(e.target.checked)}
                      className="rounded border-border"
                    />
                    Enable scraping for this item
                  </label>
                  <span className="text-xs text-muted-foreground">
                    (disable for manual-price-only items like PSU, SSD)
                  </span>
                </div>

                {/* Save / Cancel */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleSaveItem}
                    className="bg-primary text-primary-foreground"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {editingConfigItem ? "Update Item" : "Save Item"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetItemForm();
                      setShowItemForm(false);
                    }}
                    className="border-border"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Items table */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-card-foreground">
                {items.length} items configured
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Keywords</TableHead>
                      <TableHead>Max Price</TableHead>
                      <TableHead>Specs</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-8"
                        >
                          No items configured. Add one to start tracking deals.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow
                          key={item.id}
                          className="border-border hover:bg-foreground/5"
                        >
                          <TableCell className="font-medium text-card-foreground">
                            {item.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {categoryIcon(item.category)}
                              <Badge variant="outline" className="text-xs">
                                {categoryLabel(item.category)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[250px]">
                              {(item.keywords || []).map((kw) => (
                                <Badge
                                  key={kw}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {kw}
                                </Badge>
                              ))}
                              {(!item.keywords || item.keywords.length === 0) && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">
                              {formatPrice(item.max_price)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {Object.entries(item.specs || {})
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(", ") || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditConfigItem(item)}
                                className="h-7 w-7 p-0"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleScrapeItem(item.id, item.name)}
                                disabled={scrapingItemId === item.id}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-green-400"
                                title="Scrape this item"
                              >
                                {scrapingItemId === item.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Search className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteItem(item.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
