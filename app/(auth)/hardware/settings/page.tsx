"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Settings,
  Wifi,
  WifiOff,
  Shield,
  Trash2,
  RefreshCw,
  Plus,
  Power,
  ChevronDown,
  Bell,
  Send,
} from "lucide-react";

const HARDWARE_API =
  process.env.NEXT_PUBLIC_HARDWARE_API_URL || "http://localhost:8001";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OlxCategory {
  id: number;
  path: string;
  label: string;
  is_active: boolean;
  allowed_item_categories: string[];
}

const ITEM_CATEGORIES = [
  { value: "gpu", label: "GPU" },
  { value: "cpu-kit", label: "CPU Kit" },
  { value: "ram", label: "RAM" },
  { value: "psu", label: "PSU (Fonte)" },
  { value: "ssd", label: "SSD" },
  { value: "motherboard", label: "Placa Mãe" },
  { value: "monitor", label: "Monitor" },
] as const;

interface Proxy {
  id: number;
  url: string;
  is_active: boolean;
  fail_count: number;
  last_used: string | null;
  last_success: string | null;
  last_error: string | null;
}

interface WorkerStatus {
  online: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskProxyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
  } catch {
    // If URL has user:pass@host:port format without protocol
    const atIndex = url.lastIndexOf("@");
    if (atIndex !== -1) return url.slice(atIndex + 1);
    return url;
  }
}

function proxyRowClass(failCount: number): string {
  if (failCount >= 5) return "bg-red-500/10";
  if (failCount >= 1) return "bg-yellow-500/10";
  return "";
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SUGGESTED_CATEGORIES = [
  { path: "/eletronicos", label: "Eletronicos" },
  { path: "/para-a-sua-casa", label: "Para a sua casa" },
  { path: "/celulares-e-telefones", label: "Celulares e Telefones" },
  { path: "/video-games", label: "Video Games" },
];

// ---------------------------------------------------------------------------
// Item Category Multi-Select
// ---------------------------------------------------------------------------

function ItemCategoryMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (val: string[]) => void;
}) {
  const toggle = (cat: string) => {
    onChange(
      value.includes(cat) ? value.filter((v) => v !== cat) : [...value, cat]
    );
  };

  const selectedLabels = value
    .map((v) => ITEM_CATEGORIES.find((c) => c.value === v)?.label || v)
    .join(", ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[140px] justify-between text-xs font-normal"
        >
          <span className="truncate max-w-[160px]">
            {value.length === 0 ? "Todos" : selectedLabels}
          </span>
          <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {ITEM_CATEGORIES.map((cat) => (
            <label
              key={cat.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
            >
              <Checkbox
                checked={value.includes(cat.value)}
                onCheckedChange={() => toggle(cat.value)}
              />
              {cat.label}
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs text-muted-foreground"
            onClick={() => onChange([])}
          >
            Limpar (buscar todos)
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HardwareSettingsPage() {
  // Worker status
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [workerLoading, setWorkerLoading] = useState(true);

  // Categories
  const [categories, setCategories] = useState<OlxCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [newCatPath, setNewCatPath] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatAllowed, setNewCatAllowed] = useState<string[]>([]);

  // Discord Webhook
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);

  // Proxies
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [proxiesLoading, setProxiesLoading] = useState(true);
  const [newProxyUrl, setNewProxyUrl] = useState("");
  const [testingProxies, setTestingProxies] = useState(false);

  // -----------------------------------------------------------------------
  // Fetch helpers
  // -----------------------------------------------------------------------

  const fetchWorkerStatus = useCallback(async () => {
    setWorkerLoading(true);
    try {
      const res = await fetch(`${HARDWARE_API}/api/worker/status`);
      if (!res.ok) throw new Error("Failed to fetch worker status");
      setWorkerStatus(await res.json());
    } catch {
      setWorkerStatus(null);
    } finally {
      setWorkerLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await fetch(`${HARDWARE_API}/api/olx-categories`);
      if (!res.ok) throw new Error("Failed to fetch categories");
      setCategories(await res.json());
    } catch {
      toast.error("Erro ao carregar categorias");
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const fetchProxies = useCallback(async () => {
    setProxiesLoading(true);
    try {
      const res = await fetch(`${HARDWARE_API}/api/proxies`);
      if (!res.ok) throw new Error("Failed to fetch proxies");
      setProxies(await res.json());
    } catch {
      toast.error("Erro ao carregar proxies");
    } finally {
      setProxiesLoading(false);
    }
  }, []);

  const fetchWebhook = useCallback(async () => {
    try {
      const res = await fetch(`${HARDWARE_API}/api/discord-webhook`);
      if (res.ok) {
        const data = await res.json();
        setWebhookConfigured(data.configured);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchWorkerStatus();
    fetchCategories();
    fetchProxies();
    fetchWebhook();
  }, [fetchWorkerStatus, fetchCategories, fetchProxies, fetchWebhook]);

  // -----------------------------------------------------------------------
  // Category actions
  // -----------------------------------------------------------------------

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
      const res = await fetch(
        `${HARDWARE_API}/api/olx-categories/${id}/toggle`,
        { method: "PATCH" }
      );
      if (!res.ok) throw new Error("Failed to toggle category");
      fetchCategories();
    } catch {
      toast.error("Erro ao alterar categoria");
    }
  }

  async function deleteCategory(id: number) {
    try {
      const res = await fetch(`${HARDWARE_API}/api/olx-categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete category");
      toast.success("Categoria removida");
      fetchCategories();
    } catch {
      toast.error("Erro ao remover categoria");
    }
  }

  // -----------------------------------------------------------------------
  // Discord Webhook actions
  // -----------------------------------------------------------------------

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
      const res = await fetch(`${HARDWARE_API}/api/discord-webhook/test`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("Alerta de teste enviado ao Discord");
    } catch {
      toast.error("Erro ao enviar teste");
    } finally {
      setWebhookTesting(false);
    }
  }

  // -----------------------------------------------------------------------
  // Proxy actions
  // -----------------------------------------------------------------------

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
      const res = await fetch(`${HARDWARE_API}/api/proxies/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete proxy");
      toast.success("Proxy removido");
      fetchProxies();
    } catch {
      toast.error("Erro ao remover proxy");
    }
  }

  async function resetProxy(id: number) {
    try {
      const res = await fetch(`${HARDWARE_API}/api/proxies/${id}/reset`, {
        method: "POST",
      });
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
      const res = await fetch(`${HARDWARE_API}/api/proxies/test`, {
        method: "POST",
      });
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

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage scraper configuration, OLX categories, and proxies.
        </p>
      </div>

      {/* Worker Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Worker Status</CardTitle>
        </CardHeader>
        <CardContent>
          {workerLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : workerStatus?.online ? (
            <div className="flex items-center gap-2 text-green-500">
              <Wifi className="h-5 w-5" />
              <span className="font-medium">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500">
              <WifiOff className="h-5 w-5" />
              <span className="font-medium">Offline</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OLX Categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">OLX Search Categories</CardTitle>
          <CardDescription>
            Categories where the scraper searches for deals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          <div className="flex gap-2 flex-wrap items-end">
            <Input
              placeholder="/path"
              value={newCatPath}
              onChange={(e) => setNewCatPath(e.target.value)}
              className="w-48"
            />
            <Input
              placeholder="Label"
              value={newCatLabel}
              onChange={(e) => setNewCatLabel(e.target.value)}
              className="w-48"
            />
            <ItemCategoryMultiSelect
              value={newCatAllowed}
              onChange={setNewCatAllowed}
            />
            <Button
              size="sm"
              disabled={!newCatPath.trim() || !newCatLabel.trim()}
              onClick={() => addCategory(newCatPath.trim(), newCatLabel.trim(), newCatAllowed)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {/* Quick-add suggestions */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground self-center">
              Quick add:
            </span>
            {SUGGESTED_CATEGORIES.map((s) => {
              const exists = categories.some((c) => c.path === s.path);
              return (
                <Button
                  key={s.path}
                  variant="outline"
                  size="sm"
                  disabled={exists}
                  className="text-xs"
                  onClick={() => addCategory(s.path, s.label)}
                >
                  {s.path}
                </Button>
              );
            })}
          </div>

          {/* Table */}
          {categoriesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No categories configured yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Tipos de Item</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-mono text-sm">
                        {cat.path}
                      </TableCell>
                      <TableCell>{cat.label}</TableCell>
                      <TableCell>
                        <ItemCategoryMultiSelect
                          value={cat.allowed_item_categories || []}
                          onChange={(val) => updateCategoryAllowed(cat.id, val)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={cat.is_active ? "default" : "secondary"}
                          className={
                            cat.is_active
                              ? "bg-green-600 hover:bg-green-700"
                              : ""
                          }
                        >
                          {cat.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCategory(cat.id)}
                            title={cat.is_active ? "Disable" : "Enable"}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCategory(cat.id)}
                            title="Delete"
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discord Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" /> Discord Alerts
          </CardTitle>
          <CardDescription>
            Receba notificações quando um deal abaixo do preço máximo for encontrado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge
              variant={webhookConfigured ? "default" : "secondary"}
              className={webhookConfigured ? "bg-green-600" : ""}
            >
              {webhookConfigured ? "Configurado" : "Não configurado"}
            </Badge>
            {webhookConfigured && (
              <Button
                size="sm"
                variant="outline"
                disabled={webhookTesting}
                onClick={testWebhook}
              >
                <Send className={`h-4 w-4 mr-1 ${webhookTesting ? "animate-pulse" : ""}`} />
                Testar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="https://discord.com/api/webhooks/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1"
              type="password"
            />
            <Button
              size="sm"
              disabled={!webhookUrl.trim()}
              onClick={saveWebhook}
            >
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Crie um webhook no Discord: Configurações do Canal → Integrações → Webhooks → Novo Webhook
          </p>
        </CardContent>
      </Card>

      {/* Proxies */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" /> Proxy Pool
          </CardTitle>
          <CardDescription>
            Proxies used for scraping (currently not needed - using residential
            IP via WebSocket worker)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form + test all */}
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="http://user:pass@host:port"
              value={newProxyUrl}
              onChange={(e) => setNewProxyUrl(e.target.value)}
              className="flex-1 min-w-[280px]"
            />
            <Button
              size="sm"
              disabled={!newProxyUrl.trim()}
              onClick={addProxy}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={testingProxies || proxies.length === 0}
              onClick={testAllProxies}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${testingProxies ? "animate-spin" : ""}`}
              />
              Test All
            </Button>
          </div>

          {/* Table */}
          {proxiesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : proxies.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No proxies configured.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fails</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Last Success</TableHead>
                    <TableHead>Last Error</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proxies.map((proxy) => (
                    <TableRow
                      key={proxy.id}
                      className={proxyRowClass(proxy.fail_count)}
                    >
                      <TableCell className="font-mono text-sm">
                        {maskProxyUrl(proxy.url)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={proxy.is_active ? "default" : "secondary"}
                          className={
                            proxy.is_active
                              ? "bg-green-600 hover:bg-green-700"
                              : ""
                          }
                        >
                          {proxy.is_active ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            proxy.fail_count >= 5
                              ? "text-red-500 font-bold"
                              : proxy.fail_count >= 1
                                ? "text-yellow-500 font-medium"
                                : "text-green-500"
                          }
                        >
                          {proxy.fail_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(proxy.last_used)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(proxy.last_success)}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground max-w-[200px] truncate"
                        title={proxy.last_error || ""}
                      >
                        {proxy.last_error || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetProxy(proxy.id)}
                            title="Reset fail count"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProxy(proxy.id)}
                            title="Delete"
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
