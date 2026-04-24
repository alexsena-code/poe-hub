import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Session 01 S01.f: moved from hardcoded tailwind color classes
// (bg-green-900 / bg-red-900 / etc) to theme-driven semantic tokens
// declared in globals.css (--color-success, --color-warning,
// --color-destructive, --color-muted). Keeps a `data-status` attribute
// so tests + CSS debugging can branch on the logical status without
// depending on tailwind color names.
const statusConfig = {
  active: { label: "Ativo", className: "bg-success/20 text-success hover:bg-success/30" },
  inactive: { label: "Inativo", className: "bg-muted text-muted-foreground hover:bg-muted/80" },
  banned: { label: "Banido", className: "bg-destructive/20 text-destructive hover:bg-destructive/30" },
  maintenance: { label: "Manutenção", className: "bg-warning/20 text-warning hover:bg-warning/30" },
};

export function BotStatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status];
  return (
    <Badge variant="secondary" data-status={status} className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
