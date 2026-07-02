"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, DollarSign, Download } from "lucide-react";
import { useLeagues } from "@/hooks/use-leagues";
import { MarkSoldDialog } from "./mark-sold-dialog";

interface Fill {
  id: string;
  league: string;
  item: string;
  base: string;
  mode: string;
  status: string;
  buyRatio: number | null;
  buyQty: number | null;
  buyPostedAt: string | null;
  sellRatio: number | null;
  sellQty: number | null;
  sellFilledAt: string | null;
  pnlChaos: number | null;
  pnlDiv: number | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Aberta", variant: "outline" },
  holding: { label: "Segurando", variant: "secondary" },
  closed: { label: "Fechada", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

function fmt(n: number | null, dp = 2): string {
  if (n === null || n === undefined) return "-";
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: dp });
}
function fmtDateTime(s: string | null): string {
  return s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";
}

function FillsTableInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { leagues } = useLeagues();

  const [fills, setFills] = useState<Fill[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [leagueFilter, setLeagueFilter] = useState(searchParams.get("league") || "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [soldTarget, setSoldTarget] = useState<Fill | null>(null);

  const fetchFills = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", pagination.page.toString());
    params.set("limit", "20");
    if (leagueFilter !== "all") params.set("league", leagueFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/fills?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFills(data.data ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch {
      toast.error("Erro ao carregar orders");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, leagueFilter, statusFilter]);

  useEffect(() => {
    fetchFills();
  }, [fetchFills]);

  function exportXlsx() {
    const params = new URLSearchParams();
    if (leagueFilter !== "all") params.set("league", leagueFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const qs = params.toString();
    window.location.href = `/api/fills/export${qs ? `?${qs}` : ""}`;
  }

  async function handleDelete(fill: Fill) {
    if (!confirm(`Deletar order de ${fill.item}?`)) return;
    const res = await fetch(`/api/fills/${fill.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Order deletada");
      fetchFills();
    } else {
      toast.error("Erro ao deletar");
    }
  }

  // resumo: PnL somado por moeda (só das fechadas da página)
  const pnlChaos = fills.reduce((a, f) => a + (Number(f.pnlChaos) || 0), 0);
  const pnlDiv = fills.reduce((a, f) => a + (Number(f.pnlDiv) || 0), 0);
  const closedCount = fills.filter((f) => f.status === "closed").length;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Liga</Label>
          <Select value={leagueFilter} onValueChange={(v) => { setLeagueFilter(v); setPagination((p) => ({ ...p, page: 1 })); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {leagues.map((l) => (
                <SelectItem key={l.id} value={l.name}>{l.name}{!l.isCurrent && " (encerrada)"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPagination((p) => ({ ...p, page: 1 })); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Aberta</SelectItem>
              <SelectItem value="holding">Segurando</SelectItem>
              <SelectItem value="closed">Fechada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setLeagueFilter("all"); setStatusFilter("all"); setPagination((p) => ({ ...p, page: 1 })); }}>
          Limpar filtros
        </Button>
        <Button variant="outline" size="sm" onClick={exportXlsx} disabled={fills.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exportar XLSX
        </Button>
      </div>

      {/* Resumo */}
      {!loading && fills.length > 0 && (
        <Card>
          <CardContent className="flex gap-8 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Fechadas (página)</p>
              <p className="text-lg font-bold">{closedCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PnL chaos</p>
              <p className={`text-lg font-bold ${pnlChaos >= 0 ? "text-green-500" : "text-destructive"}`}>{fmt(pnlChaos)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PnL divine</p>
              <p className={`text-lg font-bold ${pnlDiv >= 0 ? "text-green-500" : "text-destructive"}`}>{fmt(pnlDiv, 4)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entrada</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Base</TableHead>
              <TableHead className="text-right">Compra</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">PnL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Liga</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : fills.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma order encontrada</TableCell></TableRow>
            ) : (
              fills.map((f) => {
                const st = STATUS[f.status] ?? { label: f.status, variant: "outline" as const };
                const pnl = f.pnlChaos ?? f.pnlDiv;
                const pnlUnit = f.pnlChaos != null ? "c" : f.pnlDiv != null ? "d" : "";
                return (
                  <TableRow key={f.id}>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(f.buyPostedAt)}</TableCell>
                    <TableCell className="font-medium">{f.item}</TableCell>
                    <TableCell className="text-xs">{f.base.replace(" Orb", "")}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(f.buyRatio)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(f.sellRatio)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(f.sellQty ?? f.buyQty, 0)}</TableCell>
                    <TableCell className={`text-right font-mono ${pnl != null ? (Number(pnl) >= 0 ? "text-green-500" : "text-destructive") : ""}`}>
                      {pnl != null ? `${fmt(pnl, 2)}${pnlUnit}` : "-"}
                    </TableCell>
                    <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                    <TableCell className="text-xs">{f.league}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {f.status !== "closed" && f.status !== "cancelled" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" title="Marcar vendido"
                            onClick={() => setSoldTarget(f)}>
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                          onClick={() => router.push(`/farm/fills/${f.id}`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Deletar"
                          onClick={() => handleDelete(f)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total} order{pagination.total !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>Anterior</Button>
            <span className="flex items-center text-sm">{pagination.page} / {pagination.totalPages}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>Próxima</Button>
          </div>
        </div>
      )}

      <MarkSoldDialog
        fill={soldTarget}
        open={soldTarget !== null}
        onOpenChange={(o) => { if (!o) setSoldTarget(null); }}
        onDone={fetchFills}
      />
    </div>
  );
}

export function FillsTable() {
  return (
    <Suspense>
      <FillsTableInner />
    </Suspense>
  );
}
