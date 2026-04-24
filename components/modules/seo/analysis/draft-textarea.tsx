'use client';

// DraftTextarea — paste markdown draft here before hitting "Score Content".
// Plain textarea (no shadcn Textarea import needed — it's just a styled native element).
// Rows=12 gives a comfortable viewport for article-length content.

interface DraftTextareaProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function DraftTextarea({ value, onChange, disabled }: DraftTextareaProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground uppercase tracking-wider">
        Draft Markdown
      </label>
      <textarea
        rows={12}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Cole o markdown do draft aqui para scoring"
        className="w-full resize-y bg-background border border-border rounded px-3 py-2
                   text-sm text-foreground placeholder:text-muted-foreground/50
                   font-mono leading-relaxed
                   disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {value.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-right">
          {value.length.toLocaleString()} chars
        </p>
      )}
    </div>
  );
}
