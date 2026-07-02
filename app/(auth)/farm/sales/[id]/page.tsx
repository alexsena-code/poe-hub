import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SaleForm } from "@/components/modules/sales/sale-form";
import { PageHeader } from "@/components/ui/page-header";

interface Props {
  params: Promise<{ id: string }>;
}

const num = (v: unknown) => (v == null ? null : Number(v));

// Server component consulta o Prisma direto (não self-fetch por HTTP): funciona
// igual em dev/Docker/VPS/Vercel sem depender de NEXT_PUBLIC_BASE_URL.
export default async function EditSalePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) notFound();

  const initialData = {
    id: sale.id,
    date: sale.date.toISOString(),
    buyerId: sale.buyerId,
    quantity: Number(sale.quantity),
    unit: sale.unit,
    divinePriceUsd: num(sale.divinePriceUsd),
    divinePriceBrl: num(sale.divinePriceBrl),
    totalUsd: num(sale.totalUsd),
    totalBrl: num(sale.totalBrl),
    league: sale.league,
    notes: sale.notes,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Editar Venda" />
      <SaleForm initialData={initialData} />
    </div>
  );
}
