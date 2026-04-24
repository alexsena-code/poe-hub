'use client';

// Edits style guide (voice + banned phrases + rules + formatting) via PUT /api/engine/config/style-guide

import { useState } from 'react';

interface StyleGuide {
  voice: { tone: string; persona: string; language: string };
  rules: string[];
  banned_phrases: string[];
  formatting: string[];
}

function SaveBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {saving ? 'Salvando...' : 'Salvar'}
    </button>
  );
}

export default function StyleTab({
  guide, onChange, onSave, saving,
}: {
  guide: StyleGuide;
  onChange: (g: StyleGuide) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [newPhrase, setNewPhrase] = useState('');
  const [newRule, setNewRule] = useState('');
  const [newFormatting, setNewFormatting] = useState('');

  const addPhrase = () => {
    const trimmed = newPhrase.trim().toLowerCase();
    if (trimmed && !guide.banned_phrases.includes(trimmed)) {
      onChange({ ...guide, banned_phrases: [...guide.banned_phrases, trimmed] });
      setNewPhrase('');
    }
  };

  const removePhrase = (phrase: string) => {
    onChange({ ...guide, banned_phrases: guide.banned_phrases.filter((p) => p !== phrase) });
  };

  const addRule = () => {
    const trimmed = newRule.trim();
    if (trimmed) {
      onChange({ ...guide, rules: [...guide.rules, trimmed] });
      setNewRule('');
    }
  };

  const removeRule = (idx: number) => {
    onChange({ ...guide, rules: guide.rules.filter((_, i) => i !== idx) });
  };

  const addFormatting = () => {
    const trimmed = newFormatting.trim();
    if (trimmed) {
      onChange({ ...guide, formatting: [...(guide.formatting || []), trimmed] });
      setNewFormatting('');
    }
  };

  const removeFormatting = (idx: number) => {
    onChange({ ...guide, formatting: (guide.formatting || []).filter((_, i) => i !== idx) });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Style Guide</h2>
          <p className="text-xs text-muted-foreground">Voice, regras e banned phrases injetados no system prompt</p>
        </div>
        <SaveBtn onClick={onSave} saving={saving} />
      </div>

      {/* Voice */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Voice</h3>
        <div className="space-y-2">
          {(['tone', 'persona', 'language'] as const).map((field) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground block mb-1">{field}</label>
              <input
                value={guide.voice?.[field] || ''}
                onChange={(e) => onChange({
                  ...guide,
                  voice: { ...guide.voice, [field]: e.target.value },
                })}
                className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Banned Phrases */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Banned Phrases
          <span className="text-xs text-muted-foreground font-normal ml-2">({guide.banned_phrases?.length || 0})</span>
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {(guide.banned_phrases || []).map((phrase) => (
            <span
              key={phrase}
              className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400"
            >
              &quot;{phrase}&quot;
              <button onClick={() => removePhrase(phrase)} className="hover:text-red-300 ml-1">x</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPhrase()}
            placeholder="Adicionar frase banida..."
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
          />
          <button
            onClick={addPhrase}
            className="px-3 py-1 bg-foreground/10 border border-border rounded text-sm text-foreground hover:bg-foreground/20"
          >
            +
          </button>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Rules
          <span className="text-xs text-muted-foreground font-normal ml-2">({guide.rules?.length || 0})</span>
        </h3>
        <div className="space-y-2 mb-3">
          {(guide.rules || []).map((rule, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-background rounded p-2">
              <span className="text-xs text-muted-foreground mt-0.5 shrink-0">{idx + 1}.</span>
              <span className="text-xs text-foreground flex-1">{typeof rule === 'string' ? rule : JSON.stringify(rule)}</span>
              <button
                onClick={() => removeRule(idx)}
                className="text-muted-foreground hover:text-red-400 text-xs shrink-0"
              >
                x
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder="Adicionar regra..."
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
          />
          <button
            onClick={addRule}
            className="px-3 py-1 bg-foreground/10 border border-border rounded text-sm text-foreground hover:bg-foreground/20"
          >
            +
          </button>
        </div>
      </div>

      {/* Formatting */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Formatting Rules
          <span className="text-xs text-muted-foreground font-normal ml-2">({guide.formatting?.length || 0})</span>
        </h3>
        <div className="space-y-2 mb-3">
          {(guide.formatting || []).map((rule, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-background rounded p-2">
              <span className="text-xs text-foreground flex-1">{rule}</span>
              <button
                onClick={() => removeFormatting(idx)}
                className="text-muted-foreground hover:text-red-400 text-xs shrink-0"
              >
                x
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newFormatting}
            onChange={(e) => setNewFormatting(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFormatting()}
            placeholder="Adicionar regra de formatação..."
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-foreground"
          />
          <button
            onClick={addFormatting}
            className="px-3 py-1 bg-foreground/10 border border-border rounded text-sm text-foreground hover:bg-foreground/20"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
