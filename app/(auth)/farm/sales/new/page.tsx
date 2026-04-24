import { SaleForm } from "@/components/modules/sales/sale-form";

export default function NewSalePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Nova Venda</h1>
      <SaleForm />
    </div>
  );
}
