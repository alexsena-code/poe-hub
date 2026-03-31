"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface PriceEntry {
  id: string;
  discordMessageId: string;
  authorName: string;
  isCnl: boolean;
  price: string;
  currency: string;
  item: string | null;
  rawMessage: string;
  messageTimestamp: string;
  discordChannelId: string;
  league: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const CURRENCY_LABELS: Record<string, string> = {
  divine: "Divine",
  chaos: "Chaos",
  usd: "USD",
  brl: "BRL",
  other: "Outro",
};

function PriceHistoryTableInner() {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [currency, setCurrency] = useState(searchParams.get("currency") || "all");
  const [cnlOnly, setCnlOnly] = useState(searchParams.get("cnlOnly") === "true");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [league, setLeague] = useState(searchParams.get("league") || "");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", "50");
      if (currency && currency !== "all") params.set("currency", currency);
      if (cnlOnly) params.set("isCnl", "true");
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (league) params.set("league", league);

      const res = await fetch(`/api/prices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.data);
        setPagination(data.pagination);
      }
    } catch {
      // Fetch failed silently
    } finally {
      setLoading(false);
    }
  }, [pagination.page, currency, cnlOnly, dateFrom, dateTo, league]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function resetPage() {
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString("pt-BR");
  }

  function formatPrice(price: string): string {
    return Number(price).toFixed(2);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Moeda</Label>
          <Select
            value={currency}
            onValueChange={(val) => {
              setCurrency(val);
              resetPage();
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Moeda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="divine">Divine</SelectItem>
              <SelectItem value="chaos">Chaos</SelectItem>
              <SelectItem value="usd">USD</SelectItem>
              <SelectItem value="brl">BRL</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Liga</Label>
          <Input
            placeholder="Liga..."
            value={league}
            onChange={(e) => {
              setLeague(e.target.value);
              resetPage();
            }}
            className="w-40"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">De</Label>
          <DatePicker
            value={dateFrom}
            onChange={(val) => { setDateFrom(val); resetPage(); }}
            placeholder="Data inicial"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ate</Label>
          <DatePicker
            value={dateTo}
            onChange={(val) => { setDateTo(val); resetPage(); }}
            placeholder="Data final"
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <button
            type="button"
            role="switch"
            aria-checked={cnlOnly}
            onClick={() => {
              setCnlOnly(!cnlOnly);
              resetPage();
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              cnlOnly ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                cnlOnly ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <Label className="text-sm cursor-pointer" onClick={() => {
            setCnlOnly(!cnlOnly);
            resetPage();
          }}>
            Apenas CNL
          </Label>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>CNL?</TableHead>
              <TableHead className="text-right">Preco</TableHead>
              <TableHead>Moeda</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Canal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum registro de preco encontrado
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTime(entry.messageTimestamp)}
                  </TableCell>
                  <TableCell className="font-medium">{entry.authorName}</TableCell>
                  <TableCell>
                    {entry.isCnl ? (
                      <Badge variant="default">CNL</Badge>
                    ) : (
                      <Badge variant="secondary">Mercado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatPrice(entry.price)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CURRENCY_LABELS[entry.currency] || entry.currency}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.item || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {entry.discordChannelId}
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
            {pagination.total} registro{pagination.total !== 1 ? "s" : ""} encontrado{pagination.total !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
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
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Proxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PriceHistoryTable() {
  return (
    <Suspense>
      <PriceHistoryTableInner />
    </Suspense>
  );
}
