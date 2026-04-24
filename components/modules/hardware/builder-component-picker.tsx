"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cpu,
  MemoryStick,
  Monitor,
  Zap,
  HardDrive,
  CircuitBoard,
  Minus,
  Plus,
} from "lucide-react";
import { formatPriceBrl } from "./helpers";
import type { BuilderConfigItem, BuildConfig, SummaryItem, ManualPrice, NewPriceResult } from "./types";

interface BuilderComponentPickerProps {
  build: BuildConfig;
  gpus: BuilderConfigItem[];
  cpuKits: BuilderConfigItem[];
  rams: BuilderConfigItem[];
  psus: BuilderConfigItem[];
  ssds: BuilderConfigItem[];
  motherboards: BuilderConfigItem[];
  compatCpuKits: BuilderConfigItem[];
  compatRams: BuilderConfigItem[];
  compatMotherboards: BuilderConfigItem[];
  selectedGpu: string;
  selectedCpuKit: string;
  selectedRam: string;
  selectedPsu: string;
  selectedSsd: string;
  selectedMotherboard: string;
  gpuQty: number;
  ramQty: number;
  setSelectedGpu: (v: string) => void;
  setSelectedCpuKit: (v: string) => void;
  setSelectedRam: (v: string) => void;
  setSelectedPsu: (v: string) => void;
  setSelectedSsd: (v: string) => void;
  setSelectedMotherboard: (v: string) => void;
  setGpuQty: (v: number) => void;
  setRamQty: (v: number) => void;
  summary: SummaryItem[];
  manualPrices: ManualPrice[];
  newPrices: NewPriceResult[];
}

/** Quantity +/- stepper used for GPU and RAM counts. */
function QuantityControl({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
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
}

function getItemPrice(
  itemName: string,
  summary: SummaryItem[],
  manualPrices: ManualPrice[],
  newPrices: NewPriceResult[]
) {
  const s = summary.find((x) => x.item_name === itemName);
  const np = newPrices.find((p) => p.item_name === itemName);
  const mp = manualPrices.find((p) => p.item_name === itemName);
  const newPrice = np?.price_new || mp?.price_new || mp?.price_reference || 0;
  return {
    best: s?.min_price || 0,
    avg: s?.avg_price || 0,
    newPrice,
  };
}

function getSpec(item: BuilderConfigItem, key: string): number {
  const val = item.specs?.[key];
  return typeof val === "number" ? val : 0;
}

/**
 * Component picker card for the Build tab.
 * Displays compatibility-filtered selects for GPU, CPU Kit, RAM, Motherboard,
 * PSU, SSD with quantity controls for GPU and RAM.
 */
export function BuilderComponentPicker({
  build,
  gpus,
  cpuKits,
  rams,
  psus,
  ssds,
  motherboards,
  compatCpuKits,
  compatRams,
  compatMotherboards,
  selectedGpu,
  selectedCpuKit,
  selectedRam,
  selectedPsu,
  selectedSsd,
  selectedMotherboard,
  gpuQty,
  ramQty,
  setSelectedGpu,
  setSelectedCpuKit,
  setSelectedRam,
  setSelectedPsu,
  setSelectedSsd,
  setSelectedMotherboard,
  setGpuQty,
  setRamQty,
  summary,
  manualPrices,
  newPrices,
}: BuilderComponentPickerProps) {
  return (
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
                const price = getItemPrice(g.name, summary, manualPrices, newPrices);
                return (
                  <SelectItem key={g.name} value={g.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{g.name}</span>
                      {price.avg > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ~{formatPriceBrl(price.avg)}
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
          <Select value={selectedCpuKit} onValueChange={setSelectedCpuKit}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Select CPU Kit..." />
            </SelectTrigger>
            <SelectContent>
              {compatCpuKits.map((c) => {
                const price = getItemPrice(c.name, summary, manualPrices, newPrices);
                const socket = c.specs?.socket as string || "";
                return (
                  <SelectItem key={c.name} value={c.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {socket}{price.avg > 0 ? ` ~${formatPriceBrl(price.avg)}` : ""}
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
                const price = getItemPrice(r.name, summary, manualPrices, newPrices);
                const ramType = r.specs?.type as string || "";
                return (
                  <SelectItem key={r.name} value={r.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{r.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ramType}{price.avg > 0 ? ` ~${formatPriceBrl(price.avg)}` : ""}
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
          <Select value={selectedMotherboard} onValueChange={setSelectedMotherboard}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Select Motherboard..." />
            </SelectTrigger>
            <SelectContent>
              {compatMotherboards.map((m) => {
                const price = getItemPrice(m.name, summary, manualPrices, newPrices);
                const socket = m.specs?.socket as string || "";
                const ddr = m.specs?.memory_type as string || "";
                return (
                  <SelectItem key={m.name} value={m.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{m.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[socket, ddr].filter(Boolean).join(" ")}
                        {price.avg > 0 ? ` ~${formatPriceBrl(price.avg)}` : ""}
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
                const price = getItemPrice(p.name, summary, manualPrices, newPrices);
                return (
                  <SelectItem key={p.name} value={p.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{p.name}</span>
                      {price.avg > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ~{formatPriceBrl(price.avg)}
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
                const price = getItemPrice(s.name, summary, manualPrices, newPrices);
                return (
                  <SelectItem key={s.name} value={s.name}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{s.name}</span>
                      {price.avg > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ~{formatPriceBrl(price.avg)}
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
  );
}
