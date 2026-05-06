"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BotProgressionDialogProps {
  simulationId: string;
  durationWeeks: number;
  startDayOffset: number;
  onApplied: () => void;
}

export function BotProgressionDialog({
  simulationId,
  durationWeeks,
  startDayOffset,
  onApplied,
}: BotProgressionDialogProps) {
  const [open, setOpen] = useState(false);
  const [maxBots, setMaxBots] = useState<number>(20);
  const [incrementPerDay, setIncrementPerDay] = useState<number>(1);
  const [startBots, setStartBots] = useState<number>(1);
  const [startDay, setStartDay] = useState<number>(startDayOffset + 1);
  const [loading, setLoading] = useState(false);

  const totalDays = durationWeeks * 7;

  const preview = useMemo(() => {
    if (
      maxBots < 1 ||
      incrementPerDay < 1 ||
      startBots < 0 ||
      startBots > maxBots ||
      startDay < 1 ||
      startDay > totalDays
    ) {
      return null;
    }
    const daysToMax = Math.ceil(Math.max(0, maxBots - startBots) / incrementPerDay);
    const dayReachingMax = Math.min(startDay + daysToMax, totalDays);
    const daysAffected = totalDays - startDay + 1;
    return { daysToMax, dayReachingMax, daysAffected };
  }, [maxBots, incrementPerDay, startBots, startDay, totalDays]);

  async function handleSubmit() {
    if (!preview) {
      toast.error("Verifique os parâmetros da progressão");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/simulations/${simulationId}/bot-progression`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maxBots,
            incrementPerDay,
            startBots,
            startDay,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `status ${res.status}`);
      }

      const result = await res.json();
      toast.success(
        `Progressão aplicada em ${result.daysUpdated} dias. Atinge ${maxBots} bots no dia ${preview.dayReachingMax}.`
      );
      setOpen(false);
      onApplied();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aplicar progressão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <TrendingUp className="mr-2 h-4 w-4" />
          Progressão Auto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Progressão automática de bots</DialogTitle>
          <DialogDescription>
            Sobrescreve a quantidade de bots ativos em cada dia, partindo de
            um valor inicial e somando bots por dia até atingir o máximo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bp-start-bots">Bots iniciais</Label>
              <Input
                id="bp-start-bots"
                type="number"
                min={0}
                value={startBots}
                onChange={(e) => setStartBots(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-max-bots">Bots máximo</Label>
              <Input
                id="bp-max-bots"
                type="number"
                min={1}
                value={maxBots}
                onChange={(e) => setMaxBots(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bp-increment">Aumento / dia</Label>
              <Input
                id="bp-increment"
                type="number"
                min={1}
                value={incrementPerDay}
                onChange={(e) => setIncrementPerDay(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-start-day">
                Dia inicial <span className="text-muted-foreground text-xs">(1–{totalDays})</span>
              </Label>
              <Input
                id="bp-start-day"
                type="number"
                min={1}
                max={totalDays}
                value={startDay}
                onChange={(e) => setStartDay(Number(e.target.value))}
              />
            </div>
          </div>

          {preview ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Dias afetados:</span>{" "}
                <span className="font-mono font-semibold">{preview.daysAffected}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Atinge máximo no dia:</span>{" "}
                <span className="font-mono font-semibold">{preview.dayReachingMax}</span>{" "}
                <span className="text-muted-foreground text-xs">
                  ({preview.daysToMax} dia{preview.daysToMax === 1 ? "" : "s"} de rampa)
                </span>
              </p>
              <p className="text-xs text-muted-foreground pt-1">
                Sobrescreve overrides existentes de bots a partir do dia inicial.
              </p>
            </div>
          ) : (
            <p className="text-sm text-destructive">
              Parâmetros inválidos: verifique início ≤ máximo e dia inicial dentro do intervalo.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !preview}>
            {loading ? "Aplicando..." : "Aplicar progressão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
