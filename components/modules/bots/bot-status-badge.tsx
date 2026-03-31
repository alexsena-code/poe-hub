import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  active: { label: "Ativo", className: "bg-green-900 text-green-300 hover:bg-green-800" },
  inactive: { label: "Inativo", className: "bg-zinc-700 text-zinc-300 hover:bg-zinc-600" },
  banned: { label: "Banido", className: "bg-red-900 text-red-300 hover:bg-red-800" },
  maintenance: { label: "Manutenção", className: "bg-yellow-900 text-yellow-300 hover:bg-yellow-800" },
};

export function BotStatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status];
  return (
    <Badge variant="secondary" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
