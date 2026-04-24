"use client";

import { cn } from "@/lib/utils";

interface DeltaProps {
  a: number;
  b: number;
  formatFn: (v: number) => string;
  positiveIsGood?: boolean;
}

/** Renders a colored delta badge (b − a) with percentage annotation. */
export function Delta({ a, b, formatFn, positiveIsGood = true }: DeltaProps) {
  const delta = b - a;
  const pct = a !== 0 ? (delta / Math.abs(a)) * 100 : 0;
  const isPositive = delta > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const isZero = Math.abs(delta) < 0.001;

  if (isZero) {
    return <span className="text-muted-foreground font-mono tabular-nums">—</span>;
  }

  return (
    <span
      className={cn(
        "font-mono tabular-nums text-sm",
        isGood ? "text-green-500" : "text-destructive"
      )}
    >
      {isPositive ? "+" : ""}
      {formatFn(delta)}
      {a !== 0 && (
        <span className="ml-1 text-xs opacity-80">
          ({isPositive ? "+" : ""}
          {pct.toFixed(1)}%)
        </span>
      )}
    </span>
  );
}
