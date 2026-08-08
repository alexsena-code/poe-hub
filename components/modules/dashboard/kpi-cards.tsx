"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, DollarSign, Gem, ListTodo } from "lucide-react";

interface DashboardData {
  activeBots: number;
  totalBots: number;
  sales30d: { count: number; totalUsd: number; totalBrl: number };
  openTasks: number;
  g2gDivinePrice: {
    median: number;
    p25: number;
    offerCount: number;
    collectedAt: string;
    league: string;
  } | null;
  g2gChange7d: number | null;
}

export function KpiCards({ data }: { data: DashboardData }) {
  const g2gPrice = data.g2gDivinePrice;
  const change7d = data.g2gChange7d;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Bots Ativos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bots Ativos</CardTitle>
          <Bot className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {data.activeBots}
            <span className="text-sm font-normal text-muted-foreground">
              /{data.totalBots}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.totalBots > 0
              ? `${((data.activeBots / data.totalBots) * 100).toFixed(0)}% online`
              : "Nenhum bot cadastrado"}
          </p>
        </CardContent>
      </Card>

      {/* Vendas 30d */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Vendas (30d)</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            R${" "}
            {data.sales30d.totalBrl.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.sales30d.count.toLocaleString("pt-BR")}{" "}
            {data.sales30d.count === 1 ? "venda" : "vendas"} no periodo
          </p>
        </CardContent>
      </Card>

      {/* Divine na concorrencia (G2G) — preco de revenda em USD, nao o nosso */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Divine na G2G</CardTitle>
          <Gem className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">
              {g2gPrice ? `US$ ${g2gPrice.median.toFixed(4)}` : "--"}
            </span>
            {change7d !== null && (
              <Badge
                variant={change7d >= 0 ? "default" : "destructive"}
                className={
                  change7d >= 0
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : ""
                }
              >
                {change7d >= 0 ? "+" : ""}
                {change7d.toFixed(1)}%
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {g2gPrice
              ? `mediana de ${g2gPrice.offerCount} ofertas — piso US$ ${g2gPrice.p25.toFixed(4)}`
              : "Sem coleta ainda"}
          </p>
        </CardContent>
      </Card>

      {/* Tarefas Abertas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tarefas Abertas</CardTitle>
          <ListTodo className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.openTasks}</div>
          <p className="text-xs text-muted-foreground mt-1">
            pendentes de conclusao
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
