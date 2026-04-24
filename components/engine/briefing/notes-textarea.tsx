'use client';

interface NotesTextareaProps {
  value: string;
  onChange: (value: string) => void;
  // When a brief is hydrated via ?briefId, notes become addenda to the
  // brief rather than the primary context — placeholder and label change
  // to reflect that so the author understands the merging behavior.
  hasBriefSource: boolean;
}

export function NotesTextarea({ value, onChange, hasBriefSource }: NotesTextareaProps) {
  const placeholder = hasBriefSource
    ? 'Opcional: adendo seu — ex.: "foque no público casual de 15 div/hora", "evite falar de TFT", "priorize screenshots do poe.ninja"... Vai ser somado ao briefing do brief, não substituir.'
    : 'Adendos, ângulo, restrições ou referências que o autor precisa considerar.';

  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground mb-1">
        Notas{' '}
        {hasBriefSource && (
          <span className="text-xs text-muted-foreground/70">(adendo do editor — opcional)</span>
        )}
      </label>
      <textarea
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
      />
    </div>
  );
}
