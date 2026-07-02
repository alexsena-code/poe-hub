"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLeagues } from "@/hooks/use-leagues";

const BASES = ["Chaos Orb", "Divine Orb"];

interface FillFormValues {
  item: string;
  base: string;
  league: string;
  mode: string;
  buyRatio: string;
  buyQty: string;
  fairAtEntry: string;
  buyQAhead: string;
  sellRatio: string;
  sellQty: string;
  sellFilledAt: string;
  notes: string;
}

export interface FillInitialData {
  id: string;
  item: string;
  base: string;
  league: string;
  mode: string;
  buyRatio: number | null;
  buyQty: number | null;
  fairAtEntry: number | null;
  buyQAhead: number | null;
  sellRatio: number | null;
  sellQty: number | null;
  sellFilledAt: string | null;
  notes: string | null;
}

// Pré-preenchimento vindo do sinal ("Fazer Order" em /farm/signals). Só afeta
// o modo criação (sem id) — os campos ficam editáveis antes de registrar.
export interface FillPrefill {
  item?: string;
  base?: string;
  league?: string;
  buyRatio?: string;
  fairAtEntry?: string;
  buyQAhead?: string;
}

// datetime-local exige "YYYY-MM-DDTHH:mm" na hora local
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function FillForm({ initialData, prefill }: { initialData?: FillInitialData; prefill?: FillPrefill }) {
  const router = useRouter();
  const isEditing = !!initialData;
  const { leagues } = useLeagues();
  const currentLeague = leagues.find((l) => l.isCurrent)?.name ?? "";

  const form = useForm<FillFormValues>({
    defaultValues: {
      item: initialData?.item ?? prefill?.item ?? "",
      base: initialData?.base ?? prefill?.base ?? "Chaos Orb",
      league: initialData?.league ?? prefill?.league ?? "",
      mode: initialData?.mode ?? "manual",
      buyRatio: initialData?.buyRatio?.toString() ?? prefill?.buyRatio ?? "",
      buyQty: initialData?.buyQty?.toString() ?? "",
      fairAtEntry: initialData?.fairAtEntry?.toString() ?? prefill?.fairAtEntry ?? "",
      buyQAhead: initialData?.buyQAhead?.toString() ?? prefill?.buyQAhead ?? "",
      sellRatio: initialData?.sellRatio?.toString() ?? "",
      sellQty: initialData?.sellQty?.toString() ?? "",
      sellFilledAt: toLocalInput(initialData?.sellFilledAt ?? null),
      notes: initialData?.notes ?? "",
    },
  });

  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

  async function onSubmit(v: FillFormValues) {
    if (!v.item.trim()) return toast.error("Item é obrigatório");
    if (!v.league) return toast.error("Liga é obrigatória");

    const sellFilledIso = v.sellFilledAt ? new Date(v.sellFilledAt).toISOString() : null;
    const payload = {
      item: v.item.trim(),
      base: v.base,
      league: v.league,
      mode: v.mode,
      buyRatio: numOrNull(v.buyRatio),
      buyQty: numOrNull(v.buyQty),
      fairAtEntry: numOrNull(v.fairAtEntry),
      buyQAhead: numOrNull(v.buyQAhead),
      sellRatio: numOrNull(v.sellRatio),
      sellQty: numOrNull(v.sellQty),
      // venda preenchida sem hora explícita -> assume agora
      sellFilledAt: sellFilledIso ?? (numOrNull(v.sellRatio) != null ? new Date().toISOString() : null),
    };

    const url = isEditing ? `/api/fills/${initialData.id}` : "/api/fills";
    const method = isEditing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, notes: v.notes || null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return toast.error(err.error || "Erro ao salvar order");
    }
    toast.success(isEditing ? "Order atualizada!" : "Order registrada!");
    router.push("/farm/fills");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Order" : "Nova Order"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Identidade */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item">Item</Label>
              <Input id="item" {...form.register("item")} placeholder="Orb of Annulment" />
            </div>
            <div className="space-y-2">
              <Label>Moeda base</Label>
              <Select value={form.watch("base")} onValueChange={(val) => form.setValue("base", val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BASES.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Liga</Label>
              <Select
                value={form.watch("league") || currentLeague}
                onValueChange={(val) => form.setValue("league", val)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a liga" /></SelectTrigger>
                <SelectContent>
                  {leagues.map((l) => (
                    <SelectItem key={l.id} value={l.name}>
                      {l.name} {!l.isCurrent && "(encerrada)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modo</Label>
              <Select value={form.watch("mode")} onValueChange={(val) => form.setValue("mode", val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="semi">Semi-auto</SelectItem>
                  <SelectItem value="full">Full-auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Compra */}
          <div>
            <h3 className="text-lg font-semibold mb-1">Compra (entrada)</h3>
            <p className="text-xs text-muted-foreground mb-4">
              A hora de entrada é registrada automaticamente ao salvar (agora).
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="buyRatio">Preço compra (base/un)</Label>
                <Input id="buyRatio" type="number" step="any" {...form.register("buyRatio")} placeholder="7" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyQty">Quantidade</Label>
                <Input id="buyQty" type="number" step="any" {...form.register("buyQty")} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fairAtEntry">Fair no post (opc.)</Label>
                <Input id="fairAtEntry" type="number" step="any" {...form.register("fairAtEntry")} placeholder="—" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyQAhead">Fila à frente (opc.)</Label>
                <Input id="buyQAhead" type="number" step="any" {...form.register("buyQAhead")} placeholder="—" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Venda */}
          <div>
            <h3 className="text-lg font-semibold mb-1">Venda (saída)</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Deixe em branco se a order ainda está aberta. O plugin preenche isto ao detectar o fim da order.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sellRatio">Preço venda (base/un)</Label>
                <Input id="sellRatio" type="number" step="any" {...form.register("sellRatio")} placeholder="9" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellQty">Quantidade vendida</Label>
                <Input id="sellQty" type="number" step="any" {...form.register("sellQty")} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellFilledAt">Hora de saída</Label>
                <Input id="sellFilledAt" type="datetime-local" {...form.register("sellFilledAt")} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input id="notes" {...form.register("notes")} placeholder="Notas opcionais..." />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Salvando..." : isEditing ? "Salvar" : "Registrar Order"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/farm/fills")}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
