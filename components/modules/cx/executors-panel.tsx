"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw } from "lucide-react";

export interface CxExecutorRow {
  id: string;
  executorId: string;
  pcName: string | null;
  league: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  connectedAt: string | null;
  pendingJobs: number;
}

function fmtDate(v: string | null): string {
  return v ? new Date(v).toLocaleString("pt-BR") : "-";
}

export function ExecutorsPanel() {
  const [executors, setExecutors] = useState<CxExecutorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cx/executors");
      if (res.ok) {
        const json = await res.json();
        setExecutors(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Executores</CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {executors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando..." : "Nenhum executor registrado ainda."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Executor</TableHead>
                <TableHead>PC</TableHead>
                <TableHead>Liga</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Jobs pendentes</TableHead>
                <TableHead>Visto por último</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executors.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.executorId}</TableCell>
                  <TableCell>{e.pcName ?? "-"}</TableCell>
                  <TableCell>{e.league ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={e.isOnline ? "default" : "outline"}>
                      {e.isOnline ? "online" : "offline"}
                    </Badge>
                  </TableCell>
                  <TableCell>{e.pendingJobs}</TableCell>
                  <TableCell className="text-xs">{fmtDate(e.lastSeen)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
