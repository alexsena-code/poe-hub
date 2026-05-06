"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeagues } from "@/hooks/use-leagues";

interface ImportPricesDialogProps {
  simulationId: string;
  onImported: () => void;
}

export function ImportPricesDialog({
  simulationId,
  onImported,
}: ImportPricesDialogProps) {
  const [open, setOpen] = useState(false);
  const [league, setLeague] = useState("");
  const [priceSource, setPriceSource] = useState<"median" | "cnl">("median");
  const [startDay, setStartDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const { leagues } = useLeagues();

  async function handleImport() {
    if (!league) {
      toast.error("Selecione uma liga");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/simulations/${simulationId}/import-prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ league, priceSource, startDayOffset: startDay - 1 }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao importar preços");
      }

      const result = await res.json();
      const extrapolatedSuffix =
        result.extrapolatedDays > 0
          ? ` (${result.extrapolatedDays} extrapolados a −10%/dia)`
          : "";
      toast.success(
        `Preços importados: ${result.updatedDays} dias atualizados de ${result.priceDataDays} disponíveis${extrapolatedSuffix}`
      );
      setOpen(false);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4 mr-2" />
        Importar Preços Históricos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Preços Históricos</DialogTitle>
            <DialogDescription>
              Preenche automaticamente os preços da divine em cada dia da
              simulação com dados reais coletados do Discord. Dias além do
              último registro são extrapolados com decay de 10% ao dia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Liga de referência</Label>
              <Select value={league} onValueChange={setLeague}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a liga" />
                </SelectTrigger>
                <SelectContent>
                  {leagues.map((l) => (
                    <SelectItem key={l.id} value={l.name}>
                      {l.name} {l.isCurrent && "(atual)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Os preços serão mapeados a partir do primeiro dia da liga
                selecionada, dia a dia, para cada semana/dia da simulação.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Dia inicial da liga</Label>
              <Input
                type="number"
                min="1"
                value={startDay}
                onChange={(e) => setStartDay(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <p className="text-xs text-muted-foreground">
                A simulacao comeca a partir do dia N da liga selecionada
              </p>
            </div>

            <div className="space-y-2">
              <Label>Fonte do preço</Label>
              <Select
                value={priceSource}
                onValueChange={(v) => setPriceSource(v as "median" | "cnl")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="median">Mediana do mercado</SelectItem>
                  <SelectItem value="cnl">Preço CNL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={loading || !league}>
              {loading ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
