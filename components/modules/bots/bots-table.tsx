"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BotStatusBadge } from "./bot-status-badge";
import { SecretField } from "./secret-field";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";

interface Bot {
  id: string;
  nick: string;
  email: string;
  password: string;
  proxyIp: string;
  proxyEol: string | null;
  status: "active" | "inactive" | "banned" | "maintenance";
  notes: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function BotsTableInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bots, setBots] = useState<Bot[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [loading, setLoading] = useState(true);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", pagination.page.toString());
    params.set("limit", "20");
    if (search) params.set("search", search);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);

    const res = await fetch(`/api/bots?${params}`);
    const data = await res.json();
    setBots(data.data);
    setPagination(data.pagination);
    setLoading(false);
  }, [pagination.page, search, statusFilter]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  async function handleStatusToggle(bot: Bot) {
    const newStatus = bot.status === "active" ? "inactive" : "active";
    const res = await fetch(`/api/bots/${bot.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      toast.success(`Status alterado para ${newStatus}`);
      fetchBots();
    } else {
      toast.error("Erro ao alterar status");
    }
  }

  async function handleDelete(bot: Bot) {
    if (!confirm(`Deletar o bot "${bot.nick}"?`)) return;

    const res = await fetch(`/api/bots/${bot.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Bot deletado");
      fetchBots();
    } else {
      toast.error("Erro ao deletar bot");
    }
  }

  function isProxyExpired(proxyEol: string | null) {
    if (!proxyEol) return false;
    return new Date(proxyEol) < new Date();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Buscar por nick ou email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="max-w-sm"
        />
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
            <SelectItem value="banned">Banido</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nick</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Proxy IP</TableHead>
              <TableHead>Proxy EOL</TableHead>
              <TableHead>Senha PoE</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : bots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum bot encontrado
                </TableCell>
              </TableRow>
            ) : (
              bots.map((bot) => (
                <TableRow key={bot.id}>
                  <TableCell className="font-medium">{bot.nick}</TableCell>
                  <TableCell>{bot.email}</TableCell>
                  <TableCell>
                    <button onClick={() => handleStatusToggle(bot)} className="cursor-pointer">
                      <BotStatusBadge status={bot.status} />
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {bot.proxyIp}
                  </TableCell>
                  <TableCell>
                    {bot.proxyEol ? (
                      <span className="flex items-center gap-1">
                        {isProxyExpired(bot.proxyEol) && (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                        <span className={isProxyExpired(bot.proxyEol) ? "text-destructive" : ""}>
                          {formatDate(bot.proxyEol)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <SecretField
                      value={bot.password}
                      onReveal={async () => {
                        const res = await fetch(`/api/bots/${bot.id}?reveal=true`);
                        const data = await res.json();
                        return data.password;
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.push(`/bots/${bot.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(bot)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total} bot{pagination.total !== 1 ? "s" : ""} encontrado{pagination.total !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              Anterior
            </Button>
            <span className="flex items-center text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BotsTable() {
  return (
    <Suspense>
      <BotsTableInner />
    </Suspense>
  );
}
