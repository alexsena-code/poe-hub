'use client';

import { useEffect, useState } from 'react';
import {
  fetchFeatureFlags,
  updateFeatureFlags,
  resetFeatureFlag,
  fetchOutlineMetrics,
  type FeatureFlagEntry,
  type OutlineMetricsSummary,
} from '@/lib/content-api';

function SourceBadge({ source }: { source: FeatureFlagEntry['source'] }) {
  const style =
    source === 'file'
      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/40'
      : source === 'env'
      ? 'bg-amber-950/40 text-amber-300 border-amber-700/40'
      : 'bg-muted text-muted-foreground border-border';
  const label = source === 'file' ? 'OVERRIDE' : source === 'env' ? '.env' : 'default';
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase ${style}`}
      title={
        source === 'file'
          ? 'Valor do output/feature-flags.json sobrescreve .env'
          : source === 'env'
          ? 'Valor vem de variável de ambiente'
          : 'Nenhuma config — usando default'
      }
    >
      {label}
    </span>
  );
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? 'bg-accent' : 'bg-muted'
      } disabled:opacity-40`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlagEntry[] | null>(null);
  const [metrics, setMetrics] = useState<OutlineMetricsSummary | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [f, m] = await Promise.all([
        fetchFeatureFlags(),
        fetchOutlineMetrics().catch(() => null),
      ]);
      setFlags(f.flags);
      setMetrics(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar flags.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleFlag(key: string, next: boolean) {
    setSavingKey(key);
    setError(null);
    try {
      const result = await updateFeatureFlags({ [key]: next });
      setFlags(result.flags);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar flag.');
    } finally {
      setSavingKey(null);
    }
  }

  async function handleReset(key: string) {
    setSavingKey(key);
    setError(null);
    try {
      const result = await resetFeatureFlag(key);
      setFlags(result.flags);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao resetar flag.');
    } finally {
      setSavingKey(null);
    }
  }

  if (!flags) {
    return <div className="text-sm text-muted-foreground">Carregando feature flags…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {flags.map((f) => (
          <div
            key={f.key}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{f.label}</span>
                  <SourceBadge source={f.source} />
                </div>
                <div className="mt-1 text-[11px] font-mono text-muted-foreground/70">
                  {f.envVar}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Toggle
                  value={f.value}
                  onChange={(next) => toggleFlag(f.key, next)}
                  disabled={savingKey === f.key}
                />
                {f.source === 'file' && (
                  <button
                    type="button"
                    onClick={() => handleReset(f.key)}
                    disabled={savingKey === f.key}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline disabled:opacity-40"
                    title="Remove a override e volta ao valor de .env"
                  >
                    resetar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {metrics && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-accent">Outline Proposer — Métricas</h3>
            <button
              type="button"
              onClick={refresh}
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              atualizar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Total" value={String(metrics.total)} />
            <Metric
              label="Taxa de fallback"
              value={`${(metrics.fallbackRate * 100).toFixed(1)}%`}
              tone={metrics.fallbackRate > 0.2 ? 'warn' : 'ok'}
            />
            <Metric label="Tokens acum." value={metrics.totalTokens.toLocaleString('pt-BR')} />
            <Metric
              label="Custo acum."
              value={`$${metrics.totalCostUsd.toFixed(4)}`}
            />
          </div>

          {metrics.averageLatencyMs !== null && (
            <div className="text-[11px] text-muted-foreground">
              Latência média: {metrics.averageLatencyMs} ms
              {metrics.last && (
                <>
                  {' · '}
                  Última: {new Date(metrics.last.timestamp).toLocaleString('pt-BR')} (
                  {metrics.last.fallback ? 'fallback' : 'ok'}, {metrics.last.llmModel})
                </>
              )}
            </div>
          )}

          {metrics.recentFallbackReasons.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                Últimos fallbacks
              </h4>
              <ul className="space-y-1 text-[11px] text-muted-foreground/90">
                {metrics.recentFallbackReasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground/60 shrink-0">
                      {new Date(r.timestamp).toLocaleString('pt-BR')}
                    </span>
                    <span className="truncate">
                      {r.templateName ? `[${r.templateName}] ` : ''}
                      {r.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'default';
}) {
  const valueStyle =
    tone === 'warn'
      ? 'text-amber-300'
      : tone === 'ok'
      ? 'text-emerald-300'
      : 'text-foreground';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={`text-lg font-semibold ${valueStyle}`}>{value}</span>
    </div>
  );
}
