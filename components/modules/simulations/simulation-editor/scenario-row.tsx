"use client";

// Single editable row in the scenario tester. Owns inline inputs for bot
// progression params + price overlay, and renders pre-computed totals.
// Stateless — all state lives in scenario-tester.tsx.

import { Trash2, Save } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtNum } from "./utils";
import type {
  Scenario,
  ScenarioResult,
  PriceOverlayParams,
} from "./scenarios";
import { calcDelta } from "./scenarios";
import type { SimulationTotals } from "./utils";

interface LeagueOption {
  name: string;
  hasData: boolean;
}

interface ScenarioRowProps {
  scenario: Scenario;
  result: ScenarioResult;
  baseline: SimulationTotals;
  totalDays: number;
  leagueOptions: LeagueOption[];
  applyingId: string | null;
  priceLoading: boolean;
  formatMoney: (value: number, fromCurrency: "usd" | "brl") => string;
  onUpdate: (patch: Partial<Scenario>) => void;
  onRemove: () => void;
  onApply: () => void;
}

const PRICE_NONE = "__none__";

export function ScenarioRow({
  scenario: s,
  result,
  baseline,
  totalDays,
  leagueOptions,
  applyingId,
  priceLoading,
  formatMoney,
  onUpdate,
  onRemove,
  onApply,
}: ScenarioRowProps) {
  const { totals, dayReachingMax } = result;
  const delta = calcDelta(baseline, totals);
  const dPositive = delta.profit >= 0;

  // Encode (league, source) as a single select value to keep the cell compact.
  const priceValue =
    s.price.league === null
      ? PRICE_NONE
      : `${s.price.league}::${s.price.source}`;

  function handlePriceChange(val: string) {
    if (val === PRICE_NONE) {
      onUpdate({ price: { league: null, source: "median", startDay: 1 } });
      return;
    }
    const [league, source] = val.split("::");
    onUpdate({
      price: {
        league,
        source: source as PriceOverlayParams["source"],
        startDay: s.price.startDay > 0 ? s.price.startDay : 1,
      },
    });
  }

  return (
    <TableRow>
      <TableCell>
        <Input
          value={s.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="h-8 text-xs"
        />
        {dayReachingMax && (
          <span className="block text-[10px] text-muted-foreground mt-1">
            atinge max em D{dayReachingMax}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          value={s.maxBots}
          onChange={(e) => onUpdate({ maxBots: Number(e.target.value) || 1 })}
          className="h-8 text-xs font-mono"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          value={s.incrementPerDay}
          onChange={(e) =>
            onUpdate({ incrementPerDay: Number(e.target.value) || 1 })
          }
          className="h-8 text-xs font-mono"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          value={s.startBots}
          onChange={(e) =>
            onUpdate({ startBots: Number(e.target.value) || 0 })
          }
          className="h-8 text-xs font-mono"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          max={totalDays}
          value={s.startDay}
          onChange={(e) => onUpdate({ startDay: Number(e.target.value) || 1 })}
          className="h-8 text-xs font-mono"
        />
      </TableCell>
      <TableCell className="space-y-1">
        <Select value={priceValue} onValueChange={handlePriceChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PRICE_NONE}>Atual (sem mudança)</SelectItem>
            {leagueOptions
              .filter((l) => l.hasData)
              .map((l) => [
                <SelectItem key={`${l.name}::median`} value={`${l.name}::median`}>
                  {l.name} · Mediana
                </SelectItem>,
                <SelectItem key={`${l.name}::cnl`} value={`${l.name}::cnl`}>
                  {l.name} · CNL
                </SelectItem>,
              ])}
          </SelectContent>
        </Select>
        {s.price.league !== null && (
          <Input
            type="number"
            min={1}
            value={s.price.startDay}
            onChange={(e) =>
              onUpdate({
                price: {
                  ...s.price,
                  startDay: Number(e.target.value) || 1,
                },
              })
            }
            className="h-7 text-xs font-mono"
            placeholder="Dia liga"
            title="Qual dia da liga corresponde ao dia 1 da simulação"
          />
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {priceLoading ? (
          <span className="text-muted-foreground">…</span>
        ) : (
          formatMoney(totals.revenueUsd, "usd")
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground">
        {priceLoading ? "…" : formatMoney(totals.totalCost, "usd")}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-xs font-semibold",
          totals.profit >= 0 ? "text-green-500" : "text-destructive"
        )}
      >
        {priceLoading ? "…" : formatMoney(totals.profit, "usd")}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-xs",
          totals.roi >= 0 ? "text-green-500" : "text-destructive"
        )}
      >
        {priceLoading ? "…" : `${fmtNum(totals.roi, 1)}%`}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-xs font-semibold",
          dPositive ? "text-green-500" : "text-destructive"
        )}
      >
        {priceLoading ? (
          "…"
        ) : (
          <>
            {dPositive ? "+" : ""}
            {formatMoney(delta.profit, "usd")}
          </>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onApply}
            disabled={applyingId === s.id}
            title="Aplicar este cenário à simulação"
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
            title="Remover cenário"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
