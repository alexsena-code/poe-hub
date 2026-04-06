"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Cpu,
  MemoryStick,
  Monitor,
  Plus,
  Minus,
  TrendingDown,
  DollarSign,
  Percent,
  Zap,
} from "lucide-react";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

interface ConfigItem {
  name: string;
  category: string;
  specs: Record<string, number | string>;
}

interface SummaryItem {
  item_name: string;
  category: string;
  total_deals: number;
  min_price: number;
  avg_price: number;
  max_price: number;
}

interface ManualPrice {
  item_name: string;
  price_new: number | null;
  price_aliexpress: number | null;
  price_reference: number | null;
  notes: string;
}

interface SelectedComponent {
  item: ConfigItem;
  quantity: number;
}

interface BuildConfig {
  gpu: SelectedComponent | null;
  cpuKit: SelectedComponent | null;
  ram: SelectedComponent | null;
}

interface BuildTotals {
  vramTotal: number;
  ramTotal: number;
  threadsTotal: number;
  tdpTotal: number;
  usedBestTotal: number;
  usedAvgTotal: number;
  newTotal: number;
}

export default function PCBuilderPage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [manualPrices, setManualPrices] = useState<ManualPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGpu, setSelectedGpu] = useState<string>("");
  const [gpuQty, setGpuQty] = useState(1);
  const [selectedCpuKit, setSelectedCpuKit] = useState<string>("");
  const [selectedRam, setSelectedRam] = useState<string>("");
  const [ramQty, setRamQty] = useState(1);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes, pricesRes] = await Promise.all([
        fetch(`${HARDWARE_API}/api/items`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/deals/summary`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/manual-prices`)
          .then((r) => r.json())
          .catch(() => []),
      ]);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      setSummary(Array.isArray(summaryRes) ? summaryRes : []);
      setManualPrices(Array.isArray(pricesRes) ? pricesRes : []);
    } catch (error) {
      console.error("Error fetching hardware data:", error);
      toast.error("Failed to connect to Hardware API");
    } finally {
      setLoading(false);
    }
  };

  const gpus = useMemo(
    () => items.filter((i) => i.category === "gpu"),
    [items]
  );
  const cpuKits = useMemo(
    () => items.filter((i) => i.category === "cpu-kit"),
    [items]
  );
  const rams = useMemo(
    () => items.filter((i) => i.category === "ram"),
    [items]
  );

  const getPrice = (
    itemName: string
  ): { best: number; avg: number; newPrice: number } => {
    const s = summary.find((s) => s.item_name === itemName);
    const mp = manualPrices.find((p) => p.item_name === itemName);
    return {
      best: s?.min_price || 0,
      avg: s?.avg_price || 0,
      newPrice: mp?.price_new || mp?.price_reference || 0,
    };
  };

  const getSpec = (item: ConfigItem, key: string): number => {
    const val = item.specs?.[key];
    return typeof val === "number" ? val : 0;
  };

  const build = useMemo((): BuildConfig => {
    const gpuItem = gpus.find((g) => g.name === selectedGpu) || null;
    const cpuItem = cpuKits.find((c) => c.name === selectedCpuKit) || null;
    const ramItem = rams.find((r) => r.name === selectedRam) || null;

    return {
      gpu: gpuItem ? { item: gpuItem, quantity: gpuQty } : null,
      cpuKit: cpuItem ? { item: cpuItem, quantity: 1 } : null,
      ram: ramItem ? { item: ramItem, quantity: ramQty } : null,
    };
  }, [selectedGpu, gpuQty, selectedCpuKit, selectedRam, ramQty, gpus, cpuKits, rams]);

  const totals = useMemo((): BuildTotals => {
    let vramTotal = 0;
    let ramTotal = 0;
    let threadsTotal = 0;
    let tdpTotal = 0;
    let usedBestTotal = 0;
    let usedAvgTotal = 0;
    let newTotal = 0;

    if (build.gpu) {
      const prices = getPrice(build.gpu.item.name);
      vramTotal = getSpec(build.gpu.item, "vram_gb") * build.gpu.quantity;
      tdpTotal += getSpec(build.gpu.item, "tdp_w") * build.gpu.quantity;
      usedBestTotal += prices.best * build.gpu.quantity;
      usedAvgTotal += prices.avg * build.gpu.quantity;
      newTotal += prices.newPrice * build.gpu.quantity;
    }

    if (build.cpuKit) {
      const prices = getPrice(build.cpuKit.item.name);
      threadsTotal = getSpec(build.cpuKit.item, "threads") || getSpec(build.cpuKit.item, "cores") * 2;
      tdpTotal += getSpec(build.cpuKit.item, "tdp_w");
      usedBestTotal += prices.best;
      usedAvgTotal += prices.avg;
      newTotal += prices.newPrice;
      const kitRam = getSpec(build.cpuKit.item, "ram_gb");
      if (kitRam > 0) ramTotal += kitRam;
    }

    if (build.ram) {
      const prices = getPrice(build.ram.item.name);
      const perStick = getSpec(build.ram.item, "capacity_gb") || getSpec(build.ram.item, "size_gb");
      ramTotal += perStick * build.ram.quantity;
      usedBestTotal += prices.best * build.ram.quantity;
      usedAvgTotal += prices.avg * build.ram.quantity;
      newTotal += prices.newPrice * build.ram.quantity;
    }

    return {
      vramTotal,
      ramTotal,
      threadsTotal,
      tdpTotal,
      usedBestTotal,
      usedAvgTotal,
      newTotal,
    };
  }, [build, summary, manualPrices]);

  const formatPrice = (price: number) => {
    if (price === 0) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const savingsPercent =
    totals.newTotal > 0
      ? Math.round(
          ((totals.newTotal - totals.usedAvgTotal) / totals.newTotal) * 100
        )
      : 0;

  const QuantityControl = ({
    value,
    onChange,
    min,
    max,
  }: {
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
  }) => (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-7 p-0 border-border"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className="w-6 text-center text-sm font-medium">{value}</span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-7 p-0 border-border"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">PC Builder</h1>
          <p className="text-muted-foreground">Simulate builds with used hardware prices.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold">PC Builder</h1>
        <p className="text-muted-foreground">Simulate builds with used hardware prices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Component Picker */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Component Picker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* GPU */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-card-foreground flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  GPU
                </label>
                <QuantityControl
                  value={gpuQty}
                  onChange={setGpuQty}
                  min={1}
                  max={4}
                />
              </div>
              <Select value={selectedGpu} onValueChange={setSelectedGpu}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select GPU..." />
                </SelectTrigger>
                <SelectContent>
                  {gpus.map((g) => {
                    const price = getPrice(g.name);
                    return (
                      <SelectItem key={g.name} value={g.name}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{g.name}</span>
                          {price.avg > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ~{formatPrice(price.avg)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {build.gpu && (
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {getSpec(build.gpu.item, "vram_gb")}GB VRAM
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {getSpec(build.gpu.item, "tdp_w")}W TDP
                  </Badge>
                  {getSpec(build.gpu.item, "cuda_cores") > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {getSpec(build.gpu.item, "cuda_cores")} CUDA
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* CPU Kit */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-card-foreground flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                CPU Kit
              </label>
              <Select
                value={selectedCpuKit}
                onValueChange={setSelectedCpuKit}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select CPU Kit..." />
                </SelectTrigger>
                <SelectContent>
                  {cpuKits.map((c) => {
                    const price = getPrice(c.name);
                    return (
                      <SelectItem key={c.name} value={c.name}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{c.name}</span>
                          {price.avg > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ~{formatPrice(price.avg)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {build.cpuKit && (
                <div className="flex gap-2 flex-wrap">
                  {getSpec(build.cpuKit.item, "cores") > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {getSpec(build.cpuKit.item, "cores")}C/
                      {getSpec(build.cpuKit.item, "threads") ||
                        getSpec(build.cpuKit.item, "cores") * 2}
                      T
                    </Badge>
                  )}
                  {getSpec(build.cpuKit.item, "tdp_w") > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {getSpec(build.cpuKit.item, "tdp_w")}W TDP
                    </Badge>
                  )}
                  {getSpec(build.cpuKit.item, "ram_gb") > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Includes {getSpec(build.cpuKit.item, "ram_gb")}GB RAM
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* RAM */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-card-foreground flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  RAM
                </label>
                <QuantityControl
                  value={ramQty}
                  onChange={setRamQty}
                  min={1}
                  max={8}
                />
              </div>
              <Select value={selectedRam} onValueChange={setSelectedRam}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select RAM..." />
                </SelectTrigger>
                <SelectContent>
                  {rams.map((r) => {
                    const price = getPrice(r.name);
                    return (
                      <SelectItem key={r.name} value={r.name}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{r.name}</span>
                          {price.avg > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ~{formatPrice(price.avg)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {build.ram && (
                <div className="flex gap-2 flex-wrap">
                  {(getSpec(build.ram.item, "capacity_gb") || getSpec(build.ram.item, "size_gb")) > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {getSpec(build.ram.item, "capacity_gb") || getSpec(build.ram.item, "size_gb")}GB per stick
                    </Badge>
                  )}
                  {getSpec(build.ram.item, "speed_mhz") > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {getSpec(build.ram.item, "speed_mhz")}MHz
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Build Summary */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Build Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Total Specs */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Total Specs
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border/50 bg-background/50">
                  <p className="text-xs text-muted-foreground">VRAM</p>
                  <p className="text-lg font-semibold text-card-foreground">
                    {totals.vramTotal} GB
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-background/50">
                  <p className="text-xs text-muted-foreground">RAM</p>
                  <p className="text-lg font-semibold text-card-foreground">
                    {totals.ramTotal} GB
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-background/50">
                  <p className="text-xs text-muted-foreground">CPU Threads</p>
                  <p className="text-lg font-semibold text-card-foreground">
                    {totals.threadsTotal}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-background/50">
                  <p className="text-xs text-muted-foreground">Total TDP</p>
                  <p className="text-lg font-semibold text-card-foreground">
                    {totals.tdpTotal}W
                  </p>
                </div>
              </div>
            </div>

            {/* Component Breakdown */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Component Breakdown
              </h4>
              <div className="space-y-2">
                {build.gpu && (
                  <div className="flex items-center justify-between p-2 rounded border border-border/50">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {build.gpu.item.name} x{build.gpu.quantity}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-500">
                      {formatPrice(
                        getPrice(build.gpu.item.name).avg *
                          build.gpu.quantity
                      )}
                    </span>
                  </div>
                )}
                {build.cpuKit && (
                  <div className="flex items-center justify-between p-2 rounded border border-border/50">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {build.cpuKit.item.name}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-500">
                      {formatPrice(getPrice(build.cpuKit.item.name).avg)}
                    </span>
                  </div>
                )}
                {build.ram && (
                  <div className="flex items-center justify-between p-2 rounded border border-border/50">
                    <div className="flex items-center gap-2">
                      <MemoryStick className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {build.ram.item.name} x{build.ram.quantity}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-500">
                      {formatPrice(
                        getPrice(build.ram.item.name).avg * build.ram.quantity
                      )}
                    </span>
                  </div>
                )}
                {!build.gpu && !build.cpuKit && !build.ram && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Select components to see breakdown
                  </p>
                )}
              </div>
            </div>

            {/* Price Comparison */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Price Comparison
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-card-foreground">
                      Best Used Price
                    </span>
                  </div>
                  <span className="font-semibold text-green-500">
                    {formatPrice(totals.usedBestTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-card-foreground">
                      Average Used Price
                    </span>
                  </div>
                  <span className="font-semibold text-card-foreground">
                    {formatPrice(totals.usedAvgTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-card-foreground">
                      New Price
                    </span>
                  </div>
                  <span className="font-semibold text-card-foreground">
                    {totals.newTotal > 0
                      ? formatPrice(totals.newTotal)
                      : "Not set"}
                  </span>
                </div>
                {savingsPercent > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-card-foreground">
                        Savings (used avg vs new)
                      </span>
                    </div>
                    <span className="font-semibold text-blue-500">
                      {savingsPercent}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
