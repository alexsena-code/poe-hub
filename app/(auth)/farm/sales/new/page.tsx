import { SaleForm } from "@/components/modules/sales/sale-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewSalePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Nova Venda" />
      <SaleForm />
    </div>
  );
}
