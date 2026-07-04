import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import {
  getCxExecutorStats,
  getFillStats,
  getPlanOrders,
  getSignalFreshness,
} from "@/lib/cx-stats";
import {
  ExecutorsCard,
  FillKpis,
  PnlDayCard,
  RecentFillsCard,
  PlanCard,
  SignalsCard,
} from "@/components/modules/cx/stats-sections";

// STATS do módulo Currency Exchange — substitui o Grafana aposentado. Server
// component: lê tudo do Postgres via Prisma DIRETO (lib/cx-stats). Atrás do
// login como o resto de /farm. Filtro de liga opcional via ?league=.

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ league?: string }>;
}

export default async function CxStatsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { league } = await searchParams;

  const [executors, fillStats, plan, signals] = await Promise.all([
    getCxExecutorStats(),
    getFillStats(league),
    getPlanOrders(league),
    getSignalFreshness(),
  ]);

  const leagues = signals.map((s) => s.league);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`CX Stats${league ? ` — ${league}` : ""}`}
        actions={
          <Link href="/farm/cx">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        }
      />
      <p className="text-sm text-muted-foreground">
        Painel de operação do bot de câmbio (substitui o Grafana). Executores, PnL realizado,
        velocidade de fills, plano do worker e frescor dos sinais — tudo do Postgres.
      </p>

      {leagues.length > 0 && <LeagueFilter leagues={leagues} active={league} />}

      <ExecutorsCard executors={executors} />
      <FillKpis stats={fillStats} />
      <PnlDayCard stats={fillStats} />
      <RecentFillsCard recent={fillStats.recent} />
      <PlanCard orders={plan} />
      <SignalsCard signals={signals} />
    </div>
  );
}

// Filtro de liga como links (server-friendly, sem client component): aplica em
// fills + plano. Sinais e executores ficam sempre "todas as ligas".
function LeagueFilter({ leagues, active }: { leagues: string[]; active?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Liga:</span>
      <Link href="/farm/cx/stats">
        <Badge variant={active ? "outline" : "default"} className="cursor-pointer">
          Todas
        </Badge>
      </Link>
      {leagues.map((l) => (
        <Link key={l} href={`/farm/cx/stats?league=${encodeURIComponent(l)}`}>
          <Badge variant={active === l ? "default" : "outline"} className="cursor-pointer">
            {l}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
