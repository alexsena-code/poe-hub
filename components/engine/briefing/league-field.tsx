'use client';

interface LeagueFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function LeagueField({ value, onChange }: LeagueFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground mb-1">
        League
      </label>
      <input
        type="text"
        placeholder="Ex: 3.24"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}
