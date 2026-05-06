"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SimulationLeagueTotals } from "@/lib/annual-plan-calculator";

interface LeaguesTableProps {
  leagues: SimulationLeagueTotals[];
  onAddLeague: () => void;
  onUnlink: (simId: string) => void;
  onUpdateRepeat: (simId: string, repeatCount: number) => void;
  formatMoney: (v: number, currency: string) => string;
}

export function LeaguesTable({
  leagues,
  onAddLeague,
  onUnlink,
  onUpdateRepeat,
  formatMoney,
}: LeaguesTableProps) {
  const fmt = (v: number) => formatMoney(v, "usd");

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold">Ligas do ano</p>
            <p className="text-xs text-muted-foreground">
              Cada liga é uma simulação. Cada liga tem seus próprios custos (proxy, keys, leveling, stash, etc.).
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onAddLeague}>
            <Plus className="mr-1 h-4 w-4" />
            Adicionar liga
          </Button>
        </div>

        {leagues.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">
            Nenhuma liga adicionada. Clique em "Adicionar liga" para começar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Simulação</TableHead>
                  <TableHead>Liga</TableHead>
                  <TableHead className="text-center">Kind</TableHead>
                  <TableHead className="text-center">Semanas</TableHead>
                  <TableHead className="text-center w-28">Repetições</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custo op.</TableHead>
                  <TableHead className="text-right">Custo único</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leagues.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/farm/simulations/${l.id}`}
                          className="font-medium hover:underline"
                        >
                          {l.name}
                        </Link>
                        {l.repeatCount > 1 && (
                          <Badge variant="secondary" className="text-xs font-mono">
                            × {l.repeatCount}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.league}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={l.kind === "forecast" ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {l.kind === "forecast" ? "Forecast" : "Oper."}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {l.durationWeeks}
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={1}
                        value={l.repeatCount}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n >= 1) onUpdateRepeat(l.id, n);
                        }}
                        className="h-8 w-20 mx-auto text-center font-mono"
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">
                      {fmt(l.revenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">
                      {fmt(l.operationalCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">
                      {fmt(l.oneTimeCost)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums text-sm font-medium",
                        l.profit >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {fmt(l.profit)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs",
                        l.roi >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {l.roi.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onUnlink(l.id)}
                        title="Remover do plano"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
