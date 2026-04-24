"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff, Save, Loader2 } from "lucide-react";

const proxySchema = z.object({
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1, "Username obrigatorio"),
  password: z.string().min(1, "Password obrigatorio"),
  notes: z.string().optional(),
});

type ProxyForm = z.infer<typeof proxySchema>;

export default function ProxySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showUsername, setShowUsername] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProxyForm>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      port: 8080,
      username: "",
      password: "",
      notes: "",
    },
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy-config");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data) {
        reset({
          port: data.port,
          username: data.username,
          password: data.password,
          notes: data.notes ?? "",
        });
      }
    } catch {
      toast.error("Erro ao carregar configuracao de proxy");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function onSubmit(data: ProxyForm) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/proxy-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar");
      }

      toast.success("Configuracao de proxy atualizada");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2"
          onClick={() => router.push("/admin/config")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Configuracoes
        </Button>
        <h1 className="text-3xl font-bold">Proxy Global</h1>
        <p className="text-muted-foreground">
          Configuracao de proxy compartilhada entre os bots.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Configuracao do Proxy</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="port">Porta</Label>
              <Input
                id="port"
                type="number"
                min={1}
                max={65535}
                {...register("port", { valueAsNumber: true })}
              />
              {errors.port && (
                <p className="text-sm text-destructive">{errors.port.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <Input
                  id="username"
                  type={showUsername ? "text" : "password"}
                  autoComplete="off"
                  {...register("username")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowUsername(!showUsername)}
                >
                  {showUsername ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.username && (
                <p className="text-sm text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Input
                id="notes"
                placeholder="Observacoes sobre o proxy"
                {...register("notes")}
              />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
