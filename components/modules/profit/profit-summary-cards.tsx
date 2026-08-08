"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingDown, Coins, CalendarRange, AlertTriangle } from "lucide-react";
import type { ProfitForecast } from "@/lib/profit-forecast";

interface ProfitSummaryCardsProps {
  forecast: ProfitForecast;
  days: number;
}

function usd(value: number): string {
  return `US$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ProfitSummaryCards({ forecast, days }: ProfitSummaryCardsProps) {
  const today = forecast.days[0];
  const breakEven = forecast.breakEvenDayOffset;

  const cards = [
    {
      title: "Lucro hoje",
      icon: DollarSign,
      value: usd(forecast.todayProfitUsd),
      hint: `${today.divines.toLocaleString("pt-BR")} divines × US$ ${today.priceUsd.toFixed(4)}`,
      negative: forecast.todayProfitUsd < 0,
    },
    {
      title: "Receita hoje",
      icon: Coins,
      value: usd(today.revenueUsd),
      hint: "Antes dos custos",
    },
    {
      title: "Custo por dia",
      icon: TrendingDown,
      value: usd(today.costUsd),
      hint: today.costUsd === 0 ? "Nenhuma config selecionada" : "Operacional recorrente",
    },
    {
      title: `Lucro em ${days} dias`,
      icon: CalendarRange,
      value: usd(forecast.totals.profitUsd),
      hint: `${forecast.totals.divines.toLocaleString("pt-BR")} divines no total`,
      negative: forecast.totals.profitUsd < 0,
    },
    {
      title: "Vira prejuízo",
      icon: AlertTriangle,
      value: breakEven === null ? "Não no período" : `Em ${breakEven} dia${breakEven === 1 ? "" : "s"}`,
      hint:
        breakEven === null
          ? "Receita cobre o custo até o fim"
          : `Dia ${forecast.days[breakEven].dayOfLeague} da liga`,
      negative: breakEven !== null && breakEven <= 3,
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
            <div
              className={`text-2xl font-bold ${card.negative ? "text-destructive" : ""}`}
            >
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{card.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
