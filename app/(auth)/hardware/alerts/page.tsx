import { PageHeader } from "@/components/ui/page-header";
import { fetchEngine } from "@/lib/fetch-engine";
import {
  AlertsClient,
  type Deal,
  type Item,
} from "@/components/modules/hardware/alerts/alerts-client";

const DEFAULT_HOURS = "24";

export default async function AlertsPage() {
  let initialDeals: Deal[] = [];
  let initialItems: Item[] = [];
  try {
    [initialDeals, initialItems] = await Promise.all([
      fetchEngine<Deal[]>(`/api/hardware/deals?hours=${DEFAULT_HOURS}`),
      fetchEngine<Item[]>(`/api/hardware/items`),
    ]);
  } catch {
    // fall through com listas vazias; client pode tentar refetch via "Atualizar".
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Alertas de Desconto"
        description="Deals abaixo do limite de preço, ordenados por % de desconto"
      />
      <AlertsClient
        initialDeals={initialDeals}
        initialItems={initialItems}
        initialHours={DEFAULT_HOURS}
      />
    </div>
  );
}
