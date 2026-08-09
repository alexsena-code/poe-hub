"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}

/** Campo numérico que não vira NaN quando o operador apaga tudo. */
export function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
        />
        {suffix && <span className="text-sm text-muted-foreground shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}
