"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MarkSoldDialogProps {
  fill: { id: string; item: string; base: string; buyQty: number | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

// datetime-local para "agora" na hora local
function nowLocalInput(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function MarkSoldDialog({ fill, open, onOpenChange, onDone }: MarkSoldDialogProps) {
  const [sellRatio, setSellRatio] = useState("");
  const [sellQty, setSellQty] = useState("");
  const [sellFilledAt, setSellFilledAt] = useState(nowLocalInput());
  const [submitting, setSubmitting] = useState(false);

  // reinicia os campos quando abre para um novo fill
  const [lastId, setLastId] = useState<string | null>(null);
  if (fill && fill.id !== lastId) {
    setLastId(fill.id);
    setSellRatio("");
    setSellQty(fill.buyQty?.toString() ?? "");
    setSellFilledAt(nowLocalInput());
  }

  async function submit() {
    if (!fill) return;
    if (sellRatio.trim() === "") return toast.error("Informe o preço de venda");
    setSubmitting(true);
    const res = await fetch(`/api/fills/${fill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellRatio: Number(sellRatio),
        sellQty: sellQty.trim() === "" ? null : Number(sellQty),
        sellFilledAt: sellFilledAt ? new Date(sellFilledAt).toISOString() : new Date().toISOString(),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Erro ao marcar vendido");
    }
    toast.success("Order fechada!");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar vendido{fill ? ` — ${fill.item}` : ""}</DialogTitle>
          <DialogDescription>
            Fecha o round-trip. O PnL é calculado automaticamente a partir da compra.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ms-ratio">Preço de venda ({fill?.base ?? "base"}/un)</Label>
            <Input id="ms-ratio" type="number" step="any" value={sellRatio}
              onChange={(e) => setSellRatio(e.target.value)} placeholder="9" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ms-qty">Quantidade vendida</Label>
            <Input id="ms-qty" type="number" step="any" value={sellQty}
              onChange={(e) => setSellQty(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ms-time">Hora de saída</Label>
            <Input id="ms-time" type="datetime-local" value={sellFilledAt}
              onChange={(e) => setSellFilledAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Salvando..." : "Fechar order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
