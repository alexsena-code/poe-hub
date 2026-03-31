import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SaleForm } from "@/components/modules/sales/sale-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSalePage({ params }: Props) {
  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { buyer: true },
  });

  if (!sale) {
    notFound();
  }

  const initialData = {
    id: sale.id,
    date: sale.date.toISOString(),
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
