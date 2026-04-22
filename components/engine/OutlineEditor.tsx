'use client';

import { useMemo, useState } from 'react';
import type { CustomSection, ProposedOutline } from '@/lib/engine-types';

interface OutlineEditorProps {
  proposal: ProposedOutline;
  onConfirm: (sections: CustomSection[]) => void;
  onCancel: () => void;
  onReset: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

const MIN_SECTIONS = 2;
const MAX_SECTIONS = 12;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function ensureUniqueId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

function badgeStyle(source: CustomSection['source']): string {
  switch (source) {
    case 'template':
      return 'bg-blue-950/40 text-blue-300 border-blue-700/40';
    case 'proposed':
      return 'bg-purple-950/40 text-purple-300 border-purple-700/40';
    case 'user':
      return 'bg-emerald-950/40 text-emerald-300 border-emerald-700/40';
  }
}

function badgeLabel(source: CustomSection['source']): string {
  switch (source) {
    case 'template':
      return 'TEMPLATE';
    case 'proposed':
      return 'PROPOSTA';
    case 'user':
      return 'ADICIONADA';
  }
}

export default function OutlineEditor({
  proposal,
  onConfirm,
  onCancel,
  onReset,
  submitting = false,
  submitLabel = 'Gerar post',
}: OutlineEditorProps) {
  const [sections, setSections] = useState<CustomSection[]>(() => proposal.sections);
  const [error, setError] = useState<string | null>(null);

  const idSet = useMemo(() => new Set(sections.map((s) => s.id)), [sections]);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
  }

  function updateField<K extends keyof CustomSection>(
    index: number,
    field: K,
    value: CustomSection[K],
  ) {
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function remove(index: number) {
    if (sections.length <= MIN_SECTIONS) {
      setError(`Mínimo de ${MIN_SECTIONS} seções.`);
      return;
    }
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function addSection() {
    if (sections.length >= MAX_SECTIONS) {
      setError(`Máximo de ${MAX_SECTIONS} seções.`);
      return;
    }
    const title = 'Nova seção';
    const baseId = slugify(title) || `section_${sections.length + 1}`;
    const id = ensureUniqueId(baseId, idSet);
    const newSection: CustomSection = {
      id,
      title,
      goal: 'Descreva em uma frase o que essa seção deve entregar ao leitor.',
      source: 'user',
    };
    setSections((prev) => [...prev, newSection]);
  }

  function validate(): string | null {
    if (sections.length < MIN_SECTIONS) return `Mínimo de ${MIN_SECTIONS} seções.`;
    if (sections.length > MAX_SECTIONS) return `Máximo de ${MAX_SECTIONS} seções.`;
    const seen = new Set<string>();
    for (const s of sections) {
      if (!s.id) return `Uma seção está sem id.`;
      if (!/^[a-z][a-z0-9_]{1,40}$/.test(s.id)) {
        return `Id "${s.id}" inválido — use apenas letras minúsculas, números e _ (2-41 chars, começando por letra).`;
      }
      if (seen.has(s.id)) return `Id duplicado: "${s.id}".`;
      seen.add(s.id);
      if (!s.title || s.title.trim().length < 3) return `Seção "${s.id}" tem título muito curto.`;
      if (!s.goal || s.goal.trim().length < 10) {
        return `Seção "${s.id}" precisa de um goal (≥ 10 chars).`;
      }
    }
    return null;
  }

  function handleConfirm() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    onConfirm(sections);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-surface px-4 py-3 space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-accent">Outline proposto</h2>
          <span className="text-[10px] text-muted-foreground/70">
            {proposal.fallbackUsed
              ? 'Fallback (template) — ative ENABLE_OUTLINE_PROPOSER para LLM propor'
              : `${proposal.llmModel} · ${proposal.tokensUsed} tokens`}
          </span>
        </div>
        {proposal.rationale && (
          <p className="text-xs text-muted-foreground leading-relaxed">{proposal.rationale}</p>
        )}
      </div>

      <div className="space-y-3">
        {sections.map((s, idx) => (
          <div
            key={`${s.id}_${idx}`}
            className="rounded-lg border border-border bg-surface p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-[10px] font-mono ${badgeStyle(
                    s.source,
                  )}`}
                >
                  {badgeLabel(s.source)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/60">{s.id}</span>
                {s.requires_human_input && (
                  <span className="text-[10px] text-amber-300/80">
                    · requer input humano
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-background/60 disabled:opacity-30"
                  aria-label="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === sections.length - 1}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-background/60 disabled:opacity-30"
                  aria-label="Mover para baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  disabled={s.requires_human_input}
                  className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-30"
                  title={
                    s.requires_human_input
                      ? 'Seção obrigatória do template — não pode ser removida'
                      : 'Remover seção'
                  }
                  aria-label="Remover seção"
                >
                  🗑
                </button>
              </div>
            </div>

            <input
              type="text"
              value={s.title}
              onChange={(e) => updateField(idx, 'title', e.target.value)}
              placeholder="Título da seção"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />

            <textarea
              rows={2}
              value={s.goal}
              onChange={(e) => updateField(idx, 'goal', e.target.value)}
              placeholder="Goal: em uma frase, o que essa seção precisa entregar ao leitor."
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none leading-relaxed"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={addSection}
          disabled={sections.length >= MAX_SECTIONS}
          className="rounded border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:bg-background/60 disabled:opacity-40"
        >
          + Adicionar seção
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-border bg-surface px-3 py-1.5 text-muted-foreground hover:bg-background/60"
        >
          Resetar ao template
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded border border-border bg-surface px-4 py-2 text-sm text-muted-foreground hover:bg-background/60 disabled:opacity-40"
        >
          Voltar ao briefing
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded bg-accent px-6 py-2 text-sm font-semibold text-background hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? 'Gerando...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
