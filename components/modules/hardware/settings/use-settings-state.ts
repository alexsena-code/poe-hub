"use client";

// Hook that owns all fetch + mutation logic for the hardware settings page.
// Centralises state so the page orchestrator only deals with rendering.

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { OlxCategory, Proxy, WorkerStatus } from "./types";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

// ---------------------------------------------------------------------------
// Individual fetch helpers (internal, exported for testing)
// ---------------------------------------------------------------------------

export async function fetchWorkerStatusRequest(): Promise<WorkerStatus> {
  const res = await fetch(`${HARDWARE_API}/api/worker/status`);
  if (!res.ok) throw new Error("Failed to fetch worker status");
  return res.json() as Promise<WorkerStatus>;
}

export async function fetchCategoriesRequest(): Promise<OlxCategory[]> {
  const res = await fetch(`${HARDWARE_API}/api/olx-categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json() as Promise<OlxCategory[]>;
}

export async function fetchProxiesRequest(): Promise<Proxy[]> {
  const res = await fetch(`${HARDWARE_API}/api/proxies`);
  if (!res.ok) throw new Error("Failed to fetch proxies");
  return res.json() as Promise<Proxy[]>;
}

export async function fetchWebhookRequest(): Promise<{ configured: boolean }> {
  const res = await fetch(`${HARDWARE_API}/api/discord-webhook`);
  if (!res.ok) throw new Error("Failed to fetch webhook");
  return res.json() as Promise<{ configured: boolean }>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface SettingsState {
  // Worker
  workerStatus: WorkerStatus | null;
  workerLoading: boolean;
  // Categories
  categories: OlxCategory[];
  categoriesLoading: boolean;
  newCatPath: string;
  setNewCatPath: (v: string) => void;
  newCatLabel: string;
  setNewCatLabel: (v: string) => void;
  newCatAllowed: string[];
  setNewCatAllowed: (v: string[]) => void;
  // Webhook
  webhookUrl: string;
  setWebhookUrl: (v: string) => void;
  webhookConfigured: boolean;
  webhookTesting: boolean;
  // Proxies
  proxies: Proxy[];
  proxiesLoading: boolean;
  newProxyUrl: string;
  setNewProxyUrl: (v: string) => void;
  testingProxies: boolean;
  // Category actions
  addCategory: (path: string, label: string, allowedItemCategories?: string[]) => Promise<void>;
  updateCategoryAllowed: (id: number, allowedItemCategories: string[]) => Promise<void>;
  toggleCategory: (id: number) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  // Webhook actions
  saveWebhook: () => Promise<void>;
  testWebhook: () => Promise<void>;
  // Proxy actions
  addProxy: () => Promise<void>;
  deleteProxy: (id: number) => Promise<void>;
  resetProxy: (id: number) => Promise<void>;
  testAllProxies: () => Promise<void>;
}

export function useSettingsState(): SettingsState {
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [workerLoading, setWorkerLoading] = useState(true);

  const [categories, setCategories] = useState<OlxCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [newCatPath, setNewCatPath] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatAllowed, setNewCatAllowed] = useState<string[]>([]);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);

  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [proxiesLoading, setProxiesLoading] = useState(true);
  const [newProxyUrl, setNewProxyUrl] = useState("");
  const [testingProxies, setTestingProxies] = useState(false);

  // -------------------------------------------------------------------------
  // Fetches
  // -------------------------------------------------------------------------

  const fetchWorkerStatus = useCallback(async () => {
    setWorkerLoading(true);
    try {
      setWorkerStatus(await fetchWorkerStatusRequest());
    } catch {
      setWorkerStatus(null);
    } finally {
      setWorkerLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      setCategories(await fetchCategoriesRequest());
    } catch {
      toast.error("Erro ao carregar categorias");
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const fetchProxies = useCallback(async () => {
    setProxiesLoading(true);
    try {
      setProxies(await fetchProxiesRequest());
    } catch {
      toast.error("Erro ao carregar proxies");
    } finally {
      setProxiesLoading(false);
    }
  }, []);

  const fetchWebhook = useCallback(async () => {
    try {
      const data = await fetchWebhookRequest();
      setWebhookConfigured(data.configured);
    } catch {}
  }, []);

  useEffect(() => {
    fetchWorkerStatus();
    fetchCategories();
    fetchProxies();
    fetchWebhook();
  }, [fetchWorkerStatus, fetchCategories, fetchProxies, fetchWebhook]);

  // -------------------------------------------------------------------------
  // Category mutations
  // -------------------------------------------------------------------------

  async function addCategory(path: string, label: string, allowedItemCategories?: string[]) {
    try {
      const res = await fetch(`${HARDWARE_API}/api/olx-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, label, allowed_item_categories: allowedItemCategories || [] }),
      });
      if (!res.ok) throw new Error("Failed to add category");
      toast.success(`Categoria "${label}" adicionada`);
      setNewCatPath("");
      setNewCatLabel("");
      setNewCatAllowed([]);
      fetchCategories();
    } catch {
      toast.error("Erro ao adicionar categoria");
    }
  }

  async function updateCategoryAllowed(id: number, allowedItemCategories: string[]) {
    try {
      const res = await fetch(`${HARDWARE_API}/api/olx-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowed_item_categories: allowedItemCategories }),
      });
      if (!res.ok) throw new Error("Failed to update category");
      fetchCategories();
    } catch {
      toast.error("Erro ao atualizar categoria");
    }
  }

  async function toggleCategory(id: number) {
    try {
      const res = await fetch(`${HARDWARE_API}/api/olx-categories/${id}/toggle`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to toggle category");
      fetchCategories();
    } catch {
      toast.error("Erro ao alterar categoria");
    }
  }

  async function deleteCategory(id: number) {
    try {
      const res = await fetch(`${HARDWARE_API}/api/olx-categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete category");
      toast.success("Categoria removida");
      fetchCategories();
    } catch {
      toast.error("Erro ao remover categoria");
    }
  }

  // -------------------------------------------------------------------------
  // Webhook mutations
  // -------------------------------------------------------------------------

  async function saveWebhook() {
    try {
      const res = await fetch(`${HARDWARE_API}/api/discord-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Webhook salvo");
      setWebhookUrl("");
      fetchWebhook();
    } catch {
      toast.error("Erro ao salvar webhook");
    }
  }

  async function testWebhook() {
    setWebhookTesting(true);
    try {
      const res = await fetch(`${HARDWARE_API}/api/discord-webhook/test`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Alerta de teste enviado ao Discord");
    } catch {
      toast.error("Erro ao enviar teste");
    } finally {
      setWebhookTesting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Proxy mutations
  // -------------------------------------------------------------------------

  async function addProxy() {
    if (!newProxyUrl.trim()) return;
    try {
      const res = await fetch(
        `${HARDWARE_API}/api/proxies?url=${encodeURIComponent(newProxyUrl.trim())}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to add proxy");
      toast.success("Proxy adicionado");
      setNewProxyUrl("");
      fetchProxies();
    } catch {
      toast.error("Erro ao adicionar proxy");
    }
  }

  async function deleteProxy(id: number) {
    try {
      const res = await fetch(`${HARDWARE_API}/api/proxies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete proxy");
      toast.success("Proxy removido");
      fetchProxies();
    } catch {
      toast.error("Erro ao remover proxy");
    }
  }

  async function resetProxy(id: number) {
    try {
      const res = await fetch(`${HARDWARE_API}/api/proxies/${id}/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset proxy");
      toast.success("Fail count resetado");
      fetchProxies();
    } catch {
      toast.error("Erro ao resetar proxy");
    }
  }

  async function testAllProxies() {
    setTestingProxies(true);
    try {
      const res = await fetch(`${HARDWARE_API}/api/proxies/test`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to test proxies");
      const results = await res.json();
      const passed = Array.isArray(results)
        ? results.filter((r: { ok?: boolean; success?: boolean }) => r.ok || r.success).length
        : 0;
      const total = Array.isArray(results) ? results.length : 0;
      toast.success(`Teste completo: ${passed}/${total} proxies OK`);
      fetchProxies();
    } catch {
      toast.error("Erro ao testar proxies");
    } finally {
      setTestingProxies(false);
    }
  }

  return {
    workerStatus,
    workerLoading,
    categories,
    categoriesLoading,
    newCatPath,
    setNewCatPath,
    newCatLabel,
    setNewCatLabel,
    newCatAllowed,
    setNewCatAllowed,
    webhookUrl,
    setWebhookUrl,
    webhookConfigured,
    webhookTesting,
    proxies,
    proxiesLoading,
    newProxyUrl,
    setNewProxyUrl,
    testingProxies,
    addCategory,
    updateCategoryAllowed,
    toggleCategory,
    deleteCategory,
    saveWebhook,
    testWebhook,
    addProxy,
    deleteProxy,
    resetProxy,
    testAllProxies,
  };
}
