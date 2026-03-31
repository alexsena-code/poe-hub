"use client";

import { useState } from "react";
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
import { Plus } from "lucide-react";
import { useLeagues } from "@/hooks/use-leagues";

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  league: z.string().min(1, "Liga obrigatoria"),
  durationWeeks: z.number().int().min(1, "Minimo 1 semana").max(52, "Maximo 52 semanas"),
  notes: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

export function SimulationCreateDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { leagues, loading: leaguesLoading } = useLeagues();

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
