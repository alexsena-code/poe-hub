"use client";

// Session 33 (BUG 1 fix): granular pipeline status + manual triggers for
// the competitor-gaps page. Without this, the empty state ("Nenhum gap
// encontrado") was silently caused by competitors crawled but never
// enriched/embedded — the gap analyzer needs both steps to produce rows.

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  runCrawlAction,
  runEnrichAction,
  runEmbedAction,
  runFullPipelineAction,
  type PipelineActionResult,
} from "@/app/(auth)/admin/competitor-gaps/actions";

export interface PipelineStats {
  competitors: number;
  crawled: number;
  enriched: number;
  embedded: number;
}

interface PipelineStatusBarProps {
  stats: PipelineStats | null;
  fetchError: string | null;
}

export function PipelineStatusBar({ stats, fetchError }: PipelineStatusBarProps) {
  const [isPending, startTransition] = useTransition();

  function handleAction(action: () => Promise<PipelineActionResult>, label: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(`${label} falhou: ${result.error ?? "erro desconhecido"}`);
        return;
      }
      toast.success(`${label}: ${result.message ?? "iniciado"}`);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Pipeline status
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleAction(runCrawlAction, "Crawl")}
            title="Recarrega sitemaps de todos os competitors"
          >
            Crawl sitemaps
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleAction(() => runEnrichAction(100), "Enrich")}
            title="Extrai title + h2/h3 + keywords das páginas crawled"
          >
            Enrich pages
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleAction(() => runEmbedAction(100), "Embed")}
            title="Embute em Qdrant pra gap analysis"
          >
            Embed
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={isPending}
            onClick={() => handleAction(() => runFullPipelineAction(100), "Full pipeline")}
            title="Crawl → Enrich → Embed em sequência"
          >
            {isPending ? "Rodando…" : "Full pipeline"}
          </Button>
        </div>
      </div>

      {fetchError ? (
        <div className="text-sm text-destructive">
          Falha ao carregar stats: {fetchError}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Competitors" value={stats.competitors} />
          <Stat label="Crawled" value={stats.crawled} />
          <Stat
            label="Enriched"
            value={stats.enriched}
            warn={stats.crawled > 0 && stats.enriched < stats.crawled}
            warnHint="Faltam páginas enriquecidas — clique em Enrich pages."
          />
          <Stat
            label="Embedded"
            value={stats.embedded}
            warn={stats.enriched > 0 && stats.embedded < stats.enriched}
            warnHint="Faltam embeddings — clique em Embed."
          />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Carregando stats…</div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
  warnHint,
}: {
  label: string;
  value: number;
  warn?: boolean;
  warnHint?: string;
}) {
  return (
    <div
      className={`rounded border p-3 ${warn ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-background/40"}`}
      title={warn ? warnHint : undefined}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${warn ? "text-amber-300" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
