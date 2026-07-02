import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FillForm } from "@/components/modules/fills/fill-form";
import { PageHeader } from "@/components/ui/page-header";

interface Props {
  params: Promise<{ id: string }>;
}

const num = (v: unknown) => (v == null ? null : Number(v));

export default async function EditFillPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  const fill = await prisma.fill.findUnique({ where: { id } });
  if (!fill) notFound();

  const initialData = {
    id: fill.id,
    item: fill.item,
    base: fill.base,
    league: fill.league,
    mode: fill.mode,
    buyRatio: num(fill.buyRatio),
    buyQty: num(fill.buyQty),
    fairAtEntry: num(fill.fairAtEntry),
    buyQAhead: num(fill.buyQAhead),
    sellRatio: num(fill.sellRatio),
    sellQty: num(fill.sellQty),
    sellFilledAt: fill.sellFilledAt ? fill.sellFilledAt.toISOString() : null,
    notes: fill.notes,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Editar Order" />
      <FillForm initialData={initialData} />
    </div>
  );
}
