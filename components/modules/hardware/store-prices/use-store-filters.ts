"use client";

import { useState, useEffect, useMemo } from "react";
import type { StoreProduct } from "../types";
import type { StoreSortField } from "./types";
import { STORE_PAGE_SIZE } from "./types";

// Spec filter state — all 12 spec selects that apply per category.
export interface SpecFilters {
  vram: string;
  capacity: string;
  wattage: string;
  socket: string;
  memType: string;
  panel: string;
  refresh: string;
  resolution: string;
  formFactor: string;
  efficiency: string;
  manufacturer: string;
  baseModel: string;
}

export interface StoreFilterSetters {
  setStoreSearch: (v: string) => void;
  setStoreMinPrice: (v: string) => void;
  setStoreMaxPrice: (v: string) => void;
  setStoreSortField: (v: StoreSortField) => void;
  setStoreSortDir: (v: "asc" | "desc") => void;
  setStorePage: (v: number | ((prev: number) => number)) => void;
  setSpec: (key: keyof SpecFilters, value: string) => void;
}

export interface StoreFilterState {
  storeSearch: string;
  storeMinPrice: string;
  storeMaxPrice: string;
  storeSortField: StoreSortField;
  storeSortDir: "asc" | "desc";
  storePage: number;
  specs: SpecFilters;
}

export interface UseStoreFiltersResult {
  filterState: StoreFilterState;
  setters: StoreFilterSetters;
  resetSpecs: () => void;
  specOptions: ReturnType<typeof buildSpecOptions>;
  filteredProducts: StoreProduct[];
  pagedProducts: StoreProduct[];
  totalPages: number;
}

function buildSpecOptions(storeProducts: StoreProduct[]) {
  const extract = (key: string): string[] => {
    const vals = new Set<string>();
    for (const p of storeProducts) {
      const v = p.specs?.[key];
      if (v !== undefined && v !== null && v !== true && v !== false)
        vals.add(String(v));
    }
    return [...vals].sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  };
  return {
    vram_gb: extract("vram_gb"),
    capacity_gb: extract("capacity_gb"),
    wattage: extract("wattage"),
    socket: extract("socket"),
    memory_type: [...new Set([...extract("memory_type"), ...extract("type")])].sort(),
    panel: extract("panel"),
    refresh_rate: extract("refresh_rate"),
    resolution: extract("resolution"),
    form_factor: extract("form_factor"),
    efficiency: extract("efficiency"),
    manufacturer: [
      ...new Set(storeProducts.map((p) => p.manufacturer).filter(Boolean)),
    ].sort(),
    base_model: [
      ...new Set(storeProducts.map((p) => p.base_model).filter(Boolean) as string[]),
    ].sort(),
  };
}

const EMPTY_SPECS: SpecFilters = {
  vram: "", capacity: "", wattage: "", socket: "", memType: "",
  panel: "", refresh: "", resolution: "", formFactor: "", efficiency: "",
  manufacturer: "", baseModel: "",
};

/**
 * Encapsulates all filter, sort, and pagination state for the Store Prices tab.
 * Spec options are derived from the current product list — recomputed on storeProducts change.
 */
export function useStoreFilters(storeProducts: StoreProduct[]): UseStoreFiltersResult {
  const [storeSearch, setStoreSearch] = useState("");
  const [storeMinPrice, setStoreMinPrice] = useState("");
  const [storeMaxPrice, setStoreMaxPrice] = useState("");
  const [storeSortField, setStoreSortField] = useState<StoreSortField>("cash_price");
  const [storeSortDir, setStoreSortDir] = useState<"asc" | "desc">("asc");
  const [storePage, setStorePage] = useState(1);
  const [specs, setSpecs] = useState<SpecFilters>(EMPTY_SPECS);

  const setSpec = (key: keyof SpecFilters, value: string) => {
    setSpecs((prev) => ({ ...prev, [key]: value }));
  };

  const resetSpecs = () => setSpecs(EMPTY_SPECS);

  // Reset page to 1 when any filter changes.
  useEffect(() => {
    setStorePage(1);
  }, [
    storeSearch, storeMinPrice, storeMaxPrice,
    specs.vram, specs.capacity, specs.wattage, specs.socket, specs.memType,
    specs.panel, specs.refresh, specs.resolution, specs.formFactor, specs.efficiency,
  ]);

  const specOptions = useMemo(() => buildSpecOptions(storeProducts), [storeProducts]);

  const filteredProducts = useMemo(() => {
    let result = storeProducts;
    if (storeSearch.trim()) {
      const q = storeSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.manufacturer.toLowerCase().includes(q) ||
          p.merchant.toLowerCase().includes(q)
      );
    }
    const minP = parseFloat(storeMinPrice);
    if (!isNaN(minP)) result = result.filter((p) => p.cash_price >= minP);
    const maxP = parseFloat(storeMaxPrice);
    if (!isNaN(maxP)) result = result.filter((p) => p.cash_price <= maxP);
    if (specs.vram) result = result.filter((p) => String(p.specs?.vram_gb) === specs.vram);
    if (specs.capacity) result = result.filter((p) => String(p.specs?.capacity_gb) === specs.capacity);
    if (specs.wattage) result = result.filter((p) => String(p.specs?.wattage) === specs.wattage);
    if (specs.socket) result = result.filter((p) => String(p.specs?.socket || "") === specs.socket);
    if (specs.memType) result = result.filter((p) => (p.specs?.memory_type || p.specs?.type || "") === specs.memType);
    if (specs.panel) result = result.filter((p) => String(p.specs?.panel || "") === specs.panel);
    if (specs.refresh) result = result.filter((p) => String(p.specs?.refresh_rate) === specs.refresh);
    if (specs.resolution) result = result.filter((p) => String(p.specs?.resolution || "") === specs.resolution);
    if (specs.formFactor) result = result.filter((p) => String(p.specs?.form_factor || "") === specs.formFactor);
    if (specs.efficiency) result = result.filter((p) => String(p.specs?.efficiency || "") === specs.efficiency);
    if (specs.manufacturer) result = result.filter((p) => p.manufacturer === specs.manufacturer);
    if (specs.baseModel) result = result.filter((p) => p.base_model === specs.baseModel);
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (storeSortField === "cash_price") cmp = a.cash_price - b.cash_price;
      else cmp = (a[storeSortField] || "").localeCompare(b[storeSortField] || "");
      return storeSortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [storeProducts, storeSearch, storeMinPrice, storeMaxPrice, storeSortField, storeSortDir, specs]);

  const totalPages = Math.ceil(filteredProducts.length / STORE_PAGE_SIZE);
  const pagedProducts = filteredProducts.slice(
    (storePage - 1) * STORE_PAGE_SIZE,
    storePage * STORE_PAGE_SIZE
  );

  return {
    filterState: { storeSearch, storeMinPrice, storeMaxPrice, storeSortField, storeSortDir, storePage, specs },
    setters: { setStoreSearch, setStoreMinPrice, setStoreMaxPrice, setStoreSortField, setStoreSortDir, setStorePage, setSpec },
    resetSpecs,
    specOptions,
    filteredProducts,
    pagedProducts,
    totalPages,
  };
}
