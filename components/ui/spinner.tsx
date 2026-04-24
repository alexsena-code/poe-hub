import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
}

/**
 * Loading spinner — replaces the duplicated `<svg className="animate-spin">`
 * pattern scattered across 15+ files. Uses currentColor so it inherits from
 * the enclosing button/link.
 *
 * Session 03 design sweep.
 */
export function Spinner({ size = "sm", className, ariaLabel = "Carregando" }: SpinnerProps) {
  const sizeClass = {
    xs: "h-3 w-3",
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }[size];

  return (
    <svg
      className={cn("animate-spin", sizeClass, className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-label={ariaLabel}
      role="status"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
