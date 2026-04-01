"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { ArrowLeft, Plus, Pencil, Trash2, Star, Info } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

// --- Types ---

interface CostConfig {
  id: string;
  name: string;
  isDefault: boolean;
  proxyCostPerBotMonthly: number;
  levelingCostPerBot: number;
  stashPackCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Schema ---

const costConfigSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  isDefault: z.boolean().optional(),
  proxyCostPerBotMonthly: z.number().min(0, "Valor minimo 0"),
  levelingCostPerBot: z.number().min(0, "Valor minimo 0"),
  stashPackCostPerBot: z.number().min(0, "Valor minimo 0"),
  expluginsKeyCostDaily: z.number().min(0, "Valor minimo 0"),
  dpbKeyCostDaily: z.number().min(0, "Valor minimo 0"),
  notes: z.string().optional(),
});

type CostConfigForm = z.infer<typeof costConfigSchema>;

// --- Helpers ---

// fmtCurrency removed — use formatMoney from useCurrency hook instead

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
    setValue,
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
      notes: "",
    },
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
    reset({
      name: "",
      isDefault: false,
      proxyCostPerBotMonthly: 0,
      levelingCostPerBot: 0,
      stashPackCostPerBot: 0,
      expluginsKeyCostDaily: 0,
      dpbKeyCostDaily: 0,
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(config: CostConfig) {
    setEditingConfig(config);
    resetFieldCurrencies();
    reset({
      name: config.name,
      isDefault: config.isDefault,
      proxyCostPerBotMonthly: Number(config.proxyCostPerBotMonthly),
      levelingCostPerBot: Number(config.levelingCostPerBot),
      stashPackCostPerBot: Number(config.stashPackCostPerBot),
      expluginsKeyCostDaily: Number(config.expluginsKeyCostDaily),
      dpbKeyCostDaily: Number(config.dpbKeyCostDaily),
      notes: config.notes ?? "",
    });
    setDialogOpen(true);
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
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : configs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Editar Configuracao" : "Nova Configuracao"}
            </DialogTitle>
            <DialogDescription>
              Define os custos operacionais diarios para simulacoes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
