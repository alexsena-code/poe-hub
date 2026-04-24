import { KpiCards } from "@/components/modules/dashboard/kpi-cards";
import { RecentSales } from "@/components/modules/dashboard/recent-sales";
import { PriceCharts } from "@/components/modules/dashboard/price-charts";
import { TaskSummary } from "@/components/modules/dashboard/task-summary";
import { PageHeader } from "@/components/ui/page-header";
import { fetchEngine } from "@/lib/fetch-engine";

// Session 04 S04.a — converted from client useEffect fetch to RSC async fetch.
// Data is available at render time; no loading spinner needed.

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

export default async function DashboardPage() {
  let data: DashboardData | null = null;
  let fetchError: string | null = null;

  try {
    data = await fetchEngine<DashboardData>("/api/dashboard");
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Falha ao carregar dados do dashboard";
  }

  if (fetchError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {fetchError ?? "Dados indisponíveis"}
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
