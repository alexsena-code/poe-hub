"use client";

import { useState, useEffect } from "react";
import type { StoreProduct, SyncResult, PriceCompItem } from "../types";

export interface UseStoreStateResult {
  storeProducts: StoreProduct[];
  storeCategory: string;
  setStoreCategory: (cat: string) => void;
  storeLoading: boolean;
  syncing: boolean;
  syncResults: SyncResult[];
  priceComparison: PriceCompItem[];
  fetchStoreProducts: (cat: string) => Promise<void>;
  handleSyncNewPrices: () => Promise<void>;
}

/**
 * Manages fetch lifecycle, sync, and priceComparison for the Store Prices tab.
 * Calls `onSyncComplete` after a successful sync to trigger parent re-fetches.
 * Category changes automatically reset spec filters via the `onCategoryChange` callback.
 */
export function useStoreState(
  hardwareApiUrl: string,
  onSyncComplete: () => void,
  onCategoryChange: () => void,
): UseStoreStateResult {
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [storeCategory, setStoreCategoryRaw] = useState("gpu");
  const [storeLoading, setStoreLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [priceComparison, setPriceComparison] = useState<PriceCompItem[]>([]);

  const fetchStoreProducts = async (cat: string) => {
    setStoreLoading(true);
    try {
      const res = await fetch(`${hardwareApiUrl}/api/new-prices/${cat}`);
      const data = await res.json();
      setStoreProducts(Array.isArray(data) ? data : []);
    } catch {
      setStoreProducts([]);
    } finally {
      setStoreLoading(false);
    }
  };

  const fetchPriceComparison = async () => {
    try {
      const res = await fetch(`${hardwareApiUrl}/api/analytics/price-comparison`);
      const data = await res.json();
      setPriceComparison(Array.isArray(data) ? data : []);
    } catch {
      setPriceComparison([]);
    }
  };

  // Reset spec filters on category change so stale values don't carry over.
  const setStoreCategory = (cat: string) => {
    setStoreCategoryRaw(cat);
    onCategoryChange();
  };

  useEffect(() => {
    fetchStoreProducts(storeCategory);
    fetchPriceComparison();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCategory]);

  const handleSyncNewPrices = async () => {
    setSyncing(true);
    setSyncResults([]);
    try {
      const res = await fetch(`${hardwareApiUrl}/api/sync-new-prices`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.status === "ok") {
        setSyncResults(data.items || []);
        onSyncComplete();
        fetchPriceComparison();
      }
    } finally {
      setSyncing(false);
    }
  };

  return {
    storeProducts,
    storeCategory,
    setStoreCategory,
    storeLoading,
    syncing,
    syncResults,
    priceComparison,
    fetchStoreProducts,
    handleSyncNewPrices,
  };
}
