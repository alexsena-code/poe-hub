"use client";

/**
 * Autocomplete combobox for picking an OpenRouter model.
 *
 * Consumes the full catalog via `useOpenRouterModels`, renders each option
 * with price-per-1M tokens inline, and accepts free-form input for models
 * that might not be in the local cache yet (SWR revalidates on mount, but
 * the operator shouldn't be blocked waiting for a refresh).
 *
 * Selection posts the model id upstream (via `onChange`). The consuming
 * form wires this to `modelOverride` or `modelOverrides.write`.
 */

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useOpenRouterModels,
  type OpenRouterModelSummary,
} from "./use-openrouter-models";

interface ModelComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Add a clear button (renders a small 'x' to reset to empty). */
  clearable?: boolean;
  /** Accessible label for the trigger — used for aria. */
  ariaLabel?: string;
}

function formatPrice(n: number): string {
  if (n <= 0) return "—";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatContext(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function ModelCombobox({
  value,
  onChange,
  placeholder = "Selecionar model...",
  disabled,
  clearable = true,
  ariaLabel,
}: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const { models, isLoading, error } = useOpenRouterModels();

  const selected: OpenRouterModelSummary | undefined = React.useMemo(
    () => models.find((m) => m.id === value),
    [models, value],
  );

  const filtered = React.useMemo(() => {
    if (!query.trim()) return models.slice(0, 200);
    const q = query.toLowerCase();
    return models
      .filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      .slice(0, 200);
  }, [models, query]);

  // Let the operator confirm an id that isn't in the catalog (rare — newly
  // released models before the 1h cache refreshes). Only show when non-empty
  // and not already an exact match in the filtered set.
  const showCustomInputHint =
    query.trim().length > 0 && !models.some((m) => m.id === query.trim());

  function handleSelect(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {value ? (selected ? `${selected.name}` : value) : placeholder}
          </span>
          <span className="ml-2 flex items-center gap-1 text-muted-foreground">
            {clearable && value && (
              <span
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleClear(e as unknown as React.MouseEvent);
                }}
                role="button"
                tabIndex={0}
                aria-label="Limpar seleção"
                className="rounded-sm px-1 text-xs hover:bg-muted"
              >
                ×
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar modelo (ex: sonnet, kimi, gpt-4o)..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading && <div className="p-3 text-xs text-muted-foreground">Carregando catálogo...</div>}
            {error && (
              <div className="p-3 text-xs text-destructive">
                Falha ao carregar: {error.message}
              </div>
            )}
            {!isLoading && !error && (
              <>
                {showCustomInputHint && (
                  <CommandGroup heading="Entrada manual">
                    <CommandItem
                      value={`__custom__${query}`}
                      onSelect={() => handleSelect(query.trim())}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === query.trim() ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="font-mono text-xs">{query.trim()}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        usar slug como está
                      </span>
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                <CommandGroup heading={`${filtered.length} de ${models.length}`}>
                  {filtered.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => handleSelect(m.id)}
                      className="flex items-start gap-2"
                    >
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          value === m.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="font-mono truncate">{m.id}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[10px] text-muted-foreground">
                        <span>ctx {formatContext(m.contextLength)}</span>
                        <span>
                          in {formatPrice(m.inputPricePer1M)} · out {formatPrice(m.outputPricePer1M)}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
