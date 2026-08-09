"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfitForecastData } from "@/hooks/use-profit-forecast-data";
import { NumberField } from "./number-field";

export interface ProfitInputsState {
  divinesPerHour: number;
  hoursPerDay: number;
  activeBots: number;
  days: number;
  /** Ajuste sobre o preço da G2G, em % (negativo = você vende mais barato). */
  priceAdjustPct: number;
  priceBasis: PriceBasis;
  /**
   * Preço que o comprador de fato paga, em USD/divine. Só vale com
   * `priceBasis: "manual"`. null = ainda não informado.
   */
  manualPriceUsd: number | null;
  costConfigId: string | null;
}

/**
 * `manual` existe porque a G2G é preço de varejo e o comprador em atacado
 * (CNL) paga bem menos — projetar pela mediana da G2G superestima a receita.
 */
export type PriceBasis = "median" | "p25" | "manual";

interface ProfitInputsProps {
  state: ProfitInputsState;
  onChange: (patch: Partial<ProfitInputsState>) => void;
  data: ProfitForecastData;
}

const NO_COST = "__none__";

/**
 * Distância entre o preço manual e a mediana da G2G, para o operador enxergar
 * o tamanho do desconto que está dando sem abrir a calculadora do celular.
 */
function deltaVsG2g(manualPriceUsd: number | null, medianUsd: number): string | null {
  if (!manualPriceUsd || manualPriceUsd <= 0 || medianUsd <= 0) return null;
  const pct = (manualPriceUsd / medianUsd - 1) * 100;
  const sinal = pct >= 0 ? "+" : "";
  return `${sinal}${pct.toFixed(1)}% vs mediana da G2G (US$ ${medianUsd.toFixed(4)})`;
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
            onValueChange={(v) => onChange({ priceBasis: v as PriceBasis })}
          >
            <SelectTrigger id="base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="median">Mediana da G2G</SelectItem>
              <SelectItem value="p25">p25 (piso competitivo)</SelectItem>
              <SelectItem value="manual">Preço do comprador (manual)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {state.priceBasis === "manual" ? (
          <div className="space-y-1.5">
            <NumberField
              id="preco-manual"
              label="Preço do comprador"
              value={state.manualPriceUsd ?? 0}
              min={0}
              max={10}
              step={0.001}
              suffix="US$/div"
              onChange={(v) => onChange({ manualPriceUsd: v })}
            />
            {deltaVsG2g(state.manualPriceUsd, data.basePrice?.medianUsd ?? 0) && (
              <p className="text-xs text-amber-500">
                {deltaVsG2g(state.manualPriceUsd, data.basePrice?.medianUsd ?? 0)}
              </p>
            )}
          </div>
        ) : (
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
        )}

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
