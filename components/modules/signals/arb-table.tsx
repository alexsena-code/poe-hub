"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ArbRow } from "@/lib/cx-mock";

const fmt = (v: number, dp = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: dp });

export function ArbTable({ rows }: { rows: ArbRow[] }) {
  const sorted = [...rows].sort((a, b) => b.edgePct - a.edgePct);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Triangular chaos↔item↔divine. <b>edge</b> = discrepância que EXCEDE o grão (ruído/quantização do mercado divine). conf ALTA = edge &gt; 0 e volume divine ok.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">preço (chaos)</TableHead>
              <TableHead className="text-right">via divine</TableHead>
              <TableHead className="text-right">disc%</TableHead>
              <TableHead className="text-right">grão%</TableHead>
              <TableHead className="text-right">edge%</TableHead>
              <TableHead className="text-right">vol divine</TableHead>
              <TableHead>conf</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.item}>
                <TableCell className="font-medium">{r.item}</TableCell>
                <TableCell className="text-right font-mono">{fmt(r.priceChaos)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(r.priceViaDivine)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(r.discPct, 1)}%</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{fmt(r.grainPct, 1)}%</TableCell>
                <TableCell className={`text-right font-mono ${r.edgePct >= 0 ? "text-green-500" : "text-destructive"}`}>{fmt(r.edgePct, 1)}%</TableCell>
                <TableCell className="text-right font-mono">{fmt(r.volDivine, 0)}</TableCell>
                <TableCell><Badge variant={r.conf === "ALTA" ? "default" : "outline"} className="text-[10px]">{r.conf}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
