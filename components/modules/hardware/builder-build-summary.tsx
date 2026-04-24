"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Percent, Zap, Cpu, MemoryStick, Monitor, HardDrive, CircuitBoard } from "lucide-react";
import { formatPriceBrl } from "./helpers";
import type { BuildConfig, BuildTotals } from "./types";

type IconComponent = React.FC<{ className?: string }>;

interface BreakdownEntry {
  icon: IconComponent;
  name: string;
  qty: number;
}

interface BuildSummaryProps {
  build: BuildConfig;
  totals: BuildTotals;
  /** Returns avg, newPrice for a given item name — computed by the parent page. */
  getPrice: (name: string) => { avg: number; newPrice: number };
}

/** Row in the component breakdown list. */
function BreakdownRow({
  entry,
  getPrice,
}: {
  entry: BreakdownEntry;
  getPrice: (name: string) => { avg: number; newPrice: number };
}) {
  const prices = getPrice(entry.name);
  const priceLabel =
    prices.avg > 0
      ? `OLX ${formatPriceBrl(prices.avg * entry.qty)}`
      : prices.newPrice > 0
        ? `Novo ${formatPriceBrl(prices.newPrice * entry.qty)}`
        : "-";
  const priceColor =
    prices.avg > 0 ? "text-emerald-400" : prices.newPrice > 0 ? "text-purple-400" : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between p-2 rounded border border-border/50">
      <div className="flex items-center gap-2">
        <entry.icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">
          {entry.name}
          {entry.qty > 1 ? ` x${entry.qty}` : ""}
        </span>
      </div>
      <span className={`text-sm font-medium ${priceColor}`}>{priceLabel}</span>
    </div>
  );
}

/**
 * Right-hand summary card for the Build tab.
 * Shows total specs, per-component price breakdown, and used vs new comparison.
 */
export function BuilderBuildSummary({ build, totals, getPrice }: BuildSummaryProps) {
  const entries: BreakdownEntry[] = [];
  if (build.gpu) entries.push({ icon: Monitor, name: build.gpu.item.name, qty: build.gpu.quantity });
  if (build.cpuKit) entries.push({ icon: Cpu, name: build.cpuKit.item.name, qty: 1 });
  if (build.ram) entries.push({ icon: MemoryStick, name: build.ram.item.name, qty: build.ram.quantity });
  if (build.motherboard) entries.push({ icon: CircuitBoard, name: build.motherboard.item.name, qty: 1 });
  if (build.psu) entries.push({ icon: Zap, name: build.psu.item.name, qty: 1 });
  if (build.ssd) entries.push({ icon: HardDrive, name: build.ssd.item.name, qty: 1 });

  const savingsPercent =
    totals.newTotal > 0
      ? Math.round(((totals.newTotal - totals.usedAvgTotal) / totals.newTotal) * 100)
      : 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-card-foreground flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Build Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Total Specs grid */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Total Specs
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "VRAM", value: `${totals.vramTotal} GB` },
              { label: "RAM", value: `${totals.ramTotal} GB` },
              { label: "CPU Threads", value: String(totals.threadsTotal) },
              { label: "Total TDP", value: `${totals.tdpTotal}W` },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-lg border border-border/50 bg-background/50">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold text-card-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Component Breakdown */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Component Breakdown
          </h4>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Select components to see breakdown
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <BreakdownRow key={entry.name} entry={entry} getPrice={getPrice} />
              ))}
            </div>
          )}
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
                <span className="text-sm text-card-foreground">Average Used Price</span>
              </div>
              <span className="font-semibold text-green-500">
                {formatPriceBrl(totals.usedAvgTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-card-foreground">New Price</span>
              </div>
              <span className="font-semibold text-card-foreground">
                {totals.newTotal > 0 ? formatPriceBrl(totals.newTotal) : "Not set"}
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
                <span className="font-semibold text-blue-500">{savingsPercent}%</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
