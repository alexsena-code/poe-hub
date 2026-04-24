"use client";

import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Server, Monitor, MemoryStick, Cpu, DollarSign, Minus, Plus } from "lucide-react";
import { formatPriceBrl } from "./helpers";
import type { BuildTotals } from "./types";

// Reserved for host OS — not available to VMs.
const HOST_OVERHEAD = { ram_gb: 4, threads: 2 };

interface BuilderVmSectionProps {
  // Hardware resources available (either from build totals or manual inputs).
  vram: number;
  ram: number;
  threads: number;
  // VM profile state (lifted to page so it persists across tab switches).
  vmVram: number;
  vmRam: number;
  vmThreads: number;
  vmCount: number;
  setVmVram: (v: number) => void;
  setVmRam: (v: number) => void;
  setVmThreads: (v: number) => void;
  setVmCount: (v: number) => void;
  // Build totals for cost-per-VM breakdown (only relevant in build tab).
  buildTotals?: BuildTotals;
}

function utilizationPercent(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

/**
 * VM capacity calculator — shared between the Build tab (uses component totals)
 * and Manual tab (uses user-entered raw numbers). VM profile + count state is
 * lifted to the page so switching tabs doesn't reset the calculator.
 */
export function BuilderVmSection({
  vram,
  ram,
  threads,
  vmVram,
  vmRam,
  vmThreads,
  vmCount,
  setVmVram,
  setVmRam,
  setVmThreads,
  setVmCount,
  buildTotals,
}: BuilderVmSectionProps) {
  const availableResources = useMemo(() => ({
    vram,
    ram: Math.max(0, ram - HOST_OVERHEAD.ram_gb),
    threads: Math.max(0, threads - HOST_OVERHEAD.threads),
  }), [vram, ram, threads]);

  const maxVMs = useMemo(() => {
    const byVram = vmVram > 0 ? Math.floor(availableResources.vram / vmVram) : Infinity;
    const byRam = vmRam > 0 ? Math.floor(availableResources.ram / vmRam) : Infinity;
    const byThreads = vmThreads > 0 ? Math.floor(availableResources.threads / vmThreads) : Infinity;
    const max = Math.min(byVram, byRam, byThreads);
    return max === Infinity ? 0 : max;
  }, [availableResources, vmVram, vmRam, vmThreads]);

  // Clamp vmCount when maxVMs changes (e.g. user changes VM profile).
  useEffect(() => {
    setVmCount(Math.min(vmCount, maxVMs));
  }, [maxVMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const usedResources = useMemo(() => ({
    vram: vmVram * vmCount,
    ram: vmRam * vmCount,
    threads: vmThreads * vmCount,
  }), [vmVram, vmRam, vmThreads, vmCount]);

  const remainingResources = useMemo(() => ({
    vram: Math.round((availableResources.vram - usedResources.vram) * 100) / 100,
    ram: Math.round((availableResources.ram - usedResources.ram) * 100) / 100,
    threads: availableResources.threads - usedResources.threads,
  }), [availableResources, usedResources]);

  const savingsPercent =
    buildTotals && buildTotals.newTotal > 0
      ? Math.round(
          ((buildTotals.newTotal - buildTotals.usedAvgTotal) / buildTotals.newTotal) * 100
        )
      : 0;

  return (
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
            Available for VMs (after host overhead: {HOST_OVERHEAD.ram_gb}GB RAM
            + {HOST_OVERHEAD.threads} threads reserved)
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

        {/* VM Profile inputs */}
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

        {/* VM count control */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
                VM Allocation
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Max VMs that fit:{" "}
                <span className="font-semibold text-card-foreground">{maxVMs}</span>
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

        {/* Total VMs + cost breakdown */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-card-foreground">Total VMs</span>
            <span className="text-lg font-bold text-card-foreground">{vmCount}</span>
          </div>
          {buildTotals && vmCount > 0 && (buildTotals.usedAvgTotal > 0 || buildTotals.newTotal > 0) && (
            <div className="space-y-1.5 pt-2 border-t border-border/30">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
                Custo por VM
              </h4>
              <div className="grid grid-cols-1 gap-1 text-sm">
                {buildTotals.usedAvgTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-yellow-500" /> Média usado
                    </span>
                    <span className="font-medium text-yellow-500">
                      {formatPriceBrl(buildTotals.usedAvgTotal / vmCount)}
                    </span>
                  </div>
                )}
                {buildTotals.newTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Novo
                    </span>
                    <span className="font-medium">
                      {formatPriceBrl(buildTotals.newTotal / vmCount)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {buildTotals && savingsPercent > 0 && (
            <p className="text-xs text-blue-400">
              {savingsPercent}% savings buying used vs new
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
