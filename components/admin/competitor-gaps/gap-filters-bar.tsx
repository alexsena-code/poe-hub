"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GapFiltersBarProps {
  initialMinComp: number;
  initialLimit: number;
  initialOnlyUncovered: boolean;
  minRange: { min: number; max: number };
  limitRange: { min: number; max: number };
}

function clamp(n: number, range: { min: number; max: number }) {
  return Math.max(range.min, Math.min(range.max, n));
}

export function GapFiltersBar({
  initialMinComp,
  initialLimit,
  initialOnlyUncovered,
  minRange,
  limitRange,
}: GapFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [minComp, setMinComp] = useState(initialMinComp);
  const [limit, setLimit] = useState(initialLimit);
  const [onlyUncovered, setOnlyUncovered] = useState(initialOnlyUncovered);

  function pushFilters(next: { minComp: number; limit: number; onlyUncovered: boolean }) {
    const params = new URLSearchParams({
      minCompetitors: String(next.minComp),
      limit: String(next.limit),
      onlyUncovered: String(next.onlyUncovered),
    });
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className="min-w-[220px]">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Min. competidores: <span className="text-foreground">{minComp}</span>
        </Label>
        <Slider
          className="mt-2"
          min={minRange.min}
          max={minRange.max}
          step={1}
          value={[minComp]}
          onValueChange={(values) => setMinComp(values[0] ?? minComp)}
          onValueCommit={(values) =>
            pushFilters({ minComp: values[0] ?? minComp, limit, onlyUncovered })
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="only-uncovered"
          checked={onlyUncovered}
          onCheckedChange={(checked) => {
            setOnlyUncovered(checked);
            pushFilters({ minComp, limit, onlyUncovered: checked });
          }}
        />
        <Label htmlFor="only-uncovered" className="text-sm">
          Apenas uncovered
        </Label>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Limit</Label>
        <Input
          type="number"
          min={limitRange.min}
          max={limitRange.max}
          value={limit}
          className="mt-2 w-24"
          onChange={(e) => {
            const next = clamp(Number.parseInt(e.target.value, 10) || limitRange.min, limitRange);
            setLimit(next);
          }}
          onBlur={() => pushFilters({ minComp, limit, onlyUncovered })}
        />
      </div>

      {isPending && (
        <span className="text-xs text-muted-foreground">atualizando…</span>
      )}
    </div>
  );
}
