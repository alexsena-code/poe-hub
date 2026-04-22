"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, Plus, Pencil, Trash2, Star, Info, X } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

// --- Types ---

interface CustomCost {
  id: string;
  name: string;
  amount: number;
  cadence: "daily" | "monthly" | "one_time";
  perBot: boolean;
}

interface CostConfig {
  id: string;
  name: string;
  isDefault: boolean;
  proxyCostPerBotMonthly: number;
  levelingCostPerBot: number;
  stashPackCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
  customCosts: CustomCost[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Schema ---

const customCostFormSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome obrigatório"),
  amount: z.number().min(0, "Valor mínimo 0"),
  cadence: z.enum(["daily", "monthly", "one_time"]),
  perBot: z.boolean(),
});

const costConfigSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  isDefault: z.boolean().optional(),
  proxyCostPerBotMonthly: z.number().min(0, "Valor minimo 0"),
  levelingCostPerBot: z.number().min(0, "Valor minimo 0"),
  stashPackCostPerBot: z.number().min(0, "Valor minimo 0"),
  expluginsKeyCostDaily: z.number().min(0, "Valor minimo 0"),
  dpbKeyCostDaily: z.number().min(0, "Valor minimo 0"),
  customCosts: z.array(customCostFormSchema).optional(),
  notes: z.string().optional(),
});

type CostConfigForm = z.infer<typeof costConfigSchema>;

// --- Cost field names that hold monetary values ---
const COST_FIELDS = [
  "proxyCostPerBotMonthly",
  "levelingCostPerBot",
  "stashPackCostPerBot",
  "expluginsKeyCostDaily",
  "dpbKeyCostDaily",
] as const;

type CostFieldName = (typeof COST_FIELDS)[number];

// --- Field with currency toggle ---

interface CostFieldProps {
  label: string;
  tooltip: string;
  id: string;
  register: ReturnType<typeof useForm<CostConfigForm>>["register"];
  fieldName: CostFieldName;
  error?: string;
  inputCurrency: "usd" | "brl";
  onToggleCurrency: () => void;
}

function CostField({ label, tooltip, id, register, fieldName, error, inputCurrency, onToggleCurrency }: CostFieldProps) {
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

// --- Main page ---

export default function CostConfigsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<CostConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CostConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { formatMoney, exchangeRate } = useCurrency();

  // Per-field input currency (user can type in $ or R$, stored always as $)
  const [fieldCurrencies, setFieldCurrencies] = useState<Record<CostFieldName, "usd" | "brl">>({
    proxyCostPerBotMonthly: "usd",
    levelingCostPerBot: "usd",
    stashPackCostPerBot: "usd",
    expluginsKeyCostDaily: "usd",
    dpbKeyCostDaily: "usd",
  });

  // Per-custom-cost currency (keyed by the custom cost id)
  const [customCurrencies, setCustomCurrencies] = useState<Record<string, "usd" | "brl">>({});

  function toggleFieldCurrency(field: CostFieldName) {
    setFieldCurrencies((prev) => ({
      ...prev,
      [field]: prev[field] === "usd" ? "brl" : "usd",
    }));
  }

  function resetFieldCurrencies() {
    setFieldCurrencies({
      proxyCostPerBotMonthly: "usd",
      levelingCostPerBot: "usd",
      stashPackCostPerBot: "usd",
      expluginsKeyCostDaily: "usd",
      dpbKeyCostDaily: "usd",
    });
  }

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CostConfigForm>({
    resolver: zodResolver(costConfigSchema),
    defaultValues: {
      name: "",
      isDefault: false,
      proxyCostPerBotMonthly: 0,
      levelingCostPerBot: 0,
      stashPackCostPerBot: 0,
      expluginsKeyCostDaily: 0,
      dpbKeyCostDaily: 0,
      customCosts: [],
      notes: "",
    },
  });

  const { fields: customFields, append: appendCustom, remove: removeCustom } = useFieldArray({
    control,
    name: "customCosts",
  });

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/cost-configs");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConfigs(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      toast.error("Erro ao carregar configuracoes de custo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  function openCreate() {
    setEditingConfig(null);
    resetFieldCurrencies();
    setCustomCurrencies({});
    reset({
      name: "",
      isDefault: false,
      proxyCostPerBotMonthly: 0,
      levelingCostPerBot: 0,
      stashPackCostPerBot: 0,
      expluginsKeyCostDaily: 0,
      dpbKeyCostDaily: 0,
      customCosts: [],
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(config: CostConfig) {
    setEditingConfig(config);
    resetFieldCurrencies();
    const customs = config.customCosts ?? [];
    setCustomCurrencies(Object.fromEntries(customs.map((c) => [c.id, "usd" as const])));
    reset({
      name: config.name,
      isDefault: config.isDefault,
      proxyCostPerBotMonthly: Number(config.proxyCostPerBotMonthly),
      levelingCostPerBot: Number(config.levelingCostPerBot),
      stashPackCostPerBot: Number(config.stashPackCostPerBot),
      expluginsKeyCostDaily: Number(config.expluginsKeyCostDaily),
      dpbKeyCostDaily: Number(config.dpbKeyCostDaily),
      customCosts: customs.map((c) => ({
        id: c.id,
        name: c.name,
        amount: Number(c.amount),
        cadence: c.cadence,
        perBot: c.perBot,
      })),
      notes: config.notes ?? "",
    });
    setDialogOpen(true);
  }

  function addCustomCost() {
    const newId = crypto.randomUUID();
    appendCustom({
      id: newId,
      name: "",
      amount: 0,
      cadence: "monthly",
      perBot: false,
    });
    setCustomCurrencies((prev) => ({ ...prev, [newId]: "usd" }));
  }

  function toggleCustomCurrency(id: string) {
    setCustomCurrencies((prev) => ({
      ...prev,
      [id]: (prev[id] ?? "usd") === "usd" ? "brl" : "usd",
    }));
  }

  async function onSubmit(data: CostConfigForm) {
    setSubmitting(true);
    try {
      // Convert any fields entered in BRL to USD before saving
      const payload = { ...data };
      for (const field of COST_FIELDS) {
        if (fieldCurrencies[field] === "brl" && exchangeRate > 0) {
          payload[field] = Number(((payload[field] as number) / exchangeRate).toFixed(4));
        }
      }
      payload.customCosts = (data.customCosts ?? []).map((cc) => {
        const curr = customCurrencies[cc.id] ?? "usd";
        const amount =
          curr === "brl" && exchangeRate > 0
            ? Number((cc.amount / exchangeRate).toFixed(4))
            : cc.amount;
        return { ...cc, amount };
      });

      const url = editingConfig
        ? `/api/cost-configs/${editingConfig.id}`
        : "/api/cost-configs";
      const method = editingConfig ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar");
      }

      toast.success(
        editingConfig
          ? "Configuracao atualizada"
          : "Configuracao criada"
      );
      setDialogOpen(false);
      fetchConfigs();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(config: CostConfig) {
    if (!confirm(`Deletar configuracao "${config.name}"?`)) return;

    try {
      const res = await fetch(`/api/cost-configs/${config.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Configuracao deletada");
      fetchConfigs();
    } catch {
      toast.error("Erro ao deletar configuracao");
    }
  }

  function cadenceLabel(c: CustomCost["cadence"]) {
    return c === "daily" ? "Diário" : c === "monthly" ? "Mensal" : "Único";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2"
            onClick={() => router.push("/settings")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Configuracoes
          </Button>
          <h1 className="text-3xl font-bold">Configuracoes de Custos</h1>
          <p className="text-muted-foreground">
            Gerencie os perfis de custo operacional usados nas simulacoes.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Configuracao
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Proxy/Bot (mensal)</TableHead>
              <TableHead className="text-right">Leveling/Bot (unico)</TableHead>
              <TableHead className="text-right">Stash Pack/Bot (unico)</TableHead>
              <TableHead className="text-right">Explugins Key (diario)</TableHead>
              <TableHead className="text-right">DPB Key (diario)</TableHead>
              <TableHead className="text-right">Customs</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : configs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  Nenhuma configuracao encontrada. Crie a primeira.
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {config.name}
                      {config.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Padrao
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(Number(config.proxyCostPerBotMonthly), "usd")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(Number(config.levelingCostPerBot), "usd")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(Number(config.stashPackCostPerBot), "usd")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(Number(config.expluginsKeyCostDaily), "usd")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(Number(config.dpbKeyCostDaily), "usd")}
                  </TableCell>
                  <TableCell className="text-right">
                    {config.customCosts && config.customCosts.length > 0 ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="font-mono cursor-help">
                              {config.customCosts.length}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <ul className="text-xs space-y-0.5">
                              {config.customCosts.map((c) => (
                                <li key={c.id}>
                                  {c.name}: {formatMoney(Number(c.amount), "usd")} / {cadenceLabel(c.cadence)}
                                  {c.perBot ? " · por bot" : " · global"}
                                </li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => openEdit(config)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Deletar"
                        onClick={() => handleDelete(config)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Editar Configuracao" : "Nova Configuracao"}
            </DialogTitle>
            <DialogDescription>
              Define os custos operacionais usados em simulacoes e projecoes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="config-name">Nome</Label>
              <Input
                id="config-name"
                placeholder='Ex: "Custos Padrao 2026"'
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
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
                onToggleCurrency={() => toggleFieldCurrency("proxyCostPerBotMonthly")}
              />
              <CostField
                label="Leveling/Bot (unico)"
                tooltip="Custo unico de leveling por bot (cobrado uma vez na criacao do bot)"
                id="levelingCost"
                register={register}
                fieldName="levelingCostPerBot"
                error={errors.levelingCostPerBot?.message}
                inputCurrency={fieldCurrencies.levelingCostPerBot}
                onToggleCurrency={() => toggleFieldCurrency("levelingCostPerBot")}
              />
              <CostField
                label="Stash Pack/Bot (unico)"
                tooltip="Custo unico do pack de stash por bot"
                id="stashPackCost"
                register={register}
                fieldName="stashPackCostPerBot"
                error={errors.stashPackCostPerBot?.message}
                inputCurrency={fieldCurrencies.stashPackCostPerBot}
                onToggleCurrency={() => toggleFieldCurrency("stashPackCostPerBot")}
              />
              <CostField
                label="Explugins Key (diario)"
                tooltip="Custo diario da chave Explugins"
                id="expluginsKeyCost"
                register={register}
                fieldName="expluginsKeyCostDaily"
                error={errors.expluginsKeyCostDaily?.message}
                inputCurrency={fieldCurrencies.expluginsKeyCostDaily}
                onToggleCurrency={() => toggleFieldCurrency("expluginsKeyCostDaily")}
              />
              <CostField
                label="DPB Key (diario)"
                tooltip="Custo diario da chave DPB"
                id="dpbKeyCost"
                register={register}
                fieldName="dpbKeyCostDaily"
                error={errors.dpbKeyCostDaily?.message}
                inputCurrency={fieldCurrencies.dpbKeyCostDaily}
                onToggleCurrency={() => toggleFieldCurrency("dpbKeyCostDaily")}
              />
            </div>

            {/* Custos adicionais */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Custos adicionais</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      VPS, eletricidade, licenças extras — qualquer custo além dos padrões acima.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addCustomCost}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {customFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    Nenhum custo adicional configurado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customFields.map((field, index) => {
                      const ccId = field.id;
                      const curr = customCurrencies[field.id] ?? "usd";
                      return (
                        <div
                          key={field.id}
                          className="grid grid-cols-[2fr_1.2fr_1.2fr_auto_auto] gap-2 items-start p-2 rounded-md border bg-muted/30"
                        >
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
                              onClick={() => toggleCustomCurrency(ccId)}
                              className="flex items-center justify-center px-2 rounded-l-md border border-r-0 border-input bg-muted text-sm font-mono font-medium hover:bg-muted/80 transition-colors min-w-[2.5rem]"
                              title="Alternar moeda"
                            >
                              {curr === "usd" ? "$" : "R$"}
                            </button>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="rounded-l-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                              {...register(`customCosts.${index}.amount`, {
                                valueAsNumber: true,
                              })}
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
                            onClick={() => removeCustom(index)}
                            title="Remover"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <input
                            type="hidden"
                            {...register(`customCosts.${index}.id`)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

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
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Salvando..."
                  : editingConfig
                    ? "Atualizar"
                    : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
