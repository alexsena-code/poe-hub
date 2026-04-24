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
import { TrendingUp } from "lucide-react";
import { useLeagues } from "@/hooks/use-leagues";

const projectionSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  league: z.string().min(1, "Liga obrigatoria"),
  durationWeeks: z.number().int().min(1).max(52),
  startDay: z.number().int().min(1),
  priceSource: z.enum(["median", "cnl"]),
  defaultActiveBots: z.number().int().min(1),
  defaultDivinePerHour: z.number().min(0),
  defaultHoursPerDay: z.number().min(0).max(24),
});

type ProjectionForm = z.infer<typeof projectionSchema>;

export function SimulationProjectionDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const router = useRouter();
  const { leagues, loading: leaguesLoading } = useLeagues();

  // Pre-select the last 3 leagues with a startDate (most recent first)
  useEffect(() => {
    if (!open) return;
    const withDate = leagues
      .filter((l) => l.startDate !== null)
      .sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateB - dateA;
      });
    const top3 = withDate.slice(0, 3).map((l) => l.name);
    setSelectedSources(top3);
  }, [open, leagues]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProjectionForm>({
    resolver: zodResolver(projectionSchema),
    defaultValues: {
      name: "",
      league: "",
      durationWeeks: 5,
      startDay: 1,
      priceSource: "median",
      defaultActiveBots: 1,
      defaultDivinePerHour: 0.5,
      defaultHoursPerDay: 24,
    },
  });

  function toggleSource(name: string) {
    setSelectedSources((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  }

  async function onSubmit(data: ProjectionForm) {
    if (selectedSources.length === 0) {
      toast.error("Selecione ao menos uma liga de referencia");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: data.name,
        league: data.league,
        durationWeeks: data.durationWeeks,
        startDayOffset: data.startDay - 1,
        leagueSources: selectedSources,
        priceSource: data.priceSource,
        defaultActiveBots: data.defaultActiveBots,
        defaultDivinePerHour: data.defaultDivinePerHour,
        defaultHoursPerDay: data.defaultHoursPerDay,
      };

      const res = await fetch("/api/simulations/create-projected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar projecoes");
      }

      const result = await res.json();
      toast.success("3 cenarios criados com sucesso");
      setOpen(false);
      reset();
      setSelectedSources([]);
      router.push(`/farm/simulations/compare?ids=${result.ids.join(",")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar projecoes");
    } finally {
      setSubmitting(false);
    }
  }

  // Leagues eligible as reference sources (those with a startDate)
  const sourceLeagues = leagues.filter((l) => l.startDate !== null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <TrendingUp className="mr-2 h-4 w-4" />
          Projecao
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Projecao por Ligas Historicas</DialogTitle>
          <DialogDescription>
            Cria 3 simulacoes (Otimista / Esperado / Pessimista) usando precos
            historicos de ligas anteriores.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome base */}
          <div className="space-y-2">
            <Label htmlFor="proj-name">Nome base</Label>
            <Input
              id="proj-name"
              placeholder='Ex: "Projecao Mirage"'
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Liga alvo */}
          <div className="space-y-2">
            <Label htmlFor="proj-league">Liga</Label>
            <Input
              id="proj-league"
              placeholder='Ex: "3.29", "Proxima Liga"'
              {...register("league")}
            />
            <p className="text-xs text-muted-foreground">Nome da liga futura (apenas um label)</p>
            {errors.league && (
              <p className="text-sm text-destructive">{errors.league.message}</p>
            )}
          </div>

          {/* Duracao + Dia inicial */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proj-duration">Duracao (semanas)</Label>
              <Input
                id="proj-duration"
                type="number"
                min={1}
                max={52}
                {...register("durationWeeks", { valueAsNumber: true })}
              />
              {errors.durationWeeks && (
                <p className="text-sm text-destructive">
                  {errors.durationWeeks.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-startday">Dia inicial</Label>
              <Input
                id="proj-startday"
                type="number"
                min={1}
                {...register("startDay", { valueAsNumber: true })}
              />
              {errors.startDay && (
                <p className="text-sm text-destructive">
                  {errors.startDay.message}
                </p>
              )}
            </div>
          </div>

          {/* Ligas de referencia */}
          <div className="space-y-2">
            <Label>Ligas de referencia</Label>
            {leaguesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : sourceLeagues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma liga com historico disponivel.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sourceLeagues.map((l) => {
                  const active = selectedSources.includes(l.name);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleSource(l.name)}
                      className={`rounded-md border px-3 py-1 text-sm font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedSources.length === 0 && (
              <p className="text-sm text-destructive">
                Selecione ao menos uma liga.
              </p>
            )}
          </div>

          {/* Fonte de preco */}
          <div className="space-y-2">
            <Label htmlFor="proj-pricesource">Fonte de preco</Label>
            <Select
              defaultValue="median"
              onValueChange={(val) =>
                setValue("priceSource", val as "median" | "cnl")
              }
            >
              <SelectTrigger id="proj-pricesource">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="median">Mediana</SelectItem>
                <SelectItem value="cnl">CNL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Defaults operacionais */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proj-bots">Bots padrao</Label>
              <Input
                id="proj-bots"
                type="number"
                min={1}
                {...register("defaultActiveBots", { valueAsNumber: true })}
              />
              {errors.defaultActiveBots && (
                <p className="text-sm text-destructive">
                  {errors.defaultActiveBots.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-divhr">Div/hr padrao</Label>
              <Input
                id="proj-divhr"
                type="number"
                min={0}
                step={0.1}
                {...register("defaultDivinePerHour", { valueAsNumber: true })}
              />
              {errors.defaultDivinePerHour && (
                <p className="text-sm text-destructive">
                  {errors.defaultDivinePerHour.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-hours">Horas/dia padrao</Label>
              <Input
                id="proj-hours"
                type="number"
                min={0}
                max={24}
                step={0.5}
                {...register("defaultHoursPerDay", { valueAsNumber: true })}
              />
              {errors.defaultHoursPerDay && (
                <p className="text-sm text-destructive">
                  {errors.defaultHoursPerDay.message}
                </p>
              )}
            </div>
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
              {submitting ? "Criando..." : "Criar 3 Cenarios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
