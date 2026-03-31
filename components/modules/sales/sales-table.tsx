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
import { Input } from "@/components/ui/input";
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
import { Pencil, Trash2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

interface Buyer {
  id: string;
  name: string;
  isCnl: boolean;
}

interface Sale {
  id: string;
  date: string;
  buyerId: string;
  buyer: Buyer;
  quantity: number;
  unit: string;
  divinePriceUsd: number | null;
  divinePriceBrl: number | null;
  totalUsd: number | null;
  totalBrl: number | null;
  league: string;
  notes: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const UNIT_LABELS: Record<string, string> = {
  divine: "Divine",
  mirror: "Mirror",
  exalted: "Exalted",
  other: "Outro",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function formatCurrency(value: number | null, prefix: string): string {
  if (value === null || value === undefined) return "-";
  return `${prefix}${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SalesTableInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sales, setSales] = useState<Sale[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [buyerFilter, setBuyerFilter] = useState(
    searchParams.get("buyerId") || "all"
  );
  const [leagueFilter, setLeagueFilter] = useState(
    searchParams.get("league") || ""
  );

  // Summary
  const [summary, setSummary] = useState({
    totalQuantity: 0,
    totalUsd: 0,
    totalBrl: 0,
  });

  const fetchBuyers = useCallback(async () => {
    try {
      const res = await fetch("/api/buyers");
      if (res.ok) {
        const data = await res.json();
        setBuyers(Array.isArray(data) ? data : data.data ?? []);
      }
    } catch {
      // silently fail — buyers filter is optional
    }
  }, []);

  useEffect(() => {
    fetchBuyers();
  }, [fetchBuyers]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", pagination.page.toString());
    params.set("limit", "20");
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (buyerFilter && buyerFilter !== "all") params.set("buyerId", buyerFilter);
    if (leagueFilter) params.set("league", leagueFilter);

    try {
      const res = await fetch(`/api/sales?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar vendas");
      const data = await res.json();
      const salesData: Sale[] = data.data ?? [];
      setSales(salesData);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 });

      // Calculate summary from current page data
      // Ideally the API would return aggregations, but we compute from loaded data
      const totalQuantity = salesData.reduce(
        (acc, s) => acc + Number(s.quantity),
        0
      );
      const totalUsd = salesData.reduce(
        (acc, s) => acc + (Number(s.totalUsd) || 0),
        0
      );
      const totalBrl = salesData.reduce(
        (acc, s) => acc + (Number(s.totalBrl) || 0),
        0
      );
      setSummary({ totalQuantity, totalUsd, totalBrl });
    } catch {
      toast.error("Erro ao carregar vendas");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, dateFrom, dateTo, buyerFilter, leagueFilter]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  async function handleDelete(sale: Sale) {
    if (!confirm(`Deletar venda de ${sale.buyer?.name ?? "comprador"}?`))
      return;

    const res = await fetch(`/api/sales/${sale.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Venda deletada");
      fetchSales();
    } else {
      toast.error("Erro ao deletar venda");
    }
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setBuyerFilter("all");
    setLeagueFilter("");
    setPagination((p) => ({ ...p, page: 1 }));
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">De</Label>
          <DatePicker
            value={dateFrom}
            onChange={(val) => {
              setDateFrom(val);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Data inicial"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <DatePicker
            value={dateTo}
            onChange={(val) => {
              setDateTo(val);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Data final"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Comprador</Label>
          <Select
            value={buyerFilter}
            onValueChange={(val) => {
              setBuyerFilter(val);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {buyers.map((buyer) => (
                <SelectItem key={buyer.id} value={buyer.id}>
                  <span className="flex items-center gap-2">
                    {buyer.name}
                    {buyer.isCnl && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        CNL
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Liga</Label>
          <Input
            value={leagueFilter}
            onChange={(e) => {
              setLeagueFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Filtrar liga..."
            className="w-40"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Limpar filtros
        </Button>
      </div>

      {/* Summary */}
      {!loading && sales.length > 0 && (
        <Card>
          <CardContent className="flex gap-8 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Qtd Total</p>
              <p className="text-lg font-bold">
                {summary.totalQuantity.toLocaleString("pt-BR", {
                  maximumFractionDigits: 4,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total USD</p>
              <p className="text-lg font-bold">
                {formatCurrency(summary.totalUsd, "$")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total BRL</p>
              <p className="text-lg font-bold">
                {formatCurrency(summary.totalBrl, "R$")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Preço Divine (USD)</TableHead>
              <TableHead className="text-right">Total USD</TableHead>
              <TableHead className="text-right">Total BRL</TableHead>
              <TableHead>Liga</TableHead>
              <TableHead className="text-right">Ações</TableHead>
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
            ) : sales.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-8 text-muted-foreground"
                >
                  Nenhuma venda encontrada
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>{formatDate(sale.date)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {sale.buyer?.name ?? "-"}
                      {sale.buyer?.isCnl && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          CNL
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(sale.quantity).toLocaleString("pt-BR", {
                      maximumFractionDigits: 4,
                    })}
                  </TableCell>
                  <TableCell>{UNIT_LABELS[sale.unit] ?? sale.unit}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(sale.divinePriceUsd, "$")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(sale.totalUsd, "$")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(sale.totalBrl, "R$")}
                  </TableCell>
                  <TableCell>{sale.league}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.push(`/sales/${sale.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(sale)}
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
            {pagination.total} venda{pagination.total !== 1 ? "s" : ""}{" "}
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
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SalesTable() {
  return (
    <Suspense>
      <SalesTableInner />
    </Suspense>
  );
}
