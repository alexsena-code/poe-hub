"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
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
import { DatePicker } from "@/components/ui/date-picker";

const botFormSchema = z.object({
  nick: z.string().min(1, "Nick é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
  proxyIp: z.string().min(1, "IP do proxy é obrigatório"),
  proxyEol: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

type BotFormValues = z.infer<typeof botFormSchema>;

interface BotFormProps {
  initialData?: {
    id: string;
    nick: string;
    email: string;
    password: string;
    proxyIp: string;
    proxyEol: string | null;
    status: string;
    notes: string | null;
  };
}

export function BotForm({ initialData }: BotFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const form = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      nick: initialData?.nick ?? "",
      email: initialData?.email ?? "",
      password: initialData?.password ?? "",
      proxyIp: initialData?.proxyIp ?? "",
      proxyEol: initialData?.proxyEol?.split("T")[0] ?? "",
      status: initialData?.status ?? "active",
      notes: initialData?.notes ?? "",
    },
  });

  async function onSubmit(values: BotFormValues) {
    const payload = {
      ...values,
      proxyEol: values.proxyEol ? new Date(values.proxyEol).toISOString() : null,
      notes: values.notes || null,
    };

    const url = isEditing ? `/api/bots/${initialData.id}` : "/api/bots";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Erro ao salvar bot");
      return;
    }

    toast.success(isEditing ? "Bot atualizado!" : "Bot criado!");
    router.push("/farm/bots");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Bot" : "Novo Bot"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nick">Nick</Label>
              <Input id="nick" {...form.register("nick")} placeholder="Ex: Luizina" />
              {form.formState.errors.nick && (
                <p className="text-sm text-destructive">{form.formState.errors.nick.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email da conta PoE</Label>
              <Input id="email" type="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha da conta PoE</Label>
              <Input id="password" type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(val) => form.setValue("status", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="banned">Banido</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Proxy</h3>
            <p className="text-sm text-muted-foreground">
              Porta, usuário e senha do proxy são configurados globalmente em Configurações.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="proxyIp">IP do Proxy</Label>
                <Input id="proxyIp" {...form.register("proxyIp")} placeholder="138.99.147.151" />
                {form.formState.errors.proxyIp && (
                  <p className="text-sm text-destructive">{form.formState.errors.proxyIp.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Expiração do Proxy</Label>
                <DatePicker
                  value={form.watch("proxyEol") ?? ""}
                  onChange={(val) => form.setValue("proxyEol", val)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input id="notes" {...form.register("notes")} placeholder="Notas opcionais..." />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Salvando..." : isEditing ? "Salvar" : "Criar Bot"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/farm/bots")}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
