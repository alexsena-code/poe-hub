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

// --- Types ---

interface CostConfig {
  id: string;
  name: string;
  isDefault: boolean;
  proxyCostPerBotMonthly: number;
  vpsCostMonthly: number;
  dpbLicenseCostMonthly: number;
  otherFixedCostsMonthly: number;
  otherVariableCostPerBot: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Schema ---

const costConfigSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  isDefault: z.boolean().optional(),
  proxyCostPerBotMonthly: z.number().min(0, "Valor minimo 0"),
  vpsCostMonthly: z.number().min(0, "Valor minimo 0"),
  dpbLicenseCostMonthly: z.number().min(0, "Valor minimo 0"),
  otherFixedCostsMonthly: z.number().min(0, "Valor minimo 0"),
  otherVariableCostPerBot: z.number().min(0, "Valor minimo 0"),
  notes: z.string().optional(),
});

type CostConfigForm = z.infer<typeof costConfigSchema>;

// --- Helpers ---

function fmtCurrency(val: number): string {
  return `$${Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// --- Field with tooltip ---

interface CostFieldProps {
  label: string;
  tooltip: string;
  id: string;
  register: ReturnType<typeof useForm<CostConfigForm>>["register"];
  fieldName: keyof CostConfigForm;
  error?: string;
}

function CostField({ label, tooltip, id, register, fieldName, error }: CostFieldProps) {
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
      <Input
        id={id}
        type="number"
        step="0.01"
        min="0"
        {...register(fieldName, { valueAsNumber: true })}
      />
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
      vpsCostMonthly: 0,
      dpbLicenseCostMonthly: 0,
      otherFixedCostsMonthly: 0,
      otherVariableCostPerBot: 0,
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
    reset({
      name: "",
      isDefault: false,
      proxyCostPerBotMonthly: 0,
      vpsCostMonthly: 0,
      dpbLicenseCostMonthly: 0,
      otherFixedCostsMonthly: 0,
      otherVariableCostPerBot: 0,
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(config: CostConfig) {
    setEditingConfig(config);
    reset({
      name: config.name,
      isDefault: config.isDefault,
      proxyCostPerBotMonthly: Number(config.proxyCostPerBotMonthly),
      vpsCostMonthly: Number(config.vpsCostMonthly),
      dpbLicenseCostMonthly: Number(config.dpbLicenseCostMonthly),
      otherFixedCostsMonthly: Number(config.otherFixedCostsMonthly),
      otherVariableCostPerBot: Number(config.otherVariableCostPerBot),
      notes: config.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: CostConfigForm) {
    setSubmitting(true);
    try {
      const url = editingConfig
        ? `/api/cost-configs/${editingConfig.id}`
        : "/api/cost-configs";
      const method = editingConfig ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
              <TableHead className="text-right">VPS (mensal)</TableHead>
              <TableHead className="text-right">Licenca DPB (mensal)</TableHead>
              <TableHead className="text-right">Outros Fixos (mensal)</TableHead>
              <TableHead className="text-right">Var./Bot (mensal)</TableHead>
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
                    {fmtCurrency(Number(config.proxyCostPerBotMonthly))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(Number(config.vpsCostMonthly))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(Number(config.dpbLicenseCostMonthly))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(Number(config.otherFixedCostsMonthly))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCurrency(Number(config.otherVariableCostPerBot))}
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
              Define os custos operacionais mensais para simulacoes.
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
                label="Proxy/Bot"
                tooltip="Custo mensal de proxy por bot ativo"
                id="proxyCost"
                register={register}
                fieldName="proxyCostPerBotMonthly"
                error={errors.proxyCostPerBotMonthly?.message}
              />
              <CostField
                label="VPS"
                tooltip="Custo mensal de VPS (servidor virtual)"
                id="vpsCost"
                register={register}
                fieldName="vpsCostMonthly"
                error={errors.vpsCostMonthly?.message}
              />
              <CostField
                label="Licenca DPB"
                tooltip="Custo mensal de licenca DPB"
                id="dpbCost"
                register={register}
                fieldName="dpbLicenseCostMonthly"
                error={errors.dpbLicenseCostMonthly?.message}
              />
              <CostField
                label="Outros Fixos"
                tooltip="Outros custos fixos mensais (energia, internet, etc.)"
                id="otherFixed"
                register={register}
                fieldName="otherFixedCostsMonthly"
                error={errors.otherFixedCostsMonthly?.message}
              />
              <CostField
                label="Variavel/Bot"
                tooltip="Custo variavel mensal por bot (alem do proxy)"
                id="otherVariable"
                register={register}
                fieldName="otherVariableCostPerBot"
                error={errors.otherVariableCostPerBot?.message}
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
