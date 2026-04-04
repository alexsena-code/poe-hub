"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeagues } from "@/hooks/use-leagues";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrossLeaguePriceChartProps {
  item: "divine" | "chaos" | "mirror";
}

interface LeagueDayPoint {
  dayOfLeague: number;
  median: number;
  cnlPrice: number | null;
}

interface LeagueData {
  name: string;
  poeVersion: string;
  startDate: string;
  data: LeagueDayPoint[];
}

interface CrossLeagueResponse {
  leagues: LeagueData[];
}

// Record keyed by dayOfLeague, each league name → median value
type MergedPoint = { dayOfLeague: number } & Record<string, number | null>;

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_LABELS: Record<string, string> = {
  divine: "Divine Orb",
  chaos: "Chaos Orb",
  mirror: "Mirror of Kalandra",
};

const MAX_DAYS_OPTIONS = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
];

const LEAGUE_COLORS = [
  "hsl(220, 70%, 60%)",
  "hsl(45, 90%, 55%)",
  "hsl(340, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(280, 60%, 60%)",
  "hsl(25, 80%, 55%)",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CrossLeaguePriceChart({ item }: CrossLeaguePriceChartProps) {
  const { leagues: allLeagues, loading: leaguesLoading } = useLeagues();

  // Only leagues with a startDate can be aligned by day-of-league
  const eligibleLeagues = useMemo(
    () => allLeagues.filter((l) => l.startDate !== null),
    [allLeagues]
  );

  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [maxDays, setMaxDays] = useState(90);
  const [useLogScale, setUseLogScale] = useState(false);

  const [chartLeagues, setChartLeagues] = useState<LeagueData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-select up to 2 most recent leagues once eligible list loads
  useEffect(() => {
    if (eligibleLeagues.length > 0 && selectedLeagues.length === 0) {
      setSelectedLeagues(
        eligibleLeagues.slice(0, Math.min(2, eligibleLeagues.length)).map((l) => l.name)
      );
    }
  }, [eligibleLeagues]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch cross-league data whenever selection / maxDays changes
  useEffect(() => {
    if (selectedLeagues.length < 2) {
      setChartLeagues([]);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          item,
          leagues: selectedLeagues.join(","),
          maxDays: String(maxDays),
        });
        const res = await fetch(`/api/prices/daily/cross-league?${params}`);
        if (!res.ok) throw new Error("Falha ao carregar dados comparativos");
        const json: CrossLeagueResponse = await res.json();
        if (!cancelled) setChartLeagues(json.leagues);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [item, selectedLeagues, maxDays]);

  // ── Merge leagues into a single array keyed by dayOfLeague ────────────────
  const mergedData = useMemo<MergedPoint[]>(() => {
    if (chartLeagues.length === 0) return [];

    const dayMap = new Map<number, MergedPoint>();

    for (const league of chartLeagues) {
      for (const point of league.data) {
        const existing = dayMap.get(point.dayOfLeague) ?? {
          dayOfLeague: point.dayOfLeague,
        };
        (existing as Record<string, number | null>)[league.name] = point.median;
        dayMap.set(point.dayOfLeague, existing as MergedPoint);
      }
    }

    return Array.from(dayMap.values()).sort((a, b) => a.dayOfLeague - b.dayOfLeague);
  }, [chartLeagues]);

  // ── ChartConfig — one entry per league ────────────────────────────────────
  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    chartLeagues.forEach((league, idx) => {
      cfg[league.name] = {
        label: league.name,
        color: LEAGUE_COLORS[idx % LEAGUE_COLORS.length],
      };
    });
    return cfg;
  }, [chartLeagues]);

  // ── Log scale detection ────────────────────────────────────────────────────
  const { priceMin, priceMax, shouldSuggestLog } = useMemo(() => {
    const allValues = mergedData.flatMap((point) =>
      Object.entries(point)
        .filter(([k]) => k !== "dayOfLeague")
        .map(([, v]) => v as number | null)
        .filter((v): v is number => v !== null && v > 0)
    );
    const pMax = allValues.length > 0 ? Math.max(...allValues) : 1;
    const pMin = allValues.length > 0 ? Math.min(...allValues) : 1;
    return {
      priceMin: pMin,
      priceMax: pMax,
      shouldSuggestLog: pMax / pMin > 5,
    };
  }, [mergedData]);

  // ── Toggle a league in/out of selection ───────────────────────────────────
  function toggleLeague(name: string) {
    setSelectedLeagues((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  const itemLabel = ITEM_LABELS[item] ?? item;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div>
          <CardTitle>{itemLabel} — Comparativo entre Leagues</CardTitle>
          <CardDescription>
            Curvas de preco por dia de league (R$ mediana)
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Log scale toggle */}
          {shouldSuggestLog && (
            <Button
              variant={useLogScale ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setUseLogScale((v) => !v)}
              title="Escala logaritmica"
            >
              Log
            </Button>
          )}

          {/* Max days selector */}
          {MAX_DAYS_OPTIONS.map((opt) => (
            <Button
              key={opt.label}
              variant={maxDays === opt.days ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setMaxDays(opt.days)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* League toggle buttons */}
        {leaguesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando leagues...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {eligibleLeagues.map((league, idx) => {
              const isSelected = selectedLeagues.includes(league.name);
              const color = LEAGUE_COLORS[
                chartLeagues.findIndex((l) => l.name === league.name) % LEAGUE_COLORS.length
              ];
              return (
                <Button
                  key={league.id}
                  variant={isSelected ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs gap-1.5"
                  onClick={() => toggleLeague(league.name)}
                  style={
                    isSelected && color
                      ? { borderColor: color, borderWidth: 1 }
                      : undefined
                  }
                >
                  {isSelected && (
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          LEAGUE_COLORS[
                            chartLeagues.findIndex((l) => l.name === league.name) %
                              LEAGUE_COLORS.length
                          ] ?? LEAGUE_COLORS[idx % LEAGUE_COLORS.length],
                      }}
                    />
                  )}
                  {league.name}
                  {league.isCurrent && (
                    <span className="text-[10px] text-muted-foreground">(atual)</span>
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {/* Chart area */}
        {loading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : selectedLeagues.length < 2 ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Selecione pelo menos 2 leagues para comparar.
            </p>
          </div>
        ) : mergedData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Nenhum dado encontrado para o periodo selecionado.
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={mergedData} accessibilityLayer>
              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="dayOfLeague"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
                label={{
                  value: "Dia",
                  position: "insideBottomRight",
                  offset: -8,
                  fontSize: 11,
                }}
                interval="preserveStartEnd"
              />
              <YAxis
                scale={useLogScale && shouldSuggestLog ? "log" : "auto"}
                domain={
                  useLogScale && shouldSuggestLog
                    ? [Math.max(priceMin * 0.8, 0.001), "auto"]
                    : undefined
                }
                allowDataOverflow={useLogScale && shouldSuggestLog}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
                width={72}
                tickFormatter={(v: number) =>
                  `R$${v.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => `Dia ${label}`}
                    formatter={(value, name) => (
                      <span>
                        {name}: R$
                        {Number(value).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {chartLeagues.map((league, idx) => (
                <Line
                  key={league.name}
                  type="monotone"
                  dataKey={league.name}
                  stroke={LEAGUE_COLORS[idx % LEAGUE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
