"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, GitCompareArrows } from "lucide-react";
import { useLeagues } from "@/hooks/use-leagues";

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  league: z.string().optional(),
  durationWeeks: z.number().int().min(1).max(52).optional(),
  notes: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

interface SimOption {
  id: string;
  name: string;
  league: string;
}

export function SimulationCreateDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [baseSimId, setBaseSimId] = useState<string>("");
  const [simOptions, setSimOptions] = useState<SimOption[]>([]);
  const router = useRouter();
  const { leagues, loading: leaguesLoading } = useLeagues();

  // Fetch existing simulations for "Baseado em"
  useEffect(() => {
    if (!open) return;
    fetch("/api/simulations?limit=50")
      .then((r) => r.json())
      .then((d) => setSimOptions((d.data ?? []).map((s: SimOption) => ({ id: s.id, name: s.name, league: s.league }))))
      .catch(() => {});
  }, [open]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      league: "",
      durationWeeks: 4,
      notes: "",
    },
  });

  async function onSubmit(data: CreateForm) {
    setSubmitting(true);
    try {
      if (baseSimId) {
        // Duplicate the base simulation and rename
        const dupRes = await fetch(`/api/simulations/${baseSimId}/duplicate`, { method: "POST" });
        if (!dupRes.ok) throw new Error("Erro ao duplicar simulacao base");
        const dup = await dupRes.json();

        // Update the duplicate with the new name
        await fetch(`/api/simulations/${dup.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.name }),
        });

        toast.success("Simulacao criada a partir de base");
        setOpen(false);
        reset();
        setBaseSimId("");
        router.push(`/simulations/compare?ids=${baseSimId},${dup.id}`);
      } else {
        const res = await fetch("/api/simulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao criar simulacao");
        }
        const sim = await res.json();
        toast.success("Simulacao criada com sucesso");
        setOpen(false);
        reset();
        router.push(`/simulations/${sim.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar simulacao");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Simulacao
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Simulacao</DialogTitle>
          <DialogDescription>
            Crie uma simulacao de faturamento para uma liga.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder='Ex: "Liga 3.26 - Cenario Otimista"'
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {!baseSimId && (
            <>
              <div className="space-y-2">
                <Label htmlFor="league">Liga</Label>
                <Select
                  onValueChange={(val) => setValue("league", val)}
                  disabled={leaguesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar liga" />
                  </SelectTrigger>
                  <SelectContent>
                    {leagues.map((l) => (
                      <SelectItem key={l.id} value={l.name}>
                        {l.name} {l.isCurrent ? "(atual)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.league && (
                  <p className="text-sm text-destructive">{errors.league.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="durationWeeks">Duracao (semanas)</Label>
                <Input
                  id="durationWeeks"
                  type="number"
                  min={1}
                  max={52}
                  {...register("durationWeeks", { valueAsNumber: true })}
                />
                {errors.durationWeeks && (
                  <p className="text-sm text-destructive">{errors.durationWeeks.message}</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Baseado em (opcional)</Label>
            <Select value={baseSimId} onValueChange={(val) => {
              setBaseSimId(val === "none" ? "" : val);
              // Auto-fill league from base simulation
              if (val && val !== "none") {
                const base = simOptions.find((s) => s.id === val);
                if (base) setValue("league", base.league);
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Criar do zero" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Criar do zero</SelectItem>
                {simOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {baseSimId && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <GitCompareArrows className="h-3 w-3" />
                Vai duplicar e abrir comparacao lado a lado
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input
              id="notes"
              placeholder="Observacoes sobre esta simulacao"
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Criando..." : "Criar Simulacao"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
