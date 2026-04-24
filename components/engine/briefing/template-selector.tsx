'use client';

interface TemplateSelectorProps {
  templates: Array<{ name: string; file: string }>;
  value: string;
  onChange: (value: string) => void;
}

export function TemplateSelector({ templates, value, onChange }: TemplateSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground mb-1">
        Template
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {templates.map((t) => (
          <option key={t.file} value={t.file}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
