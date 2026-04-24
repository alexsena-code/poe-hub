"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";

interface AnnualPlan {
  id: string;
  name: string;
  year: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { simulationLinks: number };
}

export default function AnnualPlansIndexPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [submitting, setSubmitting] = useState(false);

  async function fetchPlans() {
    try {
      const res = await fetch("/api/annual-plans");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlans(data.data ?? []);
    } catch {
      toast.error("Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlans();
  }, []);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/annual-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, year }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar");
      }
      const plan = await res.json();
      toast.success("Plano criado");
      setDialogOpen(false);
      setName("");
      router.push(`/farm/simulations/annual/${plan.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(plan: AnnualPlan) {
    if (!confirm(`Deletar plano "${plan.name}"?`)) return;
    try {
      const res = await fetch(`/api/annual-plans/${plan.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Plano deletado");
      fetchPlans();
    } catch {
      toast.error("Erro ao deletar");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-1" asChild>
          <Link href="/farm/simulations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Simulações
          </Link>
        </Button>
        <PageHeader
          title="Faturamento Anual"
          description="Agregue simulações de ligas (PoE1 + PoE2) em um plano anual. Adicione custos fixos do ano (VPS, eletricidade) no plano."
          actions={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Plano
            </Button>
          }
        />
      </div>

      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24 text-center">Ano</TableHead>
                  <TableHead className="w-32 text-center">Ligas</TableHead>
                  <TableHead className="w-40">Atualizado</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum plano ainda. Crie o primeiro.
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => router.push(`/farm/simulations/annual/${p.id}`)}
                    >
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-center font-mono">{p.year}</TableCell>
                      <TableCell className="text-center font-mono">
                        {p._count.simulationLinks}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(p.updatedAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => router.push(`/farm/simulations/annual/${p.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo plano anual</DialogTitle>
            <DialogDescription>
              Um plano agrupa simulações de ligas (PoE1 + PoE2) em um ano e soma tudo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Nome</Label>
              <Input
                id="plan-name"
                placeholder='Ex: "Plano 2027"'
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-year">Ano</Label>
              <Input
                id="plan-year"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
