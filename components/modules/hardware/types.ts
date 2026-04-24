// Shared types for the hardware module (deals page + builder page).
// The hardware API is an external Python FastAPI service at NEXT_PUBLIC_HARDWARE_API_URL.

export interface Deal {
  id: number;
  item_name: string;
  title: string;
  price: number;
  currency: string;
  source: string;
  url: string;
  location: string;
  found_at: string;
  category: string;
  image_url: string | null;
  image_urls: string[];
}

export interface SummaryItem {
  item_name: string;
  category: string;
  total_deals: number;
  min_price: number;
  avg_price: number;
  max_price: number;
}

// ConfigItem used in the deals page Items tab (has id + keywords + scrape_enabled).
export interface HardwareConfigItem {
  id: number;
  name: string;
  keywords: string[];
  max_price: number;
  category: string;
  specs: Record<string, number | string>;
  scrape_enabled: boolean;
}

// ConfigItem used in the builder page (no id/keywords/scrape_enabled — fetched from /api/items).
export interface BuilderConfigItem {
  name: string;
  category: string;
  specs: Record<string, number | string>;
}

export interface ManualPrice {
  item_name: string;
  price_new: number | null;
  price_aliexpress: number | null;
  price_reference: number | null;
  notes: string;
}

export interface StoreProduct {
  name: string;
  manufacturer: string;
  cash_price: number;
  installment_price: number | null;
  merchant: string;
  url: string | null;
  category: string;
  rating: number | null;
  free_shipping: boolean;
  tag: string | null;
  details: string | null;
  specs: Record<string, number | string | boolean> | null;
  base_model: string | null;
}

export interface SyncResult {
  item: string;
  new_price: number;
  product: string;
  merchant: string;
}

export interface PriceCompItem {
  item_name: string;
  category: string;
  max_price: number;
  olx_min: number | null;
  olx_avg: number | null;
  olx_count: number;
  price_new: number | null;
  price_aliexpress: number | null;
  savings_pct: number | null;
  notes: string | null;
}

// Builder-specific types
export interface NewPriceResult {
  item_name: string;
  price_new: number | null;
  product: string | null;
  merchant: string | null;
  source: string;
}

export interface SelectedComponent {
  item: BuilderConfigItem;
  quantity: number;
}

export interface BuildConfig {
  gpu: SelectedComponent | null;
  cpuKit: SelectedComponent | null;
  ram: SelectedComponent | null;
  psu: SelectedComponent | null;
  ssd: SelectedComponent | null;
  motherboard: SelectedComponent | null;
}

export interface BuildTotals {
  vramTotal: number;
  ramTotal: number;
  threadsTotal: number;
  tdpTotal: number;
  usedBestTotal: number;
  usedAvgTotal: number;
  newTotal: number;
}

export interface SavedBuild {
  name: string;
  savedAt: string;
  gpu: string;
  gpuQty: number;
  cpuKit: string;
  ram: string;
  ramQty: number;
  psu: string;
  ssd: string;
  motherboard: string;
  vmVram: number;
  vmRam: number;
  vmThreads: number;
  vmCount: number;
}

export type SortField = "price" | "found_at" | "title" | "source" | "location";
export type SortDir = "asc" | "desc";
