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
import { Progress } from "@/components/ui/progress";
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
  HardDrive,
  CircuitBoard,
  Server,
  Save,
  FolderOpen,
  Trash2,
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

interface NewPriceResult {
  item_name: string;
  price_new: number | null;
  product: string | null;
  merchant: string | null;
  source: string;
}

interface SelectedComponent {
  item: ConfigItem;
  quantity: number;
}

interface BuildConfig {
  gpu: SelectedComponent | null;
  cpuKit: SelectedComponent | null;
  ram: SelectedComponent | null;
  psu: SelectedComponent | null;
  ssd: SelectedComponent | null;
  motherboard: SelectedComponent | null;
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

const HOST_OVERHEAD = { ram_gb: 4, threads: 2 };
const SAVED_BUILDS_KEY = "hardware-builder-saved-builds";

interface SavedBuild {
  name: string;
  savedAt: string;
  gpu: string;
  gpuQty: number;
  cpuKit: string;
  ram: string;
  ramQty: number;
  psu: string;
  ssd: string;
  motherboard: string;
  vmVram: number;
  vmRam: number;
  vmThreads: number;
  vmCount: number;
}

export default function PCBuilderPage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [manualPrices, setManualPrices] = useState<ManualPrice[]>([]);
  const [newPrices, setNewPrices] = useState<NewPriceResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<"build" | "manual">("build");

  // PC Builder selections
  const [selectedGpu, setSelectedGpu] = useState<string>("");
  const [gpuQty, setGpuQty] = useState(1);
  const [selectedCpuKit, setSelectedCpuKit] = useState<string>("");
  const [selectedRam, setSelectedRam] = useState<string>("");
  const [ramQty, setRamQty] = useState(1);
  const [selectedPsu, setSelectedPsu] = useState<string>("");
  const [selectedSsd, setSelectedSsd] = useState<string>("");
  const [selectedMotherboard, setSelectedMotherboard] = useState<string>("");

  // Manual tab inputs
  const [manualVram, setManualVram] = useState(22);
  const [manualRam, setManualRam] = useState(64);
  const [manualThreads, setManualThreads] = useState(28);

  // VM profile (single custom profile)
  const [vmVram, setVmVram] = useState(0.6);
  const [vmRam, setVmRam] = useState(4);
  const [vmThreads, setVmThreads] = useState(2);

  // VM count (user-adjustable)
  const [vmCount, setVmCount] = useState(0);

  // Saved builds
  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([]);
  const [buildName, setBuildName] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_BUILDS_KEY);
      if (stored) setSavedBuilds(JSON.parse(stored));
    } catch {}
  }, []);

  const saveBuild = () => {
    const name = buildName.trim();
    if (!name) {
      toast.error("Digite um nome para a build");
      return;
    }
    const build: SavedBuild = {
      name,
      savedAt: new Date().toISOString(),
      gpu: selectedGpu,
      gpuQty,
      cpuKit: selectedCpuKit,
      ram: selectedRam,
      ramQty,
      psu: selectedPsu,
      ssd: selectedSsd,
      motherboard: selectedMotherboard,
      vmVram,
      vmRam,
      vmThreads,
      vmCount,
    };
    const updated = [...savedBuilds.filter((b) => b.name !== name), build];
    setSavedBuilds(updated);
    localStorage.setItem(SAVED_BUILDS_KEY, JSON.stringify(updated));
    toast.success(`Build "${name}" salva`);
  };

  const loadBuild = (build: SavedBuild) => {
    setSelectedGpu(build.gpu);
    setGpuQty(build.gpuQty);
    setSelectedCpuKit(build.cpuKit);
    setSelectedRam(build.ram);
    setRamQty(build.ramQty);
    setSelectedPsu(build.psu);
    setSelectedSsd(build.ssd);
    setSelectedMotherboard(build.motherboard);
    setVmVram(build.vmVram);
    setVmRam(build.vmRam);
    setVmThreads(build.vmThreads);
    setVmCount(build.vmCount);
    setBuildName(build.name);
    setActiveTab("build");
    toast.success(`Build "${build.name}" carregada`);
  };

  const deleteBuild = (name: string) => {
    const updated = savedBuilds.filter((b) => b.name !== name);
    setSavedBuilds(updated);
    localStorage.setItem(SAVED_BUILDS_KEY, JSON.stringify(updated));
    toast.success(`Build "${name}" removida`);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes, pricesRes, newPricesRes] = await Promise.all([
        fetch(`${HARDWARE_API}/api/items`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/deals/summary`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/manual-prices`)
          .then((r) => r.json())
          .catch(() => []),
        fetch(`${HARDWARE_API}/api/new-prices-batch`)
          .then((r) => r.json())
          .catch(() => []),
      ]);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      setSummary(Array.isArray(summaryRes) ? summaryRes : []);
      setManualPrices(Array.isArray(pricesRes) ? pricesRes : []);
      setNewPrices(Array.isArray(newPricesRes) ? newPricesRes : []);
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
  const psus = useMemo(
    () => items.filter((i) => i.category === "psu"),
    [items]
  );
  const ssds = useMemo(
    () => items.filter((i) => i.category === "ssd"),
    [items]
  );
  const motherboards = useMemo(
    () => items.filter((i) => i.category === "motherboard"),
    [items]
  );

  // === Compatibility filters ===
  // Get socket from selected CPU
  const selectedCpuSocket = useMemo(() => {
    const cpu = cpuKits.find((c) => c.name === selectedCpuKit);
    return cpu?.specs?.socket as string || "";
  }, [cpuKits, selectedCpuKit]);

  // Get DDR type from selected RAM
  const selectedRamType = useMemo(() => {
    const ram = rams.find((r) => r.name === selectedRam);
    const t = ram?.specs?.type as string || "";
    // Extract DDR4/DDR5 from "DDR4 ECC" etc
    const m = t.match(/DDR\d/);
    return m ? m[0] : "";
  }, [rams, selectedRam]);

  // Get socket + DDR from selected motherboard
  const selectedMoboSocket = useMemo(() => {
    const mobo = motherboards.find((m) => m.name === selectedMotherboard);
    return mobo?.specs?.socket as string || "";
  }, [motherboards, selectedMotherboard]);
  const selectedMoboDdr = useMemo(() => {
    const mobo = motherboards.find((m) => m.name === selectedMotherboard);
    return mobo?.specs?.memory_type as string || "";
  }, [motherboards, selectedMotherboard]);

  // Filtered motherboards: match CPU socket AND RAM DDR type
  const compatMotherboards = useMemo(() => {
    return motherboards.filter((m) => {
      const moboSocket = m.specs?.socket as string || "";
      const moboDdr = m.specs?.memory_type as string || "";
      if (selectedCpuSocket && moboSocket && moboSocket !== selectedCpuSocket) return false;
      if (selectedRamType && moboDdr && moboDdr !== selectedRamType) return false;
      return true;
    });
  }, [motherboards, selectedCpuSocket, selectedRamType]);

  // Filtered CPUs: match motherboard socket
  const compatCpuKits = useMemo(() => {
    return cpuKits.filter((c) => {
      const cpuSocket = c.specs?.socket as string || "";
      if (selectedMoboSocket && cpuSocket && cpuSocket !== selectedMoboSocket) return false;
      return true;
    });
  }, [cpuKits, selectedMoboSocket]);

  // Filtered RAM: match motherboard DDR type
  const compatRams = useMemo(() => {
    return rams.filter((r) => {
      const ramType = r.specs?.type as string || "";
      const ramDdr = ramType.match(/DDR\d/)?.[0] || "";
      if (selectedMoboDdr && ramDdr && ramDdr !== selectedMoboDdr) return false;
      return true;
    });
  }, [rams, selectedMoboDdr]);

  const getPrice = (
    itemName: string
  ): { best: number; avg: number; newPrice: number; newSource: string; newProduct: string; newMerchant: string } => {
    const s = summary.find((s) => s.item_name === itemName);
    const np = newPrices.find((p) => p.item_name === itemName);
    const mp = manualPrices.find((p) => p.item_name === itemName);
    // New price: PCBuildWizard live > manual > 0
    const newPrice = np?.price_new || mp?.price_new || mp?.price_reference || 0;
    return {
      best: s?.min_price || 0,
      avg: s?.avg_price || 0,
      newPrice,
      newSource: np?.source || (mp?.price_new ? "manual" : ""),
      newProduct: np?.product || "",
      newMerchant: np?.merchant || mp?.notes || "",
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
    const psuItem = psus.find((p) => p.name === selectedPsu) || null;
    const ssdItem = ssds.find((s) => s.name === selectedSsd) || null;
    const moboItem = motherboards.find((m) => m.name === selectedMotherboard) || null;

    return {
      gpu: gpuItem ? { item: gpuItem, quantity: gpuQty } : null,
      cpuKit: cpuItem ? { item: cpuItem, quantity: 1 } : null,
      ram: ramItem ? { item: ramItem, quantity: ramQty } : null,
      psu: psuItem ? { item: psuItem, quantity: 1 } : null,
      ssd: ssdItem ? { item: ssdItem, quantity: 1 } : null,
      motherboard: moboItem ? { item: moboItem, quantity: 1 } : null,
    };
  }, [selectedGpu, gpuQty, selectedCpuKit, selectedRam, ramQty, selectedPsu, selectedSsd, selectedMotherboard, gpus, cpuKits, rams, psus, ssds, motherboards]);

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

    if (build.psu) {
      const prices = getPrice(build.psu.item.name);
      usedBestTotal += prices.best;
      usedAvgTotal += prices.avg;
      newTotal += prices.newPrice;
    }

    if (build.ssd) {
      const prices = getPrice(build.ssd.item.name);
      usedBestTotal += prices.best;
      usedAvgTotal += prices.avg;
      newTotal += prices.newPrice;
    }

    if (build.motherboard) {
      const prices = getPrice(build.motherboard.item.name);
      usedBestTotal += prices.best;
      usedAvgTotal += prices.avg;
      newTotal += prices.newPrice;
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

  // Resources for VM calculation depend on active tab
  const hwResources = useMemo(() => {
    if (activeTab === "build") {
      return {
        vram: totals.vramTotal,
        ram: totals.ramTotal,
        threads: totals.threadsTotal,
      };
    }
    return {
      vram: manualVram,
      ram: manualRam,
      threads: manualThreads,
    };
  }, [activeTab, totals, manualVram, manualRam, manualThreads]);

  const availableResources = useMemo(() => {
    return {
      vram: hwResources.vram,
      ram: Math.max(0, hwResources.ram - HOST_OVERHEAD.ram_gb),
      threads: Math.max(0, hwResources.threads - HOST_OVERHEAD.threads),
    };
  }, [hwResources]);

  const maxVMs = useMemo(() => {
    const byVram =
      vmVram > 0
        ? Math.floor(availableResources.vram / vmVram)
        : Infinity;
    const byRam =
      vmRam > 0
        ? Math.floor(availableResources.ram / vmRam)
        : Infinity;
    const byThreads =
      vmThreads > 0
        ? Math.floor(availableResources.threads / vmThreads)
        : Infinity;
    const max = Math.min(byVram, byRam, byThreads);
    return max === Infinity ? 0 : max;
  }, [availableResources, vmVram, vmRam, vmThreads]);

  // Clamp vmCount when maxVMs changes
  useEffect(() => {
    setVmCount((prev) => Math.min(prev, maxVMs));
  }, [maxVMs]);

  const usedResources = useMemo(() => {
    return {
      vram: vmVram * vmCount,
      ram: vmRam * vmCount,
      threads: vmThreads * vmCount,
    };
  }, [vmVram, vmRam, vmThreads, vmCount]);

  const remainingResources = useMemo(() => {
    return {
      vram: Math.round((availableResources.vram - usedResources.vram) * 100) / 100,
      ram: Math.round((availableResources.ram - usedResources.ram) * 100) / 100,
      threads: availableResources.threads - usedResources.threads,
    };
  }, [availableResources, usedResources]);

  const utilizationPercent = (used: number, total: number) => {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  };

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

  // Shared VM calculation section
  const vmSection = (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-card-foreground flex items-center gap-2">
          <Server className="h-5 w-5" />
          VM Calculation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Available resources after overhead */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Available for VMs (after host overhead: {HOST_OVERHEAD.ram_gb}GB RAM + {HOST_OVERHEAD.threads} threads reserved)
          </p>
          <div className="flex gap-4">
            <Badge variant="outline" className="text-xs">
              {availableResources.vram}GB VRAM
            </Badge>
            <Badge variant="outline" className="text-xs">
              {availableResources.ram}GB RAM
            </Badge>
            <Badge variant="outline" className="text-xs">
              {availableResources.threads} Threads
            </Badge>
          </div>
        </div>

        {/* VM Profile */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            VM Profile
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                VRAM per VM (GB)
              </label>
              <Input
                type="number"
                step="0.1"
                min={0}
                value={vmVram}
                onChange={(e) => setVmVram(parseFloat(e.target.value) || 0)}
                className="bg-background border-border"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                RAM per VM (GB)
              </label>
              <Input
                type="number"
                min={0}
                value={vmRam}
                onChange={(e) => setVmRam(parseFloat(e.target.value) || 0)}
                className="bg-background border-border"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Threads per VM
              </label>
              <Input
                type="number"
                min={0}
                value={vmThreads}
                onChange={(e) => setVmThreads(parseInt(e.target.value) || 0)}
                className="bg-background border-border"
              />
            </div>
          </div>
        </div>

        {/* Max VMs + count control */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
                VM Allocation
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Max VMs that fit: <span className="font-semibold text-card-foreground">{maxVMs}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-border"
                onClick={() => setVmCount(Math.max(0, vmCount - 1))}
                disabled={vmCount <= 0}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-lg font-bold">{vmCount}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-border"
                onClick={() => setVmCount(Math.min(maxVMs, vmCount + 1))}
                disabled={vmCount >= maxVMs}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={0}
            max={maxVMs}
            value={vmCount}
            onChange={(e) => setVmCount(parseInt(e.target.value))}
            className="w-full accent-primary h-2 cursor-pointer"
          />
        </div>

        {/* Resource utilization bars */}
        <div className="space-y-3">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
            Resource Utilization
          </h4>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Monitor className="h-3 w-3" /> VRAM
              </span>
              <span className="text-xs">
                {usedResources.vram.toFixed(1)} / {availableResources.vram} GB
                <span className="text-muted-foreground ml-1">
                  ({remainingResources.vram.toFixed(1)} free)
                </span>
              </span>
            </div>
            <Progress
              value={utilizationPercent(usedResources.vram, availableResources.vram)}
              className="h-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MemoryStick className="h-3 w-3" /> RAM
              </span>
              <span className="text-xs">
                {usedResources.ram} / {availableResources.ram} GB
                <span className="text-muted-foreground ml-1">
                  ({remainingResources.ram} free)
                </span>
              </span>
            </div>
            <Progress
              value={utilizationPercent(usedResources.ram, availableResources.ram)}
              className="h-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Cpu className="h-3 w-3" /> Threads
              </span>
              <span className="text-xs">
                {usedResources.threads} / {availableResources.threads}
                <span className="text-muted-foreground ml-1">
                  ({remainingResources.threads} free)
                </span>
              </span>
            </div>
            <Progress
              value={utilizationPercent(usedResources.threads, availableResources.threads)}
              className="h-2"
            />
          </div>
        </div>

        {/* Remaining after allocation */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-card-foreground">
              Total VMs
            </span>
            <span className="text-lg font-bold text-card-foreground">
              {vmCount}
            </span>
          </div>

          {/* Cost per VM breakdown */}
          {vmCount > 0 && (totals.usedAvgTotal > 0 || totals.newTotal > 0) && (
            <div className="space-y-1.5 pt-2 border-t border-border/30">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
                Custo por VM
              </h4>
              <div className="grid grid-cols-1 gap-1 text-sm">
                {totals.usedAvgTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-yellow-500" /> Média usado
                    </span>
                    <span className="font-medium text-yellow-500">
                      {formatPrice(totals.usedAvgTotal / vmCount)}
                    </span>
                  </div>
                )}
                {totals.newTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Novo
                    </span>
                    <span className="font-medium">
                      {formatPrice(totals.newTotal / vmCount)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">PC Builder & VMs</h1>
          <p className="text-muted-foreground">Build a PC and calculate VM capacity.</p>
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
        <h1 className="text-3xl font-bold">PC Builder & VMs</h1>
        <p className="text-muted-foreground">Build a PC and calculate VM capacity.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab("build")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "build"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          }`}
        >
          Build
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "manual"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          }`}
        >
          Manual
        </button>
      </div>

      {/* Save / Load builds */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Input
                placeholder="Nome da build..."
                value={buildName}
                onChange={(e) => setBuildName(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && saveBuild()}
              />
              <Button size="sm" className="h-8 shrink-0" onClick={saveBuild} disabled={!buildName.trim()}>
                <Save className="h-3.5 w-3.5 mr-1" /> Salvar
              </Button>
            </div>
            {savedBuilds.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  <FolderOpen className="h-3.5 w-3.5 inline mr-1" />
                  Builds salvas:
                </span>
                {savedBuilds.map((b) => (
                  <div key={b.name} className="flex items-center gap-0.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => loadBuild(b)}
                    >
                      {b.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      onClick={() => deleteBuild(b.name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab content */}
      {activeTab === "build" ? (
        <>
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
                      {compatCpuKits.map((c) => {
                        const price = getPrice(c.name);
                        const socket = c.specs?.socket as string || "";
                        return (
                          <SelectItem key={c.name} value={c.name}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{c.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {socket}{price.avg > 0 ? ` ~${formatPrice(price.avg)}` : ""}
                              </span>
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
                      {compatRams.map((r) => {
                        const price = getPrice(r.name);
                        const ramType = r.specs?.type as string || "";
                        return (
                          <SelectItem key={r.name} value={r.name}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{r.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {ramType}{price.avg > 0 ? ` ~${formatPrice(price.avg)}` : ""}
                              </span>
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

                {/* Motherboard */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground flex items-center gap-2">
                    <CircuitBoard className="h-4 w-4 text-muted-foreground" />
                    Motherboard
                  </label>
                  <Select
                    value={selectedMotherboard}
                    onValueChange={setSelectedMotherboard}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select Motherboard..." />
                    </SelectTrigger>
                    <SelectContent>
                      {compatMotherboards.map((m) => {
                        const price = getPrice(m.name);
                        const socket = m.specs?.socket as string || "";
                        const ddr = m.specs?.memory_type as string || "";
                        return (
                          <SelectItem key={m.name} value={m.name}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{m.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {[socket, ddr].filter(Boolean).join(" ")}{price.avg > 0 ? ` ~${formatPrice(price.avg)}` : ""}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* PSU */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    PSU
                  </label>
                  <Select value={selectedPsu} onValueChange={setSelectedPsu}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select PSU..." />
                    </SelectTrigger>
                    <SelectContent>
                      {psus.map((p) => {
                        const price = getPrice(p.name);
                        return (
                          <SelectItem key={p.name} value={p.name}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{p.name}</span>
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
                </div>

                {/* SSD */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    SSD
                  </label>
                  <Select value={selectedSsd} onValueChange={setSelectedSsd}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select SSD..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ssds.map((s) => {
                        const price = getPrice(s.name);
                        return (
                          <SelectItem key={s.name} value={s.name}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{s.name}</span>
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
                    {(() => {
                      const components: { icon: typeof Monitor; name: string; qty: number }[] = [];
                      if (build.gpu) components.push({ icon: Monitor, name: build.gpu.item.name, qty: build.gpu.quantity });
                      if (build.cpuKit) components.push({ icon: Cpu, name: build.cpuKit.item.name, qty: 1 });
                      if (build.ram) components.push({ icon: MemoryStick, name: build.ram.item.name, qty: build.ram.quantity });
                      if (build.motherboard) components.push({ icon: CircuitBoard, name: build.motherboard.item.name, qty: 1 });
                      if (build.psu) components.push({ icon: Zap, name: build.psu.item.name, qty: 1 });
                      if (build.ssd) components.push({ icon: HardDrive, name: build.ssd.item.name, qty: 1 });

                      if (components.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Select components to see breakdown
                          </p>
                        );
                      }

                      return components.map((comp) => {
                        const prices = getPrice(comp.name);
                        const priceLabel = prices.avg > 0
                          ? `OLX ${formatPrice(prices.avg * comp.qty)}`
                          : prices.newPrice > 0
                          ? `Novo ${formatPrice(prices.newPrice * comp.qty)}`
                          : "-";
                        const priceColor = prices.avg > 0 ? "text-emerald-400" : prices.newPrice > 0 ? "text-purple-400" : "text-muted-foreground";

                        return (
                          <div key={comp.name} className="flex items-center justify-between p-2 rounded border border-border/50">
                            <div className="flex items-center gap-2">
                              <comp.icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {comp.name}{comp.qty > 1 ? ` x${comp.qty}` : ""}
                              </span>
                            </div>
                            <span className={`text-sm font-medium ${priceColor}`}>
                              {priceLabel}
                            </span>
                          </div>
                        );
                      });
                    })()}
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
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-card-foreground">
                          Average Used Price
                        </span>
                      </div>
                      <span className="font-semibold text-green-500">
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

          {/* VM Calculation below the build */}
          {vmSection}
        </>
      ) : (
        <>
          {/* Manual tab: simple inputs */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Hardware Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Total VRAM (GB)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    value={manualVram}
                    onChange={(e) => setManualVram(parseFloat(e.target.value) || 0)}
                    className="bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Total RAM (GB)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={manualRam}
                    onChange={(e) => setManualRam(parseFloat(e.target.value) || 0)}
                    className="bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Total CPU Threads
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={manualThreads}
                    onChange={(e) => setManualThreads(parseInt(e.target.value) || 0)}
                    className="bg-background border-border"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* VM Calculation below manual inputs */}
          {vmSection}
        </>
      )}
    </div>
  );
}
