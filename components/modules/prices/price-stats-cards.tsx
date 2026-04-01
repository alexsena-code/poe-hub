"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowLeftRight } from "lucide-react";

interface PriceStats {
  currentCnlPrice: number | null;
  avgCnl7d: number | null;
  avgCnl30d: number | null;
  avgMarket7d: number | null;
  spreadCnlVsMarket: number | null;
}

interface PriceStatsCardsProps {
  item?: string;
  channelId?: string;
  league?: string;
}

function formatPrice(value: number | null, decimals: number): string {
  if (value === null || value === undefined) return "-";
  return `R$ ${value.toFixed(decimals)}`;
}

const POE2_CHANNEL = "1376913719245799515";

export function PriceStatsCards({ item = "divine", channelId, league }: PriceStatsCardsProps) {
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const decimals = channelId === POE2_CHANNEL ? 4 : 2;

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("item", item);
        if (channelId) params.set("channelId", channelId);
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
  }, [item, channelId, league]);

  const cards = [
    {
      title: "Preco CNL Atual",
      value: stats?.currentCnlPrice ?? null,
      icon: DollarSign,
      description: "Ultimo preco registrado (CNL)",
    },
    {
      title: "Media CNL 7d",
      value: stats?.avgCnl7d ?? null,
      icon: TrendingUp,
      description: "Media dos ultimos 7 dias (CNL)",
    },
    {
      title: "Media CNL 30d",
      value: stats?.avgCnl30d ?? null,
      icon: BarChart3,
      description: "Media dos ultimos 30 dias (CNL)",
    },
    {
      title: "Media Mercado 7d",
      value: stats?.avgMarket7d ?? null,
      icon: TrendingDown,
      description: "Media do mercado 7 dias",
    },
    {
      title: "Spread CNL vs Mercado",
      value: stats?.spreadCnlVsMarket ?? null,
      icon: ArrowLeftRight,
      description: "Diferenca percentual (7d)",
      isSpread: true,
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
                  {card.value === null
                    ? "-"
                    : card.isSpread
                    ? `${card.value.toFixed(2)}%`
                    : formatPrice(card.value, decimals)}
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
