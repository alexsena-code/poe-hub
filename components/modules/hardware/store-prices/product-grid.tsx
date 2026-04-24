"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Plus } from "lucide-react";
import { formatPriceBrl } from "../helpers";
import type { StoreProduct } from "../types";

interface ProductGridProps {
  products: StoreProduct[];
  onLoadIntoItemForm: (product: StoreProduct, withSpecs: boolean) => void;
}

function SpecBadge({ specKey, value }: { specKey: string; value: string }) {
  const suffix =
    specKey.includes("gb") ? "GB"
    : specKey.includes("mhz") ? "MHz"
    : specKey === "wattage" ? "W"
    : specKey === "refresh_rate" ? "Hz"
    : specKey.includes("inches") ? '"'
    : "";
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
      {value}{suffix}
    </span>
  );
}

function ProductCard({
  product,
  idx,
  onLoadIntoItemForm,
}: {
  product: StoreProduct;
  idx: number;
  onLoadIntoItemForm: (product: StoreProduct, withSpecs: boolean) => void;
}) {
  const visibleSpecs = product.specs
    ? Object.entries(product.specs).filter(([, v]) => v !== true && v !== false).slice(0, 4)
    : [];

  return (
    <Card
      key={`${product.name}-${idx}`}
      className="bg-card border-border hover:border-primary/50 transition-colors"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-tight truncate" title={product.name}>
              {product.name}
            </p>
            <p className="text-xs text-muted-foreground">{product.manufacturer}</p>
          </div>
          {product.rating && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {product.rating.toFixed(1)}
            </Badge>
          )}
        </div>

        {visibleSpecs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {visibleSpecs.map(([k, v]) => (
              <SpecBadge key={k} specKey={k} value={String(v)} />
            ))}
          </div>
        )}

        <div className="flex items-end justify-between mt-3">
          <div>
            <p className="text-lg font-bold text-green-400">
              {formatPriceBrl(product.cash_price)}
            </p>
            {product.installment_price && (
              <p className="text-xs text-muted-foreground">
                ou {formatPriceBrl(product.installment_price)} parcelado
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground truncate max-w-[100px]" title={product.merchant}>
              {product.merchant}
            </p>
            {product.free_shipping && (
              <Badge variant="secondary" className="text-xs mt-0.5">
                Frete gratis
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 mt-3">
          {product.url && (
            <a href={product.url} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button variant="outline" size="sm" className="w-full h-7 text-xs border-border">
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs border-border hover:bg-primary/10 hover:text-primary"
            onClick={() => onLoadIntoItemForm(product, true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Item
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Product card grid — renders pagedProducts as a responsive 4-column grid. */
export function ProductGrid({ products, onLoadIntoItemForm }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {products.map((product, idx) => (
        <ProductCard
          key={`${product.name}-${idx}`}
          product={product}
          idx={idx}
          onLoadIntoItemForm={onLoadIntoItemForm}
        />
      ))}
    </div>
  );
}
