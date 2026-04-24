"use client";

import { useMemo, useEffect, useState } from "react";
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
import {
  ExternalLink,
  Search,
  ArrowUpDown,
  Plus,
  RefreshCw,
  Package,
  LayoutGrid,
  List,
} from "lucide-react";
import { formatPriceBrl, generateKeywords } from "./helpers";
import type {
  StoreProduct,
  SyncResult,
  PriceCompItem,
} from "./types";
import type { PrefilledItemValues } from "./items-tab";

const STORE_PAGE_SIZE = 24;

interface StorePricesTabProps {
  hardwareApiUrl: string;
  onLoadIntoItemForm: (values: PrefilledItemValues) => void;
  onSyncComplete: () => void;
}

type StoreSortField = "cash_price" | "name" | "manufacturer" | "merchant";

/**
 * Store Prices tab — PCBuildWizard BR live prices feed.
 * Fetches per-category, supports spec filters, grid/table views, pagination.
 * "Sync to Manual Prices" writes back to the hardware API and triggers a
 * parent re-fetch (onSyncComplete). "Add Item" pre-fills the Items form tab.
 */
export function StorePricesTab({
  hardwareApiUrl,
  onLoadIntoItemForm,
  onSyncComplete,
}: StorePricesTabProps) {
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [storeCategory, setStoreCategory] = useState("gpu");
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeMinPrice, setStoreMinPrice] = useState("");
  const [storeMaxPrice, setStoreMaxPrice] = useState("");
  const [storeView, setStoreView] = useState<"grid" | "table">("grid");
  const [storeSortField, setStoreSortField] = useState<StoreSortField>("cash_price");
  const [storeSortDir, setStoreSortDir] = useState<"asc" | "desc">("asc");
  const [storePage, setStorePage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [priceComparison, setPriceComparison] = useState<PriceCompItem[]>([]);

  // Spec filters — select-based, values derived from loaded products.
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

  const fetchStoreProducts = async (cat: string) => {
    setStoreLoading(true);
    setStorePage(1);
    // Reset spec filters on category change so stale values don't carry over.
    setSpecVram(""); setSpecCapacity(""); setSpecWattage(""); setSpecSocket("");
    setSpecMemType(""); setSpecPanel(""); setSpecRefresh(""); setSpecResolution("");
    setSpecFormFactor(""); setSpecEfficiency(""); setSpecManufacturer(""); setSpecBaseModel("");
    try {
      const res = await fetch(`${hardwareApiUrl}/api/new-prices/${cat}`);
      const data = await res.json();
      setStoreProducts(Array.isArray(data) ? data : []);
    } catch {
      setStoreProducts([]);
    } finally {
      setStoreLoading(false);
    }
  };

  const fetchPriceComparison = async () => {
    try {
      const res = await fetch(`${hardwareApiUrl}/api/analytics/price-comparison`);
      const data = await res.json();
      setPriceComparison(Array.isArray(data) ? data : []);
    } catch {
      setPriceComparison([]);
    }
  };

  useEffect(() => {
    fetchStoreProducts(storeCategory);
    fetchPriceComparison();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCategory]);

  const handleSyncNewPrices = async () => {
    setSyncing(true);
    setSyncResults([]);
    try {
      const res = await fetch(`${hardwareApiUrl}/api/sync-new-prices`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.status === "ok") {
        setSyncResults(data.items || []);
        onSyncComplete();
        fetchPriceComparison();
      }
    } finally {
      setSyncing(false);
    }
  };

  const specOptions = useMemo(() => {
    const extract = (key: string) => {
      const vals = new Set<string>();
      for (const p of storeProducts) {
        const v = p.specs?.[key];
        if (v !== undefined && v !== null && v !== true && v !== false)
          vals.add(String(v));
      }
      return [...vals].sort((a, b) => {
        const na = parseFloat(a);
        const nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
    };
    return {
      vram_gb: extract("vram_gb"),
      capacity_gb: extract("capacity_gb"),
      wattage: extract("wattage"),
      socket: extract("socket"),
      memory_type: [
        ...new Set([...extract("memory_type"), ...extract("type")]),
      ].sort(),
      panel: extract("panel"),
      refresh_rate: extract("refresh_rate"),
      resolution: extract("resolution"),
      form_factor: extract("form_factor"),
      efficiency: extract("efficiency"),
      manufacturer: [
        ...new Set(storeProducts.map((p) => p.manufacturer).filter(Boolean)),
      ].sort(),
      base_model: [
        ...new Set(
          storeProducts.map((p) => p.base_model).filter(Boolean) as string[]
        ),
      ].sort(),
    };
  }, [storeProducts]);

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
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (storeSortField === "cash_price") cmp = a.cash_price - b.cash_price;
      else cmp = (a[storeSortField] || "").localeCompare(b[storeSortField] || "");
      return storeSortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [
    storeProducts, storeSearch, storeMinPrice, storeMaxPrice, storeSortField,
    storeSortDir, specVram, specCapacity, specWattage, specSocket, specMemType,
    specPanel, specRefresh, specResolution, specFormFactor, specEfficiency,
    specManufacturer, specBaseModel,
  ]);

  useEffect(() => {
    setStorePage(1);
  }, [
    storeSearch, storeMinPrice, storeMaxPrice, specVram, specCapacity,
    specWattage, specSocket, specMemType, specPanel, specRefresh,
    specResolution, specFormFactor, specEfficiency,
  ]);

  const totalStorePages = Math.ceil(filteredStoreProducts.length / STORE_PAGE_SIZE);
  const pagedStoreProducts = filteredStoreProducts.slice(
    (storePage - 1) * STORE_PAGE_SIZE,
    storePage * STORE_PAGE_SIZE
  );

  const handleLoadIntoItemForm = (product: StoreProduct, withSpecs = false) => {
    const specsRaw = withSpecs && product.specs
      ? Object.fromEntries(
          Object.entries(product.specs)
            .filter(([, v]) => v !== true && v !== false)
            .map(([k, v]) => [k, String(v)])
        )
      : {};
    onLoadIntoItemForm({
      name: product.name,
      category: storeCategory === "cpu" ? "cpu-kit" : storeCategory,
      maxPrice: String(Math.round(product.cash_price)),
      keywords: generateKeywords(product.name),
      specs: specsRaw,
      scrapeEnabled: false,
    });
  };

  const sortCol = (field: StoreSortField, label: string) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => {
        setStoreSortField(field);
        setStoreSortDir(
          storeSortField === field && storeSortDir === "asc" ? "desc" : "asc"
        );
      }}
    >
      <div className="flex items-center gap-1">
        {label} <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Controls row */}
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
        {specOptions.manufacturer.length > 1 && (
          <Select
            value={specManufacturer || "__all__"}
            onValueChange={(v) => setSpecManufacturer(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-32 border-border text-sm">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Brands</SelectItem>
              {specOptions.manufacturer.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.base_model.length > 1 && (
          <Select
            value={specBaseModel || "__all__"}
            onValueChange={(v) => setSpecBaseModel(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-36 border-border text-sm">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Models</SelectItem>
              {specOptions.base_model.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.vram_gb.length > 1 && storeCategory === "gpu" && (
          <Select
            value={specVram || "__all__"}
            onValueChange={(v) => setSpecVram(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-28 border-border text-sm">
              <SelectValue placeholder="VRAM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All VRAM</SelectItem>
              {specOptions.vram_gb.map((v) => (
                <SelectItem key={v} value={v}>{v} GB</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.capacity_gb.length > 1 && (storeCategory === "ram" || storeCategory === "ssd") && (
          <Select
            value={specCapacity || "__all__"}
            onValueChange={(v) => setSpecCapacity(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-28 border-border text-sm">
              <SelectValue placeholder="Capacity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Sizes</SelectItem>
              {specOptions.capacity_gb.map((v) => (
                <SelectItem key={v} value={v}>
                  {Number(v) >= 1000 ? `${Number(v) / 1000} TB` : `${v} GB`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.memory_type.length > 1 && (storeCategory === "ram" || storeCategory === "motherboard") && (
          <Select
            value={specMemType || "__all__"}
            onValueChange={(v) => setSpecMemType(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-24 border-border text-sm">
              <SelectValue placeholder="DDR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All DDR</SelectItem>
              {specOptions.memory_type.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.socket.length > 1 && (storeCategory === "cpu" || storeCategory === "motherboard") && (
          <Select
            value={specSocket || "__all__"}
            onValueChange={(v) => setSpecSocket(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-28 border-border text-sm">
              <SelectValue placeholder="Socket" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Sockets</SelectItem>
              {specOptions.socket.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.form_factor.length > 1 && (storeCategory === "motherboard" || storeCategory === "ssd") && (
          <Select
            value={specFormFactor || "__all__"}
            onValueChange={(v) => setSpecFormFactor(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-28 border-border text-sm">
              <SelectValue placeholder="Form" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Forms</SelectItem>
              {specOptions.form_factor.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.wattage.length > 1 && storeCategory === "psu" && (
          <Select
            value={specWattage || "__all__"}
            onValueChange={(v) => setSpecWattage(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-28 border-border text-sm">
              <SelectValue placeholder="Watts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Watts</SelectItem>
              {specOptions.wattage.map((v) => (
                <SelectItem key={v} value={v}>{v} W</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.efficiency.length > 1 && storeCategory === "psu" && (
          <Select
            value={specEfficiency || "__all__"}
            onValueChange={(v) => setSpecEfficiency(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-32 border-border text-sm">
              <SelectValue placeholder="Efficiency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {specOptions.efficiency.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.panel.length > 1 && storeCategory === "monitor" && (
          <Select
            value={specPanel || "__all__"}
            onValueChange={(v) => setSpecPanel(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-24 border-border text-sm">
              <SelectValue placeholder="Panel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {specOptions.panel.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.resolution.length > 1 && storeCategory === "monitor" && (
          <Select
            value={specResolution || "__all__"}
            onValueChange={(v) => setSpecResolution(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-24 border-border text-sm">
              <SelectValue placeholder="Res" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {specOptions.resolution.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specOptions.refresh_rate.length > 1 && storeCategory === "monitor" && (
          <Select
            value={specRefresh || "__all__"}
            onValueChange={(v) => setSpecRefresh(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="w-24 border-border text-sm">
              <SelectValue placeholder="Hz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Hz</SelectItem>
              {specOptions.refresh_rate.map((v) => (
                <SelectItem key={v} value={v}>{v} Hz</SelectItem>
              ))}
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
        <Button size="sm" onClick={handleSyncNewPrices} disabled={syncing}>
          {syncing ? (
            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Package className="h-4 w-4 mr-1" />
          )}
          {syncing ? "Syncing..." : "Sync to Manual Prices"}
        </Button>
      </div>

      {/* Sync results banner */}
      {syncResults.length > 0 && (
        <Card className="bg-card border-green-500/30">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm font-medium text-green-400 mb-2">
              Synced {syncResults.length} prices:
            </p>
            <div className="flex flex-wrap gap-2">
              {syncResults.map((r) => (
                <Badge key={r.item} variant="secondary" className="text-xs">
                  {r.item}: {formatPriceBrl(r.new_price)} @ {r.merchant}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products */}
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
                        <p
                          className="font-medium text-sm leading-tight truncate"
                          title={product.name}
                        >
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
                        {Object.entries(product.specs)
                          .filter(([, v]) => v !== true && v !== false)
                          .slice(0, 4)
                          .map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground"
                            >
                              {String(v)}{k.includes("gb") ? "GB" : k.includes("mhz") ? "MHz" : k === "wattage" ? "W" : k === "refresh_rate" ? "Hz" : k.includes("inches") ? '"' : ""}
                            </span>
                          ))}
                      </div>
                    )}
                    <div className="flex items-end justify-between mt-3">
                      <div>
                        <p className="text-lg font-bold text-green-400">
                          {formatPriceBrl(product.cash_price)}
                        </p>
                        {product.installment_price && (
                          <p className="text-xs text-muted-foreground">
                            ou {formatPriceBrl(product.installment_price)} parcelado
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className="text-xs text-muted-foreground truncate max-w-[100px]"
                          title={product.merchant}
                        >
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-xs border-border"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs border-border hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleLoadIntoItemForm(product, true)}
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
                        {sortCol("name", "Product")}
                        {sortCol("manufacturer", "Brand")}
                        <TableHead className="text-right">{sortCol("cash_price", "Price")}</TableHead>
                        <TableHead>Installment</TableHead>
                        {sortCol("merchant", "Store")}
                        <TableHead>Model</TableHead>
                        <TableHead>Specs</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedStoreProducts.map((product, idx) => (
                        <TableRow
                          key={`${product.name}-${idx}`}
                          className="border-border hover:bg-muted/5"
                        >
                          <TableCell className="max-w-[280px]">
                            <p
                              className="font-medium text-sm truncate"
                              title={product.name}
                            >
                              {product.name}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.manufacturer}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-400">
                            {formatPriceBrl(product.cash_price)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.installment_price
                              ? formatPriceBrl(product.installment_price)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="truncate max-w-[100px]"
                                title={product.merchant}
                              >
                                {product.merchant}
                              </span>
                              {product.free_shipping && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1 py-0"
                                >
                                  Frete
                                </Badge>
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
                                    await fetch(
                                      `${hardwareApiUrl}/api/store-products/${product.tag}/base-model?base_model=${encodeURIComponent(val)}`,
                                      { method: "PUT" }
                                    );
                                  } catch {
                                    // Inline edit — silent fail is acceptable here
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  (e.target as HTMLInputElement).blur();
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {product.specs &&
                                Object.entries(product.specs)
                                  .filter(([, v]) => v !== true && v !== false)
                                  .slice(0, 4)
                                  .map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="text-[10px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground"
                                    >
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
                                <a
                                  href={product.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </a>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                title="Add to Items"
                                onClick={() => handleLoadIntoItemForm(product)}
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
                if (totalStorePages <= 7) page = i + 1;
                else if (storePage <= 4) page = i + 1;
                else if (storePage >= totalStorePages - 3) page = totalStorePages - 6 + i;
                else page = storePage - 3 + i;
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
                        {item.olx_min ? (
                          formatPriceBrl(item.olx_min)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.olx_avg ? (
                          formatPriceBrl(item.olx_avg)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{item.olx_count}</TableCell>
                      <TableCell>
                        {item.price_new ? (
                          <span className="text-green-400">
                            {formatPriceBrl(item.price_new)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.savings_pct !== null ? (
                          <Badge
                            variant={item.savings_pct > 0 ? "default" : "destructive"}
                            className={
                              item.savings_pct > 30
                                ? "bg-green-600"
                                : item.savings_pct > 0
                                  ? "bg-yellow-600"
                                  : ""
                            }
                          >
                            {item.savings_pct > 0
                              ? `-${item.savings_pct}%`
                              : `+${Math.abs(item.savings_pct)}%`}
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
  );
}
