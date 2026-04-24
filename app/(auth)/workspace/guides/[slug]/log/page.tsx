import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { fetchEngine } from "@/lib/fetch-engine";
import {
  LogTimeline,
  type LogResponse,
} from "@/components/modules/workspace/guides/log-timeline";

// Session 04 S04.a — converted from client useEffect+useParams to RSC async
// fetch. Expand/collapse interaction lives in <LogTimeline> client island.

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}

export default async function LogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let log: LogResponse | null = null;
  let fetchError: string | null = null;

  try {
    const data = await fetchEngine<LogResponse & { error?: string }>(
      `/api/engine/content/posts/${encodeURIComponent(slug)}/log`
    );
    if (data.error) {
      fetchError = data.error;
    } else {
      log = data;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao carregar log";
    if (msg.includes("404")) notFound();
    fetchError = msg;
  }

  if (fetchError || !log) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-muted-foreground text-sm">
          {fetchError ?? "Log não encontrado"}
        </p>
        <Link
          href={`/workspace/guides/${slug}`}
          className="text-foreground text-sm hover:underline flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao post
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href={`/workspace/guides/${slug}`}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Voltar ao post</span>
          </Link>
          <span className="text-sm text-foreground font-medium truncate max-w-md">
            Audit log: {log.title?.["pt-br"] || slug}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <PageHeader
          title="Audit log"
          description="Timeline do pipeline que gerou este post. Cada evento mostra duração, tokens e custo."
          className="mb-6"
        />

        {/* Totals card — pure display, stays in RSC */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Eventos</div>
            <div className="text-xl font-bold text-foreground mt-1">{log.eventCount}</div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Duração total</div>
            <div className="text-xl font-bold text-foreground mt-1">
              {formatDuration(log.totals.durationMs)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tokens</div>
            <div className="text-xl font-bold text-foreground mt-1">
              {log.totals.tokensUsed.toLocaleString("pt-BR")}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo</div>
            <div className="text-xl font-bold text-foreground mt-1">
              {formatCost(log.totals.costUsd)}
            </div>
          </div>
        </div>

        {/* Interactive timeline — client island manages expand/collapse */}
        <LogTimeline log={log} />
      </div>
    </div>
  );
}
