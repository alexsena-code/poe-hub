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
import { useLeagues } from "@/hooks/use-leagues";

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

// Real-world currencies only
const REAL_CURRENCY_LABELS: Record<string, string> = {
  usd: "USD",
  brl: "BRL",
  other: "Outro",
};

// PoE in-game items
const POE_ITEM_LABELS: Record<string, string> = {
  divine: "Divine",
  chaos: "Chaos",
  mirror: "Mirror",
};

/** Returns the PoE item being priced (from item field or legacy currency field) */
function getDisplayItem(entry: PriceEntry): string {
  if (entry.item) return POE_ITEM_LABELS[entry.item] ?? entry.item;
  if (entry.currency in POE_ITEM_LABELS) return POE_ITEM_LABELS[entry.currency];
  return "-";
}

/** Returns the real-world currency (brl/usd), or null if currency is a PoE item */
function getDisplayCurrency(entry: PriceEntry): string | null {
  if (entry.currency in REAL_CURRENCY_LABELS) return entry.currency;
  return null;
}

const POE_CHANNELS: Record<string, string> = {
  poe1: "1376913719245799521",
  poe2: "1376913719245799515",
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

  // Leagues
  const { leagues } = useLeagues();

  // Filters
  const [poeItem, setPoeItem] = useState(searchParams.get("item") || "all");
  const [currency, setCurrency] = useState(searchParams.get("currency") || "all");
  const [cnlOnly, setCnlOnly] = useState(searchParams.get("cnlOnly") === "true");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [league, setLeague] = useState(searchParams.get("league") || "");
  const [poeVersion, setPoeVersion] = useState(searchParams.get("poeVersion") || "all");

  // Leagues filtered by selected poeVersion
  const filteredLeagues = poeVersion === "all"
    ? leagues
    : leagues.filter((l) => l.poeVersion === poeVersion);

  const [weekFrom, setWeekFrom] = useState("all");
  const [weekTo, setWeekTo] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Calculate the selected league's start date and max weeks
  const selectedLeague = leagues.find((l) => l.name === league);
  const leagueStartDate = selectedLeague?.startDate ? new Date(selectedLeague.startDate) : null;
  const leagueEndDate = selectedLeague?.endDate ? new Date(selectedLeague.endDate) : null;
  const maxWeeks = leagueStartDate && leagueEndDate
    ? Math.ceil((leagueEndDate.getTime() - leagueStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
    : leagueStartDate ? 20 : 0;

  function weekToDate(weekNum: number, isEnd: boolean): string {
    if (!leagueStartDate) return "";
    const d = new Date(leagueStartDate);
    d.setDate(d.getDate() + (weekNum - 1) * 7 + (isEnd ? 6 : 0));
    return d.toISOString().split("T")[0];
  }

  function handleLeagueChange(leagueName: string) {
    setLeague(leagueName === "all" ? "" : leagueName);
    setWeekFrom("all");
    setWeekTo("all");
    resetPage();

    if (leagueName === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }

    const selected = leagues.find((l) => l.name === leagueName);
    if (selected) {
      setDateFrom(selected.startDate ? selected.startDate.slice(0, 10) : "");
      setDateTo(selected.endDate ? selected.endDate.slice(0, 10) : "");
    }
  }

  function handleWeekFromChange(val: string) {
    setWeekFrom(val);
    resetPage();
    if (val === "all") {
      setDateFrom(selectedLeague?.startDate ? selectedLeague.startDate.slice(0, 10) : "");
    } else {
      setDateFrom(weekToDate(parseInt(val), false));
    }
  }

  function handleWeekToChange(val: string) {
    setWeekTo(val);
    resetPage();
    if (val === "all") {
      setDateTo(selectedLeague?.endDate ? selectedLeague.endDate.slice(0, 10) : "");
    } else {
      setDateTo(weekToDate(parseInt(val), true));
    }
  }

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", "50");
      if (poeItem && poeItem !== "all") params.set("item", poeItem);
      if (currency && currency !== "all") params.set("currency", currency);
      if (cnlOnly) params.set("isCnl", "true");
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (league) params.set("league", league);
      if (poeVersion && poeVersion !== "all") params.set("channelId", POE_CHANNELS[poeVersion]);
      params.set("sort", sortOrder);

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
  }, [pagination.page, poeItem, currency, cnlOnly, dateFrom, dateTo, league, poeVersion, sortOrder]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function resetPage() {
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString("pt-BR");
  }

  function formatPrice(price: string, channelId?: string): string {
    const n = Number(price);
    // PoE 2 prices are very small (e.g. R$0.004), need more decimals
    const isPoe2 = channelId === POE_CHANNELS.poe2;
    return isPoe2 ? n.toFixed(4) : n.toFixed(2);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Jogo</Label>
          <Select
            value={poeVersion}
            onValueChange={(val) => {
              setPoeVersion(val);
              // Clear league if it doesn't belong to the new poeVersion
              if (league) {
                const currentLeague = leagues.find((l) => l.name === league);
                if (currentLeague && val !== "all" && currentLeague.poeVersion !== val) {
                  setLeague("");
                  setDateFrom("");
                  setDateTo("");
                }
              }
              resetPage();
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="poe1">PoE 1</SelectItem>
              <SelectItem value="poe2">PoE 2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Item</Label>
          <Select
            value={poeItem}
            onValueChange={(val) => { setPoeItem(val); resetPage(); }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Item" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="divine">Divine</SelectItem>
              <SelectItem value="chaos">Chaos</SelectItem>
              <SelectItem value="mirror">Mirror</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Moeda</Label>
          <Select
            value={currency}
            onValueChange={(val) => { setCurrency(val); resetPage(); }}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Moeda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="brl">BRL</SelectItem>
              <SelectItem value="usd">USD</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Liga</Label>
          <Select
            value={league || "all"}
            onValueChange={handleLeagueChange}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Liga" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {filteredLeagues.map((l) => (
                <SelectItem key={l.id} value={l.name}>
                  {l.name} {l.isCurrent ? "(atual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {league && maxWeeks > 0 ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Semana de</Label>
              <Select value={weekFrom} onValueChange={handleWeekFromChange}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Array.from({ length: maxWeeks }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      Semana {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Semana ate</Label>
              <Select value={weekTo} onValueChange={handleWeekToChange}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Array.from({ length: maxWeeks }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      Semana {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ordem</Label>
          <Select value={sortOrder} onValueChange={(val) => { setSortOrder(val as "asc" | "desc"); resetPage(); }}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Recente</SelectItem>
              <SelectItem value="asc">Antigo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <button
            type="button"
            role="switch"
            aria-checked={cnlOnly}
            onClick={() => { setCnlOnly(!cnlOnly); resetPage(); }}
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
          <Label
            className="text-sm cursor-pointer"
            onClick={() => { setCnlOnly(!cnlOnly); resetPage(); }}
          >
            Apenas CNL
          </Label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
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
              entries.map((entry) => {
                const displayCurrency = getDisplayCurrency(entry);
                const displayItem = getDisplayItem(entry);
                return (
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
                      {formatPrice(entry.price, entry.discordChannelId)}
                    </TableCell>
                    <TableCell>
                      {displayCurrency ? (
                        <Badge variant="outline">
                          {REAL_CURRENCY_LABELS[displayCurrency]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{displayItem}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {entry.discordChannelId}
                    </TableCell>
                  </TableRow>
                );
              })
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
