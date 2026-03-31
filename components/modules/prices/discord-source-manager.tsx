"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface DiscordSource {
  id: string;
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
  isActive: boolean;
  cnlAuthorIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface SourceFormData {
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
  isActive: boolean;
  cnlAuthorIds: string;
}

const EMPTY_FORM: SourceFormData = {
  serverId: "",
  serverName: "",
  channelId: "",
  channelName: "",
  isActive: true,
  cnlAuthorIds: "",
};

export function DiscordSourceManager() {
  const [sources, setSources] = useState<DiscordSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SourceFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/discord-sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data.data ?? data);
      }
    } catch {
      toast.error("Erro ao carregar sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(source: DiscordSource) {
    setEditingId(source.id);
    setForm({
      serverId: source.serverId,
      serverName: source.serverName,
      channelId: source.channelId,
      channelName: source.channelName,
      isActive: source.isActive,
      cnlAuthorIds: source.cnlAuthorIds.join(", "),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.serverId || !form.serverName || !form.channelId || !form.channelName) {
      toast.error("Preencha todos os campos obrigatorios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        serverId: form.serverId.trim(),
        serverName: form.serverName.trim(),
        channelId: form.channelId.trim(),
        channelName: form.channelName.trim(),
        isActive: form.isActive,
        cnlAuthorIds: form.cnlAuthorIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      };

      const url = editingId
        ? `/api/discord-sources/${editingId}`
        : "/api/discord-sources";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingId ? "Source atualizado" : "Source criado");
        setDialogOpen(false);
        fetchSources();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Erro ao salvar source");
      }
    } catch {
      toast.error("Erro ao salvar source");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(source: DiscordSource) {
    if (!confirm(`Deletar o source "${source.serverName} / ${source.channelName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/discord-sources/${source.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Source deletado");
        fetchSources();
      } else {
        toast.error("Erro ao deletar source");
      }
    } catch {
      toast.error("Erro ao deletar source");
    }
  }

  async function handleToggleActive(source: DiscordSource) {
    try {
      const res = await fetch(`/api/discord-sources/${source.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !source.isActive }),
      });
      if (res.ok) {
        toast.success(`Source ${source.isActive ? "desativado" : "ativado"}`);
        fetchSources();
      } else {
        toast.error("Erro ao atualizar source");
      }
    } catch {
      toast.error("Erro ao atualizar source");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Configure os canais do Discord para coleta de precos.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Source
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Source" : "Novo Source"}
              </DialogTitle>
              <DialogDescription>
                Configure um canal do Discord para coleta de precos.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serverId">Server ID *</Label>
                  <Input
                    id="serverId"
                    placeholder="123456789012345678"
                    value={form.serverId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serverId: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serverName">Nome do Servidor *</Label>
                  <Input
                    id="serverName"
                    placeholder="Path of Trade"
                    value={form.serverName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serverName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="channelId">Channel ID *</Label>
                  <Input
                    id="channelId"
                    placeholder="123456789012345678"
                    value={form.channelId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, channelId: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channelName">Nome do Canal *</Label>
                  <Input
                    id="channelName"
                    placeholder="#precos-divine"
                    value={form.channelName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, channelName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnlAuthorIds">IDs dos Autores CNL</Label>
                <Input
                  id="cnlAuthorIds"
                  placeholder="ID1, ID2, ID3 (separados por virgula)"
                  value={form.cnlAuthorIds}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cnlAuthorIds: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  IDs do Discord dos autores classificados como CNL (revendedor principal).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isActive}
                  onClick={() =>
                    setForm((f) => ({ ...f, isActive: !f.isActive }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    form.isActive ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                      form.isActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <Label>Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sources Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Servidor</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Autores CNL</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : sources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum source configurado
                </TableCell>
              </TableRow>
            ) : (
              sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{source.serverName}</span>
                      <span className="block text-xs text-muted-foreground font-mono">
                        {source.serverId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{source.channelName}</span>
                      <span className="block text-xs text-muted-foreground font-mono">
                        {source.channelId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => handleToggleActive(source)} className="cursor-pointer">
                      <Badge variant={source.isActive ? "default" : "secondary"}>
                        {source.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {source.cnlAuthorIds.length} ID{source.cnlAuthorIds.length !== 1 ? "s" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(source.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(source)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(source)}
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
    </div>
  );
}
