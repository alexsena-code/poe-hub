import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared page header — replaces the repeated `<h1 className="text-2xl
 * font-bold"><p className="text-sm text-muted-foreground">` pattern
 * scattered across 40+ pages. Centralizing it lets us tweak typography
 * globally (e.g., Phase 2 typography scale) without a page-by-page sweep.
 *
 * Session 01 style proposal A.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
