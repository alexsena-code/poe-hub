"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
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

const buyerFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  isCnl: z.boolean().optional(),
  contact: z.string().optional(),
  notes: z.string().optional(),
});

type BuyerFormValues = z.infer<typeof buyerFormSchema>;

interface Buyer {
  id: string;
  name: string;
  isCnl: boolean;
  contact: string | null;
  notes: string | null;
}

interface BuyerInlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuyerCreated: (buyer: Buyer) => void;
}

export function BuyerInlineDialog({
  open,
  onOpenChange,
  onBuyerCreated,
}: BuyerInlineDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<BuyerFormValues>({
    resolver: zodResolver(buyerFormSchema),
    defaultValues: {
      name: "",
      isCnl: false,
      contact: "",
      notes: "",
    },
  });

  async function onSubmit(values: BuyerFormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          isCnl: values.isCnl ?? false,
          contact: values.contact || null,
          notes: values.notes || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Erro ao criar comprador");
        return;
      }

      const buyer = await res.json();
      toast.success("Comprador criado!");
      onBuyerCreated(buyer);
      onOpenChange(false);
      form.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Comprador</DialogTitle>
          <DialogDescription>
            Cadastre um novo comprador para associar a vendas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyer-name">Nome</Label>
            <Input
              id="buyer-name"
              {...form.register("name")}
              placeholder="Nome do comprador"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="buyer-is-cnl"
              type="checkbox"
              {...form.register("isCnl")}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="buyer-is-cnl">
              Comprador CNL (confiável / recorrente)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="buyer-contact">Contato</Label>
            <Input
              id="buyer-contact"
              {...form.register("contact")}
              placeholder="Discord, email, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="buyer-notes">Observações</Label>
            <Input
              id="buyer-notes"
              {...form.register("notes")}
              placeholder="Notas opcionais..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                form.reset();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Criando..." : "Criar Comprador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
