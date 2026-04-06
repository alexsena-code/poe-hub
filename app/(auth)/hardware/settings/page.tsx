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
  Settings,
  Wifi,
  WifiOff,
  Shield,
  Trash2,
  RefreshCw,
  Plus,
  Power,
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
}

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

  useEffect(() => {
    fetchWorkerStatus();
    fetchCategories();
    fetchProxies();
  }, [fetchWorkerStatus, fetchCategories, fetchProxies]);

  // -----------------------------------------------------------------------
  // Category actions
  // -----------------------------------------------------------------------

  async function addCategory(path: string, label: string) {
    try {
      const res = await fetch(`${HARDWARE_API}/api/olx-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, label }),
      });
      if (!res.ok) throw new Error("Failed to add category");
      toast.success(`Categoria "${label}" adicionada`);
      setNewCatPath("");
      setNewCatLabel("");
      fetchCategories();
    } catch {
      toast.error("Erro ao adicionar categoria");
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
          <div className="flex gap-2 flex-wrap">
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
            <Button
              size="sm"
              disabled={!newCatPath.trim() || !newCatLabel.trim()}
              onClick={() => addCategory(newCatPath.trim(), newCatLabel.trim())}
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
