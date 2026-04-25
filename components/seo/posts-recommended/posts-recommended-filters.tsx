"use client";

// Session 32 (Frontend B): filters bar for /seo/posts-recommended.
// URL-syncs game / suggestedAction (csv) / targetPosition / limit via
// router.replace({scroll:false}) so SSR re-runs without resetting scroll.
// suggestedAction is multi-select via Popover+Checkbox (engine endpoint
// doesn't filter natively; the page does it after fetch).

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ActionBadge } from "./action-badge";
import { SUGGESTED_ACTIONS } from "./types";
import type { GameFilter, SuggestedAction } from "./types";

interface PostsRecommendedFiltersProps {
  initialGame: GameFilter;
  initialActions: SuggestedAction[];
  initialTargetPosition: number;
  initialLimit: number;
  targetRange: { min: number; max: number };
  limitRange: { min: number; max: number };
}

function clamp(n: number, range: { min: number; max: number }) {
  return Math.max(range.min, Math.min(range.max, n));
}

interface FiltersState {
  game: GameFilter;
  actions: SuggestedAction[];
  targetPosition: number;
  limit: number;
}

function buildParams(state: FiltersState): URLSearchParams {
  const params = new URLSearchParams({
    game: state.game,
    targetPosition: String(state.targetPosition),
    limit: String(state.limit),
  });
  if (state.actions.length > 0) {
    params.set("suggestedAction", state.actions.join(","));
  }
  return params;
}

export function PostsRecommendedFilters({
  initialGame,
  initialActions,
  initialTargetPosition,
  initialLimit,
  targetRange,
  limitRange,
}: PostsRecommendedFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [game, setGame] = useState<GameFilter>(initialGame);
  const [actions, setActions] = useState<SuggestedAction[]>(initialActions);
  const [targetPosition, setTargetPosition] = useState(initialTargetPosition);
  const [limit, setLimit] = useState(initialLimit);

  function pushFilters(next: FiltersState) {
    const params = buildParams(next);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function onGameChange(value: GameFilter) {
    setGame(value);
    pushFilters({ game: value, actions, targetPosition, limit });
  }

  function toggleAction(action: SuggestedAction) {
    const next = actions.includes(action)
      ? actions.filter((a) => a !== action)
      : [...actions, action];
    setActions(next);
    pushFilters({ game, actions: next, targetPosition, limit });
  }

  function clearActions() {
    setActions([]);
    pushFilters({ game, actions: [], targetPosition, limit });
  }

  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className="min-w-[140px]">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Game
        </Label>
        <div className="mt-2">
          <Select value={game} onValueChange={(v) => onGameChange(v as GameFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="poe1">poe1</SelectItem>
              <SelectItem value="poe2">poe2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-w-[200px]">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Action
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 min-w-[200px] justify-between text-xs font-normal"
            >
              <span className="truncate">
                {actions.length === 0
                  ? "Todas"
                  : `${actions.length} selecionada${actions.length === 1 ? "" : "s"}`}
              </span>
              <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              {SUGGESTED_ACTIONS.map((a) => (
                <label
                  key={a}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={actions.includes(a)}
                    onCheckedChange={() => toggleAction(a)}
                  />
                  <ActionBadge action={a} />
                </label>
              ))}
            </div>
            {actions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-muted-foreground"
                onClick={clearActions}
              >
                Limpar (mostrar todas)
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="min-w-[220px]">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Target position:{" "}
          <span className="text-foreground">{targetPosition}</span>
        </Label>
        <Slider
          className="mt-2"
          min={targetRange.min}
          max={targetRange.max}
          step={1}
          value={[targetPosition]}
          onValueChange={(values) =>
            setTargetPosition(values[0] ?? targetPosition)
          }
          onValueCommit={(values) =>
            pushFilters({
              game,
              actions,
              targetPosition: values[0] ?? targetPosition,
              limit,
            })
          }
        />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Limit
        </Label>
        <Input
          type="number"
          min={limitRange.min}
          max={limitRange.max}
          value={limit}
          className="mt-2 w-24"
          onChange={(e) => {
            const next = clamp(
              Number.parseInt(e.target.value, 10) || limitRange.min,
              limitRange,
            );
            setLimit(next);
          }}
          onBlur={() => pushFilters({ game, actions, targetPosition, limit })}
        />
      </div>

      {isPending && (
        <span className="text-xs text-muted-foreground">atualizando…</span>
      )}
    </div>
  );
}
