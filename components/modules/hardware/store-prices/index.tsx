"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { generateKeywords } from "../helpers";
import type { StoreProduct } from "../types";
import type { PrefilledItemValues } from "../items-tab";
import { useStoreState } from "./use-store-state";
import { useStoreFilters } from "./use-store-filters";
import { StoreControls } from "./store-controls";
import { SyncPanel } from "./sync-panel";
import { ProductGrid } from "./product-grid";
import { ProductTable } from "./product-table";
import { PriceComparisonPanel } from "./price-comparison-panel";

interface StorePricesTabProps {
  hardwareApiUrl: string;
  onLoadIntoItemForm: (values: PrefilledItemValues) => void;
  onSyncComplete: () => void;
}

/**
 * Store Prices tab — PCBuildWizard BR live prices feed.
 * Fetches per-category, supports spec filters, grid/table views, pagination.
 * "Sync to Manual Prices" writes back to the hardware API and triggers a
 * parent re-fetch (onSyncComplete). "Add Item" pre-fills the Items form tab.
 *
 * Architecture: useStoreState owns fetch/sync lifecycle; useStoreFilters owns
 * all filter/sort/pagination derived state. A ref bridges the circular dep
 * (resetSpecs must fire when category changes inside useStoreState).
 */
export function StorePricesTab({
  hardwareApiUrl,
  onLoadIntoItemForm,
  onSyncComplete,
}: StorePricesTabProps) {
  const [storeView, setStoreView] = useState<"grid" | "table">("grid");

  // A ref lets useStoreState call resetSpecs (from useStoreFilters) without
  // a circular hook dependency — the ref is populated after both hooks init.
  const resetSpecsRef = useRef<() => void>(() => {});
  const onCategoryChange = useCallback(() => resetSpecsRef.current(), []);

  const {
    storeProducts,
    storeCategory,
    setStoreCategory,
    storeLoading,
    syncing,
    syncResults,
    priceComparison,
    fetchStoreProducts,
    handleSyncNewPrices,
  } = useStoreState(hardwareApiUrl, onSyncComplete, onCategoryChange);

  const {
    filterState,
    setters,
    resetSpecs,
    specOptions,
    filteredProducts,
    pagedProducts,
    totalPages,
  } = useStoreFilters(storeProducts);

  // Populate the ref so the already-registered onCategoryChange callback
  // picks up the real resetSpecs after hooks are initialised.
  resetSpecsRef.current = resetSpecs;

  const handleLoadIntoItemForm = (product: StoreProduct, withSpecs = false) => {
    const specsRaw = withSpecs && product.specs
      ? Object.fromEntries(
          Object.entries(product.specs)
            .filter(([, v]) => v !== true && v !== false)
            .map(([k, v]) => [k, String(v)])
        )
      : {};
    onLoadIntoItemForm({
      name: product.name,
      category: storeCategory === "cpu" ? "cpu-kit" : storeCategory,
      maxPrice: String(Math.round(product.cash_price)),
      keywords: generateKeywords(product.name),
      specs: specsRaw,
      scrapeEnabled: false,
    });
  };

  const handleSort = (field: typeof filterState.storeSortField) => {
    if (filterState.storeSortField === field) {
      setters.setStoreSortDir(filterState.storeSortDir === "asc" ? "desc" : "asc");
    } else {
      setters.setStoreSortField(field);
      setters.setStoreSortDir("asc");
    }
  };

  return (
    <div className="space-y-4">
      <StoreControls
        storeCategory={storeCategory}
        onCategoryChange={setStoreCategory}
        storeSearch={filterState.storeSearch}
        onSearchChange={setters.setStoreSearch}
        storeMinPrice={filterState.storeMinPrice}
        onMinPriceChange={setters.setStoreMinPrice}
        storeMaxPrice={filterState.storeMaxPrice}
        onMaxPriceChange={setters.setStoreMaxPrice}
        storeView={storeView}
        onViewChange={setStoreView}
        storeLoading={storeLoading}
        onRefresh={() => fetchStoreProducts(storeCategory)}
        syncing={syncing}
        onSync={handleSyncNewPrices}
        specs={filterState.specs}
        specOptions={specOptions}
        onSetSpec={setters.setSpec}
      />

      <SyncPanel syncResults={syncResults} />

      {storeLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            No products found for this category.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filteredProducts.length} products
              {filterState.storeSearch.trim() ? ` matching "${filterState.storeSearch}"` : ""}
            </span>
            {totalPages > 1 && (
              <span>Page {filterState.storePage} of {totalPages}</span>
            )}
          </div>

          {storeView === "grid" ? (
            <ProductGrid
              products={pagedProducts}
              onLoadIntoItemForm={handleLoadIntoItemForm}
            />
          ) : (
            <ProductTable
              products={pagedProducts}
              hardwareApiUrl={hardwareApiUrl}
              sortField={filterState.storeSortField}
              sortDir={filterState.storeSortDir}
              onSort={handleSort}
              onLoadIntoItemForm={handleLoadIntoItemForm}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filterState.storePage <= 1}
                onClick={() => setters.setStorePage((p) => p - 1)}
                className="border-border"
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) page = i + 1;
                else if (filterState.storePage <= 4) page = i + 1;
                else if (filterState.storePage >= totalPages - 3) page = totalPages - 6 + i;
                else page = filterState.storePage - 3 + i;
                return (
                  <Button
                    key={page}
                    variant={filterState.storePage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setters.setStorePage(page)}
                    className={`w-8 h-8 p-0 ${filterState.storePage !== page ? "border-border" : ""}`}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={filterState.storePage >= totalPages}
                onClick={() => setters.setStorePage((p) => p + 1)}
                className="border-border"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <PriceComparisonPanel priceComparison={priceComparison} />
    </div>
  );
}
