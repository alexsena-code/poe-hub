'use client';

import { Input } from '@/components/ui/input';

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
      <Input
        type="text"
        placeholder="Ex: 3.24"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
