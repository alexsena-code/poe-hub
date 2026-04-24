'use client';

// ────────────────────────────────────────────────────────────────────────────
// BriefingTextPanel — shows and edits the expanded briefing for a brief
// ────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ContentBrief } from './types';
import { IDEAS_API } from './constants';

interface BriefingTextPanelProps {
  brief: ContentBrief;
  onUpdate: (updated: ContentBrief) => void;
}

export function BriefingTextPanel({ brief, onUpdate }: BriefingTextPanelProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(brief.briefingText || '');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    setText(brief.briefingText || '');
  }, [brief.id, brief.briefingText]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${IDEAS_API}/ideation/briefs/${brief.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefingText: text }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`${IDEAS_API}/ideation/briefs/${brief.id}/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        setText(updated.briefingText || '');
      }
    } finally {
      setRegenerating(false);
    }
  }

  const modelLabel = brief.briefingTextModel === 'human'
    ? 'editado manualmente'
    : brief.briefingTextModel
      ? `gerado por ${brief.briefingTextModel}`
      : '';

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Briefing expandido</div>
        {modelLabel && <span className="text-[10px] text-muted-foreground italic">{modelLabel}</span>}
        <div className="ml-auto flex gap-1">
          {!editing && brief.briefingText && (
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] text-foreground hover:underline"
            >
              Editar
            </button>
          )}
          {!editing && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {regenerating ? 'Gerando...' : (brief.briefingText ? 'Regerar' : 'Gerar')}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-foreground/30"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 rounded bg-foreground text-background text-[11px] font-medium hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => { setEditing(false); setText(brief.briefingText || ''); }}
              className="px-3 py-1 rounded border border-border text-muted-foreground text-[11px] hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : brief.briefingText ? (
        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
          {brief.briefingText}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Nenhum briefing expandido ainda. Clique em &quot;Gerar&quot; pra criar.
        </p>
      )}
    </div>
  );
}
