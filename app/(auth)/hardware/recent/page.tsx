import { PageHeader } from "@/components/ui/page-header";
import { fetchEngine } from "@/lib/fetch-engine";
import {
  RecentDealsClient,
  type Deal,
} from "@/components/modules/hardware/recent/recent-deals-client";

const DEFAULT_HOURS = "24";

export default async function RecentDealsPage() {
  // Best-effort fetch: se o hardware service estiver offline, hidratamos
  // vazio e o client mostra o empty-state + permite refetch manual.
  let initialDeals: Deal[] = [];
  try {
    initialDeals = await fetchEngine<Deal[]>(
      `/api/hardware/deals?hours=${DEFAULT_HOURS}`,
    );
  } catch {
    initialDeals = [];
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Deals Recentes"
        description="Anúncios encontrados nas últimas horas"
      />
      <RecentDealsClient initialDeals={initialDeals} initialHours={DEFAULT_HOURS} />
    </div>
  );
}
