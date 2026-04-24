// Local types for the hardware settings page (categories, proxies, worker status).
// These are settings-page-only — not shared with the deals/builder pages.

export interface OlxCategory {
  id: number;
  path: string;
  label: string;
  is_active: boolean;
  allowed_item_categories: string[];
}

export interface Proxy {
  id: number;
  url: string;
  is_active: boolean;
  fail_count: number;
  last_used: string | null;
  last_success: string | null;
  last_error: string | null;
}

export interface WorkerStatus {
  online: boolean;
}

export const ITEM_CATEGORIES = [
  { value: "gpu", label: "GPU" },
  { value: "cpu-kit", label: "CPU Kit" },
  { value: "ram", label: "RAM" },
  { value: "psu", label: "PSU (Fonte)" },
  { value: "ssd", label: "SSD" },
  { value: "motherboard", label: "Placa Mãe" },
  { value: "monitor", label: "Monitor" },
] as const;

export const SUGGESTED_CATEGORIES = [
  { path: "/eletronicos", label: "Eletronicos" },
  { path: "/para-a-sua-casa", label: "Para a sua casa" },
  { path: "/celulares-e-telefones", label: "Celulares e Telefones" },
  { path: "/video-games", label: "Video Games" },
];
