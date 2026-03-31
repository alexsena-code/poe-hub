import Link from "next/link";
import { PriceStatsCards } from "@/components/modules/prices/price-stats-cards";
import { PriceHistoryTable } from "@/components/modules/prices/price-history-table";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export default function PricesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Historico de Precos</h1>
          <p className="text-muted-foreground">
            Acompanhe a evolucao dos precos coletados do Discord.
          </p>
        </div>
        <Link href="/prices/sources">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configurar Sources
          </Button>
        </Link>
      </div>

      <PriceStatsCards />

      <div>
        <h2 className="text-xl font-semibold mb-4">Historico Detalhado</h2>
        <PriceHistoryTable />
      </div>
    </div>
  );
}
