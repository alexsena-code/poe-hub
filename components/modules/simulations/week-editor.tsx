"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---

export interface SimulationDay {
  id: string;
  dayNumber: number;
  date: string | null;
  activeBots: number | null;
  divinePerHour: number | null;
  hoursPerDay: number | null;
  divinePriceUsd: number | null;
  divinePriceBrl: number | null;
  overrideNotes: string | null;
}

export interface SimulationWeek {
  id: string;
  weekNumber: number;
  label: string | null;
  defaultActiveBots: number;
  defaultDivinePerHour: number;
  defaultHoursPerDay: number;
  defaultDivinePriceUsd: number | null;
  defaultDivinePriceBrl: number | null;
  days: SimulationDay[];
}

interface CostConfig {
  proxyCostPerBotMonthly: number;
  vpsCostMonthly: number;
  dpbLicenseCostMonthly: number;
  otherFixedCostsMonthly: number;
  otherVariableCostPerBot: number;
}

interface WeekEditorProps {
  simulationId: string;
  week: SimulationWeek;
  costConfig: CostConfig | null;
  onWeekUpdated: (week: SimulationWeek) => void;
}

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

// --- Helpers ---

function resolveField(
  day: SimulationDay,
  field: keyof Pick<SimulationDay, "activeBots" | "divinePerHour" | "hoursPerDay" | "divinePriceUsd" | "divinePriceBrl">,
  week: SimulationWeek
): number | null {
  const dayVal = day[field];
  if (dayVal !== null && dayVal !== undefined) return Number(dayVal);

  const defaultMap: Record<string, keyof SimulationWeek> = {
    activeBots: "defaultActiveBots",
    divinePerHour: "defaultDivinePerHour",
    hoursPerDay: "defaultHoursPerDay",
    divinePriceUsd: "defaultDivinePriceUsd",
    divinePriceBrl: "defaultDivinePriceBrl",
  };

  const weekVal = week[defaultMap[field]];
  return weekVal !== null && weekVal !== undefined ? Number(weekVal) : null;
}

function isOverridden(
  day: SimulationDay,
  field: keyof Pick<SimulationDay, "activeBots" | "divinePerHour" | "hoursPerDay" | "divinePriceUsd" | "divinePriceBrl">
): boolean {
  return day[field] !== null && day[field] !== undefined;
}

function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "-";
  return Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(val: number | null | undefined, prefix: string): string {
  if (val === null || val === undefined) return "-";
  return `${prefix}${fmtNum(val)}`;
}

// --- Inline Editable Cell ---

interface InlineCellProps {
  value: number | null;
  inherited: boolean;
  onSave: (val: number | null) => void;
  onReset?: () => void;
  type?: "int" | "decimal";
  prefix?: string;
  className?: string;
}

function InlineCell({
  value,
  inherited,
  onSave,
  onReset,
  type = "decimal",
  prefix = "",
  className,
}: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditValue(value !== null && value !== undefined ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed === "" || trimmed === String(value)) return;
    const parsed = type === "int" ? parseInt(trimmed, 10) : parseFloat(trimmed);
    if (isNaN(parsed)) return;
    onSave(parsed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        className="h-7 w-24 text-right font-mono text-sm"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    );
  }

  const displayVal =
    value !== null && value !== undefined
      ? `${prefix}${type === "int" ? Number(value).toLocaleString("pt-BR") : fmtNum(value)}`
      : "-";

  return (
    <div className={cn("flex items-center gap-1 group", className)}>
      <span
        className={cn(
          "cursor-pointer font-mono text-sm",
          inherited ? "text-muted-foreground italic" : "font-bold"
        )}
        onClick={startEdit}
        title={inherited ? "Herdado da semana (clique para sobrescrever)" : "Valor sobrescrito"}
      >
        {displayVal}
      </span>
      {!inherited && onReset && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restaurar padrao da semana</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// --- Week Default Editable Field ---

interface DefaultFieldProps {
  label: string;
  value: number | null;
  onSave: (val: number) => void;
  type?: "int" | "decimal";
  prefix?: string;
  tooltip?: string;
}

function DefaultField({ label, value, onSave, type = "decimal", prefix = "", tooltip }: DefaultFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditValue(value !== null && value !== undefined ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed === "") return;
    const parsed = type === "int" ? parseInt(trimmed, 10) : parseFloat(trimmed);
    if (isNaN(parsed)) return;
    if (parsed === value) return;
    onSave(parsed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  const displayVal =
    value !== null && value !== undefined
      ? `${prefix}${type === "int" ? Number(value).toLocaleString("pt-BR") : fmtNum(value)}`
      : "-";

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <Input
          ref={inputRef}
          className="h-8 w-28 font-mono text-sm"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className="cursor-pointer font-mono text-sm font-bold hover:text-primary transition-colors"
                onClick={startEdit}
              >
                {displayVal}
              </p>
            </TooltipTrigger>
            {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// --- Main Component ---

export function WeekEditor({
  simulationId,
  week,
  costConfig,
  onWeekUpdated,
}: WeekEditorProps) {
  const [localWeek, setLocalWeek] = useState<SimulationWeek>(week);

  // Sync from parent
  const weekId = week.id;
  if (localWeek.id !== weekId) {
    setLocalWeek(week);
  }

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
        if (!res.ok) throw new Error();
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
        if (!res.ok) throw new Error();
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
        if (!res.ok) throw new Error();
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

  // --- Calculations ---

  function calcDayDivines(day: SimulationDay): number | null {
    const bots = resolveField(day, "activeBots", localWeek);
    const dph = resolveField(day, "divinePerHour", localWeek);
    const hours = resolveField(day, "hoursPerDay", localWeek);
    if (bots === null || dph === null || hours === null) return null;
    return bots * dph * hours;
  }

  function calcDayRevenueUsd(day: SimulationDay): number | null {
    const divines = calcDayDivines(day);
    const price = resolveField(day, "divinePriceUsd", localWeek);
    if (divines === null || price === null) return null;
    return divines * price;
  }

  function calcDayRevenueBrl(day: SimulationDay): number | null {
    const divines = calcDayDivines(day);
    const price = resolveField(day, "divinePriceBrl", localWeek);
    if (divines === null || price === null) return null;
    return divines * price;
  }

  // Week subtotals
  const weekDivines = localWeek.days.reduce(
    (sum, d) => sum + (calcDayDivines(d) ?? 0),
    0
  );
  const weekRevenueUsd = localWeek.days.reduce(
    (sum, d) => sum + (calcDayRevenueUsd(d) ?? 0),
    0
  );
  const weekRevenueBrl = localWeek.days.reduce(
    (sum, d) => sum + (calcDayRevenueBrl(d) ?? 0),
    0
  );

  // Cost calculation per PRD formula
  let weekCost = 0;
  if (costConfig) {
    const fixedMonthly =
      costConfig.vpsCostMonthly +
      costConfig.dpbLicenseCostMonthly +
      costConfig.otherFixedCostsMonthly;
    const fixedWeekly = fixedMonthly / 4;

    const maxBots = localWeek.days.reduce((max, d) => {
      const bots = resolveField(d, "activeBots", localWeek);
      return Math.max(max, bots ?? 0);
    }, 0);

    const variablePerBot =
      costConfig.proxyCostPerBotMonthly + costConfig.otherVariableCostPerBot;
    const variableWeekly = maxBots * variablePerBot * (7 / 30);

    weekCost = fixedWeekly + variableWeekly;
  }

  const weekProfit = weekRevenueUsd - weekCost;

  // Sort days
  const sortedDays = [...localWeek.days].sort(
    (a, b) => a.dayNumber - b.dayNumber
  );

  return (
    <div className="space-y-4">
      {/* Week default fields */}
      <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-muted/30 border">
        <DefaultField
          label="Bots Ativos"
          value={localWeek.defaultActiveBots}
          type="int"
          tooltip="Valor padrao de bots para todos os dias desta semana"
          onSave={(val) => saveWeekDefaults({ defaultActiveBots: val } as Partial<SimulationWeek>)}
        />
        <DefaultField
          label="Divine/Hora"
          value={Number(localWeek.defaultDivinePerHour)}
          tooltip="Divines por hora por bot"
          onSave={(val) => saveWeekDefaults({ defaultDivinePerHour: val } as Partial<SimulationWeek>)}
        />
        <DefaultField
          label="Horas/Dia"
          value={Number(localWeek.defaultHoursPerDay)}
          tooltip="Horas de operacao por dia"
          onSave={(val) => saveWeekDefaults({ defaultHoursPerDay: val } as Partial<SimulationWeek>)}
        />
        <DefaultField
          label="Preco Divine (USD)"
          value={localWeek.defaultDivinePriceUsd != null ? Number(localWeek.defaultDivinePriceUsd) : null}
          prefix="$"
          tooltip="Preco da divine em USD para esta semana"
          onSave={(val) => saveWeekDefaults({ defaultDivinePriceUsd: val } as Partial<SimulationWeek>)}
        />
        <DefaultField
          label="Preco Divine (BRL)"
          value={localWeek.defaultDivinePriceBrl != null ? Number(localWeek.defaultDivinePriceBrl) : null}
          prefix="R$"
          tooltip="Preco da divine em BRL para esta semana"
          onSave={(val) => saveWeekDefaults({ defaultDivinePriceBrl: val } as Partial<SimulationWeek>)}
        />
      </div>

      {/* Days table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Dia</TableHead>
              <TableHead className="text-right">Bots</TableHead>
              <TableHead className="text-right">Div/Hora</TableHead>
              <TableHead className="text-right">Horas/Dia</TableHead>
              <TableHead className="text-right">Preco USD</TableHead>
              <TableHead className="text-right">Preco BRL</TableHead>
              <TableHead className="text-right bg-muted/30">Divines/Dia</TableHead>
              <TableHead className="text-right bg-muted/30">Receita USD</TableHead>
              <TableHead className="text-right bg-muted/30">Receita BRL</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDays.map((day) => {
              const dayDivines = calcDayDivines(day);
              const dayRevUsd = calcDayRevenueUsd(day);
              const dayRevBrl = calcDayRevenueBrl(day);
              const dayLabel = DAY_LABELS[(day.dayNumber - 1) % 7] ?? `D${day.dayNumber}`;
              const hasAnyOverride =
                day.activeBots !== null ||
                day.divinePerHour !== null ||
                day.hoursPerDay !== null ||
                day.divinePriceUsd !== null ||
                day.divinePriceBrl !== null;

              return (
                <TableRow key={day.id}>
                  <TableCell className="font-medium">
                    <span className="text-xs text-muted-foreground mr-1">
                      {day.dayNumber}
                    </span>
                    {dayLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    <InlineCell
                      value={resolveField(day, "activeBots", localWeek)}
                      inherited={!isOverridden(day, "activeBots")}
                      type="int"
                      onSave={(val) => saveDayField(day.dayNumber, "activeBots", val)}
                      onReset={
                        isOverridden(day, "activeBots")
                          ? () => resetDayField(day.dayNumber, "activeBots")
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <InlineCell
                      value={resolveField(day, "divinePerHour", localWeek)}
                      inherited={!isOverridden(day, "divinePerHour")}
                      onSave={(val) => saveDayField(day.dayNumber, "divinePerHour", val)}
                      onReset={
                        isOverridden(day, "divinePerHour")
                          ? () => resetDayField(day.dayNumber, "divinePerHour")
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <InlineCell
                      value={resolveField(day, "hoursPerDay", localWeek)}
                      inherited={!isOverridden(day, "hoursPerDay")}
                      onSave={(val) => saveDayField(day.dayNumber, "hoursPerDay", val)}
                      onReset={
                        isOverridden(day, "hoursPerDay")
                          ? () => resetDayField(day.dayNumber, "hoursPerDay")
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <InlineCell
                      value={resolveField(day, "divinePriceUsd", localWeek)}
                      inherited={!isOverridden(day, "divinePriceUsd")}
                      prefix="$"
                      onSave={(val) => saveDayField(day.dayNumber, "divinePriceUsd", val)}
                      onReset={
                        isOverridden(day, "divinePriceUsd")
                          ? () => resetDayField(day.dayNumber, "divinePriceUsd")
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <InlineCell
                      value={resolveField(day, "divinePriceBrl", localWeek)}
                      inherited={!isOverridden(day, "divinePriceBrl")}
                      prefix="R$"
                      onSave={(val) => saveDayField(day.dayNumber, "divinePriceBrl", val)}
                      onReset={
                        isOverridden(day, "divinePriceBrl")
                          ? () => resetDayField(day.dayNumber, "divinePriceBrl")
                          : undefined
                      }
                    />
                  </TableCell>
                  {/* Calculated columns */}
                  <TableCell className="text-right bg-muted/30 font-mono text-sm">
                    {fmtNum(dayDivines)}
                  </TableCell>
                  <TableCell className="text-right bg-muted/30 font-mono text-sm">
                    {fmtCurrency(dayRevUsd, "$")}
                  </TableCell>
                  <TableCell className="text-right bg-muted/30 font-mono text-sm">
                    {fmtCurrency(dayRevBrl, "R$")}
                  </TableCell>
                  <TableCell>
                    {hasAnyOverride && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => resetDay(day.dayNumber)}
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
            })}
            {/* Subtotals row */}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={6} className="text-right">
                Subtotal Semana {localWeek.weekNumber}
              </TableCell>
              <TableCell className="text-right font-mono">
                {fmtNum(weekDivines)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {fmtCurrency(weekRevenueUsd, "$")}
              </TableCell>
              <TableCell className="text-right font-mono">
                {fmtCurrency(weekRevenueBrl, "R$")}
              </TableCell>
              <TableCell />
            </TableRow>
            {/* Cost + profit row */}
            {costConfig && (
              <>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={7} className="text-right text-sm text-muted-foreground">
                    Custo semanal
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtCurrency(weekCost, "$")}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
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
                    {fmtCurrency(weekProfit, "$")}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
