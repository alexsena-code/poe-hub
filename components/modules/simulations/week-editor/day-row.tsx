"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RotateCcw } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { InlineCell } from "./inline-cell";
import { resolveField, isOverridden, fmtDate, fmtNum } from "./helpers";
import type { SimulationDay, SimulationWeek, CostConfig } from "./types";

interface DayRowProps {
  day: SimulationDay;
  week: SimulationWeek;
  isLocked: boolean;
  costConfig: CostConfig | null;
  dayDivines: number | null;
  dayRevUsd: number | null;
  dayRevBrl: number | null;
  dayCost: number | null;
  onSaveField: (dayNumber: number, field: string, value: number | null) => Promise<void>;
  onResetField: (dayNumber: number, field: string) => Promise<void>;
  onResetDay: (dayNumber: number) => Promise<void>;
}

/** Locked (past) day row — all values zeroed/hidden, row is faded. */
function LockedDayRow({ day, costConfig }: { day: SimulationDay; costConfig: CostConfig | null }) {
  const dayLabel = day.date ? fmtDate(day.date) : `D${day.dayNumber}`;
  return (
    <TableRow key={day.id} className="opacity-30">
      <TableCell className="font-medium">
        <span className="text-xs text-muted-foreground mr-1">{day.dayNumber}</span>
        {dayLabel}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">0</TableCell>
      <TableCell className="text-right text-muted-foreground">-</TableCell>
      <TableCell className="text-right text-muted-foreground">-</TableCell>
      <TableCell className="text-right text-muted-foreground">-</TableCell>
      <TableCell className="text-right bg-muted/30 text-muted-foreground">0</TableCell>
      <TableCell className="text-right bg-muted/30 text-muted-foreground">-</TableCell>
      {costConfig && (
        <TableCell className="text-right bg-muted/30 text-muted-foreground">-</TableCell>
      )}
      <TableCell />
    </TableRow>
  );
}

/** Active day row with inline-editable cells and override indicators. */
export function DayRow({
  day,
  week,
  isLocked,
  costConfig,
  dayDivines,
  dayRevUsd,
  dayRevBrl,
  dayCost,
  onSaveField,
  onResetField,
  onResetDay,
}: DayRowProps) {
  const { formatMoney, displayCurrency } = useCurrency();

  if (isLocked) {
    return <LockedDayRow day={day} costConfig={costConfig} />;
  }

  const dayLabel = day.date ? fmtDate(day.date) : `D${day.dayNumber}`;
  const hasAnyOverride =
    day.activeBots !== null ||
    day.divinePerHour !== null ||
    day.hoursPerDay !== null ||
    day.divinePriceUsd !== null ||
    day.divinePriceBrl !== null;

  return (
    <TableRow key={day.id}>
      <TableCell className="font-medium">
        <span className="text-xs text-muted-foreground mr-1">{day.dayNumber}</span>
        {dayLabel}
      </TableCell>
      <TableCell className="text-right">
        <InlineCell
          value={resolveField(day, "activeBots", week)}
          inherited={!isOverridden(day, "activeBots")}
          type="int"
          onSave={(val) => onSaveField(day.dayNumber, "activeBots", val)}
          onReset={
            isOverridden(day, "activeBots")
              ? () => onResetField(day.dayNumber, "activeBots")
              : undefined
          }
        />
      </TableCell>
      <TableCell className="text-right">
        <InlineCell
          value={resolveField(day, "divinePerHour", week)}
          inherited={!isOverridden(day, "divinePerHour")}
          type="int"
          onSave={(val) => onSaveField(day.dayNumber, "divinePerHour", val)}
          onReset={
            isOverridden(day, "divinePerHour")
              ? () => onResetField(day.dayNumber, "divinePerHour")
              : undefined
          }
        />
      </TableCell>
      <TableCell className="text-right">
        <InlineCell
          value={resolveField(day, "hoursPerDay", week)}
          inherited={!isOverridden(day, "hoursPerDay")}
          type="int"
          onSave={(val) => onSaveField(day.dayNumber, "hoursPerDay", val)}
          onReset={
            isOverridden(day, "hoursPerDay")
              ? () => onResetField(day.dayNumber, "hoursPerDay")
              : undefined
          }
        />
      </TableCell>
      <TableCell className="text-right">
        {displayCurrency === "brl" ? (
          <InlineCell
            value={resolveField(day, "divinePriceBrl", week)}
            inherited={!isOverridden(day, "divinePriceBrl")}
            prefix="R$"
            onSave={(val) => onSaveField(day.dayNumber, "divinePriceBrl", val)}
            onReset={
              isOverridden(day, "divinePriceBrl")
                ? () => onResetField(day.dayNumber, "divinePriceBrl")
                : undefined
            }
          />
        ) : (
          <InlineCell
            value={resolveField(day, "divinePriceUsd", week)}
            inherited={!isOverridden(day, "divinePriceUsd")}
            prefix="$"
            onSave={(val) => onSaveField(day.dayNumber, "divinePriceUsd", val)}
            onReset={
              isOverridden(day, "divinePriceUsd")
                ? () => onResetField(day.dayNumber, "divinePriceUsd")
                : undefined
            }
          />
        )}
      </TableCell>
      {/* Calculated columns */}
      <TableCell className="text-right bg-muted/30 font-mono text-sm">
        {fmtNum(dayDivines, 0)}
      </TableCell>
      <TableCell className="text-right bg-muted/30 font-mono text-sm">
        {dayRevBrl !== null
          ? formatMoney(dayRevBrl, "brl")
          : dayRevUsd !== null
          ? formatMoney(dayRevUsd, "usd")
          : "-"}
      </TableCell>
      {costConfig && (
        <TableCell className="text-right bg-muted/30 font-mono text-sm text-muted-foreground">
          {formatMoney(dayCost ?? 0, "usd")}
        </TableCell>
      )}
      <TableCell>
        {hasAnyOverride && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onResetDay(day.dayNumber)}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Restaurar todos os campos para padrao da semana
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
    </TableRow>
  );
}
