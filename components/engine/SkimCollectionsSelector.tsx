'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchSkimCollections } from '@/lib/content-api';
import type { SkimCollection, SkimCollectionsCatalog } from '@/lib/engine-types';

interface SkimCollectionsSelectorProps {
  /**
   * Nome do template atualmente selecionado (ex: "build_guide",
   * "mechanic_guide"). Define quais collections ficam marcadas
   * como "default" e o auto-select inicial.
   */
  templateName: string | undefined;
  /**
   * Array controlado de keys selecionadas. Pai mantém estado.
   * Passar `null` (ou array vazio) para usar o default do template.
   */
  selected: string[];
  /**
   * Callback quando o usuário muda a seleção. Se o resultado for
   * igual ao default do template, o pai deve tratar como "usar
   * default" (não enviar `briefing.skimCollections`).
   */
  onChange: (next: string[]) => void;
  /**
   * Reseta a seleção pro default do template atual.
   */
  onResetToDefault?: () => void;
}

export default function SkimCollectionsSelector({
  templateName,
  selected,
  onChange,
  onResetToDefault,
}: SkimCollectionsSelectorProps) {
  const [catalog, setCatalog] = useState<SkimCollectionsCatalog | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSkimCollections()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const templateDefaults = useMemo(() => {
    if (!catalog || !templateName) return [];
    return catalog.defaultsByTemplate[templateName] || [];
  }, [catalog, templateName]);

  const isAtDefault = useMemo(() => {
    if (selected.length !== templateDefaults.length) return false;
    const a = [...selected].sort();
    const b = [...templateDefaults].sort();
    return a.every((k, i) => k === b[i]);
  }, [selected, templateDefaults]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-700/50 bg-red-950/20 px-3 py-2 text-xs text-red-300">
        Falha ao carregar collections: {error}
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
        Carregando fontes do skim…
      </div>
    );
  }

  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const selectedCount = selected.length;
  const hasCustomSelection = !isAtDefault;

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            Fontes consultadas (skim do outline)
          </span>
          <span className="text-[11px] text-muted-foreground">
            {selectedCount === 0
              ? 'Nenhuma fonte — o LLM propõe sem dados do projeto'
              : `${selectedCount} ${selectedCount === 1 ? 'coleção' : 'coleções'} ativas`}
            {hasCustomSelection && ' · customizado'}
          </span>
        </div>
        <span className="text-muted-foreground text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            O outline é proposto pelo LLM com base em chunks do Qdrant. Cada fonte
            cobre um ângulo diferente da base de conhecimento. Selecione as mais
            relevantes para este post — por padrão, já vem o conjunto que costuma
            funcionar pro template escolhido.
          </p>

          <div className="space-y-2">
            {catalog.collections.map((c: SkimCollection) => {
              const isSelected = selected.includes(c.key);
              const isDefaultForThisTemplate = templateDefaults.includes(c.key);
              return (
                <label
                  key={c.key}
                  className={`flex items-start gap-3 rounded border px-3 py-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-accent/60 bg-background/40'
                      : 'border-border bg-background/20 hover:bg-background/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(c.key)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-accent"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {c.label}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground/70">
                        {c.key}
                      </span>
                      {isDefaultForThisTemplate && (
                        <span className="inline-block rounded border border-blue-700/40 bg-blue-950/40 px-1.5 py-0.5 text-[9px] font-mono uppercase text-blue-300">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {c.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {hasCustomSelection && onResetToDefault && (
            <button
              type="button"
              onClick={onResetToDefault}
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              Resetar ao default do template ({templateDefaults.length} fontes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
