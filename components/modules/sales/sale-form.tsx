"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BuyerInlineDialog } from "./buyer-inline-dialog";
import { useLeagues } from "@/hooks/use-leagues";

const saleFormSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  buyerId: z.string().min(1, "Comprador é obrigatório"),
  quantity: z.string().min(1, "Quantidade é obrigatória"),
  unit: z.string().min(1, "Unidade é obrigatória"),
  divinePriceUsd: z.string().optional(),
  divinePriceBrl: z.string().optional(),
  league: z.string().min(1, "Liga é obrigatória"),
  notes: z.string().optional(),
});

type SaleFormValues = z.infer<typeof saleFormSchema>;

interface Buyer {
  id: string;
  name: string;
  isCnl: boolean;
  contact: string | null;
  notes: string | null;
}

interface SaleFormProps {
  initialData?: {
    id: string;
    date: string;
    buyerId: string;
    quantity: number;
    unit: string;
    divinePriceUsd: number | null;
    divinePriceBrl: number | null;
    totalUsd: number | null;
    totalBrl: number | null;
    league: string;
    notes: string | null;
  };
}

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function SaleForm({ initialData }: SaleFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(true);
  const [buyerDialogOpen, setBuyerDialogOpen] = useState(false);
  const { leagues } = useLeagues();

  const [totalUsd, setTotalUsd] = useState<number>(initialData?.totalUsd ?? 0);
  const [totalBrl, setTotalBrl] = useState<number>(initialData?.totalBrl ?? 0);

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      date: initialData?.date?.split("T")[0] ?? todayISO(),
      buyerId: initialData?.buyerId ?? "",
      quantity: initialData?.quantity?.toString() ?? "",
      unit: initialData?.unit ?? "divine",
      divinePriceUsd: initialData?.divinePriceUsd?.toString() ?? "",
      divinePriceBrl: initialData?.divinePriceBrl?.toString() ?? "",
      league: initialData?.league ?? "",
      notes: initialData?.notes ?? "",
    },
  });

  const fetchBuyers = useCallback(async () => {
    setLoadingBuyers(true);
    try {
      const res = await fetch("/api/buyers");
      if (res.ok) {
        const data = await res.json();
        setBuyers(Array.isArray(data) ? data : data.data ?? []);
      }
    } finally {
      setLoadingBuyers(false);
    }
  }, []);

  useEffect(() => {
    fetchBuyers();
  }, [fetchBuyers]);

  // Auto-calculate totals
  const quantity = form.watch("quantity");
  const divinePriceUsd = form.watch("divinePriceUsd");
  const divinePriceBrl = form.watch("divinePriceBrl");

  useEffect(() => {
    const qty = Number(quantity) || 0;
    const priceUsd = Number(divinePriceUsd) || 0;
    const priceBrl = Number(divinePriceBrl) || 0;
    setTotalUsd(Math.round(qty * priceUsd * 100) / 100);
    setTotalBrl(Math.round(qty * priceBrl * 100) / 100);
  }, [quantity, divinePriceUsd, divinePriceBrl]);

  function handleBuyerCreated(buyer: Buyer) {
    setBuyers((prev) => [...prev, buyer]);
    form.setValue("buyerId", buyer.id);
  }

  async function onSubmit(values: SaleFormValues) {
    const qty = parseFloat(values.quantity) || 0;
    if (qty <= 0) {
      toast.error("Quantidade deve ser maior que 0");
      return;
    }

    const payload = {
      date: new Date(values.date).toISOString(),
      buyerId: values.buyerId,
      quantity: qty,
      unit: values.unit,
      divinePriceUsd: values.divinePriceUsd ? parseFloat(values.divinePriceUsd) : null,
      divinePriceBrl: values.divinePriceBrl ? parseFloat(values.divinePriceBrl) : null,
      totalUsd,
      totalBrl,
      league: values.league,
      notes: values.notes || null,
    };

    const url = isEditing ? `/api/sales/${initialData.id}` : "/api/sales";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Erro ao salvar venda");
      return;
    }

    toast.success(isEditing ? "Venda atualizada!" : "Venda registrada!");
    router.push("/sales");
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Editar Venda" : "Nova Venda"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Date + Buyer */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Data</Label>
                <DatePicker
                  value={form.watch("date")}
                  onChange={(val) => form.setValue("date", val, { shouldValidate: true })}
                />
                {form.formState.errors.date && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.date.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Comprador</Label>
                <div className="flex gap-2">
                  <Select
                    value={form.watch("buyerId")}
                    onValueChange={(val) => {
                      if (val === "__new__") {
                        setBuyerDialogOpen(true);
                        return;
                      }
                      form.setValue("buyerId", val, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue
                        placeholder={
                          loadingBuyers ? "Carregando..." : "Selecione"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {buyers.map((buyer) => (
                        <SelectItem key={buyer.id} value={buyer.id}>
                          <span className="flex items-center gap-2">
                            {buyer.name}
                            {buyer.isCnl && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                CNL
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">
                        <span className="flex items-center gap-1 text-primary">
                          <Plus className="h-3 w-3" />
                          Criar novo comprador
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.formState.errors.buyerId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.buyerId.message}
                  </p>
                )}
              </div>
            </div>

            {/* Quantity + Unit + League */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="any"
                  {...form.register("quantity")}
                  placeholder="0"
                />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.quantity.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select
                  value={form.watch("unit")}
                  onValueChange={(val) => form.setValue("unit", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="divine">Divine</SelectItem>
                    <SelectItem value="mirror">Mirror</SelectItem>
                    <SelectItem value="exalted">Exalted</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Liga</Label>
                <Select
                  value={form.watch("league")}
                  onValueChange={(val) => form.setValue("league", val, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a liga" />
                  </SelectTrigger>
                  <SelectContent>
                    {leagues.map((l) => (
                      <SelectItem key={l.id} value={l.name} disabled={!l.isCurrent}>
                        {l.name} {!l.isCurrent && "(encerrada)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.league && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.league.message}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Prices */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Preços</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="divinePriceUsd">
                    Preço por Divine (USD)
                  </Label>
                  <Input
                    id="divinePriceUsd"
                    type="number"
                    step="any"
                    {...form.register("divinePriceUsd")}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="divinePriceBrl">
                    Preço por Divine (BRL)
                  </Label>
                  <Input
                    id="divinePriceBrl"
                    type="number"
                    step="any"
                    {...form.register("divinePriceBrl")}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Totals (calculated) */}
            <div className="rounded-md border bg-muted/50 p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Totais (calculados automaticamente)
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Total USD</Label>
                  <p className="text-2xl font-bold">
                    ${totalUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Total BRL</Label>
                  <p className="text-2xl font-bold">
                    R${totalBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                {...form.register("notes")}
                placeholder="Notas opcionais..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Salvando..."
                  : isEditing
                    ? "Salvar"
                    : "Registrar Venda"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/sales")}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <BuyerInlineDialog
        open={buyerDialogOpen}
        onOpenChange={setBuyerDialogOpen}
        onBuyerCreated={handleBuyerCreated}
      />
    </>
  );
}
