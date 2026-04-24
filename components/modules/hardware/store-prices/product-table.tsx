"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, Plus, ArrowUpDown } from "lucide-react";
import { formatPriceBrl } from "../helpers";
import type { StoreProduct } from "../types";
import type { StoreSortField } from "./types";

interface ProductTableProps {
  products: StoreProduct[];
  hardwareApiUrl: string;
  sortField: StoreSortField;
  sortDir: "asc" | "desc";
  onSort: (field: StoreSortField) => void;
  onLoadIntoItemForm: (product: StoreProduct, withSpecs: boolean) => void;
}

function SortableHead({
  field,
  label,
  currentField,
  onSort,
}: {
  field: StoreSortField;
  label: string;
  currentField: StoreSortField;
  onSort: (field: StoreSortField) => void;
}) {
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${currentField === field ? "opacity-100" : "opacity-50"}`} />
      </div>
    </TableHead>
  );
}

function SpecsCell({ specs }: { specs: StoreProduct["specs"] }) {
  if (!specs || Object.keys(specs).length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  const entries = Object.entries(specs)
    .filter(([, v]) => v !== true && v !== false)
    .slice(0, 4);
  return (
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      {entries.map(([k, v]) => {
        const suffix =
          k.includes("gb") ? "GB"
          : k.includes("mhz") ? "MHz"
          : k === "wattage" ? "W"
          : k === "refresh_rate" ? "Hz"
          : k.includes("inches") ? '"'
          : "";
        return (
          <span key={k} className="text-[10px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground">
            {String(v)}{suffix}
          </span>
        );
      })}
    </div>
  );
}

/** Product table view — dense row layout with inline base_model editing. */
export function ProductTable({
  products,
  hardwareApiUrl,
  sortField,
  sortDir,
  onSort,
  onLoadIntoItemForm,
}: ProductTableProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-border hover:bg-transparent">
                <SortableHead field="name" label="Product" currentField={sortField} onSort={onSort} />
                <SortableHead field="manufacturer" label="Brand" currentField={sortField} onSort={onSort} />
                <TableHead className="text-right">
                  <SortableHead field="cash_price" label="Price" currentField={sortField} onSort={onSort} />
                </TableHead>
                <TableHead>Installment</TableHead>
                <SortableHead field="merchant" label="Store" currentField={sortField} onSort={onSort} />
                <TableHead>Model</TableHead>
                <TableHead>Specs</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product, idx) => (
                <TableRow key={`${product.name}-${idx}`} className="border-border hover:bg-muted/5">
                  <TableCell className="max-w-[280px]">
                    <p className="font-medium text-sm truncate" title={product.name}>
                      {product.name}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {product.manufacturer}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-400">
                    {formatPriceBrl(product.cash_price)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {product.installment_price ? formatPriceBrl(product.installment_price) : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[100px]" title={product.merchant}>
                        {product.merchant}
                      </span>
                      {product.free_shipping && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          Frete
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* Inline base_model edit — silent fail is acceptable here */}
                    <input
                      className="text-xs bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-28 text-muted-foreground"
                      defaultValue={product.base_model || ""}
                      placeholder="-"
                      onBlur={async (e) => {
                        const val = e.target.value.trim();
                        if (val !== (product.base_model || "") && product.tag) {
                          try {
                            await fetch(
                              `${hardwareApiUrl}/api/store-products/${product.tag}/base-model?base_model=${encodeURIComponent(val)}`,
                              { method: "PUT" }
                            );
                          } catch {
                            // Inline edit — silent fail is acceptable here
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <SpecsCell specs={product.specs} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {product.rating ? product.rating.toFixed(1) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {product.url && (
                        <a href={product.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        title="Add to Items"
                        onClick={() => onLoadIntoItemForm(product, false)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
