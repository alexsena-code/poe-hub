import { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /**
   * Optional domain accent colour — a CSS custom property reference or any
   * valid CSS colour string (e.g. "var(--color-seo)"). When present, draws a
   * 2px left border and tints the title with that colour so domain-specific
   * pages get a visual identity without separate header variants.
   *
   * Used by the /seo/* routes to render the emerald SEO accent (S02.a).
   */
  accent?: string;
}

/**
 * Shared page header — replaces the repeated `<h1 className="text-2xl
 * font-bold"><p className="text-sm text-muted-foreground">` pattern
 * scattered across 40+ pages. Centralizing it lets us tweak typography
 * globally (e.g., Phase 2 typography scale) without a page-by-page sweep.
 *
 * Session 01 style proposal A. accent prop added in S02.a.
 */
export function PageHeader({ title, description, actions, className, accent }: PageHeaderProps) {
  const wrapperStyle: CSSProperties = accent ? { borderLeftColor: accent } : {};
  const titleStyle: CSSProperties = accent ? { color: accent } : {};

  return (
    <div
      className={cn(
        "flex flex-col gap-2 md:flex-row md:items-start md:justify-between",
        accent && "border-l-2 pl-4",
        className,
      )}
      style={wrapperStyle}
    >
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-foreground"
          style={titleStyle}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
