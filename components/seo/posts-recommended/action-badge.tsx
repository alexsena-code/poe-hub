// Session 32 (Frontend B): pure-render badge for `suggestedAction`.
// Color map matches the spec in docs/progress/session-32.md (Frente 1 B).
// Tailwind classes follow the established `bg-<color>-500/15 text-<color>-300`
// pattern used by GapsTable for consistency across SEO surfaces.

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SuggestedAction } from "./types";

interface ActionBadgeProps {
  action: SuggestedAction;
  className?: string;
}

const ACTION_LABELS: Record<SuggestedAction, string> = {
  attack_now: "attack now",
  optimize_existing: "optimize existing",
  community_demand: "community demand",
  monitor: "monitor",
  defer: "defer",
  drop: "drop",
};

const ACTION_STYLES: Record<SuggestedAction, string> = {
  attack_now: "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
  optimize_existing: "bg-blue-500/15 text-blue-300 hover:bg-blue-500/25",
  community_demand: "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25",
  monitor: "bg-slate-500/15 text-slate-300 hover:bg-slate-500/25",
  defer: "bg-gray-500/15 text-gray-300 hover:bg-gray-500/25",
  drop: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
};

export function ActionBadge({ action, className }: ActionBadgeProps) {
  return (
    <Badge className={cn(ACTION_STYLES[action], "font-mono text-xs", className)}>
      {ACTION_LABELS[action]}
    </Badge>
  );
}
