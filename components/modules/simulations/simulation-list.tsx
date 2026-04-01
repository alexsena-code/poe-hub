"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Trash2,
  Copy,
  Archive,
} from "lucide-react";
import { useLeagues } from "@/hooks/use-leagues";
import { useCurrency } from "@/hooks/use-currency";

interface Simulation {
  id: string;
  name: string;
  league: string;
  status: "draft" | "active" | "archived";
  durationWeeks: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totals?: {
    revenueUsd: number;
    revenueBrl: number;
    cost: number;
    profit: number;
    roi: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  archived: "Arquivada",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
};

function formatCurrency(value: number | null | undefined, prefix: string): string {
  if (value === null || value === undefined) return "-";
  return `${prefix}${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function SimulationListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all"
  );
  const [leagueFilter, setLeagueFilter] = useState(
    searchParams.get("league") || "all"
  );
  const { leagues } = useLeagues();
  const { formatMoney, exchangeRate } = useCurrency();

  const fetchSimulations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", pagination.page.toString());
    params.set("limit", "20");
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (leagueFilter && leagueFilter !== "all") params.set("league", leagueFilter);

    try {
      const res = await fetch(`/api/simulations?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar simulacoes");
      const data = await res.json();
      setSimulations(data.data ?? []);
      setPagination(
        data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 }
      );
    } catch {
      toast.error("Erro ao carregar simulacoes");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter, leagueFilter]);

  useEffect(() => {
    fetchSimulations();
  }, [fetchSimulations]);

  async function handleDuplicate(sim: Simulation) {
    try {
      const res = await fetch(`/api/simulations/${sim.id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("Simulacao duplicada");
      fetchSimulations();
    } catch {
      toast.error("Erro ao duplicar simulacao");
    }
  }

  async function handleArchive(sim: Simulation) {
    try {
      const res = await fetch(`/api/simulations/${sim.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Simulacao arquivada");
      fetchSimulations();
    } catch {
      toast.error("Erro ao arquivar simulacao");
    }
  }

  async function handleDelete(sim: Simulation) {
    if (!confirm(`Deletar simulacao "${sim.name}"?`)) return;

    try {
      const res = await fetch(`/api/simulations/${sim.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Simulacao deletada");
      fetchSimulations();
    } catch {
      toast.error("Erro ao deletar simulacao");
    }
  }

  function resetFilters() {
    setStatusFilter("all");
    setLeagueFilter("all");
    setPagination((p) => ({ ...p, page: 1 }));
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="active">Ativa</SelectItem>
              <SelectItem value="archived">Arquivada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Liga</Label>
          <Select
            value={leagueFilter}
            onValueChange={(val) => {
              setLeagueFilter(val);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {leagues.map((l) => (
                <SelectItem key={l.id} value={l.name}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Limpar filtros
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Liga</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Semanas</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="text-right">ROI</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-8 text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : simulations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-8 text-muted-foreground"
                >
                  Nenhuma simulacao encontrada
                </TableCell>
              </TableRow>
            ) : (
              simulations.map((sim) => (
                <TableRow
                  key={sim.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/simulations/${sim.id}`)}
                >
                  <TableCell className="font-medium">{sim.name}</TableCell>
                  <TableCell>{sim.league}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[sim.status] ?? "outline"}>
                      {STATUS_LABELS[sim.status] ?? sim.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {sim.durationWeeks}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(() => {
                      const usd = sim.totals?.revenueUsd ?? 0;
                      const brl = sim.totals?.revenueBrl ?? 0;
                      const val = usd > 0 ? usd : brl / exchangeRate;
                      return val > 0 ? formatMoney(val, "usd") : "-";
                    })()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(() => {
                      const usd = sim.totals?.revenueUsd ?? 0;
                      const brl = sim.totals?.revenueBrl ?? 0;
                      const revenue = usd > 0 ? usd : brl / exchangeRate;
                      const cost = sim.totals?.cost ?? 0;
                      if (revenue === 0 && cost === 0) return "-";
                      const profit = revenue - cost;
                      return (
                        <span className={profit >= 0 ? "text-green-500" : "text-destructive"}>
                          {formatMoney(profit, "usd")}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(() => {
                      const usd = sim.totals?.revenueUsd ?? 0;
                      const brl = sim.totals?.revenueBrl ?? 0;
                      const revenue = usd > 0 ? usd : brl / exchangeRate;
                      const cost = sim.totals?.cost ?? 0;
                      if (cost === 0) return "-";
                      const roi = ((revenue - cost) / cost) * 100;
                      return (
                        <span className={roi >= 0 ? "text-green-500" : "text-destructive"}>
                          {roi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>{formatDate(sim.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => router.push(`/simulations/${sim.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Duplicar"
                        onClick={() => handleDuplicate(sim)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {sim.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Arquivar"
                          onClick={() => handleArchive(sim)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Deletar"
                        onClick={() => handleDelete(sim)}
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total} simulacao{pagination.total !== 1 ? "es" : ""}{" "}
            encontrada{pagination.total !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page - 1 }))
              }
            >
              Anterior
            </Button>
            <span className="flex items-center text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page + 1 }))
              }
            >
              Proxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SimulationList() {
  return (
    <Suspense>
      <SimulationListInner />
    </Suspense>
  );
}
