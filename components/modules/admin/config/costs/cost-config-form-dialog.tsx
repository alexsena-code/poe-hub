"use client";

// CostConfigFormDialog — create/edit dialog for a cost config.
// Receives all state and handlers from useCostsState via the page orchestrator.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseFormReturn, UseFieldArrayReturn } from "react-hook-form";
import { CostConfigForm } from "./schema";
import { CostConfig, CostFieldName, FieldCurrencies } from "./types";
import { CostField } from "./cost-field";
import { CustomCostsFieldArray } from "./custom-costs-field-array";

interface CostConfigFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingConfig: CostConfig | null;
  submitting: boolean;
  formMethods: UseFormReturn<CostConfigForm>;
  customFields: UseFieldArrayReturn<CostConfigForm, "customCosts">["fields"];
  fieldCurrencies: FieldCurrencies;
  customCurrencies: Record<string, "usd" | "brl">;
  onSubmit: (e: React.FormEvent) => void;
  onAddCustomCost: () => void;
  onRemoveCustom: (index: number) => void;
  onToggleFieldCurrency: (field: CostFieldName) => void;
  onToggleCustomCurrency: (id: string) => void;
}

export function CostConfigFormDialog({
  open,
  onOpenChange,
  editingConfig,
  submitting,
  formMethods,
  customFields,
  fieldCurrencies,
  customCurrencies,
  onSubmit,
  onAddCustomCost,
  onRemoveCustom,
  onToggleFieldCurrency,
  onToggleCustomCurrency,
}: CostConfigFormDialogProps) {
  const { register, formState: { errors } } = formMethods;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? "Editar Configuracao" : "Nova Configuracao"}
          </DialogTitle>
          <DialogDescription>
            Define os custos operacionais usados em simulacoes e projecoes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="config-name">Nome</Label>
            <Input
              id="config-name"
              placeholder='Ex: "Custos Padrao 2026"'
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CostField
              label="Proxy/Bot (mensal)"
              tooltip="Custo mensal de proxy por bot ativo"
              id="proxyCost"
              register={register}
              fieldName="proxyCostPerBotMonthly"
              error={errors.proxyCostPerBotMonthly?.message}
              inputCurrency={fieldCurrencies.proxyCostPerBotMonthly}
              onToggleCurrency={() => onToggleFieldCurrency("proxyCostPerBotMonthly")}
            />
            <CostField
              label="Leveling/Bot (unico)"
              tooltip="Custo unico de leveling por bot (cobrado uma vez na criacao do bot)"
              id="levelingCost"
              register={register}
              fieldName="levelingCostPerBot"
              error={errors.levelingCostPerBot?.message}
              inputCurrency={fieldCurrencies.levelingCostPerBot}
              onToggleCurrency={() => onToggleFieldCurrency("levelingCostPerBot")}
            />
            <CostField
              label="Stash Pack/Bot (unico)"
              tooltip="Custo unico do pack de stash por bot"
              id="stashPackCost"
              register={register}
              fieldName="stashPackCostPerBot"
              error={errors.stashPackCostPerBot?.message}
              inputCurrency={fieldCurrencies.stashPackCostPerBot}
              onToggleCurrency={() => onToggleFieldCurrency("stashPackCostPerBot")}
            />
            <CostField
              label="Explugins Key (diario)"
              tooltip="Custo diario da chave Explugins"
              id="expluginsKeyCost"
              register={register}
              fieldName="expluginsKeyCostDaily"
              error={errors.expluginsKeyCostDaily?.message}
              inputCurrency={fieldCurrencies.expluginsKeyCostDaily}
              onToggleCurrency={() => onToggleFieldCurrency("expluginsKeyCostDaily")}
            />
            <CostField
              label="DPB Key (diario)"
              tooltip="Custo diario da chave DPB"
              id="dpbKeyCost"
              register={register}
              fieldName="dpbKeyCostDaily"
              error={errors.dpbKeyCostDaily?.message}
              inputCurrency={fieldCurrencies.dpbKeyCostDaily}
              onToggleCurrency={() => onToggleFieldCurrency("dpbKeyCostDaily")}
            />
          </div>

          <CustomCostsFieldArray
            fields={customFields}
            register={register}
            errors={errors}
            customCurrencies={customCurrencies}
            onAdd={onAddCustomCost}
            onRemove={onRemoveCustom}
            onToggleCurrency={onToggleCustomCurrency}
          />

          <div className="space-y-1.5">
            <Label htmlFor="config-notes">Notas (opcional)</Label>
            <Input
              id="config-notes"
              placeholder="Observacoes sobre esta configuracao"
              {...register("notes")}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              className="rounded border-border"
              {...register("isDefault")}
            />
            <Label htmlFor="isDefault" className="text-sm">
              Marcar como configuracao padrao
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : editingConfig ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
