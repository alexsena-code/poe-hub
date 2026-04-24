"use client";

// CustomCostsFieldArray — Card section with a useFieldArray-driven list of
// additional costs (VPS, electricity, extra licenses, etc.).
// Receives field/append/remove from the parent Dialog so a single useForm
// instance controls the whole form.

import { UseFormRegister, FieldErrors, UseFieldArrayReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { CostConfigForm } from "./schema";

interface CustomCostsFieldArrayProps {
  fields: UseFieldArrayReturn<CostConfigForm, "customCosts">["fields"];
  register: UseFormRegister<CostConfigForm>;
  errors: FieldErrors<CostConfigForm>;
  customCurrencies: Record<string, "usd" | "brl">;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onToggleCurrency: (id: string) => void;
}

export function CustomCostsFieldArray({
  fields,
  register,
  errors,
  customCurrencies,
  onAdd,
  onRemove,
  onToggleCurrency,
}: CustomCostsFieldArrayProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Custos adicionais</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              VPS, eletricidade, licenças extras — qualquer custo além dos padrões acima.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            Nenhum custo adicional configurado.
          </p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <CustomCostRow
                key={field.id}
                field={field}
                index={index}
                register={register}
                errors={errors}
                currency={customCurrencies[field.id] ?? "usd"}
                onToggleCurrency={() => onToggleCurrency(field.id)}
                onRemove={() => onRemove(index)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- row sub-component ---

interface RowProps {
  field: { id: string };
  index: number;
  register: UseFormRegister<CostConfigForm>;
  errors: FieldErrors<CostConfigForm>;
  currency: "usd" | "brl";
  onToggleCurrency: () => void;
  onRemove: () => void;
}

function CustomCostRow({ field, index, register, errors, currency, onToggleCurrency, onRemove }: RowProps) {
  return (
    <div className="grid grid-cols-[2fr_1.2fr_1.2fr_auto_auto] gap-2 items-start p-2 rounded-md border bg-muted/30">
      <div>
        <Input
          placeholder="Nome (ex: VPS)"
          {...register(`customCosts.${index}.name`)}
        />
        {errors.customCosts?.[index]?.name && (
          <p className="text-xs text-destructive mt-0.5">
            {errors.customCosts[index]?.name?.message}
          </p>
        )}
      </div>
      <div className="flex">
        <button
          type="button"
          onClick={onToggleCurrency}
          className="flex items-center justify-center px-2 rounded-l-md border border-r-0 border-input bg-muted text-sm font-mono font-medium hover:bg-muted/80 transition-colors min-w-[2.5rem]"
          title="Alternar moeda"
        >
          {currency === "usd" ? "$" : "R$"}
        </button>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          className="rounded-l-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
          {...register(`customCosts.${index}.amount`, { valueAsNumber: true })}
        />
      </div>
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        {...register(`customCosts.${index}.cadence`)}
      >
        <option value="daily">Diário</option>
        <option value="monthly">Mensal</option>
        <option value="one_time">Único</option>
      </select>
      <label className="flex items-center gap-1.5 text-xs whitespace-nowrap pt-2">
        <input
          type="checkbox"
          className="rounded border-border"
          {...register(`customCosts.${index}.perBot`)}
        />
        Por bot
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-destructive"
        onClick={onRemove}
        title="Remover"
      >
        <X className="h-4 w-4" />
      </Button>
      <input type="hidden" {...register(`customCosts.${index}.id`)} />
    </div>
  );
}
