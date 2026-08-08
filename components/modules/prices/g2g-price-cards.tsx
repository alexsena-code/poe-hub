"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingDown, TrendingUp, Layers, Filter } from "lucide-react";
import type { G2gSnapshot } from "@/hooks/use-g2g-snapshots";

interface G2gPriceCardsProps {
  latest: G2gSnapshot | null;
  previous: G2gSnapshot | null;
  loading: boolean;
}

/** Preço unitário é da ordem de centavos — menos de 4 casas vira 0,06. */
function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `US$ ${value.toFixed(4)}`;
}

function percentChange(current: number, before: number): number | null {
  if (before === 0) return null;
  return ((current - before) / before) * 100;
}

export function G2gPriceCards({ latest, previous, loading }: G2gPriceCardsProps) {
  const change =
    latest && previous ? percentChange(latest.median, previous.median) : null;
  const discarded = latest ? latest.rawOfferCount - latest.offerCount : null;

  const cards = [
    {
      title: "Mediana G2G",
      icon: DollarSign,
      value: formatUsd(latest?.median),
      description: "Preço típico da concorrência agora",
    },
    {
      title: "Piso competitivo (p25)",
      icon: TrendingDown,
      value: formatUsd(latest?.p25),
      description: "Um quarto das ofertas está abaixo disso",
    },
    {
      title: "Variação",
      icon: change !== null && change < 0 ? TrendingDown : TrendingUp,
      value: change === null ? "-" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
      description: "Contra a coleta anterior",
    },
    {
      title: "Ofertas válidas",
      icon: Layers,
      value: latest ? String(latest.offerCount) : "-",
      description: latest ? `de ${latest.rawOfferCount} encontradas` : "Sem coleta ainda",
    },
    {
      title: "Descartadas",
      icon: Filter,
      value: discarded === null ? "-" : String(discarded),
      description: "Outliers removidos pelo filtro",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
