"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { useCurrency } from "@/hooks/use-currency";

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
  levelingCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
}

interface WeekEditorProps {
  simulationId: string;
  week: SimulationWeek;
  costConfig: CostConfig | null;
  startDayOffset?: number;
  onWeekUpdated: (week: SimulationWeek) => void;
}

// --- Helpers ---

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

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

/** Format as USD without conversion */
function fmtUsd(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "-";
  return Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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

  const displayVal =
    value !== null && value !== undefined
      ? `${prefix}${type === "int" ? Number(value).toLocaleString("pt-BR") : fmtNum(value)}`
      : "-";

  return (
    <div className={cn("flex items-center justify-end gap-1 group", className)}>
      {editing ? (
        <input
          ref={inputRef}
          className="h-6 w-20 text-right font-mono text-sm px-1 bg-background border border-input rounded-sm outline-none focus:ring-1 focus:ring-ring"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      ) : (
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
      )}
      {!editing && !inherited && onReset && (
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
  startDayOffset = 0,
}: WeekEditorProps) {
  const [localWeek, setLocalWeek] = useState<SimulationWeek>(week);
  const { formatMoney, convert, exchangeRate, displayCurrency } = useCurrency();

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

  function calcDayCost(day: SimulationDay): number | null {
    if (!costConfig) return null;
    const bots = resolveField(day, "activeBots", localWeek);
    if (bots === null) return null;
    const costPerBotDaily =
      Number(costConfig.expluginsKeyCostDaily) +
      Number(costConfig.dpbKeyCostDaily) +
      Number(costConfig.proxyCostPerBotMonthly) / 30;
    return bots * costPerBotDaily;
  }

  // Filter out locked days (before startDayOffset) from calculations
  const activeDays = localWeek.days.filter((d) => {
    const gi = (localWeek.weekNumber - 1) * 7 + (d.dayNumber - 1);
    return gi >= startDayOffset;
  });

  // Week subtotals (only active days)
  const weekDivines = activeDays.reduce(
    (sum, d) => sum + (calcDayDivines(d) ?? 0),
    0
  );
  const weekRevenueUsd = activeDays.reduce(
    (sum, d) => sum + (calcDayRevenueUsd(d) ?? 0),
    0
  );
  const weekRevenueBrl = activeDays.reduce(
    (sum, d) => sum + (calcDayRevenueBrl(d) ?? 0),
    0
  );

  // Cost calculation — only active days
  // All costs are per-bot: explugins key, dpb key, proxy
  let weekCost = 0;
  if (costConfig) {
    const expluginsPerBotDaily = Number(costConfig.expluginsKeyCostDaily);
    const dpbPerBotDaily = Number(costConfig.dpbKeyCostDaily);
    const proxyPerBotDaily = Number(costConfig.proxyCostPerBotMonthly) / 30;
    const costPerBotDaily = expluginsPerBotDaily + dpbPerBotDaily + proxyPerBotDaily;

    for (const day of activeDays) {
      const bots = resolveField(day, "activeBots", localWeek) ?? 0;
      weekCost += bots * costPerBotDaily;
    }
  }

  // Use USD revenue if available, otherwise convert BRL→USD directly
  const effectiveRevenueUsd = weekRevenueUsd > 0
    ? weekRevenueUsd
    : weekRevenueBrl / exchangeRate;
  const weekProfit = effectiveRevenueUsd - weekCost;

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
          type="int"
          tooltip="Divines por hora por bot"
          onSave={(val) => saveWeekDefaults({ defaultDivinePerHour: val } as Partial<SimulationWeek>)}
        />
        <DefaultField
          label="Horas/Dia"
          value={Number(localWeek.defaultHoursPerDay)}
          type="int"
          tooltip="Horas de operacao por dia"
          onSave={(val) => saveWeekDefaults({ defaultHoursPerDay: val } as Partial<SimulationWeek>)}
        />
        <DefaultField
          label={`Preco Divine (${displayCurrency === "brl" ? "BRL" : "USD"})`}
          value={displayCurrency === "brl"
            ? (localWeek.defaultDivinePriceBrl != null ? Number(localWeek.defaultDivinePriceBrl) : null)
            : (localWeek.defaultDivinePriceUsd != null ? Number(localWeek.defaultDivinePriceUsd) : null)
          }
          prefix={displayCurrency === "brl" ? "R$" : "$"}
          tooltip="Preco da divine para esta semana"
          onSave={(val) => saveWeekDefaults(
            displayCurrency === "brl"
              ? { defaultDivinePriceBrl: val } as Partial<SimulationWeek>
              : { defaultDivinePriceUsd: val } as Partial<SimulationWeek>
          )}
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
              <TableHead className="text-right">Preco</TableHead>
              <TableHead className="text-right bg-muted/30">Divines/Dia</TableHead>
              <TableHead className="text-right bg-muted/30">Receita</TableHead>
              {costConfig && <TableHead className="text-right bg-muted/30">Custo/Dia</TableHead>}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDays.map((day) => {
              const globalDayIndex = (localWeek.weekNumber - 1) * 7 + (day.dayNumber - 1);
              const isLocked = globalDayIndex < startDayOffset;
              const dayDivines = isLocked ? 0 : calcDayDivines(day);
              const dayRevUsd = isLocked ? 0 : calcDayRevenueUsd(day);
              const dayRevBrl = isLocked ? 0 : calcDayRevenueBrl(day);
              const dayLabel = day.date ? fmtDate(day.date) : `D${day.dayNumber}`;
              const hasAnyOverride =
                day.activeBots !== null ||
                day.divinePerHour !== null ||
                day.hoursPerDay !== null ||
                day.divinePriceUsd !== null ||
                day.divinePriceBrl !== null;

              if (isLocked) {
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
                    {costConfig && <TableCell className="text-right bg-muted/30 text-muted-foreground">-</TableCell>}
                    <TableCell />
                  </TableRow>
                );
              }

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
                      type="int"
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
                      type="int"
                      onSave={(val) => saveDayField(day.dayNumber, "hoursPerDay", val)}
                      onReset={
                        isOverridden(day, "hoursPerDay")
                          ? () => resetDayField(day.dayNumber, "hoursPerDay")
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {displayCurrency === "brl" ? (
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
                    ) : (
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
                      {formatMoney(calcDayCost(day) ?? 0, "usd")}
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
              <TableCell colSpan={5} className="text-right">
                Subtotal Semana {localWeek.weekNumber}
              </TableCell>
              <TableCell className="text-right font-mono">
                {fmtNum(weekDivines, 0)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatMoney(weekRevenueBrl > 0 ? weekRevenueBrl : weekRevenueUsd, weekRevenueBrl > 0 ? "brl" : "usd")}
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
              <>
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
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
