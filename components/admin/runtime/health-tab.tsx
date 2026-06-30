'use client';

// ---------------------------------------------------------------------------
// Saúde por fonte de coleta — o card de frescor que faltava na observability.
// Consome o engine `GET /seo/health/sources` (via proxy /api/engine) e mostra,
// por fonte, quando foi a última coleta, idade, contagem e status do último run.
// ---------------------------------------------------------------------------

import useSWR from 'swr';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SourceHealth {
  source: string;
  label: string;
  lastCollectedAt: string | null;
  rowCount: number;
  ageHours: number | null;
  lastRunStatus: 'completed' | 'failed' | 'running' | null;
  detail?: string;
}

const HEALTH_URL = '/api/engine/seo/health/sources';
// Auto-refresh a cada 60s — frescor não muda mais rápido que isso.
const REFRESH_MS = 60_000;

async function fetchHealth(url: string): Promise<SourceHealth[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`health endpoint HTTP ${res.status} (esperado 200)`);
  return res.json();
}

// Faixas de frescor (horas): verde < 24, âmbar < 72, vermelho mais velho / sem dado.
function freshness(ageHours: number | null): { label: string; cls: string } {
  if (ageHours === null) return { label: 'sem dados', cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' };
  if (ageHours < 24) return { label: 'fresco', cls: 'bg-green-500/15 text-green-400 border-green-500/30' };
  if (ageHours < 72) return { label: 'envelhecendo', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  return { label: 'velho', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
}

function formatBr(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatAge(ageHours: number | null): string {
  if (ageHours === null) return '—';
  if (ageHours < 1) return '< 1h';
  if (ageHours < 24) return `${Math.round(ageHours)}h`;
  const days = Math.floor(ageHours / 24);
  const rest = Math.round(ageHours % 24);
  return rest ? `${days}d ${rest}h` : `${days}d`;
}

const RUN_STATUS_CLS: Record<string, string> = {
  completed: 'text-green-400',
  failed: 'text-red-400',
  running: 'text-blue-400',
};

function HealthCard({ item }: { item: SourceHealth }) {
  const fresh = freshness(item.ageHours);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{item.label}</h3>
        <Badge variant="outline" className={fresh.cls}>{fresh.label}</Badge>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Última coleta</span>
          <span className="font-mono text-foreground">{formatBr(item.lastCollectedAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Idade</span>
          <span className="font-mono text-foreground">{formatAge(item.ageHours)}</span>
        </div>
        <div className="flex justify-between">
          <span>Linhas</span>
          <span className="font-mono text-foreground">{item.rowCount.toLocaleString('pt-BR')}</span>
        </div>
        {item.lastRunStatus && (
          <div className="flex justify-between">
            <span>Último run</span>
            <span className={`font-mono ${RUN_STATUS_CLS[item.lastRunStatus] ?? 'text-foreground'}`}>
              {item.lastRunStatus}
            </span>
          </div>
        )}
      </div>
      {item.detail && <p className="text-[11px] text-muted-foreground/70 pt-1 border-t border-border">{item.detail}</p>}
    </Card>
  );
}

export default function HealthTab() {
  const { data, error, isLoading } = useSWR<SourceHealth[]>(HEALTH_URL, fetchHealth, {
    refreshInterval: REFRESH_MS,
  });

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Carregando saúde das fontes...</div>;
  if (error) {
    return (
      <div className="py-12 text-center text-red-400 text-sm">
        Falha ao carregar saúde das fontes: {(error as Error).message}
        <p className="text-muted-foreground mt-1">O endpoint `GET /seo/health/sources` está deployado no engine?</p>
      </div>
    );
  }
  if (!data?.length) return <div className="py-12 text-center text-muted-foreground">Sem fontes reportadas.</div>;

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((item) => <HealthCard key={item.source} item={item} />)}
    </div>
  );
}
