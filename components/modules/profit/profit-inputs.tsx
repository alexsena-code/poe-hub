"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfitForecastData } from "@/hooks/use-profit-forecast-data";

export interface ProfitInputsState {
  divinesPerHour: number;
  hoursPerDay: number;
  activeBots: number;
  days: number;
  /** Ajuste sobre o preço da G2G, em % (negativo = você vende mais barato). */
  priceAdjustPct: number;
  priceBasis: "median" | "p25";
  costConfigId: string | null;
}

interface ProfitInputsProps {
  state: ProfitInputsState;
  onChange: (patch: Partial<ProfitInputsState>) => void;
  data: ProfitForecastData;
}

const NO_COST = "__none__";

/** Campo numérico que não vira NaN quando o operador apaga tudo. */
function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
        />
        {suffix && <span className="text-sm text-muted-foreground shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

export function ProfitInputs({ state, onChange, data }: ProfitInputsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parâmetros</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          id="divines-hora"
          label="Divines por hora"
          value={state.divinesPerHour}
          min={0}
          max={1000}
          step={0.1}
          suffix="/bot"
          onChange={(v) => onChange({ divinesPerHour: v })}
        />
        <NumberField
          id="horas"
          label="Horas por dia"
          value={state.hoursPerDay}
          min={0}
          max={24}
          step={1}
          suffix="h"
          onChange={(v) => onChange({ hoursPerDay: v })}
        />
        <NumberField
          id="bots"
          label="Bots ativos"
          value={state.activeBots}
          min={0}
          max={500}
          step={1}
          onChange={(v) => onChange({ activeBots: Math.round(v) })}
        />
        <NumberField
          id="dias"
          label="Projetar por"
          value={state.days}
          min={1}
          max={120}
          step={1}
          suffix="dias"
          onChange={(v) => onChange({ days: Math.max(1, Math.round(v)) })}
        />

        <div className="space-y-1.5">
          <Label htmlFor="base">Preço base</Label>
          <Select
            value={state.priceBasis}
            onValueChange={(v) => onChange({ priceBasis: v as "median" | "p25" })}
          >
            <SelectTrigger id="base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="median">Mediana da G2G</SelectItem>
              <SelectItem value="p25">p25 (piso competitivo)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <NumberField
          id="ajuste"
          label="Ajuste sobre a G2G"
          value={state.priceAdjustPct}
          min={-90}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => onChange({ priceAdjustPct: v })}
        />

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="custos">Custos diários</Label>
          <Select
            value={state.costConfigId ?? NO_COST}
            onValueChange={(v) => onChange({ costConfigId: v === NO_COST ? null : v })}
          >
            <SelectTrigger id="custos">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COST}>Sem custos (receita bruta)</SelectItem>
              {data.costConfigs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.name}
                  {config.isDefault ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
