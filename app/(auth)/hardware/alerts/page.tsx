"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/ui/page-header";
import {
  ExternalLink,
  RefreshCw,
  ArrowUpDown,
  Percent,
} from "lucide-react";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

interface Deal {
  id: number;
  item_name: string;
  title: string;
  price: number;
  source: string;
  url: string;
  location: string;
  found_at: string;
  category: string;
}

interface Item {
  id: number;
  name: string;
  max_price: number;
  category: string;
}

type SortField = "discount" | "price" | "found_at";
type SortDir = "asc" | "desc";

export default function AlertsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState("24");
  const [filterCategory, setFilterCategory] = useState("all");
  const [threshold, setThreshold] = useState(60); // % minimum discount
  const [sortField, setSortField] = useState<SortField>("discount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const fetchAll = async (h: string) => {
    setLoading(true);
    try {
      const [dealsRes, itemsRes] = await Promise.all([
        fetch(`${HARDWARE_API}/api/deals?hours=${h}`),
        fetch(`${HARDWARE_API}/api/items`),
      ]);
      if (!dealsRes.ok || !itemsRes.ok) throw new Error();
      const dealsData = await dealsRes.json();
      const itemsData = await itemsRes.json();
      setDeals(Array.isArray(dealsData) ? dealsData : []);
      setItems(Array.isArray(itemsData) ? itemsData : []);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(hours);
  }, [hours]);

  const itemsMap = useMemo(() => {
    const m = new Map<string, Item>();
    items.forEach((i) => m.set(i.name, i));
    return m;
  }, [items]);

  // Annotate deals with discount %
  const annotated = useMemo(() => {
    return deals
      .map((d) => {
        const item = itemsMap.get(d.item_name);
        if (!item || !item.max_price || d.price <= 0) return null;
        const discount = Math.round((1 - d.price / item.max_price) * 100);
        return { ...d, max_price: item.max_price, discount };
      })
      .filter((d): d is Deal & { max_price: number; discount: number } => d !== null);
  }, [deals, itemsMap]);

  const categories = useMemo(
    () => Array.from(new Set(annotated.map((d) => d.category))).sort(),
    [annotated]
  );

  const filtered = useMemo(() => {
    let result = annotated.filter((d) => d.discount >= threshold);
    if (filterCategory !== "all") {
      result = result.filter((d) => d.category === filterCategory);
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "discount":
          cmp = a.discount - b.discount;
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "found_at":
          cmp = new Date(a.found_at).getTime() - new Date(b.found_at).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [annotated, threshold, filterCategory, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [threshold, filterCategory, hours]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "price" ? "asc" : "desc");
    }
  };

  const categoryLabel = (cat: string) => {
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
  };

  const discountColor = (d: number) => {
    if (d >= 70) return "text-emerald-400";
    if (d >= 50) return "text-green-500";
    if (d >= 30) return "text-yellow-500";
    return "text-orange-500";
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Alertas de Desconto"
        description="Deals abaixo do limite de preço, ordenados por % de desconto"
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-4">
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAll(hours)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            <Badge variant="outline" className="ml-auto">
              {filtered.length} de {annotated.length} deals
            </Badge>
          </div>

          {/* Threshold slider */}
          <div className="flex items-center gap-3">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm whitespace-nowrap">Desconto mínimo:</span>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="flex-1 accent-primary h-2 cursor-pointer"
            />
            <span className={`text-sm font-bold w-12 text-right ${discountColor(threshold)}`}>
              {threshold}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum deal com desconto ≥ {threshold}% nas últimas {hours}h
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <SortHeader field="price">Preço</SortHeader>
                  <TableHead>Max</TableHead>
                  <SortHeader field="discount">Desconto</SortHeader>
                  <SortHeader field="found_at">Encontrado</SortHeader>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="text-sm whitespace-nowrap font-medium">
                      {deal.item_name}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate" title={deal.title}>
                      {deal.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {categoryLabel(deal.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-green-500 whitespace-nowrap">
                      {formatPrice(deal.price)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatPrice(deal.max_price)}
                    </TableCell>
                    <TableCell className={`font-bold whitespace-nowrap ${discountColor(deal.discount)}`}>
                      {deal.discount}%
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {timeAgo(deal.found_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={deal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-400"
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
    </div>
  );
}
