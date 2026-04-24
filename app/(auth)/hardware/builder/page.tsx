"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, Plus, Save, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { BuilderComponentPicker } from "@/components/modules/hardware/builder-component-picker";
import { BuilderVmSection } from "@/components/modules/hardware/builder-vm-section";
import { BuilderBuildSummary } from "@/components/modules/hardware/builder-build-summary";
import type {
  BuilderConfigItem,
  SummaryItem,
  ManualPrice,
  NewPriceResult,
  BuildConfig,
  BuildTotals,
  SavedBuild,
} from "@/components/modules/hardware/types";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

const SAVED_BUILDS_KEY = "hardware-builder-saved-builds";

export default function PCBuilderPage() {
  const [items, setItems] = useState<BuilderConfigItem[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [manualPrices, setManualPrices] = useState<ManualPrice[]>([]);
  const [newPrices, setNewPrices] = useState<NewPriceResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"build" | "manual">("build");

  // Component selections
  const [selectedGpu, setSelectedGpu] = useState<string>("");
  const [gpuQty, setGpuQty] = useState(1);
  const [selectedCpuKit, setSelectedCpuKit] = useState<string>("");
  const [selectedRam, setSelectedRam] = useState<string>("");
  const [ramQty, setRamQty] = useState(1);
  const [selectedPsu, setSelectedPsu] = useState<string>("");
  const [selectedSsd, setSelectedSsd] = useState<string>("");
  const [selectedMotherboard, setSelectedMotherboard] = useState<string>("");

  // Manual tab resource inputs
  const [manualVram, setManualVram] = useState(22);
  const [manualRam, setManualRam] = useState(64);
  const [manualThreads, setManualThreads] = useState(28);

  // VM profile — lifted here so it persists across tab switches
  const [vmVram, setVmVram] = useState(0.6);
  const [vmRam, setVmRam] = useState(4);
  const [vmThreads, setVmThreads] = useState(2);
  const [vmCount, setVmCount] = useState(0);

  // Saved builds (localStorage)
  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([]);
  const [buildName, setBuildName] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_BUILDS_KEY);
      if (stored) setSavedBuilds(JSON.parse(stored));
    } catch {}
  }, []);

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
      console.error("[hardware/builder] fetchData failed:", error);
      toast.error("Failed to connect to Hardware API");
    } finally {
      setLoading(false);
    }
  };

  // --- Derived category lists ---
  const gpus = useMemo(() => items.filter((i) => i.category === "gpu"), [items]);
  const cpuKits = useMemo(() => items.filter((i) => i.category === "cpu-kit"), [items]);
  const rams = useMemo(() => items.filter((i) => i.category === "ram"), [items]);
  const psus = useMemo(() => items.filter((i) => i.category === "psu"), [items]);
  const ssds = useMemo(() => items.filter((i) => i.category === "ssd"), [items]);
  const motherboards = useMemo(() => items.filter((i) => i.category === "motherboard"), [items]);

  // === Compatibility filters ===
  const selectedCpuSocket = useMemo(() => {
    const cpu = cpuKits.find((c) => c.name === selectedCpuKit);
    return (cpu?.specs?.socket as string) || "";
  }, [cpuKits, selectedCpuKit]);

  const selectedRamType = useMemo(() => {
    const ram = rams.find((r) => r.name === selectedRam);
    const t = (ram?.specs?.type as string) || "";
    return t.match(/DDR\d/)?.[0] || "";
  }, [rams, selectedRam]);

  const selectedMoboSocket = useMemo(() => {
    const mobo = motherboards.find((m) => m.name === selectedMotherboard);
    return (mobo?.specs?.socket as string) || "";
  }, [motherboards, selectedMotherboard]);

  const selectedMoboDdr = useMemo(() => {
    const mobo = motherboards.find((m) => m.name === selectedMotherboard);
    return (mobo?.specs?.memory_type as string) || "";
  }, [motherboards, selectedMotherboard]);

  const compatMotherboards = useMemo(() => {
    return motherboards.filter((m) => {
      const moboSocket = (m.specs?.socket as string) || "";
      const moboDdr = (m.specs?.memory_type as string) || "";
      if (selectedCpuSocket && moboSocket && moboSocket !== selectedCpuSocket) return false;
      if (selectedRamType && moboDdr && moboDdr !== selectedRamType) return false;
      return true;
    });
  }, [motherboards, selectedCpuSocket, selectedRamType]);

  const compatCpuKits = useMemo(() => {
    return cpuKits.filter((c) => {
      const cpuSocket = (c.specs?.socket as string) || "";
      if (selectedMoboSocket && cpuSocket && cpuSocket !== selectedMoboSocket) return false;
      return true;
    });
  }, [cpuKits, selectedMoboSocket]);

  const compatRams = useMemo(() => {
    return rams.filter((r) => {
      const ramType = (r.specs?.type as string) || "";
      const ramDdr = ramType.match(/DDR\d/)?.[0] || "";
      if (selectedMoboDdr && ramDdr && ramDdr !== selectedMoboDdr) return false;
      return true;
    });
  }, [rams, selectedMoboDdr]);

  const getPrice = (itemName: string) => {
    const s = summary.find((x) => x.item_name === itemName);
    const np = newPrices.find((p) => p.item_name === itemName);
    const mp = manualPrices.find((p) => p.item_name === itemName);
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

  const getSpec = (item: BuilderConfigItem, key: string): number => {
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
  }, [
    selectedGpu, gpuQty, selectedCpuKit, selectedRam, ramQty,
    selectedPsu, selectedSsd, selectedMotherboard,
    gpus, cpuKits, rams, psus, ssds, motherboards,
  ]);

  const totals = useMemo((): BuildTotals => {
    let vramTotal = 0, ramTotal = 0, threadsTotal = 0, tdpTotal = 0;
    let usedBestTotal = 0, usedAvgTotal = 0, newTotal = 0;

    if (build.gpu) {
      const p = getPrice(build.gpu.item.name);
      vramTotal = getSpec(build.gpu.item, "vram_gb") * build.gpu.quantity;
      tdpTotal += getSpec(build.gpu.item, "tdp_w") * build.gpu.quantity;
      usedBestTotal += p.best * build.gpu.quantity;
      usedAvgTotal += p.avg * build.gpu.quantity;
      newTotal += p.newPrice * build.gpu.quantity;
    }
    if (build.cpuKit) {
      const p = getPrice(build.cpuKit.item.name);
      threadsTotal = getSpec(build.cpuKit.item, "threads") || getSpec(build.cpuKit.item, "cores") * 2;
      tdpTotal += getSpec(build.cpuKit.item, "tdp_w");
      usedBestTotal += p.best;
      usedAvgTotal += p.avg;
      newTotal += p.newPrice;
      const kitRam = getSpec(build.cpuKit.item, "ram_gb");
      if (kitRam > 0) ramTotal += kitRam;
    }
    if (build.ram) {
      const p = getPrice(build.ram.item.name);
      const perStick = getSpec(build.ram.item, "capacity_gb") || getSpec(build.ram.item, "size_gb");
      ramTotal += perStick * build.ram.quantity;
      usedBestTotal += p.best * build.ram.quantity;
      usedAvgTotal += p.avg * build.ram.quantity;
      newTotal += p.newPrice * build.ram.quantity;
    }
    if (build.psu) {
      const p = getPrice(build.psu.item.name);
      usedBestTotal += p.best; usedAvgTotal += p.avg; newTotal += p.newPrice;
    }
    if (build.ssd) {
      const p = getPrice(build.ssd.item.name);
      usedBestTotal += p.best; usedAvgTotal += p.avg; newTotal += p.newPrice;
    }
    if (build.motherboard) {
      const p = getPrice(build.motherboard.item.name);
      usedBestTotal += p.best; usedAvgTotal += p.avg; newTotal += p.newPrice;
    }

    return { vramTotal, ramTotal, threadsTotal, tdpTotal, usedBestTotal, usedAvgTotal, newTotal };
  }, [build, summary, manualPrices]);

  // Resources passed to VM section depend on which tab is active
  const hwResources = useMemo(() => {
    if (activeTab === "build") {
      return { vram: totals.vramTotal, ram: totals.ramTotal, threads: totals.threadsTotal };
    }
    return { vram: manualVram, ram: manualRam, threads: manualThreads };
  }, [activeTab, totals, manualVram, manualRam, manualThreads]);

  // --- Saved builds ---
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

  const loadBuild = (b: SavedBuild) => {
    setSelectedGpu(b.gpu);
    setGpuQty(b.gpuQty);
    setSelectedCpuKit(b.cpuKit);
    setSelectedRam(b.ram);
    setRamQty(b.ramQty);
    setSelectedPsu(b.psu);
    setSelectedSsd(b.ssd);
    setSelectedMotherboard(b.motherboard);
    setVmVram(b.vmVram);
    setVmRam(b.vmRam);
    setVmThreads(b.vmThreads);
    setVmCount(b.vmCount);
    setBuildName(b.name);
    setActiveTab("build");
    toast.success(`Build "${b.name}" carregada`);
  };

  const deleteBuild = (name: string) => {
    const updated = savedBuilds.filter((b) => b.name !== name);
    setSavedBuilds(updated);
    localStorage.setItem(SAVED_BUILDS_KEY, JSON.stringify(updated));
    toast.success(`Build "${name}" removida`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="PC Builder & VMs" description="Build a PC and calculate VM capacity." />
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
      <PageHeader
        title="PC Builder & VMs"
        description="Build a PC and calculate VM capacity."
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-2">
        {(["build", "manual"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            {tab === "build" ? "Build" : "Manual"}
          </button>
        ))}
      </div>

      {/* Save / Load builds bar */}
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
              <Button
                size="sm"
                className="h-8 shrink-0"
                onClick={saveBuild}
                disabled={!buildName.trim()}
              >
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

      {/* Build tab */}
      {activeTab === "build" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BuilderComponentPicker
              build={build}
              gpus={gpus}
              cpuKits={cpuKits}
              rams={rams}
              psus={psus}
              ssds={ssds}
              motherboards={motherboards}
              compatCpuKits={compatCpuKits}
              compatRams={compatRams}
              compatMotherboards={compatMotherboards}
              selectedGpu={selectedGpu}
              selectedCpuKit={selectedCpuKit}
              selectedRam={selectedRam}
              selectedPsu={selectedPsu}
              selectedSsd={selectedSsd}
              selectedMotherboard={selectedMotherboard}
              gpuQty={gpuQty}
              ramQty={ramQty}
              setSelectedGpu={setSelectedGpu}
              setSelectedCpuKit={setSelectedCpuKit}
              setSelectedRam={setSelectedRam}
              setSelectedPsu={setSelectedPsu}
              setSelectedSsd={setSelectedSsd}
              setSelectedMotherboard={setSelectedMotherboard}
              setGpuQty={setGpuQty}
              setRamQty={setRamQty}
              summary={summary}
              manualPrices={manualPrices}
              newPrices={newPrices}
            />

            <BuilderBuildSummary build={build} totals={totals} getPrice={getPrice} />
          </div>

          <BuilderVmSection
            vram={hwResources.vram}
            ram={hwResources.ram}
            threads={hwResources.threads}
            vmVram={vmVram}
            vmRam={vmRam}
            vmThreads={vmThreads}
            vmCount={vmCount}
            setVmVram={setVmVram}
            setVmRam={setVmRam}
            setVmThreads={setVmThreads}
            setVmCount={setVmCount}
            buildTotals={totals}
          />
        </>
      )}

      {/* Manual tab */}
      {activeTab === "manual" && (
        <>
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

          <BuilderVmSection
            vram={hwResources.vram}
            ram={hwResources.ram}
            threads={hwResources.threads}
            vmVram={vmVram}
            vmRam={vmRam}
            vmThreads={vmThreads}
            vmCount={vmCount}
            setVmVram={setVmVram}
            setVmRam={setVmRam}
            setVmThreads={setVmThreads}
            setVmCount={setVmCount}
          />
        </>
      )}
    </div>
  );
}

