import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { SaleForm } from "@/components/modules/sales/sale-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSalePage({ params }: Props) {
  const { id } = await params;
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3002"}/api/sales/${id}`,
    { headers: { cookie }, cache: "no-store" }
  );

  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Failed to fetch sale");

  const sale = await res.json();

  const initialData = {
    id: sale.id,
    date: sale.date,
    buyerId: sale.buyerId,
    quantity: Number(sale.quantity),
    unit: sale.unit,
    divinePriceUsd: sale.divinePriceUsd ? Number(sale.divinePriceUsd) : null,
    divinePriceBrl: sale.divinePriceBrl ? Number(sale.divinePriceBrl) : null,
    totalUsd: sale.totalUsd ? Number(sale.totalUsd) : null,
    totalBrl: sale.totalBrl ? Number(sale.totalBrl) : null,
    league: sale.league,
    notes: sale.notes,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Editar Venda</h1>
      <SaleForm initialData={initialData} />
    </div>
  );
}
