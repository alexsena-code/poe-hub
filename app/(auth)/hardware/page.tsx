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
  LayoutGrid,
  List,
  Ban,
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
  const [activeTab, setActiveTab] = useState<"deals" | "manual-prices" | "items" | "store">(
    "deals"
  );

  // Filters
  const [filterName, setFilterName] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Deals pagination
  const [dealsPage, setDealsPage] = useState(1);
  const DEALS_PAGE_SIZE = 50;

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

  // Store tab state
  interface StoreProduct {
    name: string;
    manufacturer: string;
    cash_price: number;
    installment_price: number | null;
    merchant: string;
    url: string | null;
    category: string;
    rating: number | null;
    free_shipping: boolean;
    tag: string | null;
    details: string | null;
    specs: Record<string, number | string | boolean> | null;
    base_model: string | null;
  }
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [storeCategory, setStoreCategory] = useState("gpu");
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeMinPrice, setStoreMinPrice] = useState("");
  const [storeMaxPrice, setStoreMaxPrice] = useState("");
  const [storeView, setStoreView] = useState<"grid" | "table">("grid");
  const [storeSortField, setStoreSortField] = useState<"cash_price" | "name" | "manufacturer" | "merchant">("cash_price");
  const [storeSortDir, setStoreSortDir] = useState<"asc" | "desc">("asc");
  // Spec filters (select-based, values derived from loaded products)
  const [specVram, setSpecVram] = useState("");
  const [specCapacity, setSpecCapacity] = useState("");
  const [specWattage, setSpecWattage] = useState("");
  const [specSocket, setSpecSocket] = useState("");
  const [specMemType, setSpecMemType] = useState("");
  const [specPanel, setSpecPanel] = useState("");
  const [specRefresh, setSpecRefresh] = useState("");
  const [specResolution, setSpecResolution] = useState("");
  const [specFormFactor, setSpecFormFactor] = useState("");
  const [specEfficiency, setSpecEfficiency] = useState("");
  const [specManufacturer, setSpecManufacturer] = useState("");
  const [specBaseModel, setSpecBaseModel] = useState("");

  // Extract unique spec values from loaded products
  const specOptions = useMemo(() => {
    const extract = (key: string) => {
      const vals = new Set<string>();
      for (const p of storeProducts) {
        const v = p.specs?.[key];
        if (v !== undefined && v !== null && v !== true && v !== false) vals.add(String(v));
      }
      return [...vals].sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
    };
    return {
      vram_gb: extract("vram_gb"),
      capacity_gb: extract("capacity_gb"),
      wattage: extract("wattage"),
      socket: extract("socket"),
      memory_type: [...new Set([...extract("memory_type"), ...extract("type")])].sort(),
      panel: extract("panel"),
      refresh_rate: extract("refresh_rate"),
      resolution: extract("resolution"),
      form_factor: extract("form_factor"),
      efficiency: extract("efficiency"),
      manufacturer: [...new Set(storeProducts.map((p) => p.manufacturer).filter(Boolean))].sort(),
      base_model: [...new Set(storeProducts.map((p) => p.base_model).filter(Boolean) as string[])].sort(),
    };
  }, [storeProducts]);
  const [syncing, setSyncing] = useState(false);
  const [storePage, setStorePage] = useState(1);
  const STORE_PAGE_SIZE = 24;
  interface SyncResult {
    item: string;
    new_price: number;
    product: string;
    merchant: string;
  }
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);

  // Price comparison state
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
  const [priceComparison, setPriceComparison] = useState<PriceCompItem[]>([]);

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

  const fetchStoreProducts = async (cat: string) => {
    setStoreLoading(true);
    setStorePage(1);
    // Reset spec filters on category change
    setSpecVram(""); setSpecCapacity(""); setSpecWattage(""); setSpecSocket("");
    setSpecMemType(""); setSpecPanel(""); setSpecRefresh(""); setSpecResolution("");
    setSpecFormFactor(""); setSpecEfficiency(""); setSpecManufacturer(""); setSpecBaseModel("");
    try {
      const res = await fetch(
        `${HARDWARE_API}/api/new-prices/${cat}`
      );
      const data = await res.json();
      setStoreProducts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to fetch store prices");
      setStoreProducts([]);
    } finally {
      setStoreLoading(false);
    }
  };

  const fetchPriceComparison = async () => {
    try {
      const res = await fetch(`${HARDWARE_API}/api/analytics/price-comparison`);
      const data = await res.json();
      setPriceComparison(Array.isArray(data) ? data : []);
    } catch {
      setPriceComparison([]);
    }
  };

  const handleSyncNewPrices = async () => {
    setSyncing(true);
    setSyncResults([]);
    try {
      const res = await fetch(`${HARDWARE_API}/api/sync-new-prices`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.status === "ok") {
        toast.success(`Synced ${data.updated} prices from PCBuildWizard`);
        setSyncResults(data.items || []);
        fetchAll();
        fetchPriceComparison();
      } else {
        toast.error("Sync failed");
      }
    } catch {
      toast.error("Failed to sync prices");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (activeTab === "store") {
      fetchStoreProducts(storeCategory);
    }
    if (activeTab === "manual-prices") {
      fetchPriceComparison();
    }
  }, [activeTab, storeCategory]);

  const filteredStoreProducts = useMemo(() => {
    let result = storeProducts;
    if (storeSearch.trim()) {
      const q = storeSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.manufacturer.toLowerCase().includes(q) ||
          p.merchant.toLowerCase().includes(q)
      );
    }
    const minP = parseFloat(storeMinPrice);
    if (!isNaN(minP)) result = result.filter((p) => p.cash_price >= minP);
    const maxP = parseFloat(storeMaxPrice);
    if (!isNaN(maxP)) result = result.filter((p) => p.cash_price <= maxP);
    // Spec filters (exact match from selects)
    if (specVram) result = result.filter((p) => String(p.specs?.vram_gb) === specVram);
    if (specCapacity) result = result.filter((p) => String(p.specs?.capacity_gb) === specCapacity);
    if (specWattage) result = result.filter((p) => String(p.specs?.wattage) === specWattage);
    if (specSocket) result = result.filter((p) => String(p.specs?.socket || "") === specSocket);
    if (specMemType) result = result.filter((p) => (p.specs?.memory_type || p.specs?.type || "") === specMemType);
    if (specPanel) result = result.filter((p) => String(p.specs?.panel || "") === specPanel);
    if (specRefresh) result = result.filter((p) => String(p.specs?.refresh_rate) === specRefresh);
    if (specResolution) result = result.filter((p) => String(p.specs?.resolution || "") === specResolution);
    if (specFormFactor) result = result.filter((p) => String(p.specs?.form_factor || "") === specFormFactor);
    if (specEfficiency) result = result.filter((p) => String(p.specs?.efficiency || "") === specEfficiency);
    if (specManufacturer) result = result.filter((p) => p.manufacturer === specManufacturer);
    if (specBaseModel) result = result.filter((p) => p.base_model === specBaseModel);
    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (storeSortField === "cash_price") cmp = a.cash_price - b.cash_price;
      else cmp = (a[storeSortField] || "").localeCompare(b[storeSortField] || "");
      return storeSortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [storeProducts, storeSearch, storeMinPrice, storeMaxPrice, storeSortField, storeSortDir,
      specVram, specCapacity, specWattage, specSocket, specMemType, specPanel, specRefresh, specResolution, specFormFactor, specEfficiency, specManufacturer, specBaseModel]);

  // Reset page when filters change
  useEffect(() => {
    setStorePage(1);
  }, [storeSearch, storeMinPrice, storeMaxPrice, specVram, specCapacity, specWattage, specSocket, specMemType, specPanel, specRefresh, specResolution, specFormFactor, specEfficiency]);

  const totalStorePages = Math.ceil(filteredStoreProducts.length / STORE_PAGE_SIZE);
  const pagedStoreProducts = filteredStoreProducts.slice(
    (storePage - 1) * STORE_PAGE_SIZE,
    storePage * STORE_PAGE_SIZE
  );

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

  const handleBanDeal = async (dealId: number, title: string) => {
    if (!window.confirm(`Ban "${title}"? It will be deleted and never re-imported.`)) return;
    try {
      const res = await fetch(`${HARDWARE_API}/api/deals/${dealId}/ban`, { method: "POST" });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== dealId));
        toast.success("Deal banned permanently");
      } else {
        toast.error("Failed to ban deal");
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

  const SPEC_LABELS: Record<string, string> = {
    vram_gb: "VRAM (GB)", tdp_w: "TDP (W)", cuda_cores: "CUDA Cores",
    memory_type: "Memory Type", pcie_gen: "PCIe Gen", pcie_lanes: "PCIe Lanes", lhr: "LHR",
    cores: "Cores", threads: "Threads", p_cores: "P-Cores", e_cores: "E-Cores",
    base_clock_ghz: "Base Clock (GHz)", boost_clock_ghz: "Boost Clock (GHz)",
    socket: "Socket", hyperthreading: "Hyperthreading", smt: "SMT",
    capacity_gb: "Capacity (GB)", type: "Type", speed_mhz: "Speed (MHz)", cas_latency: "CAS Latency",
    color: "Color", rgb: "RGB",
    form_factor: "Form Factor", interface: "Interface",
    wattage: "Wattage (W)", efficiency: "Efficiency", modular: "Modular",
    atx_version: "ATX Version", gpu_connector: "GPU Connector",
    size_inches: "Size (inches)", resolution: "Resolution", panel: "Panel",
    refresh_rate: "Refresh Rate (Hz)", refresh_rate_oc: "OC Refresh (Hz)",
  };

  const specsFieldsForCategory = (cat: string): { key: string; label: string }[] => {
    // Base fields per category
    const base: Record<string, string[]> = {
      "gpu": ["vram_gb", "memory_type", "pcie_gen", "tdp_w", "cuda_cores"],
      "cpu-kit": ["cores", "p_cores", "e_cores", "threads", "socket", "base_clock_ghz", "boost_clock_ghz"],
      "cpu": ["cores", "p_cores", "e_cores", "threads", "socket", "base_clock_ghz", "boost_clock_ghz"],
      "ram": ["capacity_gb", "type", "speed_mhz", "cas_latency"],
      "motherboard": ["socket", "form_factor", "memory_type", "pcie_gen"],
      "ssd": ["capacity_gb", "form_factor", "interface", "pcie_gen"],
      "psu": ["wattage", "efficiency", "modular", "gpu_connector"],
      "monitor": ["size_inches", "resolution", "panel", "refresh_rate"],
    };
    const keys = base[cat] || [];
    // Also include any extra keys from current form specs not in base
    const extra = Object.keys(itemFormSpecs).filter((k) => !keys.includes(k) && k in SPEC_LABELS);
    return [...keys, ...extra].map((k) => ({ key: k, label: SPEC_LABELS[k] || k }));
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

  // Reset deals page on filter change
  useEffect(() => { setDealsPage(1); }, [filterName, filterSource, filterCategory, filterMinPrice, filterMaxPrice, searchQuery]);

  const totalDealsPages = Math.ceil(filteredDeals.length / DEALS_PAGE_SIZE);
  const pagedDeals = filteredDeals.slice((dealsPage - 1) * DEALS_PAGE_SIZE, dealsPage * DEALS_PAGE_SIZE);

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
          <button
            onClick={() => setActiveTab("store")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "store"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            Store Prices
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
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{filteredDeals.length} deals found</p>
                {totalDealsPages > 1 && (
                  <p className="text-xs text-muted-foreground">Page {dealsPage} of {totalDealsPages}</p>
                )}
              </div>
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
                      pagedDeals.map((deal) => (
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
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-orange-400"
                                title="Ban — never re-import"
                                onClick={() => handleBanDeal(deal.id, deal.title)}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                title="Delete"
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

          {/* Deals pagination */}
          {totalDealsPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={dealsPage <= 1} onClick={() => setDealsPage((p) => p - 1)} className="border-border">
                Previous
              </Button>
              {Array.from({ length: Math.min(totalDealsPages, 7) }, (_, i) => {
                let page: number;
                if (totalDealsPages <= 7) page = i + 1;
                else if (dealsPage <= 4) page = i + 1;
                else if (dealsPage >= totalDealsPages - 3) page = totalDealsPages - 6 + i;
                else page = dealsPage - 3 + i;
                return (
                  <Button key={page} variant={dealsPage === page ? "default" : "outline"} size="sm" onClick={() => setDealsPage(page)} className={`w-8 h-8 p-0 ${dealsPage !== page ? "border-border" : ""}`}>
                    {page}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" disabled={dealsPage >= totalDealsPages} onClick={() => setDealsPage((p) => p + 1)} className="border-border">
                Next
              </Button>
            </div>
          )}
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

      {activeTab === "store" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={storeCategory} onValueChange={setStoreCategory}>
              <SelectTrigger className="w-[180px] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpu">GPUs</SelectItem>
                <SelectItem value="cpu">CPUs</SelectItem>
                <SelectItem value="ram">RAM</SelectItem>
                <SelectItem value="motherboard">Motherboards</SelectItem>
                <SelectItem value="ssd">SSDs</SelectItem>
                <SelectItem value="psu">Power Supplies</SelectItem>
                <SelectItem value="cooler">CPU Coolers</SelectItem>
                <SelectItem value="case">Cases</SelectItem>
                <SelectItem value="monitor">Monitors</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="pl-9 border-border"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                placeholder="Min R$"
                value={storeMinPrice}
                onChange={(e) => setStoreMinPrice(e.target.value)}
                className="w-24 border-border text-sm"
              />
              <span className="text-muted-foreground text-xs">-</span>
              <Input
                type="number"
                placeholder="Max R$"
                value={storeMaxPrice}
                onChange={(e) => setStoreMaxPrice(e.target.value)}
                className="w-24 border-border text-sm"
              />
            </div>
            {/* Brand filter — all categories */}
            {specOptions.manufacturer.length > 1 && (
              <Select value={specManufacturer || "__all__"} onValueChange={(v) => setSpecManufacturer(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-32 border-border text-sm"><SelectValue placeholder="Brand" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Brands</SelectItem>
                  {specOptions.manufacturer.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {/* Base model filter — all categories */}
            {specOptions.base_model.length > 1 && (
              <Select value={specBaseModel || "__all__"} onValueChange={(v) => setSpecBaseModel(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-36 border-border text-sm"><SelectValue placeholder="Model" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Models</SelectItem>
                  {specOptions.base_model.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {/* Dynamic spec filters based on available values */}
            {specOptions.vram_gb.length > 1 && storeCategory === "gpu" && (
              <Select value={specVram || "__all__"} onValueChange={(v) => setSpecVram(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-28 border-border text-sm"><SelectValue placeholder="VRAM" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All VRAM</SelectItem>
                  {specOptions.vram_gb.map((v) => <SelectItem key={v} value={v}>{v} GB</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {specOptions.capacity_gb.length > 1 && (storeCategory === "ram" || storeCategory === "ssd") && (
              <Select value={specCapacity || "__all__"} onValueChange={(v) => setSpecCapacity(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-28 border-border text-sm"><SelectValue placeholder="Capacity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Sizes</SelectItem>
                  {specOptions.capacity_gb.map((v) => <SelectItem key={v} value={v}>{Number(v) >= 1000 ? `${Number(v)/1000} TB` : `${v} GB`}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {specOptions.memory_type.length > 1 && (storeCategory === "ram" || storeCategory === "motherboard") && (
              <Select value={specMemType || "__all__"} onValueChange={(v) => setSpecMemType(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-24 border-border text-sm"><SelectValue placeholder="DDR" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All DDR</SelectItem>
                  {specOptions.memory_type.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {specOptions.socket.length > 1 && (storeCategory === "cpu" || storeCategory === "motherboard") && (
              <Select value={specSocket || "__all__"} onValueChange={(v) => setSpecSocket(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-28 border-border text-sm"><SelectValue placeholder="Socket" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Sockets</SelectItem>
                  {specOptions.socket.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {specOptions.form_factor.length > 1 && (storeCategory === "motherboard" || storeCategory === "ssd") && (
              <Select value={specFormFactor || "__all__"} onValueChange={(v) => setSpecFormFactor(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-28 border-border text-sm"><SelectValue placeholder="Form" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Forms</SelectItem>
                  {specOptions.form_factor.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {specOptions.wattage.length > 1 && storeCategory === "psu" && (
              <Select value={specWattage || "__all__"} onValueChange={(v) => setSpecWattage(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-28 border-border text-sm"><SelectValue placeholder="Watts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Watts</SelectItem>
                  {specOptions.wattage.map((v) => <SelectItem key={v} value={v}>{v} W</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {specOptions.efficiency.length > 1 && storeCategory === "psu" && (
              <Select value={specEfficiency || "__all__"} onValueChange={(v) => setSpecEfficiency(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-32 border-border text-sm"><SelectValue placeholder="Efficiency" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {specOptions.efficiency.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {specOptions.panel.length > 1 && storeCategory === "monitor" && (
              <Select value={specPanel || "__all__"} onValueChange={(v) => setSpecPanel(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-24 border-border text-sm"><SelectValue placeholder="Panel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {specOptions.panel.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {specOptions.resolution.length > 1 && storeCategory === "monitor" && (
              <Select value={specResolution || "__all__"} onValueChange={(v) => setSpecResolution(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-24 border-border text-sm"><SelectValue placeholder="Res" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {specOptions.resolution.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {specOptions.refresh_rate.length > 1 && storeCategory === "monitor" && (
              <Select value={specRefresh || "__all__"} onValueChange={(v) => setSpecRefresh(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-24 border-border text-sm"><SelectValue placeholder="Hz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Hz</SelectItem>
                  {specOptions.refresh_rate.map((v) => <SelectItem key={v} value={v}>{v} Hz</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center border border-border rounded-md">
              <button
                onClick={() => setStoreView("grid")}
                className={`p-1.5 rounded-l-md transition-colors ${storeView === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setStoreView("table")}
                className={`p-1.5 rounded-r-md transition-colors ${storeView === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStoreProducts(storeCategory)}
              disabled={storeLoading}
              className="border-border"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${storeLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleSyncNewPrices}
              disabled={syncing}
            >
              {syncing ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Package className="h-4 w-4 mr-1" />
              )}
              {syncing ? "Syncing..." : "Sync to Manual Prices"}
            </Button>
          </div>

          {/* Sync results */}
          {syncResults.length > 0 && (
            <Card className="bg-card border-green-500/30">
              <CardContent className="pt-4 pb-3">
                <p className="text-sm font-medium text-green-400 mb-2">
                  Synced {syncResults.length} prices:
                </p>
                <div className="flex flex-wrap gap-2">
                  {syncResults.map((r) => (
                    <Badge key={r.item} variant="secondary" className="text-xs">
                      {r.item}: {formatPrice(r.new_price)} @ {r.merchant}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Products grid */}
          {storeLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
          ) : filteredStoreProducts.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                No products found for this category.
              </CardContent>
            </Card>
          ) : (
            <>
            {/* Product count + pagination info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {filteredStoreProducts.length} products
                {storeSearch.trim() ? ` matching "${storeSearch}"` : ""}
              </span>
              {totalStorePages > 1 && (
                <span>Page {storePage} of {totalStorePages}</span>
              )}
            </div>
            {storeView === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {pagedStoreProducts.map((product, idx) => (
                <Card
                  key={`${product.name}-${idx}`}
                  className="bg-card border-border hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight truncate" title={product.name}>
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.manufacturer}
                        </p>
                      </div>
                      {product.rating && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {product.rating.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                    {product.specs && Object.keys(product.specs).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(product.specs).filter(([, v]) => v !== true && v !== false).slice(0, 4).map(([k, v]) => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                            {String(v)}{k.includes("gb") ? "GB" : k.includes("mhz") ? "MHz" : k === "wattage" ? "W" : k === "refresh_rate" ? "Hz" : k.includes("inches") ? '"' : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-end justify-between mt-3">
                      <div>
                        <p className="text-lg font-bold text-green-400">
                          {formatPrice(product.cash_price)}
                        </p>
                        {product.installment_price && (
                          <p className="text-xs text-muted-foreground">
                            ou {formatPrice(product.installment_price)} parcelado
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground truncate max-w-[100px]" title={product.merchant}>
                          {product.merchant}
                        </p>
                        {product.free_shipping && (
                          <Badge variant="secondary" className="text-xs mt-0.5">
                            Frete gratis
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1.5 mt-3">
                      {product.url && (
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button variant="outline" size="sm" className="w-full h-7 text-xs border-border">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs border-border hover:bg-primary/10 hover:text-primary"
                        onClick={() => {
                          setActiveTab("items");
                          setShowItemForm(true);
                          setEditingConfigItem(null);
                          setItemFormName(product.name);
                          setItemFormCategory(storeCategory === "cpu" ? "cpu-kit" : storeCategory);
                          setItemFormMaxPrice(String(Math.round(product.cash_price)));
                          setItemFormKeywords(generateKeywords(product.name));
                          setItemFormScrapeEnabled(false);
                          if (product.specs && Object.keys(product.specs).length > 0) {
                            setItemFormSpecs(Object.fromEntries(
                              Object.entries(product.specs).filter(([, v]) => v !== true && v !== false).map(([k, v]) => [k, String(v)])
                            ));
                            setShowSpecs(true);
                          }
                          toast.info(`"${product.name}" loaded into item form`);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Item
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => { setStoreSortField("name"); setStoreSortDir(storeSortField === "name" && storeSortDir === "asc" ? "desc" : "asc"); }}
                        >
                          <div className="flex items-center gap-1">Product <ArrowUpDown className="h-3 w-3 opacity-50" /></div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => { setStoreSortField("manufacturer"); setStoreSortDir(storeSortField === "manufacturer" && storeSortDir === "asc" ? "desc" : "asc"); }}
                        >
                          <div className="flex items-center gap-1">Brand <ArrowUpDown className="h-3 w-3 opacity-50" /></div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground text-right"
                          onClick={() => { setStoreSortField("cash_price"); setStoreSortDir(storeSortField === "cash_price" && storeSortDir === "asc" ? "desc" : "asc"); }}
                        >
                          <div className="flex items-center gap-1 justify-end">Price <ArrowUpDown className="h-3 w-3 opacity-50" /></div>
                        </TableHead>
                        <TableHead>Installment</TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => { setStoreSortField("merchant"); setStoreSortDir(storeSortField === "merchant" && storeSortDir === "asc" ? "desc" : "asc"); }}
                        >
                          <div className="flex items-center gap-1">Store <ArrowUpDown className="h-3 w-3 opacity-50" /></div>
                        </TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Specs</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedStoreProducts.map((product, idx) => (
                        <TableRow key={`${product.name}-${idx}`} className="border-border hover:bg-muted/5">
                          <TableCell className="max-w-[280px]">
                            <p className="font-medium text-sm truncate" title={product.name}>{product.name}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{product.manufacturer}</TableCell>
                          <TableCell className="text-right font-medium text-green-400">
                            {formatPrice(product.cash_price)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.installment_price ? formatPrice(product.installment_price) : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[100px]" title={product.merchant}>{product.merchant}</span>
                              {product.free_shipping && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">Frete</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <input
                              className="text-xs bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-28 text-muted-foreground"
                              defaultValue={product.base_model || ""}
                              placeholder="-"
                              onBlur={async (e) => {
                                const val = e.target.value.trim();
                                if (val !== (product.base_model || "") && product.tag) {
                                  try {
                                    await fetch(`${HARDWARE_API}/api/store-products/${product.tag}/base-model?base_model=${encodeURIComponent(val)}`, { method: "PUT" });
                                    toast.success(`Model updated: ${val}`);
                                  } catch { toast.error("Failed to update"); }
                                }
                              }}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {product.specs && Object.entries(product.specs).filter(([, v]) => v !== true && v !== false).slice(0, 4).map(([k, v]) => (
                                <span key={k} className="text-[10px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground">
                                  {String(v)}{k.includes("gb") ? "GB" : k.includes("mhz") ? "MHz" : k === "wattage" ? "W" : k === "refresh_rate" ? "Hz" : k.includes("inches") ? '"' : ""}
                                </span>
                              ))}
                              {(!product.specs || Object.keys(product.specs).length === 0) && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.rating ? product.rating.toFixed(1) : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {product.url && (
                                <a href={product.url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </a>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                title="Add to Items"
                                onClick={() => {
                                  setActiveTab("items");
                                  setShowItemForm(true);
                                  setEditingConfigItem(null);
                                  setItemFormName(product.name);
                                  setItemFormCategory(storeCategory === "cpu" ? "cpu-kit" : storeCategory);
                                  setItemFormMaxPrice(String(Math.round(product.cash_price)));
                                  setItemFormKeywords(generateKeywords(product.name));
                                  setItemFormScrapeEnabled(false);
                                  toast.info(`"${product.name}" loaded into item form`);
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Pagination */}
            {totalStorePages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={storePage <= 1}
                  onClick={() => setStorePage((p) => p - 1)}
                  className="border-border"
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(totalStorePages, 7) }, (_, i) => {
                  let page: number;
                  if (totalStorePages <= 7) {
                    page = i + 1;
                  } else if (storePage <= 4) {
                    page = i + 1;
                  } else if (storePage >= totalStorePages - 3) {
                    page = totalStorePages - 6 + i;
                  } else {
                    page = storePage - 3 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={storePage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStorePage(page)}
                      className={`w-8 h-8 p-0 ${storePage !== page ? "border-border" : ""}`}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={storePage >= totalStorePages}
                  onClick={() => setStorePage((p) => p + 1)}
                  className="border-border"
                >
                  Next
                </Button>
              </div>
            )}
            </>
          )}

          {/* Price Comparison: Used vs New */}
          {priceComparison.length > 0 && (
            <Card className="bg-card border-border mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Used vs New — Price Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Item</TableHead>
                        <TableHead>OLX Min</TableHead>
                        <TableHead>OLX Avg</TableHead>
                        <TableHead>Deals</TableHead>
                        <TableHead>New Price</TableHead>
                        <TableHead>Savings</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceComparison.map((item) => (
                        <TableRow key={item.item_name} className="border-border">
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell>
                            {item.olx_min ? formatPrice(item.olx_min) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.olx_avg ? formatPrice(item.olx_avg) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{item.olx_count}</TableCell>
                          <TableCell>
                            {item.price_new ? (
                              <span className="text-green-400">{formatPrice(item.price_new)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.savings_pct !== null ? (
                              <Badge
                                variant={item.savings_pct > 0 ? "default" : "destructive"}
                                className={item.savings_pct > 30 ? "bg-green-600" : item.savings_pct > 0 ? "bg-yellow-600" : ""}
                              >
                                {item.savings_pct > 0 ? `-${item.savings_pct}%` : `+${Math.abs(item.savings_pct)}%`}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {item.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
