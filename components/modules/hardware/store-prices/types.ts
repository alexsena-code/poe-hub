// Local types for the Store Prices tab only.
// Shared types (StoreProduct, SyncResult, PriceCompItem) live in ../types.ts.

export type StoreSortField = "cash_price" | "name" | "manufacturer" | "merchant";

export const STORE_PAGE_SIZE = 24;

export const STORE_CATEGORIES = [
  { value: "gpu", label: "GPUs" },
  { value: "cpu", label: "CPUs" },
  { value: "ram", label: "RAM" },
  { value: "motherboard", label: "Motherboards" },
  { value: "ssd", label: "SSDs" },
  { value: "psu", label: "Power Supplies" },
  { value: "cooler", label: "CPU Coolers" },
  { value: "case", label: "Cases" },
  { value: "monitor", label: "Monitors" },
] as const;

export type StoreCategory = typeof STORE_CATEGORIES[number]["value"];
