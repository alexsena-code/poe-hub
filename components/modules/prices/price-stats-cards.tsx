"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowLeftRight } from "lucide-react";

interface PriceStats {
  currentCnlPrice: number | null;
  avgCnl7d: number | null;
  avgCnl30d: number | null;
  avgMarket7d: number | null;
  avgMarket30d: number | null;
  spread: number | null;
}

interface PriceStatsCardsProps {
  currency?: string;
  league?: string;
}

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return value.toFixed(2);
}

export function PriceStatsCards({ currency = "divine", league }: PriceStatsCardsProps) {
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("currency", currency);
        if (league) params.set("league", league);

        const res = await fetch(`/api/prices/stats?${params}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        // Stats loading failed silently
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [currency, league]);

  const cards = [
    {
      title: "Preco CNL Atual",
      value: stats?.currentCnlPrice,
      icon: DollarSign,
      description: "Ultimo preco registrado (CNL)",
    },
    {
      title: "Media CNL 7d",
      value: stats?.avgCnl7d,
      icon: TrendingUp,
      description: "Media dos ultimos 7 dias (CNL)",
    },
    {
      title: "Media CNL 30d",
      value: stats?.avgCnl30d,
      icon: BarChart3,
      description: "Media dos ultimos 30 dias (CNL)",
    },
    {
      title: "Media Mercado 7d",
      value: stats?.avgMarket7d,
      icon: TrendingDown,
      description: "Media do mercado 7 dias",
    },
    {
      title: "Spread CNL vs Mercado",
      value: stats?.spread,
      icon: ArrowLeftRight,
      description: "Diferenca percentual",
      suffix: "%",
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
                <div className="text-2xl font-bold">
                  {formatPrice(card.value ?? null)}
                  {card.suffix && card.value !== null && card.value !== undefined
                    ? card.suffix
                    : ""}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
