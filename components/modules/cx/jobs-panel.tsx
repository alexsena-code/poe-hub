"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, RefreshCw } from "lucide-react";

const JOB_TYPES = [
  "read_state",
  "run_job",
  "place_order",
  "cancel",
  "collect",
  "pause",
  "resume",
  "param_update",
] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  sent: "secondary",
  acked: "secondary",
  done: "default",
  failed: "destructive",
  expired: "destructive",
};

interface CxJobRow {
  id: string;
  executorId: string;
  type: string;
  status: string;
  priority: number;
  error: string | null;
  result: unknown;
  createdAt: string;
  doneAt: string | null;
}

export function JobsPanel() {
  const [jobs, setJobs] = useState<CxJobRow[]>([]);
  const [executorIds, setExecutorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form do novo comando
  const [formExecutor, setFormExecutor] = useState("");
  const [formType, setFormType] = useState<string>("read_state");
  const [formPayload, setFormPayload] = useState("{}");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, execRes] = await Promise.all([
        fetch("/api/cx/commands?limit=30"),
        fetch("/api/cx/executors"),
      ]);
      if (jobsRes.ok) {
        const json = await jobsRes.json();
        setJobs(json.data ?? []);
      }
      if (execRes.ok) {
        const json = await execRes.json();
        setExecutorIds(
          (json.data ?? []).map((e: { executorId: string }) => e.executorId)
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [load]);

  async function submit() {
    let payload: unknown;
    try {
      payload = JSON.parse(formPayload || "{}");
    } catch {
      toast.error("Payload não é JSON válido");
      return;
    }
    if (!formExecutor) {
      toast.error("Escolha um executor");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/cx/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executorId: formExecutor, type: formType, payload }),
      });
      if (res.ok) {
        toast.success("Comando enfileirado");
        setOpen(false);
        setFormPayload("{}");
        load();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(`Falha ao criar comando: ${err?.error ?? res.status}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Jobs</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Atualizar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Novo comando
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo comando</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Executor</Label>
                  <Select value={formExecutor} onValueChange={setFormExecutor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o executor" />
                    </SelectTrigger>
                    <SelectContent>
                      {executorIds.map((id) => (
                        <SelectItem key={id} value={id}>
                          {id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Payload (JSON)</Label>
                  <Textarea
                    value={formPayload}
                    onChange={(e) => setFormPayload(e.target.value)}
                    rows={5}
                    className="font-mono text-xs"
                    placeholder='{"side":"buy","item":"Orb of Annulment","ratio":7,"qty":10}'
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? "Enviando..." : "Enfileirar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando..." : "Nenhum job ainda."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criado</TableHead>
                <TableHead>Executor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resultado / Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(j.createdAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{j.executorId}</TableCell>
                  <TableCell>{j.type}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[j.status] ?? "outline"}>
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[24rem]">
                    {j.error ? (
                      <span className="text-xs text-destructive">{j.error}</span>
                    ) : j.result != null ? (
                      <pre className="max-h-24 overflow-auto rounded bg-muted p-1.5 text-[10px] leading-tight">
                        {JSON.stringify(j.result, null, 1)}
                      </pre>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
