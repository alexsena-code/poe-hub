"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { resolveField, fmtNum } from "./helpers";
import { WeekParamsInputs } from "./week-params-inputs";
import { DayRow } from "./day-row";
import type { SimulationWeek, SimulationDay, CostConfig, WeekEditorProps } from "./types";

// Re-export types so "@/components/modules/simulations/week-editor" continues to work
// for all consumers (simulation-editor, simulation-comparison/*).
export type { SimulationDay, SimulationWeek, CostConfig, WeekEditorProps };

// --- Day-level calc helpers (depend on localWeek closure, so live here) ---

function calcDayDivines(day: SimulationDay, week: SimulationWeek): number | null {
  const bots = resolveField(day, "activeBots", week);
  const dph = resolveField(day, "divinePerHour", week);
  const hours = resolveField(day, "hoursPerDay", week);
  if (bots === null || dph === null || hours === null) return null;
  return bots * dph * hours;
}

function calcDayRevenueUsd(day: SimulationDay, week: SimulationWeek): number | null {
  const divines = calcDayDivines(day, week);
  const price = resolveField(day, "divinePriceUsd", week);
  if (divines === null || price === null) return null;
  return divines * price;
}

function calcDayRevenueBrl(day: SimulationDay, week: SimulationWeek): number | null {
  const divines = calcDayDivines(day, week);
  const price = resolveField(day, "divinePriceBrl", week);
  if (divines === null || price === null) return null;
  return divines * price;
}

function calcDayCost(day: SimulationDay, week: SimulationWeek, costConfig: CostConfig): number | null {
  const bots = resolveField(day, "activeBots", week);
  if (bots === null) return null;
  const costPerBotDaily =
    Number(costConfig.expluginsKeyCostDaily) +
    Number(costConfig.dpbKeyCostDaily) +
    Number(costConfig.proxyCostPerBotMonthly) / 30;
  return bots * costPerBotDaily;
}

// --- Week subtotal calculation ---

interface WeekTotals {
  weekDivines: number;
  weekRevenueUsd: number;
  weekRevenueBrl: number;
  weekCost: number;
}

function calcWeekTotals(
  activeDays: SimulationDay[],
  week: SimulationWeek,
  costConfig: CostConfig | null
): WeekTotals {
  const weekDivines = activeDays.reduce((sum, d) => sum + (calcDayDivines(d, week) ?? 0), 0);
  const weekRevenueUsd = activeDays.reduce((sum, d) => sum + (calcDayRevenueUsd(d, week) ?? 0), 0);
  const weekRevenueBrl = activeDays.reduce((sum, d) => sum + (calcDayRevenueBrl(d, week) ?? 0), 0);

  let weekCost = 0;
  if (costConfig) {
    const costPerBotDaily =
      Number(costConfig.expluginsKeyCostDaily) +
      Number(costConfig.dpbKeyCostDaily) +
      Number(costConfig.proxyCostPerBotMonthly) / 30;
    for (const day of activeDays) {
      const bots = resolveField(day, "activeBots", week) ?? 0;
      weekCost += bots * costPerBotDaily;
    }
  }

  return { weekDivines, weekRevenueUsd, weekRevenueBrl, weekCost };
}

// --- Main Component ---

export function WeekEditor({
  simulationId,
  week,
  costConfig,
  onWeekUpdated,
  startDayOffset = 0,
}: WeekEditorProps) {
  const [localWeek, setLocalWeek] = useState<SimulationWeek>(week);
  const { formatMoney, exchangeRate } = useCurrency();

  // Sync from parent — update localWeek when parent data changes (e.g. after import)
  useEffect(() => {
    setLocalWeek(week);
  }, [week]);

  // --- API calls ---

  const saveWeekDefaults = useCallback(
    async (updates: Partial<SimulationWeek>) => {
      try {
        const res = await fetch(
          `/api/simulations/${simulationId}/weeks/${localWeek.weekNumber}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          }
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const updated = await res.json();
        const newWeek = { ...localWeek, ...updated, days: localWeek.days };
        setLocalWeek(newWeek);
        onWeekUpdated(newWeek);
      } catch {
        toast.error("Erro ao atualizar padrao da semana");
      }
    },
    [simulationId, localWeek, onWeekUpdated]
  );

  const saveDayField = useCallback(
    async (dayNumber: number, field: string, value: number | null) => {
      try {
        const res = await fetch(
          `/api/simulations/${simulationId}/weeks/${localWeek.weekNumber}/days/${dayNumber}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
          }
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const updatedDay = await res.json();
        const newDays = localWeek.days.map((d) =>
          d.dayNumber === dayNumber ? { ...d, ...updatedDay } : d
        );
        const newWeek = { ...localWeek, days: newDays };
        setLocalWeek(newWeek);
        onWeekUpdated(newWeek);
      } catch {
        toast.error("Erro ao atualizar dia");
      }
    },
    [simulationId, localWeek, onWeekUpdated]
  );

  const resetDay = useCallback(
    async (dayNumber: number) => {
      try {
        const res = await fetch(
          `/api/simulations/${simulationId}/weeks/${localWeek.weekNumber}/days/${dayNumber}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const resetDayData = await res.json();
        const newDays = localWeek.days.map((d) =>
          d.dayNumber === dayNumber ? { ...d, ...resetDayData } : d
        );
        const newWeek = { ...localWeek, days: newDays };
        setLocalWeek(newWeek);
        onWeekUpdated(newWeek);
        toast.success(`Dia ${dayNumber} restaurado`);
      } catch {
        toast.error("Erro ao restaurar dia");
      }
    },
    [simulationId, localWeek, onWeekUpdated]
  );

  const resetDayField = useCallback(
    async (dayNumber: number, field: string) => {
      await saveDayField(dayNumber, field, null);
    },
    [saveDayField]
  );

  // --- Derived data ---

  // Filter out locked days (before startDayOffset) from calculations
  const activeDays = localWeek.days.filter((d) => {
    const gi = (localWeek.weekNumber - 1) * 7 + (d.dayNumber - 1);
    return gi >= startDayOffset;
  });

  const { weekDivines, weekRevenueUsd, weekRevenueBrl, weekCost } = calcWeekTotals(
    activeDays,
    localWeek,
    costConfig
  );

  // Use USD revenue if available, otherwise convert BRL→USD directly
  const effectiveRevenueUsd = weekRevenueUsd > 0 ? weekRevenueUsd : weekRevenueBrl / exchangeRate;
  const weekProfit = effectiveRevenueUsd - weekCost;

  const sortedDays = [...localWeek.days].sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <div className="space-y-4">
      <WeekParamsInputs week={localWeek} onSaveDefaults={saveWeekDefaults} />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Dia</TableHead>
              <TableHead className="text-right">Bots</TableHead>
              <TableHead className="text-right">Div/Hora</TableHead>
              <TableHead className="text-right">Horas/Dia</TableHead>
              <TableHead className="text-right">Preco</TableHead>
              <TableHead className="text-right bg-muted/30">Divines/Dia</TableHead>
              <TableHead className="text-right bg-muted/30">Receita</TableHead>
              {costConfig && (
                <TableHead className="text-right bg-muted/30">Custo/Dia</TableHead>
              )}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDays.map((day) => {
              const globalDayIndex = (localWeek.weekNumber - 1) * 7 + (day.dayNumber - 1);
              const isLocked = globalDayIndex < startDayOffset;
              const dayDivines = isLocked ? 0 : calcDayDivines(day, localWeek);
              const dayRevUsd = isLocked ? 0 : calcDayRevenueUsd(day, localWeek);
              const dayRevBrl = isLocked ? 0 : calcDayRevenueBrl(day, localWeek);
              const dayCost = isLocked || !costConfig ? null : calcDayCost(day, localWeek, costConfig);

              return (
                <DayRow
                  key={day.id}
                  day={day}
                  week={localWeek}
                  isLocked={isLocked}
                  costConfig={costConfig}
                  dayDivines={dayDivines}
                  dayRevUsd={dayRevUsd}
                  dayRevBrl={dayRevBrl}
                  dayCost={dayCost}
                  onSaveField={saveDayField}
                  onResetField={resetDayField}
                  onResetDay={resetDay}
                />
              );
            })}

            {/* Subtotals row */}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={5} className="text-right">
                Subtotal Semana {localWeek.weekNumber}
              </TableCell>
              <TableCell className="text-right font-mono">
                {fmtNum(weekDivines, 0)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatMoney(
                  weekRevenueBrl > 0 ? weekRevenueBrl : weekRevenueUsd,
                  weekRevenueBrl > 0 ? "brl" : "usd"
                )}
              </TableCell>
              {costConfig && (
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatMoney(weekCost, "usd")}
                </TableCell>
              )}
              <TableCell />
            </TableRow>

            {/* Cost + profit row */}
            {costConfig && (
              <TableRow className="bg-muted/30">
                <TableCell colSpan={7} className="text-right text-sm font-bold">
                  Lucro semanal
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-sm font-bold",
                    weekProfit >= 0 ? "text-green-500" : "text-destructive"
                  )}
                >
                  {formatMoney(weekProfit, "usd")}
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
