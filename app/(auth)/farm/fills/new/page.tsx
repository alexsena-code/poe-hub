import { FillForm, type FillPrefill } from "@/components/modules/fills/fill-form";
import { PageHeader } from "@/components/ui/page-header";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function NewFillPage({ searchParams }: Props) {
  const sp = await searchParams;
  // Prefill vindo de "Fazer Order" em /farm/signals (todos opcionais e editáveis).
  const prefill: FillPrefill = {
    item: str(sp.item),
    base: str(sp.base),
    league: str(sp.league),
    buyRatio: str(sp.buyRatio),
    fairAtEntry: str(sp.fairAtEntry),
    buyQAhead: str(sp.buyQAhead),
  };
  const hasPrefill = Object.values(prefill).some((v) => v != null);

  return (
    <div className="space-y-6">
      <PageHeader title="Nova Order" />
      <FillForm prefill={hasPrefill ? prefill : undefined} />
    </div>
  );
}
