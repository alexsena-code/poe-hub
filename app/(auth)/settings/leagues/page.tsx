"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { ArrowLeft, Plus, Pencil, Loader2 } from "lucide-react";

interface League {
  id: string;
  name: string;
  poeVersion: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  createdAt: string;
}

const leagueSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  poeVersion: z.enum(["poe1", "poe2"]),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isCurrent: z.boolean(),
});

type LeagueForm = z.infer<typeof leagueSchema>;

function fmtDate(val: string | null): string {
  if (!val) return "-";
  try {
    return format(new Date(val), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
}

export default function LeaguesSettingsPage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<LeagueForm>({
    resolver: zodResolver(leagueSchema),
    defaultValues: {
      name: "",
      poeVersion: "poe1",
      startDate: null,
      endDate: null,
      isCurrent: false,
    },
  });

  const fetchLeagues = useCallback(async () => {
    try {
      const res = await fetch("/api/leagues");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLeagues(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar ligas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  function openCreate() {
    setEditingLeague(null);
    reset({
      name: "",
      poeVersion: "poe1",
      startDate: null,
      endDate: null,
      isCurrent: false,
    });
    setDialogOpen(true);
  }

  function openEdit(league: League) {
    setEditingLeague(league);
    reset({
      name: league.name,
      poeVersion: league.poeVersion as "poe1" | "poe2",
      startDate: league.startDate
        ? league.startDate.substring(0, 10)
        : null,
      endDate: league.endDate
        ? league.endDate.substring(0, 10)
        : null,
      isCurrent: league.isCurrent,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: LeagueForm) {
    setSubmitting(true);
    try {
      const url = editingLeague
        ? `/api/leagues/${editingLeague.id}`
        : "/api/leagues";
      const method = editingLeague ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar");
      }

      toast.success(
        editingLeague ? "Liga atualizada" : "Liga criada"
      );
      setDialogOpen(false);
      fetchLeagues();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleCurrent(league: League) {
    try {
      const res = await fetch(`/api/leagues/${league.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCurrent: !league.isCurrent }),
      });

      if (!res.ok) throw new Error();

      toast.success(
        league.isCurrent
          ? `Liga "${league.name}" desativada`
          : `Liga "${league.name}" ativada`
      );
      fetchLeagues();
    } catch {
      toast.error("Erro ao alterar status da liga");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2"
            onClick={() => router.push("/settings")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Configuracoes
          </Button>
          <h1 className="text-3xl font-bold">Gerenciar Ligas</h1>
          <p className="text-muted-foreground">
            Adicionar, editar e controlar ligas ativas de Path of Exile.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Liga
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Versao</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Carregando...
                </TableCell>
              </TableRow>
            ) : leagues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma liga encontrada. Crie a primeira.
                </TableCell>
              </TableRow>
            ) : (
              leagues.map((league) => (
                <TableRow key={league.id}>
                  <TableCell className="font-medium">{league.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={league.poeVersion === "poe2" ? "default" : "secondary"}
                    >
                      {league.poeVersion === "poe2" ? "PoE 2" : "PoE 1"}
                    </Badge>
                  </TableCell>
                  <TableCell>{fmtDate(league.startDate)}</TableCell>
                  <TableCell>{fmtDate(league.endDate)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCurrent(league)}
                      className="p-0 h-auto"
                    >
                      {league.isCurrent ? (
                        <Badge className="bg-green-600 hover:bg-green-700">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inativa
                        </Badge>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Editar"
                      onClick={() => openEdit(league)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLeague ? "Editar Liga" : "Nova Liga"}
            </DialogTitle>
            <DialogDescription>
              {editingLeague
                ? "Edite as informacoes da liga."
                : "Preencha as informacoes da nova liga."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="league-name">Nome</Label>
              <Input
                id="league-name"
                placeholder='Ex: "Settlers of Kalguur"'
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Versao do PoE</Label>
              <Controller
                name="poeVersion"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar versao" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="poe1">PoE 1</SelectItem>
                      <SelectItem value="poe2">PoE 2</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data de Inicio</Label>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value ?? undefined}
                      onChange={(val) => field.onChange(val)}
                      placeholder="Inicio"
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Fim</Label>
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value ?? undefined}
                      onChange={(val) => field.onChange(val)}
                      placeholder="Fim"
                    />
                  )}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCurrent"
                className="rounded border-border"
                {...register("isCurrent")}
              />
              <Label htmlFor="isCurrent" className="text-sm">
                Liga ativa (atual)
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Salvando..."
                  : editingLeague
                    ? "Atualizar"
                    : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
