"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign,
  TrendingDown,
  Coins,
  CalendarRange,
  AlertTriangle,
  Hourglass,
} from "lucide-react";
import type { ProfitForecast } from "@/lib/profit-forecast";
import type { BotPayback } from "@/lib/bot-payback";
import { breakdownDailyCost, type DailyCostComponents, type DailyCostLine } from "@/lib/daily-cost";

interface ProfitSummaryCardsProps {
  forecast: ProfitForecast;
  days: number;
  /** Ausente = projeção sem custo; o card de custo fica em zero. */
  costParts: DailyCostComponents | null;
  activeBots: number;
  /** Payback de UMA conta ao preço de hoje. */
  payback: BotPayback;
  /** Setup que o payback está amortizando, em USD por bot. */
  oneTimePerBot: number;
}

const COST_LINE_LABELS: Record<DailyCostLine["key"], string> = {
  explugins: "ExPlugins",
  dpb: "DPB",
  proxy: "Proxy",
  customPerBot: "Customs (por bot)",
  customGlobal: "Customs (global)",
};

function usd(value: number): string {
  return `US$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Taxas por bot são pequenas (proxy de 3/mês = 0,1) — 2 casas esconderiam a conta. */
function rate(value: number): string {
  return `US$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

/** Quanto cada bot custa por dia, somando só as parcelas que escalam com bot. */
function perBotTotal(lines: DailyCostLine[]): number {
  return lines.reduce((acc, line) => acc + line.perBotDaily, 0);
}

function CostBreakdown({
  lines,
  activeBots,
  total,
}: {
  lines: DailyCostLine[];
  activeBots: number;
  total: number;
}) {
  return (
    <ul className="space-y-1 text-xs">
      {lines.map((line) => (
        <li key={line.key} className="flex justify-between gap-6 font-mono">
          <span>{COST_LINE_LABELS[line.key]}</span>
          <span>
            {line.perBotDaily > 0 && `${activeBots} × ${rate(line.perBotDaily)} = `}
            {usd(line.totalDaily)}
          </span>
        </li>
      ))}
      <li className="flex justify-between gap-6 border-t border-border/50 pt-1 font-mono font-semibold">
        <span>Total/dia</span>
        <span>{usd(total)}</span>
      </li>
    </ul>
  );
}

function CardValue({
  value,
  negative,
  tooltip,
}: {
  value: string;
  negative?: boolean;
  tooltip?: ReactNode;
}) {
  const className = `text-2xl font-bold ${negative ? "text-destructive" : ""}`;
  if (!tooltip) return <div className={className}>{value}</div>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`${className} w-fit cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4`}
          >
            {value}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface SummaryCard {
  title: string;
  icon: typeof DollarSign;
  value: string;
  hint: string;
  negative?: boolean;
  tooltip?: ReactNode;
}

function buildCards({
  forecast,
  days,
  costParts,
  activeBots,
  payback,
  oneTimePerBot,
}: ProfitSummaryCardsProps): SummaryCard[] {
  const today = forecast.days[0];
  const breakEven = forecast.breakEvenDayOffset;
  const costLines = costParts ? breakdownDailyCost(costParts, activeBots) : [];

  return [
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
      hint: costLines.length
        ? `${activeBots} bots × ${rate(perBotTotal(costLines))}/bot`
        : "Sem custo recorrente",
      tooltip: costLines.length ? (
        <CostBreakdown lines={costLines} activeBots={activeBots} total={today.costUsd} />
      ) : undefined,
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
      value: breakEvenLabel(breakEven),
      hint:
        breakEven === null
          ? "Receita cobre o custo até o fim"
          : `Dia ${forecast.days[breakEven].dayOfLeague} da liga`,
      negative: breakEven !== null && breakEven <= 3,
    },
    {
      title: "Payback do bot",
      icon: Hourglass,
      value: paybackLabel(payback.days),
      hint:
        payback.days === null
          ? "O bot não fecha o dia no positivo"
          : `${usd(oneTimePerBot)} de setup ÷ ${usd(payback.profitPerBotUsd)}/dia`,
      negative: payback.days === null,
      tooltip: (
        <PaybackBreakdown
          payback={payback}
          oneTimePerBot={oneTimePerBot}
          divinesPerBot={today.divines / Math.max(activeBots, 1)}
          priceUsd={today.priceUsd}
        />
      ),
    },
  ];
}

/** Offset 0 significa que hoje já fecha no vermelho — "Em 0 dias" mentia sobre isso. */
function breakEvenLabel(offset: number | null): string {
  if (offset === null) return "Não no período";
  if (offset === 0) return "Já está";
  return `Em ${offset} dia${offset === 1 ? "" : "s"}`;
}

/** Abaixo de um dia, "0,7 dias" não diz nada ao operador — horas dizem. */
function paybackLabel(days: number | null): string {
  if (days === null) return "Nunca";
  if (days === 0) return "Imediato";
  if (days < 1) return `${(days * 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  const label = days.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${label} ${days < 2 ? "dia" : "dias"}`;
}

function PaybackBreakdown({
  payback,
  oneTimePerBot,
  divinesPerBot,
  priceUsd,
}: {
  payback: BotPayback;
  oneTimePerBot: number;
  divinesPerBot: number;
  priceUsd: number;
}) {
  const custo = payback.revenuePerBotUsd - payback.profitPerBotUsd;
  const rows: [string, string][] = [
    ["Setup por bot", usd(oneTimePerBot)],
    [
      "Receita/bot/dia",
      `${divinesPerBot.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} div × ${rate(priceUsd)} = ${usd(payback.revenuePerBotUsd)}`,
    ],
    ["Custo/bot/dia", usd(custo)],
    ["Lucro/bot/dia", usd(payback.profitPerBotUsd)],
  ];

  return (
    <div className="space-y-1 text-xs">
      <ul className="space-y-1">
        {rows.map(([label, valor]) => (
          <li key={label} className="flex justify-between gap-6 font-mono">
            <span>{label}</span>
            <span>{valor}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-border/50 pt-1 text-muted-foreground">
        Ao preço de hoje, sem a queda projetada. Custos globais ficam de fora: são da
        operação, não da conta nova.
      </p>
    </div>
  );
}

export function ProfitSummaryCards(props: ProfitSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {buildCards(props).map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardValue value={card.value} negative={card.negative} tooltip={card.tooltip} />
            <p className="text-xs text-muted-foreground mt-1">{card.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
