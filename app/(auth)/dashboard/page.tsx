"use client";

import { useEffect, useState } from "react";
import { KpiCards } from "@/components/modules/dashboard/kpi-cards";
import { RecentSales } from "@/components/modules/dashboard/recent-sales";
import { PriceCharts } from "@/components/modules/dashboard/price-charts";
import { TaskSummary } from "@/components/modules/dashboard/task-summary";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface DashboardData {
  activeBots: number;
  totalBots: number;
  sales30d: { count: number; totalUsd: number; totalBrl: number };
  openTasks: number;
  taskCounts: {
    backlog: number;
    todo: number;
    in_progress: number;
    done: number;
  };
  currentDivinePrice: {
    median: number;
    cnlPrice: number | null;
    date: string;
    league: string;
  } | null;
  divineChange7d: number | null;
  recentSales: {
    id: string;
    date: string;
    buyerName: string;
    quantity: number;
    unit: string;
    totalBrl: number | null;
    totalUsd: number | null;
  }[];
  currentLeagues: { name: string; poeVersion: string }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar dados do dashboard");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />

      <KpiCards data={data} />

      <PriceCharts currentLeagues={data.currentLeagues} />

      <div className="grid gap-4 grid-cols-1">
        <TaskSummary counts={data.taskCounts} />
      </div>

      <div className="grid gap-4 grid-cols-1">
        <RecentSales sales={data.recentSales} />
      </div>
    </div>
  );
}
