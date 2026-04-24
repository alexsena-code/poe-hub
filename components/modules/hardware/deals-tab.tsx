"use client";

import { useMemo, useEffect, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExternalLink,
  Search,
  ArrowUpDown,
  Ban,
  Trash2,
  LayoutGrid,
  List,
} from "lucide-react";
import { DealImageCarousel } from "./deal-image-carousel";
import { formatPriceBrl, formatDealDate, categoryLabel } from "./helpers";
import type { Deal, SortField, SortDir } from "./types";

const DEALS_PAGE_SIZE = 50;

interface DealsTabProps {
  deals: Deal[];
  onDeleteDeal: (id: number) => void;
  onBanDeal: (id: number, title: string) => void;
}

/** Sortable table header cell for the deals list view. */
function SortHeader({
  field,
  currentField,
  currentDir,
  onSort,
  children,
}: {
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
  children: React.ReactNode;
}) {
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );
}

/**
 * Deals tab — filter bar, list/card toggle, paginated deals table/grid,
 * delete and ban actions. Receives deals from the parent page which owns
 * all fetch state; mutations bubble up via callbacks so the parent can
 * refresh or optimistically remove items.
 */
export function DealsTab({ deals, onDeleteDeal, onBanDeal }: DealsTabProps) {
  const [filterName, setFilterName] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterTimeHours, setFilterTimeHours] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dealsPage, setDealsPage] = useState(1);
  const [dealsView, setDealsView] = useState<"list" | "cards">("list");
  const [sortField, setSortField] = useState<SortField>("found_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const uniqueNames = useMemo(
    () => Array.from(new Set(deals.map((d) => d.item_name))).sort(),
    [deals]
  );
  const uniqueSources = useMemo(
    () => Array.from(new Set(deals.map((d) => d.source))).sort(),
    [deals]
  );
  const uniqueCategories = useMemo(
    () => Array.from(new Set(deals.map((d) => d.category))).sort(),
    [deals]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredDeals = useMemo(() => {
    let result = [...deals];

    if (filterName !== "all") result = result.filter((d) => d.item_name === filterName);
    if (filterSource !== "all") result = result.filter((d) => d.source === filterSource);
    if (filterCategory !== "all") result = result.filter((d) => d.category === filterCategory);

    const min = parseFloat(filterMinPrice);
    if (!isNaN(min)) result = result.filter((d) => d.price >= min);

    const max = parseFloat(filterMaxPrice);
    if (!isNaN(max)) result = result.filter((d) => d.price <= max);

    if (filterTimeHours !== "all") {
      const hours = parseInt(filterTimeHours);
      if (!isNaN(hours)) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        result = result.filter((d) => new Date(d.found_at) >= since);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.item_name.toLowerCase().includes(q) ||
          d.location?.toLowerCase().includes(q)
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
        case "source":
          cmp = a.source.localeCompare(b.source);
          break;
        case "location":
          cmp = (a.location || "").localeCompare(b.location || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    deals,
    filterName,
    filterSource,
    filterCategory,
    filterMinPrice,
    filterMaxPrice,
    filterTimeHours,
    searchQuery,
    sortField,
    sortDir,
  ]);

  // Reset to first page whenever filters change.
  useEffect(() => {
    setDealsPage(1);
  }, [filterName, filterSource, filterCategory, filterMinPrice, filterMaxPrice, filterTimeHours, searchQuery]);

  const totalDealsPages = Math.ceil(filteredDeals.length / DEALS_PAGE_SIZE);
  const pagedDeals = filteredDeals.slice(
    (dealsPage - 1) * DEALS_PAGE_SIZE,
    dealsPage * DEALS_PAGE_SIZE
  );

  return (
    <>
      <Card className="bg-card border-border">
        <CardContent className="pt-4 pb-0">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>
            <Select value={filterName} onValueChange={setFilterName}>
              <SelectTrigger className="w-[180px] bg-background border-border">
                <SelectValue placeholder="Item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                {uniqueNames.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[140px] bg-background border-border">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map((s) => (
                  <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px] bg-background border-border">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((c) => (
                  <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Min R$"
              type="number"
              value={filterMinPrice}
              onChange={(e) => setFilterMinPrice(e.target.value)}
              className="w-[100px] bg-background border-border"
            />
            <Input
              placeholder="Max R$"
              type="number"
              value={filterMaxPrice}
              onChange={(e) => setFilterMaxPrice(e.target.value)}
              className="w-[100px] bg-background border-border"
            />
            <Select value={filterTimeHours} onValueChange={setFilterTimeHours}>
              <SelectTrigger className="w-[130px] bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="1">1 hora</SelectItem>
                <SelectItem value="3">3 horas</SelectItem>
                <SelectItem value="6">6 horas</SelectItem>
                <SelectItem value="12">12 horas</SelectItem>
                <SelectItem value="24">24 horas</SelectItem>
                <SelectItem value="48">48 horas</SelectItem>
                <SelectItem value="72">3 dias</SelectItem>
                <SelectItem value="168">7 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Count + view toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                {filteredDeals.length} deals found
              </p>
              <div className="flex items-center border border-border rounded-md">
                <button
                  onClick={() => setDealsView("list")}
                  className={`p-1.5 rounded-l-md transition-colors ${dealsView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDealsView("cards")}
                  className={`p-1.5 rounded-r-md transition-colors ${dealsView === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
            {totalDealsPages > 1 && (
              <p className="text-xs text-muted-foreground">
                Page {dealsPage} of {totalDealsPages}
              </p>
            )}
          </div>

          {/* Cards view */}
          {dealsView === "cards" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
              {pagedDeals.length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                  No deals found
                </p>
              ) : (
                pagedDeals.map((deal) => (
                  <Card
                    key={deal.id}
                    className="bg-card border-border hover:border-primary/50 transition-colors overflow-hidden"
                  >
                    <DealImageCarousel deal={deal} />
                    <CardContent className="p-3">
                      <p
                        className="font-medium text-sm leading-tight line-clamp-2 mb-1"
                        title={deal.title}
                      >
                        {deal.title}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px]">
                          {deal.item_name}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {deal.source.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-lg font-bold text-green-400">
                        {formatPriceBrl(deal.price)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {deal.location}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDealDate(deal.found_at)}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        <a
                          href={deal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-xs border-border"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> View
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-orange-400"
                          onClick={() => onBanDeal(deal.id, deal.title)}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                          onClick={() => onDeleteDeal(deal.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* List/table view */}
          {dealsView === "list" && (
            <div className="rounded-md border border-border overflow-hidden">
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-none">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow className="border-border hover:bg-transparent">
                      <SortHeader
                        field="title"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                      >
                        Title
                      </SortHeader>
                      <TableHead>Item</TableHead>
                      <SortHeader
                        field="price"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                      >
                        Price
                      </SortHeader>
                      <SortHeader
                        field="source"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                      >
                        Source
                      </SortHeader>
                      <SortHeader
                        field="location"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                      >
                        Location
                      </SortHeader>
                      <SortHeader
                        field="found_at"
                        currentField={sortField}
                        currentDir={sortDir}
                        onSort={handleSort}
                      >
                        Found
                      </SortHeader>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeals.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          No deals found
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedDeals.map((deal) => (
                        <TableRow
                          key={deal.id}
                          className="border-border hover:bg-foreground/5"
                        >
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm truncate text-card-foreground">
                              {deal.title}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {deal.item_name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-500 whitespace-nowrap">
                              {formatPriceBrl(deal.price)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={deal.source === "olx" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {deal.source.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                            {deal.location || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDealDate(deal.found_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <a
                                href={deal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-orange-400"
                                title="Ban — never re-import"
                                onClick={() => onBanDeal(deal.id, deal.title)}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                title="Delete"
                                onClick={() => onDeleteDeal(deal.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deals pagination */}
      {totalDealsPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={dealsPage <= 1}
            onClick={() => setDealsPage((p) => p - 1)}
            className="border-border"
          >
            Previous
          </Button>
          {Array.from({ length: Math.min(totalDealsPages, 7) }, (_, i) => {
            let page: number;
            if (totalDealsPages <= 7) page = i + 1;
            else if (dealsPage <= 4) page = i + 1;
            else if (dealsPage >= totalDealsPages - 3) page = totalDealsPages - 6 + i;
            else page = dealsPage - 3 + i;
            return (
              <Button
                key={page}
                variant={dealsPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setDealsPage(page)}
                className={`w-8 h-8 p-0 ${dealsPage !== page ? "border-border" : ""}`}
              >
                {page}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            disabled={dealsPage >= totalDealsPages}
            onClick={() => setDealsPage((p) => p + 1)}
            className="border-border"
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
