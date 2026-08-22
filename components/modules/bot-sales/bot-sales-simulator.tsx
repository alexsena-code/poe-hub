"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  simulateBotSales,
  type BotSalesBillingMode,
  type BotSalesSimulationInput,
} from "@/lib/bot-sales-simulator";
import { cn } from "@/lib/utils";

const DEFAULT_INPUT: BotSalesSimulationInput = {
  horizonDays: 60,
  salesStartDay: 7,
  salesEndDay: 30,
  newCustomersPerDay: 4,
  startingCustomers: 0,
  dailyPriceUsd: 1,
  billingMode: "active_day",
  earlyHoursPerDay: 14,
  lateHoursPerDay: 9,
  hoursChangeDay: 30,
  utilizationPercent: 85,
  paymentFeePercent: 5,
  refundPercent: 3,
  supportCostPerCustomerDayUsd: 0.08,
  fixedCostUsd: 250,
  launchCostUsd: 1_000,
};

interface NumericFieldProps {
  label: string;
  value: number;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumericField({
  label,
  value,
  suffix,
  min = 0,
  max,
  step = 1,
  onChange,
}: NumericFieldProps) {
  function commit(raw: string): void {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, parsed)));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {suffix && <span className="text-[10px] font-mono text-muted-foreground/70">{suffix}</span>}
      </div>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => commit(event.target.value)}
        className="h-9 font-mono"
      />
    </div>
  );
}

function Money({ value }: { value: number }) {
  return <>{value.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}</>;
}

interface MetricProps {
  label: string;
  value: React.ReactNode;
  note: string;
  tone?: "cyan" | "amber" | "green";
}

function Metric({ label, value, note, tone = "cyan" }: MetricProps) {
  const toneClass = {
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    green: "text-emerald-300",
  }[tone];

  return (
    <div className="border-l border-border pl-4 first:border-l-0 first:pl-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function BillingModePicker({
  value,
  onChange,
}: {
  value: BotSalesBillingMode;
  onChange: (value: BotSalesBillingMode) => void;
}) {
  const options: { value: BotSalesBillingMode; title: string; copy: string }[] = [
    {
      value: "active_day",
      title: "Dia ativo",
      copy: "Qualquer uso no dia consome uma diária.",
    },
    {
      value: "runtime_24h",
      title: "24h acumuladas",
      copy: "Horas usadas viram frações de bot-day.",
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === option.value
              ? "border-amber-400/60 bg-amber-400/10"
              : "border-border bg-background/40 hover:border-muted-foreground/50",
          )}
        >
          <span className="block text-sm font-medium">{option.title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {option.copy}
          </span>
        </button>
      ))}
    </div>
  );
}

function RevenueRail({
  input,
  chartDays,
}: {
  input: BotSalesSimulationInput;
  chartDays: ReturnType<typeof simulateBotSales>["days"];
}) {
  return (
    <Card className="overflow-hidden border-cyan-950/70 bg-gradient-to-b from-cyan-950/20 to-card">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Trilho da liga
            </p>
            <CardTitle className="mt-1 text-base">Clientes e lucro acumulado por dia</CardTitle>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-cyan-400" /> Lucro
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-amber-400" /> Clientes
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartDays} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis yAxisId="money" tickLine={false} axisLine={false} fontSize={11} width={62} />
              <YAxis
                yAxisId="customers"
                orientation="right"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={34}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                formatter={(value, name) => [
                  name === "Lucro acumulado"
                    ? `$${Number(value).toFixed(2)}`
                    : Number(value).toFixed(0),
                  name,
                ]}
                labelFormatter={(day) => `Dia ${day}`}
              />
              <ReferenceLine
                yAxisId="money"
                x={input.salesEndDay}
                stroke="#fbbf24"
                strokeDasharray="4 4"
              />
              <Area
                yAxisId="money"
                type="monotone"
                dataKey="cumulativeProfitUsd"
                name="Lucro acumulado"
                stroke="#22d3ee"
                fill="url(#profitFill)"
                strokeWidth={2}
              />
              <Area
                yAxisId="customers"
                type="stepAfter"
                dataKey="customers"
                name="Clientes"
                stroke="#fbbf24"
                fill="transparent"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A linha tracejada marca o fim da aquisição. Depois dela, a base permanece no cap
          calculado.
        </p>
      </CardContent>
    </Card>
  );
}

export function BotSalesSimulator() {
  const [input, setInput] = useState<BotSalesSimulationInput>(DEFAULT_INPUT);
  const result = useMemo(() => simulateBotSales(input), [input]);
  const alternate = useMemo(
    () =>
      simulateBotSales({
        ...input,
        billingMode: input.billingMode === "active_day" ? "runtime_24h" : "active_day",
      }),
    [input],
  );

  function patch(patchValue: Partial<BotSalesSimulationInput>): void {
    setInput((current) => {
      const next = { ...current, ...patchValue };
      next.salesStartDay = Math.min(next.salesStartDay, next.horizonDays);
      next.salesEndDay = Math.min(next.horizonDays, Math.max(next.salesStartDay, next.salesEndDay));
      next.hoursChangeDay = Math.min(next.hoursChangeDay, next.horizonDays);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card/60 p-5">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Receita bruta"
            value={<Money value={result.grossRevenueUsd} />}
            note={`${result.billableBotDays.toFixed(0)} bot-days cobrados`}
          />
          <Metric
            label="Lucro"
            value={<Money value={result.profitUsd} />}
            note={`${result.marginPercent.toFixed(1)}% de margem`}
            tone="green"
          />
          <Metric
            label="Cap de clientes"
            value={result.finalCustomers.toLocaleString("pt-BR")}
            note={`${input.newCustomersPerDay}/dia até o dia ${input.salesEndDay}`}
            tone="amber"
          />
          <Metric
            label="Break-even"
            value={result.breakEvenDay ? `Dia ${result.breakEvenDay}` : "Não atinge"}
            note={`Custo inicial de $${input.launchCostUsd.toFixed(0)}`}
          />
          <Metric
            label="Receita / cliente"
            value={<Money value={result.revenuePerCustomerUsd} />}
            note={`Em ${input.horizonDays} dias`}
          />
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Modelo de cobrança</CardTitle>
                <Badge variant="outline" className="border-amber-400/40 text-amber-300">
                  uso medido
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <BillingModePicker
                value={input.billingMode}
                onChange={(billingMode) => patch({ billingMode })}
              />
              <div className="grid grid-cols-2 gap-3">
                <NumericField
                  label="Preço"
                  suffix="US$/bot-day"
                  value={input.dailyPriceUsd}
                  step={0.05}
                  onChange={(dailyPriceUsd) => patch({ dailyPriceUsd })}
                />
                <NumericField
                  label="Utilização"
                  suffix="%"
                  value={input.utilizationPercent}
                  max={100}
                  onChange={(utilizationPercent) => patch({ utilizationPercent })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aquisição e uso</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <NumericField
                label="Horizonte"
                suffix="dias"
                value={input.horizonDays}
                min={1}
                max={365}
                onChange={(horizonDays) => patch({ horizonDays })}
              />
              <NumericField
                label="Clientes iniciais"
                value={input.startingCustomers}
                onChange={(startingCustomers) => patch({ startingCustomers })}
              />
              <NumericField
                label="Começar vendas"
                suffix="dia"
                value={input.salesStartDay}
                min={1}
                max={input.horizonDays}
                onChange={(salesStartDay) => patch({ salesStartDay })}
              />
              <NumericField
                label="Parar aquisição"
                suffix="dia"
                value={input.salesEndDay}
                min={input.salesStartDay}
                max={input.horizonDays}
                onChange={(salesEndDay) => patch({ salesEndDay })}
              />
              <NumericField
                label="Novos clientes"
                suffix="por dia"
                value={input.newCustomersPerDay}
                onChange={(newCustomersPerDay) => patch({ newCustomersPerDay })}
              />
              <NumericField
                label="Mudança de jornada"
                suffix="dia"
                value={input.hoursChangeDay}
                min={1}
                max={input.horizonDays}
                onChange={(hoursChangeDay) => patch({ hoursChangeDay })}
              />
              <NumericField
                label="Uso inicial"
                suffix="h/dia"
                value={input.earlyHoursPerDay}
                max={24}
                step={0.5}
                onChange={(earlyHoursPerDay) => patch({ earlyHoursPerDay })}
              />
              <NumericField
                label="Uso posterior"
                suffix="h/dia"
                value={input.lateHoursPerDay}
                max={24}
                step={0.5}
                onChange={(lateHoursPerDay) => patch({ lateHoursPerDay })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custos do negócio</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <NumericField
                label="Gateway"
                suffix="% receita"
                value={input.paymentFeePercent}
                max={100}
                step={0.5}
                onChange={(paymentFeePercent) => patch({ paymentFeePercent })}
              />
              <NumericField
                label="Reembolsos"
                suffix="% receita"
                value={input.refundPercent}
                max={100}
                step={0.5}
                onChange={(refundPercent) => patch({ refundPercent })}
              />
              <NumericField
                label="Suporte"
                suffix="US$/cliente/dia"
                value={input.supportCostPerCustomerDayUsd}
                step={0.01}
                onChange={(supportCostPerCustomerDayUsd) => patch({ supportCostPerCustomerDayUsd })}
              />
              <NumericField
                label="Custo fixo"
                suffix="US$/período"
                value={input.fixedCostUsd}
                step={10}
                onChange={(fixedCostUsd) => patch({ fixedCostUsd })}
              />
              <div className="col-span-2">
                <NumericField
                  label="Investimento de lançamento"
                  suffix="US$"
                  value={input.launchCostUsd}
                  step={50}
                  onChange={(launchCostUsd) => patch({ launchCostUsd })}
                />
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full" onClick={() => setInput(DEFAULT_INPUT)}>
            Restaurar cenário-base
          </Button>
        </div>

        <div className="space-y-5">
          <RevenueRail input={input} chartDays={result.days} />

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">De onde sai o dinheiro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <LedgerLine label="Receita bruta" value={result.grossRevenueUsd} positive />
                <LedgerLine label="Gateway" value={-result.paymentFeesUsd} />
                <LedgerLine label="Reembolsos" value={-result.refundsUsd} />
                <LedgerLine label="Suporte variável" value={-result.supportCostUsd} />
                <LedgerLine
                  label="Fixo + lançamento"
                  value={-(input.fixedCostUsd + input.launchCostUsd)}
                />
                <div className="border-t border-border pt-3">
                  <LedgerLine
                    label="Lucro projetado"
                    value={result.profitUsd}
                    positive={result.profitUsd >= 0}
                    strong
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">E se mudar a unidade?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Mantendo preço, clientes e uso, o outro modo produziria:
                </p>
                <p className="mt-5 text-3xl font-semibold tabular-nums text-amber-300">
                  <Money value={alternate.grossRevenueUsd} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {alternate.billableBotDays.toFixed(0)} bot-days no modo{" "}
                  {input.billingMode === "active_day" ? "24h acumuladas" : "dia ativo"}.
                </p>
                <div className="mt-5 rounded-md border border-border bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground">
                  Dia ativo maximiza previsibilidade. 24h acumuladas comunica melhor “só paga quando
                  usa”, mas reduz receita quando a jornada média fica abaixo de 24h.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerLine({
  label,
  value,
  positive = false,
  strong = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", strong && "font-semibold")}>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          positive && value >= 0
            ? "text-emerald-300"
            : value < 0
              ? "text-rose-300"
              : "text-foreground",
        )}
      >
        <Money value={value} />
      </span>
    </div>
  );
}
