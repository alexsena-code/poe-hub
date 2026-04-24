"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ExternalLink, Search, RefreshCw, ArrowUpDown } from "lucide-react";

export interface Deal {
  id: number;
  item_name: string;
  title: string;
  price: number;
  source: string;
  url: string;
  location: string;
  found_at: string;
  category: string;
  image_url: string | null;
}

type SortField = "price" | "found_at" | "title";
type SortDir = "asc" | "desc";

interface RecentDealsClientProps {
  initialDeals: Deal[];
  initialHours: string;
}

const PAGE_SIZE = 50;

function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function categoryLabel(cat: string) {
  const labels: Record<string, string> = {
    gpu: "GPU",
    "cpu-kit": "CPU Kit",
    ram: "RAM",
    psu: "PSU",
    ssd: "SSD",
    motherboard: "Placa Mãe",
    monitor: "Monitor",
  };
  return labels[cat] || cat.toUpperCase();
}

export function RecentDealsClient({ initialDeals, initialHours }: RecentDealsClientProps) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  // skipInitial evita refetch no mount (a RSC shell já hidratou initialDeals).
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(initialHours);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortField, setSortField] = useState<SortField>("found_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [skipInitial, setSkipInitial] = useState(true);

  async function fetchDeals(h: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/hardware/deals?hours=${h}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDeals(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar deals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (skipInitial) {
      setSkipInitial(false);
      return;
    }
    fetchDeals(hours);
  }, [hours, skipInitial]);

  const categories = useMemo(
    () => Array.from(new Set(deals.map((d) => d.category))).sort(),
    [deals],
  );

  const filtered = useMemo(() => {
    let result = [...deals];

    if (filterCategory !== "all") {
      result = result.filter((d) => d.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.item_name.toLowerCase().includes(q) ||
          d.location?.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "price":
          cmp = a.price - b.price;
          break;
        case "found_at":
          cmp = new Date(a.found_at).getTime() - new Date(b.found_at).getTime();
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [deals, filterCategory, searchQuery, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [filterCategory, searchQuery, hours]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "price" ? "asc" : "desc");
    }
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger className="w-[140px] bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Última hora</SelectItem>
                <SelectItem value="3">3 horas</SelectItem>
                <SelectItem value="6">6 horas</SelectItem>
                <SelectItem value="12">12 horas</SelectItem>
                <SelectItem value="24">24 horas</SelectItem>
                <SelectItem value="48">48 horas</SelectItem>
                <SelectItem value="72">3 dias</SelectItem>
                <SelectItem value="168">7 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px] bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {categoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-background border-border"
              />
            </div>

            <Button variant="outline" size="sm" onClick={() => fetchDeals(hours)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            <Badge variant="outline">{filtered.length} deals</Badge>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum deal encontrado nas últimas {hours}h
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("title")}
                  >
                    <div className="flex items-center gap-1">
                      Título
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("price")}
                  >
                    <div className="flex items-center gap-1">
                      Preço
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort("found_at")}
                  >
                    <div className="flex items-center gap-1">
                      Encontrado
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="max-w-[300px] truncate" title={deal.title}>
                      {deal.title}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {deal.item_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {categoryLabel(deal.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-success whitespace-nowrap">
                      {formatPrice(deal.price)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {deal.location || "-"}
                    </TableCell>
                    <TableCell
                      className="text-sm text-muted-foreground whitespace-nowrap"
                      title={formatDate(deal.found_at)}
                    >
                      {timeAgo(deal.found_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={deal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-info hover:text-info/80"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
