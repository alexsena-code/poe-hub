"use client";

// CostField — labeled numeric input with a clickable currency prefix button.
// The button toggles between $ (USD) and R$ (BRL) so the operator can enter
// values in either currency; the parent converts to USD before saving.

import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { CostConfigForm } from "./schema";
import { CostFieldName } from "./types";

interface CostFieldProps {
  label: string;
  tooltip: string;
  id: string;
  /** react-hook-form register bound to a CostConfigForm instance */
  register: ReturnType<typeof useForm<CostConfigForm>>["register"];
  fieldName: CostFieldName;
  error?: string;
  inputCurrency: "usd" | "brl";
  onToggleCurrency: () => void;
}

export function CostField({
  label,
  tooltip,
  id,
  register,
  fieldName,
  error,
  inputCurrency,
  onToggleCurrency,
}: CostFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex">
        <button
          type="button"
          onClick={onToggleCurrency}
          className="flex items-center justify-center px-2.5 rounded-l-md border border-r-0 border-input bg-muted text-sm font-mono font-medium hover:bg-muted/80 transition-colors min-w-[3rem]"
          title="Clique para alternar moeda"
        >
          {inputCurrency === "usd" ? "$" : "R$"}
        </button>
        <Input
          id={id}
          type="number"
          step="0.01"
          min="0"
          className="rounded-l-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
          {...register(fieldName, { valueAsNumber: true })}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
