"use client";

import { useCurrency } from "@/hooks/use-currency";
import { DefaultField } from "./default-field";
import type { SimulationWeek } from "./types";

interface WeekParamsInputsProps {
  week: SimulationWeek;
  onSaveDefaults: (updates: Partial<SimulationWeek>) => Promise<void>;
}

/**
 * Bar of inline-editable week-level default fields (bots, div/hr, hrs/day, price, build cost).
 * Rendered above the day table in the WeekEditor.
 */
export function WeekParamsInputs({ week, onSaveDefaults }: WeekParamsInputsProps) {
  const { displayCurrency } = useCurrency();

  return (
    <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-muted/30 border">
      <DefaultField
        label="Bots Ativos"
        value={week.defaultActiveBots}
        type="int"
        tooltip="Valor padrao de bots para todos os dias desta semana"
        onSave={(val) => onSaveDefaults({ defaultActiveBots: val })}
      />
      <DefaultField
        label="Divine/Hora"
        value={Number(week.defaultDivinePerHour)}
        type="int"
        tooltip="Divines por hora por bot"
        onSave={(val) => onSaveDefaults({ defaultDivinePerHour: val })}
      />
      <DefaultField
        label="Horas/Dia"
        value={Number(week.defaultHoursPerDay)}
        type="int"
        tooltip="Horas de operacao por dia"
        onSave={(val) => onSaveDefaults({ defaultHoursPerDay: val })}
      />
      <DefaultField
        label={`Preco Divine (${displayCurrency === "brl" ? "BRL" : "USD"})`}
        value={
          displayCurrency === "brl"
            ? week.defaultDivinePriceBrl != null
              ? Number(week.defaultDivinePriceBrl)
              : null
            : week.defaultDivinePriceUsd != null
            ? Number(week.defaultDivinePriceUsd)
            : null
        }
        prefix={displayCurrency === "brl" ? "R$" : "$"}
        tooltip="Preco da divine para esta semana"
        onSave={(val) =>
          onSaveDefaults(
            displayCurrency === "brl"
              ? { defaultDivinePriceBrl: val }
              : { defaultDivinePriceUsd: val }
          )
        }
      />
      <DefaultField
        label="Build (divines)"
        value={week.buildCostDivines != null ? Number(week.buildCostDivines) : null}
        tooltip="Quantidade de divines para montar um personagem que entra em operação nesta semana. Convertido em USD pelo preço da divine desta semana. Cobrado apenas para bots novos (aumento em relação à semana anterior)."
        onSave={(val) => onSaveDefaults({ buildCostDivines: val })}
      />
    </div>
  );
}
