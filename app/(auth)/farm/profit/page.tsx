"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { ProfitInputs, type ProfitInputsState } from "@/components/modules/profit/profit-inputs";
import { ProfitSummaryCards } from "@/components/modules/profit/profit-summary-cards";
import { ProfitProjection } from "@/components/modules/profit/profit-projection";
import { useProfitForecastData } from "@/hooks/use-profit-forecast-data";
import { buildProfitForecast } from "@/lib/profit-forecast";
import { curveFromPoints } from "@/lib/league-price-curve";

const DEFAULT_INPUTS: ProfitInputsState = {
  divinesPerHour: 2,
  hoursPerDay: 8,
  activeBots: 10,
  days: 14,
  priceAdjustPct: 0,
  priceBasis: "median",
  costConfigId: null,
};

export default function ProfitPage() {
  const { data, loading, error } = useProfitForecastData();
  const [inputs, setInputs] = useState<ProfitInputsState>(DEFAULT_INPUTS);

  // Pré-seleciona a config padrão assim que ela chega, sem travar a escolha
  // depois: o efeito só roda quando o conjunto de configs muda.
  useEffect(() => {
    if (!data?.costConfigs.length) return;
    const preferred = data.costConfigs.find((c) => c.isDefault) ?? data.costConfigs[0];
    setInputs((prev) => (prev.costConfigId ? prev : { ...prev, costConfigId: preferred.id }));
  }, [data?.costConfigs]);

  function patchInputs(patch: Partial<ProfitInputsState>) {
    setInputs((prev) => ({ ...prev, ...patch }));
  }

  const forecast = useMemo(() => {
    if (!data?.basePrice) return null;

    const raw =
      inputs.priceBasis === "p25" ? data.basePrice.p25Usd : data.basePrice.medianUsd;
    const basePriceUsd = raw * (1 + inputs.priceAdjustPct / 100);
    if (basePriceUsd <= 0) return null;

    const costConfig = data.costConfigs.find((c) => c.id === inputs.costConfigId);
    const curve = data.curve
      ? curveFromPoints(data.curve.points, data.curve.referenceDay, data.curve.leaguesUsed)
      : null;

    return buildProfitForecast({
      basePriceUsd,
      // Sem startDate não há dia-de-liga; o dia 1 com curva nula equivale a
      // preço constante, que é o comportamento pretendido nesse caso.
      currentDayOfLeague: data.league.currentDayOfLeague ?? 1,
      days: inputs.days,
      divinesPerHour: inputs.divinesPerHour,
      hoursPerDay: inputs.hoursPerDay,
      activeBots: inputs.activeBots,
      costParts: costConfig?.parts ?? null,
      curve: data.league.currentDayOfLeague === null ? null : curve,
    });
  }, [data, inputs]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Calculadora de Profit" />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error ?? "Dados indisponíveis"}
        </div>
      </div>
    );
  }

  const { league, basePrice } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calculadora de Profit"
        description={
          `${league.name}` +
          (league.currentDayOfLeague ? ` — dia ${league.currentDayOfLeague} da liga` : "") +
          (basePrice
            ? `. Divine na G2G: US$ ${basePrice.medianUsd.toFixed(4)} (mediana de ${basePrice.offerCount} ofertas).`
            : ".")
        }
      />

      {!basePrice ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Nenhuma coleta de preço para esta liga ainda.</p>
          <p className="mt-1 text-muted-foreground">
            A calculadora parte do preço da G2G. Rode uma coleta em{" "}
            <Link href="/farm/prices" className="underline">
              Preço da Concorrência
            </Link>{" "}
            e volte aqui.
          </p>
          <Link href="/farm/prices">
            <Button className="mt-3" size="sm">
              Ir para coleta
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <ProfitInputs state={inputs} onChange={patchInputs} data={data} />

          {forecast ? (
            <>
              <ProfitSummaryCards forecast={forecast} days={inputs.days} />
              <ProfitProjection
                forecast={forecast}
                curveLeagues={data.curve?.leaguesUsed ?? []}
                usedOtherGameVersion={data.curve?.usedOtherGameVersion ?? false}
              />
            </>
          ) : (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              O ajuste deixou o preço em zero ou negativo — reduza o desconto.
            </div>
          )}
        </>
      )}
    </div>
  );
}
