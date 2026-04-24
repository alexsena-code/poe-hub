import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "seo"
  | "neutral";

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
  // seo uses var() fallback because Tailwind v4 doesn't auto-generate /15 for
  // non-standard tokens — explicit arbitrary values keep it consistent.
  seo: "bg-[color-mix(in_srgb,var(--color-seo)_15%,transparent)] text-[var(--color-seo)] border-[color-mix(in_srgb,var(--color-seo)_30%,transparent)]",
  neutral: "bg-muted/40 text-muted-foreground border-border",
};

/**
 * Semantic status badge — replaces hardcoded `bg-{red,green,...}-{100..900}`
 * color maps scattered across modules. Uses CSS tokens from app/globals.css
 * so `--color-success` etc. can be tweaked globally without file edits.
 *
 * @example
 * <StatusBadge variant="success">accepted</StatusBadge>
 * <StatusBadge variant="danger">rejected</StatusBadge>
 *
 * Session 05 S05.b — design sweep wave 2.
 */
export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium border",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
