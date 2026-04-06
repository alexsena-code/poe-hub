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
  Server,
  Monitor,
  Cpu,
  MemoryStick,
  Plus,
  Minus,
  Trash2,
  Gamepad2,
  Code,
  Cloud,
  Settings,
} from "lucide-react";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

interface VMProfile {
  id: string;
  label: string;
  icon: React.ReactNode;
  vram_gb: number;
  ram_gb: number;
  threads: number;
  color: string;
}

const VM_PRESETS: VMProfile[] = [
  {
    id: "gaming",
    label: "Gaming VM",
    icon: <Gamepad2 className="h-4 w-4" />,
    vram_gb: 8,
    ram_gb: 16,
    threads: 6,
    color: "text-purple-500 border-purple-500/30 bg-purple-500/5",
  },
  {
    id: "dev",
    label: "Dev VM",
    icon: <Code className="h-4 w-4" />,
    vram_gb: 4,
    ram_gb: 8,
    threads: 4,
    color: "text-blue-500 border-blue-500/30 bg-blue-500/5",
  },
  {
    id: "light",
    label: "Light VM",
    icon: <Cloud className="h-4 w-4" />,
    vram_gb: 2,
    ram_gb: 4,
    threads: 2,
    color: "text-green-500 border-green-500/30 bg-green-500/5",
  },
];

const HOST_OVERHEAD = { ram_gb: 4, threads: 2 };

interface Allocation {
  profileId: string;
  count: number;
}

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

export default function VMCalculatorPage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Hardware input mode
  const [inputMode, setInputMode] = useState<"manual" | "from-api">("manual");
  const [totalVram, setTotalVram] = useState(22);
  const [totalRam, setTotalRam] = useState(64);
  const [totalThreads, setTotalThreads] = useState(28);

  // From API selections
  const [selectedGpu, setSelectedGpu] = useState("");
  const [gpuQty, setGpuQty] = useState(1);
  const [selectedCpuKit, setSelectedCpuKit] = useState("");
  const [selectedRam, setSelectedRam] = useState("");
  const [ramQty, setRamQty] = useState(1);

  // Custom VM profile
  const [customProfile, setCustomProfile] = useState<VMProfile>({
    id: "custom",
    label: "Custom VM",
    icon: <Settings className="h-4 w-4" />,
    vram_gb: 4,
    ram_gb: 8,
    threads: 4,
    color: "text-orange-500 border-orange-500/30 bg-orange-500/5",
  });

  // VM Allocations
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes] = await Promise.all([
        fetch(`${HARDWARE_API}/api/items`).then((r) => r.json()),
        fetch(`${HARDWARE_API}/api/deals/summary`).then((r) => r.json()),
      ]);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      setSummary(Array.isArray(summaryRes) ? summaryRes : []);
    } catch (error) {
      console.error("Error fetching hardware data:", error);
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

  const getSpec = (item: ConfigItem, key: string): number => {
    const val = item.specs?.[key];
    return typeof val === "number" ? val : 0;
  };

  // Calculate totals from API selections
  useEffect(() => {
    if (inputMode !== "from-api") return;

    let vram = 0;
    let ram = 0;
    let threads = 0;

    const gpuItem = gpus.find((g) => g.name === selectedGpu);
    if (gpuItem) {
      vram = getSpec(gpuItem, "vram_gb") * gpuQty;
    }

    const cpuItem = cpuKits.find((c) => c.name === selectedCpuKit);
    if (cpuItem) {
      threads = getSpec(cpuItem, "threads") || getSpec(cpuItem, "cores") * 2;
      const kitRam = getSpec(cpuItem, "ram_gb");
      if (kitRam > 0) ram += kitRam;
    }

    const ramItem = rams.find((r) => r.name === selectedRam);
    if (ramItem) {
      const perStick = getSpec(ramItem, "capacity_gb") || getSpec(ramItem, "size_gb");
      ram += perStick * ramQty;
    }

    setTotalVram(vram);
    setTotalRam(ram);
    setTotalThreads(threads);
  }, [inputMode, selectedGpu, gpuQty, selectedCpuKit, selectedRam, ramQty, gpus, cpuKits, rams]);

  const availableResources = useMemo(() => {
    return {
      vram: totalVram,
      ram: Math.max(0, totalRam - HOST_OVERHEAD.ram_gb),
      threads: Math.max(0, totalThreads - HOST_OVERHEAD.threads),
    };
  }, [totalVram, totalRam, totalThreads]);

  const allProfiles = useMemo(
    () => [...VM_PRESETS, customProfile],
    [customProfile]
  );

  const usedResources = useMemo(() => {
    let vram = 0;
    let ram = 0;
    let threads = 0;

    for (const alloc of allocations) {
      const profile = allProfiles.find((p) => p.id === alloc.profileId);
      if (profile) {
        vram += profile.vram_gb * alloc.count;
        ram += profile.ram_gb * alloc.count;
        threads += profile.threads * alloc.count;
      }
    }

    return { vram, ram, threads };
  }, [allocations, allProfiles]);

  const remainingResources = useMemo(() => {
    return {
      vram: availableResources.vram - usedResources.vram,
      ram: availableResources.ram - usedResources.ram,
      threads: availableResources.threads - usedResources.threads,
    };
  }, [availableResources, usedResources]);

  const maxVMs = useMemo(() => {
    const result: Record<string, number> = {};
    for (const profile of allProfiles) {
      const byVram =
        profile.vram_gb > 0
          ? Math.floor(availableResources.vram / profile.vram_gb)
          : Infinity;
      const byRam =
        profile.ram_gb > 0
          ? Math.floor(availableResources.ram / profile.ram_gb)
          : Infinity;
      const byThreads =
        profile.threads > 0
          ? Math.floor(availableResources.threads / profile.threads)
          : Infinity;
      result[profile.id] = Math.min(byVram, byRam, byThreads);
    }
    return result;
  }, [allProfiles, availableResources]);

  const addAllocation = (profileId: string) => {
    const profile = allProfiles.find((p) => p.id === profileId);
    if (!profile) return;

    if (
      remainingResources.vram < profile.vram_gb ||
      remainingResources.ram < profile.ram_gb ||
      remainingResources.threads < profile.threads
    ) {
      toast.error("Not enough resources for this VM");
      return;
    }

    setAllocations((prev) => {
      const existing = prev.find((a) => a.profileId === profileId);
      if (existing) {
        return prev.map((a) =>
          a.profileId === profileId ? { ...a, count: a.count + 1 } : a
        );
      }
      return [...prev, { profileId, count: 1 }];
    });
  };

  const removeAllocation = (profileId: string) => {
    setAllocations((prev) => {
      const existing = prev.find((a) => a.profileId === profileId);
      if (!existing) return prev;
      if (existing.count <= 1) {
        return prev.filter((a) => a.profileId !== profileId);
      }
      return prev.map((a) =>
        a.profileId === profileId ? { ...a, count: a.count - 1 } : a
      );
    });
  };

  const clearAllocations = () => {
    setAllocations([]);
  };

  const utilizationPercent = (used: number, total: number) => {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  };

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
          <h1 className="text-3xl font-bold">VM Calculator</h1>
          <p className="text-muted-foreground">Calculate VM capacity based on hardware resources.</p>
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
        <h1 className="text-3xl font-bold">VM Calculator</h1>
        <p className="text-muted-foreground">Calculate VM capacity based on hardware resources.</p>
      </div>

      {/* Hardware Input */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Server className="h-5 w-5" />
              Hardware Resources
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInputMode("manual")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  inputMode === "manual"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => setInputMode("from-api")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  inputMode === "from-api"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                From Hardware
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {inputMode === "manual" ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Total VRAM (GB)
                </label>
                <Input
                  type="number"
                  value={totalVram}
                  onChange={(e) => setTotalVram(parseInt(e.target.value) || 0)}
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Total RAM (GB)
                </label>
                <Input
                  type="number"
                  value={totalRam}
                  onChange={(e) => setTotalRam(parseInt(e.target.value) || 0)}
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Total CPU Threads
                </label>
                <Input
                  type="number"
                  value={totalThreads}
                  onChange={(e) =>
                    setTotalThreads(parseInt(e.target.value) || 0)
                  }
                  className="bg-background border-border"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Monitor className="h-3 w-3" /> GPU
                  </label>
                  <QuantityControl
                    value={gpuQty}
                    onChange={setGpuQty}
                    min={1}
                    max={4}
                  />
                </div>
                <Select value={selectedGpu} onValueChange={setSelectedGpu}>
                  <SelectTrigger className="bg-background border-border text-sm">
                    <SelectValue placeholder="Select GPU..." />
                  </SelectTrigger>
                  <SelectContent>
                    {gpus.map((g) => (
                      <SelectItem key={g.name} value={g.name}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> CPU Kit
                </label>
                <Select
                  value={selectedCpuKit}
                  onValueChange={setSelectedCpuKit}
                >
                  <SelectTrigger className="bg-background border-border text-sm">
                    <SelectValue placeholder="Select CPU Kit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cpuKits.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MemoryStick className="h-3 w-3" /> RAM
                  </label>
                  <QuantityControl
                    value={ramQty}
                    onChange={setRamQty}
                    min={1}
                    max={8}
                  />
                </div>
                <Select value={selectedRam} onValueChange={setSelectedRam}>
                  <SelectTrigger className="bg-background border-border text-sm">
                    <SelectValue placeholder="Select RAM..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rams.map((r) => (
                      <SelectItem key={r.name} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Available after overhead */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">
              Available for VMs (after host overhead: {HOST_OVERHEAD.ram_gb}GB
              RAM + {HOST_OVERHEAD.threads} threads reserved)
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VM Profiles */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground text-sm">
              VM Profiles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Preset profiles */}
            {VM_PRESETS.map((profile) => (
              <div
                key={profile.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${profile.color}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {profile.icon}
                    <span className="text-sm font-medium">{profile.label}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {profile.vram_gb}GB VRAM
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {profile.ram_gb}GB RAM
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {profile.threads}T
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    max {maxVMs[profile.id] || 0}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 border-border"
                    onClick={() => addAllocation(profile.id)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Custom profile */}
            <div className={`p-3 rounded-lg border ${customProfile.color}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm font-medium">Custom VM</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    max {maxVMs["custom"] || 0}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 border-border"
                    onClick={() => addAllocation("custom")}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">
                    VRAM
                  </label>
                  <Input
                    type="number"
                    value={customProfile.vram_gb}
                    onChange={(e) =>
                      setCustomProfile((p) => ({
                        ...p,
                        vram_gb: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="h-7 text-xs bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">
                    RAM
                  </label>
                  <Input
                    type="number"
                    value={customProfile.ram_gb}
                    onChange={(e) =>
                      setCustomProfile((p) => ({
                        ...p,
                        ram_gb: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="h-7 text-xs bg-background border-border"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">
                    Threads
                  </label>
                  <Input
                    type="number"
                    value={customProfile.threads}
                    onChange={(e) =>
                      setCustomProfile((p) => ({
                        ...p,
                        threads: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="h-7 text-xs bg-background border-border"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Allocations & Utilization */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-card-foreground text-sm">
                Allocated VMs
              </CardTitle>
              {allocations.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllocations}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* VM Cards */}
            {allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Add VMs from profiles to see allocation
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {allocations.map((alloc) => {
                  const profile = allProfiles.find(
                    (p) => p.id === alloc.profileId
                  );
                  if (!profile) return null;
                  return (
                    <div
                      key={alloc.profileId}
                      className={`p-3 rounded-lg border ${profile.color}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {profile.icon}
                          <span className="text-sm font-medium">
                            {profile.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => removeAllocation(alloc.profileId)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-bold w-4 text-center">
                            {alloc.count}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => addAllocation(alloc.profileId)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {profile.vram_gb * alloc.count}GB VRAM /{" "}
                        {profile.ram_gb * alloc.count}GB RAM /{" "}
                        {profile.threads * alloc.count}T
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resource Utilization */}
            <div className="pt-4 border-t border-border/50 space-y-3">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
                Resource Utilization
              </h4>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Monitor className="h-3 w-3" /> VRAM
                  </span>
                  <span className="text-xs">
                    {usedResources.vram} / {availableResources.vram} GB
                    <span className="text-muted-foreground ml-1">
                      ({remainingResources.vram} free)
                    </span>
                  </span>
                </div>
                <Progress
                  value={utilizationPercent(
                    usedResources.vram,
                    availableResources.vram
                  )}
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
                  value={utilizationPercent(
                    usedResources.ram,
                    availableResources.ram
                  )}
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
                  value={utilizationPercent(
                    usedResources.threads,
                    availableResources.threads
                  )}
                  className="h-2"
                />
              </div>
            </div>

            {/* Total VMs */}
            <div className="pt-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-card-foreground">
                  Total VMs
                </span>
                <span className="text-lg font-bold text-card-foreground">
                  {allocations.reduce((sum, a) => sum + a.count, 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
