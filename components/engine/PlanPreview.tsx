'use client';

import { useState } from 'react';
import { planPreview } from '@/lib/content-api';
import type { Briefing } from '@/lib/engine-types';

interface PlanSection {
  sectionId: string;
  specificQueries: string[];
  entityMustInclude: string[];
  priority?: string;
}

interface Plan {
  stepBackQuery: string;
  sections: PlanSection[];
  generatedAt: string;
}

interface Props {
  briefing: Briefing;
  disabled?: boolean;
}

export default function PlanPreview({ briefing, disabled }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const result = await planPreview(briefing);
      if (result.error || !result.plan) {
        setError(result.error || 'Plan disabled or failed');
      } else {
        setPlan(result.plan);
        setOpen(true);
      }
    } catch (e: any) {
      setError(e.message || 'Falha ao gerar preview');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">Como o briefing será interpretado?</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rode o planner antes da geração pra ver quais queries vão ser usadas e quais entidades o sistema vai focar.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoad}
          disabled={disabled || loading}
          className="shrink-0 px-3 py-1.5 rounded border border-foreground/30 text-foreground text-xs font-medium hover:bg-foreground/10 disabled:opacity-50"
        >
          {loading ? 'Planejando...' : plan ? 'Regerar' : 'Ver interpretação'}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-xs text-red-300 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {plan && open && (
        <div className="mt-4 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Step-back query</div>
            <p className="text-xs text-foreground/90 bg-background/60 rounded px-3 py-2 font-mono">
              {plan.stepBackQuery || <span className="italic text-muted-foreground">(vazio)</span>}
            </p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Plano por seção ({plan.sections.length})
            </div>
            <div className="flex flex-col gap-2">
              {plan.sections.map((s) => (
                <details key={s.sectionId} className="rounded border border-border bg-background/40">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-medium text-foreground hover:bg-background/60 flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">{s.sectionId}</span>
                    {s.priority && s.priority !== 'normal' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        s.priority === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-muted/20 text-muted-foreground'
                      }`}>
                        {s.priority}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {s.specificQueries.length} queries · {s.entityMustInclude.length} entities
                    </span>
                  </summary>
                  <div className="px-3 pb-3 pt-1 text-xs text-foreground/80 space-y-2">
                    {s.specificQueries.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Queries</div>
                        <ul className="space-y-1">
                          {s.specificQueries.map((q, i) => (
                            <li key={i} className="font-mono bg-background/60 rounded px-2 py-1">{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {s.entityMustInclude.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Entidades focadas</div>
                        <div className="flex flex-wrap gap-1">
                          {s.entityMustInclude.map((e, i) => (
                            <span key={i} className="text-[11px] bg-foreground/10 text-foreground border border-foreground/20 rounded px-2 py-0.5">
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            Gerado em {new Date(plan.generatedAt).toLocaleString('pt-BR')} · modelo: openai/gpt-4.1-mini
          </p>
        </div>
      )}
    </div>
  );
}
