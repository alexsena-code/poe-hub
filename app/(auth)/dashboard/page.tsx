"use client";

import { useEffect, useState } from "react";
import { KpiCards } from "@/components/modules/dashboard/kpi-cards";
import { RecentSales } from "@/components/modules/dashboard/recent-sales";
import { PriceChart } from "@/components/modules/dashboard/price-chart";
import { TaskSummary } from "@/components/modules/dashboard/task-summary";
import { Loader2 } from "lucide-react";

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
  priceHistory30d: {
    date: string;
    median: number;
    cnlPrice: number | null;
    league: string;
  }[];
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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <KpiCards data={data} />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        {/* Price chart - takes more space */}
        <div className="lg:col-span-4">
          <PriceChart data={data.priceHistory30d} />
        </div>

        {/* Task summary */}
        <div className="lg:col-span-3">
          <TaskSummary counts={data.taskCounts} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1">
        <RecentSales sales={data.recentSales} />
      </div>
    </div>
  );
}
