"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { G2gPriceCards } from "@/components/modules/prices/g2g-price-cards";
import { G2gPriceChart } from "@/components/modules/prices/g2g-price-chart";
import { CrossLeaguePriceChart } from "@/components/modules/prices/cross-league-price-chart";
import { useG2gSnapshots } from "@/hooks/use-g2g-snapshots";
import { useLeagues } from "@/hooks/use-leagues";

const ITEM = "Divine Orb";

export default function PricesPage() {
  const [rangeDays, setRangeDays] = useState(7);
  const [collecting, setCollecting] = useState(false);
  const { activeLeagues } = useLeagues();
  const currentLeague = activeLeagues.find((l) => l.poeVersion === "poe1")?.name;

  const { snapshots, latest, loading, error, reload } = useG2gSnapshots({
    item: ITEM,
    league: currentLeague,
    days: rangeDays,
  });

  // O penúltimo snapshot é a base da variação mostrada nos cards.
  const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  async function handleCollect() {
    setCollecting(true);
    try {
      const res = await fetch("/api/prices/g2g", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentLeague ? { league: currentLeague } : {}),
      });
      const payload = await res.json();

      if (!res.ok) {
        toast.error(`Coleta falhou: ${payload.error ?? `HTTP ${res.status}`}`);
        return;
      }

      toast.success(
        `Mediana US$ ${payload.stats.median.toFixed(4)} ` +
          `(${payload.stats.offerCount} de ${payload.stats.rawOfferCount} ofertas)`,
      );
      await reload();
    } catch {
      toast.error("Erro ao conectar com a G2G.");
    } finally {
      setCollecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Preço da Concorrência"
        description={
          "Divine Orb na G2G, coletado a cada 30 minutos. A G2G não expõe histórico " +
          "de preço — a série abaixo é construída pelas nossas próprias coletas."
        }
        actions={
          <Button onClick={handleCollect} disabled={collecting}>
            {collecting ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {collecting ? "Coletando..." : "Coletar agora"}
          </Button>
        }
      />

      <G2gPriceCards latest={latest} previous={previous} loading={loading} />

      <G2gPriceChart
        snapshots={snapshots}
        loading={loading}
        error={error}
        rangeDays={rangeDays}
        onRangeChange={setRangeDays}
      />

      <div className="space-y-3 border-t pt-6">
        <div>
          <h2 className="text-xl font-semibold">Arquivo — histórico do Discord</h2>
          <p className="text-sm text-muted-foreground">
            Série encerrada em ago/2026, quando o scraping do Discord foi desligado.
            Preservada porque as simulações se apoiam nela; não recebe dados novos.
          </p>
        </div>
        <CrossLeaguePriceChart item="divine" />
      </div>
    </div>
  );
}
