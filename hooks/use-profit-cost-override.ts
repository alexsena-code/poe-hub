"use client";

import { useEffect, useState } from "react";
import type { DailyCostComponents } from "@/lib/daily-cost";
import type { ProfitCostState } from "@/components/modules/profit/profit-cost-editor";

const EMPTY_PARTS: DailyCostComponents = {
  expluginsPerBotDaily: 0,
  dpbPerBotDaily: 0,
  proxyPerBotDaily: 0,
  customPerBotDaily: 0,
  customGlobalDaily: 0,
};

/**
 * Custos que a tela de profit está usando: nascem da config selecionada e
 * passam a ser do operador no instante em que ele edita um campo.
 *
 * Nada aqui persiste — é bancada de simulação. Trocar de config descarta a
 * edição de propósito: misturar override de uma config com os números de outra
 * daria um total que não corresponde a config nenhuma.
 *
 * @example
 * const cost = useProfitCostOverride(config, inputs.costConfigId);
 * cost.value.parts.expluginsPerBotDaily; // 1.8
 */
export function useProfitCostOverride(
  source: ProfitCostState | null,
  costConfigId: string | null,
) {
  const [override, setOverride] = useState<ProfitCostState | null>(null);

  useEffect(() => {
    setOverride(null);
  }, [costConfigId]);

  const base: ProfitCostState = source ?? { parts: EMPTY_PARTS, oneTimePerBot: 0 };

  function patchParts(patch: Partial<DailyCostComponents>) {
    setOverride((prev) => {
      const atual = prev ?? base;
      return { ...atual, parts: { ...atual.parts, ...patch } };
    });
  }

  function setOneTimePerBot(oneTimePerBot: number) {
    setOverride((prev) => ({ ...(prev ?? base), oneTimePerBot }));
  }

  return {
    value: override ?? base,
    edited: override !== null,
    patchParts,
    setOneTimePerBot,
    reset: () => setOverride(null),
  };
}
