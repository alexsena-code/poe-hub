import { BotSalesSimulator } from "@/components/modules/bot-sales/bot-sales-simulator";
import { PageHeader } from "@/components/ui/page-header";

export default function BotSalesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Venda de bots"
        description="Modele cobrança por uso, progressão de clientes e margem ao longo de uma liga. Valores comerciais em USD."
      />
      <BotSalesSimulator />
    </div>
  );
}
