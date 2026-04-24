"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, RefreshCw, Package, LayoutGrid, List } from "lucide-react";
import { STORE_CATEGORIES } from "./types";
import type { StoreCategory } from "./types";
import type { SpecFilters as SpecFiltersState } from "./use-store-filters";
import { SpecFilters } from "./spec-filters";

interface StoreControlsProps {
  storeCategory: string;
  onCategoryChange: (cat: string) => void;
  storeSearch: string;
  onSearchChange: (v: string) => void;
  storeMinPrice: string;
  onMinPriceChange: (v: string) => void;
  storeMaxPrice: string;
  onMaxPriceChange: (v: string) => void;
  storeView: "grid" | "table";
  onViewChange: (v: "grid" | "table") => void;
  storeLoading: boolean;
  onRefresh: () => void;
  syncing: boolean;
  onSync: () => void;
  specs: SpecFiltersState;
  specOptions: {
    vram_gb: string[];
    capacity_gb: string[];
    wattage: string[];
    socket: string[];
    memory_type: string[];
    panel: string[];
    refresh_rate: string[];
    resolution: string[];
    form_factor: string[];
    efficiency: string[];
    manufacturer: string[];
    base_model: string[];
  };
  onSetSpec: (key: keyof SpecFiltersState, value: string) => void;
}

/**
 * Top control row: category select, search, price range, spec filters,
 * view toggle, refresh button, and sync button.
 */
export function StoreControls({
  storeCategory,
  onCategoryChange,
  storeSearch,
  onSearchChange,
  storeMinPrice,
  onMinPriceChange,
  storeMaxPrice,
  onMaxPriceChange,
  storeView,
  onViewChange,
  storeLoading,
  onRefresh,
  syncing,
  onSync,
  specs,
  specOptions,
  onSetSpec,
}: StoreControlsProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select value={storeCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px] border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STORE_CATEGORIES.map(({ value, label }) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={storeSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 border-border"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          placeholder="Min R$"
          value={storeMinPrice}
          onChange={(e) => onMinPriceChange(e.target.value)}
          className="w-24 border-border text-sm"
        />
        <span className="text-muted-foreground text-xs">-</span>
        <Input
          type="number"
          placeholder="Max R$"
          value={storeMaxPrice}
          onChange={(e) => onMaxPriceChange(e.target.value)}
          className="w-24 border-border text-sm"
        />
      </div>

      <SpecFilters
        category={storeCategory as StoreCategory}
        specs={specs}
        specOptions={specOptions}
        onSetSpec={onSetSpec}
      />

      <div className="flex items-center border border-border rounded-md">
        <button
          onClick={() => onViewChange("grid")}
          className={`p-1.5 rounded-l-md transition-colors ${
            storeView === "grid"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewChange("table")}
          className={`p-1.5 rounded-r-md transition-colors ${
            storeView === "table"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={storeLoading}
        className="border-border"
      >
        <RefreshCw className={`h-4 w-4 mr-1 ${storeLoading ? "animate-spin" : ""}`} />
        Refresh
      </Button>

      <Button size="sm" onClick={onSync} disabled={syncing}>
        {syncing ? (
          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Package className="h-4 w-4 mr-1" />
        )}
        {syncing ? "Syncing..." : "Sync to Manual Prices"}
      </Button>
    </div>
  );
}
